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
      "LIEN DE LA PRÉSENTATION : https://mysteryinrhode.forumactif.com/t1017-jake",
    ),
  );
});

Deno.test("le prénom et le nom de famille sont posés", () => {
  const m = message({ nom: "Erin Kavanagh" }, "Erin Kavanagh");
  assert(m.includes("PRÉNOM : Erin"));
  assert(m.includes("NOM DE FAMILLE : Kavanagh"));
});

Deno.test("plus aucune balise de la V1", () => {
  //  « Pas besoin d'utiliser les balises vu que ces infos iront dans
  //  le répertoire. » Elles servaient à recopier des lignes dans des
  //  sujets-annuaires que le répertoire remplace.
  const m = message({ nom: "Erin Kavanagh" }, "Erin Kavanagh");
  assertEquals(m.match(/<[a-z]+>/g), null);
  assert(!m.includes("BOTTIN"));
  assert(!m.includes("REGISTRE DES HABITATIONS"));
  assert(!m.includes('@"'));
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

Deno.test("les invites restent, mot pour mot", () => {
  const m = message({}, "");
  assert(
    m.includes("ES-TU UN POSTE-VACANT OU SCÉNARIO ? mettre le nom du créateur le cas échéant."),
  );
  assert(m.includes("AUTRES COMPTES SUR LE FORUM : le nom du compte"));
  assertEquals(m.match(/réponse ici\./g)?.length, 3);
});

Deno.test("les trois questions du répertoire sont posées, et vides", () => {
  const m = message();
  for (const q of ["RÉGION D'ORIGINE", "STATUT MARITAL", "LIEU DE VIE"]) {
    assert(m.includes(`${q} : réponse ici.`), q);
  }
});

Deno.test("« uc » n'est pas un nom et ne se recopie pas", () => {
  //  La fiche d'essai de Jake en est pleine. Le laisser passer ferait
  //  entrer « uc » dans le répertoire.
  const m = message({ nom: "uc" });
  assert(m.includes("PRÉNOM : prénom"));
  assert(m.includes("NOM DE FAMILLE : nom de famille"));
});

Deno.test("le nom de famille se détache du prénom", () => {
  assertEquals(coupeLeNom("Erin Kavanagh"), { prenom: "Erin", famille: "Kavanagh" });
  assertEquals(coupeLeNom("Arceus"), { prenom: "Arceus", famille: "" });
  assertEquals(coupeLeNom("  Jake  Van   Doren "), { prenom: "Jake", famille: "Van Doren" });
  assertEquals(coupeLeNom(""), { prenom: "", famille: "" });
});

Deno.test("un personnage sans nom de famille garde l'invite", () => {
  const m = message({ nom: "Arceus" });
  assert(m.includes("PRÉNOM : Arceus"));
  assert(m.includes("NOM DE FAMILLE : nom de famille"));
});

Deno.test("huit lignes, pas une de plus", () => {
  //  Le formulaire tient dans un écran. Une question ajoutée ici se
  //  paie en abandons : c'est la dernière chose entre une joueuse qui
  //  a fini sa fiche et le staff.
  assertEquals(message({ nom: "Erin Kavanagh" }).split("\n").length, 8);
});
