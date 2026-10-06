// ════════════════════════════════════════════════════════════════════
//  Ce que ces tests protègent.
//
//  **Qu'un lien de barre sans adresse n'arrive jamais dans la barre.** La
//  barre n'affiche que des destinations ; c'est le panneau latéral qui
//  montre ce qui n'existe pas encore.
//
//  **Qu'une adresse de compte ne se fabrique pas à moitié.** Un
//  `/u{id}` affiché tel quel dans un menu est un lien qui mène à une
//  page d'erreur, sous un libellé qui promet le profil.
//
//  **Que l'accueil ne soit pas actif partout.** Son adresse est `/`, donc
//  tout commence par elle : sans traitement à part, les cinq liens
//  seraient surlignés sur chaque page.
//
//  **Et qu'aucun personnage ne s'invente.** La liste vient du switcheroo,
//  pas d'un fichier : ce qu'il ne donne pas ne s'affiche pas.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  adresseDeCompte,
  type Lien,
  lienCourant,
  navigationDepuis,
  personnagesDepuis,
} from "./navigation.ts";

const DONNEES = {
  liens: [
    { clef: "accueil", titre: "Accueil", adresse: "/" },
    { clef: "rechercher", titre: "Rechercher", adresse: "/search" },
    { clef: "messagerie", titre: "Messagerie", adresse: "/privmsg" },
  ],
  utiles: [
    { icone: "map", titre: "Carte de Rhode", adresse: null },
    { icone: "science", titre: "Laboratoire fossile", adresse: "/f25-laboratoire" },
  ],
  compte: [
    { icone: "visibility", titre: "Voir mon profil", modele: "/u{id}" },
    { icone: "mail", titre: "Mes messages", modele: "/privmsg" },
    { icone: "menu_book", titre: "Mon carnet de bord", modele: null },
  ],
};

// ── la lecture ──────────────────────────────────────────────────────

Deno.test("un fichier complet se lit entier", () => {
  const n = navigationDepuis(DONNEES);
  assertEquals(n.liens.map((l) => l.titre), ["Accueil", "Rechercher", "Messagerie"]);
  assertEquals(n.utiles.map((u) => u.adresse), [null, "/f25-laboratoire"]);
  assertEquals(n.compte.map((c) => c.modele), ["/u{id}", "/privmsg", null]);
});

Deno.test("un fichier illisible rend tout vide, il ne lève pas", () => {
  for (const brut of [null, undefined, 3, "non", [], {}]) {
    const n = navigationDepuis(brut);
    assertEquals([n.liens.length, n.utiles.length, n.compte.length], [0, 0, 0]);
  }
});

Deno.test("UN LIEN DE BARRE SANS ADRESSE N'ENTRE PAS DANS LA BARRE", () => {
  const n = navigationDepuis({
    liens: [
      { clef: "bon", titre: "Bon", adresse: "/search" },
      { clef: "sans", titre: "Sans adresse" },
      { clef: "nulle", titre: "Nulle", adresse: null },
      { clef: "", titre: "Sans clef", adresse: "/x" },
      { clef: "sortante", titre: "Sortante", adresse: "https://ailleurs.example" },
      { clef: "double", titre: "Double barre", adresse: "//ailleurs.example" },
      null,
    ],
  });
  assertEquals(n.liens.map((l) => l.titre), ["Bon"]);
});

Deno.test("un lien utile sans adresse reste affiché : c'est le panneau qui le dit", () => {
  const n = navigationDepuis({
    utiles: [{ icone: "map", titre: "Carte de Rhode" }, { titre: "Sans icône" }, {
      icone: "x",
    }],
  });
  assertEquals(n.utiles.map((u) => `${u.titre} · ${u.icone}`), [
    "Carte de Rhode · map",
    "Sans icône · ",
  ]);
});

