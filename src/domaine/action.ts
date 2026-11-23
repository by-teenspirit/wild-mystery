// ════════════════════════════════════════════════════════════════════
//  src/domaine/action.ts
//
//  Ce qu'un joueur DEMANDE dans un message, et la forme que ça prend
//  dans le texte.
//
//  Décidé le 2 octobre (53-les-actions-dans-un-message) : le joueur ne
//  tape pas de syntaxe, il clique sur un bouton, et c'est notre
//  JavaScript qui écrit le bloc. Conséquence agréable : **le format peut
//  être strict et laid, puisque plus personne ne le compose à la main.**
//  On n'a plus à arbitrer entre lisibilité et rigueur.
//
//  UNE DEMANDE, PAS UN RÉSULTAT. Le bloc dit « je fouille la zone », il
//  ne dit jamais « j'ai trouvé une Poké Ball ». Le tirage est fait par la
//  relève, avec le numéro du message pour graine — fixé à la seconde où
//  le joueur poste, donc impossible à rejouer, et refaisable à
//  l'identique des années plus tard pour trancher une contestation.
//
//  TAPER LE BLOC À LA MAIN NE DONNE AUCUN AVANTAGE, et c'est voulu : le
//  bouton écrit exactement la même chose, et le tirage est ailleurs. Il
//  n'y a donc rien à protéger ici — sauf une chose, voir plus bas.
//
//  UNE SEULE ACTION PAR MESSAGE. C'est la seule règle qui compte : sans
//  elle, on colle le bloc cinquante fois et on fouille cinquante fois
//  dans un seul message. La première l'emporte, comme la première
//  demande de clôture l'emporte dans un sujet.
// ════════════════════════════════════════════════════════════════════

/** Le vocabulaire. Il s'est ouvert au combat le 18 novembre — et la
 *  règle qui était écrite ici tient toujours : UNE ACTION QUE LE
 *  SERVEUR NE SAIT PAS HONORER N'A RIEN À FAIRE DANS UN BOUTON. Les
 *  cinq verbes du combat existent donc ici avant que la barre ne les
 *  propose, et la barre ne les proposera qu'une fois chacun honoré.
 *
 *  LES CINQ PORTENT UN ARGUMENT, ou presque : « fuir » n'en a pas
 *  besoin, les autres disent QUOI. C'est la différence avec les deux
 *  premiers verbes, et elle change la lecture — un `attaquer` sans
 *  argument n'est pas une action, c'est un bloc abîmé. */
