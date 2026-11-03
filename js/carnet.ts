/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  js/carnet.ts — le troisième paquet, et il ne sert qu'à une page
//
//  POURQUOI PAS `wild-mystery.js`. Même raison que pour les annexes :
//  `/h15-mon-carnet` est créée SANS l'en-tête du forum, donc sans
//  jQuery, sans `_userdata`, sans les scripts de la Gestion des codes.
//  Et le gros paquet réécrit une barre d'outils qui n'existe pas ici,
//  pose le tchat, les territoires — et monte le switcheroo, qui écrit
//  des mots de passe dans le navigateur. Il n'a rien à faire sur cette
//  page.
//
//  POURQUOI PAS `annexes.js` NON PLUS. Celui-là ne sait poser qu'un
//  sommaire. Le carnet demande un appel à Supabase, une clé gardée et
//  trois vues : c'est un autre métier, et le mélanger ferait payer aux
//  quatorze annexes le poids du carnet.
//
//  ── L'ORDRE, ET IL COMPTE ───────────────────────────────────────────
//
//  1. Le thème, tout de suite : chaque milliseconde de retard est un
//     éclair blanc chez quelqu'un en thème sombre.
//  2. Les onglets, avant même d'avoir des données : la page doit
//     répondre au clic pendant que ça charge.
//  3. QUI REGARDE. La page est servie sans l'en-tête du forum, donc
//     sans `_userdata` : on demande une page du forum sur la même
//     origine et on y lit le membre connecté. Invité, on le dit et on
//     s'arrête — aucune requête de jeu.
//  4. Un seul appel, puis les trois vues peintes d'un coup.
//
//  ── IL N'Y A PLUS DE CLÉ ────────────────────────────────────────────
//
//  « En principe, ça devrait être automatique. Pas de sujet d'ouverture
//  ou quoi », 3 novembre. La page ne demande plus rien et ne garde plus
//  rien : elle lit le numéro de compte et l'envoie. Ce que ça coûte est
//  écrit dans l'en-tête de la migration 0026, et ce n'est pas rien.
//  La machinerie de la clé reste en base, inemployée.
// ════════════════════════════════════════════════════════════════════
import {
  type Decor,
  direLeSouci,
  poserLaBarre,
  poserLesOnglets,
  poserLEtat,
  poserMonJeu,
  poserMonPokedex,
  poserMonSac,
} from "../src/adaptateurs/navigateur/module-carnet.ts";
import { poserLeTheme } from "../src/adaptateurs/navigateur/module-theme-annexe.ts";
import { Preferences } from "../src/navigateur/preferences.ts";
import { StockageLocal } from "../src/adaptateurs/navigateur/stockage.ts";
import {
  adresseDuScript,
  especesDepuis,
  racineDesDonnees,
  racineDesImages,
} from "../src/adaptateurs/navigateur/catalogue.ts";
import { appeler, RefusSupabase } from "../src/adaptateurs/navigateur/supabase.ts";
import { configDepuis } from "../src/adaptateurs/navigateur/registre.ts";
import type { Carnet } from "../src/navigateur/carnet.ts";
import {
  compteQuiRegarde,
  demandeurDuNavigateur,
} from "../src/adaptateurs/navigateur/compte-du-forum.ts";

const RACINE = racineDesDonnees(adresseDuScript(document));
const IMAGES = racineDesImages(adresseDuScript(document));

poserLeTheme(document, new Preferences(new StockageLocal()));

