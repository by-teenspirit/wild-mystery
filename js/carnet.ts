/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  js/carnet.ts — le troisième paquet, et il ne sert qu'à une page
//
//  POURQUOI PAS `wild-mystery.js`. Même raison que pour les annexes :
//  `/h17-mon-carnet` est créée SANS l'en-tête du forum, donc sans
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
  poserMesBoites,
  poserMonJeu,
  poserMonPokedex,
  poserMonSac,
} from "../src/adaptateurs/navigateur/module-carnet.ts";
import { poserLeTheme } from "../src/adaptateurs/navigateur/module-theme-annexe.ts";
import { poserLeLienDEvitement } from "../src/adaptateurs/navigateur/module-navigation.ts";
import { poserLAccessibilite } from "../src/adaptateurs/navigateur/module-confort.ts";
import { aidesDepuis, poserLesAides } from "../src/adaptateurs/navigateur/module-aide.ts";
import { Preferences } from "../src/navigateur/preferences.ts";
import { StockageLocal } from "../src/adaptateurs/navigateur/stockage.ts";
import {
  adresseDuScript,
  especesDepuis,
  racineDesDonnees,
  racineDesImages,
  racineDuDepot,
} from "../src/adaptateurs/navigateur/catalogue.ts";
import { type CarteDeCouverture, Sprites } from "../src/navigateur/sprites.ts";
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
import { poserLesRp } from "../src/adaptateurs/navigateur/rp.ts";
import { avecLePseudoDuForum, type Carnet } from "../src/navigateur/carnet.ts";
import {
  demandeurDuNavigateur,
  profilQuiRegarde,
} from "../src/adaptateurs/navigateur/compte-du-forum.ts";

const RACINE = racineDesDonnees(adresseDuScript(document));
const IMAGES = racineDesImages(adresseDuScript(document));
//  LA RACINE DU DÉPÔT, en plus de `assets/` : les badges vivent dans
//  `img/badges/` et les sprites dans `assets/sprites-figes/`, que
//  `Sprites` rend en chemin relatif à la racine. Le recollage se fait
//  ici, dans la couche qui connaît les adresses.
const DEPOT = racineDuDepot(adresseDuScript(document));

/** `prefers-reduced-motion`, lu une fois : il décide entre le sprite
 *  animé et le sprite figé. */
