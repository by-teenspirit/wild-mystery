// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/combat.ts
//
//  La file des cartes de rencontre, côté base.
//
//  L'adaptateur ne décide rien et ne calcule rien. Les trois chiffres
//  au niveau — PV, attaque, défense — sont calculés par `cartes_a_poster`
//  avec les fonctions de la 0045, au même endroit que ceux du combat
//  lui-même. Les refaire ici donnerait une deuxième formule, et un
//  joueur qui lit sur la carte autre chose que ce que le combat applique.
//
//  ── POURQUOI ON VALIDE AUTANT CE QUI ARRIVE ─────────────────────────
//
//  Une carte à moitié lue ne doit pas partir dans un sujet. Un nom
//  manquant donnerait « Un undefined sauvage apparaît », un niveau
//  manquant « niveau NaN » — et ce serait POSTÉ, lu par un joueur, et
//  marqué comme fait. Mieux vaut lever et laisser la carte en file : la
//  tâche la reprendra au passage suivant, une fois la cause corrigée.
// ════════════════════════════════════════════════════════════════════

import type {
  CartesDeRencontreEnAttente,
  CombatEnCours,
  Combats,
  OuvertureDeCombat,
  RencontreEnAttente,
  TourJoue,
} from "../../application/ports.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";

function nombre(o: Record<string, unknown>, clef: string, ou: string): number {
  const v = o[clef];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new AppelEchoue(
      "cartes_a_poster",
      `${ou}.${clef} : nombre attendu, reçu ${JSON.stringify(v)}`,
    );
  }
  return v;
}

function texte(o: Record<string, unknown>, clef: string, ou: string): string {
  const v = o[clef];
  if (typeof v !== "string" || v === "") {
    throw new AppelEchoue(
      "cartes_a_poster",
      `${ou}.${clef} : texte attendu, reçu ${JSON.stringify(v)}`,
    );
  }
  return v;
}

/** Les types, et au moins un.
 *
 *  Une espèce sans type rendrait « Types :  » dans le sujet. Elle
 *  n'existe pas — le garde-fou n° 37 le vérifie sur les 955 — donc si
 *  elle arrive ici, c'est la lecture qui est cassée, pas la donnée. */
function types(o: Record<string, unknown>, ou: string): readonly string[] {
  const v = o.types;
  if (!Array.isArray(v) || v.length === 0 || !v.every((t) => typeof t === "string")) {
    throw new AppelEchoue(
      "cartes_a_poster",
      `${ou}.types : au moins un type attendu, reçu ${JSON.stringify(v)}`,
    );
  }
  return v as readonly string[];
}

export function lireUneCarte(brut: unknown): RencontreEnAttente {
  if (brut === null || typeof brut !== "object") {
    throw new AppelEchoue("cartes_a_poster", `carte illisible : ${JSON.stringify(brut)}`);
  }
  const o = brut as Record<string, unknown>;
  const s = o.sauvage;
  if (s === null || typeof s !== "object") {
    throw new AppelEchoue("cartes_a_poster", `carte sans sauvage : ${JSON.stringify(brut)}`);
  }
  const sv = s as Record<string, unknown>;

  //  LE COMBATTANT PEUT MANQUER, et c'est un cas du jeu, pas une
  //  faute : planche 99 §5.3, une équipe vide laisse la rencontre être
  //  une rencontre. `null` et `undefined` passent tous les deux — la
  //  base rend un `null` JSON, un tableau en mémoire rend souvent rien.
  const c = o.combattant;
  const combattant = c === null || c === undefined ? null : (() => {
    if (typeof c !== "object") {
      throw new AppelEchoue(
        "cartes_a_poster",
        `combattant illisible : ${JSON.stringify(c)}`,
      );
    }
    const cv = c as Record<string, unknown>;
    const surnom = cv.surnom;
    return {
      nom: texte(cv, "nom", "combattant"),
      //  Le surnom est le SEUL champ qui a le droit d'être absent : un
      //  Pokémon sans surnom est la règle, pas l'exception.
      surnom: typeof surnom === "string" && surnom.trim() !== "" ? surnom : null,
      niveau: nombre(cv, "niveau", "combattant"),
      types: types(cv, "combattant"),
      pv: nombre(cv, "pv", "combattant"),
      pvMax: nombre(cv, "pvMax", "combattant"),
      attaque: nombre(cv, "attaque", "combattant"),
      defense: nombre(cv, "defense", "combattant"),
    };
  })();

  return {
    combatId: texte(o, "combatId", "carte"),
    sujetId: nombre(o, "sujetId", "carte"),
    messageId: nombre(o, "messageId", "carte"),
    mentionne: texte(o, "mentionne", "carte"),
    essais: typeof o.essais === "number" ? o.essais : 0,
    sauvage: {
      nom: texte(sv, "nom", "sauvage"),
      niveau: nombre(sv, "niveau", "sauvage"),
      types: types(sv, "sauvage"),
      pv: nombre(sv, "pv", "sauvage"),
      attaque: nombre(sv, "attaque", "sauvage"),
      defense: nombre(sv, "defense", "sauvage"),
    },
    combattant,
  };
}