async function lire(nom: string): Promise<unknown> {
  if (RACINE === null) return null;
  return await fetch(`${RACINE}${nom}`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

async function decorDuCarnet(): Promise<Decor> {
  const [especes, objets, arenes, dex, groupes] = await Promise.all([
    lire("especes.json"),
    lire("objets.json"),
    lire("arenes.json"),
    lire("pokedex-carnet.json"),
    lire("groupes.json"),
  ]);
  const liste = (d: unknown, clef: string): unknown[] => {
    if (typeof d !== "object" || d === null) return [];
    const v = (d as Record<string, unknown>)[clef];
    return Array.isArray(v) ? v : [];
  };
  return {
    especes: especesDepuis(especes),
    objets: liste(objets, "objets") as Decor["objets"],
    arenes: liste(arenes, "arenes") as Decor["arenes"],
    pokedex: liste(dex, "especes") as Decor["pokedex"],
    zones: liste(dex, "zones") as Decor["zones"],
    groupes: liste(groupes, "groupes") as Decor["groupes"],
    images: IMAGES,
  };
}

/** Le mot qu'on montre pour un refus de la base.
 *
 *  ON NE RECOPIE PAS LE MESSAGE DE POSTGRESQL : un texte technique dans
 *  une page de jeu fait peur pour rien. */
function motDuRefus(): string {
  return "Le carnet n'a pas pu être chargé. Réessaie dans un moment.";
}

/** Le carnet du membre connecté, ou le mot qui dit pourquoi non.
 *
 *  TROIS REFUS, ET ILS NE DISENT PAS LA MÊME CHOSE :
 *
 *    · le forum ne répond pas — on ne sait pas qui regarde, et dire
 *      « connecte-toi » à quelqu'un de connecté serait faux ;
 *    · invité — il suffit de se connecter, et c'est tout ;
 *    · connecté mais sans carnet — le compte existe et n'a pas encore
 *      été validé. Rien à faire, et surtout rien à poster.
 */
async function ouvrirLeCarnet(): Promise<void> {
  poserLEtat(document, "charge");
  direLeSouci(document, "");

  let qui;
  try {
    qui = await compteQuiRegarde(demandeurDuNavigateur());
  } catch {
    poserLEtat(document, "dehors");
    direLeSouci(document, "Le forum n'a pas répondu. Recharge la page dans un moment.");
    return;
  }

  if (qui === null) {
    poserLEtat(document, "dehors");
    direLeSouci(
      document,
      "Tu n'es pas connectée au forum. Connecte-toi, puis reviens sur cette page.",
    );
    return;
  }

  const config = configDepuis(await lire("supabase.json"));
  if (config === null) {
    poserLEtat(document, "dehors");
    direLeSouci(document, "Le carnet n'a pas pu joindre le serveur de jeu.");
    return;
  }

  let brut: unknown;
  try {
    brut = await appeler(config, "carnet_du_compte", { forumUserId: qui.id });
  } catch (e) {
    //  LA RAISON PART DANS LA CONSOLE, et pas à l'écran. « Le carnet
    //  n'a pas pu être chargé » est ce qu'il faut dire à une joueuse,
    //  et c'est aussi ce qui a coûté un aller-retour le 3 novembre : la
    //  migration 0026 n'était pas passée, la base répondait « cette
    //  fonction n'existe pas », et le message ne le disait pas. Qui
    //  ouvre les outils du navigateur doit pouvoir le lire.
    console.error(
      "wm/carnet : la base a refusé —",
      e instanceof RefusSupabase ? `${e.code} (HTTP ${e.statut})` : e,
    );
    poserLEtat(document, "dehors");
    direLeSouci(document, motDuRefus());
    return;
  }

  //  `null` : LE COMPTE N'A PAS DE CARNET, et ce n'est pas une panne.
  //  La fonction rend `null` pour un compte qu'elle ne connaît pas —
  //  c'est le cas de qui n'a pas encore été validé.
  if (brut === null) {
    poserLEtat(document, "dehors");
    direLeSouci(
      document,
      `Connectée en tant que ${qui.pseudo || "ce compte"}, mais ce compte n'a pas encore ` +
        `de partie. Elle s'ouvre quand le staff valide ton personnage.`,
    );
    return;
  }

  if (typeof brut !== "object") {
    poserLEtat(document, "dehors");
    direLeSouci(document, motDuRefus());
    return;
  }

  const carnet = brut as Carnet;
  const decor = await decorDuCarnet();
  poserLaBarre(document, carnet, "mon-jeu", decor);
  poserMonJeu(document, carnet, decor);
  poserMonSac(document, carnet, decor);
  poserMonPokedex(document, carnet, decor);
  poserLEtat(document, "pret");
  //  LA BARRE SUIT L'ONGLET OUVERT, et elle ne pouvait pas le faire
  //  avant d'avoir le dresseur à écrire dedans.
  poserLesOnglets(document, (actif) => poserLaBarre(document, carnet, actif, decor));
}

//  LES ONGLETS D'ABORD, SANS DONNÉES. Cliquer doit marcher pendant que
//  ça charge, sinon la page a l'air morte.
poserLesOnglets(document, () => {});

//  ET ON OUVRE. Sans bouton, sans champ, sans clé : la page sait aller
//  chercher qui la regarde.
ouvrirLeCarnet().catch(() => {
  poserLEtat(document, "dehors");
  direLeSouci(document, motDuRefus());
});
