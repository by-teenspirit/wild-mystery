// ════════════════════════════════════════════════════════════════════
//  Ce qui se teste sans navigateur : la reconnaissance de l'index. Le
//  reste est du DOM, vérifié sur le forum.
//
//  C'est la porte la plus risquée de l'encart. Trop large, et il se pose
//  sur une liste de sujets ou un profil — des pages qui portent les mêmes
//  blocs `.forabg`, d'où le choix de reconnaître la page à son ADRESSE et
//  pas à son balisage. Trop étroite, et il ne s'affiche jamais sans qu'on
//  comprenne pourquoi.
// ════════════════════════════════════════════════════════════════════

import { assert } from "@std/assert";
import { estLIndex } from "./module-vie.ts";

Deno.test("les adresses de l'accueil sont reconnues", () => {
  //  Forumactif sert l'index sur les deux premières ; les deux autres
  //  circulent dans d'anciens liens.
  for (const chemin of ["/", "/forum", "/index.htm", "/index.php"]) {
    assert(estLIndex(chemin), chemin);
  }
});

Deno.test("aucune autre page du forum n'est prise pour l'index", () => {
  for (
    const chemin of [
      "",
      "/f9-foret-marecageuse",
      "/t977-boutique-de-rhode",
      "/u4",
      "/memberlist",
      "/profile?mode=editprofile",
      "/post?t=976&mode=reply",
      "/forums", //  proche, mais ce n'est pas l'accueil
      "/forum/quelque-chose",
      "/index.html", //  Forumactif ne sert pas celui-là
      "/portal",
      "/search",
    ]
  ) {
    assert(!estLIndex(chemin), chemin);
  }
});
