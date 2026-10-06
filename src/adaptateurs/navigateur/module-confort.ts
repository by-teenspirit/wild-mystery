/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-confort.ts
//
//  Deux choses sans maquette, faites au plus simple : les trois
//  interrupteurs d'accessibilité, et l'encart de notifications.
//
//  ── L'ACCESSIBILITÉ S'AJOUTE AU COIN D'OUTILS ───────────────────────
//
//  Elle ne prend PAS un second bloc flottant. Il y en a déjà un en bas à
//  droite, avec le thème et les flèches ; deux coins d'outils sur un même
//  écran, c'est un de trop, et le joueur chercherait le réglage dans
//  celui qui ne l'a pas.
//
//  Les trois réglages **s'ajoutent** aux préférences du système, ils ne
//  les remplacent pas : `prefers-reduced-motion` continue de valoir. Ils
//  servent à qui n'a pas la main sur son navigateur — un poste partagé,
//  un ordinateur de travail.
//
//  ── L'ENCART NE S'AFFICHE QUE S'IL A QUELQUE CHOSE À DIRE ───────────
//
//  Il ne lit **que ce que le forum écrit déjà** : le compteur de messages
//  privés, là où Forumactif le pose. Aucun nombre n'est deviné, aucun
//  appel réseau n'est fait.
//
//  Et si ce compteur est à zéro, **rien ne flotte**. « 0 message non lu »
//  n'est pas une notification, et un bloc permanent qui n'apprend rien
//  coûte un coin d'écran à tout le monde, tous les jours.
//
//  ── IL FAUT LE LIRE AVANT DE RÉÉCRIRE LA BARRE ──────────────────────
//
//  Le compteur vit dans le lien « Messagerie » de la barre, et
//  `module-navigation` réécrit cette barre. D'où `compterLesMessages`,
//  appelée AVANT — c'est une dépendance d'ordre, et c'est écrit ici
//  parce qu'elle ne se voit pas dans les types.
// ════════════════════════════════════════════════════════════════════

import {
  basculerConfort,
  CLASSE_DE_CONFORT,
  type Compteur,
  type Confort,
  CONFORTS,
  type Encart,
  encartDepuis,
  LIBELLE_DE_CONFORT,
  phraseDeCompteur,
} from "../../navigateur/confort.ts";
import type { Preferences } from "../../navigateur/preferences.ts";

function element(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

// ── les trois interrupteurs ─────────────────────────────────────────

/** Pose les classes de confort sur `body`.
 *
 *  Appelée au chargement ET à chaque bascule : c'est le seul endroit qui
 *  décide de l'apparence, donc les deux ne peuvent pas diverger. */
export function appliquerLesConforts(doc: Document, actifs: readonly Confort[]): void {
  for (const c of CONFORTS) {
    doc.body?.classList.toggle(CLASSE_DE_CONFORT[c], actifs.includes(c));
  }
}

/**
 * Ajoute les trois interrupteurs au coin d'outils, et rend le bloc posé.
 *
 * Rend `null` si le coin n'existe pas : il est posé par `CoinOutils`, et
 * sans lui il n'y a nulle part où les mettre. On n'en crée pas un second.
 */
export function poserLAccessibilite(
  doc: Document,
  prefs: Preferences,
): HTMLElement | null {
  const coin = doc.querySelector(".wm-coin");
  if (coin === null) return null;

  const bloc = element(doc, "div", "wm-coin__confort");
  //  Un groupe nommé : sans ça, un lecteur d'écran annonce trois
  //  interrupteurs qui ne disent pas de quoi ils règlent l'affichage.
  bloc.setAttribute("role", "group");
  bloc.setAttribute("aria-label", "Confort de lecture");

  const boutons = new Map<Confort, HTMLButtonElement>();
  const rafraichir = (actifs: readonly Confort[]): void => {
    appliquerLesConforts(doc, actifs);
    for (const [c, b] of boutons) {
      const coche = actifs.includes(c);
      b.setAttribute("aria-pressed", String(coche));
      b.classList.toggle("wm-coin__confort--coche", coche);
    }
  };

  for (const c of CONFORTS) {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "wm-coin__bouton wm-coin__confort-bouton";
    //  Le libellé EST le texte du bouton, pas seulement un `title` : une
    //  infobulle ne se lit ni au doigt ni au clavier.
    b.appendChild(element(doc, "span", "wm-coin__texte", LIBELLE_DE_CONFORT[c]));
    b.addEventListener("click", () => {
      const suivant = basculerConfort(prefs.conforts(), c);
      prefs.poserConforts(suivant);
      rafraichir(suivant);
    });
    boutons.set(c, b);
    bloc.appendChild(b);
  }

  coin.appendChild(bloc);
  rafraichir(prefs.conforts());
  return bloc;
}

// ── l'encart de notifications ───────────────────────────────────────

/**
 * Le nombre de messages privés non lus, lu dans la page.
 *
 * **À appeler AVANT que la barre soit réécrite** : Forumactif pose ce
 * compteur dans le lien « Messagerie », et `module-navigation` remplace
 * le contenu de cette barre.
 *
 * Rend `0` quand il n'y a rien à lire — jamais une estimation.
 */
export function compterLesMessages(doc: Document): number {
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('a[href*="/privmsg"]')) {
    const texte = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
    //  Forumactif écrit « Messagerie 3 » ou « Messages (3) » selon le
    //  template. On prend le dernier nombre de la ligne, et seulement
    //  s'il y en a un : un lien sans compteur n'est pas un compteur à
    //  zéro, c'est l'absence d'information.
    const trouve = /(\d{1,4})\s*\)?\s*$/.exec(texte);
    if (trouve !== null) return Number(trouve[1]);
  }
  return 0;
}

