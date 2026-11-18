// ════════════════════════════════════════════════════════════════════
//  src/application/message-de-tour.ts
//
//  Le texte que le Maître du Jeu poste après chaque tour.
//
//  « À chaque tour — le résultat du tour et l'état des deux Pokémon »
//  (planche 99 §2).
//
//  ── CE QUE LE MESSAGE DOIT DIRE, ET DANS CET ORDRE ──────────────────
//
//  1. CE QUE LE JOUEUR A FAIT. Il le sait, mais le sujet est lu par
//     d'autres — et par lui-même trois semaines plus tard.
//  2. CE QUI S'EST PASSÉ, frappe par frappe. Touché ou raté, combien,
//     et l'efficacité EN MOTS : « c'est super efficace » se lit, « ×2 »
//     se calcule.
//  3. L'ÉTAT DES DEUX. En « 12/18 », parce que le chiffre seul ne dit
//     pas si c'est grave.
//  4. LA FIN, s'il y en a une.
//  5. LE CODE, en toutes lettres.
//
//  ── LE DÉ EST ÉCRIT, ET C'EST VOULU ────────────────────────────────
//
//  Un combat se joue en public. Un joueur qui perd d'un point doit
//  pouvoir lire le tirage plutôt que de soupçonner le serveur — et le
//  récit en base porte le même chiffre, donc les deux se vérifient
//  l'un l'autre.
//
//  On n'écrit PAS le dé quand la frappe rate : il n'a servi à rien, et
//  l'afficher ferait croire qu'il a décidé du raté.
// ════════════════════════════════════════════════════════════════════

import { nomDuCombattant } from "./carte-de-rencontre.ts";
import type { TourEnAttente } from "./ports.ts";

/** L'efficacité en mots, comme les jeux la disent.
 *
 *  LES MOTS PLUTÔT QUE LE CHIFFRE : « c'est super efficace » se lit du
 *  premier coup, « ×2 » demande de savoir contre quoi. Les deux sont
 *  dans le récit en base pour qui veut vérifier. */
export function efficaciteEnMots(facteur: number): string | null {
  if (facteur === 0) return "Ça n'a aucun effet.";
  if (facteur >= 2) return "C'est super efficace !";
  if (facteur > 1) return "C'est efficace.";
  if (facteur < 1) return "Ce n'est pas très efficace…";
  return null;
}

/** Ce que le joueur a demandé, en une phrase.
 *
 *  Le sujet du verbe est le POKÉMON quand c'est lui qui agit, et le
 *  joueur quand c'est lui : « Salamèche attaque » mais « Tu lances une
 *  Poké Ball ». C'est ce qui rend la lecture naturelle sans jamais
 *  écrire « le joueur ». */
export function phraseDeLaDemande(t: TourEnAttente): string {
  const soi = t.combattant === null
    ? "Ton Pokémon"
    : nomDuCombattant(t.combattant.nom, t.combattant.surnom);
  const d = t.detail ?? {};
  switch (t.demande) {
    case "attaquer":
      return `${soi} attaque avec ${d.nom ?? "sa capacité"}.`;
    case "ball":
      return `Tu lances une ${d.nom ?? "Poké Ball"}.`;
    case "objet":
      //  LES PV RENDUS, PAS LE MONTANT DE L'OBJET. Une Potion de 20
      //  sur un Pokémon à 14/18 rend 4, et dire 20 ferait croire au
      //  joueur qu'on lui en a volé seize.
      return `Tu utilises une ${d.nom ?? "objet"} : ${soi} reprend ` +
        `${d.rendus ?? 0} PV.`;
    case "changer":
      return `Tu envoies ${d.nom ?? "un autre Pokémon"} au combat.`;
    case "fuir":
      return "Tu prends la fuite.";
    default:
      return "Tu agis.";
  }
}