export type Action =
  /** « Fais apparaître un Pokémon. » Sans argument : la zone entière.
   *
   *  ── IL Y AVAIT UN LIEU ICI ─────────────────────────────────────────
   *
   *  `[[WM-ACTION:chercher:etang-vaseux]]` : une zone avait une
   *  quinzaine de lieux, et le joueur en choisissait un dans un menu.
   *  Callista a retiré le menu le 15 octobre au matin — « on est déjà
   *  dans une zone sauvage, avec un palier » — puis les lieux eux-mêmes
   *  l'après-midi : « enlève tous les petits lieux. On a 3 paliers, 17
   *  zones sauvages, et tu répartis le pokédex comme ça. »
   *
   *  LA FORME À DEUX PARTIES SE LIT ENCORE, et c'est volontaire : des
   *  messages en portent un, postés avant ce changement, dont un sur
   *  `t976`. **Un message posté ne change pas de sens parce qu'on a
   *  changé la donnée.** Il dit « fais apparaître un Pokémon » — ce
   *  qu'il a toujours dit — et le lieu est maintenant ignoré, puisque la
   *  table est celle de la zone. On ne lève pas, et on ne refuse pas :
   *  refuser ces messages, ce serait effacer ce que des joueurs ont
   *  demandé. */
  | { readonly type: "chercher" }
  /** Sans argument : fouiller vaut pour la zone entière, et le butin suit
   *  son palier (`fouille.ts`). */
  | { readonly type: "fouiller" }
  /** « Attaque avec cette capacité. »
   *
   *  L'ARGUMENT EST L'IDENTIFIANT DE LA CAPACITÉ, PAS SON RANG dans les
   *  quatre. Le rang aurait été plus court à écrire, et c'est
   *  exactement pour ça qu'il est mauvais : il dit OÙ était le choix
   *  dans une liste, pas LEQUEL. Le jour où les quatre capacités
   *  changent — un niveau gagné à la clôture — le rang 2 désigne autre
   *  chose, et le joueur attaquerait avec un move qu'il n'a pas choisi.
   *
   *  Un identifiant, lui, se vérifie : le serveur regarde s'il est
   *  parmi les quatre du Pokémon, et refuse sinon. C'est ce qui garde
   *  vraie la promesse de l'en-tête — taper le bloc à la main ne donne
   *  aucun avantage. */
  | { readonly type: "attaquer"; readonly capacite: number }
  /** « Lance cette Poké Ball. » L'objet est nommé parce qu'il y en a
   *  plusieurs au catalogue, et qu'ils n'ont pas le même taux. */
  | { readonly type: "ball"; readonly objetId: number }
  /** « Utilise cet objet du sac. » Une Potion, un rappel, une baie. */
  | { readonly type: "objet"; readonly objetId: number }
  /** « Envoie celui-ci à la place. » La POSITION dans l'équipe, de 1 à
   *  6 — et là, contrairement à la capacité, la position EST ce que le
   *  joueur a choisi : l'équipe est une suite de six cases, pas un
   *  ensemble, et c'est la case qu'il a cliquée. */
  | { readonly type: "changer"; readonly position: number }
  /** Sans argument : on s'en va, et le combat se ferme. */
  | { readonly type: "fuir" }
  /** « Je lance un défi. » — 23 novembre.
   *
   *  ── IL NE NOMME PERSONNE, ET C'EST LE CŒUR DU DESSIN ──────────────
   *
   *  Un `defier:<pseudo>` aurait demandé une liste des présents dans le
   *  sujet, un choix dans un menu, et un pseudo écrit par un joueur
   *  dans un bloc d'action — donc à échapper, à vérifier contre la base,
   *  et à retrouver quand quelqu'un se renomme.
   *
   *  C'est L'ACCEPTATION QUI DÉSIGNE : le premier qui accepte devient
   *  l'adversaire. Et ça colle à ce que l'annexe « Se battre contre un
   *  dresseur » décrit déjà — l'accord se fait entre les joueurs, par
   *  MP ou dans le sujet des recherches ; le sujet ne fait que
   *  l'enregistrer.
   *
   *  UN SEUL DÉFI OUVERT PAR SUJET, et c'est la base qui le tient, pas
   *  ce fichier. */
  | { readonly type: "defier" }
  /** « J'accepte le défi. » Sans argument non plus : il n'y a qu'un
   *  défi ouvert par sujet, donc il n'y a rien à désigner. */
  | { readonly type: "accepter" }
  /** « J'ouvre ma pension, à ce tarif. » — 23 novembre.
   *
   *  L'ARGUMENT EST LE TARIF, en pokédollars, et c'est le gérant qui le
   *  fixe : « le gérant fixe son tarif et touche l'argent ». La pension
   *  publique d'Aulne, elle, n'est pas ouverte par un joueur — c'est
   *  une ligne de configuration, pas un message.
   *
   *  UNE PENSION GRATUITE S'ÉCRIT 1 ₽, ET PAS 0. Le bloc ne sait pas
   *  porter zéro : `entierPositif` refuse tout ce qui n'est pas
   *  strictement positif, et c'est la garde qui empêche un bloc abîmé
   *  de devenir une action approximative pour les six autres verbes.
   *  L'ouvrir pour celui-ci la relâcherait pour tous. */
  | { readonly type: "gerer"; readonly tarif: number }
  /** « Je confie ce Pokémon à la pension de ce sujet. »
   *
   *  LA POSITION DANS L'ÉQUIPE, de 1 à 6, exactement comme `changer` et
   *  pour la même raison : l'équipe est une suite de six cases, et c'est
   *  la case que le joueur a cliquée.
   *
   *  LA PENSION N'EST PAS NOMMÉE — c'est le SUJET qui la désigne. Un
   *  gérant ouvre sa pension sur un sujet, et on y confie un Pokémon en
   *  y postant. Même dessin que le défi : le lieu porte l'information,
   *  donc le bloc n'a pas à la porter. */
  | { readonly type: "confier"; readonly position: number }
  /** « Je prends en pension ce qui attend. » Le gérant, chez lui.
   *
   *  Sans argument : la base prend le plus ancien dépôt en attente de
   *  ce sujet. Nommer lequel aurait demandé une liste au joueur, et
   *  une liste qui change entre l'affichage et l'envoi. */
  | { readonly type: "prendre" }
  /** « Je reprends mon Pokémon. » Sans argument non plus.
   *
   *  C'est au RETRAIT que les niveaux se comptent et que le tarif se
   *  paie — « il ne lui restera plus qu'à régler la somme demandée par
   *  le gérant », annexe élevage de la V1. On paie ce qu'on a obtenu. */
  | { readonly type: "reprendre" }
  /** « Fais évoluer celui-ci, vers cette espèce. » — 23 novembre.
   *
   *  LE SEUL VERBE À DEUX ARGUMENTS, et les deux sont nécessaires :
   *
   *  · LA POSITION, de 1 à 6, comme `changer` et `confier`. C'est la
   *    case que le joueur a cliquée ;
   *  · L'ESPÈCE VISÉE, parce que l'annexe laisse le choix : « si le
   *    pokémon a plusieurs formes d'évolution possible, elles sont
   *    laissées à votre choix sur WM ». Évoli en a huit, Débugant
   *    trois. Deviner serait choisir à la place du joueur une forme
   *    qu'il garde pour toujours.
   *
   *  L'IDENTIFIANT DE L'ESPÈCE, PAS SON RANG dans les possibilités —
   *  même raison que la capacité : le rang dit OÙ était le choix dans
   *  une liste, pas LEQUEL, et cette liste change avec le niveau et le
   *  contenu du sac.
   *
   *  LA CONDITION N'EST PAS DANS LE BLOC. Le bloc dit « je demande », il
   *  ne dit jamais « j'ai le droit » : c'est la relève qui relit
   *  `data/evolutions.json`, le niveau, le sac et les étoiles. Taper le
   *  bloc à la main ne donne donc aucun avantage, comme pour les huit
   *  autres. */
  | { readonly type: "evoluer"; readonly position: number; readonly espece: number }
  /** « Purifie ce Pokémon Obscur. » La position, de 1 à 6.
   *
   *  SANS CIBLE À CHOISIR : purifier ne transforme pas, ça rouvre une
   *  conscience. Et la jauge retombe à zéro — « au moment de la
   *  purification, on retombe à 0 », 23 novembre. */
  | { readonly type: "purifier"; readonly position: number };

