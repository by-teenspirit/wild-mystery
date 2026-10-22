// ════════════════════════════════════════════════════════════════════
//  src/navigateur/sujets.test.ts
//
//  Ce que ces tests protègent.
//
//  **Qu'un titre reste cliquable.** Toute la mécanique est une
//  découpe de chaîne, et une découpe trop gourmande rend une ligne de
//  liste muette : la pastille serait jolie et le sujet inaccessible.
//  La moitié des cas ci-dessous sont des titres qu'il ne faut PAS
//  découper.
//
//  **Que la couleur suive la forme, pas une liste.** « -16 » et « 18+ »
//  doivent sortir en tranche d'âge sans que personne les ait écrits
//  ici ; « LIBRE » et « TERMINÉ » gardent la couleur de la maquette,
//  accent ou non.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { etatDuSujet, libelleCanonique, titreEtPastilles, tonDeLEtiquette } from "./sujets.ts";

const libelles = (brut: string) => titreEtPastilles(brut).pastilles.map((p) => p.libelle);

// ── la découpe ──────────────────────────────────────────────────────

Deno.test("une étiquette de tête devient une pastille, et sort du titre", () => {
  const { pastilles, titre } = titreEtPastilles("[LIBRE] La descente par le versant nord");
  assertEquals(pastilles, [{ libelle: "LIBRE", ton: "libre" }]);
  assertEquals(titre, "La descente par le versant nord");
});

Deno.test("deux étiquettes sortent dans l'ordre où elles sont écrites", () => {
  assertEquals(libelles("[PV][-16] Ce qu'on a laissé à la borne douze"), ["PV", "-16"]);
});

Deno.test("UN TITRE SANS CROCHET N'EST PAS TOUCHÉ", () => {
  const { pastilles, titre } = titreEtPastilles("Le feu ne prend pas ici");
  assertEquals(pastilles, []);
  assertEquals(titre, "Le feu ne prend pas ici");
});

Deno.test("UN CROCHET AU MILIEU RESTE DANS LE TITRE", () => {
  //  Sinon on irait chercher des étiquettes au milieu d'une phrase, et
  //  un titre perdrait un morceau de son centre.
  const { pastilles, titre } = titreEtPastilles("La nuit [où] la crête a fondu");
  assertEquals(pastilles, []);
  assertEquals(titre, "La nuit [où] la crête a fondu");
});

Deno.test("UN TITRE FAIT UNIQUEMENT D'ÉTIQUETTES RESTE ENTIER", () => {
  //  Le cas qui coûterait une ligne muette : on rend tout, sans
  //  pastille, et le joueur voit son titre tel qu'il l'a écrit.
  const { pastilles, titre } = titreEtPastilles("[LIBRE] [PV]");
  assertEquals(pastilles, []);
  assertEquals(titre, "[LIBRE] [PV]");
});

Deno.test("un crochet vide n'est pas une étiquette", () => {
  assertEquals(titreEtPastilles("[] Première montée").titre, "[] Première montée");
});

Deno.test("une étiquette à rallonge reste dans le titre", () => {
  //  « [Ceci est une phrase entière] » est une incise, pas une
  //  étiquette : au-delà de seize signes on ne découpe plus.
  const brut = "[tout le monde peut venir] On monte au col";
  assertEquals(titreEtPastilles(brut).titre, brut);
});

Deno.test("on ne prend pas plus de trois étiquettes", () => {
  const { pastilles, titre } = titreEtPastilles("[A][B][C][D] Le titre");
  assertEquals(pastilles.length, 3);
  assertEquals(titre, "[D] Le titre");
});

Deno.test("les espaces en trop sont repliés, pas conservés", () => {
  const { pastilles, titre } = titreEtPastilles("  [ libre ]   La   descente  ");
  assertEquals(pastilles, [{ libelle: "LIBRE", ton: "libre" }]);
  assertEquals(titre, "La descente");
});

Deno.test("les parenthèses ne sont pas des étiquettes", () => {
  //  Décidé dans l'en-tête du module : « (enfin) Le retour de Nael »
  //  perdrait son premier mot.
  assertEquals(titreEtPastilles("(PV) Le retour de Nael").pastilles, []);
});

// ── la couleur ──────────────────────────────────────────────────────

Deno.test("LES QUATRE ÉTIQUETTES DE LA MAQUETTE ONT CHACUNE LEUR TON", () => {
  assertEquals(tonDeLEtiquette("LIBRE"), "libre");
  assertEquals(tonDeLEtiquette("PV"), "pv");
  assertEquals(tonDeLEtiquette("-16"), "16");
  assertEquals(tonDeLEtiquette("TERMINÉ"), "termine");
});

