// ════════════════════════════════════════════════════════════════════
//  src/application/cloturer-un-sujet.ts
//  Tâche 2 de la relève.
//
//  Ce cas d'usage ORCHESTRE. Il ne calcule rien : le verdict vient du
//  domaine (`evaluerCloture`), l'application vient de la base en une
//  transaction. Lui se contente de rassembler, d'appeler dans le bon
//  ordre, et d'écrire ce qu'il faut dans le sujet.
//
//  La règle qu'il fait respecter : TOUT est versé d'un coup, ou RIEN.
//  Il suffit qu'un seul joueur d'un multi n'ait pas ses balls pour que
//  la clôture entière soit refusée. C'est voulu : un RP se clôt à
//  plusieurs ou pas du tout.
// ════════════════════════════════════════════════════════════════════

import { evaluerCloture, type Manque, type Verdict } from "../domaine/cloture.ts";
import { codeDepuisEmpreinte } from "../domaine/code.ts";
import type {
  Catalogue,
  Cloture,
  EtatDuJeu,
  PosteurSurForum,
  Registre,
  Signataire,
  Versement,
} from "./ports.ts";

export type DemandeDeCloture = {
  readonly sujetId: number;
  readonly demandeurId: string;
  readonly demandeurPseudo: string;
};

export type Resultat =
  | {
    readonly issue: "close";
    readonly code: string;
    readonly versements: readonly Versement[];
  }
  | { readonly issue: "deja close" }
  | { readonly issue: "rien a clore" }
  | { readonly issue: "refusee"; readonly manques: ReadonlyMap<string, readonly Manque[]> };

export class ClotureEchouee extends Error {
  readonly raison: unknown;

  constructor(raison: unknown) {
    super(`La base a refusé la clôture : ${String(raison)}`);
    this.name = "ClotureEchouee";
    this.raison = raison;
  }
}

export class CloturerUnSujet {
  constructor(
    private readonly registre: Registre,
    private readonly jeu: EtatDuJeu,
    private readonly cloture: Cloture,
    private readonly forum: PosteurSurForum,
    private readonly catalogue: Catalogue,
    private readonly signataire: Signataire,
  ) {}

  async executer(demande: DemandeDeCloture): Promise<Resultat> {
    const { sujetId, demandeurPseudo } = demande;

    if (await this.cloture.deja(sujetId)) return { issue: "deja close" };

    const joueurs = await this.registre.joueursDuSujet(sujetId);
    if (joueurs.length === 0) return { issue: "rien a clore" };

    // On évalue TOUT LE MONDE avant de décider quoi que ce soit : un
    // joueur en règle ne doit pas être versé si son partenaire ne l'est
    // pas.
    const verdicts = new Map<string, Verdict>();
    for (const joueurId of joueurs) {
      const lignes = await this.registre.lignesDuSujet(sujetId, joueurId);
      const etat = await this.jeu.etatDe(joueurId);
      verdicts.set(joueurId, evaluerCloture(lignes, etat));
    }

    const manques = new Map<string, readonly Manque[]>();
    for (const [joueurId, v] of verdicts) {
      if (!v.possible) manques.set(joueurId, v.manques);
    }

    if (manques.size > 0) {
      await this.forum.repondre(
        sujetId,
        demandeurPseudo,
        await this.redigerLeRefus(manques),
      );
      return { issue: "refusee", manques };
    }

    const versements: Versement[] = [];
    for (const [joueurId, v] of verdicts) {
      if (v.possible) versements.push({ joueurId, effets: v.effets });
    }

    const code = codeDepuisEmpreinte(
      await this.signataire.empreinte(`cloture|${sujetId}|${joueurs.join(",")}`),
    );

    try {
      await this.cloture.appliquer(sujetId, versements, code);
    } catch (erreur) {
      // La base a dit non. On ne poste rien : le registre est intact,
      // la relève repassera dans cinq minutes.
      throw new ClotureEchouee(erreur);
    }

    await this.forum.repondre(sujetId, demandeurPseudo, `Sujet clôturé. Code ${code}`);
    return { issue: "close", code, versements };
  }

  private async redigerLeRefus(
    manques: ReadonlyMap<string, readonly Manque[]>,
  ): Promise<string> {
    const lignes: string[] = ["La clôture n'a pas pu se faire. Il manque :"];
    for (const [joueurId, liste] of manques) {
      for (const m of liste) {
        lignes.push(`— ${joueurId} : ${await this.direLeManque(m)}`);
      }
    }
    lignes.push("Rien n'a été versé, et le registre du sujet est intact.");
    return lignes.join("\n");
  }

  private async direLeManque(m: Manque): Promise<string> {
    if (m.quoi === "objet") {
      const nom = await this.catalogue.nomObjet(m.objetId);
      return `${m.demande} × ${nom}, et il n'en reste ${m.disponible}`;
    }
    if (m.quoi === "place") {
      return `${m.demande} places en boîte, et il n'y en a ${m.disponible}`;
    }
    return `${m.demande} ₽, et il n'y en a ${m.disponible}`;
  }
}
