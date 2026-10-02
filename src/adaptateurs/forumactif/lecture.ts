// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/lecture.ts
//  Lire un sujet du forum, en visiteur.
//
//  Pourquoi pas de DOM : la fonction Edge n'a pas de navigateur, et
//  embarquer un analyseur HTML pour en tirer quatre champs coûte plus
//  qu'il ne rapporte. Le découpage se fait sur le délimiteur de message,
//  qui est engendré par Forumactif et donc parfaitement régulier.
//
//  Ce que ce fichier NE fait PAS : comprendre la prose du joueur. Il ne
//  cherche que les marqueurs que nous avons nous-mêmes posés. C'est ce
//  qui le rend robuste à tout ce qu'un joueur peut écrire.
//
//  Vérifié le 2 octobre 2026 sur le forum réel. Le gabarit relevé :
//    <div id="p12485" class="post row1 post--12485 post-group-2">
//      <div class="postprofile-avatar" data-id="3">
//      <div class="postprofile-name">…<strong>Maître du Jeu</strong>
// ════════════════════════════════════════════════════════════════════

import type {
  DemandeDeClotureLue,
  LecteurDeDemandes,
  LecteurDeForum,
  MessageDuForum,
  SujetRemue,
} from "../../application/ports.ts";
import { type Marqueur, marqueursDe } from "./marqueur.ts";
import { demandesDeCloture } from "./demandes.ts";

export class PageIllisible extends Error {
  constructor(quoi: string) {
    super(
      `Page illisible : ${quoi}. Le gabarit de Forumactif a sans doute changé ; ` +
        `il faut relever le nouveau et reprendre src/adaptateurs/forumactif/.`,
    );
    this.name = "PageIllisible";
  }
}

export type MessageLu = MessageDuForum & {
  readonly groupeId: number | null;
  readonly marqueurs: readonly Marqueur[];
  /** Le bloc HTML du message, tel qu'il est servi. Nécessaire pour y
   *  chercher ce que le JOUEUR a écrit — une demande de clôture, demain un
   *  bloc d'événement. On garde le HTML brut et non du texte nettoyé :
   *  nettoyer serait une interprétation, et chaque module décide lui-même
   *  ce qu'il cherche. */
  readonly corps: string;
};

const DEBUT_DE_MESSAGE = /<div id="p(\d+)" class="post [^"]*?post--\1\b[^"]*"/g;
const AUTEUR = /class="postprofile-avatar"\s+data-id="(-?\d+)"/;
/** Le pseudo. **Pas de `<strong>` dans ce motif, et c'est une correction
 *  du 2 octobre.** Forumactif sert deux formes selon le membre :
 *
 *    <div class="postprofile-name"><span class="group-2 …"><strong>X</strong></span></div>
 *    <div class="postprofile-name">X</div>
 *
 *  La seconde — un compte sans couleur de groupe — faisait lever
 *  `PageIllisible` et plantait la relève sur tout le sujet. On prend donc
 *  le contenu du bloc et on en retire les balises, quelles qu'elles
 *  soient. */
const PSEUDO_MEMBRE = /<div class="postprofile-name">([\s\S]*?)<\/div>/;
const BALISE = /<[^>]*>/g;
const GROUPE = /\bpost-group-(\d+)\b/;

/** Les entités que Forumactif pose dans les pseudos. On n'en décode que
 *  le strict nécessaire : un pseudo sert à mentionner quelqu'un, pas à
 *  être affiché en HTML. */
const ENTITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&amp;/g, "&"],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&quot;/g, '"'],
  [/&#0?39;|&apos;/g, "'"],
  [/&nbsp;/g, " "],
];

export function decoder(texte: string): string {
  let sortie = texte;
  for (const [de, vers] of ENTITES) sortie = sortie.replace(de, vers);
  return sortie.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (entier, nom: string) => {
      const table: Record<string, string> = {
        eacute: "é",
        egrave: "è",
        ecirc: "ê",
        agrave: "à",
        acirc: "â",
        icirc: "î",
        ocirc: "ô",
        ucirc: "û",
        ugrave: "ù",
        ccedil: "ç",
        Eacute: "É",
        Egrave: "È",
        Agrave: "À",
      };
      return table[nom] ?? entier;
    });
}

/**
 * Découpe une page de sujet en messages.
 *
 * Les blocs de publicité que Forumactif glisse entre les messages ont
 * `id="p0"` et `data-id="-2"` : ce ne sont pas des messages, et les
 * compter reviendrait à inscrire des lignes de registre pour une régie
 * publicitaire. Ils sont écartés.
 *
 * Une page qui ne contient AUCUN message lève. C'est délibéré : une
 * liste vide serait une panne silencieuse, et une panne silencieuse
 * viderait le registre sans que personne ne s'en aperçoive.
 */
