// ════════════════════════════════════════════════════════════════════
//  src/application/publier-les-cartes.ts — tâche 11 de la relève
//
//  UN SUJET PAR JOUEUR, DANS LA CATÉGORIE DES CARTES DRESSEUR.
//
//  « Ce que je veux c'est que Arceus poste toutes les trainer card
//  dans une catégorie, pour chaque joueur », 2 novembre.
//
//  ── POURQUOI UN SEUL MESSAGE PAR JOUEUR, POUR TOUJOURS ──────────────
//
//  Parce que la carte ne contient aucune donnée. Elle porte un
//  marqueur, et le script la remplit à chaque affichage. Cette tâche
//  crée donc le sujet à l'arrivée du joueur et ne le touche plus
//  jamais : pas de mise à jour, pas de message édité, pas de
//  repassage.
//
//  Si la carte avait porté ses chiffres en dur, il aurait fallu
//  rééditer trente messages à chaque capture. C'est la décision du
//  matin qui rend celle-ci tenable.
//
//  ── LE NUMÉRO DU JOUEUR EST ÉCRIT DANS LA CARTE ─────────────────────
//
//  `data-wm-tcard="42"`. D'habitude le script devine le propriétaire
//  en remontant au `.post` et en lisant l'auteur du message — mais ici
//  l'auteur est le compte de la relève, pas le joueur. Sans ce
//  numéro, les trente cartes afficheraient l'équipe du même compte.
//
//  ── CE QUI SE PASSE SI LE RÉSEAU LÂCHE AU MAUVAIS MOMENT ────────────
//
//  Entre l'envoi et la note en base, il y a un instant où le sujet
//  existe et où personne ne le sait. L'adaptateur le rattrape en
//  cherchant le titre dans le forum avant d'écrire : au passage
//  suivant, il retrouve le sujet au lieu d'en créer un second. C'est
//  pour ça que le titre contient le pseudo et qu'il ne change pas.
// ════════════════════════════════════════════════════════════════════

import type { CartesDresseur, CreateurDeSujet, JournalDeReleve } from "./ports.ts";

export type BilanDesCartes = {
  readonly publiees: number;
  readonly erreurs: readonly string[];
};

/** Le titre d'un sujet de carte. Il sert aussi de filet anti-doublon,
 *  donc il doit être STABLE : changer sa forme ferait recréer un sujet
 *  à chacun. */
export function titreDeLaCarte(pseudo: string): string {
  return `Carte dresseur — ${pseudo}`;
}

/** Le corps du message : le gabarit, avec le numéro du joueur et son
 *  pseudo mis à la place des valeurs d'attente.
 *
 *  L'AVATAR N'EST PAS REMPLI, et il ne peut pas l'être : la base ne
 *  connaît pas l'avatar d'un joueur, et personne ne peut éditer un
 *  message posté par quelqu'un d'autre. Le gabarit a une case vide
 *  prévue pour ça — `wm-dresseur__avatar--vide` — et c'est elle qu'on
 *  pose plutôt qu'une image cassée. */
export function corpsDeLaCarte(
  gabarit: string,
  joueur: { forumUserId: number; pseudo: string },
): string {
  return gabarit
    .replace(/data-wm-tcard(?![-\w])/, `data-wm-tcard="${joueur.forumUserId}"`)
    .replace(
      /<img class="wm-dresseur__avatar"[^>]*>/,
      '<span class="wm-dresseur__avatar wm-dresseur__avatar--vide"></span>',
    )
    .replace("TON PERSONNAGE", joueur.pseudo)
    .replace(/Dresseur nº \d+/, `Dresseur nº ${joueur.forumUserId}`);
}

export class PublierLesCartes {
  constructor(
    private readonly cartes: CartesDresseur,
    private readonly forum: CreateurDeSujet,
    private readonly journal: JournalDeReleve,
    private readonly gabarit: () => Promise<string>,
  ) {}

  /** `forumId` à `null` : la tâche ne fait rien et le note.
   *
   *  Même raison que pour le sujet d'ouverture : une relève entière ne
   *  doit pas échouer parce qu'une catégorie n'est pas configurée. */
  async executer(forumId: number | null): Promise<BilanDesCartes> {
    if (forumId === null) {
      await this.journal.noter("cartes", 0, ["forum des cartes non configuré"]);
      return { publiees: 0, erreurs: [] };
    }

    const attendent = await this.cartes.aPublier();
    if (attendent.length === 0) return { publiees: 0, erreurs: [] };

    const gabarit = await this.gabarit();
    const erreurs: string[] = [];
    let publiees = 0;

    for (const j of attendent) {
      try {
        const sujetId = await this.forum.creerUnSujet(
          forumId,
          titreDeLaCarte(j.pseudo),
          corpsDeLaCarte(gabarit, j),
        );
        //  ON NOTE AVANT DE PASSER AU SUIVANT. Grouper les notes à la
        //  fin ferait tout reperdre si le passage meurt au milieu, et
        //  chaque sujet déjà créé serait recréé — le filet du titre le
        //  rattraperait, mais au prix d'une lecture de page par joueur.
        await this.cartes.publiee(j.joueurId, sujetId);
        publiees += 1;
      } catch (e) {
        //  UNE CARTE QUI ÉCHOUE N'ARRÊTE PAS LES AUTRES. Un pseudo que
        //  le forum refuse, un sujet verrouillé : le passage suivant
        //  réessaiera, et les vingt-neuf autres sont déjà posées.
        erreurs.push(`${j.pseudo} : ${(e as Error).message}`);
      }
    }

    await this.journal.noter("cartes", publiees, erreurs);
    return { publiees, erreurs };
  }
}
