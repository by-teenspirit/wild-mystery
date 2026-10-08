// ════════════════════════════════════════════════════════════════════
//  Ce que ces tests protègent.
//
//  **Qu'aucun lien ne mène dans le vide.** Un `<a href="">` recharge la
//  page sans rien dire ; une adresse `javascript:` dans un fichier servi
//  par Pages serait du code exécuté au clic, sur l'accueil, pour tout le
//  monde. Les deux se règlent au même endroit : `adresse()`.
//
//  **Qu'une entrée à moitié écrite ne s'affiche pas à moitié.** Chacun
//  des sept blocs a sa règle d'écart, et elles ne sont pas les mêmes :
//  un bouton de vote sans adresse n'existe pas, un partenaire sans
//  adresse reste visible en gris.
//
//  **Qu'un fichier illisible ne vide pas l'accueil.** C'est `estVide`
//  qui décide, et le module s'en sert pour laisser le bloc de repli à
//  l'écran plutôt que de le remplacer par du blanc.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  ACCUEIL_VIDE,
  accueilDepuis,
  adresse,
  ECHELLE_MAX,
  ECHELLE_MIN,
  echelleDeLAccueil,
  estVide,
  LARGEUR_COMPOSITION,
  lignesDUnPrelien,
} from "./accueil.ts";

// ── les adresses ────────────────────────────────────────────────────

Deno.test("UNE ADRESSE QUI EXÉCUTE DU CODE EST ÉCARTÉE", () => {
  //  Le fichier est servi par Pages et lu par un script qui tourne sur
  //  le forum : une de ces adresses serait du code au clic, sur
  //  l'accueil, pour tout le monde.
  for (
    const mauvaise of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "data:text/html,<script>alert(1)</script>",
      "ftp://ailleurs.test/f",
      "vbscript:msgbox(1)",
    ]
  ) {
    assertEquals(adresse(mauvaise), "", mauvaise);
  }
});

Deno.test("les adresses honnêtes passent", () => {
  for (
    const bonne of [
      "/t12-le-contexte",
      "./annexes",
      "#haut",
      "https://exemple.test/x",
      "http://exemple.test/x",
    ]
  ) {
    assertEquals(adresse(bonne), bonne);
  }
});

Deno.test("une adresse absente rend la chaîne vide, elle ne lève pas", () => {
  for (const rien of [null, undefined, 12, {}, [], ""]) {
    assertEquals(adresse(rien), "");
  }
});

// ── le fichier entier ───────────────────────────────────────────────

Deno.test("un fichier illisible rend l'accueil vide, il ne lève pas", () => {
  for (const mauvais of [null, undefined, 12, "texte", []]) {
    assertEquals(accueilDepuis(mauvais), ACCUEIL_VIDE, JSON.stringify(mauvais) ?? "undefined");
  }
  assert(estVide(accueilDepuis(null)));
});

Deno.test("LE VRAI FICHIER DU DÉPÔT N'EST PAS VIDE", async () => {
  //  Il attrape le jour où quelqu'un renomme une clé du JSON sans
  //  toucher au code : le bloc disparaîtrait de l'accueil sans une
  //  seule erreur.
  const brut = JSON.parse(
    await Deno.readTextFile(new URL("../../data/accueil.json", import.meta.url)),
  );
  const a = accueilDepuis(brut);
  assert(!estVide(a), "data/accueil.json ne donne plus rien à afficher");
  assertEquals(a.liens.length, 7, "les sept liens rapides de la maquette");
  assert(a.contexte !== null && a.contexte.paragraphes.length >= 2);
});

// ── le contexte ─────────────────────────────────────────────────────

Deno.test("le contexte se lit, et son titre a un repli", () => {
  const a = accueilDepuis({ contexte: { chapo: "Un chapô", paragraphes: ["Un texte."] } });
  assertEquals(a.contexte?.titre, "Contexte");
  assertEquals(a.contexte?.paragraphes, ["Un texte."]);
  assertEquals(a.contexte?.lien, null);
});

Deno.test("un contexte sans une ligne de texte n'est pas dessiné", () => {
  assertEquals(accueilDepuis({ contexte: { titre: "Contexte" } }).contexte, null);
  assertEquals(accueilDepuis({ contexte: { paragraphes: ["", "  "] } }).contexte, null);
});

// ── les liens rapides ───────────────────────────────────────────────

Deno.test("UN LIEN SANS ADRESSE GARDE SON TEXTE", () => {
  //  C'est le choix du 7 octobre : Callista VOIT ce qui lui manque, et
  //  un visiteur ne clique pas dans le vide. Le module n'en fait pas un
  //  `<a>`.
  const a = accueilDepuis({ liens: [{ texte: "Bottin", url: "" }] });
  assertEquals(a.liens, [{ texte: "Bottin", url: "" }]);
});

Deno.test("un lien sans texte disparaît, même avec une adresse", () => {
  assertEquals(
    accueilDepuis({ liens: [{ url: "/t1" }, { texte: "  ", url: "/t2" }] }).liens,
    [],
  );
});

