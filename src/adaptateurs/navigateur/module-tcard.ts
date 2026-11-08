/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-tcard.ts
//
//  COUVERT PAR : outils/tcard.mjs — le marqueur rempli, la carte d'un
//  inconnu laissée intacte, et l'absence de requête sans marqueur.
//
//  LA CARTE DRESSEUR SE REMPLIT TOUTE SEULE.
//
//  « Si on change son équipe, la trainer card doit être actualisée […]
//  le mieux ce serait que ce soit automatique », 2 novembre.
//
//  Le code à coller (`templates/carte-dresseur.a-coller.html`) l'avait
//  déjà prévu : « PAR NOTRE CODE, quand `mod-tcard` sera en ligne ».
//  C'est ce fichier. Les valeurs écrites dans le code collé sont des
//  valeurs d'ATTENTE : elles s'affichent tant que le script ne tourne
//  pas, et il les remplace dès qu'il tourne.
//
//  ── À QUI APPARTIENT UNE CARTE ──────────────────────────────────────
//
//  À L'AUTEUR DU MESSAGE OÙ ELLE EST COLLÉE. Pas à un identifiant que
//  le joueur recopierait : un numéro à recopier se recopie faux, et
//  surtout une carte copiée d'un modèle porterait le numéro de
//  quelqu'un d'autre pour toujours.
//
//  Le chemin a été relevé le 2 novembre sur le forum, pas supposé :
//
//      div#p15587.post  →  a[href^="/u"]  →  span.usr_grp_clr
//
//  `.post` est l'ancêtre commun du profil et du corps du message ;
//  c'est le deuxième parent de `.postbody`. Une carte collée dans une
//  signature est dans le même `.post`, donc elle appartient aussi à son
//  auteur, ce qui est exactement ce qu'on veut.
//
//  `data-wm-tcard="42"` l'emporte quand il porte un nombre : c'est la
//  porte de sortie pour une carte posée hors d'un message — une annexe,
//  une page du staff.
//
//  ── CE QU'IL NE FAUT SURTOUT PAS FAIRE : VIDER ──────────────────────
//
//  Si Supabase ne répond pas, ou si l'auteur n'a pas de compte de jeu,
//  on NE TOUCHE À RIEN. La carte garde ses valeurs collées, qui sont
//  vieilles mais plausibles. Une carte vidée par une panne de réseau
//  serait pire que la carte périmée qu'on remplace.
// ════════════════════════════════════════════════════════════════════
import { type Acces, appeler } from "./supabase.ts";
import { especesDepuis } from "./catalogue.ts";
import { type Arene, type Badge, chiffre } from "../../navigateur/carnet.ts";

const MARQUEUR = "[data-wm-tcard]";
const PLACES = 6;

export interface PokemonDeLaCarte {
  especeId: number;
  surnom: string | null;
  niveau: number;
  obscur: boolean;
  place: number | null;
  enPension: boolean;
}

export interface CarteDresseur {
  forumUserId: number;
  pseudo: string;
  palier: number | null;
  pokedollars: number;
  badges: Badge[];
  equipe: PokemonDeLaCarte[];
}

/** L'identifiant de forum à qui cette carte appartient.
 *
 *  Rend `null` quand on ne sait pas — et alors on ne demande rien.
 *  Deviner reviendrait à afficher l'équipe de quelqu'un d'autre. */
export function dresseurDeLaCarte(carte: Element): number | null {
  const ecrit = carte.getAttribute("data-wm-tcard") ?? "";
  if (/^\d+$/.test(ecrit.trim())) return Number(ecrit.trim());

  const message = carte.closest(".post");
  if (message === null) return null;
  const lien = message.querySelector<HTMLAnchorElement>("a[href^='/u']");
  if (lien === null) return null;
  const n = (lien.getAttribute("href") ?? "").match(/^\/u(\d+)/);
  return n === null ? null : Number(n[1]);
}

function texte(carte: Element, attribut: string, valeur: string): void {
  const e = carte.querySelector<HTMLElement>(`[${attribut}]`);
  if (e !== null) e.textContent = valeur;
}

