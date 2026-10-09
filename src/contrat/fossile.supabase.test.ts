// ════════════════════════════════════════════════════════════════════
//  src/contrat/fossile.supabase.test.ts
//
//  Le trajet complet du laboratoire, contre une VRAIE base :
//
//      demande → analyse_fossile → rendre_fossile → pokemon + pokedex
//                               → file d'annonce → message annoncé
//
//  ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────
//
//  Parce que `rendre_fossile` est la fonction la plus réécrite du dépôt
//  — `0002`, `0013`, `0016`, `0017` — et qu'elle s'est cassée à chaque
//  génération sauf la dernière, toujours de la même façon : une
//  correction juste qui perd le reste.
//
//  Et parce que `0017` lui ajoute la chose la plus dangereuse qu'on
//  puisse ajouter à une fonction qui crée un pokémon : **un second
//  appel**. Si l'idempotence est fausse, un joueur obtient deux pokémon
//  pour un fossile, et le seul moment où ça se verra est une coupure du
//  forum — c'est-à-dire jamais en test, et une fois en vrai.
//
//  Trois choses sont donc vérifiées ici, et aucune ne peut l'être
//  ailleurs :
//
//    1 · un fossile analysé donne UN pokémon de niveau 15 et le consomme ;
//    2 · deux appels n'en donnent pas deux ;
//    3 · une analyse sans espèce reste en attente et ne consomme rien.
//
//  Comme les autres contrats, il ne tourne que si on le lui demande :
//      CONTRAT_CIBLE=postgres CONTRAT_PGURL=postgres://…
//  Sans ça il s'annonce ignoré, à voix haute.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects } from "@std/assert";
import { FossilesSupabase } from "../adaptateurs/supabase/fossile.ts";
import { AppelEchoue } from "../adaptateurs/supabase/appel.ts";
import { NIVEAU_A_LA_NAISSANCE } from "../application/resurrection.ts";
import { appelPsql } from "./appel-psql.ts";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

const ANNA = "11111111-0000-0000-0000-00000000f001";
const COMPTE = 90601;
/** Amonita, parce que les fossiles en donnent. */
const AMONISTAR = 139;
const NAUTILE = 9201; //  un fossile, avec une espèce
const ORPHELIN = 9202; //  un fossile SANS espèce — le cas `impossible`
const POTION = 9203; //  pas un fossile du tout
const SUJET = 1299;