export const VERBES = [
  "chercher",
  "fouiller",
  "attaquer",
  "ball",
  "objet",
  "changer",
  "fuir",
  "defier",
  "accepter",
  "gerer",
  "confier",
  "prendre",
  "reprendre",
  "evoluer",
  "purifier",
] as const;

/** Les cases d'une équipe. Six, comme partout dans ce jeu. */
export const EQUIPE_MAX = 6;

export type Verbe = (typeof VERBES)[number];

/** `[[WM-ACTION:<verbe>]]`, en texte brut.
 *
 *  Du texte, pas une balise : un message traverse l'éditeur de
 *  Forumactif, le BBCode, le nettoyage des balises et la version mobile.
 *  Un `<span data-…>` peut ne pas survivre à tout ça ; une suite de
 *  caractères, si. C'est le même raisonnement que pour le marqueur de
 *  vérification, et il a déjà été payé une fois.
 *
 *  Le préfixe est `WM-ACTION` et pas `WM` : les deux blocs ne doivent
 *  jamais pouvoir être confondus par une expression trop gourmande.
 *
 *  ── ET IL PORTE JUSQU'À DEUX ARGUMENTS, DEPUIS LE 23 NOVEMBRE ───────
 *
 *  Il n'en portait qu'un, et ça a tenu pour huit verbes : attaquer dit
 *  LAQUELLE, changer dit LAQUELLE, défier ne dit rien. `evoluer` est le
 *  premier à devoir dire deux choses — QUEL Pokémon, et VERS QUOI —
 *  parce que l'annexe laisse le choix de la forme au joueur :
 *  « Chenipotte : Blindalys ou Armulys, Débugant : Kiclee, Tygnon ou
 *  Kapoera, etc. »
 *
 *  LES TROIS CONTOURNEMENTS ÉTAIENT PIRES, et c'est pour ça que la
 *  forme change plutôt qu'eux :
 *
 *    · deviner la cible quand il n'y en a qu'une et demander au joueur
 *      sinon aurait fait DEUX mécaniques pour un seul verbe, dont une
 *      qui demande un aller-retour de messages ;
 *    · encoder les deux dans un seul nombre (`3470`) aurait été un
 *      format qu'on ne peut plus lire à l'œil, dans un bloc dont tout
 *      l'intérêt est de rester lisible dans un vieux message ;
 *    · un second bloc dans le même message aurait cassé la seule règle
 *      qui compte ici — une seule action par message.
 *
 *  LES BLOCS DÉJÀ POSTÉS NE CHANGENT PAS DE SENS : un argument reste un
 *  argument, deux sont nouveaux, et aucun verbe existant n'en lit un
 *  second. C'est la même prudence que pour `chercher:<lieu>`, qui se lit
 *  encore alors que les lieux n'existent plus. */
