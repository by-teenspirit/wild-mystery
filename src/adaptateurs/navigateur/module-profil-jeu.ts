/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-profil-jeu.ts
//
//  COUVERT PAR : outils/profil.mjs
//
//  « SON JEU » — la section de la planche 06 que `module-profil` laisse
//  vide, et que celui-ci remplit.
//
//  ── POURQUOI UN SECOND MODULE ───────────────────────────────────────
//
//  `module-profil` ne fait AUCUNE requête : il déplace ce que
//  Forumactif a déjà servi, et si rien ne répond la page reste juste.
//  Cette section-ci est l'inverse — elle n'existe que si Supabase
//  répond. Les mêler aurait fait d'une panne de réseau une panne de
//  profil.
//
//  ── CE QU'ON LIT, ET POURQUOI C'EST DÉJÀ PUBLIC ─────────────────────
//
//  `carte_dresseur`, la MÊME fonction que la carte collée dans les
//  sujets. Elle rend le pseudo, le palier, les pokédollars, les badges
//  et l'équipe d'un joueur depuis son seul numéro de forum, sans
//  jeton.
//
//  C'est important, parce que la table `joueur` n'est PAS lisible
//  publiquement : sa politique est « chacun lit sa fiche ». Un appel
//  direct à `joueur?forum_user_id=eq.1` ne rendrait rien à une
//  visiteuse — c'est la fonction qui choisit ce qui sort, colonne par
//  colonne. La note de code 06 annonçait « Supabase, lecture publique
//  par identifiant de membre » : c'est vrai de cette fonction-là, et
//  faux de la table. Vérifié dans `0001_socle.sql` le 8 novembre.
//
//  Donc rien de nouveau n'est exposé ici : ce profil montre ce que la
//  carte dresseur de ce même joueur montre déjà dans chacun de ses
//  messages.
//
//  ── ET L'ÉQUIPE EST RENDUE PAR LE CODE DE LA CARTE ──────────────────
//
//  `poserLEquipe`, exportée par `module-tcard`. Même appel, même
//  rendu, mêmes six cases — y compris la place libre et le pokémon en
//  pension, qui sont deux cas qu'on oublie quand on réécrit.
// ════════════════════════════════════════════════════════════════════

import { type Acces, appeler } from "./supabase.ts";
import { especesDepuis } from "./catalogue.ts";
import { type CarteDresseur, poserLEquipe, typesDepuis } from "./module-tcard.ts";
import { chiffre } from "../../navigateur/carnet.ts";

const MARQUEUR = ".wm-profil-page__jeu[data-wm-membre]";

async function lire(racine: string, nom: string): Promise<unknown> {
  return await fetch(`${racine}${nom}`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

function chiffreDuJeu(doc: Document, nombre: string, mot: string): HTMLLIElement {
  const li = doc.createElement("li");
  li.className = "wm-profil-page__chiffre";
  const b = doc.createElement("b");
  b.className = "wm-profil-page__nombre";
  b.textContent = nombre;
  const s = doc.createElement("span");
  s.className = "wm-profil-page__mot";
  s.textContent = mot;
  li.append(b, s);
  return li;
}

/**
 * Remplit « son jeu » sur une page de profil. Rend `true` si la
 * section a été remplie.
 *
 * ELLE RESTE CACHÉE EN CAS DE REFUS, et c'est voulu : un joueur sans
 * compte de jeu — un PNJ, un compte de service — n'a pas de palier ni
 * d'équipe, et une section « Son jeu » vide dirait qu'il en a une
 * qu'on n'a pas su lire.
 */
export async function poserSonJeu(
  doc: Document,
  acces: Acces,
  racineDesDonnees: string,
  racineDesImages: string | null,
): Promise<boolean> {
  const section = doc.querySelector<HTMLElement>(MARQUEUR);
  if (section === null) return false;
  const forumUserId = Number(section.dataset.wmMembre);
  if (!Number.isInteger(forumUserId) || forumUserId <= 0) return false;

  const brut = await appeler(acces, "carte_dresseur", { forumUserId }).catch(() => null);
  if (brut === null || typeof brut !== "object") return false;
  const d = brut as CarteDresseur;

  //  LES DEUX FICHIERS NE SONT LUS QU'ICI, après la réponse : sur une
  //  page de profil sans compte de jeu, ils ne coûtent rien.
  const [especesBrut, typesBrut] = await Promise.all([
    lire(racineDesDonnees, "especes.json"),
    lire(racineDesDonnees, "especes-fiches.json"),
  ]);

  const titre = doc.createElement("h2");
  titre.className = "wm-profil-page__titre";
  titre.textContent = "Son jeu";

  const chiffres = doc.createElement("ul");
  chiffres.className = "wm-profil-page__chiffres wm-profil-page__chiffres--jeu";
  chiffres.append(
    chiffreDuJeu(doc, d.palier === null ? "—" : String(d.palier), "palier"),
    chiffreDuJeu(doc, chiffre(d.pokedollars), "pokédollars"),
    chiffreDuJeu(doc, String(d.badges.length), "badges gagnés"),
  );

  const mot = doc.createElement("p");
  mot.className = "wm-profil-page__surtitre";
  mot.textContent = "Son équipe";

  const liste = doc.createElement("ul");
  liste.className = "wm-tcard__equipe";
  liste.setAttribute("data-wm-tcard-equipe", "");

  section.replaceChildren(titre, chiffres, mot, liste);
  poserLEquipe(
    section,
    d,
    especesDepuis(especesBrut),
    typesDepuis(typesBrut),
    racineDesImages,
  );
  section.hidden = false;
  return true;
}
