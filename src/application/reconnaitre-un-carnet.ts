// ════════════════════════════════════════════════════════════════════
//  src/application/reconnaitre-un-carnet.ts — tâche 10 de la relève
//
//  LIRE LE SUJET D'OUVERTURE, ET LIER CHAQUE EMPREINTE À SON AUTEUR.
//
//  C'est la moitié serveur de l'ouverture de carnet sans échange de
//  clé : le joueur poste une empreinte, cette tâche la lie au compte
//  qui l'a postée, et la page du joueur échange ensuite son secret
//  contre sa clé. Le staff ne fait rien.
//
//  ── CE QUE CETTE TÂCHE NE FAIT PAS ──────────────────────────────────
//
//  **Elle ne fabrique aucune clé.** Elle enregistre un lien entre une
//  empreinte publique et un compte de forum, rien de plus. La clé naît
//  dans `carnet_reclamer()`, au moment où la page prouve qu'elle
//  connaît le secret — et elle naît une fois.
//
//  Si cette tâche fabriquait la clé, il faudrait la transporter
//  jusqu'au navigateur, et le seul chemin disponible serait le sujet,
//  qui est public.
//
//  **Elle ne répond pas dans le fil.** Poster « c'est bon » obligerait
//  la relève à écrire sur le forum pour un geste qui dure dix
//  secondes, et doublerait la longueur du sujet. La page se recharge,
//  c'est tout.
//
//  ── LE CURSEUR ──────────────────────────────────────────────────────
//
//  Un seul sujet, donc un seul curseur, tenu comme ceux des zones.
//  Relire tout le sujet à chaque passage coûterait une page de plus en
//  plus lourde pour n'y rien trouver : les réclamations anciennes sont
//  déjà liées, et `on conflict do nothing` les rejetterait une à une.
// ════════════════════════════════════════════════════════════════════

import type {
  JournalDeReleve,
  LecteurDeReclamations,
  Reclamations,
  SuiviDesForums,
} from "./ports.ts";

export type BilanDeReconnaissance = {
  readonly lues: number;
  readonly liees: number;
};

export class ReconnaitreUnCarnet {
  constructor(
    private readonly forum: LecteurDeReclamations,
    private readonly reclamations: Reclamations,
    private readonly suivi: SuiviDesForums,
    private readonly journal: JournalDeReleve,
  ) {}

  /** `sujetId` à `null` : la tâche ne fait rien et le dit une fois.
   *
   *  C'est l'état du jour où la migration est passée mais où le sujet
   *  d'ouverture n'existe pas encore. Une tâche qui planterait là
   *  ferait échouer toute la relève pour une ligne de configuration
   *  manquante. */
  async executer(sujetId: number | null): Promise<BilanDeReconnaissance> {
    if (sujetId === null) {
      await this.journal.noter("carnet", 0, ["sujet d'ouverture non configuré"]);
      return { lues: 0, liees: 0 };
    }

    const depuis = await this.suivi.dernierMessageLu(sujetId);
    const reclamations = await this.forum.reclamationsDuSujet(sujetId, depuis);
    if (reclamations.length === 0) return { lues: 0, liees: 0 };

    let liees = 0;
    let dernier = depuis;
    for (const r of reclamations) {
      const neuve = await this.reclamations.enregistrer(r);
      if (neuve) liees += 1;
      //  LE CURSEUR AVANCE MÊME SUR UNE EMPREINTE DÉJÀ LIÉE. Un
      //  copieur qui recolle l'empreinte de quelqu'un d'autre ne doit
      //  pas bloquer le curseur sur son message pour l'éternité.
      if (r.messageId > dernier) dernier = r.messageId;
    }

    if (dernier > depuis) await this.suivi.avancer(sujetId, dernier);

    await this.journal.noter("carnet", liees, []);
    return { lues: reclamations.length, liees };
  }
}
