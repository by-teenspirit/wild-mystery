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

import { dateDuForum, sujetsDeLaRecherche } from "./recherche.ts";
import { pagesDeLaListe, pseudosDeLaListe } from "./membres.ts";
import type {
  ActionLue,
  CommandeLue,
  DemandeDeClotureLue,
  LecteurDActions,
  LecteurDeCommandes,
  LecteurDeDemandes,
  LecteurDeForum,
  LecteurDeReclamations,
  LecteurDesPseudos,
  LecteurDesSujetsDUnMembre,
  MessageDuForum,
  ReclamationDeCarnetLue,
  SujetDUnJoueur,
  SujetRemue,
} from "../../application/ports.ts";
import { type Marqueur, marqueursDe } from "./marqueur.ts";
import {
  actionsDemandees,
  demandesDeCloture,
  paniersPoses,
  reclamationsDeCarnet,
} from "./demandes.ts";

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

/** L'adresse d'une page de sujet, par son décalage.
 *
 *  Relevé sur le forum le 19 novembre : la première page est
 *  `/t1000-titre`, la deuxième `/t1000p25-titre`, et le slug est
 *  facultatif — `/t1000p100-` répond 200 et redirige. */
export function cheminDuSujet(sujetId: number, decalage: number): string {
  return decalage === 0 ? `/t${sujetId}-` : `/t${sujetId}p${decalage}-`;
}

/**
 * Les décalages de page d'un sujet, relevés dans sa pagination.
 *
 * Forumactif numérote les pages d'un sujet par un décalage dans
 * l'adresse, et sème ces adresses dans le bloc de pagination. On les
 * ramasse plutôt que de calculer : vingt-cinq messages par page est un
 * réglage du panneau d'administration, et un réglage change.
 *
 * Zéro est toujours dans la liste : c'est la page qu'on vient de lire.
 */
export function decalagesDesPages(html: string, sujetId: number): readonly number[] {
  const vus = new Set<number>([0]);
  for (const m of html.matchAll(new RegExp(`/t${sujetId}p(\\d+)-`, "g"))) {
    vus.add(Number(m[1]));
  }
  return [...vus].sort((a, b) => a - b);
}

/** Une lecture de sujet qui ne redemande jamais deux fois la même page. */
function pagesDUnSujet(
  recuperer: Recuperateur,
  sujetId: number,
): (decalage: number) => Promise<string> {
  const vues = new Map<number, string>();
  return async (decalage: number): Promise<string> => {
    const deja = vues.get(decalage);
    if (deja !== undefined) return deja;
    const html = await recuperer(cheminDuSujet(sujetId, decalage));
    vues.set(decalage, html);
    return html;
  };
}

/** Toutes les pages d'un sujet, de la première à la dernière.
 *
 *  La pagination d'un sujet très long masque le milieu derrière des
 *  points de suspension, mais elle montre toujours la dernière page.
 *  On y va quand même pour vérifier qu'elle n'en révèle pas de plus
 *  loin — ça ne coûte rien, puisque c'est la page qu'on allait lire. */
async function decalagesDuSujet(
  lire: (decalage: number) => Promise<string>,
  sujetId: number,
): Promise<readonly number[]> {
  let connus = decalagesDesPages(await lire(0), sujetId);
  for (let garde = 0; garde < 20; garde++) {
    const dernier = connus[connus.length - 1];
    if (dernier === 0) return connus;
    const plus = decalagesDesPages(await lire(dernier), sujetId);
    const fusion = [...new Set([...connus, ...plus])].sort((a, b) => a - b);
    if (fusion[fusion.length - 1] <= dernier) return fusion;
    connus = fusion;
  }
  return connus;
}

/**
 * Les messages d'un sujet postérieurs à un message donné, pagination
 * comprise.
 *
 * ── POURQUOI ON REMONTE AU LIEU DE DESCENDRE ────────────────────────
 *
 * Un sujet de zone grossit sans fin et ce qu'on cherche est toujours à
 * la fin. On part donc de la dernière page et on remonte tant que la
 * page lue ne contient que du neuf. Sur un sujet d'une seule page,
 * c'est exactement la lecture d'avant : une page, une fois.
 *
 * ── CE QUE CETTE FONCTION RÉPARE ────────────────────────────────────
 *
 * Jusqu'au 19 novembre, chaque lecture de sujet demandait `/t<id>-` et
 * s'arrêtait là. Passé vingt-cinq messages, un sujet devenait muet :
 * plus de fouille, plus de panier, plus de clôture, plus de
 * réclamation de carnet. Et la vérification de publication ne
 * retrouvait plus la carte qu'elle venait de poster — alors le relevé
 * la reposait, toutes les dix minutes, cent quarante-quatre fois.
 *
 * Une seule page lue était la cause des quatre pannes à la fois.
 */
