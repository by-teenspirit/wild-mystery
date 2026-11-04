// ════════════════════════════════════════════════════════════════════
//  src/navigateur/sous-onglets.ts
//
//  Ce qu'un groupe de sous-onglets décide. Pur : aucun DOM.
//
//  ── POURQUOI DES SOUS-ONGLETS DANS UNE ANNEXE ───────────────────────
//
//  « Tu peux faire des sous-onglets pour faciliter la digestion des
//  explications si besoin. » Une annexe qui explique trois mécaniques
//  d'affilée fait trois écrans de texte, et on lit le premier.
//
//  ── ILS NE CACHENT RIEN QUI N'EXISTE AILLEURS ───────────────────────
//
//  C'est la règle, et elle décide de la forme : un sous-onglet range du
//  texte qui est DÉJÀ dans la page, et sans JavaScript les trois
//  sections s'affichent à la suite, avec leurs titres. Un onglet qui
//  masquerait du contenu qu'on ne peut pas atteindre autrement serait
//  un contenu perdu pour qui n'a pas de script, pour un moteur de
//  recherche, et pour un Ctrl+F.
//
//  ── ET L'ONGLET OUVERT S'ÉCRIT DANS L'ADRESSE ───────────────────────
//
//  Même règle que le carnet : un lien partageable, et le retour arrière
//  qui fonctionne. C'est ce qui permet d'écrire « voir la météo » dans
//  un message et que le lien ouvre la bonne section.
// ════════════════════════════════════════════════════════════════════

/** Le slug d'un titre, pour l'adresse et pour l'attribut.
 *
 *  LES LIGATURES D'ABORD, NFD ENSUITE : `œ` et `æ` ne se décomposent
 *  pas, et « Cœur de la forêt » sortait en `c-ur-de-la-foret`. La leçon
 *  est celle de `src/domaine/lieu.ts`, payée une fois, appliquée ici. */
export function slug(titre: string): string {
  return titre
    .trim()
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Lequel ouvrir.
 *
 * `demande` est ce que porte l'adresse (`#la-meteo`), sans le dièse.
 * On ouvre le premier quand la demande ne correspond à rien : une
 * adresse périmée doit montrer la page, pas une page vide.
 */
export function ongletActif(demande: string, clefs: readonly string[]): string | null {
  if (clefs.length === 0) return null;
  const propre = demande.replace(/^#/, "").trim().toLowerCase();
  return clefs.includes(propre) ? propre : clefs[0];
}

/**
 * Où va la flèche.
 *
 * **ELLE TOURNE**, et ce n'est pas un détail d'agrément : une rangée
 * d'onglets qui s'arrête au bout oblige à revenir en arrière touche par
 * touche, et c'est le genre de chose qu'on ne remarque qu'au clavier.
 */
export function voisin(clefs: readonly string[], actif: string, pas: number): string {
  const i = clefs.indexOf(actif);
  if (i === -1 || clefs.length === 0) return clefs[0] ?? actif;
  const n = clefs.length;
  return clefs[(((i + pas) % n) + n) % n];
}
