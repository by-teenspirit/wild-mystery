/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-carnet.ts
//
//  COUVERT PAR : outils/carnet.mjs — la page servie à son adresse, la
//  clé demandée puis gardée, et les trois onglets remplis d'un seul
//  appel.
//
//  LE CARNET DE BORD : LA PAGE, LES ONGLETS, LES TROIS VUES.
//
//  Les règles d'affichage sont dans `src/navigateur/carnet.ts`, qui ne
//  connaît pas le DOM et se teste sans navigateur. Ici on pose des
//  éléments, et c'est tout ce qu'on fait.
//
//  ── UN SEUL APPEL, ET IL EST AU CHARGEMENT ──────────────────────────
//
//  « Changer d'onglet ne déclenche aucune requête » (note 371:707).
//  Tout est peint une fois, les onglets ne font que montrer et cacher.
//  C'est aussi ce qui rend le retour arrière du navigateur instantané.
//
//  ── LA CLÉ EST DANS LE NAVIGATEUR DU JOUEUR ─────────────────────────
//
//  Elle prouve l'identité à chaque appel (migration 0019) : c'est un
//  secret porteur, comme un cookie de session. Il est rangé dans le
//  `localStorage` de forumactif.com, sous la clé `wm.carnet.cle`.
//
//  CE QUE ÇA VEUT DIRE, ET QU'IL FAUT DIRE : sur un ordinateur
//  partagé, la personne suivante ouvre le carnet. C'est pour ça que la
//  page porte un bouton « oublier ma clé sur cet ordinateur », et que
//  le staff peut la renouveler — `carnet_nouvelle_cle` invalide
//  l'ancienne, c'est la seule façon de révoquer.
// ════════════════════════════════════════════════════════════════════
import { adresseDuSprite } from "./module-faune.ts";
import { Sprites, type StyleDeSprite } from "../../navigateur/sprites.ts";
import {
  type Arene,
  badgesAffiches,
  type Carnet,
  type CaseDePokedex,
  chiffre,
  type ClefDOnglet,
  compteDeBadges,
  compteDuPokedex,
  equipeAffichee,
  type EspeceDeRhode,
  jauge,
  nomAffiche,
  type ObjetDuCatalogue,
  ongletDeLAdresse,
  ONGLETS,
  ouLaTrouver,
  pokedexAffiche,
  PokemonDuCarnet,
  sacRange,
} from "../../navigateur/carnet.ts";

