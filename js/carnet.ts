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
//  3. QUI REGARDE, ET AVEC QUELLE CLÉ. La page est servie sans
//     l'en-tête du forum, donc sans `_userdata` : on demande la page
//     d'édition de profil sur la même origine, et elle donne les deux.
//     Invité ou clé absente, on le dit et on s'arrête — aucune
//     requête de jeu.
//  4. Un seul appel, puis les trois vues peintes d'un coup.
//
//  ── LA CLÉ EST DANS LE PROFIL, ET LA PAGE VA LA CHERCHER ────────────
//
//  « La clé n'est pas censée être visible, l'admin la met au tout
//  début, et une fois mise, quand le joueur est validé, ça
//  fonctionne », 3 novembre.
//
//  La page ne demande donc rien à personne et ne garde rien : elle lit
//  la page d'édition de profil du membre — qui ne se charge qu'avec SA
//  session — y trouve son numéro de compte et sa clé, et ouvre son
//  carnet. Rien à coller, rien à retenir, et la clé prouve l'identité.
//
//  C'est la troisième version de cette ouverture en deux jours. Les
//  deux premières sont dans l'historique : un code à poster dans un
//  sujet, puis le numéro de compte tout nu. Celle-ci est à la fois
//  plus simple pour la joueuse et plus sûre que les deux.
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
  demandeurDuNavigateur,
  profilQuiRegarde,
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
function motDuRefus(e?: unknown): string {
  //  UNE CLÉ QUE LA BASE NE CONNAÎT PAS N'EST PAS UNE PANNE, et le
  //  geste qui la répare n'est pas le même : il faut que le staff la
  //  repose. Le dire évite d'envoyer recharger la page à quelqu'un
  //  pour qui ça ne changera jamais rien.
  if (e instanceof RefusSupabase && e.code === "CLE_INVALIDE") {
    return "La clé posée dans ton profil n'est pas reconnue. Préviens le staff : " +
      "il faut la reposer.";
  }
  return "Le carnet n'a pas pu être chargé. Réessaie dans un moment.";
}

/** Le carnet du membre connecté, ou le mot qui dit pourquoi non.
 *
 *  QUATRE REFUS, ET ILS NE DISENT PAS LA MÊME CHOSE :
 *
 *    · le forum ne répond pas — on ne sait pas qui regarde, et dire
 *      « connecte-toi » à quelqu'un de connecté serait faux ;
 *    · invité — il suffit de se connecter, et c'est tout ;
 *    · connecté, mais le staff n'a pas posé sa clé — rien à faire de
 *      son côté, et surtout rien à coller ;
 *    · la base refuse — la clé ne correspond à rien, ou la panne.
 */
async function ouvrirLeCarnet(): Promise<void> {
  poserLEtat(document, "charge");
  direLeSouci(document, "");

  let profil;
  try {
    profil = await profilQuiRegarde(demandeurDuNavigateur());
  } catch {
    poserLEtat(document, "dehors");
    direLeSouci(document, "Le forum n'a pas répondu. Recharge la page dans un moment.");
    return;
  }

  if (profil.compte === null) {
    poserLEtat(document, "dehors");
    direLeSouci(
      document,
      "Tu n'es pas connectée au forum. Connecte-toi, puis reviens sur cette page.",
    );
    return;
  }

  //  PAS DE CLÉ, PAS DE REQUÊTE. Le staff la pose dans le profil au
  //  moment de la validation ; tant qu'elle n'y est pas, il n'y a rien
  //  à demander et rien que la joueuse puisse faire.
  if (profil.cle === null) {
    poserLEtat(document, "dehors");
    direLeSouci(
      document,
      `Connectée en tant que ${profil.compte.pseudo || "ce compte"}, mais ta clé de ` +
        `liaison n'est pas encore posée dans ton profil. C'est le staff qui l'y met, ` +
        `à la validation de ton personnage.`,
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
    brut = await appeler(config, "carnet", { cle: profil.cle });
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
    direLeSouci(document, motDuRefus(e));
    return;
  }

  if (typeof brut !== "object" || brut === null) {
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
