import { assert, assertEquals } from "@std/assert";
import { ficheVide } from "./fiche.ts";
import type { Fiche } from "./fiche.ts";
import { coupeLeNom, messageDeSignalement } from "./signalement.ts";

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

Deno.test("le prénom et le nom de famille sont posés", () => {
  const m = message({ nom: "Erin Kavanagh" }, "Erin Kavanagh");
  assert(m.includes("<t>Erin</t>"));
  assert(m.includes("<y>KAVANAGH</y>"));
});

Deno.test("le bottin des prénoms n'a plus de genre", () => {
  //  « Pas de genre dans les bottins. » Le modèle de t53 en avait
  //  deux lignes ; une ligne de moins ne se remarque pas, une de trop
  //  oblige la joueuse à supprimer celle qui ne la concerne pas.
  const m = message({ nom: "Erin Kavanagh" });
  assert(!m.includes("Prénom féminin"));
  assert(!m.includes("Prénom masculin"));
  //  UNE SEULE LIGNE SOUS LE TITRE, et c'est le prénom.
  const apres = m.split("<l>BOTTIN DES PRÉNOMS</l>\n")[1].split("\n\n")[0];
  assertEquals(apres, "<t>Erin</t>");
});

Deno.test("rien d'autre n'est rempli, même quand la fiche le sait", () => {
  //  « Ça remplit juste les champs nom et prénom automatiquement, le
  //  reste tu peux remplir toi-même. » La fiche connaît le faceclaim,
  //  le type et le statut : on ne les pose pas pour autant.
  const m = message({
    nom: "Erin Kavanagh",
    identite: { statut: "célibataire", origine: "alola", metier: "Chercheuse" },
    joueur: { "j-type": "inventé", "j-avatar": "Elizabeth Olsen" },
  });
  for (const su of ["célibataire", "alola", "Chercheuse", "inventé", "Elizabeth Olsen"]) {
    assert(!m.includes(su), su);
  }
});

Deno.test("les invites de Callista restent, mot pour mot", () => {
  const m = message({}, "");
  assert(m.includes("mettre le nom du créateur le cas échéant."));
  assert(m.includes('@"Nom du compte"'));
  assert(m.includes("<t>Votre célébrité</t>"));
  assert(m.includes("<f>Nom du métier ici :</f>"));
  assert(m.includes("type de logement - colocation possible/impossible"));
  assertEquals(m.match(/réponse ici\./g)?.length, 4);
});

Deno.test("le compte devient la mention du formulaire", () => {
  assert(message({}, "Erin Kavanagh").includes('@"Erin Kavanagh"'));
});

Deno.test("« uc » n'est pas un nom et ne se recopie pas", () => {
  //  La fiche d'essai de Jake en est pleine. Le laisser passer ferait
  //  entrer « uc » dans le bottin, puis dans le répertoire.
  const m = message({ nom: "uc" });
  assert(m.includes("<t>Prénom</t>"));
  assert(m.includes("<y>NOM DE FAMILLE</y>"));
});

Deno.test("le nom de famille se détache du prénom", () => {
  assertEquals(coupeLeNom("Erin Kavanagh"), { prenom: "Erin", famille: "Kavanagh" });
  assertEquals(coupeLeNom("Arceus"), { prenom: "Arceus", famille: "" });
  assertEquals(coupeLeNom("  Jake  Van   Doren "), { prenom: "Jake", famille: "Van Doren" });
  assertEquals(coupeLeNom(""), { prenom: "", famille: "" });
});

Deno.test("un personnage sans nom de famille garde l'invite", () => {
  const m = message({ nom: "Arceus" });
  assert(m.includes("<t>Arceus</t>"));
  assert(m.includes("<y>NOM DE FAMILLE</y>"));
});

Deno.test("les trois questions du répertoire sont posées, et vides", () => {
  const m = message();
  for (const q of ["RÉGION D'ORIGINE", "STATUT MARITAL", "LIEU DE VIE"]) {
    assert(m.includes(`<y>${q} :</y> réponse ici.`), q);
  }
});
