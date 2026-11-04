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
//  ── LA LIAISON, UNE FOIS, ET LA SESSION ENSUITE ─────────────────────
//
//  « On va mettre en place le process de lier mon compte, c'est la
//  première chose à faire quand on arrive dans le carnet de bord » ·
//  « la personne ne doit le faire qu'une seule fois », 3 novembre.
//
//  Quatrième version de cette ouverture en deux jours, et la dernière :
//  les trois d'avant ont toutes buté sur le même mur, qu'une page sans
//  serveur ne peut rien PROUVER à la base. Un code posté dans un sujet,
//  le numéro de compte tout nu, la clé dans le profil — aucune ne
//  tenait les trois exigences à la fois.
//
//  Ici la preuve vient d'ailleurs : la personne relève une boîte, et
//  c'est Supabase Auth qui le vérifie. Ensuite son laissez-passer parle
//  pour elle, et `carnet_de_la_session` ne rend que SES personnages.
//
//  Le prix : une étape, une fois dans la vie d'un personnage. Après
//  ça, la page s'ouvre toute seule — sur tous ses personnages et sur
//  tous ses navigateurs, puisque la boîte est la même partout.
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
import {
  appelerAvecLeJeton,
  envoyerLeLien,
  rafraichir,
} from "../src/adaptateurs/navigateur/auth-supabase.ts";
import {
  garderLeLaissez,
  lireLeLaissez,
  oublierLeLaissez,
} from "../src/adaptateurs/navigateur/laissez-garde.ts";
import {
  adresseSansJeton,
  encoreBon,
  type Laissez,
  laissezDuFragment,
  refusDuFragment,
} from "../src/navigateur/session-de-jeu.ts";
import { configDepuis, type ConfigSupabase } from "../src/adaptateurs/navigateur/registre.ts";
import { poserEcrire } from "../src/adaptateurs/navigateur/ecrire.ts";
import { poserHistoire } from "../src/adaptateurs/navigateur/histoire.ts";
import { poserLesLiens } from "../src/adaptateurs/navigateur/liens.ts";
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
function motDuRefus(): string {
  return "Le carnet n'a pas pu être chargé. Réessaie dans un moment.";
}

/** Le carnet de la session : la panne, l'absence, ou le carnet.
 *
 *  TROIS RÉPONSES QU'IL FAUT TENIR SÉPARÉES. « La base n'a pas
 *  répondu » et « la base a répondu : personne » appellent deux phrases
 *  opposées — l'une dit de réessayer, l'autre d'aller voir le staff — et
 *  les confondre envoie la personne au mauvais endroit. */
async function lireLeCarnet(
  config: ConfigSupabase,
  jeton: string,
  forumUserId: number,
): Promise<Carnet | null | "panne"> {
  const reponse = await appelerAvecLeJeton(config, jeton, "carnet_de_la_session", {
    forumUserId,
  });
  if (!reponse.ok) {
    console.error("wm/carnet : la base a refusé —", reponse.status);
    return "panne";
  }
  const brut = await reponse.json().catch(() => "panne" as const);
  if (brut === null) return null;
  if (typeof brut !== "object") return "panne";
  return brut as Carnet;
}

/** Rejoue la liaison : le nombre de personnages attachés, ou la panne.
 *
 *  ── POURQUOI CETTE FONCTION EXISTE ──────────────────────────────────
 *
 *  Le rattrapage écrivait `if (r.ok) { … }` sans rien dans l'autre cas.
 *  Donc une liaison qui LÈVE — `JETON_SANS_ADRESSE`, une fonction
 *  absente parce qu'une migration n'est pas passée — tombait dans le
 *  silence, et la page affichait « ce personnage n'est pas rattaché à
 *  cette connexion » : une phrase qui accuse la base de jeu alors que
 *  l'appel n'a jamais abouti. Deuxième fois dans la soirée que j'écris
 *  un verdict par-dessus une panne que j'ai moi-même cachée.
 *
 *  ET LE NOMBRE COMPTE. Zéro, c'est l'adresse du jeton qui n'est notée
 *  sur aucun personnage — la seule situation qui mérite d'aller voir le
 *  staff. Tout le reste est une panne, et doit se dire comme telle. */