// ── les partenaires et les votes : deux règles différentes ──────────

Deno.test("un partenaire sans nom disparaît", () => {
  const a = accueilDepuis({
    partenaires: { liste: [{ url: "https://x.test" }, { nom: "Autre Forum", url: "" }] },
  });
  assertEquals(a.partenaires.liste.map((p) => p.nom), ["Autre Forum"]);
});

Deno.test("UN BOUTON DE VOTE SANS ADRESSE N'EXISTE PAS", () => {
  //  Et c'est la différence avec les partenaires : son seul contenu est
  //  une image. Sans lien, il ne reste qu'une vignette inerte, que
  //  personne ne comprendra.
  const a = accueilDepuis({
    votes: { liste: [{ nom: "Top site", url: "" }, { nom: "Autre", url: "https://v.test" }] },
  });
  assertEquals(a.votes.liste.map((v) => v.nom), ["Autre"]);
});

// ── le staff ────────────────────────────────────────────────────────

Deno.test("le staff se lit avec ses personnages", () => {
  const a = accueilDepuis({
    staff: [{
      pseudo: "Teenspirit",
      role: "Fondatrice",
      profil: "/u1",
      avatar: "https://i.test/a.png",
      personnages: ["Elijah Springsteen", "", "Adam Lockhart"],
      presence: "Présente",
    }],
  });
  //  Un nom seul reste un personnage, sans compte derrière : c'est
  //  l'état d'un forum qui n'a pas encore ouvert les profils.
  assertEquals(a.staff[0].personnages, [
    { texte: "Elijah Springsteen", url: "" },
    { texte: "Adam Lockhart", url: "" },
  ]);
  assertEquals(a.staff[0].presence, "Présente");
});

Deno.test("un personnage peut porter le compte qu'on tague", () => {
  const a = accueilDepuis({
    staff: [{
      pseudo: "Teenspirit",
      personnages: [
        { nom: "Arceus", url: "/u1" },
        { texte: "Maître du Jeu", url: "/u3" },
        { nom: "", url: "/u9" },
        { nom: "Sans compte" },
        "Un nom tout seul",
        42,
      ],
    }],
  });
  //  Les deux orthographes du fichier — « nom » et « texte » —, le
  //  compte sans nom qui disparaît, celui sans adresse qui reste, la
  //  chaîne nue, et le nombre qu'on jette.
  assertEquals(a.staff[0].personnages, [
    { texte: "Arceus", url: "/u1" },
    { texte: "Maître du Jeu", url: "/u3" },
    { texte: "Sans compte", url: "" },
    { texte: "Un nom tout seul", url: "" },
  ]);
});

Deno.test("un membre sans pseudo disparaît", () => {
  assertEquals(accueilDepuis({ staff: [{ role: "Fondatrice" }] }).staff, []);
});

// ── les actualités ──────────────────────────────────────────────────

Deno.test("la catégorie d'une actualité est mise en capitales", () => {
  //  La maquette les veut en petites capitales. On met la MAJUSCULE ici
  //  plutôt que de compter sur `text-transform` : une catégorie est
  //  aussi lue à voix haute, et « évènement » se lit mieux que « é-v-è ».
  const a = accueilDepuis({
    actualites: { liste: [{ titre: "Le Festival", categorie: "événement", date: "18 sept" }] },
  });
  assertEquals(a.actualites.liste[0].categorie, "ÉVÉNEMENT");
});

Deno.test("une actualité sans titre disparaît", () => {
  const a = accueilDepuis({ actualites: { liste: [{ date: "18 sept", categorie: "ZONE" }] } });
  assertEquals(a.actualites.liste, []);
});

// ── les pré-liens ───────────────────────────────────────────────────

Deno.test("une bulle de pré-lien n'a besoin que du nom du personnage", () => {
  const a = accueilDepuis({ preliens: { liste: [{ personnage: "Elijah" }] } });
  assertEquals(a.preliens.liste.length, 1);
  assertEquals(a.preliens.liste[0].avatar, "");
});

Deno.test("L'INFOBULLE NE MONTRE QUE LES LIGNES QU'ELLE A", () => {
  //  Une infobulle qui dit « Attendu par : » suivi de rien fait douter
  //  du reste.
  const complet = {
    personnage: "Elijah",
    avatar: "",
    lienAttendu: "Un rival d'enfance",
    auteur: "Teenspirit",
    url: "/t42",
  };
  assertEquals(lignesDUnPrelien(complet), [
    { cle: "Lien attendu", valeur: "Un rival d'enfance" },
    { cle: "Attendu par", valeur: "Teenspirit" },
  ]);
  assertEquals(
    lignesDUnPrelien({ ...complet, auteur: "" }),
    [{ cle: "Lien attendu", valeur: "Un rival d'enfance" }],
  );
  assertEquals(lignesDUnPrelien({ ...complet, lienAttendu: "", auteur: "" }), []);
});

