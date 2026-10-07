// ════════════════════════════════════════════════════════════════════
//  src/contrat/boutique.supabase.test.ts
//
//  Le trajet complet de la boutique, contre une VRAIE base :
//
//      panier du domaine → adaptateur → SQL → joueur.pokedollars + sac
//
//  ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────
//
//  Parce que `servir_commande` (migration 0002) N'A JAMAIS SERVI UNE
//  SEULE COMMANDE, et que rien ne l'a vu pendant trois jours.
//
//  Sa dernière instruction était `update commande set etat = 'servie',
//  total = total`, où `total` est à la fois une variable plpgsql et une
//  colonne. PostgreSQL refuse — « column reference total is ambiguous »
//  — et comme c'était la dernière ligne, la transaction entière était
//  annulée APRÈS avoir débité et rempli le sac. Zéro commande servie,
//  zéro trace.
//
//  AUCUN TEST DE CE DÉPÔT NE POUVAIT L'ATTRAPER. Les tests du domaine ne
//  savent rien de la base ; ceux de l'adaptateur appellent une fonction
//  doublée ; pgTAP ne connaît pas l'adaptateur. Il fallait exécuter le
//  vrai SQL. C'est ce que fait ce fichier, et c'est tout ce qu'il fait.
//
//  Les quatre autres défauts relevés le même jour sont ici aussi, chacun
//  avec son cas : le fossile gratuit, les doublons, la quantité négative,
//  l'identifiant inconnu.
//
//  Comme les deux autres contrats, il ne tourne que si on le lui demande :
//      CONTRAT_CIBLE=postgres CONTRAT_PGURL=postgres://…
//  Sans ça il s'annonce ignoré, à voix haute.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects } from "@std/assert";
import { QUANTITE_MAX } from "../domaine/panier.ts";
import { BoutiqueSupabase } from "../adaptateurs/supabase/boutique.ts";
import { CompteNonLie } from "../application/servir-une-commande.ts";
import { appelPsql } from "./appel-psql.ts";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

const ANNA = "11111111-0000-0000-0000-00000000b001";
const COMPTE = 90501;
const PIERRE = 9101; //  3 000 ₽, en vente
const POTION = 9102; //  300 ₽, en vente
const FOSSILE = 9103; //  PAS en vente — la faille du 5 octobre
const INCONNU = 999999;

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

/** Le décor : une joueuse à 10 000 ₽, trois objets dont un hors vente. */
async function decor(url: string): Promise<void> {
  await psql(
    url,
    `delete from commande where joueur_id = '${ANNA}';
     delete from sac where joueur_id = '${ANNA}';
     delete from joueur where id = '${ANNA}' or forum_user_id = ${COMPTE};
     delete from objet where id in (${PIERRE}, ${POTION}, ${FOSSILE});

     insert into objet (id, slug, nom, famille, prix, en_vente)
       overriding system value values
       (${PIERRE}, 'pierre-de-contrat-boutique', 'Pierre de comptoir', 'evolution', 3000, true),
       (${POTION}, 'potion-de-contrat-boutique', 'Potion de comptoir', 'soin', 300, true),
       (${FOSSILE}, 'fossile-de-contrat-boutique', 'Fossile de comptoir', 'fossile', null, false);

     insert into joueur (id, forum_user_id, pseudo, pokedollars)
       values ('${ANNA}', ${COMPTE}, 'Anna de contrat', 10000);`,
  );
}

async function solde(url: string): Promise<number> {
  return Number(await psql(url, `select pokedollars from joueur where id = '${ANNA}'`));
}

async function sac(url: string): Promise<Record<string, number>> {
  const texte = await psql(
    url,
    `select coalesce(jsonb_object_agg(objet_id, quantite)::text, '{}')
       from sac where joueur_id = '${ANNA}'`,
  );
  return JSON.parse(texte);
}

/** Les commandes se distinguent par `message_id`, qui est unique. Un
 *  compteur par test évite qu'un test en salisse un autre. */
let prochain = 70000;
function message(): number {
  return ++prochain;
}

function essai(
  nom: string,
  corps: (ctx: {
    boutique: BoutiqueSupabase;
    url: string;
  }) => Promise<void>,
): void {
  if (CIBLE !== "postgres" || PGURL === undefined) {
    //  À VOIX HAUTE. Un test qui se saute en silence est pire que pas de
    //  test : on croit avoir une couverture qu'on n'a pas.
    Deno.test({
      name: `boutique réelle · ${nom} — IGNORÉ faute de base`,
      ignore: true,
      fn: () => {},
    });
    return;
  }
  const url = PGURL;
  Deno.test(`boutique réelle · ${nom}`, async () => {
    await decor(url);
    await corps({ boutique: new BoutiqueSupabase(appelPsql({ url })), url });
  });
}

// ── LE TEST QUI PORTE LE FICHIER ────────────────────────────────────

