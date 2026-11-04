import { assertEquals } from "@std/assert";
import { dateDuForum, sujetsDeLaRecherche } from "./recherche.ts";

//  ── LE DÉCOR EST CELUI DE LA VRAIE PAGE ────────────────────────────
//
//  Relevé le 4 novembre 2026 sur mysteryinrhode.forumactif.com, avec
//  un vrai compte, avant d'écrire une ligne du lecteur. Les classes,
//  l'ordre des cellules et la forme des adresses sont les siens ; seuls
//  les pseudos et les chiffres ont été gardés tels quels parce qu'ils
//  ne révèlent rien.
//
//  C'est la leçon de la semaine, payée trois fois : un décor qui ne
//  reproduit pas ce que l'hôte sert ne mesure que lui-même.
const PAGE = `
<div class="forabg"><ul class="topiclist topics">
<li class="row row2">
  <dl class="icon">
    <dd class="dterm">
      <div class="topic-title-container"><a class="topictitle" href="/t996-test">test</a></div>
      <span class="topic-author">par <a class="gensmall" href="/u4">Compte de test</a>
        dans <a href="/f36-steppes-arides">Steppes Arides</a></span>
    </dd>
    <dd class="posts">3</dd>
    <dd class="views">46</dd>
    <dd class="lastpost"><span><a class="gensmall" href="/u1">Arceus</a>
      <a href="/t996-test#15582" title="Derniers Messages"><img src="x.png"></a>
      Mer 28 Oct 2026 - 13:34</span></dd>
  </dl>
</li>
<li class="row row1">
  <dl class="icon">
    <dd class="dterm">
      <div class="topic-title-container">
        <a class="topictitle" href="/t977-boutique-de-rhode">Boutique de Rhode</a></div>
      <span class="topic-author">par <a class="gensmall" href="/u3">Ma&icirc;tre du Jeu</a>
        dans <a href="/f12-les-commerces">Les commerces</a></span>
    </dd>
    <dd class="posts">1 204</dd>
    <dd class="views">8 110</dd>
    <dd class="lastpost"><span><a class="gensmall" href="/u4">Compte de test</a>
      <a href="/t977-boutique-de-rhode#15573" title="Derniers Messages"><img src="x.png"></a>
      Aujourd'hui &agrave; 09:05</span></dd>
  </dl>
</li>
</ul></div>`;

Deno.test("la page de recherche rend un sujet par ligne", () => {
  const sujets = sujetsDeLaRecherche(PAGE);
  assertEquals(sujets.length, 2);
  assertEquals(sujets[0].sujetId, 996);
  assertEquals(sujets[0].titre, "test");
  assertEquals(sujets[0].forumId, 36);
  assertEquals(sujets[0].forumNom, "Steppes Arides");
});

Deno.test("LES DEUX AUTEURS NE SONT PAS LE MÊME, et l'ordre des cellules les sépare", () => {
  //  Le premier `/u…` est celui qui a ouvert le sujet, le second celui
  //  du dernier message. Les confondre ferait dire « dernière réponse
  //  de Compte de test » sur un sujet où Arceus vient d'écrire — et
  //  c'est exactement ce qu'un tableau de RP sert à savoir.
  const [premier, second] = sujetsDeLaRecherche(PAGE);
  assertEquals(premier.ouvertParId, 4);
  assertEquals(premier.dernierAuteurId, 1);
  assertEquals(premier.dernierAuteurPseudo, "Arceus");
  assertEquals(second.ouvertParId, 3);
  assertEquals(second.dernierAuteurId, 4);
  assertEquals(second.dernierAuteurPseudo, "Compte de test");
});

Deno.test("le dernier message porte son identifiant, pour y renvoyer", () => {
  assertEquals(sujetsDeLaRecherche(PAGE)[0].dernierMessageId, 15582);
  assertEquals(sujetsDeLaRecherche(PAGE)[1].dernierMessageId, 15573);
});

Deno.test("LES MILLIERS SONT SÉPARÉS PAR UNE ESPACE, et ça reste un nombre", () => {
  //  « 1 204 » rendrait `NaN` à une lecture naïve, et le tableau
  //  afficherait « NaN réponses » sur les sujets les plus vivants —
  //  ceux qu'on regarde le plus.
  const [, second] = sujetsDeLaRecherche(PAGE);
  assertEquals(second.reponses, 1204);
  assertEquals(second.vues, 8110);
});

Deno.test("les entités du titre et des pseudos sont rendues", () => {
  assertEquals(sujetsDeLaRecherche(PAGE)[1].ouvertParId, 3);
  assertEquals(sujetsDeLaRecherche(PAGE)[1].titre, "Boutique de Rhode");
});

