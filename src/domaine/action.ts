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

/** Le vocabulaire, volontairement court. Il s'ouvrira avec le combat
 *  (`attaquer`, `ball`, `objet`, `fuir`), et pas avant : une action que
 *  le serveur ne sait pas honorer n'a rien à faire dans un bouton. */
export type Action =
  /** Le lieu est une CLÉ, pas un nom : voir `lieu.ts`.
   *
   *  IL EST OPTIONNEL DEPUIS LE 15 OCTOBRE, et ce n'est pas un
   *  relâchement — c'est une décision de Callista : « on est déjà dans
   *  une zone sauvage, avec un palier (fleuve paisible etc.), donc y'a
   *  pas d'autres zones à rajouter. » Le joueur ne choisit donc JAMAIS
   *  de lieu. C'est le serveur qui le tire parmi ceux de la zone, avec
   *  la graine du message — donc reproductible, et rejouable des années
   *  plus tard pour trancher une contestation.
   *
   *  CE QUE CETTE NOTE DISAIT AVANT : « il est obligatoire, parce qu'une
   *  zone a quinze lieux et qu'on ne tire pas une rencontre sans savoir
   *  où. » Le raisonnement était juste et la conclusion fausse : il faut
   *  savoir où, mais ce n'est pas au joueur de le dire. C'est ce
   *  glissement qui avait mis un menu déroulant dans la barre — un menu
   *  qui ne faisait rien au clic, et qui a coûté un essai sur le forum.
   *
   *  ON CONTINUE DE LE LIRE QUAND IL EST LÀ. Des messages portant
   *  `[[WM-ACTION:chercher:etang-vaseux]]` sont déjà postés — un sur
   *  `t976`. **Un message posté ne change pas de sens parce qu'on a
   *  changé le bouton.** Le lieu écrit à la main l'emporte donc sur le
   *  tirage, et c'est la seule façon de ne pas réécrire le passé. */
  | { readonly type: "chercher"; readonly lieu?: string }
  /** Sans argument : fouiller vaut pour la zone entière, et le butin suit
   *  son palier (`fouille.ts`). */
  | { readonly type: "fouiller" };

export const VERBES = ["chercher", "fouiller"] as const;

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
 *  jamais pouvoir être confondus par une expression trop gourmande. */
const FORME = /\[\[WM-ACTION:([a-z]+)(?::([a-z0-9-]+))?\]\]/g;

function estUnVerbe(valeur: string): valeur is Verbe {
  return (VERBES as readonly string[]).includes(valeur);
}

export function ecrireUneAction(action: Action): string {
  //  Le bouton n'écrit plus de lieu. La forme à deux parties reste
  //  écrivable — et c'est utile pour rejouer un ancien message à
  //  l'identique — mais plus personne ne la produit depuis l'interface.
  if (action.type !== "chercher") return `[[WM-ACTION:${action.type}]]`;
  return action.lieu === undefined
    ? "[[WM-ACTION:chercher]]"
    : `[[WM-ACTION:chercher:${action.lieu}]]`;
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
    if (!estUnVerbe(verbe)) continue;
    //  « chercher » SE LIT DES DEUX FAÇONS : avec un lieu, parce que des
    //  messages en portent déjà un, et sans, parce que c'est ce que le
    //  bouton écrit depuis le 15 octobre. Les deux disent « fais
    //  apparaître un Pokémon » ; seul le tirage du lieu change de main.
    if (verbe === "chercher") {
      return argument ? { type: "chercher", lieu: argument } : { type: "chercher" };
    }
    //  « fouiller » AVEC un lieu, en revanche, dit quelque chose qu'on ne
    //  sait pas honorer : fouiller vaut pour la zone entière. On passe,
    //  plutôt que de deviner ce que le joueur voulait.
    if (!argument) return { type: verbe };
  }
  return null;
}

/** Enlève les blocs d'action d'un texte, pour l'afficher proprement.
 *  Comme pour le marqueur, on les retire de la VUE et jamais du message :
 *  c'est la trace de ce que le joueur a demandé. */
export function sansActions(texte: string): string {
  return texte.replace(FORME, "").replace(/[ \t]{2,}/g, " ");
}
