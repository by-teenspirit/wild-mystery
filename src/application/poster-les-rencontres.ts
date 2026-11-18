// ════════════════════════════════════════════════════════════════════
//  src/application/poster-les-rencontres.ts
//
//  Publier les cartes de rencontre des combats déjà ouverts.
//
//  POURQUOI CETTE TÂCHE EXISTE, ET POURQUOI ELLE RESSEMBLE TANT À
//  `poster-les-bilans.ts`. Ouvrir un combat et poster sa carte ne sont
//  pas atomiques : entre les deux il y a un forum, un réseau, et un
//  compte dont le mot de passe peut avoir expiré. Le 2 octobre 2026,
//  c'est ce qui est arrivé aux bilans — un sujet clos sans bilan, et
//  comme il était clos, plus rien ne réessayait.
//
//  La même forme, donc, sans chercher à factoriser : LE COMBAT EST LE
//  POINT DE NON-RETOUR, la carte est une tâche qu'on repasse. Un joueur
//  dont la carte ne part pas voit son combat ouvert sans rien à lire ;
//  au passage suivant, elle part.
//
//  **Reposter est sans danger**, et ce n'est pas une supposition :
//  l'adaptateur de publication pose un marqueur dans chaque message et,
//  quand un envoi échoue sans réponse, il relit le sujet pour voir si
//  son marqueur y est. Une carte déjà publiée est reconnue, pas
//  dupliquée. C'est pour ça que le code dérive du MESSAGE du joueur et
//  non de l'instant : un reposté porte le même code, donc le même
//  marqueur.
// ════════════════════════════════════════════════════════════════════

import type {
  CartesDeRencontreEnAttente,
  JournalDeReleve,
  PosteurSurForum,
  Signataire,
} from "./ports.ts";
import { codeDepuisEmpreinte } from "../domaine/code.ts";
import { redigerLaCarte } from "./carte-de-rencontre.ts";

export const TACHE = "rencontres";

/** Au-delà, on arrête de réessayer en silence : une carte qui a échoué
 *  dix fois ne passera pas à la onzième sans intervention — sujet
 *  verrouillé, supprimé, ou compte de publication bloqué. Elle reste en
 *  file, mais elle est signalée à chaque passage pour qu'on la voie. */
export const ESSAIS_AVANT_DE_CRIER = 10;

export type CartePubliee = {
  readonly combatId: string;
  readonly sujetId: number;
  readonly messageId: number;
};

export type RencontresDuPassage = {
  readonly publiees: readonly CartePubliee[];
  readonly erreurs: readonly string[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

export class PosterLesRencontres {
  constructor(
    private readonly file: CartesDeRencontreEnAttente,
    private readonly forum: PosteurSurForum,
    private readonly signataire: Signataire,
    private readonly journal: JournalDeReleve,
    /** La racine du dépôt, pour l'adresse des sprites de la fiche.
     *
     *  ELLE PASSE PAR LE CONSTRUCTEUR ET PAS PAR LA FILE : la base ne
     *  sait pas où le dépôt est servi, et elle ne doit pas le savoir —
     *  le jour où la racine change, aucune migration. C'est la relève
     *  qui la tient, du réglage `WM_RACINE_DONNEES`. */
    private readonly racine: string,
    private readonly combien = 10,
  ) {}

  async executer(): Promise<RencontresDuPassage> {
    const publiees: CartePubliee[] = [];
    const erreurs: string[] = [];

    for (const carte of await this.file.aPoster(this.combien)) {
      try {
        //  LE CODE EST DÉRIVÉ DU MESSAGE DU JOUEUR, donc stable. Un
        //  reposté après incident porte le même code que celui qui
        //  n'était pas parti — sans ça, le marqueur de l'adaptateur ne
        //  reconnaîtrait pas son propre message et on en publierait
        //  deux sous le même message de joueur.
        const code = codeDepuisEmpreinte(
          await this.signataire.empreinte(`rencontre|${carte.messageId}`),
        );
        const messageId = await this.forum.repondre(
          carte.sujetId,
          carte.mentionne,
          redigerLaCarte(carte, this.racine),
          code,
        );
        await this.file.postee(carte.combatId, messageId);
        publiees.push({
          combatId: carte.combatId,
          sujetId: carte.sujetId,
          messageId,
        });
      } catch (e) {
        //  Une carte qui ne part pas n'empêche pas les autres de
        //  partir : le forum peut refuser un sujet verrouillé et
        //  accepter le suivant.
        const essais = await this.file.echouee(carte.combatId, raison(e));
        const cri = essais >= ESSAIS_AVANT_DE_CRIER
          ? ` — ${essais} essais, ça ne passera pas tout seul, il faut regarder`
          : "";
        erreurs.push(
          `carte du sujet ${carte.sujetId} : ${raison(e)}${cri}`,
        );
      }
    }

    await this.journal.noter(TACHE, publiees.length, erreurs);
    return { publiees, erreurs };
  }
}