/** Le mot d'une liaison qui n'a pas abouti.
 *
 *  ON NE DIT PAS « ton personnage n'est pas rattaché » : la page n'en
 *  sait rien, puisque la base ne lui a pas répondu. Le code part avec,
 *  parce que c'est lui qui fait la différence entre un réglage et une
 *  panne — et sans lui, chaque signalement coûte un aller-retour. */
function motDeLaLiaisonCassee(code: string): string {
  return `La connexion a marché, mais le jeu n'a pas pu enregistrer la liaison. ` +
    `Préviens le staff. (code ${code})`;
}

async function jouerLaLiaison(
  config: ConfigSupabase,
  jeton: string,
): Promise<{ lies: number } | { panne: string }> {
  const r = await appelerAvecLeJeton(config, jeton, "lier_mon_personnage");
  if (!r.ok) {
    const dit = await r.text().catch(() => "");
    console.error("wm/carnet : la liaison a échoué —", r.status, dit);
    return { panne: String(r.status) };
  }
  const corps = await r.json().catch(() => null);
  const lies = (corps as { lies?: unknown } | null)?.lies;
  if (typeof lies !== "number") {
    console.error("wm/carnet : la liaison a répondu sans compte —", corps);
    return { panne: "réponse illisible" };
  }
  return { lies };
}

function direLaLiaison(mot: string): void {
  const e = document.querySelector("[data-wm-carnet-lier-dit]");
  if (e !== null) e.textContent = mot;
}

/** Montre ou cache le bloc « Lier mon compte ». */
function montrerLaLiaison(ouvert: boolean): void {
  const bloc = document.querySelector<HTMLElement>("[data-wm-carnet-lier]");
  if (bloc !== null) bloc.hidden = !ouvert;
}

/** Le laissez-passer utilisable, rafraîchi si besoin.
 *
 *  `null` S'IL N'Y EN A PAS OU S'IL EST MORT, et dans les deux cas la
 *  page redemande la liaison. On ne distingue pas : le geste est le
 *  même, et personne n'a envie de lire « ton jeton de rafraîchissement
 *  a été révoqué ». */
async function laissezUtilisable(acces: ConfigSupabase): Promise<Laissez | null> {
  const garde = lireLeLaissez();
  if (garde === null) return null;
  if (encoreBon(garde, Date.now())) return garde;
  const neuf = await rafraichir(acces, garde.rafraichir, Date.now()).catch(() => null);
  if (neuf === null) {
    oublierLeLaissez();
    return null;
  }
  garderLeLaissez(neuf);
  return neuf;
}

/** Le retour du mail : on prend les jetons du fragment, on les range,
 *  et on efface l'adresse.
 *
 *  REND `true` SI UN RETOUR A ÉTÉ TRAITÉ, pour que l'appelant sache
 *  qu'il vient de se passer quelque chose et le dise.
 *
 *  L'EFFACEMENT DE L'ADRESSE N'EST PAS DU CONFORT : le fragment ne part
 *  jamais au serveur, mais il reste dans la barre, dans l'historique et
 *  dans le lien qu'on copie pour demander de l'aide — et celui-là ouvre
 *  le carnet. */
function ramasserLeRetour(): "lie" | "refuse" | null {
  const fragment = location.hash;
  const refus = refusDuFragment(fragment);
  const neuf = laissezDuFragment(fragment, Date.now());
  if (refus === null && neuf === null) return null;

  const propre = adresseSansJeton(location.href, fragment);
  try {
    history.replaceState(null, "", propre);
  } catch { /* un navigateur qui refuse : l'adresse reste, le reste marche */ }

  if (neuf === null) return "refuse";
  garderLeLaissez(neuf);
  return "lie";
}

