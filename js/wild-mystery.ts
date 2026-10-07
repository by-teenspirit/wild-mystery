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
import { poserLaBoutique } from "../src/adaptateurs/navigateur/module-boutique.ts";
import { JournalDistant } from "../src/adaptateurs/navigateur/journal.ts";
import { poserLaVieDeRhode } from "../src/adaptateurs/navigateur/module-vie.ts";
import { poserLeSommaire } from "../src/adaptateurs/navigateur/module-annexes.ts";
import {
  poserLaNavigation,
  remplirLesPersonnages,
} from "../src/adaptateurs/navigateur/module-navigation.ts";
import { poserLeSwitcheroo } from "../src/adaptateurs/navigateur/module-switcheroo.ts";
import { sourceDAvatar } from "../src/navigateur/navigation.ts";
import {
  compterLesMessages,
  poserLAccessibilite,
  poserLesNotifications,
} from "../src/adaptateurs/navigateur/module-confort.ts";

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

/** La configuration Supabase servie dans `data/` : l'URL et la clé
 *  publiable, bornée par les politiques RLS, et rien d'autre.
 *
 *  **La clé de service ne sort jamais de Supabase** (garde-fou n° 10).
 *  Lue par les deux modules qui parlent à la base ; une panne rend null,
 *  et le module concerné ne se pose pas. */