Deno.test("une tranche d'âge est reconnue à sa forme, pas à une liste", () => {
  for (const age of ["-16", "-18", "+16", "18+", "- 16"]) {
    assertEquals(tonDeLEtiquette(age), "16", age);
  }
});

Deno.test("un nombre sans signe n'est pas une tranche d'âge", () => {
  //  « [3] » est un numéro d'épisode, pas une limite d'âge.
  assertEquals(tonDeLEtiquette("3"), "neutre");
  assertEquals(tonDeLEtiquette("12"), "neutre");
});

Deno.test("la casse et les accents ne changent pas le ton", () => {
  assertEquals(tonDeLEtiquette("libre"), "libre");
  assertEquals(tonDeLEtiquette("Terminé"), "termine");
  assertEquals(tonDeLEtiquette("termine"), "termine");
  assertEquals(tonDeLEtiquette("privé"), "pv");
});

Deno.test("UNE ÉTIQUETTE INCONNUE S'AFFICHE QUAND MÊME", () => {
  //  C'est la décision du module : on n'a pas la liste des étiquettes
  //  et on ne la décide pas. Une étiquette nouvelle sort en neutre.
  assertEquals(libelles("[ÉVÈNEMENT] La fête foraine"), ["ÉVÈNEMENT"]);
  assertEquals(tonDeLEtiquette("ÉVÈNEMENT"), "neutre");
});

// ── l'état, lu dans l'adresse de l'icône ────────────────────────────

Deno.test("LES TROIS ÉTATS DE LA LÉGENDE SORTENT", () => {
  const base = "https://illiweb.com/fa/empty/";
  assertEquals(etatDuSujet(`${base}folder_new.png`), "neuf");
  assertEquals(etatDuSujet(`${base}folder.png`), "lu");
  assertEquals(etatDuSujet(`${base}folder_locked.png`), "verrouille");
});

Deno.test("un sujet verrouillé reste verrouillé même s'il est neuf", () => {
  //  L'ordre compte : `folder_locked_new.png` porte les deux mots, et
  //  ce qu'un joueur doit voir d'abord, c'est qu'il ne peut pas
  //  répondre.
  assertEquals(etatDuSujet("folder_locked_new.png"), "verrouille");
});

Deno.test("les états que la maquette ne dessine pas retombent sur neuf ou lu", () => {
  assertEquals(etatDuSujet("folder_hot_new.png"), "neuf");
  assertEquals(etatDuSujet("folder_hot.png"), "lu");
  assertEquals(etatDuSujet("folder_announce.png"), "lu");
  assertEquals(etatDuSujet("folder_sticky_new.png"), "neuf");
});

Deno.test("UNE ADRESSE ABSENTE NE FAIT PAS UN SUJET NEUF", () => {
  //  Le faux positif qui coûterait cher : un rond plein partout
  //  annoncerait des messages non lus sur toute la page, et le joueur
  //  cesserait de croire le rond.
  assertEquals(etatDuSujet(null), "lu");
  assertEquals(etatDuSujet(undefined), "lu");
  assertEquals(etatDuSujet(""), "lu");
});

Deno.test("le mot « new » doit être un mot, pas une syllabe", () => {
  //  `/fa/renewal/folder.png` ne dit pas qu'il y a du nouveau.
  assertEquals(etatDuSujet("https://exemple/renewal/folder.png"), "lu");
});

// ── le libellé canonique ────────────────────────────────────────────

Deno.test("LES QUATRE ORTHOGRAPHES DE « PV » N'EN FONT QU'UNE", () => {
  //  L'intention écrite au § 4 de `13-composants.css` : « sans elle on
  //  se retrouve avec [pv], (PV), P.V. et pv dans le même forum ». Le
  //  gabarit ne peut pas poser l'étiquette — Forumactif n'a pas de
  //  champ pour ça —, mais la normaliser, si.
  for (const ecrit of ["pv", "PV", "Privé", "prive"]) {
    assertEquals(libelles(`[${ecrit}] Un sujet`), ["PV"], ecrit);
  }
  assertEquals(libelles("[libre] Un sujet"), ["LIBRE"]);
  assertEquals(libelles("[Terminé] Un sujet"), ["TERMINÉ"]);
  assertEquals(libelles("[termine] Un sujet"), ["TERMINÉ"]);
});

Deno.test("UNE TRANCHE D'ÂGE GARDE CE QUI EST ÉCRIT", () => {
  //  « -16 » et « -18 » ne disent pas la même chose : on ne canonise
  //  que ce qui est un synonyme, jamais un nombre.
  assertEquals(libelles("[-16] Un sujet"), ["-16"]);
  assertEquals(libelles("[-18] Un sujet"), ["-18"]);
  assertEquals(libelleCanonique("18+", "16"), "18+");
});