const FORME = /\[\[WM-ACTION:([a-z]+)(?::([a-z0-9-]+))?(?::([a-z0-9-]+))?\]\]/g;

function estUnVerbe(valeur: string): valeur is Verbe {
  return (VERBES as readonly string[]).includes(valeur);
}

/** L'argument d'une action, ou rien. Un seul endroit décide de la
 *  forme écrite, pour que `ecrireUneAction` et `actionDe` ne puissent
 *  pas diverger. */
function argumentDe(action: Action): string {
  switch (action.type) {
    case "attaquer":
      return `:${action.capacite}`;
    case "ball":
    case "objet":
      return `:${action.objetId}`;
    case "changer":
    case "confier":
    case "purifier":
      return `:${action.position}`;
    case "gerer":
      return `:${action.tarif}`;
    //  LE SEUL À DEUX ARGUMENTS, ET L'ORDRE EST CELUI DE LA PHRASE :
    //  « fais évoluer celui-ci vers cette espèce ».
    case "evoluer":
      return `:${action.position}:${action.espece}`;
    default:
      return "";
  }
}

export function ecrireUneAction(action: Action): string {
  return `[[WM-ACTION:${action.type}${argumentDe(action)}]]`;
}

/** Un entier strictement positif, ou `null`.
 *
 *  `Number()` accepte « 1e3 », « 0x10 » et « 1.5 » ; aucun des trois
 *  n'est un identifiant, et aucun n'est ce que le bouton écrit. On
 *  refuse donc tout ce qui n'est pas une suite de chiffres — un bloc
 *  abîmé ne doit pas devenir une action approximative. */
function entierPositif(valeur: string | undefined): number | null {
  if (valeur === undefined || !/^[0-9]+$/.test(valeur)) return null;
  const n = Number(valeur);
  return n > 0 ? n : null;
}

/**
 * L'action demandée dans un message, ou null.
 *
 * Rend **une seule** action : la première reconnue. Un verbe inconnu est
 * ignoré plutôt que de lever — un message n'est pas un fichier de
 * configuration, et une version du forum peut écrire un bloc qu'une
 * version du serveur ne connaît pas encore. Mais un verbe inconnu ne
 * consomme pas le tour : on continue de chercher.
 */
