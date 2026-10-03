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
import { type LigneDeBilan, redigerLeBilan, redigerLeRefus } from "./bilan.ts";
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

    const codeDuSujet = codeDepuisEmpreinte(
      await this.signataire.empreinte(`cloture|${sujetId}|${joueurs.join(",")}`),
    );

    if (manques.size > 0) {
      // Un refus ne change rien en base : on le poste directement, et s'il
      // n'part pas, la relève repassera — le sujet n'est pas clos.
      await this.forum.repondre(
        sujetId,
        demandeurPseudo,
        redigerLeRefus(await this.manquesLisibles(manques), codeDuSujet),
        codeDuSujet,
      );
      return { issue: "refusee", manques };
    }

    const versements: Versement[] = [];
    for (const [joueurId, v] of verdicts) {
      if (v.possible) versements.push({ joueurId, effets: v.effets });
    }

    const bilan = redigerLeBilan(
      await this.lignesDeBilan(versements, verdicts),
      codeDuSujet,
    );

    try {
      // Le bilan entre en base AVEC la clôture, dans la même transaction.
      await this.cloture.appliquer(
        sujetId,
        versements,
        codeDuSujet,
        bilan,
        demandeurPseudo,
      );
    } catch (erreur) {
      // La base a dit non. On ne poste rien : le registre est intact,
      // la relève repassera dans cinq minutes.
      throw new ClotureEchouee(erreur);
    }

    // ── ET ON NE POSTE PAS ICI ───────────────────────────────────────
    //  Le bilan est en base, dans la file. C'est `PosterLesBilans` qui le
    //  publie, et elle seule.
    //
    //  POURQUOI, alors qu'on postait ici le 2 octobre au matin. Parce que
    //  publier des deux endroits demandait de marquer le bilan comme posté
    //  des deux endroits — et ça a été oublié. Résultat : un bilan publié
    //  restait en file, et la relève le republiait à chaque passage. Seul
    //  le filet du marqueur l'a évité, et un filet n'est pas une
    //  architecture.
    //
    //  Le joueur n'attend pas pour autant : la fonction Edge lance
    //  `PosterLesBilans` APRÈS ce parcours, donc le bilan part dans le même
    //  passage, quelques secondes plus tard.
    return { issue: "close", code: codeDuSujet, versements };
  }

  /** Ce que chaque joueur emporte, avec des noms lisibles. */
  private async lignesDeBilan(
    versements: readonly Versement[],
    verdicts: ReadonlyMap<string, Verdict>,
  ): Promise<readonly LigneDeBilan[]> {
    const lignes: LigneDeBilan[] = [];
    for (const v of versements) {
      const avant = await this.jeu.etatDe(v.joueurId);
      const e = v.effets;
      lignes.push({
        pseudo: await this.jeu.pseudoDe(v.joueurId),
        captures: await Promise.all(e.captures.map(async (c) => ({
          espece: await this.catalogue.nomEspece(c.especeId),
          niveau: c.niveau,
        }))),
        croisees: await Promise.all(
          e.especesCroisees.map((id) => this.catalogue.nomEspece(id)),
        ),
        experience: [...e.xpParPokemon].map(([pokemon, gain]) => ({ pokemon, gain })),
        ajoutes: await Promise.all(
          [...e.objetsAjoutes].map(async ([id, quantite]) => ({
            objet: await this.catalogue.nomObjet(id),
            quantite,
          })),
        ),
        consommes: await Promise.all(
          [...e.objetsConsommes].map(async ([id, quantite]) => ({
            objet: await this.catalogue.nomObjet(id),
            quantite,
          })),
        ),
        pokedollarsAvant: avant.pokedollars,
        pokedollarsApres: avant.pokedollars + e.pokedollars,
      });
      // `verdicts` n'est pas lu ici : il l'est plus haut pour décider.
      void verdicts;
    }
    return lignes;
  }

  private async manquesLisibles(
    manques: ReadonlyMap<string, readonly Manque[]>,
  ): Promise<readonly { pseudo: string; manques: readonly string[] }[]> {
    const sortie: { pseudo: string; manques: readonly string[] }[] = [];
    for (const [joueurId, liste] of manques) {
      sortie.push({
        // Le pseudo, pas l'identifiant : un joueur ne doit pas lire un
        // UUID pour savoir que c'est de lui qu'on parle.
        pseudo: await this.jeu.pseudoDe(joueurId),
        manques: await Promise.all(liste.map((m) => this.direLeManque(m))),
      });
    }
    return sortie;
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