/** Un surnom, ou rien. Un surnom vide ferait « (Salamèche) » avec une
 *  parenthèse orpheline devant. */
function lireUnSurnom(brut: unknown): string | null {
  return typeof brut === "string" && brut.trim() !== "" ? brut : null;
}

/** Un combattant complet, capacités comprises.
 *
 *  LES QUATRE CAPACITÉS SONT RELUES UNE PAR UNE. Une capacité sans
 *  puissance ferait lever `degatsDe` au milieu du tour — après que la
 *  base a été lue, avant qu'elle ne soit écrite — et le joueur verrait
 *  son message passer sans rien derrière. */
function lireUnCombattant(brut: unknown, ou: string): {
  nom: string;
  niveau: number;
  types: readonly string[];
  pv: number;
  pvMax: number;
  attaque: number;
  defense: number;
  capacites: readonly {
    id: number;
    nom: string;
    type: string;
    puissance: number;
    precision: number;
  }[];
} {
  if (brut === null || typeof brut !== "object") {
    throw new AppelEchoue("combat_pour_jouer", `${ou} illisible`);
  }
  const o = brut as Record<string, unknown>;
  const brutes = o.capacites;
  if (!Array.isArray(brutes)) {
    throw new AppelEchoue("combat_pour_jouer", `${ou}.capacites : tableau attendu`);
  }
  return {
    nom: texte(o, "nom", ou),
    niveau: nombre(o, "niveau", ou),
    types: types(o, ou),
    pv: nombre(o, "pv", ou),
    pvMax: nombre(o, "pvMax", ou),
    attaque: nombre(o, "attaque", ou),
    defense: nombre(o, "defense", ou),
    capacites: brutes.map((c, i) => {
      if (c === null || typeof c !== "object") {
        throw new AppelEchoue("combat_pour_jouer", `${ou}.capacites[${i}] illisible`);
      }
      const k = c as Record<string, unknown>;
      return {
        id: nombre(k, "id", `${ou}.capacites[${i}]`),
        nom: texte(k, "nom", `${ou}.capacites[${i}]`),
        type: texte(k, "type", `${ou}.capacites[${i}]`),
        puissance: nombre(k, "puissance", `${ou}.capacites[${i}]`),
        precision: nombre(k, "precision", `${ou}.capacites[${i}]`),
      };
    }),
  };
}

export class CartesDeRencontreSupabase implements CartesDeRencontreEnAttente {
  constructor(private readonly appeler: AppelSql) {}

  async aPoster(combien: number): Promise<readonly RencontreEnAttente[]> {
    const nom = "cartes_a_poster";
    const recu = await this.appeler(nom, { combien });
    if (!Array.isArray(recu)) {
      throw new AppelEchoue(nom, `tableau attendu, reçu ${JSON.stringify(recu)}`);
    }
    return recu.map(lireUneCarte);
  }

  async postee(combatId: string, messageId: number): Promise<void> {
    await this.appeler("carte_postee", { combat: combatId, message: messageId });
  }

  async echouee(combatId: string, erreur: string): Promise<number> {
    const recu = await this.appeler("carte_echouee", { combat: combatId, erreur });
    return typeof recu === "number" ? recu : 0;
  }
}

