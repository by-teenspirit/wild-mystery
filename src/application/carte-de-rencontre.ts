// ════════════════════════════════════════════════════════════════════
//  src/application/carte-de-rencontre.ts
//
//  Le texte que le Maître du Jeu poste sous le message de la joueuse
//  quand un Pokémon apparaît.
//
//  « Il faut qu'il s'affiche en dessous de mon message, via un message
//  du Maître du Jeu, et qu'on ait ses stats, que ça engage un combat
//  entre le premier pokémon de mon équipe et le ponyta. »
//  — 17 novembre 2026.
//
//  ── TEXTE SIMPLE, COMME LE BILAN ────────────────────────────────────
//
//  Pas de BBCode, pas de tableau. `bilan.ts` écrit des lignes nues
//  depuis le 2 octobre et ça tient : le forum les affiche partout
//  pareil, la mise en forme ne casse pas, et un joueur qui conteste
//  peut recopier ce qu'il lit. Une carte en balises serait plus jolie
//  trois jours, puis illisible le jour où la charte change.
//
//  ── CE QUE LA CARTE DIT, ET DANS QUEL ORDRE ─────────────────────────
//
//  Le sauvage d'abord — c'est l'information nouvelle, celle qu'on
//  attend en ouvrant le sujet. Le combattant ensuite. Le code en
//  dernier, en toutes lettres, pour la même raison que dans le bilan.
//
//  ── LE MARQUEUR N'EST PAS ICI ───────────────────────────────────────
//
//  L'adaptateur Forumactif le pose. Ce fichier ne connaît pas le
//  forum : il ne sait pas qu'il existe un marqueur, et c'est ce qui
//  permet de le tester sans réseau.
// ════════════════════════════════════════════════════════════════════

import type { RencontreEnAttente } from "./ports.ts";

/** Ce que la base rend pour une carte à poster.
 *
 *  Le type vit dans `ports.ts`, avec les autres files d'attente : c'est
 *  ce que le port rend, pas ce que ce fichier invente. Tout vient de la
 *  ligne `combat` et de son espèce — RIEN n'est recalculé ici, et
 *  surtout pas les PV. La carte doit dire exactement ce que la base
 *  tient, sinon elle annonce un combat qui n'est pas celui qui se joue. */
export type RencontreAAnnoncer = RencontreEnAttente;

/** Les types, tels qu'un joueur les lit.
 *
 *  La base les range à plat et sans accent — « electrik » — pour que
 *  les jointures tiennent (`outils/especes-sql.py`). Sur la carte, ils
 *  reprennent leur majuscule : le joueur n'a pas à lire notre
 *  convention de clé. */
export function typesLisibles(types: readonly string[]): string {
  return types
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(" · ");
}

/** Le nom d'un Pokémon du joueur : son surnom s'il en a un, et son
 *  espèce entre parenthèses — on ne fait pas disparaître l'espèce, le
 *  joueur doit pouvoir lire l'affiche des types. */
export function nomDuCombattant(
  nom: string,
  surnom: string | null,
): string {
  const propre = surnom?.trim();
  return propre ? `${propre} (${nom})` : nom;
}

export const SANS_COMBATTANT =
  "Aucun Pokémon dans ton équipe : pas de combat. Tu peux lancer une " +
  "Poké Ball directement, mais tes chances sont plus faibles.";

/** Rédige la carte de rencontre.
 *
 *  `code` s'écrit en toutes lettres, comme dans le bilan : un joueur
 *  qui conteste un combat doit pouvoir le recopier. */
export function redigerLaCarte(
  r: RencontreAAnnoncer,
  code: string,
): string {
  const s = r.sauvage;
  const texte: string[] = [
    `Un ${s.nom} sauvage apparaît.`,
    "",
    `${s.nom.toUpperCase()} — niveau ${s.niveau}`,
    `Types : ${typesLisibles(s.types)}`,
    `PV : ${s.pv}`,
    `Attaque : ${s.attaque} · Défense : ${s.defense}`,
  ];

  if (r.combattant === null) {
    texte.push("", SANS_COMBATTANT);
  } else {
    const c = r.combattant;
    texte.push(
      "",
      `${nomDuCombattant(c.nom, c.surnom).toUpperCase()} — niveau ${c.niveau}`,
      `Types : ${typesLisibles(c.types)}`,
      //  LES PV SUR LEUR MAXIMUM, et seulement de ce côté-ci. Le
      //  sauvage arrive toujours entier ; le Pokémon du joueur, non —
      //  il peut sortir d'un combat précédent, et ça change ce qu'on
      //  décide au premier tour.
      `PV : ${c.pv}/${c.pvMax}`,
      `Attaque : ${c.attaque} · Défense : ${c.defense}`,
      "",
      "À toi de jouer : attaquer, lancer une Poké Ball, utiliser un " +
        "objet, changer de Pokémon ou fuir.",
    );
  }

  texte.push("", `CODE : ${code}`);
  return texte.join("\n");
}
