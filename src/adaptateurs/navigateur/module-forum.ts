/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-forum.ts
//
//  COUVERT PAR : outils/zone.mjs — la vraie page d'un forum montée dans
//  un navigateur, avec et sans sous-forums.
//  (Garde-fou n° 22 : un module d'interface sans test unitaire doit dire
//   quel harnais le monte, et ce harnais doit tourner dans le CI.)
//
//  Le préambule que Forumactif pose avant notre gabarit.
//
//  ── CE QU'ON A MESURÉ, LE 27 OCTOBRE ───────────────────────────────
//
//  « Les catégories sont cassées et les sujets s'affichent en double »,
//  sur `/f2-notice-d-utilisation`. Relevé sur le forum, connectée :
//
//  | forum                   | sous-forums | sujets en double |
//  | f2  Notice d'utilisation|     oui     |       OUI        |
//  | f18 Station Service     |     oui     |       OUI        |
//  | f56 Les informations    |     non     |       non        |
//  | f19 Arène Feu           |     non     |       non        |
//  | f36 Steppes Arides      |     non     |       non        |
//
//  La règle est là : **un forum qui a des sous-forums reçoit, AVANT
//  notre gabarit, un bloc d'index complet** — `div.forabg` (les
//  sous-forums), `ul.linklist.top`, puis `div.forumbg` qui répète la
//  liste des sujets. Ce préambule est posé par Forumactif lui-même ; il
//  ne vient pas de `viewforum_body`, et retirer `{BOARD_INDEX}` de ce
//  gabarit n'y a rien changé — vérifié après publication.
//
//  Il tombe hors de `.wm-forum`, donc :
//  · la copie des sujets s'affiche nue, sans rien de notre feuille —
//    « les catégories sont cassées », c'est elle ;
//  · et les sujets se lisent deux fois.
//
//  ── CE QU'ON EN FAIT ───────────────────────────────────────────────
//
//  On ne jette pas tout : la liste des sous-forums est la SEULE source
//  de l'arène, du colosseum et du marché sur une page de ville. On la
//  garde, on la range dans la mise en page, et on ne jette que ce qui
//  est en double.
//
//  Sans ce fichier, la page reste lisible : les sujets y sont deux
//  fois, le premier bloc sans style. C'est laid, ce n'est pas cassé.
// ════════════════════════════════════════════════════════════════════

/** Posée sur le corps quand le préambule a été rangé. Elle ne sert à
 *  rien d'autre qu'à le dire : aucune règle de la feuille ne s'y
 *  accroche, et un test s'en sert pour distinguer « il n'y avait rien
 *  à ranger » de « on n'a pas tourné ». */
export const CLASSE_RANGEE = "wm-forum-range";

export type Rangement = {
  /** Les blocs de sujets en double qu'on a retirés. */
  readonly doublons: number;
  /** Les listes de sous-forums remontées dans la mise en page. */
  readonly remontes: number;
};

/**
 * Range le préambule de Forumactif sur une page de forum.
 *
 * Ne fait rien du tout hors d'une page de forum — c'est `.wm-forum`,
 * posée par `viewforum_body`, qui sert de clé. L'index n'en a pas, et
 * le préambule y est la page elle-même : s'y attaquer la viderait.
 *
 * Idempotent : la classe de corps arrête le second passage.
 */
export function rangerLePreambuleDuForum(doc: Document): Rangement {
  const rien = { doublons: 0, remontes: 0 };

  const forum = doc.querySelector(".wm-forum");
  if (forum === null) return rien;

  const corps = doc.querySelector("#modernbb") ?? doc.body;
  if (corps !== null && corps.classList.contains(CLASSE_RANGEE)) return rien;

  //  LA SECTION OÙ TOUT DOIT FINIR. Si le gabarit a changé et qu'elle
  //  n'existe plus, on ne déplace rien : mieux vaut un préambule mal
  //  placé qu'une liste de sous-forums jetée au hasard dans la page.
  const section = forum.querySelector(".wm-forum__section");

  //  ── LA GARDE QUI COMPTE ────────────────────────────────────────
  //
  //  On ne retire un bloc de sujets que s'il en reste un DANS notre
  //  mise en page. Sur un forum sans sous-forum il n'y a pas de
  //  préambule du tout, et sur une page qu'on n'a pas prévue, cette
  //  condition est fausse : on ne touche à rien plutôt que de faire
  //  disparaître la seule liste de sujets de la page.
  const dedans = forum.querySelectorAll(".forumbg").length;
  const dehors = [...doc.querySelectorAll(".forumbg")].filter((b) => !forum.contains(b));

  let doublons = 0;
  if (dedans > 0) {
    for (const bloc of dehors) {
      bloc.remove();
      doublons++;
    }
  }

  //  ── LES SOUS-FORUMS REMONTENT, ILS NE DISPARAISSENT PAS ────────
  //
  //  Ils portent déjà leur propre titre — `li.header` dit « NOTICE
  //  D'UTILISATION », « STATION SERVICE » — donc on ne leur invente
  //  pas de bande : on les pose avant la section des sujets, dans
  //  `.wm-forum`, et ils prennent le cadre comme le reste.
  let remontes = 0;
  for (const bloc of [...doc.querySelectorAll(".forabg")].filter((b) => !forum.contains(b))) {
    if (section === null) break;
    section.parentNode?.insertBefore(bloc, section);
    remontes++;
  }

  //  La barre de liens que le préambule traîne derrière lui : elle
  //  répète « Nouveau sujet » et le fil d'Ariane, que notre gabarit
  //  pose déjà plus bas. On ne la retire que si elle est restée
  //  orpheline, hors de `.wm-forum`.
  if (doublons > 0 || remontes > 0) {
    for (const liste of doc.querySelectorAll("ul.linklist")) {
      if (!forum.contains(liste)) liste.remove();
    }
  }

  if (doublons > 0 || remontes > 0) corps?.classList.add(CLASSE_RANGEE);
  return { doublons, remontes };
}