/** Le carnet du membre connecté, ou le mot qui dit pourquoi non.
 *
 *  LES REFUS NE DISENT PAS LA MÊME CHOSE, et c'est tout le soin de
 *  cette fonction :
 *
 *    · le forum ne répond pas — on ne sait pas qui regarde, et dire
 *      « connecte-toi » à quelqu'un de connecté serait faux ;
 *    · invité sur le forum — il suffit de s'y connecter ;
 *    · connecté au forum, pas encore lié — on montre la liaison ;
 *    · lié, mais ce personnage-là n'est pas derrière cette boîte —
 *      le cas de quelqu'un qui a deux adresses, et il faut le dire ;
 *    · la base refuse — la panne.
 */
async function ouvrirLeCarnet(): Promise<void> {
  poserLEtat(document, "charge");
  direLeSouci(document, "");
  montrerLaLiaison(false);

  const retour = ramasserLeRetour();

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
  const compte = profil.compte;

  const config = configDepuis(await lire("supabase.json"));
  if (config === null) {
    poserLEtat(document, "dehors");
    direLeSouci(document, "Le carnet n'a pas pu joindre le serveur de jeu.");
    return;
  }

  if (retour === "refuse") {
    poserLEtat(document, "dehors");
    montrerLaLiaison(true);
    direLaLiaison(
      "Ce lien n'est plus valable — ils expirent vite, et celui du mail " +
        "précédent ne marche plus. Demandes-en un autre.",
    );
    brancherLaLiaison(config);
    return;
  }

  const laissez = await laissezUtilisable(config);
  if (laissez === null) {
    poserLEtat(document, "dehors");
    montrerLaLiaison(true);
    direLaLiaison("");
    brancherLaLiaison(config);
    return;
  }

  //  AU RETOUR DU MAIL, ON LIE AVANT DE LIRE. La fonction attache tous
  //  les personnages de la boîte d'un coup, et elle ne prend aucun
  //  argument : l'adresse vient du jeton (migration 0031).
  //  AUCUN ARGUMENT, ET C'EST LA FONCTION QUI LE DIT : l'adresse vient
  //  du jeton depuis la `0031`. Passer `{ p: … }` ferait chercher à
  //  PostgREST une fonction qui n'existe plus.
  //  UN APPEL QUI ÉCHOUE N'EST PAS UN VERDICT SUR LES PERSONNAGES.
  if (retour === "lie") {
    const fait = await jouerLaLiaison(config, laissez.jeton);
    if ("panne" in fait) {
      poserLEtat(document, "dehors");
      direLeSouci(document, motDeLaLiaisonCassee(fait.panne));
      return;
    }
  }

  //  ── LE CARNET, ET UNE SECONDE CHANCE ───────────────────────────────
  //
  //  `null` veut dire « aucun personnage derrière cette connexion », et
  //  il y a un cas où ce n'est pas définitif : LE STAFF POSE L'ADRESSE
  //  APRÈS QUE LA PERSONNE S'EST LIÉE. C'est l'ordre naturel, même —
  //  on se lie en arrivant, on est validée après.
  //
  //  La liaison ne tournait qu'au retour du mail. Donc cette personne
  //  restait bloquée sur « pas encore validée » à chaque visite, pour
  //  toujours, sans savoir qu'il fallait redemander un lien pour que ça
  //  se débloque. On rejoue la liaison — elle est sans dommage, son
  //  propre commentaire SQL le dit — et on relit. Un rechargement
  //  suffit maintenant.
  let lu = await lireLeCarnet(config, laissez.jeton, compte.id);
  if (lu === null && retour !== "lie") {
    const fait = await jouerLaLiaison(config, laissez.jeton);
    //  LE RATTRAPAGE NE SE TAIT PLUS. Il écrivait `if (r.ok) { … }` et
    //  rien dans l'autre cas, alors une liaison qui lève tombait dans
    //  le silence et la page accusait la base de ne connaître personne.
    if ("panne" in fait) {
      poserLEtat(document, "dehors");
      direLeSouci(document, motDeLaLiaisonCassee(fait.panne));
      return;
    }
    if (fait.lies > 0) lu = await lireLeCarnet(config, laissez.jeton, compte.id);
  }

  if (lu === "panne") {
    poserLEtat(document, "dehors");
    direLeSouci(document, motDuRefus());
    return;
  }

  //  `null` APRÈS LA SECONDE CHANCE : soit le personnage n'est pas
  //  validé, soit il relève d'une autre boîte — le cas de quelqu'un qui
  //  a deux adresses. On propose la liaison, qui est le geste qui
  //  répare les deux.
  if (lu === null) {
    poserLEtat(document, "dehors");
    montrerLaLiaison(true);
    direLaLiaison(
      `Connectée en tant que ${compte.pseudo || "ce compte"}, mais ce personnage n'est ` +
        `pas rattaché à cette connexion. S'il a une autre adresse, relie-toi avec ` +
        `celle-là ; sinon, c'est qu'il n'est pas encore validé.`,
    );
    brancherLaLiaison(config);
    return;
  }

  //  LE DESSIN A SON PROPRE FILET, et il est séparé exprès. Une donnée
  //  inattendue — une espèce absente du catalogue, un objet retiré —
  //  plantait au même endroit qu'une panne de réseau, et la page disait
  //  le même mot. On cherchait alors du côté de la base, qui avait très
  //  bien répondu.
  const carnet = lu;
  try {
    const decor = await decorDuCarnet();
    poserLaBarre(document, carnet, "mon-jeu", decor);
    poserMonJeu(document, carnet, decor);
    poserMonSac(document, carnet, decor);
    poserMonPokedex(document, carnet, decor);
    //  ÉCRIRE SE MONTE APRÈS LE DESSIN, et son échec ne doit pas
    //  emporter le carnet : un onglet qui ne se branche pas est un
    //  onglet vide, pas une page morte. Il le dit dans la console.
    if (carnet.dresseur !== null) {
      poserEcrire({
        doc: document,
        acces: config,
        jeton: laissez.jeton,
        joueurId: carnet.dresseur.joueurId,
      });
      //  LA TRAINER CARD EST REMPLIE PAR LE JEU, jamais saisie : ses
      //  chiffres viennent du carnet qu'on vient de lire, pas d'un
      //  champ que le joueur pourrait écrire.
      poserLesLiens({
        doc: document,
        acces: config,
        jeton: laissez.jeton,
        joueurId: carnet.dresseur.joueurId,
        forumUserId: carnet.dresseur.forumUserId,
      });
      poserHistoire({
        doc: document,
        acces: config,
        jeton: laissez.jeton,
        joueurId: carnet.dresseur.joueurId,
        pseudo: carnet.dresseur.pseudo,
        avatar: null,
        carte: [
          { chiffre: String(carnet.dresseur.palier ?? "—"), mot: "palier" },
          {
            chiffre: String(carnet.badges.filter((b) => b.obtenuLe !== null).length),
            mot: "badges",
          },
          { chiffre: String(carnet.pokemon.length), mot: "Pokémon" },
          { chiffre: String(carnet.pokedex.length), mot: "espèces vues" },
        ],
      });
    }
    poserLEtat(document, "pret");
    //  LA BARRE SUIT L'ONGLET OUVERT, et elle ne pouvait pas le faire
    //  avant d'avoir le dresseur à écrire dedans.
    poserLesOnglets(document, (actif) => poserLaBarre(document, carnet, actif, decor));
  } catch (e) {
    console.error("wm/carnet : la base a répondu, c'est le dessin qui a lâché —", e);
    poserLEtat(document, "dehors");
    direLeSouci(document, motDuRefus());
  }
}

