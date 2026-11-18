// ════════════════════════════════════════════════════════════════════
//  src/application/carte-de-rencontre.ts
//
//  Le message que le Maître du Jeu poste sous celui de la joueuse
//  quand un Pokémon apparaît.
//
//  « Il faut qu'il s'affiche en dessous de mon message, via un message
//  du Maître du Jeu, et qu'on ait ses stats, que ça engage un combat
//  entre le premier pokémon de mon équipe et le ponyta. »
//  — 17 novembre 2026.
//
//  ── UNE FICHE, PLUS DU TEXTE NU — 18 NOVEMBRE ───────────────────────
//
//  « Ce serait bien d'avoir une petite card, l'image des pokémons,
//  avec les infos. » Les briques sont dans `fiche-de-combat.ts`, et
//  son en-tête dit pourquoi le texte nu était défendable jusque-là et
//  ne l'est plus.
//
//  ── LE CODE NE S'AFFICHE PLUS ───────────────────────────────────────
//
//  « N'affiche pas le code, le joueur ne doit pas le voir. » Il était
//  écrit en dernière ligne, en toutes lettres, pour qu'un joueur qui
//  conteste puisse le recopier. Il reste dans le message — l'adaptateur
//  y pose son marqueur, que le navigateur masque — donc il est toujours
//  dans la source de la page pour qui doit vérifier. Simplement, il ne
//  se lit plus.
//
//  C'est ce qui fait que `redigerLaCarte` ne prend plus de code : une
//  fonction qui reçoit un argument dont elle ne fait rien finit par
//  l'afficher à nouveau « puisqu'il est là ».
//
//  ── CE QUE LA CARTE DIT, ET DANS QUEL ORDRE ─────────────────────────
//
//  Le sauvage d'abord — c'est l'information nouvelle, celle qu'on
//  attend en ouvrant le sujet. Le combattant ensuite.
//
//  ── LE MARQUEUR N'EST PAS ICI ───────────────────────────────────────
//
//  L'adaptateur Forumactif le pose. Ce fichier ne connaît pas le
//  forum : il ne sait pas qu'il existe un marqueur, et c'est ce qui
//  permet de le tester sans réseau.
// ════════════════════════════════════════════════════════════════════

import type { RencontreEnAttente } from "./ports.ts";
import { duel, echapper, enveloppe, fiche, nomAffiche } from "./fiche-de-combat.ts";

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
 *  les jointures tiennent (`outils/especes-sql.py`). Ici ils reprennent
 *  leur majuscule : le joueur n'a pas à lire notre convention de clé.
 *
 *  GARDÉE MALGRÉ LES PASTILLES : elle sert au texte de repli de
 *  `message-de-tour.ts`, et à qui lit la carte sans CSS. */
export function typesLisibles(types: readonly string[]): string {
  return types
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(" · ");
}

/** Le nom d'un Pokémon du joueur : son surnom s'il en a un, et son
 *  espèce entre parenthèses.
 *
 *  Réexportée depuis `fiche-de-combat.ts`, où la fiche en a besoin
 *  aussi. Deux fonctions auraient donné deux façons de nommer le même
 *  Pokémon dans deux messages du même combat. */
export const nomDuCombattant = nomAffiche;

export const SANS_COMBATTANT =
  "Aucun Pokémon dans ton équipe : pas de combat. Tu peux lancer une " +
  "Poké Ball directement, mais tes chances sont plus faibles.";

export const APPEL = "À toi de jouer : attaquer, lancer une Poké Ball, utiliser un " +
  "objet, changer de Pokémon ou fuir.";

/** Rédige la carte de rencontre.
 *
 *  `racine` est celle du dépôt, pour l'adresse des sprites. Elle
 *  arrive de la tâche, qui la tient du réglage `WM_RACINE_DONNEES` :
 *  ce fichier ne sait pas où le dépôt est servi, et il n'a pas à le
 *  savoir. */
export function redigerLaCarte(
  r: RencontreAAnnoncer,
  racine: string,
): string {
  const s = r.sauvage;
  //  ── UN RAPPEL NE S'ANNONCE PAS COMME UNE APPARITION ──────────────
  //
  //  « Un Debugant sauvage apparaît » est faux la seconde fois, et
  //  c'est pourtant le même Debugant, les mêmes PV, les mêmes choix.
  //  Seule la première phrase change : le joueur a demandé une
  //  rencontre alors que son combat tournait, et ce qu'il faut lui
  //  dire, c'est où il en est.
  //
  //  LE RESTE EST IDENTIQUE À DESSEIN. Deux mises en forme pour le
  //  même état finiraient par ne plus dire la même chose, et le
  //  joueur apprendrait à lire deux cartes au lieu d'une.
  const dedans: string[] = r.rappel
    ? [
      '<p class="wm-combat__surtitre">Combat en cours</p>',
      `<p class="wm-combat__titre">Ton combat contre ${echapper(s.nom)} ` +
      "n'est pas fini. Termine-le avant d'en chercher un autre.</p>",
    ]
    : [
      //  LE SURTITRE DIT DE QUEL MESSAGE IL S'AGIT, et c'est la seule
      //  chose qu'on cherche en remontant un sujet de dix messages.
      //  Même forme que les titres de bloc de la carte de dresseur.
      '<p class="wm-combat__surtitre">Rencontre</p>',
      `<p class="wm-combat__titre">Un ${echapper(s.nom)} sauvage apparaît.</p>`,
    ];

  const sauvage = fiche(
    {
      especeId: s.especeId,
      nom: s.nom,
      niveau: s.niveau,
      types: s.types,
      //  LE SAUVAGE ARRIVE ENTIER, donc pas de maximum : « 30 PV » et
      //  non « 30/30 PV ». Écrire la fraction des deux côtés ferait
      //  croire qu'il a déjà pris des coups.
      //
      //  AU RAPPEL C'EST L'INVERSE : il a pu encaisser des tours, et
      //  « 18 PV » tout court ne dit plus rien. La base n'envoie donc
      //  le maximum que dans ce cas-là.
      pv: s.pv,
      pvMax: s.pvMax,
      attaque: s.attaque,
      defense: s.defense,
    },
    "sauvage",
    racine,
  );

  if (r.combattant === null) {
    dedans.push(duel(sauvage, null));
    dedans.push(`<p class="wm-combat__appel">${echapper(SANS_COMBATTANT)}</p>`);
    return enveloppe("rencontre", dedans);
  }

  const c = r.combattant;
  dedans.push(duel(
    sauvage,
    fiche(
      {
        especeId: c.especeId,
        nom: c.nom,
        surnom: c.surnom,
        niveau: c.niveau,
        types: c.types,
        //  LES PV SUR LEUR MAXIMUM, et seulement de ce côté-ci : le
        //  Pokémon du joueur peut sortir d'un combat précédent, et ça
        //  change ce qu'on décide au premier tour.
        pv: c.pv,
        pvMax: c.pvMax,
        attaque: c.attaque,
        defense: c.defense,
      },
      "mien",
      racine,
    ),
  ));
  dedans.push(`<p class="wm-combat__appel">${echapper(APPEL)}</p>`);
  return enveloppe("rencontre", dedans);
}
