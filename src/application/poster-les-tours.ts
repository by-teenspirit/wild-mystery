// ════════════════════════════════════════════════════════════════════
//  src/application/poster-les-tours.ts
//
//  Publier le message du Maître du Jeu après chaque tour joué.
//
//  TROISIÈME TÂCHE DE CETTE FORME — les bilans, les cartes de
//  rencontre, les tours — et c'est la même leçon du 2 octobre à chaque
//  fois : jouer le tour et poster son message ne sont pas atomiques.
//  LE TOUR EST LE POINT DE NON-RETOUR, le message est une tâche qu'on
//  repasse.
//
//  On ne factorise pas les trois. Elles se ressemblent beaucoup et
//  elles diffèrent là où ça compte : ce que la file rend, ce que le
//  code dérive, ce qu'un échec signifie. Une tâche générique
//  demanderait quatre paramètres de forme pour économiser trente
//  lignes, et le jour où l'une doit changer, les deux autres
//  changeraient avec elle.
//
//  ── UN TOUR SANS MESSAGE EST PIRE QU'UN BILAN SANS MESSAGE ──────────
//
//  Un bilan qui tarde se lit plus tard ; un tour qui ne part pas laisse
//  le joueur devant un combat dont il ne connaît pas l'état, et il
//  jouera son tour suivant à l'aveugle. C'est pour ça que la tâche
//  passe dans le MÊME passage que la résolution, juste après.
// ════════════════════════════════════════════════════════════════════

import type { JournalDeReleve, PosteurSurForum, Signataire, ToursEnAttente } from "./ports.ts";
import { codeDepuisEmpreinte } from "../domaine/code.ts";
import { redigerLeTour } from "./message-de-tour.ts";

export const TACHE = "tours";

/** Au-delà, on arrête de réessayer en silence. */
export const ESSAIS_AVANT_DE_CRIER = 10;

export type TourPublie = {
  readonly tourId: string;
  readonly sujetId: number;
  readonly messageId: number;
};

export type ToursDuPassage = {
  readonly publies: readonly TourPublie[];
  readonly erreurs: readonly string[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

export class PosterLesTours {
  constructor(
    private readonly file: ToursEnAttente,
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

  async executer(): Promise<ToursDuPassage> {
    const publies: TourPublie[] = [];
    const erreurs: string[] = [];

    for (const tour of await this.file.aPoster(this.combien)) {
      try {
        //  LE CODE DÉRIVE DU MESSAGE DU JOUEUR ET DU NUMÉRO DU TOUR.
        //  Le message seul ne suffirait pas : un même message ne joue
        //  qu'un tour, c'est vrai — mais le marqueur doit distinguer
        //  LA CARTE de rencontre du TOUR, et les deux naissent parfois
        //  du même message quand une rencontre s'ouvre et se joue dans
        //  la foulée. Deux marqueurs identiques, et l'adaptateur
        //  prendrait l'un pour l'autre.
        const code = codeDepuisEmpreinte(
          await this.signataire.empreinte(
            `tour|${tour.messageId}|${tour.numero}`,
          ),
        );
        const messageId = await this.forum.repondre(
          tour.sujetId,
          tour.mentionne,
          redigerLeTour(tour, this.racine),
          code,
        );
        await this.file.poste(tour.tourId, messageId);
        publies.push({
          tourId: tour.tourId,
          sujetId: tour.sujetId,
          messageId,
        });
      } catch (e) {
        const essais = await this.file.echoue(tour.tourId, raison(e));
        const cri = essais >= ESSAIS_AVANT_DE_CRIER
          ? ` — ${essais} essais, ça ne passera pas tout seul, il faut regarder`
          : "";
        erreurs.push(
          `tour ${tour.numero} du sujet ${tour.sujetId} : ${raison(e)}${cri}`,
        );
      }
    }

    await this.journal.noter(TACHE, publies.length, erreurs);
    return { publies, erreurs };
  }
}
