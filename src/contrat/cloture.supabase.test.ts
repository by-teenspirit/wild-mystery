// ════════════════════════════════════════════════════════════════════
//  src/contrat/cloture.supabase.test.ts
//
//  Le trajet complet, contre une VRAIE base :
//
//      registre → domaine (evaluerCloture) → adaptateur → SQL → tables
//
//  Aucune des deux moitiés ne peut attraper seule ce que celui-ci
//  attrape. Les tests du domaine ne savent rien de la base ; pgTAP ne
//  sait rien du domaine. C'est à la jointure que vivent les bogues : une
//  clé en serpent d'un côté et en chameau de l'autre, une Map stringifiée
//  en objet vide, un nom de colonne changé. Rien de tout ça ne lève : ça
//  verse zéro, en silence.
//
//  Comme le contrat du registre, il ne tourne que si on le lui demande :
//      CONTRAT_CIBLE=postgres CONTRAT_PGURL=postgres://…
//  Sans ça il s'annonce ignoré, à voix haute.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects } from "@std/assert";
import { evaluerCloture, type LigneRegistre, type Verdict } from "../domaine/cloture.ts";
import { ClotureSupabase } from "../adaptateurs/supabase/cloture.ts";
import { RegistreSupabase } from "../adaptateurs/supabase/registre.ts";
import { appelPsql } from "./appel-psql.ts";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

const ANNA = "11111111-1111-1111-1111-111111111111";
const AUTH_ANNA = "aaaaaaaa-0000-0000-0000-000000000001";
const GALOPA = "33333333-0000-0000-0000-000000000001";
const BALL = 9001;
const POTION = 9002;
const GOUPIX = 37;
const FARFURET = 215;

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

/** Le décor : une joueuse, deux objets, un pokémon, et rien de clos. */
async function decor(url: string): Promise<void> {
  await psql(
    url,
    `delete from pokedex; delete from pokemon; delete from sac;
     delete from cloture; delete from registre;
     delete from joueur where id = '${ANNA}' or forum_user_id > 90000;
     delete from objet where id in (${BALL}, ${POTION});

     insert into espece (id, nom_fr, types, stade, pv_base) values
       (${GOUPIX}, 'Goupix', array['feu'], 1, 38),
       (${FARFURET}, 'Farfuret', array['glace'], 1, 55)
       on conflict (id) do nothing;

     insert into objet (id, slug, nom, famille, prix) overriding system value values
       (${BALL}, 'ball-de-contrat', 'Ball de contrat', 'ball', 200),
       (${POTION}, 'potion-de-contrat', 'Potion de contrat', 'soin', 300);

     insert into joueur (id, forum_user_id, pseudo, auth_id, pokedollars)
       values ('${ANNA}', 90911, 'Anna du contrat', '${AUTH_ANNA}', 1000);

     insert into sac (joueur_id, objet_id, quantite) values ('${ANNA}', ${BALL}, 5);

     insert into pokemon (id, joueur_id, espece_id, niveau, xp, emplacement)
       values ('${GALOPA}', '${ANNA}', ${GOUPIX}, 1, 0, 'equipe');`,
  );
}

