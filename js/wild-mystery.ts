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
import {
  adresseDuScript,
  CatalogueDistant,
  forumDeLaPage,
  racineDesDonnees,
} from "../src/adaptateurs/navigateur/catalogue.ts";
import { zoneDe } from "../src/navigateur/zone.ts";
import { configDepuis, RegistreDistant } from "../src/adaptateurs/navigateur/registre.ts";
import { poserLeBilan } from "../src/adaptateurs/navigateur/module-bilan.ts";

const prefs = new Preferences(new StockageLocal());
const coin = new CoinOutils(document, prefs);

//  LU TOUT DE SUITE, et pas plus tard : `document.currentScript` n'est
//  renseigné que pendant l'exécution initiale du script. Après le premier
//  `await` il vaut null, et la racine des données serait introuvable.
const RACINE = racineDesDonnees(adresseDuScript(document));

//  Le `<body>` existe dès que notre script s'exécute si le `<script>` est
//  placé en fin de corps ; on se garde du cas contraire sans attendre
//  inutilement dans le cas normal.
function desQueLeCorpsEstLa(faire: () => void): void {
  if (document.body) faire();
  else document.addEventListener("DOMContentLoaded", faire, { once: true });
}

/** La barre d'actions, s'il y a un formulaire de réponse **et** si on est
 *  dans une zone sauvage.
 *
 *  LES DEUX CONDITIONS SONT DES CAS NORMAUX quand elles ne sont pas
 *  remplies : la plupart des pages n'ont pas de formulaire, et la
 *  plupart des forums ne sont pas des zones. On ne signale rien, on ne
 *  cherche pas plus loin.
 *
 *  La règle 4 de la planche 45 : le module n'existe que dans les
 *  dix-sept zones. Un bouton ailleurs écrirait un bloc que la relève ne
 *  lirait jamais — elle ne parcourt que les zones — et le joueur
 *  n'aurait aucun moyen de comprendre pourquoi rien ne se passe. */
async function poserLaBarre(): Promise<void> {
  const brouillon = BrouillonForumactif.surLaPage(document);
  if (brouillon === null) return;
  const formulaire = document.querySelector("#quick_reply") ??
    document.querySelector("form[name=post]");
  if (formulaire === null) return;
  if (RACINE === null) return;

  const catalogue = new CatalogueDistant(RACINE);
  const zone = zoneDe(forumDeLaPage(document), await catalogue.zones());
  if (zone === null) return;

  //  Sept zones n'ont pas encore de table : la barre se pose quand même,
  //  sans la rangée « chercher ». Fouiller et clôturer y marchent.
  const lieux = await catalogue.lieuxDe(zone.forumId);
  new BarreDActions(document, brouillon, lieux).poser(formulaire);
}

/** Le module de bilan, au-dessus du premier message d'un sujet de zone.
 *
 *  MÊME PORTE QUE LA BARRE, et pour la même raison : la règle 4 de la
 *  planche 45. Le registre ne contient que des zones, et un module
 *  ailleurs montrerait toujours un cadre vide.
 *
 *  Il lit la configuration Supabase dans `data/` — la clé publiable,
 *  bornée par les politiques RLS, et rien d'autre. */
async function poserLeModule(): Promise<void> {
  if (RACINE === null) return;

  const catalogue = new CatalogueDistant(RACINE);
  const zone = zoneDe(forumDeLaPage(document), await catalogue.zones());
  if (zone === null) return;

  const reponse = await fetch(`${RACINE}supabase.json`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const config = configDepuis(reponse);
  if (config === null) return;

  await poserLeBilan({
    doc: document,
    registre: new RegistreDistant(config),
    catalogue,
  });
}

desQueLeCorpsEstLa(() => {
  coin.appliquerLeTheme();
  masquerLesMarqueurs(document);
  coin.poser();
  //  La barre attend deux fichiers : elle arrive donc après le reste, et
  //  c'est voulu. Une panne de réseau ne doit priver que d'elle — d'où le
  //  `catch` qui ne fait rien de plus que l'empêcher de remonter.
  poserLaBarre().catch(() => {});
  poserLeModule().catch(() => {});
});