function mouvementRefuse(): boolean {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

const PREFS = new Preferences(new StockageLocal());
poserLeTheme(document, PREFS);

//  ── LE MODULE D'ACCESSIBILITÉ, ICI AUSSI ────────────────────────────
//
//  « Tu rajouteras aussi le module d'accessibilité ici aussi. » — 18
//  novembre.
//
//  IL N'Y ÉTAIT PAS, et ce n'était pas un oubli de configuration : le
//  carnet est une page HTML autonome de Forumactif, comme les annexes.
//  `overall_header` ne l'habille pas, donc pas de coin d'outils — et
//  `poserLAccessibilite` cherchait un coin qui n'existe pas.
//
//  IL S'ACCROCHE À LA BARRE DE RETOUR, que cette page a déjà, et le
//  module sait le faire depuis le 8 novembre : il essaie le coin, puis
//  la barre. Une seule ligne suffisait donc ; c'est la ligne qui
//  manquait.
//
//  APRÈS `poserLeTheme`, et c'est une dépendance d'ordre : les deux
//  visent la même barre, et on veut le thème en premier — c'est celui
//  qu'on cherche le plus souvent.
poserLAccessibilite(document, PREFS);

//  ── LE LIEN D'ÉVITEMENT, QUI N'EXISTAIT PAS ICI ────────────────────
//
//  `module-navigation.ts` en pose un sur toutes les pages du forum. Il
//  cherche `#main-content`, `#page-body` ou `#content-main` — trois
//  identifiants de ModernBB. La page du carnet n'est pas un gabarit
//  ModernBB : elle n'en porte aucun, et personne n'appelait la fonction
//  ici. Elle n'avait donc pas de lien du tout.
//
//  CE QUE ÇA COÛTAIT : le champ e-mail, seule action de la page tant
//  que le carnet n'est pas relié, était la seizième tabulation sur
//  dix-huit — derrière six liens d'en-tête et huit onglets qui ne
//  menaient nulle part.
poserLeLienDEvitement(document);

//  ── L'AIDE S'OUVRE ET SE FERME ──────────────────────────────────────
//
//  Trois façons de la fermer, et c'est le minimum pour un panneau qui
//  recouvre la page : le bouton, la touche Échap, et un second appui
//  sur le « ? ». Le focus part dans le panneau à l'ouverture et revient
//  sur le bouton à la fermeture — sans ça, on referme et on se retrouve
//  en haut du document, loin de ce qu'on lisait.
//
//  ── ELLE SE RAPPELLE CE QU'ELLE A DÉJÀ BRANCHÉ ─────────────────────
//
//  Les aides des sept autres pages sont posées PLUS TARD, quand
//  `data/aide-carnet.json` répond : il faut donc rappeler cette
//  fonction après. Sans marque, le bouton de « Mes RP » recevrait un
//  second écouteur, les deux basculeraient à chaque clic, et le
//  panneau s'ouvrirait puis se refermerait aussitôt — un bouton mort,
//  pour une raison invisible.
function brancherLeTuto(doc: Document): void {
  for (const bouton of doc.querySelectorAll<HTMLButtonElement>("[data-wm-tuto-ouvrir]")) {
    if (bouton.hasAttribute("data-wm-tuto-branche")) continue;
    const id = bouton.getAttribute("aria-controls") ?? "";
    const panneau = doc.getElementById(id);
    if (panneau === null) continue;
    bouton.setAttribute("data-wm-tuto-branche", "");

    //  ── LE TIROIR DÉMÉNAGE À LA RACINE, ET C'EST MESURÉ ──────────
    //
    //  « Quand j'ouvre le "?" en bas à droite, j'arrive pas à le
    //  fermer et il passe en dessous de la barre de navigation. »
    //  — 20 novembre. Les deux moitiés du même défaut : la croix est
    //  en haut du tiroir, donc elle tombait sous la barre.
    //
    //  MONTER LE `z-index` NE SUFFIT PAS, et la sonde l'a dit :
    //  `.wm-carnet__corps` porte `isolation: isolate`, ce qui crée un
    //  CONTEXTE D'EMPILEMENT. Un enfant de ce contexte ne peut pas
    //  passer au-dessus d'un élément de dehors, même en plan 999 —
    //  c'est tout le contexte qui est rangé sous la barre, en bloc.
    //  `elementFromPoint` rendait bien `wm-retour` au sommet du
    //  tiroir.
    //
    //  UNE COUCHE QUI RECOUVRE LA PAGE VIT DONC À LA RACINE DE LA
    //  PAGE. Le BOUTON, lui, reste dans son onglet : c'est ce qui le
    //  fait disparaître avec sa page sans qu'on ait rien à éteindre.
    const racine = doc.getElementById("modernbb") ?? doc.body;
    if (racine !== null && panneau.parentElement !== racine) racine.appendChild(panneau);
    const montrer = (ouvert: boolean): void => {
      panneau.hidden = !ouvert;
      bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
      if (ouvert) panneau.querySelector<HTMLElement>("[data-wm-tuto-fermer]")?.focus();
      else bouton.focus();
    };
    bouton.addEventListener("click", () => montrer(panneau.hidden === true));
    panneau.querySelector("[data-wm-tuto-fermer]")
      ?.addEventListener("click", () => montrer(false));
    panneau.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") montrer(false);
    });
  }
}

brancherLeTuto(document);