function ligneDeCompteur(doc: Document, c: Compteur): HTMLElement {
  const li = element(doc, "li", "wm-notifs__ligne");
  const a = doc.createElement("a");
  a.className = "wm-notifs__lien";
  a.href = c.adresse;
  a.appendChild(element(doc, "span", "wm-notifs__nombre", String(c.nombre)));
  //  Le nombre est écrit deux fois : une fois en gros pour l'œil, une
  //  fois dans la phrase pour qui écoute. `aria-hidden` sur la pastille
  //  évite de l'entendre bégayer.
  a.firstElementChild?.setAttribute("aria-hidden", "true");
  a.appendChild(element(doc, "span", "wm-notifs__phrase", phraseDeCompteur(c)));
  li.appendChild(a);
  return li;
}

export type DependancesDesNotifs = {
  readonly doc: Document;
  /** Le nombre de messages non lus, relevé AVANT la réécriture de la barre. */
  readonly messages: number;
};

/**
 * Pose l'encart flottant, et rend `true` s'il a été posé.
 *
 * Il n'est pas posé quand il n'y a rien à annoncer, et c'est le
 * comportement voulu.
 */
export function poserLesNotifications(
  { doc, messages }: DependancesDesNotifs,
): boolean {
  const encart: Encart = encartDepuis(
    [{
      titre: "message non lu",
      pluriel: "messages non lus",
      nombre: messages,
      adresse: "/privmsg",
    }],
    [
      { titre: "Nouveaux messages", adresse: "/search?search_id=newposts" },
      { titre: "Sujets sans réponse", adresse: "/search?search_id=unanswered" },
    ],
  );
  if (encart.compteurs.length === 0) return false;

  const bloc = element(doc, "aside", "wm-notifs");
  bloc.setAttribute("aria-label", "Ce qui t'attend");

  const liste = element(doc, "ul", "wm-notifs__liste");
  for (const c of encart.compteurs) liste.appendChild(ligneDeCompteur(doc, c));
  bloc.appendChild(liste);

  if (encart.raccourcis.length > 0) {
    const pied = element(doc, "p", "wm-notifs__raccourcis");
    for (const r of encart.raccourcis) {
      const a = doc.createElement("a");
      a.className = "wm-notifs__raccourci";
      a.href = r.adresse;
      a.textContent = r.titre;
      pied.appendChild(a);
    }
    bloc.appendChild(pied);
  }

  //  Il se ferme. Un encart qu'on ne peut pas écarter est une bannière.
  const fermer = doc.createElement("button");
  fermer.type = "button";
  fermer.className = "wm-notifs__fermer";
  fermer.setAttribute("aria-label", "Masquer");
  fermer.textContent = "✕";
  fermer.addEventListener("click", () => bloc.remove());
  bloc.appendChild(fermer);

  doc.body?.appendChild(bloc);
  return true;
}
