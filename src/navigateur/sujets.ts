// ════════════════════════════════════════════════════════════════════
//  src/navigateur/sujets.ts
//
//  Les règles de la liste des sujets d'une zone. Que du calcul sur des
//  chaînes : le DOM est dans `adaptateurs/navigateur/module-zone.ts`.
//
//  ── UNE PASTILLE EST UN MOT QUE LES JOUEURS ÉCRIVENT DÉJÀ ───────────
//
//  La maquette `301:13` pose quatre pastilles devant le titre d'un
//  sujet : LIBRE, PV, -16, TERMINÉ. Aucune ne peut venir du template :
//  `topics_list_box` ne porte rien de tel, et Forumactif n'a pas de
//  champ « étiquette » sur un sujet.
//
//  Elles ne peuvent donc venir que du TITRE, où les joueurs les
//  écrivent déjà — « [LIBRE] La descente par le versant nord ». C'est
//  la convention de tous les forums RP, et elle a l'avantage de rester
//  lisible sans JavaScript : le crochet reste du texte.
//
//  ── CE QU'ON NE FAIT PAS ────────────────────────────────────────────
//
//  **On ne connaît pas la liste des étiquettes.** On ne la décide pas
//  non plus. Toute étiquette entre crochets devient une pastille ; les
//  quatre de la maquette reçoivent la couleur que la maquette leur
//  donne, les autres une couleur neutre. Une nouvelle étiquette
//  n'attend donc pas une modification du code pour s'afficher, elle
//  attend juste qu'on décide de sa couleur — ou pas.
//
//  **On ne touche pas aux parenthèses.** « (PV) » reste dans le titre.
//  Choisir les deux ouvrirait la porte aux titres qui commencent par
//  une incise, et « (enfin) Le retour de Nael » perdrait son premier
//  mot. Si Callista constate que les joueurs écrivent des parenthèses,
//  c'est une ligne à changer ici, et le harnais la dira.
// ════════════════════════════════════════════════════════════════════

/** L'état d'un sujet, tel que la maquette `301:13` le dessine : un rond
 *  plein, un rond vide, une croix. Et pas un de plus — la légende de la
 *  maquette en annonce trois, le gabarit de Forumactif en sert dix. */
export type EtatDeSujet = "neuf" | "lu" | "verrouille";

/**
 * L'état d'un sujet, lu dans l'adresse de son icône de dossier.
 *
 * ── POURQUOI PAS EN CSS ─────────────────────────────────────────────
 *
 * `topics_list_box` pose l'icône en **style en ligne** sur le `<dl>` :
 * `style="background-image:url('…folder_locked.png')"`. Aucun sélecteur
 * n'atteint le contenu d'un style en ligne — on ne peut pas écrire
 * « quand l'adresse contient locked ». Il faut donc la lire, et c'est
 * la seule raison pour laquelle ce rond passe par du JavaScript.
 *
 * ── CE QU'ON FAIT DES SEPT AUTRES ───────────────────────────────────
 *
 * Forumactif distingue aussi le populaire, l'annonce, le post-it et
 * l'annonce globale. La maquette n'en montre aucun. On ne les invente
 * pas : « populaire » et « annonce » retombent sur neuf ou lu selon
 * qu'ils portent `_new`, ce qui est leur moitié utile — reste-t-il
 * quelque chose à lire ?
 */
export function etatDuSujet(adresse: string | null | undefined): EtatDeSujet {
  const nu = (adresse ?? "").toLowerCase();
  if (nu === "") return "lu";
  if (nu.includes("lock")) return "verrouille";
  return /(^|[^a-z])new/.test(nu) ? "neuf" : "lu";
}

/** Au-delà, ce n'est plus une étiquette mais une ligne d'étiquettes, et
 *  le titre ne se lit plus. Trois tiennent dans la largeur de la
 *  maquette (560 px). */
const MAXIMUM = 3;

/** Une étiquette plus longue qu'un titre n'est pas une étiquette. */
const LONGUEUR_MAXIMALE = 16;

