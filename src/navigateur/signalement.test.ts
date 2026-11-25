import { assert, assertEquals } from "@std/assert";
import { ficheVide } from "./fiche.ts";
import type { Fiche } from "./fiche.ts";
import { coupeLeNom, genreDesPronoms, messageDeSignalement } from "./signalement.ts";

function fiche(modif: Partial<Fiche> = {}): Fiche {
  return { ...ficheVide(), ...modif };
}

function message(modif: Partial<Fiche> = {}, compte = "Jake Dalziel"): string {
  return messageDeSignalement({
    fiche: fiche(modif),
    compte,
    presentation: "https://mysteryinrhode.forumactif.com/t1017-jake",
  });
}

Deno.test("le lien de la présentation est celui d'où l'on clique", () => {
  assert(
    message().includes(
      "<y>LIEN DE LA PRÉSENTATION :</y> https://mysteryinrhode.forumactif.com/t1017-jake",
    ),
  );
});

Deno.test("le métier n'est jamais rempli — il a son bottin", () => {
  const m = message({
    nom: "Jake Dalziel",
    identite: { metier: "Mécanicien" },
  });
  assert(!m.includes("Mécanicien"));
  assert(m.includes("<f>Nom du métier ici :</f>"));
});

Deno.test("le compte devient la mention du formulaire", () => {
  assert(message({}, "Erin Kavanagh").includes('@"Erin Kavanagh"'));
});

Deno.test("les trois questions du répertoire sont posées", () => {
  const m = message();
  for (const q of ["RÉGION D'ORIGINE", "STATUT MARITAL", "LIEU DE VIE"]) {
    assert(m.includes(`<y>${q} :</y>`), q);
  }
});

Deno.test("une fiche vide garde les invites de Callista, mot pour mot", () => {
  const m = message({}, "");
  assert(m.includes("mettre le nom du créateur le cas échéant."));
  assert(m.includes('@"Nom du compte"'));
  assert(m.includes("<t>Votre célébrité</t>"));
  assert(m.includes("type de logement - colocation possible/impossible"));
});

Deno.test("« uc » n'est pas une réponse et ne se recopie pas", () => {
  //  La fiche d'essai de Jake en est pleine. Le laisser passer ferait
  //  entrer « uc » dans le bottin, puis dans le répertoire.
  const m = message({
    nom: "Jake Dalziel",
    identite: { statut: "uc", origine: "uc", pronoms: "il" },
    joueur: { "j-type": "uc", "j-avatar": "uc" },
  });
  assert(!m.includes("uc<"));
  assert(!m.includes("> uc"));
  assert(m.includes("<t>Votre célébrité</t>"));
});

Deno.test("le genre du prénom vient des pronoms", () => {
  assertEquals(genreDesPronoms("elle/she"), "f");
  assertEquals(genreDesPronoms("il/he/him"), "m");
  assertEquals(genreDesPronoms("iel"), null);
  assertEquals(genreDesPronoms(""), null);
  //  LES DEUX À LA FOIS NE TRANCHENT PAS. Un personnage qui écrit
  //  « il/elle » répond aux deux, et choisir pour lui serait pire que
  //  laisser les deux lignes.
  assertEquals(genreDesPronoms("il/elle"), null);
});

Deno.test("sans pronoms lisibles, les deux lignes du bottin restent", () => {
  const m = message({ nom: "Sam Rivers", identite: { pronoms: "iel" } });
  assert(m.includes("<t>Prénom féminin</t>"));
  assert(m.includes("<l>Prénom masculin</l>"));
});

Deno.test("avec des pronoms lisibles, une seule ligne porte le prénom", () => {
  const m = message({ nom: "Erin Kavanagh", identite: { pronoms: "elle/she" } });
  assert(m.includes("<t>Erin</t>"));
  assert(!m.includes("Prénom masculin"));
});

Deno.test("le nom de famille se détache du prénom", () => {
  assertEquals(coupeLeNom("Erin Kavanagh"), { prenom: "Erin", famille: "Kavanagh" });
  assertEquals(coupeLeNom("Arceus"), { prenom: "Arceus", famille: "" });
  assertEquals(coupeLeNom("  Jake  Van   Doren "), { prenom: "Jake", famille: "Van Doren" });
  assertEquals(coupeLeNom(""), { prenom: "", famille: "" });
});

Deno.test("le bloc ombre range la famille du bon côté", () => {
  const sans = message({ nom: "Erin Kavanagh" });
  assert(sans.includes("<y>KAVANAGH</y>"));
  const avec = message({ nom: "Erin Kavanagh", ombre: { "o-avis": "oui" } });
  assert(avec.includes("<o>KAVANAGH</o>"));
});

Deno.test("un personnage sans nom de famille garde l'invite", () => {
  const m = message({ nom: "Arceus" });
  assert(m.includes("<y>NOM DE FAMILLE</y>"));
});

Deno.test("un champ de plusieurs phrases ne devient pas une étiquette", () => {
  //  « Célibataire, bien que son cœur soit fermé depuis bien
  //  longtemps » est une réponse de fiche, pas une étiquette de
  //  bottin. On garde le premier membre, et rien d'autre.
  const m = message({
    identite: {
      statut: "célibataire, bien que son cœur soit fermé depuis bien longtemps",
      origine: "originaire d'alola, elle est née à malié",
    },
  });
  assert(m.includes("<y>STATUT MARITAL :</y> célibataire"));
  assert(!m.includes("cœur"));
  assert(m.includes("<y>RÉGION D'ORIGINE :</y> originaire d'alola"));
});

Deno.test("une réponse trop longue même coupée laisse l'invite", () => {
  const m = message({
    identite: {
      statut: "il est compliqué de répondre à cette question en un seul mot franchement",
    },
  });
  assert(m.includes("<y>STATUT MARITAL :</y> réponse ici."));
});