essai("une commande honnête débite et remplit le sac", async ({ boutique, url }) => {
  //  CELUI-LÀ aurait crié dès le premier jour. `servir_commande` annulait
  //  tout à sa dernière ligne, et le solde serait resté à 10 000.
  const verdict = await boutique.servir({
    messageId: message(),
    forumUserId: COMPTE,
    lignes: [{ objetId: PIERRE, quantite: 2 }, { objetId: POTION, quantite: 1 }],
    code: "WM-ACDE-FGH",
  });

  assert(verdict.etat === "servie", `refusée : ${JSON.stringify(verdict)}`);
  assertEquals(verdict.total, 6300);
  assertEquals(verdict.solde, 3700);
  assertEquals(verdict.deja, false);
  //  LES LIGNES SORTENT PAR IDENTIFIANT CROISSANT, pas dans l'ordre du
  //  panier ni dans celui du catalogue affiché. C'est voulu : l'ordre du
  //  panier dépend de l'ordre des clics, et un reçu doit être le même
  //  quelle que soit la façon dont il a été rempli. Le prix, lui, est
  //  celui que la BASE applique.
  assertEquals(verdict.lignes, [
    { objetId: PIERRE, nom: "Pierre de comptoir", quantite: 2, prix: 3000, sousTotal: 6000 },
    { objetId: POTION, nom: "Potion de comptoir", quantite: 1, prix: 300, sousTotal: 300 },
  ]);

  //  Et surtout : les tables ont vraiment bougé.
  assertEquals(await solde(url), 3700);
  assertEquals(await sac(url), { [PIERRE]: 2, [POTION]: 1 });
});

// ── les quatre autres défauts du 5 octobre ──────────────────────────

essai("UN OBJET HORS VENTE NE PART PAS, MÊME GRATUITEMENT", async ({ boutique, url }) => {
  //  La faille. `coalesce((select prix … and en_vente), 0)` chiffrait un
  //  fossile à zéro, le garde-fou ne regardait que le total, et le
  //  fossile atterrissait dans le sac. Quatre-vingt-dix-neuf fossiles
  //  gratuits pour qui écrivait un identifiant dans le bloc.
  const verdict = await boutique.servir({
    messageId: message(),
    forumUserId: COMPTE,
    lignes: [{ objetId: PIERRE, quantite: 1 }, { objetId: FOSSILE, quantite: 99 }],
    code: "WM-ACDE-FGH",
  });

  assert(verdict.etat === "refusee");
  assertEquals(verdict.motif, "HORS_VENTE");
  assert(
    verdict.detail.includes("Fossile de comptoir"),
    `le refus doit NOMMER l'objet, pas son identifiant : ${verdict.detail}`,
  );
  //  LA COMMANDE ENTIÈRE est refusée : on ne sert pas la moitié d'un
  //  panier. Et rien n'a bougé, pas même la Pierre qui était légitime.
  assertEquals(await solde(url), 10000);
  assertEquals(await sac(url), {});
});

essai("deux lignes pour le même objet sont additionnées", async ({ boutique, url }) => {
  //  « ON CONFLICT DO UPDATE command cannot affect row a second time ».
  //  Le domaine fusionne déjà, mais un bloc écrit à la main ne passe pas
  //  par le domaine.
  const verdict = await boutique.servir({
    messageId: message(),
    forumUserId: COMPTE,
    lignes: [{ objetId: POTION, quantite: 2 }, { objetId: POTION, quantite: 3 }],
    code: "WM-ACDE-FGH",
  });

  assert(verdict.etat === "servie", `refusée : ${JSON.stringify(verdict)}`);
  assertEquals(verdict.lignes.length, 1);
  assertEquals(verdict.lignes[0].quantite, 5);
  assertEquals(verdict.total, 1500);
  assertEquals(await sac(url), { [POTION]: 5 });
});

essai("la borne s'applique APRÈS fusion", async ({ boutique, url }) => {
  //  60 + 60 = 120, au-delà de la borne. La vérifier avant la fusion
  //  laisserait passer deux lignes légales qui en font une illégale.
  const moitie = Math.floor(QUANTITE_MAX / 2) + 10;
  const verdict = await boutique.servir({
    messageId: message(),
    forumUserId: COMPTE,
    lignes: [{ objetId: POTION, quantite: moitie }, { objetId: POTION, quantite: moitie }],
    code: "WM-ACDE-FGH",
  });

  assert(verdict.etat === "refusee", `servie à tort : ${JSON.stringify(verdict)}`);
  assertEquals(verdict.motif, "QUANTITE");
  assertEquals(await sac(url), {});
});

essai("une quantité négative est refusée, pas plantée", async ({ boutique, url }) => {
  //  Avant : violation de `sac_quantite_check`, une erreur PostgreSQL
  //  illisible, et la commande restait `en_attente` pour toujours.
  const verdict = await boutique.servir({
    messageId: message(),
    forumUserId: COMPTE,
    lignes: [{ objetId: PIERRE, quantite: 2 }, { objetId: POTION, quantite: -10 }],
    code: "WM-ACDE-FGH",
  });

  assert(verdict.etat === "refusee");
  assertEquals(verdict.motif, "QUANTITE");
  assertEquals(await solde(url), 10000);
  //  Le refus est ÉCRIT : c'est lui qui empêche la relève de repasser
  //  dessus indéfiniment.
  assertEquals(
    await psql(url, `select etat from commande where id = '${verdict.commandeId}'`),
    "refusee",
  );
});

