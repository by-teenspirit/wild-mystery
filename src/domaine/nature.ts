// ════════════════════════════════════════════════════════════════════
//  src/domaine/nature.ts
//
//  Les six natures, et la seule chose que chacune change.
//
//  COUCHE DOMAINE : fonctions pures. Aucun import hors de `domaine/`,
//  aucune horloge, aucun réseau.
//
//  ── UNE SEULE MÉCANIQUE PAR NATURE, ET LE SERVEUR L'APPLIQUE ────────
//
//  Planche 79 : « Pas de droit de RP, pas de faveur de staff : un
//  avantage qui demande à quelqu'un de s'en souvenir aura disparu en
//  trois semaines. » Les six touchent six endroits différents du jeu —
//  l'échec, la rareté, la composition d'équipe, les gains partagés, le
//  K.O., le butin — pour qu'on puisse en retirer une sans toucher aux
//  cinq autres.
//
//  ── CE FICHIER NE DÉCIDE PAS DES NOMBRES, IL LES APPLIQUE ───────────
//
//  Les deux chances de fossile viennent de `data/butin.json`, et les
//  raretés des tables de `data/faune/`. Une nature les TRANSFORME ; elle
//  ne les écrit pas. C'est ce qui permet de simuler les six avantages
//  contre les dix-sept zones réelles (`deno task natures`) au lieu de
//  croire les chiffres du premier jet.
//
//  ── POURQUOI BRAVE N'EST PAS ICI ────────────────────────────────────
//
//  « Une fois par sujet, un pokémon mis K.O. tient un tour de plus. »
//  La résolution d'un combat n'existe pas dans le domaine : il n'y a ni
//  tour, ni PV, ni K.O. nulle part dans `src/domaine/`. Écrire l'avantage
//  de Brave ici demanderait d'inventer d'abord le combat, c'est-à-dire
//  les règles de la planche 78 § 08 — et les inventer depuis le code est
//  exactement ce qu'on ne fait pas. Brave attend le combat ; l'absence
//  est écrite ici pour qu'elle se lise, plutôt que de se deviner.
//
//  ── LES BUDGETS PAR SUJET NE SE COMPTENT PAS ICI ────────────────────
//
//  Hardi relance « une fois », Brave tient « une fois par sujet ». Le
//  domaine ne voit qu'un tirage : il ne sait pas combien il y en a eu
//  dans le sujet, et le lui faire tenir un compteur ferait de lui un
//  état. `fouillerSelonLaNature` reçoit donc `relanceDisponible` : c'est
//  le cas d'usage, qui a le sujet sous la main, qui dit si la relance
//  reste à prendre.
// ════════════════════════════════════════════════════════════════════

import { graineDepuis } from "./alea.ts";
import { fouiller, type LigneDeButin, type TauxDeFouille, type Trouvaille } from "./fouille.ts";
import { type Rarete, type Rencontre, tirerUneRencontre } from "./rencontre.ts";

/** Les six natures, dans l'ordre de la planche 79. */
export type Nature = "hardi" | "serieux" | "malin" | "doux" | "brave" | "jovial";

export const NATURES: readonly Nature[] = [
  "hardi",
  "serieux",
  "malin",
  "doux",
  "brave",
  "jovial",
] as const;

/** Le légendaire de chaque nature. Il n'a aucun effet de jeu : il sert
 *  aux pages, aux couleurs et aux images, et il est ici pour que les
 *  six noms ne soient pas recopiés à six endroits. */
export const MASCOTTE: Readonly<Record<Nature, string>> = {
  hardi: "Keldeo",
  serieux: "Uxie",
  malin: "Hoopa",
  doux: "Shaymin",
  brave: "Cresselia",
  jovial: "Celebi",
};

export class NatureInconnue extends Error {
  constructor(valeur: unknown) {
    super(`Nature inconnue : ${String(valeur)}. Attendu l'une de ${NATURES.join(", ")}.`);
    this.name = "NatureInconnue";
  }
}

export function estUneNature(valeur: unknown): valeur is Nature {
  return typeof valeur === "string" && (NATURES as readonly string[]).includes(valeur);
}

/** La nature écrite dans un texte, ou `null`.
 *
 *  Insensible à la casse et aux accents du mot « sérieux », parce que la
 *  valeur traverse un champ de profil Forumactif, une colonne en base et
 *  une page HTML avant d'arriver ici, et qu'aucun des trois ne garantit
 *  comment elle a été tapée. */
