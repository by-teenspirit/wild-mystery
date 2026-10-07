import { assert, assertEquals } from "@std/assert";
import {
  ajuster,
  type Article,
  combien,
  etatDuBouton,
  lignesDuPanier,
  nombreDArticles,
  PANIER_VIDE,
  pokedollars,
  total,
} from "./boutique.ts";
import { poserLePanier } from "./redaction.ts";
import { panierDe, QUANTITE_MAX } from "../domaine/panier.ts";

const CATALOGUE: readonly Article[] = [
  { objetId: 990001, nom: "Poké Ball", prix: 200 },
  { objetId: 990020, nom: "Potion", prix: 300 },
  { objetId: 990080, nom: "Pierre Feu", prix: 3000 },
];

// ── le panier ───────────────────────────────────────────────────────

Deno.test("ajouter et retirer", () => {
  let p = ajuster(PANIER_VIDE, 990001, 1);
  assertEquals(combien(p, 990001), 1);
  p = ajuster(p, 990001, 2);
  assertEquals(combien(p, 990001), 3);
  p = ajuster(p, 990001, -1);
  assertEquals(combien(p, 990001), 2);
});

Deno.test("RETIRER LE DERNIER EXEMPLAIRE RETIRE LA LIGNE", () => {
  //  Une ligne à zéro écrirait « 990001x0 » dans le bloc, que le domaine
  //  refuse — et à juste titre. On ne la laisse jamais exister.
  const p = ajuster(ajuster(PANIER_VIDE, 990001, 1), 990001, -1);
  assertEquals(p.size, 0);
  assertEquals(lignesDuPanier(p, CATALOGUE), []);
});

Deno.test("les bornes ne lèvent jamais", () => {
  //  Un bouton qui casse la page est pire qu'un bouton qui refuse en
  //  silence au bon moment.
  assertEquals(combien(ajuster(PANIER_VIDE, 990001, -5), 990001), 0);
  assertEquals(combien(ajuster(PANIER_VIDE, 990001, 10_000), 990001), QUANTITE_MAX);
});

Deno.test("la borne haute est celle du DOMAINE, pas une invention d'ici", () => {
  //  Si le domaine change d'avis, l'interface suit toute seule. Sans ça,
  //  on peut remplir un panier que le serveur refusera.
  const p = ajuster(PANIER_VIDE, 990001, QUANTITE_MAX + 50);
  assertEquals(combien(p, 990001), QUANTITE_MAX);
  assertEquals(panierDe(poserLePanier("", lignesDuPanier(p, CATALOGUE))).type, "panier");
});

Deno.test("l'immuabilité : ajuster ne touche pas au panier reçu", () => {
  const avant = ajuster(PANIER_VIDE, 990001, 2);
  const apres = ajuster(avant, 990001, 3);
  assertEquals(combien(avant, 990001), 2);
  assertEquals(combien(apres, 990001), 5);
});

// ── l'ordre et le total ─────────────────────────────────────────────

Deno.test("L'ORDRE DES LIGNES VIENT DU CATALOGUE, PAS DES CLICS", () => {
  //  Deux joueurs qui commandent la même chose écrivent le même bloc :
  //  une contestation se lit sans se demander qui a cliqué en premier.
  let p = ajuster(PANIER_VIDE, 990080, 1);
  p = ajuster(p, 990001, 2);
  assertEquals(lignesDuPanier(p, CATALOGUE), [
    { objetId: 990001, quantite: 2 },
    { objetId: 990080, quantite: 1 },
  ]);
});

Deno.test("le total suit les prix du catalogue", () => {
  let p = ajuster(PANIER_VIDE, 990001, 3); // 600
  p = ajuster(p, 990080, 1); // 3000
  assertEquals(total(p, CATALOGUE), 3600);
  assertEquals(nombreDArticles(p), 4);
});

Deno.test("un article disparu du catalogue vaut zéro, il ne casse pas le calcul", () => {
  //  Le message a pu changer sous le joueur pendant qu'il remplissait.
  //  Le serveur tranchera ; en attendant, l'interface ne doit pas tomber.
  const p = ajuster(PANIER_VIDE, 999999, 2);
  assertEquals(total(p, CATALOGUE), 0);
  assertEquals(nombreDArticles(p), 2);
});

