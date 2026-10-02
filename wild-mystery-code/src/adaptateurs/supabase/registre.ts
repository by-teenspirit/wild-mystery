// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/registre.ts
//
//  Le registre, dans la base. Il ne contient AUCUNE règle : il traduit
//  des appels de port en appels de fonctions SQL, et retraduit ce qui
//  revient.
//
//  Il doit passer `src/contrat/registre.contrat.ts` — exactement la même
//  suite que l'adaptateur en mémoire. C'est tout l'intérêt : si le faux
//  et le vrai divergent, le CI casse avant la production.
// ════════════════════════════════════════════════════════════════════

import type { Evenement, LigneRegistre } from "../../domaine/cloture.ts";
import type { Registre } from "../../application/ports.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";
import { depuisColonnes, LigneIllisible, versColonnes } from "./evenement.ts";

type LigneBrute = {
  readonly messageId: unknown;
  readonly type: unknown;
  readonly charge: unknown;
};

function tableau(fonction: string, recu: unknown): readonly unknown[] {
  if (!Array.isArray(recu)) {
    throw new AppelEchoue(
      fonction,
      `tableau attendu, reçu ${JSON.stringify(recu)?.slice(0, 120)}`,
    );
  }
  return recu;
}

export class RegistreSupabase implements Registre {
  constructor(private readonly appeler: AppelSql) {}

  async lignesDuSujet(sujetId: number, joueurId: string): Promise<readonly LigneRegistre[]> {
    const recu = tableau(
      "registre_lignes",
      await this.appeler("registre_lignes", { sujetId, joueurId }),
    );
    return recu.map((brute) => {
      const l = brute as LigneBrute;
      if (typeof l.messageId !== "number" || typeof l.type !== "string") {
        throw new LigneIllisible(String(l.type), l.charge);
      }
      return { messageId: l.messageId, evenement: depuisColonnes(l.type, l.charge) };
    });
  }

  async inscrire(
    sujetId: number,
    joueurId: string,
    messageId: number,
    evenement: Evenement,
    code: string,
  ): Promise<void> {
    const { type, charge } = versColonnes(evenement);
    await this.appeler("registre_inscrire", {
      sujetId,
      joueurId,
      messageId,
      type,
      charge,
      code,
    });
  }

  async joueursDuSujet(sujetId: number): Promise<readonly string[]> {
    const recu = tableau(
      "registre_joueurs",
      await this.appeler("registre_joueurs", { sujetId }),
    );
    return recu.map((j) => {
      if (typeof j !== "string") {
        throw new AppelEchoue("registre_joueurs", `identifiant de joueur ${JSON.stringify(j)}`);
      }
      return j;
    });
  }

  async oublier(sujetId: number): Promise<number> {
    const recu = await this.appeler("registre_oublier", { sujetId });
    if (typeof recu !== "number" || !Number.isInteger(recu)) {
      throw new AppelEchoue("registre_oublier", `entier attendu, reçu ${JSON.stringify(recu)}`);
    }
    return recu;
  }
}