/** Une case d'équipe, au format que `18-carte-dresseur.css` attend. */
function caseDEquipe(
  doc: Document,
  p: PokemonDeLaCarte | null,
  especes: ReadonlyMap<number, string>,
  types: ReadonlyMap<number, string[]>,
  racineDesImages: string | null,
): HTMLLIElement {
  const li = doc.createElement("li");
  li.className = "wm-tcard__pkmn";

  if (p === null) {
    li.classList.add("wm-tcard__pkmn--libre");
    const vide = doc.createElement("span");
    vide.className = "wm-tcard__sprite";
    const mot = doc.createElement("p");
    mot.className = "wm-tcard__libre";
    mot.textContent = "Place libre";
    li.append(vide, mot);
    return li;
  }

  if (p.obscur) li.classList.add("wm-tcard__pkmn--obscur");

  //  LE SPRITE VIENT DU DÉPÔT, jamais du CDN d'un autre projet
  //  (note 371:713). Sans racine connue, on pose la case vide plutôt
  //  qu'une image cassée.
  if (racineDesImages !== null) {
    const img = doc.createElement("img");
    img.className = "wm-tcard__sprite";
    img.src = `${racineDesImages}pokemon/${p.especeId}.png`;
    img.alt = "";
    img.loading = "lazy";
    li.append(img);
  } else {
    const vide = doc.createElement("span");
    vide.className = "wm-tcard__sprite";
    li.append(vide);
  }

  const nom = doc.createElement("p");
  nom.className = "wm-tcard__nom";
  const surnom = p.surnom?.trim() ?? "";
  nom.textContent = surnom !== "" ? surnom : especes.get(p.especeId) ?? `N° ${p.especeId}`;

  const niveau = doc.createElement("p");
  niveau.className = "wm-tcard__niveau";
  //  EN PENSION, LE NIVEAU N'EST PAS CELUI QU'ON CROIT : le pokémon
  //  monte pendant le dépôt et garde sa place dans l'équipe. On le dit
  //  plutôt que d'afficher un niveau figé sans explication.
  niveau.textContent = p.enPension ? `niv. ${p.niveau} · en pension` : `niv. ${p.niveau}`;

  li.append(nom, niveau);

  const sesTypes = types.get(p.especeId) ?? [];
  for (const t of sesTypes.slice(0, 2)) {
    const pastille = doc.createElement("span");
    pastille.className = `wm-type wm-type--${t}`;
    pastille.setAttribute("data-wm-type", t);
    //  LE NOM EST TOUJOURS ÉCRIT SUR LA PASTILLE : « ne jamais coder un
    //  type par la couleur seule » (planche 17). Combat et Feu sont
    //  voisins, Insecte et Plante aussi.
    pastille.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    li.append(pastille);
  }
  return li;
}

/** Les six cases d'une équipe, dans l'élément qui porte
 *  `data-wm-tcard-equipe`.
 *
 *  EXPORTÉE DEPUIS LE 8 NOVEMBRE, pour le profil d'un membre. Les deux
 *  écrans montrent la même équipe du même joueur, lue par le même
 *  appel : deux rendus auraient fini par ne plus se ressembler, et
 *  c'est toujours le second qu'on oublie de corriger. */
export function poserLEquipe(
  carte: Element,
  donnees: CarteDresseur,
  especes: ReadonlyMap<number, string>,
  types: ReadonlyMap<number, string[]>,
  racineDesImages: string | null,
): void {
  const liste = carte.querySelector("[data-wm-tcard-equipe]");
  if (liste === null) return;
  const doc = carte.ownerDocument;

  const places: (PokemonDeLaCarte | null)[] = Array(PLACES).fill(null);
  for (const p of donnees.equipe) {
    const i = p.place !== null && p.place >= 1 && p.place <= PLACES
      ? p.place - 1
      : places.indexOf(null);
    if (i >= 0 && places[i] === null) places[i] = p;
  }

  liste.replaceChildren(
    ...places.map((p) => caseDEquipe(doc, p, especes, types, racineDesImages)),
  );
}

