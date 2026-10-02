/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  js/wild-mystery.ts
//
//  LA RACINE DE COMPOSITION DU NAVIGATEUR. C'est le pendant de
//  `supabase/functions/releve/index.ts` : le seul fichier côté navigateur
//  où l'on écrit `new …`, et il ne contient aucune règle.
//
//  Ce qu'il fait, dans l'ordre et pour une raison :
//
//  1. **Le thème, avant tout le reste.** Chaque milliseconde de retard se
//     voit comme un éclair blanc chez un joueur en thème sombre. On ne
//     l'attend donc pas : ni `DOMContentLoaded`, ni la session, ni rien.
//  2. **Le marqueur, caché.** `[[WM:…]]` dans un message est un détail de
//     plomberie que les joueurs n'ont pas à lire. On le masque, on ne le
//     retire pas : c'est lui qui permet de reconnaître un bilan déjà
//     posté après une coupure réseau.
//  3. **Le coin d'outils**, une fois le corps de page disponible.
//
//  SANS CE FICHIER, LE FORUM RESTE ENTIER : thème clair, marqueur visible
//  mais inoffensif, pas de bloc en bas à droite. Rien ne casse.
// ════════════════════════════════════════════════════════════════════

import { Preferences } from "../src/navigateur/preferences.ts";
import { StockageLocal } from "../src/adaptateurs/navigateur/stockage.ts";
import { CoinOutils } from "../src/adaptateurs/navigateur/coin-outils.ts";
import { masquerLesMarqueurs } from "../src/adaptateurs/navigateur/marqueurs.ts";
import { BrouillonForumactif } from "../src/adaptateurs/navigateur/editeur.ts";
import { BarreDActions } from "../src/adaptateurs/navigateur/barre-d-actions.ts";

const prefs = new Preferences(new StockageLocal());
const coin = new CoinOutils(document, prefs);

//  Le `<body>` existe dès que notre script s'exécute si le `<script>` est
//  placé en fin de corps ; on se garde du cas contraire sans attendre
//  inutilement dans le cas normal.
function desQueLeCorpsEstLa(faire: () => void): void {
  if (document.body) faire();
  else document.addEventListener("DOMContentLoaded", faire, { once: true });
}

/** La barre d'actions, s'il y a un formulaire de réponse sur cette page.
 *  La plupart des pages n'en ont pas, et c'est le cas normal : on ne
 *  cherche pas plus loin, on ne signale rien. */
function poserLaBarre(): void {
  const brouillon = BrouillonForumactif.surLaPage(document);
  if (brouillon === null) return;
  const formulaire = document.querySelector("#quick_reply") ??
    document.querySelector("form[name=post]");
  if (formulaire === null) return;
  new BarreDActions(document, brouillon).poser(formulaire);
}

desQueLeCorpsEstLa(() => {
  coin.appliquerLeTheme();
  masquerLesMarqueurs(document);
  coin.poser();
  poserLaBarre();
});
