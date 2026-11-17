// ════════════════════════════════════════════════════════════════════
//  src/application/relever-les-rp.ts
//  Tâche 9 de la relève : le tableau des RP.
//
//  « /search?search_author=<pseudo>&show_results=topics renvoie tous
//    les sujets où le joueur a écrit ; l'Edge Function la lit à la
//    relève et garde le résultat dans une table rp. »
//
//  ── POURQUOI ELLE NE TOURNE PAS À CHAQUE PASSAGE ────────────────────
//
//  La relève passe toutes les cinq minutes. Celle-ci demande UNE PAGE
//  DE RECHERCHE PAR PERSONNAGE : à trente personnages, c'est trente
//  requêtes au forum, 288 fois par jour — plus de huit mille pages pour
//  apprendre qu'un sujet a bougé. Le forum est un hébergement partagé,
//  et on n'est pas seuls dessus.
//
//  Une heure suffit : un tableau de RP n'est pas un fil d'actualité, et
//  la personne qui vient de poster sait très bien qu'elle a posté.
//
//  Comme le ménage de la tâche 8, l'intervalle se lit dans le JOURNAL
//  et non dans une horloge interne — la fonction Edge est sans état,
//  un compteur en mémoire repartirait de zéro à chaque réveil.
//
//  ── UN PERSONNAGE QUI ÉCHOUE N'EMPORTE PAS LES AUTRES ───────────────
//
//  Une page de recherche qui ne répond pas, un pseudo avec un caractère
//  que le forum digère mal : c'est l'affaire d'un personnage. Les
//  vingt-neuf autres doivent être relevés quand même, et l'erreur se
//  lit dans le journal avec le nom de celui qui a manqué.
// ════════════════════════════════════════════════════════════════════

//
//  ── ELLE COMMENCE PAR RELIRE LES NOMS ───────────────────────────────
//
//  « J'ai découvert "personne n'a écrit" alors qu'Arceus a posté après
//  moi », 13 novembre. La cause n'était pas dans le carnet :
//  `joueur.pseudo` est écrit UNE FOIS à la liaison et n'était plus
//  jamais relu, alors que la recherche du forum ne connaît que le
//  pseudo d'aujourd'hui. Après un changement de nom, elle rend zéro
//  sujet, et le tableau annonce qu'il ne s'est rien passé.
//
//  POURQUOI DANS CETTE TÂCHE, ET PAS DANS UNE DIXIÈME. Le nom doit
//  être frais AU MOMENT de la recherche : une tâche séparée, avec son
//  intervalle et son journal, chercherait un passage sur deux avec le
//  nom d'avant — et on ne saurait jamais lequel des deux a tort.
//  L'annuaire coûte une ou deux pages par heure, contre une par
//  personnage : le mettre ici ne change pas l'ordre de grandeur.
//
//  ET UN ANNUAIRE ILLISIBLE NE FAIT PAS SAUTER LE PASSAGE : on relève
//  avec les noms qu'on a. Un nom vieux d'une heure vaut mieux que pas
//  de relève du tout, et l'erreur est dans le journal.

import type {
  Horloge,
  JournalDeReleve,
  LecteurDesPseudos,
  LecteurDesSujetsDUnMembre,
  RegistreDesPseudos,
  RegistreDesRp,
} from "./ports.ts";

export const TACHE = "rp";

/** Une heure. Un tableau de RP n'est pas un fil d'actualité. */
export const MINUTES_ENTRE_DEUX_PASSAGES = 60;