function psql(url: string, sql: string): Promise<string> {
  return new Deno.Command("psql", {
    args: [
      url,
      "--no-psqlrc",
      "--quiet",
      "--no-align",
      "--tuples-only",
      "--set=ON_ERROR_STOP=1",
      "--command",
      sql,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output().then(({ code, stdout, stderr }) => {
    if (code !== 0) throw new Error(new TextDecoder().decode(stderr).trim());
    return new TextDecoder().decode(stdout).trim();
  });
}

/** Le décor : une joueuse, deux fossiles dont un orphelin, une potion. */
async function decor(url: string): Promise<void> {
  await psql(
    url,
    `delete from analyse_fossile where joueur_id = '${ANNA}';
     delete from pokedex where joueur_id = '${ANNA}';
     delete from pokemon where joueur_id = '${ANNA}';
     delete from sac where joueur_id = '${ANNA}';
     delete from joueur where id = '${ANNA}' or forum_user_id = ${COMPTE};
     delete from fossile_espece where objet_id in (${NAUTILE}, ${ORPHELIN});
     delete from objet where id in (${NAUTILE}, ${ORPHELIN}, ${POTION});

     insert into espece (id, nom_fr, types, stade, pv_base)
       values (${AMONISTAR}, 'Amonistar', array['roche','eau'], 2, 70)
       on conflict (id) do nothing;

     insert into objet (id, slug, nom, famille, prix, en_vente)
       overriding system value values
       (${NAUTILE},  'nautile-de-contrat',  'Fossile Nautile de contrat',  'fossile', null, false),
       (${ORPHELIN}, 'orphelin-de-contrat', 'Fossile orphelin de contrat', 'fossile', null, false),
       (${POTION},   'potion-de-contrat-f', 'Potion de laboratoire',       'soin',     300, true);

     --  Une espèce pour le Nautile, AUCUNE pour l'orphelin : c'est tout
     --  l'écart entre « refusee » et « impossible ».
     insert into fossile_espece (objet_id, espece_id)
       values (${NAUTILE}, ${AMONISTAR});

     insert into joueur (id, forum_user_id, pseudo, pokedollars)
       values ('${ANNA}', ${COMPTE}, 'Anna du labo', 0);

     insert into sac (joueur_id, objet_id, quantite) values
       ('${ANNA}', ${NAUTILE}, 1),
       ('${ANNA}', ${ORPHELIN}, 1),
       ('${ANNA}', ${POTION}, 2);`,
  );
}

async function quantite(url: string, objetId: number): Promise<number> {
  const t = await psql(
    url,
    `select coalesce((select quantite from sac
        where joueur_id = '${ANNA}' and objet_id = ${objetId}), 0)`,
  );
  return Number(t);
}

async function pokemons(url: string): Promise<{ espece: number; niveau: number }[]> {
  const t = await psql(
    url,
    `select coalesce(jsonb_agg(jsonb_build_object(
              'espece', espece_id, 'niveau', niveau) order by capture_le)::text, '[]')
       from pokemon where joueur_id = '${ANNA}'`,
  );
  return JSON.parse(t);
}

async function etat(url: string, analyseId: string): Promise<string> {
  return await psql(url, `select etat from analyse_fossile where id = '${analyseId}'`);
}

/** Les analyses se distinguent par `message_id`, qui est unique. */
let prochain = 80000;
function message(): number {
  return ++prochain;
}

/** Demande une analyse par la fonction SQL — c'est le point d'entrée
 *  que `0017` ajoute, et il n'a pas encore d'adaptateur : la porte côté
 *  forum reste à décider. On l'appelle donc en direct, comme
 *  `services.supabase.test.ts` appelle les fonctions sans adaptateur. */
async function demander(
  url: string,
  objetId: number,
  reste: { messageId?: number; sujetId?: number | null; compte?: number } = {},
): Promise<Record<string, string>> {
  const sujet = reste.sujetId === null ? "null" : `${reste.sujetId ?? SUJET}`;
  const t = await psql(
    url,
    `select demander_une_analyse(jsonb_build_object(
       'messageId', ${reste.messageId ?? message()},
       'sujetId', ${sujet},
       'objetId', ${objetId},
       'forumUserId', ${reste.compte ?? COMPTE},
       'code', 'WM-ACDE-FGH'))::text`,
  );
  return JSON.parse(t);
}

function essai(
  nom: string,
  corps: (ctx: { labo: FossilesSupabase; url: string }) => Promise<void>,
): void {
  if (CIBLE !== "postgres" || PGURL === undefined) {
    //  À VOIX HAUTE. Un test qui se saute en silence est pire que pas de
    //  test : on croit avoir une couverture qu'on n'a pas.
    Deno.test({
      name: `labo réel · ${nom} — IGNORÉ faute de base`,
      ignore: true,
      fn: () => {},
    });
    return;
  }
  const url = PGURL;
  Deno.test(`labo réel · ${nom}`, async () => {
    await decor(url);
    await corps({ labo: new FossilesSupabase(appelPsql({ url })), url });
  });
}

// ── LE TEST QUI PORTE LE FICHIER ────────────────────────────────────

essai("un fossile analysé donne UN pokémon de niveau 15", async ({ labo, url }) => {
  const demande = await demander(url, NAUTILE);
  assertEquals(demande.etat, "acceptee");

  const verdict = await labo.rendre(demande.analyseId);

  assert(verdict.etat === "rendue", `pas rendue : ${JSON.stringify(verdict)}`);
  assertEquals(verdict.especeId, AMONISTAR);
  assertEquals(verdict.espece, "Amonistar");
  assertEquals(verdict.deja, false);

  //  Et surtout : les tables ont vraiment bougé.
  assertEquals(await pokemons(url), [{
    espece: AMONISTAR,
    //  LE NIVEAU DU MESSAGE EST CELUI DE LA BASE. Les deux constantes
    //  vivent à des endroits différents ; c'est ici qu'elles se
    //  rencontrent.
    niveau: NIVEAU_A_LA_NAISSANCE,
  }]);
  assertEquals(await quantite(url, NAUTILE), 0, "le fossile est consommé");
  assertEquals(await etat(url, demande.analyseId), "rendue");

  //  Le pokédex le compte comme attrapé : un pokémon réanimé est un
  //  pokémon obtenu.
  assertEquals(
    await psql(
      url,
      `select count(*) from pokedex
        where joueur_id = '${ANNA}' and espece_id = ${AMONISTAR}
          and attrape_le is not null`,
    ),
    "1",
  );
});

// ── LE SECOND TEST QUI PORTE LE FICHIER ─────────────────────────────

essai("DEUX APPELS NE DONNENT PAS DEUX POKÉMON", async ({ labo, url }) => {
  //  C'est ce que `0017` rend possible, et c'est la faute la plus chère
  //  qu'on puisse commettre ici : elle ne se verrait qu'une fois le
  //  forum tombé en pleine annonce, donc jamais en test et une fois en
  //  vrai.
  const demande = await demander(url, NAUTILE);
  const premier = await labo.rendre(demande.analyseId);
  const second = await labo.rendre(demande.analyseId);

  assert(premier.etat === "rendue");
  assert(second.etat === "rendue", `pas rendue : ${JSON.stringify(second)}`);
  //  LE MÊME VERDICT, MOT POUR MOT — c'est ce qui permet de reposter le
  //  même message.
  assertEquals(second.especeId, premier.especeId);
  assertEquals(second.espece, premier.espece);
  //  …à une marque près : le second dit qu'il rejoue.
  assertEquals(premier.deja, false);
  assertEquals(second.deja, true);

  assertEquals((await pokemons(url)).length, 1, "UN pokémon, pas deux");
  assertEquals(await quantite(url, NAUTILE), 0, "consommé une fois");
});

// ── le refus, qui survit (règle de 0013) ────────────────────────────

essai("un fossile qui n'est plus là est REFUSÉ, et le refus reste", async ({ labo, url }) => {
  const demande = await demander(url, NAUTILE);
  //  Le joueur demande, puis perd son fossile avant le passage de la
  //  relève — un échange, une clôture, un cadeau.
  await psql(url, `delete from sac where joueur_id = '${ANNA}' and objet_id = ${NAUTILE}`);

  const verdict = await labo.rendre(demande.analyseId);

  assert(verdict.etat === "refusee", `pas refusée : ${JSON.stringify(verdict)}`);
  assertEquals(verdict.motif, "FOSSILE_ABSENT");
  assert(verdict.detail.length > 0, "un refus sans détail n'explique rien");
  //  LE REFUS SURVIT. C'est le défaut de `0002` : il écrivait l'état
  //  puis levait, ce qui annulait l'écriture.
  assertEquals(await etat(url, demande.analyseId), "refusee");
  assertEquals((await pokemons(url)).length, 0);
});

essai("et un refus se rejoue aussi, à l'identique", async ({ labo, url }) => {
  //  Sinon un refus dont le message n'est pas parti serait recalculé le
  //  lendemain sur un sac entre-temps regarni, et la relève annoncerait
  //  une réanimation là où elle avait refusé.
  const demande = await demander(url, NAUTILE);
  await psql(url, `delete from sac where joueur_id = '${ANNA}' and objet_id = ${NAUTILE}`);
  const premier = await labo.rendre(demande.analyseId);

  await psql(
    url,
    `insert into sac (joueur_id, objet_id, quantite) values ('${ANNA}', ${NAUTILE}, 1)`,
  );
  const second = await labo.rendre(demande.analyseId);

  assert(premier.etat === "refusee");
  assert(second.etat === "refusee", `le verdict a changé : ${JSON.stringify(second)}`);
  assertEquals(second.motif, premier.motif);
  assertEquals(second.deja, true);
  assertEquals((await pokemons(url)).length, 0, "rien n'a été réanimé");
  assertEquals(await quantite(url, NAUTILE), 1, "le fossile rendu n'est pas consommé");
});

// ── l'impossible, qui n'est PAS un refus ────────────────────────────

essai("un fossile sans espèce reste EN ATTENTE et ne consomme rien", async ({ labo, url }) => {
  //  La distinction de `0013`, et elle vaut un pokémon : un refus est
  //  définitif, un impossible repart tout seul le jour où la ligne de
  //  `fossile_espece` existe.
  const demande = await demander(url, ORPHELIN);
  const verdict = await labo.rendre(demande.analyseId);

  assert(verdict.etat === "impossible", `pas impossible : ${JSON.stringify(verdict)}`);
  assertEquals(verdict.motif, "FOSSILE_SANS_ESPECE");
  assertEquals(await etat(url, demande.analyseId), "en_attente");
  assertEquals(await quantite(url, ORPHELIN), 1, "rien n'est consommé");
  assertEquals((await pokemons(url)).length, 0);
});

essai("et elle repart toute seule le jour où l'espèce existe", async ({ labo, url }) => {
  const demande = await demander(url, ORPHELIN);
  assertEquals((await labo.rendre(demande.analyseId)).etat, "impossible");

  //  Callista écrit la ligne qui manquait.
  await psql(
    url,
    `insert into fossile_espece (objet_id, espece_id)
       values (${ORPHELIN}, ${AMONISTAR})`,
  );

  const verdict = await labo.rendre(demande.analyseId);
  assert(verdict.etat === "rendue", `toujours pas : ${JSON.stringify(verdict)}`);
  //  `deja` est FAUX : aucun verdict n'avait été gardé, celui-ci est le
  //  premier. C'est exactement ce qu'on veut — sinon le journal
  //  compterait un rejeu là où il y a une vraie réanimation.
  assertEquals(verdict.deja, false);
  assertEquals(await quantite(url, ORPHELIN), 0);
});

// ── la file d'annonce ───────────────────────────────────────────────

essai(
  "la file rend l'analyse avec son sujet, son pseudo et son code",
  async ({ labo, url }) => {
    const demande = await demander(url, NAUTILE, { sujetId: 1301 });

    const file = await labo.aAnnoncer(10);
    const mienne = file.find((a) => a.analyseId === demande.analyseId);
    assert(mienne !== undefined, `absente de la file : ${JSON.stringify(file)}`);
    assertEquals(mienne.sujetId, 1301, "la réponse part où la demande a été faite");
    assertEquals(mienne.pseudo, "Anna du labo");
    assertEquals(mienne.fossile, "Fossile Nautile de contrat");
    assertEquals(mienne.code, "WM-ACDE-FGH");
    assertEquals(mienne.essais, 0);
  },
);

essai("annoncée, elle quitte la file ; et une seule fois", async ({ labo, url }) => {
  const demande = await demander(url, NAUTILE);
  await labo.rendre(demande.analyseId);
  await labo.annoncee(demande.analyseId, 80501);

  const file = await labo.aAnnoncer(10);
  assertEquals(file.find((a) => a.analyseId === demande.analyseId), undefined);
  assertEquals(
    await psql(
      url,
      `select annonce_message_id from analyse_fossile where id = '${demande.analyseId}'`,
    ),
    "80501",
  );

  //  UNE SECONDE ANNONCE N'ÉCRASE PAS LA PREMIÈRE : `annonce_le is
  //  null` est la condition de la mise à jour. Sinon un passage tardif
  //  remplacerait l'identifiant du vrai message par un autre.
  await labo.annoncee(demande.analyseId, 80999);
  assertEquals(
    await psql(
      url,
      `select annonce_message_id from analyse_fossile where id = '${demande.analyseId}'`,
    ),
    "80501",
  );
});

essai("une annonce qui échoue compte ses essais et reste en file", async ({ labo, url }) => {
  const demande = await demander(url, NAUTILE);
  assertEquals(await labo.echouee(demande.analyseId, "forum injoignable"), 1);
  assertEquals(await labo.echouee(demande.analyseId, "forum injoignable"), 2);

  const file = await labo.aAnnoncer(10);
  const mienne = file.find((a) => a.analyseId === demande.analyseId);
  assert(mienne !== undefined, "elle doit rester en file");
  assertEquals(mienne.essais, 2);
});

essai("une analyse SANS SUJET n'entre pas dans la file", async ({ labo, url }) => {
  //  Il n'y a nulle part où poster sa réponse. La rendre ferait échouer
  //  la tâche à chaque passage, sans espoir.
  const demande = await demander(url, NAUTILE, { sujetId: null });
  const file = await labo.aAnnoncer(50);
  assertEquals(file.find((a) => a.analyseId === demande.analyseId), undefined);
});

essai("la file borne ce qu'elle rend", async ({ labo, url }) => {
  for (let i = 0; i < 4; i++) {
    await psql(
      url,
      `insert into sac (joueur_id, objet_id, quantite) values ('${ANNA}', ${NAUTILE}, 1)
         on conflict (joueur_id, objet_id) do update set quantite = 1`,
    );
    await demander(url, NAUTILE);
  }
  assertEquals((await labo.aAnnoncer(2)).length, 2);
});

// ── la demande ──────────────────────────────────────────────────────

essai("le même message ne crée pas deux analyses", async ({ url }) => {
  //  `message_id` est unique depuis `0001`. Sans ce rattrapage, un
  //  accusé de réception qui n'est pas parti ferait analyser le fossile
  //  deux fois au passage suivant — ou lèverait une violation de
  //  contrainte en pleine relève.
  const m = message();
  const premier = await demander(url, NAUTILE, { messageId: m });
  const second = await demander(url, NAUTILE, { messageId: m });

  assertEquals(premier.etat, "acceptee");
  assertEquals(second.etat, "acceptee");
  assertEquals(second.analyseId, premier.analyseId);
  assertEquals(String(premier.deja), "false");
  assertEquals(String(second.deja), "true");
  assertEquals(
    await psql(url, `select count(*) from analyse_fossile where joueur_id = '${ANNA}'`),
    "1",
  );
});

essai("une potion n'est pas un fossile", async ({ url }) => {
  const r = await demander(url, POTION);
  assertEquals(r.etat, "refusee");
  assertEquals(r.motif, "PAS_UN_FOSSILE");
});

essai("un objet inconnu est refusé, pas accepté à vide", async ({ url }) => {
  const r = await demander(url, 999999);
  assertEquals(r.etat, "refusee");
  assertEquals(r.motif, "OBJET_INCONNU");
});

essai("un fossile qu'on n'a pas est refusé TOUT DE SUITE", async ({ url }) => {
  //  Plutôt que dans cinq minutes, par `rendre_fossile`. Le joueur sait
  //  dès sa demande que ça ne marchera pas.
  await psql(url, `delete from sac where joueur_id = '${ANNA}' and objet_id = ${NAUTILE}`);
  const r = await demander(url, NAUTILE);
  assertEquals(r.etat, "refusee");
  assertEquals(r.motif, "FOSSILE_ABSENT");
  assertEquals(
    await psql(url, `select count(*) from analyse_fossile where joueur_id = '${ANNA}'`),
    "0",
    "on n'écrit pas une analyse qu'on vient de refuser",
  );
});

essai("une demande NE CONSOMME PAS le fossile", async ({ url }) => {
  //  Un seul endroit débite, et c'est `rendre_fossile`. Deux endroits
  //  finiraient par débiter deux fois.
  await demander(url, NAUTILE);
  assertEquals(await quantite(url, NAUTILE), 1);
});

essai("un compte non lié est nommé, pas deviné", async ({ url }) => {
  await assertRejects(
    () => demander(url, NAUTILE, { compte: 90699 }),
    Error,
    "COMPTE_NON_LIE",
  );
});

// ── l'analyse introuvable ───────────────────────────────────────────

essai("une analyse qui n'existe pas lève, elle ne rend pas un refus", async ({ labo }) => {
  //  Règle de `0013` : il n'y a pas de ligne où écrire un refus.
  await assertRejects(
    () => labo.rendre("11111111-2222-3333-4444-555555555555"),
    AppelEchoue,
    "ANALYSE_INTROUVABLE",
  );
});