export function natureDepuis(dit: string): Nature | null {
  const propre = dit.trim().toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return estUneNature(propre) ? propre : null;
}

// ════════════════════════════════════════════════════════════════════
//  JOVIAL · le butin
// ════════════════════════════════════════════════════════════════════

/** Ce que Jovial multiplie les deux chances de fossile par. */
export const JOVIAL_FOSSILE = 2;

/**
 * Les taux de fouille vus par une nature.
 *
 * **Jovial double les deux chances de fossile, et c'est tout ce qu'on
 * écrit.** La part « pokédollars » n'est PAS dans `TauxDeFouille` : elle
 * est le reste de cent. Doubler le fossile la fait donc descendre toute
 * seule — 44,8 % devient 34,6 % avec les taux de `butin.json` — et il
 * n'y a aucun second nombre à tenir d'accord avec le premier. C'est la
 * forme de la donnée qui rend l'avantage impossible à mal écrire, pas
 * une relecture.
 *
 * Et la somme reste jugée par `verifieLesTaux`, que `fouiller` appelle :
 * une nature qui ferait dépasser cent est refusée au tirage, pas
 * découverte en production.
 */
export function tauxSelonLaNature(taux: TauxDeFouille, nature: Nature): TauxDeFouille {
  if (!estUneNature(nature)) throw new NatureInconnue(nature);
  if (nature !== "jovial") return taux;
  return {
    ...taux,
    fossileEntier: taux.fossileEntier * JOVIAL_FOSSILE,
    morceauDeFossile: taux.morceauDeFossile * JOVIAL_FOSSILE,
  };
}

// ════════════════════════════════════════════════════════════════════
//  HARDI · la relance
// ════════════════════════════════════════════════════════════════════

/** Ce qu'une fouille rend quand une nature s'en mêle.
 *
 *  `relanceUtilisee` remonte au cas d'usage : c'est lui qui tient le
 *  budget du sujet, donc il doit savoir si la relance vient d'être
 *  dépensée. Sans ce retour, Hardi relancerait à chaque fouille. */
export type FouilleDeNature = {
  readonly trouvaille: Trouvaille;
  readonly relanceUtilisee: boolean;
};

/** La graine de la relance d'Hardi.
 *
 *  **Elle se déduit de la première, elle ne s'invente pas.** Tirer la
 *  relance au hasard rendrait le résultat irrejouable, et c'est tout
 *  l'intérêt de la graine : le staff doit pouvoir refaire le tirage des
 *  années plus tard pour trancher une contestation. Deux fouilles
 *  différentes donnent deux relances différentes, et la même fouille
 *  donne toujours la même relance. */
export function graineDeLaRelance(graine: number): number {
  return graineDepuis(`${graine}·relance`);
}

/**
 * Une fouille, vue par une nature.
 *
 * **Hardi relance une fouille bredouille, et la relance est une fouille
 * ordinaire** — elle peut donc être bredouille elle aussi. C'est la
 * lecture littérale de « il peut relancer une fois » ; l'autre lecture
 * possible — une relance qui ne peut pas échouer — ferait tomber la
 * bredouille d'un Hardi à zéro au lieu de 4 %. La simulation dit le
 * chiffre des deux côtés ; c'est à Callista de trancher, et la
 * différence est d'une ligne.
 *
 * Jovial passe par ses taux (§ Jovial). Les quatre autres natures
 * fouillent comme tout le monde : pas de branche par nature, juste la
 * table qu'on leur donne.
 */
export function fouillerSelonLaNature(
  graine: number,
  palier: number,
  taux: TauxDeFouille,
  butin: readonly LigneDeButin[],
  nature: Nature,
  relanceDisponible: boolean,
): FouilleDeNature {
  const propres = tauxSelonLaNature(taux, nature);
  const premiere = fouiller(graine, palier, propres, butin);

  if (nature !== "hardi" || !relanceDisponible || premiere.genre !== "bredouille") {
    return { trouvaille: premiere, relanceUtilisee: false };
  }
  return {
    trouvaille: fouiller(graineDeLaRelance(graine), palier, propres, butin),
    relanceUtilisee: true,
  };
}

// ════════════════════════════════════════════════════════════════════
//  SÉRIEUX · la rareté
// ════════════════════════════════════════════════════════════════════

/** L'ordre des trois raretés, du plus courant au plus rare. Il sert à
 *  comparer, et c'est son seul emploi : aucune probabilité ne s'en
 *  déduit. */