export type PassageDesRp = {
  /** Faux quand le passage a été sauté parce qu'il est trop tôt. */
  readonly tourne: boolean;
  readonly joueurs: number;
  readonly sujets: number;
  /** Combien de personnages ont été renommés d'après l'annuaire. */
  readonly renommes: number;
  readonly erreurs: readonly string[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

const MS_PAR_MINUTE = 60 * 1000;

export class ReleverLesRp {
  constructor(
    private readonly forum: LecteurDesSujetsDUnMembre,
    private readonly registre: RegistreDesRp,
    private readonly journal: JournalDeReleve,
    private readonly horloge: Horloge,
    //  LES DEUX SONT OBLIGATOIRES, et c'est voulu. Rendus optionnels,
    //  une racine de composition qui les oublie ferait retomber la
    //  relève sur les noms du jour de la liaison — exactement le défaut
    //  qu'on répare — et elle ne s'en plaindrait jamais.
    private readonly annuaire: LecteurDesPseudos,
    private readonly pseudos: RegistreDesPseudos,
    private readonly minutes = MINUTES_ENTRE_DEUX_PASSAGES,
  ) {}

  async executer(): Promise<PassageDesRp> {
    //  UN JOURNAL ILLISIBLE FAIT SAUTER LE PASSAGE, il ne le déclenche
    //  pas. Prendre la panne pour un « jamais fait » ferait tourner la
    //  tâche à chaque passage tant que le journal est en panne —
    //  c'est-à-dire exactement quand on ne pourra pas s'en apercevoir.
    let dernier: Date | null;
    try {
      dernier = await this.journal.dernierPassage(TACHE);
    } catch (e) {
      return {
        tourne: false,
        joueurs: 0,
        sujets: 0,
        renommes: 0,
        erreurs: [`rp : journal illisible, passage sauté — ${raison(e)}`],
      };
    }

    if (dernier !== null) {
      const ecoulees = (this.horloge.maintenant().getTime() - dernier.getTime()) /
        MS_PAR_MINUTE;
      if (ecoulees < this.minutes) {
        return { tourne: false, joueurs: 0, sujets: 0, renommes: 0, erreurs: [] };
      }
    }

    const erreurs: string[] = [];
    let joueurs = 0;
    let sujets = 0;

    let aRelever;
    try {
      aRelever = await this.registre.joueursARelever();
    } catch (e) {
      erreurs.push(`rp : liste des personnages illisible — ${raison(e)}`);
      await this.noter(0, erreurs);
      return { tourne: true, joueurs: 0, sujets: 0, renommes: 0, erreurs };
    }

    const { renommes, personnages } = await this.relireLesNoms(aRelever, erreurs);

    for (const j of personnages) {
      try {
        const trouves = await this.forum.sujetsEcritsPar(j.pseudo);
        //  LE PERSONNAGE EST PARTICIPANT DE CHACUN DE SES SUJETS, et
        //  c'est la prémisse même de la recherche : elle rend les
        //  sujets où IL A ÉCRIT. On le note donc, en plus de ceux que
        //  la page nomme — c'est ce qui rend les RP communs
        //  calculables sans aller lire chaque sujet.
        const avecLui = trouves.map((s) => ({
          ...s,
          participants: [
            { id: j.forumUserId, pseudo: j.pseudo },
            ...s.participants.filter((m) => m.id !== j.forumUserId),
          ],
        }));
        const fait = await this.registre.relever(j.joueurId, avecLui);
        joueurs += 1;
        sujets += fait.ecrits;
      } catch (e) {
        //  LE NOM DE CELUI QUI A MANQUÉ EST DANS L'ERREUR : sans lui,
        //  « une recherche a échoué » n'aide personne à chercher.
        erreurs.push(`rp : ${j.pseudo} — ${raison(e)}`);
      }
    }

    await this.noter(sujets, erreurs);
    return { tourne: true, joueurs, sujets, renommes, erreurs };
  }

  /** L'annuaire du forum, comparé à ce qu'on a rangé.
   *
   *  ELLE REND LA LISTE À RELEVER AVEC LES NOMS FRAIS, et pas seulement
   *  un compte : chercher avec l'ancien nom juste après l'avoir corrigé
   *  en base serait le même défaut, déplacé d'une ligne.
   *
   *  CE QUI N'EST PAS UN CHANGEMENT N'EST PAS ENVOYÉ. Un membre absent
   *  de l'annuaire garde le nom qu'on a — la liste peut être partielle,
   *  et renommer quelqu'un « rien » serait pire que de le laisser vieux
   *  d'une heure. Un nom identique n'est pas envoyé non plus : la base
   *  ne compterait rien, mais le journal annoncerait trente renommages
   *  par heure, et un journal qui crie tout le temps ne dit plus rien. */
  private async relireLesNoms(
    aRelever: readonly { joueurId: string; forumUserId: number; pseudo: string }[],
    erreurs: string[],
  ): Promise<{
    renommes: number;
    personnages: readonly { joueurId: string; forumUserId: number; pseudo: string }[];
  }> {
    let annuaire: ReadonlyMap<number, string>;
    try {
      annuaire = await this.annuaire.pseudosDuForum();
    } catch (e) {
      //  ON RELÈVE QUAND MÊME, avec les noms qu'on a. L'annuaire est
      //  une amélioration de la relève, pas sa condition.
      erreurs.push(`rp : annuaire des membres illisible — ${raison(e)}`);
      return { renommes: 0, personnages: aRelever };
    }

    const changements = [];
    const personnages = [];
    for (const j of aRelever) {
      const frais = annuaire.get(j.forumUserId);
      if (frais === undefined || frais === j.pseudo) {
        personnages.push(j);
        continue;
      }
      changements.push({ forumUserId: j.forumUserId, pseudo: frais });
      personnages.push({ ...j, pseudo: frais });
    }

    if (changements.length === 0) return { renommes: 0, personnages };

    try {
      const faits = await this.pseudos.renommer(changements);
      return { renommes: faits, personnages };
    } catch (e) {
      //  LA BASE A REFUSÉ, DONC ON CHERCHE AVEC LES ANCIENS NOMS. Ce
      //  sont ceux qu'elle a encore, et c'est avec eux que le résultat
      //  sera rangé : chercher avec le nom frais rangerait les sujets
      //  d'aujourd'hui sous un personnage qui s'appelle encore autrement.
      erreurs.push(
        `rp : ${changements.length} renommage(s) refusé(s) — ${raison(e)}`,
      );
      return { renommes: 0, personnages: aRelever };
    }
  }

  /** ON NOTE MÊME QUAND ÇA A ÉCHOUÉ : sans ça, une tâche en panne
   *  serait retentée toutes les cinq minutes et remplirait le journal
   *  de la même erreur 288 fois par jour. */
  private async noter(sujets: number, erreurs: string[]): Promise<void> {
    try {
      await this.journal.noter(TACHE, sujets, erreurs);
    } catch (e) {
      erreurs.push(`rp : journal non écrit — ${raison(e)}`);
    }
  }
}