export interface Decor {
  especes: ReadonlyMap<number, string>;
  objets: ObjetDuCatalogue[];
  arenes: Arene[];
  pokedex: EspeceDeRhode[];
  zones: { forumId: number; nom: string; palier: number }[];
  /** Les six natures, telles que `data/groupes.json` les range. */
  groupes: { cle: string; nom: string }[];
  /** `null` quand on ne sait pas d'où viennent les images : on pose
   *  alors les cases vides plutôt que des images cassées. */
  images: string | null;
  /** La racine du dépôt servi — `assets/` et `img/` sont dedans.
   *
   *  ELLE EST DISTINCTE DE `images`, qui pointe sur `assets/`. Les
   *  badges vivent dans `img/badges/`, pas dans `assets/`, et le
   *  carnet leur demandait `assets/badges/` : onze 404 silencieux. */
  depot: string | null;
  /** La carte de couverture des sprites, ou `null` si elle n'a pas pu
   *  être lue. Sans elle, cases vides plutôt qu'images cassées. */
  sprites: Sprites | null;
  /** Le style choisi par le joueur : forum, rétro ou GBA/DS. */
  style: StyleDeSprite;
}

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  nom: K,
  classe?: string,
  texte?: string,
): HTMLElementTagNameMap[K] {
  const e = doc.createElement(nom);
  if (classe !== undefined) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/*  UN SPRITE D'ESPÈCE.
 *
 *  IL ÉCRIVAIT `assets/pokemon/<id>.png` À LA MAIN. Ce dossier est
 *  VIDE dans le dépôt — zéro fichier suivi — donc les neuf cent
 *  trente-trois sprites du carnet étaient en 404 : la boîte, le sac,
 *  l'équipe, la pension et le Pokédex, tous muets. Les images
 *  existent, 1 838 dans `assets/sprites-figes/` et trois styles, et
 *  `Sprites` est écrite depuis des semaines pour les trouver. C'est
 *  la même fonction que l'annexe de la carte appelle depuis le 4
 *  novembre ; il fallait l'appeler ici aussi.
 *
 *  Quand l'espèce n'est pas couverte, on rend une case vide : une
 *  silhouette manquante se voit moins qu'une image cassée. */
function sprite(doc: Document, decor: Decor, id: number, classe: string): HTMLElement {
  const adresse = decor.depot === null
    ? null
    : adresseDuSprite(decor.sprites, decor.depot, id, decor.style);
  if (adresse === null) return el(doc, "span", classe);
  const img = el(doc, "img", classe);
  img.src = adresse;
  img.alt = "";
  //  NEUF CENT TRENTE-TROIS SPRITES SUR LE POKÉDEX : sans `lazy`, le
  //  navigateur les demande tous à l'ouverture de la page.
  img.loading = "lazy";
  return img;
}

/* ── la barre latérale ────────────────────────────────────────────── */

export function poserLaBarre(
  doc: Document,
  c: Carnet,
  actif: ClefDOnglet,
  decor?: Decor,
): void {
  const d = c.dresseur;
  const nom = doc.querySelector("[data-wm-carnet-nom]");
  if (nom !== null) nom.textContent = d?.pseudo ?? "—";

  const etat = doc.querySelector("[data-wm-carnet-etat]");
  if (etat !== null) {
    etat.textContent = d === null
      ? ""
      : `Palier ${d.palier ?? "—"} · ${chiffre(d.pokedollars)} pokédollars`;
  }

  //  L'EMBLÈME DE SA NATURE, et c'est la seule image qu'on puisse
  //  poser ici. L'avatar du forum est hors de portée — une page sans
  //  en-tête n'a pas `_userdata` — mais le groupe est dans la réponse
  //  et son image est dans le dépôt. Un joueur qui n'a pas encore
  //  choisi n'a pas d'emblème : on ne met rien, pas un trou gris.
  const embleme = doc.querySelector("[data-wm-carnet-embleme]");
  if (embleme instanceof HTMLElement) {
    const cle = d?.groupe ?? "";
    const connu = decor?.groupes.find((g) => g.cle === cle) ?? null;
    if (connu === null || decor === undefined || decor.images === null) {
      embleme.replaceChildren();
      embleme.hidden = true;
    } else {
      embleme.hidden = false;
      const img = el(doc, "img", "wm-carnet__embleme-image");
      img.src = `${decor.images}groupes/${connu.cle}.png`;
      img.alt = "";
      embleme.replaceChildren(img, el(doc, "span", "", connu.nom));
    }
  }

  for (const o of doc.querySelectorAll<HTMLAnchorElement>("[data-wm-carnet-onglet]")) {
    const clef = o.getAttribute("data-wm-carnet-onglet");
    if (clef === actif) o.setAttribute("aria-current", "page");
    else o.removeAttribute("aria-current");
  }
}

/* ── Mon jeu ──────────────────────────────────────────────────────── */

function poserLEquipe(doc: Document, c: Carnet, decor: Decor): void {
  const liste = doc.querySelector("[data-wm-carnet-equipe]");
  if (liste === null) return;
  liste.replaceChildren(
    ...equipeAffichee(c.pokemon).map(({ pokemon }) => {
      const li = el(doc, "li", "wm-carnet__pkmn");
      if (pokemon === null) {
        li.classList.add("wm-carnet__pkmn--libre");
        li.append(
          el(doc, "span", "wm-carnet__sprite"),
          el(doc, "p", "wm-carnet__pkmn-nom", "Place libre"),
        );
        return li;
      }
      if (pokemon.enPension) li.classList.add("wm-carnet__pkmn--pension");
      li.append(
        sprite(doc, decor, pokemon.especeId, "wm-carnet__sprite"),
        el(doc, "p", "wm-carnet__pkmn-nom", nomAffiche(pokemon, decor.especes)),
        el(
          doc,
          "p",
          "wm-carnet__pkmn-niveau",
          pokemon.enPension ? `niv. ${pokemon.niveau} · en pension` : `niv. ${pokemon.niveau}`,
        ),
      );
      return li;
    }),
  );
}

function poserLaPension(doc: Document, c: Carnet, decor: Decor): void {
  const bloc = doc.querySelector("[data-wm-carnet-pension-bloc]");
  const liste = doc.querySelector("[data-wm-carnet-pension]");
  //  AUCUN DÉPÔT, AUCUN BLOC. Une section « En pension » vide dit au
  //  joueur qu'il lui manque quelque chose, ce qui n'est pas vrai.
  if (bloc instanceof HTMLElement) bloc.hidden = c.pension.length === 0;
  if (liste === null) return;

  const parId = new Map(c.pokemon.map((p) => [p.id, p]));
  liste.replaceChildren(...c.pension.map((s) => {
    const p = parId.get(s.pokemonId);
    const li = el(doc, "li", "wm-carnet__depot");
    if (p !== undefined) li.append(sprite(doc, decor, p.especeId, ""));
    const bloc = el(doc, "div");
    bloc.append(
      el(doc, "p", "wm-carnet__pkmn-nom", p === undefined ? "—" : nomAffiche(p, decor.especes)),
      el(
        doc,
        "p",
        "wm-carnet__pkmn-niveau",
        p === undefined
          ? `niveau ${s.niveauAuDepot} au dépôt`
          : `niv. ${s.niveauAuDepot} → ${p.niveau} · déposé le ${jour(s.deposeLe)}`,
      ),
    );
    li.append(bloc);
    return li;
  }));
}

/** « 2026-09-03T… » → « 03/09/2026 ». Pas `toLocaleDateString`, qui
 *  suit la langue du système : une page française ne doit pas dater à
 *  l'américaine chez quelqu'un dont l'ordinateur est en anglais. */
export function jour(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m === null ? iso : `${m[3]}/${m[2]}/${m[1]}`;
}

function poserLesBadges(doc: Document, c: Carnet, decor: Decor): void {
  for (const genre of ["arene", "colosseum"] as const) {
    const liste = doc.querySelector(`[data-wm-carnet-badges="${genre}"]`);
    if (liste === null) continue;
    const cases = badgesAffiches(c.badges, decor.arenes, genre);
    const section = liste.closest("[data-wm-carnet-badges-bloc]");
    //  PAS DE LISTE, PAS DE SECTION : tant que `data/arenes.json` est
    //  vide pour un genre, on ne dessine pas de cases inventées.
    if (section instanceof HTMLElement) section.hidden = cases.length === 0;

    liste.replaceChildren(...cases.map((b) => {
      const li = el(doc, "li", "wm-carnet__badge");
      if (b.obtenuLe === null) li.classList.add("wm-carnet__badge--agagner");
      if (b.slug !== null && decor.depot !== null) {
        const img = el(doc, "img");
        //  `img/badges/`, PAS `assets/badges/` : ce dernier n'existe
        //  pas, et les onze badges étaient en 404.
        img.src = `${decor.depot}img/badges/${b.slug}.png`;
        img.alt = "";
        img.loading = "lazy";
        li.append(img);
      }
      li.append(el(doc, "span", "", b.arene));
      li.append(el(doc, "span", "", b.obtenuLe === null ? "à gagner" : jour(b.obtenuLe)));
      return li;
    }));
  }

  const compte = doc.querySelector("[data-wm-carnet-badges-compte]");
  if (compte !== null) compte.textContent = compteDeBadges(c.badges, decor.arenes);
}

function poserLeJet(doc: Document, c: Carnet): void {
  const bloc = doc.querySelector("[data-wm-carnet-jet-bloc]");
  if (bloc instanceof HTMLElement) bloc.hidden = c.dernierJet === null;
  const liste = doc.querySelector("[data-wm-carnet-jet]");
  if (liste === null || c.dernierJet === null) return;
  const j = c.dernierJet;

  const lignes: [string, string, boolean][] = [
    ["Quand", jour(j.creeLe), false],
    ["Quoi", j.type.replace(/_/g, " "), false],
    ["Dans quel message", `n° ${j.messageId}`, false],
    ["Code de vérification", j.code, true],
  ];
  liste.replaceChildren(...lignes.flatMap(([mot, valeur, code]) => {
    const dt = el(doc, "dt", "", mot);
    const dd = el(doc, "dd", code ? "wm-carnet__code" : "", valeur);
    return [dt, dd];
  }));
}

export function poserMonJeu(doc: Document, c: Carnet, decor: Decor): void {
  const d = c.dresseur;
  const nom = doc.querySelector("[data-wm-carnet-jeu-nom]");
  if (nom !== null) nom.textContent = d?.pseudo ?? "—";

  const argent = doc.querySelector("[data-wm-carnet-argent]");
  if (argent !== null) argent.textContent = d === null ? "—" : chiffre(d.pokedollars);

  const palier = doc.querySelector("[data-wm-carnet-palier]");
  if (palier !== null) {
    palier.textContent = d?.palier === null || d === null ? "—" : String(d.palier);
  }

  const compte = doc.querySelector("[data-wm-carnet-equipe-compte]");
  if (compte !== null) {
    const dans = c.pokemon.filter((p) => p.emplacement === "equipe").length;
    compte.textContent = `${dans} / 6`;
  }

  poserLEquipe(doc, c, decor);
  poserLaPension(doc, c, decor);
  poserLesBadges(doc, c, decor);
  poserLeJet(doc, c);
}

/* ── Mon sac ──────────────────────────────────────────────────────── */

export function poserMonSac(doc: Document, c: Carnet, decor: Decor): void {
  const hote = doc.querySelector("[data-wm-carnet-sac]");
  if (hote === null) return;
  const sections = sacRange(c.sac, decor.objets);

  const dit = doc.querySelector("[data-wm-carnet-sac-dit]");
  if (dit !== null) {
    const objets = sections.reduce((n, s) => n + s.lignes.length, 0);
    dit.textContent = objets === 0
      ? "Ton sac est vide. Il se remplit en jouant : fouilles, boutique, récompenses."
      : `${objets} objet${objets > 1 ? "s" : ""}, ${sections.length} famille${
        sections.length > 1 ? "s" : ""
      }. Pas de limite de place.`;
  }

  hote.replaceChildren(...sections.flatMap((s) => {
    const titre = el(doc, "p", "wm-carnet__famille", s.titre);
    const liste = el(doc, "ul", "wm-carnet__objets");
    liste.append(...s.lignes.map(({ objet, quantite }) => {
      const li = el(doc, "li", "wm-carnet__objet");
      const vignette = objet.slug === ""
        ? null
        : decor.sprites?.adresseDObjet(objet.slug) ?? null;
      if (vignette !== null) {
        const img = el(doc, "img");
        //  LA VIGNETTE VIENT DE LA COUVERTURE, pas d'un dossier
        //  `assets/items/` qui n'existe pas non plus.
        img.src = vignette;
        img.alt = "";
        img.loading = "lazy";
        li.append(img);
      }
      li.append(el(doc, "span", "wm-carnet__objet-nom", objet.nom));
      li.append(el(doc, "span", "wm-carnet__quantite", `× ${quantite}`));
      //  LA PHRASE N'EST PAS DANS `objets.json` AU 2 NOVEMBRE. Quand
      //  elle y sera, elle s'affichera ; en attendant la ligne se
      //  dessine sans, plutôt qu'avec un texte inventé.
      if (objet.aQuoiCaSert !== undefined && objet.aQuoiCaSert !== "") {
        li.append(el(doc, "span", "wm-carnet__objet-dit", objet.aQuoiCaSert));
      }
      return li;
    }));
    return [titre, liste];
  }));
}

/* ── Mon Pokédex ──────────────────────────────────────────────────── */

function poserLaFiche(doc: Document, k: CaseDePokedex, decor: Decor): void {
  const fiche = doc.querySelector("[data-wm-carnet-fiche]");
  if (!(fiche instanceof HTMLElement)) return;
  fiche.hidden = false;
  const zone = decor.zones.find((z) => z.forumId === k.espece.zone);

  const titre = el(doc, "p", "wm-carnet__fiche-no", `N° ${k.espece.no} · Rhode`);
  const nom = el(doc, "p", "wm-carnet__fiche-nom", k.espece.nom);
  const types = el(doc, "div", "wm-carnet__fiche-types");
  for (const t of k.espece.types) {
    const p = el(doc, "span", `wm-type wm-type--${t}`, t.charAt(0).toUpperCase() + t.slice(1));
    p.setAttribute("data-wm-type", t);
    types.append(p);
  }

  const dl = el(doc, "dl");
  const ligne = (mot: string, valeur: string) => {
    dl.append(el(doc, "dt", "", mot), el(doc, "dd", "", valeur));
  };
  //  UNE ESPÈCE INCONNUE NE DIT NI SA ZONE NI SES NIVEAUX : ce serait
  //  donner la réponse avant que le joueur l'ait croisée. Elle dit
  //  seulement qu'il ne l'a pas encore vue.
  if (k.etat === "inconnu") {
    ligne("Pas encore", "croisée");
  } else {
    ligne("Attrapés", k.fois === 0 ? "jamais" : `${k.fois} fois`);
    //  UNE ESPÈCE SANS ZONE NE DIT PAS « zone null ». Soixante-seize
    //  d'entre elles ne vivent nulle part : fossiles, leurs évolutions,
    //  et les formes régionales depuis le 6 novembre. Elles disent par
    //  où on les obtient, et taisent les niveaux et le moment — il n'y
    //  a rien de vrai à en dire.
    if (k.espece.zone === null) {
      ligne("Où", ouLaTrouver(k.espece));
    } else {
      ligne("Où", zone?.nom ?? `zone ${k.espece.zone}`);
      ligne("Niveaux", `${k.espece.min} à ${k.espece.max}`);
      ligne(
        "Quand",
        k.espece.quand === "les deux" ? "de jour comme de nuit" : `de ${k.espece.quand}`,
      );
    }
    if (k.croiseLe !== null) ligne("Première fois", jour(k.croiseLe));
  }

  const enfants: Node[] = [
    sprite(doc, decor, k.espece.id, "wm-carnet__fiche-sprite"),
    titre,
    nom,
    types,
    dl,
  ];
  if (k.etat !== "inconnu") {
    const lien = el(doc, "a", "wm-carnet__ailleurs", "Le voir sur la carte");
    //  L'ANNEXE DE LA RÉGION, ET SON ADRESSE DU JOUR. Elle pointait sur
    //  l'ancienne page de la V1 `h9`, qui n'existe plus :
    //  `h9` sert « Le staff » depuis le 4 novembre, et Forumactif ne
    //  route que sur le numéro — le lien ne tombait donc pas en 404, il
    //  menait simplement ailleurs. La règle 27 du garde-fou relit tous
    //  les `/hN-` du dépôt contre `data/annexes.json`.
    lien.href = `/h5-la-region-et-ses-zones#zone-${k.espece.zone}`;
    enfants.push(lien);
  }
  fiche.replaceChildren(...enfants);
}

export function poserMonPokedex(doc: Document, c: Carnet, decor: Decor): void {
  const grille = doc.querySelector("[data-wm-carnet-grille]");
  if (grille === null) return;
  const cases = pokedexAffiche(decor.pokedex, c.pokedex);
  const compte = compteDuPokedex(cases);

  const dit = doc.querySelector("[data-wm-carnet-dex-compte]");
  if (dit !== null) dit.textContent = `${compte.attrapees} / ${compte.enTout}`;
  const croisees = doc.querySelector("[data-wm-carnet-dex-croisees]");
  if (croisees !== null) croisees.textContent = String(compte.croisees);
  const total = doc.querySelector("[data-wm-carnet-dex-total]");
  if (total !== null) total.textContent = String(compte.enTout);

  for (
    const [nom, j] of [["attrapees", jauge(compte.attrapees, compte.enTout)], [
      "croisees",
      jauge(compte.croisees, compte.enTout),
    ]] as const
  ) {
    const barre = doc.querySelector<HTMLElement>(`[data-wm-carnet-dex-barre="${nom}"]`);
    if (barre !== null) barre.style.width = `${(j.part * 100).toFixed(2)}%`;
  }

  grille.replaceChildren(...cases.map((k) => {
    const li = el(doc, "li");
    const bouton = el(doc, "button", `wm-carnet__case wm-carnet__case--${k.etat}`);
    bouton.type = "button";
    bouton.setAttribute("data-wm-zone", String(k.espece.zone));
    bouton.setAttribute("data-wm-etat", k.etat);
    bouton.setAttribute("aria-pressed", "false");
    if (k.etat === "inconnu") {
      bouton.append(el(doc, "span", "", "?"));
      //  LE NOM N'EST PAS DIT NON PLUS, pour la même raison que la
      //  fiche : on ne nomme pas ce qui n'a pas été croisé.
      bouton.setAttribute("aria-label", `Espèce n° ${k.espece.no}, pas encore croisée`);
    } else {
      bouton.append(sprite(doc, decor, k.espece.id, ""));
      bouton.setAttribute(
        "aria-label",
        `${k.espece.nom}, ${k.etat === "attrape" ? "attrapée" : "croisée"}`,
      );
    }
    bouton.addEventListener("click", () => {
      for (const autre of grille.querySelectorAll("[aria-pressed='true']")) {
        autre.setAttribute("aria-pressed", "false");
      }
      bouton.setAttribute("aria-pressed", "true");
      poserLaFiche(doc, k, decor);
    });
    li.append(bouton);
    return li;
  }));

  poserLesFiltres(doc, decor);
}

/** Les filtres cachent et montrent, ils ne rechargent rien (note
 *  389:1143) : les 933 cases sont là depuis le chargement. */
function poserLesFiltres(doc: Document, decor: Decor): void {
  const hote = doc.querySelector("[data-wm-carnet-filtres]");
  const grille = doc.querySelector("[data-wm-carnet-grille]");
  if (hote === null || grille === null) return;

  const filtres: { clef: string; mot: string }[] = [
    { clef: "toutes", mot: "Toutes" },
    ...decor.zones.map((z) => ({ clef: `zone-${z.forumId}`, mot: z.nom })),
    { clef: "attrape", mot: "Attrapées" },
    { clef: "inconnu", mot: "Manquantes" },
  ];

  const appliquer = (clef: string) => {
    for (const b of hote.querySelectorAll("[data-wm-filtre]")) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-wm-filtre") === clef));
    }
    for (const li of grille.querySelectorAll<HTMLElement>("li")) {
      const c = li.firstElementChild;
      const garde = clef === "toutes" ||
        (clef.startsWith("zone-") && c?.getAttribute("data-wm-zone") === clef.slice(5)) ||
        c?.getAttribute("data-wm-etat") === clef;
      li.hidden = !garde;
    }
  };

  hote.replaceChildren(...filtres.map((f) => {
    const b = el(doc, "button", "wm-carnet__filtre", f.mot);
    b.type = "button";
    b.setAttribute("data-wm-filtre", f.clef);
    b.setAttribute("aria-pressed", String(f.clef === "toutes"));
    b.addEventListener("click", () => {
      appliquer(f.clef);
      //  LE FILTRE S'ÉCRIT DANS L'ADRESSE pour que le lien soit
      //  partageable (note 389:1143). `replaceState` et pas `hash` :
      //  changer le fragment déclencherait le routeur d'onglets, qui
      //  croirait qu'on demande un autre onglet.
      globalThis.history?.replaceState(null, "", `#${f.clef}`);
    });
    return b;
  }));

  //  ET IL SE RELIT À L'OUVERTURE : `…#zone-34` arrive filtré.
  const demande = globalThis.location?.hash.replace(/^#/, "") ?? "";
  if (filtres.some((f) => f.clef === demande)) appliquer(demande);
}

/* ── les onglets ──────────────────────────────────────────────────── */

export function poserLesOnglets(doc: Document, surChangement: (c: ClefDOnglet) => void): void {
  const montrer = () => {
    const actif = ongletDeLAdresse(globalThis.location?.hash ?? "");
    for (const o of ONGLETS) {
      const section = doc.querySelector<HTMLElement>(`[data-wm-carnet-page="${o.clef}"]`);
      if (section !== null) section.hidden = o.clef !== actif;
    }
    surChangement(actif);
  };
  globalThis.addEventListener?.("hashchange", montrer);
  montrer();
}

/* ── l'état de la page ────────────────────────────────────────────── */

export function poserLEtat(doc: Document, etat: "dehors" | "charge" | "pret"): void {
  const racine = doc.querySelector(".wm-carnet");
  if (racine !== null) racine.setAttribute("data-wm-etat", etat);
}

export function direLeSouci(doc: Document, mot: string): void {
  const e = doc.querySelector("[data-wm-carnet-souci]");
  if (e !== null) e.textContent = mot;
}

/* ── Mes boîtes ───────────────────────────────────────────────────── */
/*
    LE SEUL ONGLET QUI ÉCRIT DANS LE JEU — et il n'écrit pas lui-même :
    `ranger()` est le seul chemin, parce que le navigateur n'a de droit
    d'écriture ni sur `position` ni sur `boite_no` (0008, 0035).

    CE QUI EST GRISÉ ICI EST UNE POLITESSE, PAS UNE SÉCURITÉ. La note le
    dit : « le navigateur grise ce qu'il peut, mais c'est la fonction
    ranger() qui refuse — un appel bricolé ne passe pas ». Donc on grise
    pour que personne ne tente un geste qui échouera, et on ne compte
    sur rien de tout ça pour protéger quoi que ce soit.
*/

export const CASES_PAR_BOITE = 30;

/** Ce que l'onglet demande au serveur quand on range. */
export type Rangeur = (
  pokemonId: string,
  vers: { emplacement: "equipe" | "boite"; boiteNo: number; position: number },
) => Promise<boolean>;

/** La première place libre de l'équipe, ou `null` si les six sont prises.
 *
 *  UNE PLACE OCCUPÉE PAR UN POKÉMON EN PENSION N'EST PAS LIBRE : il y
 *  reste tant qu'on ne l'a pas récupéré, et `ranger()` refuserait. */
export function placeLibreDeLEquipe(pokemon: readonly PokemonDuCarnet[]): number | null {
  const prises = new Set(
    pokemon.filter((p) => p.emplacement === "equipe").map((p) => p.place),
  );
  for (let i = 1; i <= 6; i++) if (!prises.has(i)) return i;
  return null;
}

/** La première case libre d'une boîte, ou `null` si les trente sont prises. */
export function caseLibreDeLaBoite(
  pokemon: readonly PokemonDuCarnet[],
  boite: number,
): number | null {
  const prises = new Set(
    pokemon.filter((p) => p.emplacement === "boite" && p.boite === boite).map((p) => p.place),
  );
  for (let i = 1; i <= CASES_PAR_BOITE; i++) if (!prises.has(i)) return i;
  return null;
}

export function poserMesBoites(
  doc: Document,
  c: Carnet,
  decor: Decor,
  ranger: Rangeur,
): void {
  const equipe = doc.querySelector("[data-wm-boites-equipe]");
  const grille = doc.querySelector("[data-wm-boites-grille]");
  const detail = doc.querySelector("[data-wm-boites-detail]");
  if (equipe === null || grille === null || detail === null) return;

  let boiteOuverte = 1;
  let choisi: string | null = null;

  const peindre = () => {
    const dansLEquipe = c.pokemon.filter((p) => p.emplacement === "equipe");
    const enPension = dansLEquipe.filter((p) => p.enPension).length;
    const compte = doc.querySelector("[data-wm-boites-compte]");
    if (compte !== null) compte.textContent = `${dansLEquipe.length} / 6`;

    const dit = doc.querySelector("[data-wm-boites-equipe-dit]");
    if (dit !== null) {
      const avecToi = dansLEquipe.length - enPension;
      const libres = 6 - dansLEquipe.length;
      dit.textContent = `${avecToi} avec toi` +
        (enPension > 0 ? `, ${enPension} en pension` : "") +
        (libres > 0
          ? `, ${libres} place${libres > 1 ? "s" : ""} libre${libres > 1 ? "s" : ""}`
          : "") +
        ".";
    }

    //  ── les six places ───────────────────────────────────────────
    equipe.textContent = "";
    for (let place = 1; place <= 6; place++) {
      const p = dansLEquipe.find((x) => x.place === place);
      const li = el(doc, "li");
      const bouton = el(doc, "button", "wm-boites__place");
      bouton.type = "button";
      if (p === undefined) {
        bouton.classList.add("wm-boites__place--vide");
        bouton.append(
          el(doc, "span", "wm-boites__nom", "libre"),
          el(doc, "span", "wm-boites__sous", "—"),
        );
        //  UNE PLACE LIBRE REÇOIT CE QUI EST CHOISI DANS LA BOÎTE.
        bouton.addEventListener("click", () => {
          if (choisi === null) return;
          void bouger(choisi, { emplacement: "equipe", boiteNo: 0, position: place });
        });
      } else {
        if (p.enPension) bouton.classList.add("wm-boites__place--pension");
        bouton.append(
          sprite(doc, decor, p.especeId, ""),
          el(doc, "span", "wm-boites__nom", nomAffiche(p, decor.especes)),
          el(
            doc,
            "span",
            "wm-boites__sous",
            p.enPension ? "en pension" : `niv. ${p.niveau}`,
          ),
        );
        bouton.disabled = p.enPension;
        bouton.addEventListener("click", () => {
          choisi = p.id;
          peindre();
        });
      }
      li.append(bouton);
      equipe.append(li);
    }

    //  ── la boîte ouverte ─────────────────────────────────────────
    const dedans = c.pokemon.filter(
      (p) => p.emplacement === "boite" && p.boite === boiteOuverte,
    );
    const tous = c.pokemon.filter((p) => p.emplacement === "boite").length;
    const ditBoite = doc.querySelector("[data-wm-boites-dit]");
    if (ditBoite !== null) {
      ditBoite.textContent = tous === 0
        ? "Tes boîtes sont vides."
        : `${tous} Pokémon rangé${tous > 1 ? "s" : ""} sur ${3 * CASES_PAR_BOITE} places.`;
    }
    for (const b of doc.querySelectorAll("[data-wm-boites-onglet]")) {
      b.setAttribute(
        "aria-pressed",
        b.getAttribute("data-wm-boites-onglet") === String(boiteOuverte) ? "true" : "false",
      );
    }

    grille.textContent = "";
    for (let place = 1; place <= CASES_PAR_BOITE; place++) {
      const p = dedans.find((x) => x.place === place);
      const li = el(doc, "li");
      const bouton = el(doc, "button", "wm-boites__case");
      bouton.type = "button";
      bouton.setAttribute(
        "aria-current",
        p !== undefined && p.id === choisi ? "true" : "false",
      );
      if (p === undefined) {
        bouton.classList.add("wm-boites__case--vide");
        bouton.setAttribute("aria-label", `Case ${place}, libre`);
        bouton.addEventListener("click", () => {
          if (choisi === null) return;
          void bouger(choisi, {
            emplacement: "boite",
            boiteNo: boiteOuverte,
            position: place,
          });
        });
      } else {
        bouton.append(sprite(doc, decor, p.especeId, ""));
        bouton.setAttribute("aria-label", nomAffiche(p, decor.especes));
        bouton.addEventListener("click", () => {
          choisi = p.id;
          peindre();
        });
      }
      li.append(bouton);
      grille.append(li);
    }

    peindreLeDetail();
  };

  const peindreLeDetail = () => {
    detail.textContent = "";
    const p = c.pokemon.find((x) => x.id === choisi);
    if (p === undefined) {
      detail.append(el(doc, "p", "wm-boites__dit", "Choisis un Pokémon pour le déplacer."));
      return;
    }
    detail.append(
      sprite(doc, decor, p.especeId, ""),
      el(doc, "p", "wm-boites__detail-nom", nomAffiche(p, decor.especes)),
    );

    const faits = el(doc, "dl", "wm-boites__faits");
    const fait = (mot: string, valeur: string) => {
      const ligne = el(doc, "div");
      ligne.append(el(doc, "dt", undefined, mot), el(doc, "dd", undefined, valeur));
      faits.append(ligne);
    };
    fait("Niveau", String(p.niveau));
    fait("Attrapé le", p.captureLe === null ? "—" : jour(p.captureLe));
    //  LE LIEU DE CAPTURE N'EST PAS STOCKÉ : la base garde le SUJET
    //  (`capture_dans`), pas la zone. La planche 72 l'avait relevé comme
    //  une divergence ; tant qu'elle n'est pas comblée, on montre la
    //  scène, qui est vraie, plutôt qu'un lieu qu'on devinerait.
    if (p.captureDans !== null) {
      const ligne = el(doc, "div");
      const dd = el(doc, "dd");
      const a = el(doc, "a", undefined, "la scène");
      a.href = `/t${p.captureDans}`;
      dd.append(a);
      ligne.append(el(doc, "dt", undefined, "Dans"), dd);
      faits.append(ligne);
    }
    detail.append(faits);

    if (p.enPension) {
      detail.append(el(
        doc,
        "p",
        "wm-boites__dit",
        "Il est en pension : il garde sa place dans l'équipe jusqu'à ce que tu le récupères.",
      ));
      return;
    }

    const bouton = el(doc, "button", "wm-carnet__bouton wm-carnet__bouton--plein");
    bouton.type = "button";
    bouton.setAttribute("data-wm-boites-bouger", "");
    if (p.emplacement === "equipe") {
      const libre = caseLibreDeLaBoite(c.pokemon, boiteOuverte);
      bouton.textContent = `Ranger dans la boîte ${boiteOuverte} →`;
      bouton.disabled = libre === null;
      bouton.addEventListener("click", () => {
        if (libre === null) return;
        void bouger(p.id, { emplacement: "boite", boiteNo: boiteOuverte, position: libre });
      });
      detail.append(bouton);
      detail.append(el(
        doc,
        "p",
        "wm-boites__dit",
        libre === null
          ? `La boîte ${boiteOuverte} est pleine.`
          : `Il ira à la case ${libre}. Tu peux aussi cliquer une case vide.`,
      ));
      return;
    }

    const libre = placeLibreDeLEquipe(c.pokemon);
    bouton.textContent = "Mettre dans l'équipe →";
    bouton.disabled = libre === null;
    bouton.addEventListener("click", () => {
      if (libre === null) return;
      void bouger(p.id, { emplacement: "equipe", boiteNo: 0, position: libre });
    });
    detail.append(bouton);
    detail.append(el(
      doc,
      "p",
      "wm-boites__dit",
      libre === null
        ? "Ton équipe est au complet. Range-en un d'abord."
        : "Une place est libre, tu peux la prendre tout de suite.",
    ));
  };

  /** Le déplacement, et ce qu'on fait de l'état local après.
   *
   *  ON NE REPEINT QU'APRÈS LA RÉPONSE DU SERVEUR. Déplacer la case
   *  tout de suite serait plus vif, et montrerait un rangement que la
   *  base vient peut-être de refuser — « un appel bricolé ne passe
   *  pas » vaut aussi pour un appel honnête qui arrive trop tard. */
  const bouger: Rangeur = async (id, vers) => {
    const fait = await ranger(id, vers);
    if (!fait) return false;
    const p = c.pokemon.find((x) => x.id === id);
    const occupant = c.pokemon.find((x) =>
      x.id !== id && x.emplacement === vers.emplacement &&
      x.place === vers.position &&
      (vers.emplacement !== "boite" || x.boite === vers.boiteNo)
    );
    if (p !== undefined) {
      const avant = { emplacement: p.emplacement, boite: p.boite, place: p.place };
      p.emplacement = vers.emplacement;
      p.boite = vers.emplacement === "boite" ? vers.boiteNo : 0;
      p.place = vers.position;
      if (occupant !== undefined) {
        occupant.emplacement = avant.emplacement;
        occupant.boite = avant.boite;
        occupant.place = avant.place;
      }
    }
    peindre();
    return true;
  };

  for (const b of doc.querySelectorAll("[data-wm-boites-onglet]")) {
    b.addEventListener("click", () => {
      boiteOuverte = Number(b.getAttribute("data-wm-boites-onglet")) || 1;
      peindre();
    });
  }

  peindre();
}