//  ── LA BARRE SE REPLIE, ET S'EN SOUVIENT ────────────────────────────
//
//  « La barre latérale : on doit pouvoir la fermer. Quand on ferme la
//  barre latérale, on a que les icônes d'affichées. » — 20 novembre.
//
//  LE CHOIX TIENT D'UNE VISITE À L'AUTRE : quelqu'un qui travaille sur
//  un petit écran replie une fois, pas à chaque chargement. Le stockage
//  local peut jeter, refuser ou ne pas exister — en navigation privée,
//  en préversion — donc chaque accès est gardé et la valeur par défaut
//  est la barre OUVERTE : c'est l'état où l'on sait lire les onglets.
function brancherLaBarre(doc: Document): void {
  const CLEF = "wm-carnet-barre";
  const barre = doc.querySelector<HTMLElement>("[data-wm-carnet-barre]");
  const bouton = doc.querySelector<HTMLButtonElement>("[data-wm-carnet-replier]");
  if (barre === null || bouton === null) return;

  let ouverte = true;
  try {
    ouverte = globalThis.localStorage?.getItem(CLEF) !== "repliee";
  } catch { /* rien : on reste sur la barre ouverte */ }

  const poser = (): void => {
    //  UN ATTRIBUT ET PAS UNE CLASSE QUI S'AJOUTE : l'état se lit dans
    //  l'inspecteur sans croiser deux listes de classes, et la feuille
    //  n'a qu'un sélecteur à porter.
    if (ouverte) barre.removeAttribute("data-wm-repliee");
    else barre.setAttribute("data-wm-repliee", "");
    bouton.setAttribute("aria-expanded", ouverte ? "true" : "false");
  };
  poser();

  bouton.addEventListener("click", () => {
    ouverte = !ouverte;
    try {
      globalThis.localStorage?.setItem(CLEF, ouverte ? "ouverte" : "repliee");
    } catch { /* rien : le choix ne survivra pas, la page marche */ }
    poser();
  });
}

brancherLaBarre(document);