/** L'ouverture d'un combat.
 *
 *  Tout est décidé en base (migration 0046) : le combattant, les PV, et
 *  le refus du deuxième combat dans un même sujet. L'adaptateur ne fait
 *  que transporter — et relire la réponse, parce qu'un `combatId` absent
 *  ferait planter la carte bien plus loin, sans rapport apparent.
 */
export class CombatsSupabase implements Combats {
  constructor(private readonly appeler: AppelSql) {}

  async pourJouer(sujetId: number): Promise<CombatEnCours | null> {
    const nom = "combat_pour_jouer";
    const recu = await this.appeler(nom, { sujetId });
    //  AUCUN COMBAT OUVERT : `null`, et ce n'est pas une erreur. C'est
    //  la réponse à « est-ce qu'il y a un combat ici », et elle est
    //  « non » la plupart du temps.
    if (recu === null || recu === undefined) return null;
    if (typeof recu !== "object") {
      throw new AppelEchoue(nom, `objet attendu, reçu ${JSON.stringify(recu)}`);
    }
    //  ON RELIT TOUT, et pour la même raison que les cartes : un
    //  chiffre absent deviendrait `NaN` au milieu d'un calcul de
    //  dégâts, et le tour partirait dans le sujet avec un résultat
    //  absurde — marqué comme joué, donc jamais rejoué.
    const o = recu as Record<string, unknown>;
    return {
      combatId: texte(o, "combatId", "combat"),
      sujetId: nombre(o, "sujetId", "combat"),
      joueurId: texte(o, "joueurId", "combat"),
      tour: nombre(o, "tour", "combat"),
      sauvage: {
        ...lireUnCombattant(o.sauvage, "sauvage"),
        especeId: nombre(o.sauvage as Record<string, unknown>, "especeId", "sauvage"),
      },
      combattant: o.combattant === null || o.combattant === undefined ? null : {
        ...lireUnCombattant(o.combattant, "combattant"),
        pokemonId: texte(
          o.combattant as Record<string, unknown>,
          "pokemonId",
          "combattant",
        ),
        surnom: lireUnSurnom((o.combattant as Record<string, unknown>).surnom),
      },
    };
  }

  async jouer(t: Parameters<Combats["jouer"]>[0]): Promise<TourJoue> {
    const nom = "jouer_un_tour";
    const recu = await this.appeler(nom, t);
    if (recu === null || typeof recu !== "object") {
      throw new AppelEchoue(nom, `objet attendu, reçu ${JSON.stringify(recu)}`);
    }
    const o = recu as Record<string, unknown>;
    return {
      tourId: typeof o.tourId === "string" ? o.tourId : null,
      //  MÊME PRUDENCE QUE POUR `ouvert` : absent vaut faux. Se tromper
      //  dans ce sens-là fait un tour de moins ; dans l'autre, on
      //  croirait avoir joué un tour que la base a refusé, et on
      //  verserait son expérience.
      joue: o.joue === true,
      raison: typeof o.raison === "string" ? o.raison : null,
    };
  }

  async ouvrir(c: {
    readonly sujetId: number;
    readonly messageId: number;
    readonly joueurId: string;
    readonly especeId: number;
    readonly niveau: number;
  }): Promise<OuvertureDeCombat> {
    const nom = "ouvrir_un_combat";
    const recu = await this.appeler(nom, c);
    if (recu === null || typeof recu !== "object") {
      throw new AppelEchoue(nom, `objet attendu, reçu ${JSON.stringify(recu)}`);
    }
    const o = recu as Record<string, unknown>;
    if (typeof o.combatId !== "string" || o.combatId === "") {
      throw new AppelEchoue(nom, `combatId manquant : ${JSON.stringify(recu)}`);
    }
    return {
      combatId: o.combatId,
      //  `ouvert` ABSENT VAUT FAUX, et pas l'inverse. Se tromper dans ce
      //  sens-là ne fait rien de grave : on annonce un combat de moins.
      //  Dans l'autre, on annoncerait un combat qui n'existe pas.
      ouvert: o.ouvert === true,
      raison: typeof o.raison === "string" ? o.raison : null,
    };
  }
}