function poserLesBadges(carte: Element, donnees: CarteDresseur, arenes: Arene[]): void {
  //  LES CASES SONT DÉJÀ DANS LE CODE COLLÉ, dans le bon ordre, avec
  //  leur `data-wm-badge`. On ne les reconstruit pas : on allume celles
  //  qui sont gagnées. Reconstruire ferait deux listes d'arènes à tenir
  //  d'accord — celle du code collé et la nôtre — et c'est la seconde
  //  qui finirait par mentir.
  const obtenus = new Map(donnees.badges.map((b) => [b.arene, b.obtenuLe]));
  for (const li of carte.querySelectorAll<HTMLElement>("[data-wm-badge]")) {
    const slug = li.getAttribute("data-wm-badge") ?? "";
    const arene = arenes.find((a) => a.slug === slug);
    if (arene === undefined) continue;
    const le = obtenus.get(arene.nom) ?? null;
    li.classList.toggle("wm-tcard__badge--agagner", le === null);
    const etat = li.querySelector<HTMLElement>(".wm-tcard__bulle-etat");
    if (etat !== null) etat.textContent = le === null ? "Non obtenu" : "Obtenu";

    let date = li.querySelector<HTMLElement>(".wm-tcard__bulle-date");
    if (le === null) {
      date?.remove();
    } else {
      if (date === null) {
        date = li.ownerDocument.createElement("span");
        date.className = "wm-tcard__bulle-date";
        li.querySelector(".wm-tcard__bulle")?.append(date);
      }
      date.textContent = `Obtenu le ${jour(le)}`;
    }
  }
}

/** « 2026-08-12T…  » → « 12/08/2026 ». Pas `toLocaleDateString` : il
 *  dépend de la locale du navigateur, et une carte française ne doit
 *  pas s'afficher à l'américaine chez quelqu'un dont le système est en
 *  anglais. */
export function jour(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m === null ? iso : `${m[3]}/${m[2]}/${m[1]}`;
}

/** Le compteur de badges du code collé : « 3 / 11 ».
 *
 *  ONZE, PAS SEPT, et c'est voulu ici : la carte dessine les sept
 *  arènes ET les quatre colosseums, donc son compteur compte ce qu'elle
 *  montre. Le compteur de la LIGUE, lui, ne compte que les sept arènes
 *  — il est dans « Mon jeu », pas sur la carte. */
export function compteDeLaCarte(badges: Badge[], arenes: Arene[]): string {
  const noms = new Set(arenes.map((a) => a.nom));
  const obtenus = arenes.length === 0
    ? badges.length
    : badges.filter((b) => noms.has(b.arene)).length;
  return `${obtenus} / ${arenes.length === 0 ? badges.length : arenes.length}`;
}

export function remplirUneCarte(
  carte: Element,
  donnees: CarteDresseur,
  contexte: {
    especes: ReadonlyMap<number, string>;
    types: ReadonlyMap<number, string[]>;
    arenes: Arene[];
    racineDesImages: string | null;
  },
): void {
  texte(carte, "data-wm-tcard-palier", donnees.palier === null ? "—" : String(donnees.palier));
  texte(carte, "data-wm-tcard-argent", chiffre(donnees.pokedollars));
  texte(carte, "data-wm-tcard-compte", compteDeLaCarte(donnees.badges, contexte.arenes));
  poserLEquipe(carte, donnees, contexte.especes, contexte.types, contexte.racineDesImages);
  poserLesBadges(carte, donnees, contexte.arenes);
  //  LA CARTE DIT QU'ELLE EST À JOUR. Sans ce marqueur, rien ne
  //  distingue à l'œil une carte remplie d'une carte restée sur ses
  //  valeurs d'attente — et le harnais ne saurait pas non plus.
  carte.setAttribute("data-wm-tcard-remplie", "");
}

/** Les types de chaque espèce, depuis `especes-fiches.json`.
 *
 *  EXPORTÉE AVEC `poserLEquipe` : les deux vont ensemble, et une
 *  seconde lecture de ce fichier écrite à côté s'est trompée de forme
 *  dès le premier essai — `{especes: […]}` au lieu de
 *  `{fiches: {id: …}}`. */