export async function messagesApres(
  recuperer: Recuperateur,
  sujetId: number,
  depuisMessageId: number,
): Promise<readonly MessageLu[]> {
  const lire = pagesDUnSujet(recuperer, sujetId);
  const decalages = await decalagesDuSujet(lire, sujetId);
  const moisson: MessageLu[] = [];
  for (let i = decalages.length - 1; i >= 0; i--) {
    const lus = lireLesMessages(await lire(decalages[i]), sujetId);
    moisson.unshift(...lus.filter((m) => m.id > depuisMessageId));
    // Cette page contient du vieux : la frontière est franchie, inutile
    // de remonter plus haut.
    if (lus.some((m) => m.id <= depuisMessageId)) break;
  }
  return moisson;
}

/**
 * Le message d'un sujet qui porte ce marqueur, cherché depuis la fin.
 *
 * `pagesAuPlus` borne la remontée. Un marqueur qu'on cherche a été
 * posé par le relevé lui-même, dans la passe en cours ou la
 * précédente : il est à quelques messages de la fin, jamais au début
 * d'un sujet de cent. Deux pages, c'est entre vingt-six et cinquante
 * messages de marge — davantage qu'une passe n'en produit.
 */
export async function messagePortantUnMarqueur(
  recuperer: Recuperateur,
  sujetId: number,
  code: string,
  pagesAuPlus = 2,
): Promise<MessageLu | null> {
  const lire = pagesDUnSujet(recuperer, sujetId);
  const decalages = await decalagesDuSujet(lire, sujetId);
  const depuis = Math.max(0, decalages.length - pagesAuPlus);
  for (let i = decalages.length - 1; i >= depuis; i--) {
    const lus = lireLesMessages(await lire(decalages[i]), sujetId);
    // Le dernier d'abord : ce qu'on cherche vient d'être posté.
    for (const m of [...lus].reverse()) {
      if (m.marqueurs.some((q) => q.code === code)) return m;
    }
  }
  return null;
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
export class ForumactifEnLecture
  implements
    LecteurDeForum,
    LecteurDeDemandes,
    LecteurDActions,
    LecteurDeCommandes,
    LecteurDeReclamations,
    LecteurDesSujetsDUnMembre,
    LecteurDesPseudos {
  constructor(private readonly recuperer: Recuperateur) {}

  /** Les demandes de clôture d'un sujet, depuis un message donné.
   *
   *  C'est ici que le HTML s'arrête : la couche application ne voit jamais
   *  le corps d'un message, seulement ce qu'un joueur a demandé. */
  async demandesDeCloture(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly DemandeDeClotureLue[]> {
    const nouveaux = await messagesApres(this.recuperer, sujetId, depuisMessageId);
    return demandesDeCloture(nouveaux).map((d) => ({ sujetId, ...d }));
  }

  /** Les actions demandées dans un sujet, depuis un message donné.
   *
   *  Même lecture, même découpage, même frontière que `demandesDeCloture` :
   *  le HTML s'arrête ici. La couche application reçoit des `Action` du
   *  domaine, jamais du texte de message. */
  async actionsDuSujet(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly ActionLue[]> {
    const nouveaux = await messagesApres(this.recuperer, sujetId, depuisMessageId);
    return actionsDemandees(nouveaux).map((a) => ({ sujetId, ...a }));
  }

  /** Les paniers posés dans un sujet, depuis un message donné.
   *
   *  Même lecture, même découpage, même frontière que les deux précédentes :
   *  le HTML s'arrête ici. La couche application reçoit des lignes de
   *  panier du domaine, jamais du texte de message. */
  async commandesDuSujet(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly CommandeLue[]> {
    const nouveaux = await messagesApres(this.recuperer, sujetId, depuisMessageId);
    return paniersPoses(nouveaux).map((p) => ({ sujetId, ...p }));
  }

  /** Les ouvertures de carnet réclamées dans un sujet.
   *
   *  Même lecture, même découpage, même frontière : le HTML s'arrête ici,
   *  et la couche application ne reçoit qu'une empreinte et un auteur. */
  async reclamationsDuSujet(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly ReclamationDeCarnetLue[]> {
    const nouveaux = await messagesApres(this.recuperer, sujetId, depuisMessageId);
    return reclamationsDeCarnet(nouveaux);
  }

  async messagesDuSujet(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly MessageLu[]> {
    return await messagesApres(this.recuperer, sujetId, depuisMessageId);
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

  /** Les sujets où un membre a écrit, par la recherche native.
   *
   *  `show_results=topics` DONNE UN SUJET PAR LIGNE, et non un message
   *  par ligne : sans lui, un joueur qui a posté quarante fois dans le
   *  même RP le verrait quarante fois.
   *
   *  LE PSEUDO EST ÉCHAPPÉ, et pas par méfiance envers la personne :
   *  les pseudos portent des espaces et des accents, et « Compte de
   *  test » sans encodage rendrait une adresse coupée au premier
   *  espace — donc une recherche sur « Compte ».
   *
   *  L'heure qui sert aux dates relatives (« Aujourd'hui à 9:05 ») est
   *  passée ici plutôt que prise dans la fonction : c'est ce qui rend
   *  la lecture mesurable deux fois de suite. */
  async sujetsEcritsPar(
    pseudo: string,
    maintenant: Date = new Date(),
  ): Promise<readonly SujetDUnJoueur[]> {
    const html = await this.recuperer(
      `/search?search_author=${encodeURIComponent(pseudo)}&show_results=topics`,
    );
    return sujetsDeLaRecherche(html).map((s) => ({
      sujetId: s.sujetId,
      titre: s.titre,
      forumId: s.forumId,
      forumNom: s.forumNom,
      reponses: s.reponses,
      dernierLe: dateDuForum(s.dernierLeBrut, maintenant),
      dernierAuteur: s.dernierAuteurPseudo,
      dernierMessage: s.dernierMessageId,
      //  CEUX QUE LA PAGE NOMME : celui qui a ouvert et celui du
      //  dernier message. Le personnage relevé s'ajoute par-dessus,
      //  dans le cas d'usage — c'est lui qui sait de qui il s'agit.
      participants: [
        ...(s.ouvertParId === null ? [] : [{ id: s.ouvertParId, pseudo: "" }]),
        ...(s.dernierAuteurId === null || s.dernierAuteurId === s.ouvertParId
          ? []
          : [{ id: s.dernierAuteurId, pseudo: s.dernierAuteurPseudo }]),
      ],
    }));
  }

  /** Qui s'appelle comment, d'après `/memberlist`.
   *
   *  UNE À DEUX PAGES POUR TOUT LE MONDE, là où `/u<id>` en demanderait
   *  une par personnage. Mesuré le 16 novembre : 65 Ko, cinq membres, et
   *  la pagination se laisse suivre.
   *
   *  ON SUIT LES LIENS DU FORUM plutôt que de deviner un pas : `?start=50`
   *  répond 200 avec zéro membre, donc un pas deviné de 50 sauterait la
   *  moitié des membres si le forum en affiche 25 par page.
   *
   *  LE PLAFOND N'EST PAS DE LA MÉFIANCE ENVERS FORUMACTIF. Une page de
   *  pagination qui se nomme elle-même sous une autre adresse — un
   *  paramètre de tri en plus, un `&` encodé autrement — et la boucle
   *  demande des pages jusqu'à la fin des temps, à l'intérieur d'une
   *  fonction Edge qui a trente secondes. L'ensemble des adresses déjà
   *  vues ne suffit pas : ce sont des adresses DIFFÉRENTES qui rendent
   *  la même page.
   *
   *  UNE PAGE QUI TOMBE N'EMPORTE PAS LES PRÉCÉDENTES : on rend ce
   *  qu'on a lu. La table peut être partielle, c'est écrit dans le port,
   *  et un membre absent garde le nom qu'on lui connaît. */
  async pseudosDuForum(): Promise<ReadonlyMap<number, string>> {
    const PLAFOND = 20;
    const table = new Map<number, string>();
    const vues = new Set<string>();
    const aLire = ["/memberlist"];

    for (let tour = 0; tour < PLAFOND && aLire.length > 0; tour += 1) {
      const chemin = aLire.shift() as string;
      if (vues.has(chemin)) continue;
      vues.add(chemin);

      let html: string;
      try {
        html = await this.recuperer(chemin);
      } catch (e) {
        //  LA PREMIÈRE PAGE EST LA SEULE DONT L'ÉCHEC COMPTE : sans
        //  elle on n'a rien, et rendre une table vide ferait croire à un
        //  forum sans membres. Les suivantes, on s'en passe.
        if (table.size === 0) throw e;
        break;
      }

      for (const [id, nom] of pseudosDeLaListe(html)) table.set(id, nom);
      for (const suivante of pagesDeLaListe(html)) {
        if (!vues.has(suivante)) aLire.push(suivante);
      }
    }

    return table;
  }
}
