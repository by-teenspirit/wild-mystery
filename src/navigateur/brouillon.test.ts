import { assertEquals } from "@std/assert";
import {
  adresseDuFormulaire,
  commencerUneSession,
  compterLesMots,
  direLeTemps,
  DUREE_MAX,
  motsDeLaSession,
  OUTILS,
  poserLOutil,
  restantEnSecondes,
  retirerLesCitations,
  sessionFinie,
} from "./brouillon.ts";

const MAINTENANT = 1_762_000_000_000;
const gras = OUTILS[0];
const citation = OUTILS[4];

// ── LE COMPTEUR ────────────────────────────────────────────────────

Deno.test("les mots se comptent sans les balises", () => {
  assertEquals(compterLesMots("[b]Trois petits mots[/b]"), 3);
  assertEquals(compterLesMots("[color=#ff0000]rouge[/color]"), 1);
  assertEquals(compterLesMots(""), 0);
  assertEquals(compterLesMots("   \n\t  "), 0);
});

Deno.test("UNE CITATION NE COMPTE PAS : citer n'est pas écrire", () => {
  //  C'est le point entier de la fonction. Répondre en citant trois
  //  paragraphes de quelqu'un d'autre n'est pas écrire trois
  //  paragraphes, et un compteur qui dit le contraire est un compteur
  //  qu'on apprend à tromper.
  assertEquals(
    compterLesMots("[quote]un très long passage de quelqu'un d'autre[/quote]deux mots"),
    2,
  );
  assertEquals(
    compterLesMots('[quote="Plume"]ce qu\'elle a dit[/quote]ma réponse tient ici'),
    4,
  );
});

Deno.test("et une citation DANS une citation part avec", () => {
  //  Une regex ne sait pas compter les imbrications : il faut plusieurs
  //  passes, du plus profond vers le plus large.
  const texte = "[quote]elle dit [quote]il avait dit ceci[/quote] et voilà[/quote]seul";
  assertEquals(retirerLesCitations(texte).trim(), "seul");
  assertEquals(compterLesMots(texte), 1);
});

Deno.test("une balise de citation jamais fermée ne mange pas tout le message", () => {
  //  Le cas de quelqu'un qui efface un `[/quote]` par accident. Mieux
  //  vaut compter trop que rendre zéro et laisser croire à une panne.
  assertEquals(compterLesMots("[quote]resté ouvert et puis le texte"), 6);
});

Deno.test("les entités HTML ne deviennent pas des mots", () => {
  assertEquals(compterLesMots("deux&nbsp;mots"), 2);
  assertEquals(compterLesMots("un &#039; apostrophe"), 2);
});

// ── LA BARRE D'OUTILS ──────────────────────────────────────────────

Deno.test("les outils sont sept, et ils écrivent du BBCode", () => {
  //  « Sept boutons, pas trente : l'éditeur complet reste celui du
  //  forum. » Et du BBCode, parce que c'est ce que le formulaire attend.
  assertEquals(OUTILS.length, 7);
  for (const o of OUTILS) {
    assertEquals(o.ouvre.startsWith("["), true);
    assertEquals(o.ferme.startsWith("[/"), true);
    assertEquals(o.ouvre.includes("<"), false);
  }
});

Deno.test("un outil entoure la sélection ET LA GARDE CHOISIE", () => {
  //  Sans ça, cliquer gras puis italique demande de re-sélectionner —
  //  et on finit par écrire ses balises à la main.
  const r = poserLOutil("le mot juste", gras, 3, 6);
  assertEquals(r.texte, "le [b]mot[/b] juste");
  assertEquals(r.texte.slice(r.de, r.a), "mot");
});

Deno.test("sans sélection, le curseur se place ENTRE les deux balises", () => {
  const r = poserLOutil("avant après", gras, 5, 5);
  assertEquals(r.texte, "avant[b][/b] après");
  assertEquals(r.de, r.a);
  assertEquals(r.texte.slice(0, r.de), "avant[b]");
});

Deno.test("des bornes absurdes ne détruisent pas le texte", () => {
  //  Un champ qui vient de perdre le focus rend parfois des bornes
  //  d'avant la dernière frappe.
  const r = poserLOutil("court", citation, 99, -4);
  assertEquals(r.texte, "court[quote][/quote]");
  const inverse = poserLOutil("abcdef", gras, 4, 2);
  assertEquals(inverse.texte, "abcd[b][/b]ef");
});

// ── « ENVOYER DANS LE SUJET » ──────────────────────────────────────

Deno.test("l'adresse est celle du formulaire natif, et LE CORPS N'Y EST PAS", () => {
  //  Un message de RP dépasse de loin ce qu'une URL supporte, et il
  //  finirait dans les journaux du serveur.
  assertEquals(adresseDuFormulaire(1002), "/post?t=1002&mode=reply");
  assertEquals(adresseDuFormulaire(null), "/post?mode=newtopic&f=45");
  assertEquals(adresseDuFormulaire(0), null);
  assertEquals(adresseDuFormulaire(-3), null);
  assertEquals(adresseDuFormulaire(1.5), null);
});

// ── LES SESSIONS ───────────────────────────────────────────────────

Deno.test("une session garde son HEURE DE FIN, pas un compte à rebours", () => {
  //  Un `setInterval` qui décrémente s'égare dès que l'onglet passe en
  //  arrière-plan : les navigateurs ralentissent ces minuteries. Ici
  //  l'affichage se recalcule juste même après dix minutes ailleurs.
  const s = commencerUneSession(25, 0, MAINTENANT);
  assertEquals(s?.finLe, MAINTENANT + 25 * 60_000);
  assertEquals(restantEnSecondes(s!, MAINTENANT + 10 * 60_000), 15 * 60);
  assertEquals(restantEnSecondes(s!, MAINTENANT + 999 * 60_000), 0);
  assertEquals(sessionFinie(s!, MAINTENANT + 24 * 60_000), false);
  assertEquals(sessionFinie(s!, MAINTENANT + 25 * 60_000), true);
});

Deno.test("UNE DURÉE ABSURDE EST REFUSÉE, parce que la saisie est libre", () => {
  //  Une session de soixante-neuf jours n'est pas une session : c'est un
  //  minuteur qu'on ne peut plus arrêter qu'en vidant son navigateur.
  assertEquals(commencerUneSession(0, 0, MAINTENANT), null);
  assertEquals(commencerUneSession(-10, 0, MAINTENANT), null);
  assertEquals(commencerUneSession(99_999, 0, MAINTENANT), null);
  assertEquals(commencerUneSession(Number.NaN, 0, MAINTENANT), null);
  assertEquals(commencerUneSession(DUREE_MAX, 0, MAINTENANT)?.finLe !== undefined, true);
});

Deno.test("le bilan compte les mots DE LA SESSION, pas le total du message", () => {
  const s = commencerUneSession(25, 300, MAINTENANT)!;
  assertEquals(motsDeLaSession(s, 480), 180);
});

Deno.test("et retravailler son texte n'affiche jamais un compte négatif", () => {
  //  Effacer un paragraphe pour le réécrire est du travail, pas une
  //  régression à annoncer en rouge.
  const s = commencerUneSession(25, 300, MAINTENANT)!;
  assertEquals(motsDeLaSession(s, 220), 0);
});

Deno.test("le temps se lit comme une durée, pas comme une horloge", () => {
  assertEquals(direLeTemps(1500), "25:00");
  assertEquals(direLeTemps(59), "0:59");
  assertEquals(direLeTemps(3900), "1:05:00");
  assertEquals(direLeTemps(0), "0:00");
  assertEquals(direLeTemps(-5), "0:00");
});