export type Pastille = {
  /** Le texte affiché, en capitales. */
  readonly libelle: string;
  /** Le modificateur du composant `.wm-sujet`, déjà dessiné au § 4 de
   *  `css/13-composants.css` : « Libre, PV, -16, Terminé ».
   *
   *  ── ON NE REDESSINE PAS CE QUI EXISTE ───────────────────────────
   *
   *  La charte porte ce composant depuis le 11 octobre, contrastes
   *  mesurés compris — c'est là qu'est écrit « texte-doux, pas
   *  texte-pale : pale donne 4,16 en thème sombre et doux 5,51 ».
   *  Inventer ici quatre couleurs d'après la maquette aurait refait ce
   *  travail, moins bien.
   *
   *  Et le commentaire de ce composant dit son intention : « elle est
   *  posée par le gabarit, pas tapée par le joueur — sans elle on se
   *  retrouve avec [pv], (PV), P.V. et pv dans le même forum ». Le
   *  gabarit ne peut pas la poser, Forumactif n'a pas de champ pour
   *  ça ; mais la NORMALISATION, elle, se fait ici : `libelleCanonique`
   *  rend « PV » pour [pv] comme pour [Privé].
   *
   *  `libre` et `neutre` partagent le composant nu : c'est son état par
   *  défaut, et une étiquette inconnue n'a pas à se déguiser en
   *  étiquette connue. */
  readonly ton: "libre" | "pv" | "16" | "termine" | "neutre";
};

export type TitreDeSujet = {
  readonly pastilles: readonly Pastille[];
  /** Le titre débarrassé de ses étiquettes. Jamais vide. */
  readonly titre: string;
};

/** La couleur d'une étiquette, d'après la maquette `301:13`.
 *
 *  Les tranches d'âge sont reconnues par leur FORME — un nombre avec un
 *  signe — et pas par une liste : « -16 », « -18 », « +16 » et « 18+ »
 *  s'écrivent tous, et personne n'ira ajouter « -21 » dans le code le
 *  jour où il sort. */
export function tonDeLEtiquette(libelle: string): Pastille["ton"] {
  const nu = libelle.toLocaleUpperCase("fr").trim();
  if (/^[-+]?\s?\d{1,2}\s?[-+]?$/.test(nu) && /[-+]/.test(nu)) return "16";
  if (nu === "LIBRE" || nu === "OUVERT") return "libre";
  if (nu === "PV" || nu === "PRIVÉ" || nu === "PRIVE") return "pv";
  if (nu === "TERMINÉ" || nu === "TERMINE" || nu === "CLOS" || nu === "FINI") return "termine";
  return "neutre";
}

/** Le libellé affiché : celui du joueur, en capitales, sauf pour les
 *  trois étiquettes que la charte nomme — elles prennent SON orthographe.
 *
 *  C'est ce que le composant attendait du gabarit : [pv], (PV), P.V. et
 *  pv ne doivent pas faire quatre étiquettes différentes dans le même
 *  forum. La tranche d'âge, elle, garde ce qui est écrit : « -16 » et
 *  « -18 » ne veulent pas dire la même chose. */
export function libelleCanonique(libelle: string, ton: Pastille["ton"]): string {
  if (ton === "libre") return "LIBRE";
  if (ton === "pv") return "PV";
  if (ton === "termine") return "TERMINÉ";
  return libelle.toLocaleUpperCase("fr");
}

/**
 * Sépare les étiquettes de tête du titre d'un sujet.
 *
 * Rend le titre tel quel, sans aucune pastille, dans tous les cas
 * douteux : pas de crochet, crochet vide, étiquette à rallonge, ou
 * titre qui ne serait plus QUE des étiquettes. **Un sujet sans pastille
 * est normal ; un sujet sans titre est une ligne qu'on ne peut plus
 * cliquer.**
 */
export function titreEtPastilles(brut: string): TitreDeSujet {
  const entier = brut.replace(/\s+/g, " ").trim();
  const pastilles: Pastille[] = [];
  let reste = entier;

  while (pastilles.length < MAXIMUM) {
    const trouve = /^\[\s*([^\]]{1,40}?)\s*\]\s*/.exec(reste);
    if (trouve === null) break;
    const libelle = trouve[1].replace(/\s+/g, " ").trim();
    if (libelle === "" || libelle.length > LONGUEUR_MAXIMALE) break;
    const ton = tonDeLEtiquette(libelle);
    pastilles.push({ libelle: libelleCanonique(libelle, ton), ton });
    reste = reste.slice(trouve[0].length);
  }

  //  Le titre était fait d'étiquettes et de rien d'autre : on rend tout,
  //  intact. Mieux vaut « [LIBRE] » en titre qu'une ligne muette.
  if (reste === "") return { pastilles: [], titre: entier };
  return { pastilles, titre: reste };
}