Deno.test("un panier vide coûte zéro", () => {
  assertEquals(total(PANIER_VIDE, CATALOGUE), 0);
  assertEquals(nombreDArticles(PANIER_VIDE), 0);
});

// ── le bouton ───────────────────────────────────────────────────────

Deno.test("le bouton est désactivé, pas caché, quand le panier est vide", () => {
  //  Un bouton qui apparaît et disparaît fait sauter la mise en page à
  //  chaque clic.
  const e = etatDuBouton(PANIER_VIDE, CATALOGUE);
  assertEquals(e.actif, false);
  assert(e.libelle.length > 0);
});

Deno.test("le bouton dit combien et combien ça coûte", () => {
  const un = etatDuBouton(ajuster(PANIER_VIDE, 990001, 1), CATALOGUE);
  assertEquals(un.actif, true);
  assert(un.libelle.includes("1 article"), un.libelle);
  assert(!un.libelle.includes("1 articles"), `pluriel fautif : ${un.libelle}`);

  const deux = etatDuBouton(ajuster(PANIER_VIDE, 990001, 2), CATALOGUE);
  assert(deux.libelle.includes("2 articles"), deux.libelle);
  assert(deux.libelle.includes(pokedollars(400)), deux.libelle);
});

Deno.test("le séparateur des milliers est une espace FINE insécable", () => {
  //  Déjà payé ailleurs : un test qui écrit une espace ordinaire tombe,
  //  et on cherche longtemps pourquoi deux chaînes identiques à l'œil ne
  //  sont pas égales.
  const mille = pokedollars(1240);
  assertEquals(mille.includes(" ") || mille.includes(" "), true, JSON.stringify(mille));
});

// ── le passage au message ───────────────────────────────────────────

Deno.test("CE QUE LE PANIER ÉCRIT EST CE QUE LE DOMAINE RELIT", () => {
  let p = ajuster(PANIER_VIDE, 990001, 3);
  p = ajuster(p, 990020, 1);
  const texte = poserLePanier("Elle pousse la porte.", lignesDuPanier(p, CATALOGUE));
  const relu = panierDe(texte);
  assertEquals(relu.type, "panier");
  if (relu.type === "panier") assertEquals(relu.lignes, lignesDuPanier(p, CATALOGUE));
});

Deno.test("le texte du joueur survit à chaque changement de panier", () => {
  //  Planche 30 : « le message reste un message de joueur, pas un
  //  formulaire ». On ne touche qu'au bloc.
  const sien = "Elle pousse la porte de la boutique.";
  let texte = sien;
  for (const [objet, delta] of [[990001, 2], [990020, 1], [990001, -1]] as const) {
    const p = ajuster(PANIER_VIDE, objet, delta);
    texte = poserLePanier(texte, lignesDuPanier(p, CATALOGUE));
    assert(texte.startsWith(sien), texte);
  }
});

Deno.test("vider le panier retire le bloc et rend le texte de départ", () => {
  const sien = "Elle repart les mains vides.";
  const avec = poserLePanier(sien, lignesDuPanier(ajuster(PANIER_VIDE, 990001, 1), CATALOGUE));
  assertEquals(poserLePanier(avec, []), sien);
});

Deno.test("UN SEUL BLOC, QUOI QU'IL ARRIVE", () => {
  //  `poserLePanier` remplace, il n'empile pas. Sans ça, dix clics
  //  écriraient dix blocs et le domaine n'en lirait que le premier — le
  //  joueur recevrait sa première commande, pas la dernière.
  let texte = "Bonjour.";
  for (let i = 1; i <= 10; i++) {
    texte = poserLePanier(texte, lignesDuPanier(ajuster(PANIER_VIDE, 990001, i), CATALOGUE));
  }
  assertEquals((texte.match(/\[\[WM-PANIER:/g) || []).length, 1);
  const relu = panierDe(texte);
  if (relu.type === "panier") assertEquals(relu.lignes, [{ objetId: 990001, quantite: 10 }]);
});