essai("un identifiant inconnu est refusé par son nom", async ({ boutique, url }) => {
  //  Avant : violation de clé étrangère sur `sac.objet_id`.
  const verdict = await boutique.servir({
    messageId: message(),
    forumUserId: COMPTE,
    lignes: [{ objetId: PIERRE, quantite: 1 }, { objetId: INCONNU, quantite: 1 }],
    code: "WM-ACDE-FGH",
  });

  assert(verdict.etat === "refusee");
  assertEquals(verdict.motif, "OBJET_INCONNU");
  assert(verdict.detail.includes(String(INCONNU)));
  assertEquals(await solde(url), 10000);
});

// ── l'argent, l'idempotence, les comptes ────────────────────────────

essai("un solde insuffisant refuse et ne débite rien", async ({ boutique, url }) => {
  const verdict = await boutique.servir({
    messageId: message(),
    forumUserId: COMPTE,
    lignes: [{ objetId: PIERRE, quantite: QUANTITE_MAX }],
    code: "WM-ACDE-FGH",
  });

  assert(verdict.etat === "refusee");
  assertEquals(verdict.motif, "ARGENT_INSUFFISANT");
  //  Le détail porte les deux chiffres : un joueur doit savoir combien il
  //  lui manque, pas seulement qu'il lui manque quelque chose.
  assert(verdict.detail.includes("10"), verdict.detail);
  assertEquals(await solde(url), 10000);
  assertEquals(await sac(url), {});
});

essai("LE MÊME MESSAGE NE DÉBITE QU'UNE FOIS", async ({ boutique, url }) => {
  //  Ce qui fait tenir toute la tâche 3 : le curseur ne bouge pas si le
  //  reçu ne part pas, donc la relève REPASSE sur le même message. Si la
  //  base débitait deux fois, chaque incident réseau coûterait de
  //  l'argent à un joueur.
  const messageId = message();
  const panier = [{ objetId: PIERRE, quantite: 1 }];

  const premier = await boutique.servir({
    messageId,
    forumUserId: COMPTE,
    lignes: panier,
    code: "WM-ACDE-FGH",
  });
  assert(premier.etat === "servie");
  assertEquals(premier.deja, false);
  assertEquals(await solde(url), 7000);

  const second = await boutique.servir({
    messageId,
    forumUserId: COMPTE,
    lignes: panier,
    code: "WM-ACDE-FGH",
  });
  assert(second.etat === "servie");
  assert(second.deja, "la base doit annoncer qu'elle avait déjà servi");
  assertEquals(second.commandeId, premier.commandeId);
  //  LE REÇU REPOSTÉ DOIT ÊTRE COMPLET : sans ses lignes, le joueur
  //  recevrait un reçu vide pour une commande bien réelle.
  assertEquals(second.lignes, premier.lignes);
  assertEquals(await solde(url), 7000, "le second passage ne doit RIEN débiter");
  assertEquals(await sac(url), { [PIERRE]: 1 });
});

essai("un refus relu reste un refus, avec son motif", async ({ boutique }) => {
  const messageId = message();
  const panier = [{ objetId: FOSSILE, quantite: 1 }];
  const premier = await boutique.servir({
    messageId,
    forumUserId: COMPTE,
    lignes: panier,
    code: "WM-ACDE-FGH",
  });
  const second = await boutique.servir({
    messageId,
    forumUserId: COMPTE,
    lignes: panier,
    code: "WM-ACDE-FGH",
  });

  assert(premier.etat === "refusee" && second.etat === "refusee");
  assertEquals(second.motif, premier.motif);
  assertEquals(second.detail, premier.detail);
  assert(second.deja);
});

essai("un compte non lié lève `CompteNonLie`", async ({ boutique }) => {
  //  Et pas une panne : la relève doit pouvoir répondre une fois et
  //  avancer, au lieu de réessayer toutes les cinq minutes.
  await assertRejects(
    () =>
      boutique.servir({
        messageId: message(),
        forumUserId: 99999,
        lignes: [{ objetId: POTION, quantite: 1 }],
        code: "WM-ACDE-FGH",
      }),
    CompteNonLie,
  );
});

essai("le sac s'additionne d'une commande à l'autre", async ({ boutique, url }) => {
  for (const _ of [1, 2]) {
    await boutique.servir({
      messageId: message(),
      forumUserId: COMPTE,
      lignes: [{ objetId: POTION, quantite: 2 }],
      code: "WM-ACDE-FGH",
    });
  }
  assertEquals(await sac(url), { [POTION]: 4 });
  assertEquals(await solde(url), 10000 - 4 * 300);
});