/** Branche le formulaire de liaison, une seule fois.
 *
 *  L'ADRESSE DE RETOUR EST CELLE DE LA PAGE, fragment retiré : Supabase
 *  exige qu'elle soit déclarée dans la configuration du projet, et elle
 *  doit ramener ici et nulle part ailleurs. */
function brancherLaLiaison(acces: ConfigSupabase): void {
  const f = document.querySelector<HTMLFormElement>("[data-wm-carnet-liaison]");
  if (f === null || f.dataset.wmBranche === "oui") return;
  f.dataset.wmBranche = "oui";

  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const champ = f.querySelector<HTMLInputElement>("input");
    const courriel = (champ?.value ?? "").trim();
    if (courriel === "" || !courriel.includes("@")) {
      direLaLiaison("Il faut une adresse e-mail pour recevoir le lien.");
      return;
    }
    direLaLiaison("Un instant…");
    envoyerLeLien(acces, courriel, adresseSansJeton(location.href, location.hash))
      .then((r) => {
        if (r.etat === "parti") {
          direLaLiaison(
            "Regarde ta boîte : le lien part tout de suite et il ne vaut " +
              "qu'un quart d'heure. Il te ramènera ici.",
          );
          return;
        }
        if (r.etat === "trop-vite") {
          direLaLiaison(
            "Trop de demandes d'un coup. Attends quelques minutes avant de " +
              "réessayer — c'est une limite du service de mail, pas du jeu.",
          );
          return;
        }
        console.error("wm/carnet : l'envoi du lien a été refusé —", r.statut, r.code);
        //  LE CODE EST ÉCRIT DANS LA PAGE, ET PAS SEULEMENT DANS LA
        //  CONSOLE. Celle qui tient le forum n'ouvre pas la console
        //  avant de dire « ça ne marche pas » — et sans le code, la
        //  réponse est un aller-retour de plus. « adresse pas
        //  autorisée » n'est pas une panne du jeu : c'est le service de
        //  mail par défaut de Supabase, qui ne livre qu'aux adresses de
        //  l'équipe du projet tant qu'un SMTP n'est pas branché.
        direLaLiaison(
          r.code === "email_address_not_authorized"
            ? "Le service de mail du jeu n'accepte pas encore cette adresse. " +
              "Préviens le staff : c'est un réglage à faire, pas une erreur de ta part."
            : `Le lien n'a pas pu partir. Réessaie dans un moment. ` +
              `(code ${r.statut} ${r.code})`,
        );
      })
      .catch((e) => {
        console.error("wm/carnet : l'envoi du lien n'a pas abouti —", e);
        direLaLiaison("Le lien n'a pas pu partir. Réessaie dans un moment. (réseau)");
      });
  });
}