export function lireLesMessages(html: string, sujetId: number): readonly MessageLu[] {
  const bornes: { id: number; debut: number }[] = [];
  for (const m of html.matchAll(DEBUT_DE_MESSAGE)) {
    bornes.push({ id: Number(m[1]), debut: m.index });
  }
  if (bornes.length === 0) throw new PageIllisible("aucun bloc de message trouvé");

  const messages: MessageLu[] = [];
  for (let i = 0; i < bornes.length; i++) {
    const fin = i + 1 < bornes.length ? bornes[i + 1].debut : html.length;
    const bloc = html.slice(bornes[i].debut, fin);
    const auteur = AUTEUR.exec(bloc);
    const auteurId = auteur ? Number(auteur[1]) : -2;

    // id 0 = pas un message ; auteur négatif = publicité ou invité
    if (bornes[i].id === 0 || auteurId < 0) continue;

    const brutPseudo = PSEUDO_MEMBRE.exec(bloc);
    if (!brutPseudo) throw new PageIllisible(`message ${bornes[i].id} sans bloc de pseudo`);
    const pseudo = decoder(brutPseudo[1].replace(BALISE, "")).trim();
    if (pseudo === "") throw new PageIllisible(`message ${bornes[i].id} au pseudo vide`);
    const groupe = GROUPE.exec(bloc);

    messages.push({
      id: bornes[i].id,
      sujetId,
      auteurId,
      auteurPseudo: pseudo,
      groupeId: groupe ? Number(groupe[1]) : null,
      marqueurs: marqueursDe(bloc),
      corps: bloc,
    });
  }

  if (messages.length === 0) throw new PageIllisible("que des blocs sans auteur");
  return messages;
}

const SUJET_ET_DERNIER = /href="\/t(\d+)-[^"#]*#(\d+)"/g;

/**
 * Repère ce qui a bougé, à partir d'une page de forum.
 *
 * On ne lit AUCUNE DATE. Forumactif affiche « Lun 6 Sep - 10:21 », sans
 * année : impossible d'en faire quoi que ce soit de fiable. Les
 * identifiants de message, eux, ne reculent jamais. C'est eux l'horloge.
 */
export function lireLesSujetsRemues(html: string): readonly SujetRemue[] {
  const dernier = new Map<number, number>();
  for (const m of html.matchAll(SUJET_ET_DERNIER)) {
    const sujetId = Number(m[1]);
    const messageId = Number(m[2]);
    if (messageId === 0) continue;
    dernier.set(sujetId, Math.max(dernier.get(sujetId) ?? 0, messageId));
  }
  return [...dernier].map(([sujetId, dernierMessageId]) => ({ sujetId, dernierMessageId }));
}

export type Recuperateur = (chemin: string) => Promise<string>;

/** L'adaptateur, branché sur un récupérateur. Le `fetch` vit dans la
 *  racine de composition, pas ici : comme ça ce fichier se teste sur des
 *  pages enregistrées, sans réseau. */
export class ForumactifEnLecture implements LecteurDeForum, LecteurDeDemandes {
  constructor(private readonly recuperer: Recuperateur) {}

  /** Les demandes de clôture d'un sujet, depuis un message donné.
   *
   *  C'est ici que le HTML s'arrête : la couche application ne voit jamais
   *  le corps d'un message, seulement ce qu'un joueur a demandé. */
  async demandesDeCloture(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly DemandeDeClotureLue[]> {
    const html = await this.recuperer(`/t${sujetId}-`);
    const nouveaux = lireLesMessages(html, sujetId).filter((m) => m.id > depuisMessageId);
    return demandesDeCloture(nouveaux).map((d) => ({ sujetId, ...d }));
  }

  async messagesDuSujet(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly MessageLu[]> {
    const html = await this.recuperer(`/t${sujetId}-`);
    return lireLesMessages(html, sujetId).filter((m) => m.id > depuisMessageId);
  }

  async sujetsRemues(forums: readonly number[]): Promise<readonly SujetRemue[]> {
    const tout = new Map<number, number>();
    for (const forumId of forums) {
      const html = await this.recuperer(`/f${forumId}-`);
      for (const s of lireLesSujetsRemues(html)) {
        tout.set(s.sujetId, Math.max(tout.get(s.sujetId) ?? 0, s.dernierMessageId));
      }
    }
    return [...tout].map(([sujetId, dernierMessageId]) => ({ sujetId, dernierMessageId }));
  }
}