Deno.test("une page sans résultat ne rend rien, et ne lève pas", () => {
  assertEquals(sujetsDeLaRecherche("<div>Aucun sujet trouvé</div>").length, 0);
  assertEquals(sujetsDeLaRecherche("").length, 0);
});

Deno.test("UNE LIGNE ABÎMÉE EST SAUTÉE, ELLE N'EMPORTE PAS LES AUTRES", () => {
  //  Une relève qui tombe sur un sujet au titre exotique ne doit pas
  //  perdre les quarante autres du joueur.
  const abime = PAGE.replace('<a class="topictitle" href="/t996-test">test</a>', "<b>rien</b>");
  const sujets = sujetsDeLaRecherche(abime);
  assertEquals(sujets.length, 1);
  assertEquals(sujets[0].sujetId, 977);
});

// ── les dates ──────────────────────────────────────────────────────

const MAINTENANT = new Date("2026-11-04T18:00:00Z");

Deno.test("la date du forum se lit, mois français abrégés compris", () => {
  assertEquals(dateDuForum("Mer 28 Oct 2026 - 13:34", MAINTENANT), "2026-10-28T13:34:00Z");
  assertEquals(dateDuForum("Dim 3 Fév 2026 - 9:05", MAINTENANT), "2026-02-03T09:05:00Z");
  assertEquals(dateDuForum("Lun 1 Juin 2026 - 0:00", MAINTENANT), "2026-06-01T00:00:00Z");
});

Deno.test("AOÛT S'ÉCRIT DE DEUX FAÇONS, et les deux doivent passer", () => {
  //  Forumactif écrit « Aoû » ; un thème ou une langue réglée autrement
  //  écrit « Aou ». Un mois perdu, c'est un douzième des RP sans date.
  assertEquals(dateDuForum("Sam 16 Aoû 2026 - 21:00", MAINTENANT), "2026-08-16T21:00:00Z");
  assertEquals(dateDuForum("Sam 16 Aou 2026 - 21:00", MAINTENANT), "2026-08-16T21:00:00Z");
});

Deno.test("« AUJOURD'HUI » ET « HIER » ONT BESOIN DE SAVOIR QUEL JOUR ON EST", () => {
  //  Ce sont les seules formes où la page ne dit pas la date. Prendre
  //  l'horloge du serveur à l'intérieur de la fonction rendrait le
  //  résultat impossible à mesurer deux fois de suite.
  assertEquals(dateDuForum("Aujourd'hui à 09:05", MAINTENANT), "2026-11-04T09:05:00Z");
  assertEquals(dateDuForum("Hier à 23:50", MAINTENANT), "2026-11-03T23:50:00Z");
});

Deno.test("et « hier » le premier du mois remonte au mois d'avant", () => {
  const premierNovembre = new Date("2026-11-01T08:00:00Z");
  assertEquals(dateDuForum("Hier à 10:00", premierNovembre), "2026-10-31T10:00:00Z");
});

Deno.test("ce qui n'est pas une date rend null, sans lever", () => {
  assertEquals(dateDuForum("", MAINTENANT), null);
  assertEquals(dateDuForum("il y a trois jours", MAINTENANT), null);
  assertEquals(dateDuForum("Mer 28 Brumaire 2026 - 13:34", MAINTENANT), null);
  assertEquals(dateDuForum("Mer 28 Oct 2026 - 99:34", MAINTENANT), null);
});

Deno.test("LA DATE SE LIT AU BOUT DE LA CELLULE, pas au milieu du pseudo", () => {
  //  La cellule mêle le pseudo, « Derniers Messages » et la date.
  const sujets = sujetsDeLaRecherche(PAGE);
  assertEquals(sujets[0].dernierLeBrut, "Mer 28 Oct 2026 - 13:34");
  assertEquals(sujets[1].dernierLeBrut, "Aujourd'hui à 09:05");
  assertEquals(dateDuForum(sujets[1].dernierLeBrut, MAINTENANT), "2026-11-04T09:05:00Z");
});

Deno.test("LES ENTITÉS FRANÇAISES SONT DÉCODÉES, titres compris", () => {
  //  Le navigateur les décode avant qu'on les voie, la relève non.
  //  C'est ce qui a fait tomber la mesure des dates la première fois.
  const page = PAGE.replace(">test</a>", ">L&eacute;on &agrave; la p&ecirc;che</a>");
  assertEquals(sujetsDeLaRecherche(page)[0].titre, "Léon à la pêche");
  assertEquals(sujetsDeLaRecherche(PAGE)[1].ouvertParId, 3);
});

Deno.test("et les formes numériques aussi, sans table à tenir", () => {
  const page = PAGE.replace(">test</a>", ">L&#233;on&#x202f;: la suite</a>");
  assertEquals(sujetsDeLaRecherche(page)[0].titre, "Léon : la suite");
});