export const RANG_DE_RARETE: Readonly<Record<Rarete, number>> = {
  "commun": 0,
  "peu commun": 1,
  "rare": 2,
};

/** La graine du second tirage de Sérieux. Même raison que
 *  `graineDeLaRelance` : déduite, jamais tirée. */
export function graineDuSecondTirage(graine: string): string {
  return `${graine}·2`;
}

/**
 * Une rencontre, vue par une nature.
 *
 * **Sérieux tire deux fois et garde la plus rare.** Et « la plus rare »
 * se juge sur la RARETÉ, pas sur le pourcentage de l'espèce : deux
 * espèces d'une même zone peuvent être à 5 % et appartenir à deux
 * tranches de rareté différentes, parce que les tables sont écrites à la
 * main.
 *
 * **À rareté égale, on garde la PREMIÈRE.** Sans cette règle, le second
 * tirage remplacerait le premier une fois sur deux à l'intérieur d'une
 * même tranche, et la liste des espèces qu'un Sérieux croise ne serait
 * plus celle de la zone — il verrait deux fois plus souvent les espèces
 * de la fin de table. L'avantage porte sur la rareté ; il ne doit rien
 * changer d'autre.
 */
export function tirerUneRencontreSelonLaNature(
  table: Parameters<typeof tirerUneRencontre>[0],
  graine: string,
  nature: Nature,
): Rencontre {
  if (!estUneNature(nature)) throw new NatureInconnue(nature);
  const premiere = tirerUneRencontre(table, graine);
  if (nature !== "serieux") return premiere;

  const seconde = tirerUneRencontre(table, graineDuSecondTirage(graine));
  return RANG_DE_RARETE[seconde.rarete] > RANG_DE_RARETE[premiere.rarete] ? seconde : premiere;
}

// ════════════════════════════════════════════════════════════════════
//  MALIN · l'équipe bigarrée
// ════════════════════════════════════════════════════════════════════

/** Combien de types différents Malin doit aligner, et ce que ça rapporte. */
export const MALIN_TYPES_EXIGES = 6;
export const MALIN_BONUS = 0.1;

/**
 * Le multiplicateur d'expérience versé à la clôture.
 *
 * **Malin gagne à tout mélanger, et c'est le miroir exact de l'affinité
 * de type** (planche 78 § 13), qui récompense trois pokémon du même
 * type. Les deux règles tirent dans des sens opposés sur la même
 * décision — composer son équipe — et c'est ce qui les rend lisibles
 * ensemble.
 *
 * On compte les types DIFFÉRENTS, pas les pokémon : une équipe de six
 * Pyrobut ne fait pas six types. La comparaison est faite sur le mot mis
 * en minuscules et sans accents, parce que les types arrivent de
 * `data/butin.json` d'un côté et d'une colonne en base de l'autre.
 */
export function multiplicateurDExperience(
  nature: Nature,
  typesDeLEquipe: readonly string[],
): number {
  if (!estUneNature(nature)) throw new NatureInconnue(nature);
  if (nature !== "malin") return 1;
  const distincts = new Set(
    typesDeLEquipe
      .map((t) => t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))
      .filter((t) => t !== ""),
  );
  return distincts.size >= MALIN_TYPES_EXIGES ? 1 + MALIN_BONUS : 1;
}

// ════════════════════════════════════════════════════════════════════
//  DOUX · les gains partagés
// ════════════════════════════════════════════════════════════════════

export const DOUX_BONUS = 0.15;

/**
 * Le multiplicateur de pokédollars versé à la clôture, pour TOUT LE
 * MONDE dans le sujet.
 *
 * **Il ne se cumule pas.** Deux Doux dans le même sujet donnent +15 %,
 * pas +32 % : la planche dit « tout le monde gagne +15 % », donc c'est un
 * drapeau, pas un produit. Le cumul transformerait l'avantage en course
 * au recrutement de Doux, et « ce qu'il y gagne vraiment : on se bat pour
 * l'avoir dans son sujet » suffit déjà.
 *
 * **Et il demande un sujet à PLUSIEURS.** Un Doux seul n'a personne à
 * faire passer devant ; se l'appliquer à soi-même serait +15 % permanent
 * sur toutes ses fouilles, c'est-à-dire le plus fort des six avantages
 * déguisé en le plus généreux.
 */
export function multiplicateurDePokedollars(naturesDuSujet: readonly Nature[]): number {
  if (naturesDuSujet.length < 2) return 1;
  return naturesDuSujet.includes("doux") ? 1 + DOUX_BONUS : 1;
}