async function lire(nom: string): Promise<unknown> {
  if (RACINE === null) return null;
  return await fetch(`${RACINE}${nom}`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

async function decorDuCarnet(): Promise<Decor> {
  const [especes, objets, arenes, dex, groupes, couverture] = await Promise.all([
    lire("especes.json"),
    lire("objets.json"),
    lire("arenes.json"),
    lire("pokedex-carnet.json"),
    lire("groupes.json"),
    lire("sprites-couverture.json"),
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
    depot: DEPOT,
    sprites: couverture === null
      ? null
      : new Sprites(couverture as CarteDeCouverture, mouvementRefuse()),
    style: new Preferences(new StockageLocal()).styleDeSprite(),
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

/** Montre ou cache le bloc « Relier ton carnet » — et la présentation
 *  qui le précède.
 *
 *  LES DEUX VONT ENSEMBLE, et c'est voulu. « Il faut vraiment que
 *  l'onboarding serve à expliquer à quoi il sert » (18 novembre) : la
 *  présentation s'adresse à qui n'a pas encore relié son carnet, et à
 *  personne d'autre. Une fois relié, on ouvre son carnet pour
 *  travailler, pas pour relire ce qu'il sait faire.
 *
 *  UNE SEULE FONCTION POUR LES DEUX : deux appels séparés finiraient
 *  par se désaccorder, et on verrait la présentation seule au-dessus
 *  d'un carnet ouvert. */
function montrerLaLiaison(ouvert: boolean): void {
  montrerLAccueil(ouvert ? "liaison" : "rien");
}

/**
 * Lequel des trois accueils on montre.
 *
 * ── QUATRE ÉTATS, ET UN SEUL ÉTAIT DESSINÉ ──────────────────────────
 *
 * Relevé sur la page en ligne le 19 novembre :
 *
 *   1 · pas connectée au forum
 *   2 · connectée, carnet pas encore relié   ← le seul qui existait
 *   3 · lien parti, en attente du clic
 *   4 · carnet relié
 *
 * L'état 1 est celui où arrive la plupart des gens : on vient ici par
 * un lien d'annexe, avant de s'être connectée. On y montrait un
 * formulaire d'adresse e-mail qui ne pouvait pas aboutir, sous une
 * ligne grise de 11,5 px qui expliquait pourquoi.
 *
 * `decouverte` demande donc la CONNEXION plutôt qu'une adresse, et
 * laisse la présentation ouverte : c'est l'état où elle sert le plus,
 * et c'est précisément celui où elle était cachée.
 */
function montrerLAccueil(quoi: "rien" | "decouverte" | "liaison"): void {
  const pose = (nom: string, visible: boolean) => {
    const bloc = document.querySelector<HTMLElement>(nom);
    if (bloc !== null) bloc.hidden = !visible;
  };
  //  LA PRÉSENTATION ACCOMPAGNE LES DEUX ACCUEILS. Une fois le carnet
  //  relié on vient y travailler, pas relire ce qu'il sait faire.
  pose("[data-wm-carnet-presentation]", quoi !== "rien");
  pose("[data-wm-carnet-lier]", quoi === "liaison");
  //  LES DEUX ENCADRÉS DE SECOURS SUIVENT LA LIAISON. Ils étaient dans
  //  le panneau et en héritaient l'affichage ; posés dessous, ils ont
  //  leur propre état, et il faut le tenir ici — sinon « pourquoi ton
  //  adresse » s'affiche à quelqu'un à qui on n'en demande pas.
  pose("[data-wm-carnet-secours]", quoi === "liaison");
  pose("[data-wm-carnet-connexion]", quoi === "decouverte");

  //  LE RETOUR SE POSE ICI, parce que le script est le seul à savoir
  //  d'où l'on vient. Sans lui le lien reste bon — il mène à la
  //  connexion, et le forum ramène à l'accueil.
  if (quoi === "decouverte") {
    const lien = document.querySelector<HTMLAnchorElement>("[data-wm-carnet-connexion-lien]");
    if (lien !== null) {
      lien.href = "/login?redirect=" + encodeURIComponent(location.pathname + location.hash);
    }
  }
}

/**
 * Le formulaire s'efface, l'adresse s'affiche.
 *
 * ── CE QUE LE FORMULAIRE INVITAIT À FAIRE ───────────────────────────
 *
 * Il restait en place sous le message de succès : le même champ, le
 * même bouton. La chose à faire, pourtant, n'est plus de taper une
 * adresse — c'est d'aller voir ses mails.
 *
 * Et le deuxième clic ne redemande pas un lien : le service de mail
 * répond « trop de demandes d'un coup », ce qui se lit comme une panne
 * du jeu alors que le premier lien est déjà arrivé.
 */
function lienParti(courriel: string): void {
  const forme = document.querySelector<HTMLFormElement>("[data-wm-carnet-liaison]");
  const parti = document.querySelector<HTMLElement>("[data-wm-carnet-parti]");
  const adresse = document.querySelector<HTMLElement>("[data-wm-carnet-parti-adresse]");
  if (forme === null || parti === null) return;
  //  L'ADRESSE EST RÉAFFICHÉE parce qu'une faute de frappe est la
  //  première cause d'un lien qui n'arrive pas, et qu'on ne peut plus
  //  la relire dans le champ une fois celui-ci effacé.
  if (adresse !== null) adresse.textContent = "Envoyé à " + courriel;
  forme.hidden = true;
  parti.hidden = false;
  //  LE RENVOI VIT À PART, APRÈS LE MESSAGE : voir le commentaire du
  //  balisage. Deux blocs à montrer au lieu d'un, pour un ordre de
  //  lecture juste.
  const renvoi = document.querySelector<HTMLElement>("[data-wm-carnet-renvoi]");
  if (renvoi !== null) renvoi.hidden = false;
}

/** On refait apparaître le formulaire. Le renvoi est un SECOND choix,
 *  pas le geste par défaut : voir `lienParti`. */
function brancherLeRenvoi(): void {
  const bouton = document.querySelector<HTMLButtonElement>("[data-wm-carnet-renvoyer]");
  if (bouton === null || bouton.dataset.wmBranche === "oui") return;
  bouton.dataset.wmBranche = "oui";
  bouton.addEventListener("click", () => {
    const forme = document.querySelector<HTMLFormElement>("[data-wm-carnet-liaison]");
    const parti = document.querySelector<HTMLElement>("[data-wm-carnet-parti]");
    const renvoi = document.querySelector<HTMLElement>("[data-wm-carnet-renvoi]");
    if (forme === null || parti === null) return;
    parti.hidden = true;
    if (renvoi !== null) renvoi.hidden = true;
    forme.hidden = false;
    direLaLiaison("");
    forme.querySelector("input")?.focus();
  });
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
    //  ── ON MONTRE À QUOI ÇA SERT, ET ON DEMANDE LA CONNEXION ──────
    //
    //  C'est l'état où arrive la plupart des gens, et c'était le seul
    //  où la présentation restait cachée. Voir `montrerLAccueil`.
    //  ET PAS DE LIGNE DE SOUCI. Le canal `souci` est celui des
    //  pannes — il est en terre brûlée, et il se lit comme « quelque
    //  chose ne va pas ». Ne pas être connectée à sa première visite
    //  n'est pas une panne, c'est l'état normal d'arrivée ; l'encadré
    //  le dit déjà, en titre et en phrase entière.
    montrerLAccueil("decouverte");
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
  //
  //  ── CE MESSAGE ENVOYAIT CHERCHER CE QU'ON NE PEUT PAS TROUVER ───
  //
  //  Il disait : « s'il a une autre adresse, relie-toi avec celle-là ;
  //  sinon, c'est qu'il n'est pas encore validé. » Deux pistes, et
  //  aucune que la joueuse puisse suivre.
  //
  //  Le 16 novembre, une joueuse a essayé deux adresses, cherché du
  //  côté des alias `mail+perso@`, fouillé ses spams, et conclu « il
  //  doit me manquer une étape ». Elle n'en avait aucune.
  //
  //  La liaison compare l'adresse de la session à `joueur.courriel`,
  //  que LE STAFF renseigne à la validation (0029 : « la seule chose
  //  qui autorise une liaison »). Tant qu'il ne l'a pas fait, rien de
  //  ce que la joueuse tente ne peut aboutir. Le message le dit
  //  maintenant, et il s'arrête là.
  if (lu === null) {
    poserLEtat(document, "dehors");
    montrerLaLiaison(true);
    direLaLiaison(
      `Connectée en tant que ${compte.pseudo || "ce compte"}, mais aucun personnage ` +
        `n'est rattaché à cette adresse. C'est le staff qui l'enregistre à la ` +
        `validation : préviens-le, il n'y a rien à faire de ton côté.`,
    );
    brancherLaLiaison(config);
    return;
  }

  //  LE DESSIN A SON PROPRE FILET, et il est séparé exprès. Une donnée
  //  inattendue — une espèce absente du catalogue, un objet retiré —
  //  plantait au même endroit qu'une panne de réseau, et la page disait
  //  le même mot. On cherchait alors du côté de la base, qui avait très
  //  bien répondu.
  //  ── LE PSEUDO VIENT DU FORUM, PAS DE LA BASE ────────────────────
  //
  //  « J'ai changé mon pseudo mais il a pas changé dans le carnet de
  //  bord », 13 novembre. `joueur.pseudo` est écrit une seule fois par
  //  `lier_compte` et plus jamais relu.
  //
  //  Trois écrans en dépendaient : le nom de la barre latérale, et
  //  surtout `etatVu`, qui compare l'auteur du dernier message —
  //  relevé sur le forum, donc le pseudo D'AUJOURD'HUI — à ce nom
  //  figé. Après un changement de pseudo les deux ne correspondent
  //  plus jamais : tous les RP passent en « à moi d'écrire » et les
  //  filtres de la vue liste ne gardent plus rien.
  //
  //  La page sait pourtant le bon nom : elle vient de lire
  //  `/profile?mode=editprofile`, et cette page-là ne se charge
  //  qu'avec la session de son propriétaire.
  //
  //  CE N'EST QU'UN PANSEMENT D'ÉCRAN. La relève cherche les RP par
  //  `/search?search_author=<pseudo>` avec le nom de la base : tant
  //  qu'elle ne le recolle pas elle-même, elle ne trouvera rien.
  const carnet = avecLePseudoDuForum(lu, compte);
  try {
    const decor = await decorDuCarnet();
    poserLaBarre(document, carnet, "mon-jeu", decor);
    poserMonJeu(document, carnet, decor);
    poserMonSac(document, carnet, decor);
    poserMonPokedex(document, carnet, decor);
    //  RANGER PASSE PAR LA FONCTION, pas par la table : le navigateur
    //  n'a de droit d'écriture ni sur `position` ni sur `boite_no`
    //  (0008, 0035). Ce qui est grisé dans l'écran est une politesse,
    //  ce qui refuse est dans la base.
    poserMesBoites(document, carnet, decor, async (pokemonId, vers) => {
      const r = await appelerAvecLeJeton(config, laissez.jeton, "ranger", {
        pokemonId,
        ...vers,
      }).catch(() => null);
      if (r === null || !r.ok) {
        console.error("wm/carnet : le rangement a été refusé —", r?.status);
        direLeSouci(
          document,
          "Ce rangement a été refusé. Recharge la page : ton carnet n'est peut-être plus à jour.",
        );
        return false;
      }
      return true;
    });
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
      poserLesRp({
        doc: document,
        acces: config,
        jeton: laissez.jeton,
        joueurId: carnet.dresseur.joueurId,
        pseudo: carnet.dresseur.pseudo,
        //  POUR LE TAG DE LIEU : `carte.json` et `forums.json`. Et
        //  pour nommer les espèces du récap de butin : `especes.json`.
        racine: RACINE,
        //  POUR NOMMER L'EXPÉRIENCE DU RÉCAP. Le module posé dans le
        //  sujet ne peut pas le faire — `joueur` n'est lisible que par
        //  son propriétaire —, mais ici on est chez soi : le carnet les
        //  a déjà en main, sans une requête de plus.
        pokemon: carnet.pokemon.map((p) => ({
          id: p.id,
          surnom: p.surnom,
          especeId: p.especeId,
        })),
      });
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
  brancherLeRenvoi();

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
          //  LES SPAMS SONT NOMMÉS, parce que c'est là qu'il tombe.
          //  « Il vient de tomber dans les spams sur l'autre mail »,
          //  16 novembre : un lien qui dure quinze minutes et qu'on
          //  cherche dans la mauvaise boîte est un lien perdu.
          lienParti(courriel);
          direLaLiaison(
            "Regarde ta boîte, et tes spams — c'est souvent là qu'il tombe. " +
              "Le lien part tout de suite et il ne vaut qu'un quart d'heure. " +
              "Il te ramènera ici.",
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
export const VERSION_DU_CONTRAT = 6; //  6 : Mes RP (0036, 0037)
(globalThis as Record<string, unknown>).wmCarnetVersion = VERSION_DU_CONTRAT;

//  LES ONGLETS D'ABORD, SANS DONNÉES. Cliquer doit marcher pendant que
//  ça charge, sinon la page a l'air morte.
poserLesOnglets(document, () => {});

//  ── LES AIDES, AVANT LES DONNÉES ELLES AUSSI ────────────────────────
//
//  Elles n'en dépendent pas : les huit pages existent dans le HTML
//  collé, et l'aide explique la PAGE, pas son contenu. Elle se pose
//  donc tout de suite, et elle est là même si le carnet ne s'ouvre
//  pas — c'est justement ce moment-là qu'on a besoin de comprendre à
//  quoi sert ce qu'on ne voit pas encore.
lire("aide-carnet.json")
  .then((brut) => {
    const aides = aidesDepuis(brut);
    if (aides.size > 0) {
      poserLesAides({ doc: document, aides, depot: DEPOT });
      //  ET ON LES BRANCHE : elles arrivent après le premier passage,
      //  donc personne ne les aurait câblées. La fonction saute les
      //  boutons déjà branchés, donc celui de « Mes RP » ne reçoit pas
      //  un second écouteur.
      brancherLeTuto(document);
    }
  })
  .catch(() => {});

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