if (CIBLE === "postgres" && PGURL !== undefined) {
  const url = PGURL;
  const appel = appelPsql({ url });

  const essai = (titre: string, corps: () => Promise<void>): void => {
    Deno.test(`clôture réelle · ${titre}`, async () => {
      await decor(url);
      await corps();
    });
  };

  /** Le verdict, calculé par le vrai domaine sur l'état réel de la base. */
  const verdict = async (lignes: readonly LigneRegistre[]): Promise<Verdict> => {
    const sac = new Map<number, number>();
    for (
      const l
        of (await psql(url, `select objet_id, quantite from sac where joueur_id='${ANNA}'`))
          .split("\n").filter((x) => x !== "")
    ) {
      const [o, q] = l.split("|");
      sac.set(Number(o), Number(q));
    }
    const argent = Number(
      await psql(url, `select pokedollars from joueur where id='${ANNA}'`),
    );
    return evaluerCloture(lignes, { sac, placesEnBoite: 30, pokedollars: argent });
  };

  essai("le trajet complet verse exactement ce que le domaine a décidé", async () => {
    const lignes: readonly LigneRegistre[] = [
      { messageId: 8001, evenement: { type: "croise", especeId: GOUPIX } },
      { messageId: 8002, evenement: { type: "objet_utilise", objetId: BALL, quantite: 2 } },
      { messageId: 8003, evenement: { type: "capture", especeId: FARFURET, niveau: 19 } },
      { messageId: 8004, evenement: { type: "objet_trouve", objetId: POTION, quantite: 1 } },
      { messageId: 8005, evenement: { type: "xp", pokemonId: GALOPA, gain: 400 } },
      { messageId: 8006, evenement: { type: "pokedollars", montant: 150 } },
    ];

    const v = await verdict(lignes);
    assert(v.possible, "le décor devrait permettre la clôture");

    const cloture = new ClotureSupabase(appel);
    assertEquals(await cloture.deja(7000), false);
    await cloture.appliquer(7000, [{ joueurId: ANNA, effets: v.effets }], "WM-ACDE-FGH");
    assertEquals(await cloture.deja(7000), true);

    // Le sac : 5 − 2 ball, et une potion apparue.
    assertEquals(
      await psql(
        url,
        `select quantite from sac where joueur_id='${ANNA}' and objet_id=${BALL}`,
      ),
      "3",
    );
    assertEquals(
      await psql(
        url,
        `select quantite from sac where joueur_id='${ANNA}' and objet_id=${POTION}`,
      ),
      "1",
    );
    // L'argent : 1000 + 150.
    assertEquals(await psql(url, `select pokedollars from joueur where id='${ANNA}'`), "1150");
    // La capture, en boîte et rattachée au sujet.
    assertEquals(
      await psql(
        url,
        `select espece_id||'/'||niveau||'/'||emplacement from pokemon
          where joueur_id='${ANNA}' and capture_dans=7000`,
      ),
      `${FARFURET}/19/boite`,
    );
    // L'XP versée, ET le niveau monté : 400 passe le seuil du niveau 2 (300).
    assertEquals(
      await psql(url, `select xp||'/'||niveau from pokemon where id='${GALOPA}'`),
      "400/2",
    );
    // Le pokédex : Goupix croisé, Farfuret attrapé.
    assertEquals(
      await psql(
        url,
        `select espece_id||':'||(attrape_le is not null) from pokedex
          where joueur_id='${ANNA}' order by espece_id`,
      ),
      `${GOUPIX}:false\n${FARFURET}:true`,
    );
  });

  essai("une capture sans croisement entre quand même au pokédex", async () => {
    // Le domaine ne met que les « croise » dans especesCroisees. Si la base
    // ne rangeait pas aussi les captures, un pokémon attrapé du premier
    // coup n'apparaîtrait jamais au pokédex.
    const v = await verdict([
      { messageId: 8001, evenement: { type: "capture", especeId: FARFURET, niveau: 12 } },
    ]);
    assert(v.possible);
    assertEquals(v.effets.especesCroisees, [], "le domaine n'y met rien, c'est voulu");

    await new ClotureSupabase(appel).appliquer(
      7001,
      [{ joueurId: ANNA, effets: v.effets }],
      "WM-ACDE-FGJ",
    );
    assertEquals(
      await psql(
        url,
        `select count(*) from pokedex where joueur_id='${ANNA}' and espece_id=${FARFURET}
          and croise_le is not null and attrape_le is not null`,
      ),
      "1",
    );
  });

  essai("si la base refuse, RIEN n'est versé et le sujet reste ouvert", async () => {
    // Un versement que le domaine n'aurait jamais produit : le filet de la
    // base doit faire tomber la transaction entière.
    const cloture = new ClotureSupabase(appel);
    await assertRejects(() =>
      cloture.appliquer(7002, [{
        joueurId: ANNA,
        effets: {
          especesCroisees: [],
          captures: [],
          xpParPokemon: new Map(),
          objetsConsommes: new Map(),
          objetsAjoutes: new Map([[POTION, 1]]),
          pokedollars: -999_999,
        },
      }], "WM-ACDE-FGK")
    );

    assertEquals(await cloture.deja(7002), false, "le sujet doit rester ouvert");
    assertEquals(await psql(url, `select pokedollars from joueur where id='${ANNA}'`), "1000");
    assertEquals(
      await psql(
        url,
        `select count(*) from sac where joueur_id='${ANNA}' and objet_id=${POTION}`,
      ),
      "0",
      "la potion du même versement ne doit pas être restée",
    );
  });

  essai("un sujet déjà clos ne se reclôture pas", async () => {
    const cloture = new ClotureSupabase(appel);
    const v = await verdict([
      { messageId: 8001, evenement: { type: "pokedollars", montant: 10 } },
    ]);
    assert(v.possible);
    await cloture.appliquer(7003, [{ joueurId: ANNA, effets: v.effets }], "WM-ACDE-FGL");
    await assertRejects(() =>
      cloture.appliquer(7003, [{ joueurId: ANNA, effets: v.effets }], "WM-ACDE-FGM")
    );
    assertEquals(await psql(url, `select pokedollars from joueur where id='${ANNA}'`), "1010");
  });

  essai("les lignes écrites par l'adaptateur sont relues par le domaine", async () => {
    // La boucle complète : l'adaptateur écrit le registre, l'adaptateur le
    // relit, le domaine évalue, la base verse. Si les clés de la charge
    // divergeaient, c'est ici que ça casserait.
    const registre = new RegistreSupabase(appel);
    await registre.inscrire(7004, ANNA, 8101, {
      type: "objet_trouve",
      objetId: POTION,
      quantite: 2,
    }, "WM-ACDE-FGN");
    await registre.inscrire(7004, ANNA, 8102, {
      type: "capture",
      especeId: FARFURET,
      niveau: 7,
    }, "WM-ACDE-FGP");

    const relues = await registre.lignesDuSujet(7004, ANNA);
    assertEquals(relues.length, 2);

    const v = await verdict(relues);
    assert(v.possible);
    await new ClotureSupabase(appel).appliquer(
      7004,
      [{ joueurId: ANNA, effets: v.effets }],
      "WM-ACDE-FGQ",
    );

    assertEquals(
      await psql(
        url,
        `select quantite from sac where joueur_id='${ANNA}' and objet_id=${POTION}`,
      ),
      "2",
    );
    assertEquals(
      await psql(
        url,
        `select count(*) from pokemon where joueur_id='${ANNA}' and capture_dans=7004`,
      ),
      "1",
    );
  });
} else {
  Deno.test("clôture réelle · IGNORÉ faute de base", () => {
    console.warn(
      "\n  ⚠ Le trajet complet de la clôture ne tourne pas : il faut " +
        "CONTRAT_CIBLE=postgres et CONTRAT_PGURL=postgres://…\n",
    );
  });
}
