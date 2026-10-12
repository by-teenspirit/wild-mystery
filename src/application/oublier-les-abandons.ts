// ════════════════════════════════════════════════════════════════════
//  src/application/oublier-les-abandons.ts
//  Tâche 8 de la relève : le ménage du registre.
//
//  Un sujet de RP commencé puis laissé tomber garde son registre pour
//  toujours : les rencontres, les captures, les objets trouvés, qui
//  n'ont jamais été versés puisque le sujet n'a jamais été clôturé. Au
//  bout de deux mois sans un message, c'est un abandon, et on l'oublie.
//
//  Un sujet CLÔTURÉ n'est jamais touché. Son registre est la pièce
//  justificative de ce qui a été versé : on ne jette pas la comptabilité
//  d'une partie jouée.
//
//  ── POURQUOI ELLE NE TOURNE PAS À CHAQUE PASSAGE ────────────────────
//
//  La relève passe toutes les cinq minutes. Ce ménage-là porte sur des
//  sujets morts depuis SOIXANTE JOURS : ce qui est à oublier aujourd'hui
//  l'était déjà hier, et le sera encore demain. Le faire 288 fois par
//  jour, c'est parcourir tout le registre pour n'y rien trouver 287
//  fois, et écrire 288 lignes de journal qui disent zéro.
//
//  **Un journal qu'on apprend à ignorer ne sert plus à rien.** C'est la
//  leçon du pokédex avant la migration `0012`, qui annonçait « 312
//  rangées » à chaque passage : le chiffre était du bruit, et un vrai
//  défaut s'y serait noyé. Ici, une ligne par semaine se lit.
//
//  ── ET L'INTERVALLE SE LIT DANS LE JOURNAL, PAS DANS UNE HORLOGE ────
//
//  C'est `journal.dernierPassage(TACHE)` qui décide, pas un compteur en
//  mémoire. La fonction Edge est sans état : elle est réveillée, elle
//  travaille, elle meurt. Un compteur interne repartirait de zéro à
//  chaque réveil, donc le ménage tournerait à chaque passage — ce qu'on
//  voulait éviter.
//
//  Conséquence voulue : **on ne note le journal que les fois où on a
//  travaillé.** Noter un passage sauté avancerait la date et repousserait
//  le vrai ménage d'une semaine à chaque fois — il n'aurait jamais lieu.
// ════════════════════════════════════════════════════════════════════

import type { Horloge, JournalDeReleve, Menage, MenageFait } from "./ports.ts";

export const TACHE = "menage";

/** Une semaine. Un sujet mort depuis soixante jours n'est pas pressé. */
export const JOURS_ENTRE_DEUX_PASSAGES = 7;

export type PassageDeMenage = {
  /** Faux quand le ménage a été sauté parce qu'il est trop tôt. C'est le
   *  cas ordinaire : 287 passages sur 288. */
  readonly tourne: boolean;
  /** Ce qui a été effacé. `null` quand on a sauté. */
  readonly fait: MenageFait | null;
  readonly erreurs: readonly string[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

export class OublierLesAbandons {
  constructor(
    private readonly menage: Menage,
    private readonly journal: JournalDeReleve,
    private readonly horloge: Horloge,
    /** La fenêtre d'oubli, en jours. Passée à la base, qui a le dernier
     *  mot sur ce qu'elle a compris — c'est elle qui le rend. */
    private readonly jours = 60,
    private readonly joursEntreDeuxPassages = JOURS_ENTRE_DEUX_PASSAGES,
  ) {}

  async executer(): Promise<PassageDeMenage> {
    const erreurs: string[] = [];

    //  ── L'ÂGE DU DERNIER PASSAGE ────────────────────────────────────
    //
    //  `null` veut dire « jamais fait », donc on le fait. Une panne de
    //  lecture du journal, en revanche, ne doit PAS être prise pour un
    //  « jamais fait » : ça ferait tourner le ménage à chaque passage
    //  tant que le journal est en panne, c'est-à-dire exactement quand
    //  on ne pourra pas s'en apercevoir. On saute, et on le dit.
    let dernier: Date | null;
    try {
      dernier = await this.journal.dernierPassage(TACHE);
    } catch (e) {
      return {
        tourne: false,
        fait: null,
        erreurs: [`ménage : journal illisible, passage sauté — ${raison(e)}`],
      };
    }

    if (dernier !== null) {
      const ecoules = (this.horloge.maintenant().getTime() - dernier.getTime()) / MS_PAR_JOUR;
      if (ecoules < this.joursEntreDeuxPassages) {
        return { tourne: false, fait: null, erreurs: [] };
      }
    }

    let fait: MenageFait | null = null;
    try {
      fait = await this.menage.oublierLesAbandons(this.jours);
    } catch (e) {
      erreurs.push(`ménage : ${raison(e)}`);
    }

    //  ON NOTE MÊME QUAND ÇA A ÉCHOUÉ, et c'est délibéré : sans ça, un
    //  ménage qui échoue serait retenté toutes les cinq minutes, et il
    //  échouerait 288 fois en remplissant le journal d'erreurs
    //  identiques. La semaine qui passe est le bon rythme de réessai
    //  pour un travail qui n'est jamais urgent.
    await this.journal.noter(TACHE, fait?.sujets ?? 0, erreurs);
    return { tourne: true, fait, erreurs };
  }
}
