// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/membres.ts
//
//  Lire `/memberlist` — qui s'appelle comment, AUJOURD'HUI.
//
//  ── POURQUOI LA RELÈVE A BESOIN DE ÇA ──────────────────────────────
//
//  « J'ai découvert "personne n'a écrit" alors qu'Arceus a posté après
//  moi », 13 novembre. La cause n'était pas dans le carnet : la relève
//  cherche les RP par `/search?search_author=<pseudo>`, avec le pseudo
//  rangé dans `joueur.pseudo` — écrit UNE SEULE FOIS par `lier_compte`
//  et plus jamais relu.
//
//  Après un changement de pseudo, le forum ne trouve plus personne. La
//  recherche rend zéro sujet, `dernier_auteur` reste vide, et le carnet
//  affiche « personne n'a écrit » sur un sujet où quelqu'un venait de
//  répondre. Le carnet disait la vérité sur une donnée fausse.
//
//  Le correctif du carnet (`avecLePseudoDuForum`) répare les écrans, et
//  il ne pouvait pas réparer ça : la relève tourne côté serveur, sans
//  navigateur et sans session. C'est ici qu'elle apprend les noms.
//
//  ── POURQUOI LA LISTE, ET PAS `/u<id>` PAR PERSONNAGE ──────────────
//
//  `/u<id>` donnerait le pseudo d'un membre en une page. À trente
//  personnages, c'est trente pages de plus PAR PASSAGE, sur un
//  hébergement partagé dont on n'est pas propriétaires — la tâche 9 ne
//  tourne qu'une fois par heure précisément pour ça.
//
//  `/memberlist` les donne tous d'un coup. Mesurée le 16 novembre sur
//  le forum : 65 Ko, cinq membres, et `?start=50` répond 200 avec zéro
//  membre — la pagination existe et se laisse suivre.
//
//  ── L'ANATOMIE VIENT DU GABARIT, QUI EST DANS CE DÉPÔT ─────────────
//
//  `templates/memberlist_body` écrit, pour chaque ligne :
//
//      <a class="wm-membres__nom" href="{U_VIEWPROFILE}">{USERNAME}</a>
//
//  et `{USERNAME}` apporte sa propre enveloppe de couleur de groupe :
//
//      <span class="group-5 usr_grp_clr" style="color:#4C8A52">
//        <strong>Erin Kavanagh</strong></span>
//
//  On s'accroche donc à `wm-membres__nom`, qui est À NOUS et versionné
//  ici — pas à « un lien vers /u quelque part dans la page ». La barre
//  de navigation porte elle aussi un `/u<id>`, celui de la personne
//  connectée : le prendre renommerait le Maître du Jeu avec le pseudo
//  de tout le monde.
//
//  ── PAS DE DOMParser ───────────────────────────────────────────────
//
//  Comme `recherche.ts` : la fonction Edge tourne sur Deno, où
//  `DOMParser` n'existe pas sans dépendance, et une dépendance pour
//  lire deux champs par ligne est un paquet de plus à suivre.
// ════════════════════════════════════════════════════════════════════
import { decoderLesEntites } from "./recherche.ts";

/** `<a class="wm-membres__nom" href="/u5">…</a>`, bornée à la balise. */
const LIGNE = /<a[^>]*\bclass="[^"]*\bwm-membres__nom\b[^"]*"[^>]*\bhref="\/u(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;

/** Les liens de pagination de la liste, tels que `{PAGINATION}` les pose. */
const PAGE = /<a[^>]*\bhref="([^"]*\/memberlist[^"]*\bstart=\d+[^"]*)"/gi;

/** Qui s'appelle comment, d'après une page de `/memberlist`.
 *
 *  LES DOUBLONS NE SONT PAS UNE ERREUR : la même page peut nommer un
 *  membre deux fois — une fois dans la ligne, une fois ailleurs si le
 *  gabarit change. Le dernier vu gagne, et c'est sans conséquence
 *  puisque c'est le même nom.
 *
 *  UN NOM VIDE EST ÉCARTÉ. Un `<a>` sans texte arrive quand le gabarit
 *  pose une image à la place du nom, et renommer quelqu'un « rien »
 *  serait pire que de le laisser vieux d'une heure. */
export function pseudosDeLaListe(code: string): Map<number, string> {
  const table = new Map<number, string>();
  for (const m of code.matchAll(LIGNE)) {
    const id = Number(m[1]);
    if (!Number.isInteger(id) || id <= 0) continue;
    //  ON ENLÈVE L'ENVELOPPE, PAS LE NOM : `{USERNAME}` arrive dans un
    //  `span` de couleur de groupe, souvent avec un `strong` dedans.
    const nom = decoderLesEntites(m[2].replace(/<[^>]*>/g, "")).trim();
    if (nom === "") continue;
    table.set(id, nom);
  }
  return table;
}

/** Les adresses des pages suivantes, sans doublon et sans la courante.
 *
 *  On SUIT LES LIENS DU FORUM plutôt que de deviner un pas. Mesuré le
 *  16 novembre : `?start=50` répond 200 avec zéro membre, donc un pas
 *  deviné de 50 sauterait la moitié des membres si le forum en affiche
 *  25 par page. Les liens, eux, disent la vérité quelle que soit la
 *  taille de page réglée dans le panneau d'administration. */
export function pagesDeLaListe(code: string): string[] {
  const vues = new Set<string>();
  for (const m of code.matchAll(PAGE)) {
    const u = decoderLesEntites(m[1]);
    //  `start=0`, c'est la page qu'on vient de lire.
    if (/\bstart=0\b/.test(u)) continue;
    vues.add(u);
  }
  return [...vues];
}