export function actionDe(texte: string): Action | null {
  FORME.lastIndex = 0;
  for (const trouve of texte.matchAll(FORME)) {
    const verbe = trouve[1];
    const argument = trouve[2];
    //  LE SECOND ARGUMENT, QUAND IL Y EN A UN. Un seul verbe en lit un
    //  (`evoluer`) ; partout ailleurs, sa présence veut dire que le bloc
    //  est abîmé, et les gardes ci-dessous le refusent déjà en exigeant
    //  qu'il n'y ait pas d'argument de trop.
    const second = trouve[3];
    if (!estUnVerbe(verbe)) continue;
    //  « chercher » SE LIT DES DEUX FAÇONS, et rend la même chose : avec
    //  un lieu, parce que des messages en portent déjà un, et sans,
    //  parce que c'est ce que le bouton écrit depuis le 15 octobre. Le
    //  lieu est lu puis laissé de côté — il n'y a plus de table par
    //  lieu. Le message, lui, garde son texte : c'est la trace.
    if (verbe === "chercher") return { type: "chercher" };

    //  LES SIX VERBES SANS ARGUMENT. « fouiller » AVEC un lieu
    //  dit quelque chose qu'on ne sait pas honorer : fouiller vaut pour
    //  la zone entière. On passe, plutôt que de deviner ce que le
    //  joueur voulait — et « fuir », « defier », « accepter »,
    //  « prendre » et « reprendre » suivent la même règle, pour la
    //  même raison.
    if (
      verbe === "fouiller" || verbe === "fuir" || verbe === "defier" ||
      verbe === "accepter" || verbe === "prendre" || verbe === "reprendre"
    ) {
      if (!argument && !second) return { type: verbe };
      continue;
    }

    //  ── LE SEUL À DEUX ARGUMENTS ────────────────────────────────────
    //
    //  Les deux sont EXIGÉS. Un `evoluer:3` sans cible ne dit pas vers
    //  quoi, et l'annexe laisse ce choix au joueur : le compléter
    //  d'office lui donnerait une forme définitive qu'il n'a pas
    //  choisie. On préfère ne rien faire.
    //
    //  Il est traité AVANT le `entierPositif(argument)` commun parce
    //  qu'il doit lire les deux, et après les sans-argument parce qu'il
    //  n'en est pas.
    if (verbe === "evoluer") {
      const ou = entierPositif(argument);
      const vers = entierPositif(second);
      if (ou === null || vers === null || ou > EQUIPE_MAX) continue;
      return { type: "evoluer", position: ou, espece: vers };
    }

    //  TOUS LES AUTRES N'EN LISENT QU'UN. Un second argument sur
    //  « attaquer » ou « purifier » est un bloc abîmé — pas une action
    //  à deviner.
    if (second) continue;

    //  LES QUATRE QUI DISENT QUOI. Sans argument lisible, le bloc est
    //  abîmé : on ne le remplace pas par un choix par défaut. « Attaque
    //  avec n'importe laquelle » serait une décision prise à la place
    //  du joueur, dans un combat qu'il peut perdre.
    const n = entierPositif(argument);
    if (n === null) continue;
    if (verbe === "attaquer") return { type: "attaquer", capacite: n };
    if (verbe === "ball" || verbe === "objet") {
      return { type: verbe, objetId: n };
    }
    //  LA SEULE BORNE TENUE ICI, et elle est tenue ici parce qu'elle ne
    //  dépend d'aucune base : une équipe a six cases. Le reste — le
    //  Pokémon existe, il n'est pas à terre, ce n'est pas celui qui se
    //  bat déjà — se vérifie là où ces faits vivent.
    //
    //  Elle vaut pour les trois verbes qui désignent une case : changer
    //  de Pokémon, en confier un à la pension, en purifier un.
    if (
      (verbe === "changer" || verbe === "confier" || verbe === "purifier") &&
      n <= EQUIPE_MAX
    ) {
      return { type: verbe, position: n };
    }
    //  LE TARIF N'A PAS DE PLAFOND ICI. Un gérant qui demande un
    //  million n'aura pas de client, et ce n'est pas à ce fichier d'en
    //  décider : il ne connaît ni les prix du catalogue ni ce qu'un
    //  joueur gagne par clôture.
    if (verbe === "gerer") return { type: "gerer", tarif: n };
  }
  return null;
}

/** Enlève les blocs d'action d'un texte, pour l'afficher proprement.
 *  Comme pour le marqueur, on les retire de la VUE et jamais du message :
 *  c'est la trace de ce que le joueur a demandé. */
export function sansActions(texte: string): string {
  return texte.replace(FORME, "").replace(/[ \t]{2,}/g, " ");
}
