/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-theme-annexe.ts
//
//  COUVERT PAR : outils/contraste.mjs — le bouton posé sur chaque page
//  collée, et le thème appliqué dans les deux sens.
//
//  LE BOUTON DE THÈME, SUR UNE PAGE QUI N'A PAS LE FORUM.
//
//  Sur le forum, il vit dans le coin d'outils que `coin-outils.ts`
//  monte à droite de l'écran. Une annexe n'a ni ce coin ni la barre
//  qui le porte : « est-ce que tu peux effectivement rajouter le dark
//  mode ».
//
//  ── CE QU'ON NE REFAIT PAS ──────────────────────────────────────────
//
//  La règle de thème est dans `src/navigateur/theme.ts` et le stockage
//  dans `preferences.ts`, avec la clé `wm.theme`. On s'en sert tels
//  quels : les annexes sont servies par forumactif.com, la même origine
//  que le forum, donc **le choix d'un joueur le suit d'un côté à
//  l'autre**. Un second mécanisme aurait donné deux réglages qui se
//  contredisent.
//
//  TROIS ÉTATS, PAS DEUX, comme ailleurs : tant que personne n'a
//  cliqué, la page suit le réglage de la machine ; au premier clic le
//  choix devient explicite et ne bouge plus.
//
//  ── LE BOUTON EST POSÉ PAR LE SCRIPT, PAS PAR LA PAGE ───────────────
//
//  Il pourrait être dans le HTML collé. Mais un bouton de thème sans
//  JavaScript ne fait rien, et surtout : posé ici, il arrive sur les
//  quatorze pages sans qu'on en recolle une seule.
// ════════════════════════════════════════════════════════════════════
import {
  choixApresClic,
  CLASSE_SOMBRE,
  destination,
  type Theme,
  themeApplique,
} from "../../navigateur/theme.ts";
import { Preferences } from "../../navigateur/preferences.ts";
import { lune, soleil } from "./coin-outils.ts";

const CLASSE_BOUTON = "wm-retour__theme";

function systemeEstSombre(): boolean {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function appliquer(doc: Document, theme: Theme): void {
  doc.body?.classList.toggle(CLASSE_SOMBRE, theme === "sombre");
}

/** Le mot du bouton annonce SA DESTINATION, pas l'état courant : un
 *  bouton nomme son effet, sinon la moitié des gens cliquent dans le
 *  mauvais sens. Même règle que le coin d'outils du forum. */
function libelle(applique: Theme): string {
  return destination(applique) === "sombre" ? "Sombre" : "Clair";
}

export function poserLeTheme(doc: Document, prefs: Preferences): boolean {
  const barre = doc.querySelector(".wm-retour");
  if (barre === null) return false;
  if (barre.querySelector(`.${CLASSE_BOUTON}`) !== null) return false;

  const rendre = (): Theme => {
    const t = themeApplique(prefs.theme(), systemeEstSombre());
    appliquer(doc, t);
    return t;
  };

  const bouton = doc.createElement("button");
  bouton.type = "button";
  bouton.className = `wm-retour__lien ${CLASSE_BOUTON}`;

  //  IL PORTE UNE ICÔNE, ET C'EST POUR ÇA QU'ON LE VOIT. « Je vois pas
  //  le dark mode » : le bouton était là depuis le début, posé entre
  //  Personnages et Messagerie, et il ne disait rien d'autre que
  //  « Sombre » dans la même police et la même couleur que les trois
  //  liens d'à côté. On le lisait comme une quatrième page.
  //
  //  La lune et le soleil viennent du coin d'outils du forum : c'est
  //  le même bouton pour le joueur, il n'a pas à apprendre deux
  //  dessins pour le même geste.
  const habiller = () => {
    const t = rendre();
    const mot = libelle(t);
    bouton.textContent = "";
    bouton.appendChild(destination(t) === "sombre" ? lune(doc) : soleil(doc));
    bouton.appendChild(doc.createTextNode(mot));
    bouton.setAttribute("aria-label", `Passer en thème ${mot.toLowerCase()}`);
  };
  habiller();

  bouton.addEventListener("click", () => {
    prefs.poserTheme(choixApresClic(prefs.theme(), systemeEstSombre()));
    habiller();
  });

  barre.appendChild(bouton);
  return true;
}