export function typesDepuis(donnees: unknown): ReadonlyMap<number, string[]> {
  const index = new Map<number, string[]>();
  if (typeof donnees !== "object" || donnees === null) return index;
  const fiches = (donnees as { fiches?: unknown }).fiches;
  if (typeof fiches !== "object" || fiches === null) return index;
  for (const [cle, v] of Object.entries(fiches as Record<string, unknown>)) {
    const id = Number(cle);
    const t = (v as { types?: unknown }).types;
    if (Number.isInteger(id) && Array.isArray(t)) {
      index.set(id, t.filter((x): x is string => typeof x === "string"));
    }
  }
  return index;
}

function arenesDepuis(donnees: unknown): Arene[] {
  if (typeof donnees !== "object" || donnees === null) return [];
  const l = (donnees as { arenes?: unknown }).arenes;
  return Array.isArray(l) ? (l as Arene[]) : [];
}

async function lire(racine: string, nom: string): Promise<unknown> {
  return await fetch(`${racine}${nom}`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

/** Remplit toutes les cartes de la page.
 *
 *  UNE REQUÊTE PAR DRESSEUR, pas par carte : un sujet où le même joueur
 *  a répondu six fois porte six cartes et une seule demande. */
export async function poserLesCartes(
  doc: Document,
  acces: Acces,
  racineDesDonnees: string,
  racineDesImages: string | null,
): Promise<number> {
  const cartes = [...doc.querySelectorAll(MARQUEUR)];
  const parDresseur = new Map<number, Element[]>();
  for (const c of cartes) {
    const id = dresseurDeLaCarte(c);
    if (id === null) continue;
    const deja = parDresseur.get(id);
    if (deja === undefined) parDresseur.set(id, [c]);
    else deja.push(c);
  }
  //  RIEN À FAIRE, RIEN À CHARGER. Ni carte, ou aucune dont on sache à
  //  qui elle est : ce module ne doit alors coûter ni un fetch de
  //  données ni un appel, parce qu'il tourne sur TOUTES les pages du
  //  forum et que presque aucune ne porte de carte.
  //
  //  UNE SEULE SORTIE POUR LES DEUX CAS. Il y en avait une seconde
  //  juste au-dessus, sur `cartes.length` : elle ne retenait rien que
  //  celle-ci ne retienne, vérifié en la retirant le 2 novembre.
  if (parDresseur.size === 0) return 0;

  const [especesBrut, typesBrut, arenesBrut] = await Promise.all([
    lire(racineDesDonnees, "especes.json"),
    lire(racineDesDonnees, "especes-fiches.json"),
    lire(racineDesDonnees, "arenes.json"),
  ]);
  const contexte = {
    especes: especesDepuis(especesBrut),
    types: typesDepuis(typesBrut),
    arenes: arenesDepuis(arenesBrut),
    racineDesImages,
  };

  let remplies = 0;
  await Promise.all([...parDresseur].map(async ([forumUserId, lesCartes]) => {
    const r = await appeler(acces, "carte_dresseur", { forumUserId }).catch(() => null);
    //  PAS DE COMPTE DE JEU, OU PAS DE RÉSEAU : on laisse la carte
    //  telle qu'elle a été collée (voir l'en-tête), et ON LE DIT.
    //
    //  Sans ce marqueur, une carte laissée intacte est indiscernable
    //  d'une carte que le script n'a jamais touchée — pour qui
    //  l'inspecte comme pour le harnais, qui croyait mesurer un refus
    //  propre alors qu'il mesurait une exception avalée plus haut.
    if (r === null || typeof r !== "object") {
      for (const c of lesCartes) c.setAttribute("data-wm-tcard-sans-compte", "");
      return;
    }
    for (const c of lesCartes) {
      remplirUneCarte(c, r as CarteDresseur, contexte);
      remplies += 1;
    }
  }));
  return remplies;
}