Deno.test("un nom d'icône inattendu est jeté, pas affiché", () => {
  //  L'icône entre dans le DOM comme TEXTE : la police lit le mot, et un
  //  mot qu'elle ne connaît pas s'écrirait en toutes lettres au milieu
  //  de la barre.
  for (const i of ["Map", "map-pin", "map pin", "<b>", "", 42, null, "a".repeat(33)]) {
    const n = navigationDepuis({ utiles: [{ icone: i, titre: "X" }] });
    assertEquals(n.utiles[0].icone, "", JSON.stringify(i));
  }
  assertEquals(
    navigationDepuis({ utiles: [{ icone: "emoji_events", titre: "X" }] }).utiles[0].icone,
    "emoji_events",
  );
});

// ── les adresses du menu de compte ──────────────────────────────────

Deno.test("UNE ADRESSE DE COMPTE NE SE FABRIQUE PAS À MOITIÉ", () => {
  const n = navigationDepuis(DONNEES);
  const [profil, messages, carnet] = n.compte;

  assertEquals(adresseDeCompte(profil, 4), "/u4");
  assertEquals(adresseDeCompte(messages, 4), "/privmsg");
  assertEquals(adresseDeCompte(carnet, 4), null, "pas de page : pas de lien");

  //  Sans identifiant, un modèle qui en demande un ne rend RIEN — surtout
  //  pas « /u{id} » écrit en toutes lettres.
  for (const id of [null, 0, -3, 1.5]) {
    assertEquals(adresseDeCompte(profil, id as number | null), null, String(id));
  }
  //  Celui qui n'en demande pas marche quand même.
  assertEquals(adresseDeCompte(messages, null), "/privmsg");
});

// ── le lien courant ─────────────────────────────────────────────────

Deno.test("L'ACCUEIL N'EST PAS ACTIF PARTOUT", () => {
  const { liens } = navigationDepuis(DONNEES);
  const titre = (chemin: string): string | null => lienCourant(liens, chemin)?.titre ?? null;

  assertEquals(titre("/"), "Accueil");
  assertEquals(titre("/forum"), "Accueil");
  assertEquals(titre(""), "Accueil");
  //  Le piège : tout chemin commence par « / ».
  assertEquals(titre("/t977-boutique-de-rhode"), null);
  assertEquals(titre("/f9-foret-marecageuse"), null);
});

Deno.test("le lien le plus précis gagne", () => {
  const { liens } = navigationDepuis(DONNEES);
  const titre = (chemin: string): string | null => lienCourant(liens, chemin)?.titre ?? null;

  assertEquals(titre("/search"), "Rechercher");
  assertEquals(titre("/search?search_id=egosearch"), "Rechercher");
  assertEquals(titre("/privmsg"), "Messagerie");
  assertEquals(titre("/privmsg?mode=post"), "Messagerie");
  //  Un chemin qui COMMENCE par les mêmes lettres sans être le même :
  //  `/searchons` n'est pas `/search`.
  assertEquals(titre("/searchons"), null);
});

Deno.test("une barre vide ne rend jamais de lien courant", () => {
  const vides: readonly Lien[] = [];
  assertEquals(lienCourant(vides, "/"), null);
});

// ── les personnages ─────────────────────────────────────────────────

Deno.test("AUCUN PERSONNAGE NE S'INVENTE", () => {
  const p = personnagesDepuis([
    {
      nom: "Elijah Lustgarten",
      adresse: "/u12",
      image: "https://i.example/a.png",
      actif: true,
    },
    { nom: "  ", adresse: "/u13" },
    { nom: "Charlie Spinster", adresse: null },
    { nom: "Elijah Lustgarten", adresse: "/u99" },
    { nom: "Nael Ardent", adresse: "/u14", image: "pas une adresse" },
  ]);
  assertEquals(p.map((x) => x.nom), ["Elijah Lustgarten", "Charlie Spinster", "Nael Ardent"]);
  assertEquals(p[1].adresse, null, "sans adresse : affiché, mais il ne bascule pas");
  assertEquals(p[2].image, null, "une image qui n'est pas une adresse ne s'affiche pas");
  assertEquals(p.filter((x) => x.actif).length, 1);
});

Deno.test("une liste vide rend une liste vide : la section ne s'affiche pas", () => {
  assertEquals(personnagesDepuis([]).length, 0);
});
