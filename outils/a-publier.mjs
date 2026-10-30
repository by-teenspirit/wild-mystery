// ════════════════════════════════════════════════════════════════════
//  outils/a-publier.mjs — un gabarit, prêt à coller dans le panneau
//
//      deno task a-publier templates/viewtopic_body.nouveau.html
//
//  CE QU'IL FAIT, ET POURQUOI.
//
//  Les gabarits du dépôt sont commentés — longuement, parce qu'un
//  gabarit Forumactif est un champ de mines et qu'on y revient des
//  semaines plus tard. Mais un commentaire HTML N'EST PAS RETIRÉ par
//  Forumactif : il part dans la page de chaque visiteur, à chaque
//  chargement, et il compte dans la limite de 65 535 caractères par
//  gabarit.
//
//  Ce script enlève donc les commentaires — SAUF `BEGIN` et `END`, qui
//  ne sont pas des commentaires mais les délimiteurs de blocs du
//  moteur de Forumactif. Les effacer casserait la page.
//
//  Il vérifie aussi deux choses qu'on ne voit pas à l'œil :
//
//    · que chaque BEGIN a son END, et dans le bon ordre ;
//    · qu'on tient sous les 65 535 caractères.
// ════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from "node:fs";

//  La limite d'un gabarit chez Forumactif. Relevée dans la base de
//  connaissances du projet (`forumactif/01-templates-reference.md`).
const LIMITE = 65535;

const chemin = Deno.args[0];
if (chemin === undefined) {
  console.error("  usage : deno task a-publier <chemin du gabarit>");
  Deno.exit(2);
}

const source = readFileSync(chemin, "utf8");

//  ── LES COMMENTAIRES S'EN VONT, LES BLOCS RESTENT ──────────────────
const sortie = source.replace(
  /<!--([\s\S]*?)-->/g,
  (tout, dedans) => /\b(BEGIN|END) \w/.test(dedans) ? tout : "",
)
  //  Les lignes devenues vides, et les suites de lignes vides que les
  //  commentaires laissent derrière eux.
  .replace(/^[ \t]+$/gm, "")
  .replace(/\n{3,}/g, "\n\n");

//  ── CHAQUE BEGIN A SON END ─────────────────────────────────────────
//
//  Un bloc mal fermé ne se voit pas en lisant : Forumactif avale le
//  gabarit et rend une page vide, ou pire, une page à moitié. On
//  empile les ouvertures et on vérifie que chaque fermeture dépile la
//  bonne.
const pile = [];
const fautes = [];
for (const m of sortie.matchAll(/<!--\s*(BEGIN|END) (\w+)\s*-->/g)) {
  const [, sens, nom] = m;
  if (sens === "BEGIN") pile.push(nom);
  else {
    const attendu = pile.pop();
    if (attendu !== nom) {
      fautes.push(`END ${nom} alors qu'on attendait END ${attendu ?? "rien"}`);
    }
  }
}
for (const reste of pile) fautes.push(`BEGIN ${reste} jamais fermé`);

//  ── CE QUI NE DOIT JAMAIS DISPARAÎTRE ──────────────────────────────
//
//  Les variables que Forumactif exige : sans elles, la page perd ses
//  scripts, ses permaliens ou sa multi-citation. On vérifie qu'elles
//  ont survécu au nettoyage — un commentaire mal fermé dans la source
//  pourrait en emporter une avec lui.
//  ── CE QUI NE DOIT PLUS JAMAIS REVENIR ────────────────────────────
//
//  « La date/heure actuelle est… » et « Dernière visite le… » en haut
//  de chaque page, retirées le 30 octobre. Elles sont décoratives, et
//  le gabarit d'origine de CHAQUE page les porte : à la prochaine
//  réécriture, on les recopiera sans y penser.
//
//  Le contrôle porte sur le fichier À PUBLIER, pas sur la source : les
//  commentaires du dépôt ont le droit de les nommer pour expliquer
//  pourquoi elles sont parties.
const BANNIES = [
  ["{CURRENT_TIME}", "la date du jour, retirée le 30 octobre"],
  ["{LAST_VISIT_DATE}", "la dernière visite, retirée le 30 octobre"],
];
for (const [v, pourquoi] of BANNIES) {
  if (sortie.includes(v)) fautes.push(`${v} est revenu — ${pourquoi}`);
}

const INDISPENSABLES = [
  "{PROTECT_FOOTER}",
  "{TOPIC_ID}",
  "{QUICK_REPLY_FORM}",
  "post_mq",
  'id="p{postrow.displayed.U_POST_ID}"',
];
for (const v of INDISPENSABLES) {
  if (source.includes(v) && sortie.includes(v) === false) {
    fautes.push(`${v} a disparu au nettoyage`);
  }
}

const destination = chemin.replace(/(\.nouveau)?\.html$/, ".a-publier.html");
writeFileSync(destination, sortie);

const gagne = source.length - sortie.length;
console.log();
console.log(`  ${destination}`);
console.log(
  `  ${sortie.length} caractères sur ${LIMITE} — ` +
    `${LIMITE - sortie.length} de marge  (${gagne} retirés en commentaires)`,
);
console.log(`  ${pile.length === 0 ? "tous les blocs sont fermés" : ""}`);

if (sortie.length > LIMITE) {
  fautes.push(`${sortie.length - LIMITE} caractères DE TROP : le panneau coupera`);
}

if (fautes.length > 0) {
  console.log();
  for (const f of fautes) console.log(`  DÉFAUT ${f}`);
  console.log();
  Deno.exit(1);
}
console.log();
