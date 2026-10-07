// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/cloture.ts
//
//  Appliquer une clôture. L'adaptateur ne décide rien : le verdict et les
//  effets viennent du domaine (`evaluerCloture`), et la base les verse en
//  une seule transaction.
//
//  Tout le risque de ce fichier tient dans la sérialisation. Les `Effets`
//  du domaine portent des `Map`, et une `Map` passée à JSON.stringify
//  devient `{}` — silencieusement. Un bilan entier disparaîtrait sans une
//  seule erreur. D'où des fonctions pures, testées, plutôt qu'un
//  `JSON.stringify(effets)` posé au milieu d'un appel.
// ════════════════════════════════════════════════════════════════════

import type { Effets } from "../../domaine/cloture.ts";
import type {
  BilanEnAttente,
  BilansEnAttente,
  Cloture,
  Versement,
} from "../../application/ports.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";

/** Les effets, dans la forme que `appliquer_cloture` attend. Les clés
 *  sont celles du domaine, en chameau : la migration 0004 lit exactement
 *  celles-là, et une assertion pgTAP interdit le retour du serpent. */
export type EffetsEnJson = {
  readonly objetsConsommes: readonly { objetId: number; quantite: number }[];
  readonly objetsAjoutes: readonly { objetId: number; quantite: number }[];
  readonly captures: readonly { especeId: number; niveau: number }[];
  readonly xpParPokemon: readonly { pokemonId: string; gain: number }[];
  readonly especesCroisees: readonly number[];
  readonly pokedollars: number;
};

function objets(m: ReadonlyMap<number, number>): { objetId: number; quantite: number }[] {
  return [...m].map(([objetId, quantite]) => ({ objetId, quantite }));
}

export function versJson(effets: Effets): EffetsEnJson {
  return {
    objetsConsommes: objets(effets.objetsConsommes),
    objetsAjoutes: objets(effets.objetsAjoutes),
    captures: effets.captures.map((c) => ({ especeId: c.especeId, niveau: c.niveau })),
    xpParPokemon: [...effets.xpParPokemon].map(([pokemonId, gain]) => ({ pokemonId, gain })),
    especesCroisees: [...effets.especesCroisees],
    pokedollars: effets.pokedollars,
  };
}

export type ChargeDeCloture = {
  readonly sujetId: number;
  readonly code: string;
  /** Le texte à publier, enregistré DANS la même transaction que la
   *  clôture. C'est ce qui garantit qu'une clôture appliquée a toujours un
   *  bilan à poster, même si le forum est injoignable à cet instant. */
  readonly bilan: string;
  readonly mentionne: string;
  readonly versements: readonly { joueurId: string; effets: EffetsEnJson }[];
};

export function chargeDeCloture(
  sujetId: number,
  versements: readonly Versement[],
  code: string,
  bilan: string,
  mentionne: string,
): ChargeDeCloture {
  return {
    sujetId,
    code,
    bilan,
    mentionne,
    versements: versements.map((v) => ({ joueurId: v.joueurId, effets: versJson(v.effets) })),
  };
}

export class ClotureSupabase implements Cloture {
  constructor(private readonly appeler: AppelSql) {}

  async deja(sujetId: number): Promise<boolean> {
    const recu = await this.appeler("cloture_deja", { sujetId });
    if (typeof recu !== "boolean") {
      throw new AppelEchoue("cloture_deja", `booléen attendu, reçu ${JSON.stringify(recu)}`);
    }
    return recu;
  }

  async appliquer(
    sujetId: number,
    versements: readonly Versement[],
    code: string,
    bilan: string,
    mentionne: string,
  ): Promise<void> {
    // Une clôture sans versement n'a pas de sens, et la base la refuse.
    // Mieux vaut le dire ici, avec le numéro du sujet, qu'en SQL.
    if (versements.length === 0) {
      throw new AppelEchoue("appliquer_cloture", `aucun versement pour le sujet ${sujetId}`);
    }
    if (bilan.trim() === "") {
      // Un bilan vide ferait entrer dans la file une clôture que personne
      // ne pourrait jamais publier.
      throw new AppelEchoue("appliquer_cloture", `bilan vide pour le sujet ${sujetId}`);
    }
    await this.appeler(
      "appliquer_cloture",
      chargeDeCloture(sujetId, versements, code, bilan, mentionne),
    );
  }
}

/** La file des bilans appliqués mais pas encore publiés. */
export class BilansEnAttenteSupabase implements BilansEnAttente {
  constructor(private readonly appeler: AppelSql) {}

  async aPoster(combien: number): Promise<readonly BilanEnAttente[]> {
    const nom = "clotures_sans_bilan";
    const recu = await this.appeler(nom, { combien });
    if (!Array.isArray(recu)) {
      throw new AppelEchoue(nom, `tableau attendu, reçu ${JSON.stringify(recu)}`);
    }
    return recu.map((brut) => {
      const o = brut as Record<string, unknown>;
      if (
        typeof o.sujetId !== "number" || typeof o.code !== "string" ||
        typeof o.bilan !== "string" || o.bilan === ""
      ) {
        throw new AppelEchoue(nom, `bilan en attente illisible : ${JSON.stringify(brut)}`);
      }
      return {
        sujetId: o.sujetId,
        code: o.code,
        bilan: o.bilan,
        mentionne: typeof o.mentionne === "string" ? o.mentionne : "",
        essais: typeof o.essais === "number" ? o.essais : 0,
      };
    });
  }

  async poste(sujetId: number, messageId: number): Promise<void> {
    await this.appeler("cloture_bilan_poste", { sujetId, messageId });
  }

  async echoue(sujetId: number, erreur: string): Promise<number> {
    const recu = await this.appeler("cloture_bilan_echoue", { sujetId, erreur });
    return typeof recu === "number" ? recu : 0;
  }
}
