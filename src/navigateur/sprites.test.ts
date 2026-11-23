import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import {
  type CarteDeCouverture,
  type Emplacement,
  estUnStyleDeSprite,
  Sprites,
  StyleInconnu,
} from "./sprites.ts";

const CARTE: CarteDeCouverture = {
  base: "https://cdn.example/sprites@abc/sprites/pokemon",
  commit: "abc",
  styles: {
    forum: {
      anime: true,
      especes: {
        "37": {
          source: "versions/generation-vii/ultra-sun-ultra-moon/37.gif",
          fige: "assets/sprites-figes/forum/37.png",
        },
      },
    },
    "gba-ds": {
      anime: false,
      especes: {
        "37": {
          source: "versions/generation-iii/emerald/37.png",
          fige: "versions/generation-iii/emerald/37.png",
        },
      },
    },
  },
};

const sprites = (mouvementRefuse = false) => new Sprites(CARTE, mouvementRefuse);

// ── où ça bouge, où ça ne bouge pas ─────────────────────────────────

Deno.test("ça bouge en rencontre et sur la fiche, nulle part ailleurs", () => {
  const s = sprites();
  for (const ou of ["rencontre", "fiche"] as Emplacement[]) {
    assert(s.anime("forum", ou), ou);
  }
  for (const ou of ["trainer-card", "boite", "pokedex"] as Emplacement[]) {
    assertFalse(s.anime("forum", ou), ou);
  }
});

Deno.test("un style qui n'est pas animé ne bouge nulle part", () => {
  assertFalse(sprites().anime("gba-ds", "rencontre"));
});

Deno.test("qui refuse le mouvement le refuse PARTOUT, rencontre comprise", () => {
  // Le piège serait d'épargner la rencontre parce qu'elle est jolie.
  // Une personne qui demande moins d'animation ne demande pas « moins
  // sauf là où ça compte ».
  const s = sprites(true);
  for (const ou of ["rencontre", "fiche", "boite"] as Emplacement[]) {
    assertFalse(s.anime("forum", ou), ou);
  }
});

// ── l'adresse ───────────────────────────────────────────────────────

Deno.test("en rencontre, le style du forum sert le gif animé du dépôt tiers", () => {
  assertEquals(
    sprites().adresse(37, "forum", "rencontre"),
    "https://cdn.example/sprites@abc/sprites/pokemon/versions/generation-vii/ultra-sun-ultra-moon/37.gif",
  );
});

Deno.test("au Pokédex, il sert l'image figée, et elle vient de CHEZ NOUS", () => {
  // Les images figées sont produites par outils/sprites.py et vivent dans
  // notre dépôt ; elles ne doivent pas être préfixées de l'adresse du
  // dépôt des sprites.
  assertEquals(sprites().adresse(37, "forum", "pokedex"), "assets/sprites-figes/forum/37.png");
});

Deno.test("un style déjà fixe sert la même image des deux côtés", () => {
  const s = sprites();
  const attendu =
    "https://cdn.example/sprites@abc/sprites/pokemon/versions/generation-iii/emerald/37.png";
  assertEquals(s.adresse(37, "gba-ds", "rencontre"), attendu);
  assertEquals(s.adresse(37, "gba-ds", "pokedex"), attendu);
});

Deno.test("une espèce absente de la carte rend null, pas une image cassée", () => {
  assertEquals(sprites().adresse(9999, "forum", "pokedex"), null);
});

Deno.test("un style absent de la carte lève au lieu de se taire", () => {
  // Une carte régénérée sans un style est un bogue de livraison : il doit
  // se voir, pas se traduire par des cases vides chez les joueurs.
  assertThrows(() => sprites().adresse(37, "retro", "pokedex"), StyleInconnu);
});

// ── relire une adresse déjà écrite ──────────────────────────────────

Deno.test("on retrouve l'espèce dans une adresse, pour réécrire une fiche publiée", () => {
  // L'adresse d'une fiche est figée dans le message au moment où le
  // joueur le poste : la réécrire est le seul moyen que le style du
  // lecteur gagne.
  const s = sprites();
  assertEquals(s.especeDe("https://cdn.example/x/37.gif"), 37);
  assertEquals(s.especeDe("assets/sprites-figes/forum/1012.png"), 1012);
  assertEquals(s.especeDe("https://cdn.example/x/37.png?v=2"), 37);
  assertEquals(s.especeDe("https://cdn.example/x/37.png#a"), 37);
});

Deno.test("ce qui n'est pas un sprite n'est pas réécrit", () => {
  const s = sprites();
  for (
    const autre of ["https://i.imgur.com/banniere.jpg", "/images/avatar.png", "37.gif.html"]
  ) {
    assertEquals(s.especeDe(autre), null, autre);
  }
});

Deno.test("un style venu du stockage est validé avant d'être cru", () => {
  for (const bon of ["forum", "retro", "gba-ds"]) assert(estUnStyleDeSprite(bon));
  for (const mauvais of ["", "FORUM", "gen3", null, 1]) {
    assertFalse(estUnStyleDeSprite(mauvais), String(mauvais));
  }
});

// ── les chromatiques ────────────────────────────────────────────────

Deno.test("UN CHROMATIQUE PREND SON PROPRE SPRITE", () => {
  //  « Ce serait bien qu'il se tire à chaque rencontre aussi » — et un
  //  chromatique qu'on ne voit pas n'est pas un chromatique.
  const s = new Sprites(CARTE_CHROMA);
  assertEquals(
    s.adresse(172, "forum", "pokedex", true),
    "assets/sprites-figes/forum-chromatique/172.png",
  );
  assertEquals(
    s.adresse(172, "forum", "pokedex", false),
    "assets/sprites-figes/forum/172.png",
  );
});

Deno.test("SANS LE DRAPEAU, RIEN NE CHANGE — c'est le cas de tout le monde", () => {
  const s = new Sprites(CARTE_CHROMA);
  assertEquals(s.adresse(172, "forum", "pokedex"), "assets/sprites-figes/forum/172.png");
});

Deno.test("LE CHROMATIQUE N'EST PAS UN STYLE QU'ON CHOISIT", () => {
  //  `StyleDeSprite` est ce que le joueur règle dans ses préférences,
  //  et personne ne veut « tout le forum en chromatique ». L'éclat
  //  appartient à l'individu qu'on regarde, pas au lecteur.
  assertEquals(estUnStyleDeSprite("forum-chromatique"), false);
  assertEquals(estUnStyleDeSprite("forum"), true);
});

Deno.test("les autres styles ignorent le drapeau", () => {
  //  Le Pokédex et la carte montrent l'ESPÈCE, pas l'individu : il n'y
  //  a pas de dossier chromatique pour eux, et en demander un
  //  lèverait. Le drapeau y est donc sans effet, plutôt que fatal.
  const s = new Sprites(CARTE_CHROMA);
  assertEquals(s.adresse(172, "retro", "pokedex", true), "assets/sprites-figes/retro/172.png");
});

const CARTE_CHROMA = {
  commit: "abc123",
  base: "https://exemple.test/sprites",
  styles: {
    forum: {
      anime: true,
      especes: { "172": { source: "x.gif", fige: "assets/sprites-figes/forum/172.png" } },
    },
    "forum-chromatique": {
      anime: true,
      especes: {
        "172": { source: "y.gif", fige: "assets/sprites-figes/forum-chromatique/172.png" },
      },
    },
    retro: {
      anime: true,
      especes: { "172": { source: "z.gif", fige: "assets/sprites-figes/retro/172.png" } },
    },
  },
};