async function configSupabase(): Promise<ReturnType<typeof configDepuis>> {
  if (RACINE === null) return null;
  const reponse = await fetch(`${RACINE}supabase.json`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return configDepuis(reponse);
}

/** La barre de navigation, le panneau latéral et le menu du compte.
 *
 *  **Deux barres, tenues séparément** : la barre normale
 *  (`#modernbb-nav-menu`) porte le logo et les cinq liens ; la barre
 *  Forumactif (`#fa_toolbar`) porte le compte et les notifications. La
 *  seconde arrive après nous, le module la guette.
 *
 *  Elle part sur TOUTES les pages — c'est le cadre du forum. */
async function poserLaNav(messages: number): Promise<void> {
  if (RACINE === null) return;
  const donnees = await fetch(`${RACINE}navigation.json`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  //  `_userdata` est posé par Forumactif sur chaque page. Déconnectée,
  //  `session_logged_in` vaut 0 : il n'y a pas de compte, donc pas de
  //  menu — et surtout aucun identifiant à inventer.
  poserLaNavigation({
    doc: document,
    donnees,
    identifiant: identifiantDuCompte(),
    avatar: avatarDuCompte(),
    pseudo: pseudoDuCompte(),
    messages,
  });
}

/** Le pseudo du compte connecté, ou null.
 *
 *  Lu dans `_userdata` et pas dans le libellé de la barre Forumactif :
 *  celui-ci change avec la langue du forum. */
function pseudoDuCompte(): string | null {
  const u = (globalThis as unknown as { _userdata?: Record<string, unknown> })._userdata;
  const n = typeof u?.username === "string" ? u.username.replace(/\s+/g, " ").trim() : "";
  return n === "" ? null : n;
}

/** La source de l'avatar du compte connecté, ou null.
 *
 *  `_userdata.avatar` contient du HTML, pas une adresse : on en tire la
 *  source et on fabrique notre propre `<img>`. Le fragment lui-même
 *  n'entre jamais dans la page. */
function avatarDuCompte(): string | null {
  const u = (globalThis as unknown as { _userdata?: Record<string, unknown> })._userdata;
  return sourceDAvatar(u?.avatar);
}

/** L'identifiant Forumactif du compte connecté, ou null.
 *
 *  `_userdata` est posé par Forumactif sur chaque page. Déconnectée,
 *  `session_logged_in` vaut 0 : il n'y a pas de compte, donc pas de
 *  menu — et surtout aucun identifiant à inventer. */
function identifiantDuCompte(): number | null {
  const u = (globalThis as unknown as { _userdata?: Record<string, unknown> })._userdata;
  return u !== undefined && Number(u.session_logged_in) === 1 &&
      Number.isInteger(Number(u.user_id))
    ? Number(u.user_id)
    : null;
}

function estConnectee(): boolean {
  return identifiantDuCompte() !== null;
}

/** Le sommaire des douze annexes, posé dans le trou que la page laisse.
 *
 *  **La porte d'entrée est le nœud `[data-wm-sommaire]`**, pas une liste
 *  d'adresses : Callista peut créer une treizième annexe sans qu'on
 *  touche au code. Le module sort tout de suite sur les autres pages, et
 *  ne demande le fichier que s'il a un trou à remplir — une page de forum
 *  ne doit pas payer une requête pour rien. */
async function poserLesAnnexes(): Promise<void> {
  if (RACINE === null) return;
  if (document.querySelector("[data-wm-sommaire]") === null) return;
  const donnees = await fetch(`${RACINE}annexes.json`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  poserLeSommaire({ doc: document, donnees });
}

/** L'encart « La vie de Rhode », sur l'index et nulle part ailleurs.
 *
 *  Il ne demande NI zone NI catalogue : une seule requête, et il décide
 *  lui-même s'il a quelque chose à afficher. Il part donc en parallèle du
 *  reste, et il ne se pose pas si le journal est vide — un forum neuf n'a
 *  rien à raconter, et un cadre vide dirait que la région est morte. */
async function poserLaVie(): Promise<void> {
  const config = await configSupabase();
  if (config === null) return;
  await poserLaVieDeRhode({ doc: document, journal: new JournalDistant(config) });
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

  const config = await configSupabase();
  if (config === null) return;

  //  Le brouillon, s'il y en a un. **Absent est fréquent et normal** : un
  //  visiteur déconnecté, un sujet verrouillé. Le module s'affiche quand
  //  même — il se lit —, simplement sans bouton de clôture.
  await poserLeBilan({
    doc: document,
    registre: new RegistreDistant(config),
    catalogue,
    brouillon: BrouillonForumactif.surLaPage(document),
  });
}

desQueLeCorpsEstLa(() => {
  coin.appliquerLeTheme();
  masquerLesMarqueurs(document);
  coin.poser();
  //  La boutique ne demande NI réseau NI zone : elle lit son catalogue
  //  dans le message qui est déjà sous les yeux du joueur. Elle part
  //  donc tout de suite, et elle ne fait rien du tout si la page n'a pas
  //  de `.wm-boutique` — ce qui est le cas de tout le forum sauf un
  //  sujet.
  poserLaBoutique({
    doc: document,
    brouillon: BrouillonForumactif.surLaPage(document),
  });
  //  La barre attend deux fichiers : elle arrive donc après le reste, et
  //  c'est voulu. Une panne de réseau ne doit priver que d'elle — d'où le
  //  `catch` qui ne fait rien de plus que l'empêcher de remonter.
  poserLaBarre().catch(() => {});
  poserLeModule().catch(() => {});
  poserLaVie().catch(() => {});
  poserLesAnnexes().catch(() => {});
  //  LE COMPTEUR SE LIT AVANT QUE LA BARRE SOIT RÉÉCRITE. Forumactif le
  //  pose dans le lien « Messagerie », et `poserLaNav` remplace le
  //  contenu de cette barre : lu après, il vaudrait toujours zéro.
  const messages = compterLesMessages(document);
  poserLaNav(messages).catch(() => {});
  //  Le switcheroo, chargé depuis sa source et épinglé à un commit. Il
  //  remplit « Mes personnages » ; sans lui la section ne s'affiche pas.
  //
  //  **On relit le panneau quand il a fini de se dessiner.** Il arrive
  //  après la barre, et un panneau déjà ouvert à ce moment-là — ou laissé
  //  ouvert d'un clic rapide — montrerait une section vide.
  poserLeSwitcheroo(document, estConnectee())
    .then((pose) => {
      const panneau = document.querySelector("#wm-panneau");
      if (pose && panneau !== null) remplirLesPersonnages(document, panneau);
    })
    .catch(() => {});
  //  Les trois réglages de confort s'ajoutent au coin d'outils, qui vient
  //  d'être posé juste au-dessus. Pas de second bloc flottant.
  poserLAccessibilite(document, prefs);
  poserLesNotifications({ doc: document, messages });
});