//  ── LE CONTRAT AVEC LA PAGE, ANNONCÉ TOUT HAUT ─────────────────────
//
//  Cette page et ce script sont deux artefacts publiés séparément : la
//  page se recolle à la main dans le panneau d'administration, le
//  script part par GitHub Pages. Rien ne garantit qu'ils arrivent
//  ensemble, et le 3 novembre ils ne l'ont pas fait — page neuve,
//  script de la veille, écran vide, aucune phrase. Une demi-heure à
//  chercher une panne qui n'existait pas.
//
//  Le numéro monte quand la page doit changer de forme : un attribut
//  `data-wm-carnet-…` que le script se met à lire, ou un bloc dont il
//  a besoin. Il ne monte pas pour une tournure ni pour du CSS.
//
//  LE FILET QUI LE LIT VIT DANS LA PAGE, pas ici, et c'est le fond de
//  l'affaire : un script trop vieux ne peut pas se plaindre lui-même.
export const VERSION_DU_CONTRAT = 4; //  4 : Mes liens (0034)
(globalThis as Record<string, unknown>).wmCarnetVersion = VERSION_DU_CONTRAT;

//  LES ONGLETS D'ABORD, SANS DONNÉES. Cliquer doit marcher pendant que
//  ça charge, sinon la page a l'air morte.
poserLesOnglets(document, () => {});

//  ET ON OUVRE. Sans bouton, sans champ, sans clé : la page va chercher
//  qui la regarde et la clé que le staff lui a posée.
ouvrirLeCarnet().catch((e) => {
  //  CE FILET NE DEVRAIT PLUS RIEN ATTRAPER : les deux moitiés ont le
  //  leur. S'il attrape quelque chose, c'est un chemin qu'on n'a pas
  //  prévu — donc exactement ce qu'on veut lire dans la console.
  console.error("wm/carnet : rien n'a prévu ça —", e);
  poserLEtat(document, "dehors");
  direLeSouci(document, motDuRefus());
});