// ── les images ──────────────────────────────────────────────────────

Deno.test("les images se lisent, et une adresse douteuse est écartée", () => {
  const a = accueilDepuis({
    images: {
      mascotte: "https://i.test/krokorok.png",
      fond: "javascript:alert(1)",
    },
  });
  assertEquals(a.images.mascotte, "https://i.test/krokorok.png");
  assertEquals(a.images.fond, "", "une image est une adresse comme une autre");
});

Deno.test("LE VRAI FICHIER PORTE SA MASCOTTE, ET PLUS DE BANDEAU", async () => {
  //  Elle est servie par le dépôt (`img/accueil/`), pas par un
  //  hébergeur tiers : ce test attrape le jour où quelqu'un renomme le
  //  dossier sans toucher au JSON.
  //
  //  ET IL ATTRAPE LE RETOUR DU BANDEAU. `bandeau-staff.png` a été
  //  supprimé le 7 octobre : c'était une image, donc une chose qui ne
  //  suit pas le thème, et en sombre elle était le seul bloc clair de
  //  la page. Son dégradé est maintenant peint par `14-accueil` à
  //  partir des jetons. Le remettre serait refaire le défaut.
  const brut = JSON.parse(
    await Deno.readTextFile(new URL("../../data/accueil.json", import.meta.url)),
  );
  const a = accueilDepuis(brut);
  assert(a.images.mascotte.endsWith("/img/accueil/mascotte.png"), a.images.mascotte);
  const fichier = await Deno.stat(new URL("../../img/accueil/mascotte.png", import.meta.url));
  assert(fichier.size > 1000, "img/accueil/mascotte.png est vide ou absent");

  assert(
    !JSON.stringify(brut).includes("bandeau"),
    "le bandeau du staff est peint par la feuille, il n'a plus à être une image",
  );
  await assertRejects(
    () => Deno.stat(new URL("../../img/accueil/bandeau-staff.png", import.meta.url)),
    Deno.errors.NotFound,
  );
});

// ── estVide ─────────────────────────────────────────────────────────

Deno.test("UN SEUL BLOC SUFFIT À NE PLUS ÊTRE VIDE", () => {
  //  Sinon le module effacerait le bloc de repli pour dessiner presque
  //  rien.
  assert(estVide(accueilDepuis({})));
  assert(!estVide(accueilDepuis({ liens: [{ texte: "Bottin", url: "" }] })));
  assert(!estVide(accueilDepuis({ preliens: { liste: [{ personnage: "Elijah" }] } })));
  //  Une image seule ne compte pas : une mascotte sans texte autour
  //  n'est pas une page d'accueil.
  assert(estVide(accueilDepuis({ images: { mascotte: "https://i.test/m.png" } })));
});

// ════════════════════════════════════════════════════════════════════
//  La mise à l'échelle. « Fais en sorte que la PA s'affiche pareil en
//  mobile et en desktop » : la même composition, réduite.
//
//  C'est une division et deux bornes — et c'est exactement le genre de
//  calcul qui se trompe de sens sans qu'on le voie, parce qu'une page
//  deux fois trop grande et une page deux fois trop petite se
//  ressemblent sur une capture.
// ════════════════════════════════════════════════════════════════════

Deno.test("à sa largeur de dessin, la composition ne bouge pas", () => {
  assertEquals(echelleDeLAccueil(LARGEUR_COMPOSITION), 1);
});

Deno.test("plus étroit, elle rétrécit dans la bonne proportion", () => {
  //  390 est la largeur de téléphone de la maquette mobile.
  assertEquals(Math.round(echelleDeLAccueil(362) * 1000) / 1000, 0.28);
  assertEquals(echelleDeLAccueil(646), 0.5);
});

Deno.test("plus large, elle grandit — « pareil » vaut dans les deux sens", () => {
  assertEquals(echelleDeLAccueil(1938), 1.5);
});

Deno.test("et elle est bornée des deux côtés", () => {
  //  Sans plancher, une mesure prise avant la mise en page (largeur 1)
  //  réduirait la page à rien et on ne verrait jamais pourquoi.
  assertEquals(echelleDeLAccueil(1), ECHELLE_MIN);
  assertEquals(echelleDeLAccueil(99999), ECHELLE_MAX);
});

Deno.test("UNE MESURE ABSENTE LAISSE LA PAGE INTACTE", () => {
  //  Zéro, NaN, une largeur négative : tous veulent dire « je n'ai pas
  //  pu mesurer ». Dans ce cas on ne touche à rien — une page à taille
  //  normale est toujours mieux qu'une page réduite à tort.
  assertEquals(echelleDeLAccueil(0), 1);
  assertEquals(echelleDeLAccueil(-100), 1);
  assertEquals(echelleDeLAccueil(Number.NaN), 1);
  assertEquals(echelleDeLAccueil(600, 0), 1);
});
