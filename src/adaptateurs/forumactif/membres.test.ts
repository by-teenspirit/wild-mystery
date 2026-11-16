// ════════════════════════════════════════════════════════════════════
//  Les décors viennent de la VRAIE page, relevée le 16 novembre sur
//  mysteryinrhode.forumactif.com. Un décor qui ne reproduit pas ce que
//  l'hôte sert ne mesure que lui-même — c'est la leçon que `recherche.ts`
//  a payée avant celle-ci.
// ════════════════════════════════════════════════════════════════════
import { assertEquals } from "@std/assert";
import { pagesDeLaListe, pseudosDeLaListe } from "./membres.ts";

/** Une ligne, telle que le gabarit l'écrit avec sa couleur de groupe. */
const ligne = (id: number, nom: string, couleur = "#4C8A52") =>
  `<li class="wm-membres__ligne row1"><span class="wm-membres__col wm-membres__col--qui">
     <span class="wm-membres__qui">
       <a class="wm-membres__nom" href="/u${id}"><span class="group-5 usr_grp_clr" style="color:${couleur}"><strong>${nom}</strong></span></a>
       <span class="wm-membres__sous" data-wm-profil="/u${id}"></span>
     </span></span></li>`;

const LISTE = `<div class="wm-membres"><ul class="wm-membres__liste" id="memberlist">
  ${ligne(5, "Erin Kavanagh")}
  ${ligne(1, "Arceus", "#8B4723")}
  ${ligne(4, "Jake Dalziel")}
  ${ligne(3, "Ma&icirc;tre du Jeu")}
</ul></div>`;

Deno.test("la liste des membres rend qui s'appelle comment", () => {
  const t = pseudosDeLaListe(LISTE);
  assertEquals(t.size, 4);
  assertEquals(t.get(5), "Erin Kavanagh");
  assertEquals(t.get(1), "Arceus");
  //  LE CAS QUI A TOUT DÉCLENCHÉ : u4 s'appelait « Compte de test », il
  //  s'appelle « Jake Dalziel ». C'est ce renommage qui faisait
  //  chercher la relève avec un nom que le forum ne connaît plus.
  assertEquals(t.get(4), "Jake Dalziel");
  //  L'ENVELOPPE DE COULEUR SAUTE, LE NOM RESTE, et les entités se
  //  décodent — « Maître » arrive en `Ma&icirc;tre`.
  assertEquals(t.get(3), "Maître du Jeu");
});

Deno.test("ELLE N'ATTRAPE PAS LE /u DE LA BARRE DE NAVIGATION", () => {
  //  La page porte le lien de profil de la personne connectée, hors de
  //  la liste. Le prendre renommerait le Maître du Jeu avec le pseudo
  //  de tout le monde — c'est pour ça que l'ancre est
  //  `wm-membres__nom` et pas « un lien vers /u quelque part ».
  const avecBarre = `<nav class="wm-nav"><a href="/u3">Maître du Jeu</a></nav>
    <a class="wm-nav__profil" href="/u3">Mon profil</a>
    ${LISTE}
    <div class="lastpost"><a href="/u1">Arceus</a></div>`;
  const t = pseudosDeLaListe(avecBarre);
  assertEquals(t.size, 4);
  assertEquals([...t.keys()].sort((a, b) => a - b), [1, 3, 4, 5]);
});

Deno.test("un nom vide ne renomme personne", () => {
  //  Mieux vaut un nom vieux d'une heure qu'un membre appelé « rien ».
  const t = pseudosDeLaListe(
    `<a class="wm-membres__nom" href="/u9"><img src="x.png"></a>` + ligne(2, "Vraie"),
  );
  assertEquals(t.has(9), false);
  assertEquals(t.get(2), "Vraie");
});

Deno.test("et une page sans liste rend une table vide, pas une erreur", () => {
  //  Une page d'erreur, une maintenance, un gabarit en travaux : la
  //  relève doit continuer avec les noms qu'elle a déjà.
  assertEquals(pseudosDeLaListe("").size, 0);
  assertEquals(pseudosDeLaListe("<html><body>Erreur</body></html>").size, 0);
});

Deno.test("les pages suivantes se suivent par les liens du forum", () => {
  //  ON NE DEVINE PAS LE PAS. Mesuré le 16 novembre, `?start=50` répond
  //  200 avec zéro membre : un pas deviné de 50 sauterait la moitié des
  //  membres si le forum en affiche 25 par page.
  const code = `<div class="pagination">
    <a href="/memberlist?start=0">1</a>
    <a href="/memberlist?mode=joined&amp;order=ASC&amp;start=25">2</a>
    <a href="/memberlist?mode=joined&amp;order=ASC&amp;start=50">3</a>
    <a href="/memberlist?mode=joined&amp;order=ASC&amp;start=25">2</a>
  </div>`;
  assertEquals(pagesDeLaListe(code), [
    "/memberlist?mode=joined&order=ASC&start=25",
    "/memberlist?mode=joined&order=ASC&start=50",
  ]);
});

Deno.test("et la page courante n'est pas rendue comme suivante", () => {
  //  Sinon la relève se relit elle-même en boucle.
  assertEquals(pagesDeLaListe(`<a href="/memberlist?start=0">1</a>`), []);
  assertEquals(pagesDeLaListe("pas de pagination du tout"), []);
});
