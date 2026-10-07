// ════════════════════════════════════════════════════════════════════
//  src/navigateur/theme.ts
//
//  Quel thème s'applique, et rien d'autre. Aucun DOM, aucun stockage :
//  c'est une règle, elle se teste sans navigateur.
//
//  TROIS ÉTATS, PAS DEUX. Tant que le joueur n'a rien cliqué, son choix
//  est « système » et le forum suit le réglage de sa machine. Au premier
//  clic, le choix devient explicite et ne bouge plus — y compris si le
//  système change d'avis à 19 h. C'est la seule façon d'honorer à la fois
//  « respecte mes réglages » et « je t'ai dit clair, reste clair ».
//
//  La classe est posée sur `body#modernbb` et pas sur `:root` : la
//  feuille du panneau d'administration est servie AVANT la nôtre, et une
//  variable est résolue là où elle est lue, pas là où elle est déclarée
//  (48-… §8).
// ════════════════════════════════════════════════════════════════════

export type Theme = "clair" | "sombre";

/** Ce que le joueur a choisi. « système » est le départ, pas un repli. */
export type ChoixDeTheme = Theme | "systeme";

export const CHOIX_PAR_DEFAUT: ChoixDeTheme = "systeme";

/** La classe que notre JS pose sur `body`. Le mode clair n'en a pas :
 *  c'est l'état nu, celui qu'on voit si le script ne tourne pas. */
export const CLASSE_SOMBRE = "wm-sombre";

export function estUnChoixDeTheme(valeur: unknown): valeur is ChoixDeTheme {
  return valeur === "clair" || valeur === "sombre" || valeur === "systeme";
}

/** Le thème réellement affiché. */
export function themeApplique(choix: ChoixDeTheme, systemeEstSombre: boolean): Theme {
  if (choix === "systeme") return systemeEstSombre ? "sombre" : "clair";
  return choix;
}

/** Ce que le bouton annonce : la destination, pas l'état courant. Un
 *  bouton nomme son effet — s'il affichait où l'on est, la moitié des
 *  gens cliqueraient dans le mauvais sens. */
export function destination(applique: Theme): Theme {
  return applique === "clair" ? "sombre" : "clair";
}

/** Le choix à enregistrer quand on clique. On n'écrit jamais « système »
 *  à ce moment-là : cliquer, c'est justement décider. */
export function choixApresClic(choix: ChoixDeTheme, systemeEstSombre: boolean): Theme {
  return destination(themeApplique(choix, systemeEstSombre));
}