/** Les phrases d'une frappe. */
function phrasesDeLaFrappe(
  f: TourEnAttente["recit"]["frappes"][number],
  t: TourEnAttente,
): string[] {
  const attaquant = f.qui === "joueur"
    ? (t.combattant === null
      ? "Ton Pokémon"
      : nomDuCombattant(t.combattant.nom, t.combattant.surnom))
    : t.sauvage.nom;
  const cible = f.qui === "joueur"
    ? t.sauvage.nom
    : (t.combattant === null
      ? "ton Pokémon"
      : nomDuCombattant(t.combattant.nom, t.combattant.surnom));

  if (!f.touche || f.degats === null) {
    return [`${attaquant} lance ${f.capacite.nom}… et manque sa cible.`];
  }
  const lignes: string[] = [];
  //  « AUCUN EFFET » SE DIT SANS PARLER DE DÉGÂTS. « 0 dégât » ferait
  //  croire à un bogue ; « ça n'a aucun effet » est l'information dont
  //  le joueur a besoin pour changer de Pokémon.
  if (f.degats.efficacite === 0) {
    lignes.push(`${attaquant} utilise ${f.capacite.nom} sur ${cible}.`);
    lignes.push("Ça n'a aucun effet.");
    return lignes;
  }
  lignes.push(
    `${attaquant} utilise ${f.capacite.nom} : ${f.degats.points} dégâts ` +
      `(dé ${f.degats.de}).`,
  );
  const mots = efficaciteEnMots(f.degats.efficacite);
  if (mots !== null) lignes.push(mots);
  return lignes;
}

/** La fin, dite du point de vue du joueur. */
export function phraseDeLaFin(t: TourEnAttente): string | null {
  switch (t.fin) {
    case "victoire":
      return `${t.sauvage.nom} est K.O. Le combat est terminé.`;
    case "defaite":
      return t.combattant === null
        ? "Ton Pokémon est K.O. Le combat est terminé."
        : `${nomDuCombattant(t.combattant.nom, t.combattant.surnom)} est K.O. ` +
          "Le combat est terminé.";
    case "capture":
      //  LE POKÉDEX ET LA BOÎTE À LA CLÔTURE, et on le dit : sinon le
      //  joueur cherche son Pokémon dans son équipe et ne le trouve
      //  pas.
      return `${t.sauvage.nom} est attrapé ! Il rejoindra ta boîte à la ` +
        "clôture du sujet.";
    case "fuite":
      return t.demande === "fuir"
        ? "Tu t'éloignes. Le combat est terminé."
        : `${t.sauvage.nom} s'enfuit. Le combat est terminé.`;
    default:
      return null;
  }
}

/** La chance qu'il y avait, pour une ball.
 *
 *  « Un joueur qui rate trois fois doit pouvoir lire qu'il avait 12 % »
 *  — sinon il croit que le serveur triche. Les deux nombres sont dans
 *  le détail du tour, donc le message et la base se vérifient l'un
 *  l'autre.
 *
 *  EN POURCENTAGE ENTIER : « 66 % » se lit, « 0,664 » se traduit. */
export function phraseDeLaChance(t: TourEnAttente): string | null {
  if (t.demande !== "ball") return null;
  const d = t.detail;
  if (d === null || typeof d.chance !== "number" || typeof d.de !== "number") {
    return null;
  }
  return `Chance de prise : ${Math.round(d.chance * 100)} % ` +
    `(tirage ${Math.round(d.de * 100)} %).`;
}

export function redigerLeTour(t: TourEnAttente, code: string): string {
  const texte: string[] = [
    `TOUR ${t.numero} — ${phraseDeLaDemande(t)}`,
  ];

  const chance = phraseDeLaChance(t);
  if (chance !== null) texte.push(chance);

  for (const f of t.recit.frappes) {
    texte.push("", ...phrasesDeLaFrappe(f, t));
  }

  //  L'ÉTAT DES DEUX, TOUJOURS, même quand personne n'a frappé : c'est
  //  la ligne qu'on relit pour décider du tour suivant.
  texte.push("");
  if (t.combattant !== null) {
    texte.push(
      `${nomDuCombattant(t.combattant.nom, t.combattant.surnom)} : ` +
        `${t.combattant.pv}/${t.combattant.pvMax} PV`,
    );
  }
  texte.push(`${t.sauvage.nom} : ${t.sauvage.pv}/${t.sauvage.pvMax} PV`);

  const fin = phraseDeLaFin(t);
  if (fin !== null) texte.push("", fin);

  texte.push("", `CODE : ${code}`);
  return texte.join("\n");
}
