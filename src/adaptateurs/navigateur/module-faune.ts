// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-faune.ts
//
//  COUVERT PAR : outils/faune.mjs — la carte, la faune d'une
//  zone, le sol, le repli sans JavaScript et l'adresse des sprites.
//
//  L'annexe de la carte : la carte de l'index, et sous elle la faune de
//  la zone qu'on vient de cliquer.
//
//  ── LA CARTE EST LA MÊME, ET C'EST TOUT L'INTÉRÊT ───────────────────
//
//  « Tu te bases sur la carte dans l'index du forum qu'on a mis en
//  place ensemble. » Pas une seconde carte qui lui ressemble :
//  `poserLaCarteDans` est la fonction de l'index, avec un hôte qu'on
//  lui donne. Deux cartes finiraient par diverger — c'est la leçon que
//  le dépôt se répète depuis le 1er octobre, et elle vaut pour un
//  dessin comme pour une planche.
//
//  ── LES 933 ESPÈCES N'ENTRENT PAS DANS LA PAGE ──────────────────────
//
//  Elles pèsent 250 Ko en HTML, sprites et types compris. La faune
//  d'une zone se charge donc au clic, un fichier, et reste en mémoire
//  pour le reste de la visite. C'est ce que la note de code demandait
//  déjà : « Rien n'est écrit en dur dans la page : ajouter une espèce,
//  c'est une ligne de JSON. »
//
//  ── ET LA PAGE RESTE LISIBLE SANS CE SCRIPT ─────────────────────────
//
//  Le repli — les dix-sept zones, leurs niveaux, leur description,
//  leur compte d'espèces — est écrit EN DUR dans la page par
//  `outils/annexe-carte.py`. Ce module le cache une fois la carte
//  posée, comme la carte de l'index cache les catégories qu'elle
//  remplace : en JavaScript, jamais dans la feuille. Une règle CSS le
//  ferait disparaître même quand le module tombe, et on aurait une page
//  sans carte ET sans liste.
// ════════════════════════════════════════════════════════════════════

import { poserLaCarteDans } from "./module-carte.ts";
import {
  type EspeceDeZone,
  fourchetteDeNiveaux,
  motDeLaChance,
  motDeLaFrequence,
  motDesConditions,
  type ObjetDeZone,
  parFrequence,
  parRarete,
  partsDuSol,
  pourCent,
  typesDe,
} from "../../navigateur/faune.ts";
import type { TauxDeFouille } from "../../domaine/fouille.ts";
import {
  type CarteDeCouverture,
  Sprites,
  STYLE_PAR_DEFAUT,
  type StyleDeSprite,
} from "../../navigateur/sprites.ts";

/** Ce qu'un fichier `data/faune/<forumId>.json` porte, pour ce qu'on en
 *  fait ici. Le reste — le commentaire d'en-tête, le palier — ne sert
 *  pas : la carte le dit déjà. */
type FichierDeFaune = {
  readonly zone?: string;
  readonly conditions?: Record<string, EspeceDeZone[]>;
};

/** Ce que `data/zones.json` porte, pour ce qu'on en fait ici. */
/** `data/especes-fiches.json`, réduit à ce qu'on en tire : les types.
 *  Le reste — le stade, les PV, la forme — sert ailleurs. */
type Fiches = Readonly<Record<string, { readonly types?: readonly string[] } | undefined>>;

type ZoneDeListe = {
  readonly forumId: number;
  readonly especes?: number;
};

type ZoneDeButin = {
  readonly forumId: number;
  readonly objets?: ObjetDeZone[];
};

type FichierDeButin = {
  readonly fouille?: TauxDeFouille;
  readonly zones?: ZoneDeButin[];
};

export type ReglagesDeLaFaune = {
  readonly doc: Document;
  /** La racine des données, barre finale comprise. */
  readonly racine: string;
  /** La racine du dépôt servi : c'est elle qui recolle les chemins
   *  `assets/…` que `Sprites.adresse` rend relatifs. */
  readonly depot: string;
  /** Le style de sprite du joueur. */
  readonly style?: StyleDeSprite;
  /** `prefers-reduced-motion` : il fige tout, y compris ce qui est
   *  joli. */
  readonly mouvementRefuse?: boolean;
  /** Injecté pour que le harnais serve ses propres fichiers. */
  readonly chercher?: typeof fetch;
};

/** La classe que porte le repli une fois la carte posée. Elle est ici,
 *  exportée, parce que le harnais la vérifie — et qu'il doit vérifier LA
 *  valeur du code, pas une chaîne recopiée à côté. */
export const CLASSE_REPLI_CACHE = "wm-faune-repli--remplace";

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  balise: K,
  classe: string,
  texte?: string,
): HTMLElementTagNameMap[K] {
  const n = doc.createElement(balise);
  n.className = classe;
  if (texte !== undefined) n.textContent = texte;
  return n;
}

/** L'adresse complète d'un sprite, ou `null` si l'espèce n'est pas
 *  couverte.
 *
 *  `Sprites.adresse` rend soit une URL chez PokeAPI, soit un chemin
 *  `assets/…` relatif à la racine du dépôt — elle ne sait pas où le
 *  dépôt est servi, et c'est bien. Le recollage est ici.
 *
 *  ET IL FALLAIT L'APPELER. Le carnet, lui, écrivait
 *  `assets/pokemon/<id>.png` à la main : ce dossier est VIDE dans le
 *  dépôt, zéro fichier suivi, donc ses neuf cent trente-trois sprites
 *  étaient en 404. Les images existent — 1 838 dans
 *  `assets/sprites-figes/`, trois styles — et cette classe est écrite
 *  depuis des semaines pour les trouver. */
export function adresseDuSprite(
  sprites: Sprites | null,
  depot: string,
  especeId: number,
  style: StyleDeSprite,
): string | null {
  if (sprites === null) return null;
  const chemin = sprites.adresse(especeId, style, "pokedex");
  if (chemin === null) return null;
  return chemin.startsWith("http") ? chemin : `${depot}${chemin}`;
}

/** Une carte d'espèce : le sprite, le nom, les niveaux, la chance. */
function carteDEspece(
  doc: Document,
  e: EspeceDeZone,
  sprites: Sprites | null,
  depot: string,
  style: StyleDeSprite,
  types: readonly string[],
  rarete: string,
): HTMLElement {
  const li = el(doc, "li", "wm-faune__espece");
  li.dataset.wmEspece = String(e.espece);
  //  La rareté est sur la CARTE, pas seulement sur le titre de la
  //  tranche : c'est elle qui colore le liseré et la pastille, et une
  //  carte qui se suffit à elle-même se relit hors de son groupe.
  li.dataset.wmRarete = rarete;

  // ── le sprite, dans une boîte de hauteur fixe ──────────────────
  //
  //  LA BOÎTE EST FIXE, L'IMAGE NON. Les sprites vont de 41 × 56 à
  //  207 × 185 : leur imposer 96 × 96 agrandissait les petits — un
  //  Aspicot de 44 pixels étiré à 96 bave — et écrasait les grands.
  //  On ne donne donc PAS de `width` ni de `height` : la feuille
  //  borne la boîte, l'image garde sa taille tant qu'elle y tient, et
  //  ne se réduit que si elle dépasse. Jamais d'agrandissement.
  const boite = el(doc, "span", "wm-faune__boite");
  const adresse = adresseDuSprite(sprites, depot, e.espece, style);
  if (adresse !== null) {
    const image = doc.createElement("img");
    image.className = "wm-faune__sprite";
    image.src = adresse;
    //  LE SPRITE EST DÉCORATIF : le nom est écrit juste en dessous, et
    //  le faire relire dirait deux fois la même chose.
    image.alt = "";
    //  SOIXANTE-DIX SPRITES PAR ZONE : sans `lazy`, le navigateur les
    //  demande tous au premier clic.
    image.loading = "lazy";
    boite.appendChild(image);
  } else {
    boite.classList.add("wm-faune__boite--vide");
  }
  li.appendChild(boite);

  // ── le nom, puis les types ─────────────────────────────────────
  li.appendChild(el(doc, "b", "wm-faune__nom", e.nom));

  if (types.length > 0) {
    const liste = el(doc, "span", "wm-faune__types");
    for (const t of types) {
      const chip = el(doc, "span", "wm-faune__type");
      chip.dataset.wmType = t;
      const icone = doc.createElement("img");
      icone.className = "wm-faune__type-icone";
      icone.src = `${depot}img/types/${t}.png`;
      //  LE NOM DU TYPE EST ÉCRIT À CÔTÉ DE SON ICÔNE : dix-huit
      //  pastilles rondes ne se distinguent pas à la couleur, et une
      //  icône seule ne se lit pas à voix haute.
      icone.alt = "";
      icone.loading = "lazy";
      icone.width = 14;
      icone.height = 14;
      chip.appendChild(icone);
      chip.appendChild(el(doc, "span", "wm-faune__type-mot", t));
      liste.appendChild(chip);
    }
    li.appendChild(liste);
  }

  li.appendChild(el(doc, "span", "wm-faune__niveaux", `niv. ${e.min} à ${e.max}`));

  // ── le pied : la rareté et la chance, sur une ligne ────────────
  //
  //  LES DEUX SONT SUR LA CARTE, et c'est ce que Callista a demandé :
  //  « le nom, le pourcentage, la rareté et le type ». Le titre de la
  //  tranche garde le total, qui lui ne se lit pas carte par carte.
  const pied = el(doc, "span", "wm-faune__pied");
  pied.appendChild(el(doc, "span", "wm-faune__rarete", rarete));
  pied.appendChild(el(doc, "b", "wm-faune__pct", pourCent(e.pct)));
  li.appendChild(pied);

  //  PAS DE « ENVIRON 1 SUR 50 » SUR CHAQUE CARTE. Elle est juste au
  //  dessus, dans le titre de la tranche, et répétée trente-six fois
  //  elle noyait le reste. Le pourcentage, lui, reste : il est court,
  //  et c'est lui qu'on vient chercher.
  return li;
}

/** Les tranches de rareté d'une zone. */
function tranches(
  doc: Document,
  table: readonly EspeceDeZone[],
  sprites: Sprites | null,
  depot: string,
  style: StyleDeSprite,
  fiches: Fiches,
): HTMLElement {
  const hote = el(doc, "div", "wm-faune__tranches");
  for (const t of parRarete(table)) {
    const section = el(doc, "section", "wm-faune__tranche");
    section.dataset.wmRarete = t.rarete;

    const tete = el(doc, "h3", "wm-faune__tranche-tete");
    tete.appendChild(el(doc, "span", "wm-faune__tranche-mot", t.rarete));
    //  LA PART DE LA TRANCHE EST LE CHIFFRE QUI SE COMPARE d'une zone à
    //  l'autre. Trente lignes de pourcentages, non.
    const part = t.commune === null
      ? `${t.especes.length} espèces · ${pourCent(t.part)} en tout`
      : `${t.especes.length} espèces · ${pourCent(t.part)} en tout · ${
        motDeLaChance(t.commune, "rencontre")
      } chacune`;
    tete.appendChild(el(doc, "span", "wm-faune__tranche-part", part));
    section.appendChild(tete);

    const liste = el(doc, "ul", "wm-faune__especes");
    for (const e of t.especes) {
      liste.appendChild(
        carteDEspece(doc, e, sprites, depot, style, typesDe(fiches, e.espece), t.rarete),
      );
    }
    section.appendChild(liste);
    hote.appendChild(section);
  }
  return hote;
}

/** Ce qu'on trouve au sol : les cinq issues, puis les objets de la zone. */
function sol(
  doc: Document,
  taux: TauxDeFouille | undefined,
  objets: readonly ObjetDeZone[],
  sprites: Sprites | null,
): HTMLElement {
  const hote = el(doc, "section", "wm-faune__sol");
  hote.appendChild(el(doc, "h3", "wm-faune__sol-titre", "Ce qu'on trouve au sol"));

  if (taux === undefined) {
    hote.appendChild(
      el(doc, "p", "wm-faune__vide", "La table de fouille n'a pas pu être lue."),
    );
    return hote;
  }

  hote.appendChild(
    el(
      doc,
      "p",
      "wm-faune__dit",
      "Une fouille donne UNE chose, jamais deux. Les cinq parts font cent.",
    ),
  );

  const issues = el(doc, "ul", "wm-faune__issues");
  for (const i of partsDuSol(taux)) {
    const li = el(doc, "li", "wm-faune__issue");
    li.dataset.wmIssue = i.clef;
    li.appendChild(el(doc, "span", "wm-faune__issue-mot", i.mot));
    li.appendChild(el(doc, "b", "wm-faune__issue-pct", pourCent(i.pct)));
    const sur = motDeLaChance(i.pct, "fouille");
    if (sur !== "") li.appendChild(el(doc, "span", "wm-faune__sur", sur));
    issues.appendChild(li);
  }
  hote.appendChild(issues);

  if (objets.length === 0) return hote;

  hote.appendChild(
    el(
      doc,
      "p",
      "wm-faune__dit",
      "Et quand c'est un objet, voici lequel — les chances sont celles " +
        "d'une fouille, pas d'une part de la tranche.",
    ),
  );
  const liste = el(doc, "ul", "wm-faune__objets");
  for (const o of parFrequence(objets)) {
    const li = el(doc, "li", "wm-faune__objet");
    li.dataset.wmObjet = String(o.objet);

    //  LA VIGNETTE VIENT DE LA CARTE, PAS D'UN `onerror`. Trente-trois
    //  des trente-quatre objets en ont une au commit épinglé ; le
    //  trente-quatrième garde sa place vide, comme une espèce hors
    //  couverture.
    const adresse = o.slug === undefined ? null : sprites?.adresseDObjet(o.slug) ?? null;
    if (adresse !== null) {
      const image = doc.createElement("img");
      image.className = "wm-faune__objet-image";
      image.src = adresse;
      image.alt = "";
      image.loading = "lazy";
      image.width = 30;
      image.height = 30;
      li.appendChild(image);
    } else {
      li.appendChild(el(doc, "span", "wm-faune__objet-image wm-faune__objet-image--absent"));
    }

    const mots = el(doc, "span", "wm-faune__objet-mots");
    mots.appendChild(el(doc, "b", "wm-faune__objet-nom", o.nom));
    mots.appendChild(el(doc, "span", "wm-faune__objet-famille", o.famille));
    li.appendChild(mots);

    //  LA FRÉQUENCE EST UNE PASTILLE DE COULEUR, et le mot est dedans :
    //  un joueur sur douze ne distingue pas quatre teintes, et une
    //  couleur seule ne se lit pas à voix haute.
    const freq = el(doc, "span", "wm-faune__tag", motDeLaFrequence(o.pct));
    freq.dataset.wmFrequence = motDeLaFrequence(o.pct);
    li.appendChild(freq);
    li.appendChild(el(doc, "span", "wm-faune__objet-pct", pourCent(o.pct)));
    liste.appendChild(li);
  }
  hote.appendChild(liste);
  return hote;
}

/**
 * Pose la carte et branche la faune dessous.
 *
 * Rend `false` quand la page n'a pas ses trous ou que la carte n'a pas
 * pu se poser : le repli écrit en dur reste alors visible, entier.
 */
export async function poserLAnnexeDeLaCarte(r: ReglagesDeLaFaune): Promise<boolean> {
  const doc = r.doc;
  const chercher = r.chercher ?? fetch;
  const hote = doc.querySelector<HTMLElement>("[data-wm-carte]");
  const panneau = doc.querySelector<HTMLElement>("[data-wm-faune]");
  const repli = doc.querySelector<HTMLElement>("[data-wm-faune-repli]");
  if (hote === null || panneau === null) return false;

  const lire = async (chemin: string): Promise<unknown> => {
    const reponse = await chercher(`${r.racine}${chemin}`, { credentials: "omit" })
      .catch(() => null);
    if (reponse === null || !reponse.ok) return null;
    return await reponse.json().catch(() => null);
  };

  const carte = await lire("carte.json");
  if (carte === null) return false;

  //  LA COUVERTURE DES SPRITES EST FACULTATIVE : si elle ne vient pas,
  //  la page montre les noms et les chances sans images, ce qui reste
  //  la moitié utile. Une annexe qui refuse de s'afficher parce qu'un
  //  fichier d'images manque serait un mauvais échange.
  const couverture = await lire("sprites-couverture.json") as CarteDeCouverture | null;
  const style = r.style ?? STYLE_PAR_DEFAUT;
  const sprites = couverture === null
    ? null
    : new Sprites(couverture, r.mouvementRefuse ?? false);

  //  `butin.json` est demandé UNE fois, au montage, et pas au premier
  //  clic : il porte les dix-sept zones d'un coup, et l'attendre au clic
  //  ferait clignoter le bloc du sol après celui des espèces.
  const butin = await lire("butin.json") as FichierDeButin | null;
  const taux = butin?.fouille;
  const objetsParZone = new Map<number, ObjetDeZone[]>();
  for (const z of butin?.zones ?? []) objetsParZone.set(z.forumId, z.objets ?? []);

  //  `zones.json` fait 3 Ko et porte le compte d'espèces des dix-sept
  //  zones. Sans lui, la liste de la carte montrerait vingt-six tirets
  //  en attendant un clic — les comptages de l'index se lisent sur des
  //  lignes de forum, qui n'existent pas sur une page du portail.
  const liste = await lire("zones.json") as { zones?: ZoneDeListe[] } | null;
  const comptes = new Map<number, number>();
  for (const z of liste?.zones ?? []) {
    if (typeof z.especes === "number") comptes.set(z.forumId, z.especes);
  }

  //  LES TYPES VIENNENT DE `especes-fiches.json`, 95 Ko demandés une
  //  fois au montage. Les recopier dans les dix-sept tables de faune
  //  serait dix-sept endroits de plus à tenir d'accord avec un
  //  dix-huitième.
  const fiches = (await lire("especes-fiches.json") as { fiches?: Fiches } | null)
    ?.fiches ?? {};

  const connues = new Map<number, FichierDeFaune>();

  const montrer = async (forumId: number): Promise<void> => {
    let faune = connues.get(forumId);
    if (faune === undefined) {
      const brut = await lire(`faune/${forumId}.json`) as FichierDeFaune | null;
      //  UNE ZONE SANS FICHIER N'EST PAS UNE PANNE : la carte porte
      //  aussi les villes et la Ligue, qui n'ont pas de faune. On le dit
      //  et on ne laisse pas la section d'avant à l'écran, ce qui ferait
      //  croire que la ville a les espèces de la zone précédente.
      if (brut === null) {
        panneau.hidden = false;
        panneau.dataset.wmFaune = "sans";
        panneau.replaceChildren(
          el(doc, "p", "wm-faune__vide", "Aucune faune sauvage ici."),
        );
        return;
      }
      faune = brut;
      connues.set(forumId, faune);
    }

    const conditions = faune.conditions ?? {};
    const table = conditions["jour"] ?? Object.values(conditions)[0] ?? [];
    const vu = motDesConditions(conditions);
    const niveaux = fourchetteDeNiveaux(table);

    const tete = el(doc, "header", "wm-faune__tete");
    tete.appendChild(el(doc, "h2", "wm-faune__titre", faune.zone ?? ""));
    const chiffres = el(doc, "p", "wm-faune__chiffres");
    chiffres.appendChild(el(doc, "span", "wm-faune__chiffre", `${table.length} espèces`));
    if (niveaux !== null) {
      chiffres.appendChild(
        el(doc, "span", "wm-faune__chiffre", `niveaux ${niveaux.min} à ${niveaux.max}`),
      );
    }
    tete.appendChild(chiffres);
    if (vu.phrase !== "") tete.appendChild(el(doc, "p", "wm-faune__dit", vu.phrase));

    panneau.hidden = false;
    panneau.dataset.wmFaune = String(forumId);
    panneau.replaceChildren(
      tete,
      tranches(doc, table, sprites, r.depot, style, fiches),
      sol(doc, taux, objetsParZone.get(forumId) ?? [], sprites),
    );
  };

  const pose = poserLaCarteDans(doc, hote, carte, {
    //  LE CLIC NE DOIT PAS ATTENDRE LE RÉSEAU. `montrer` est lancée et
    //  on rend la main : la carte s'allume tout de suite, la faune
    //  arrive derrière. Une erreur ne casse pas la carte.
    surChoix: (forumId) => void montrer(forumId).catch(() => {}),
    //  Une ville n'a pas d'espèces, et `null` lui rend son tiret —
    //  écrire « 0 espèce » dirait qu'on a compté et trouvé zéro.
    chiffreDe: (forumId) => {
      const n = comptes.get(forumId);
      return n === undefined ? null : `${n} espèces`;
    },
    //  L'invite de l'index promet « son dernier sujet », que cette
    //  page ne sait pas lire : elle n'a aucune ligne de forum.
    invite: "Clique une zone sur la carte : tout ce qui y vit s'affiche " +
      "en dessous, avec les chances de le croiser.",
  });
  if (pose === null) return false;

  //  LE REPLI SE CACHE ICI, PAS DANS LA FEUILLE. Une règle CSS le ferait
  //  disparaître même quand le module tombe, et la page n'aurait alors
  //  ni carte ni liste.
  repli?.classList.add(CLASSE_REPLI_CACHE);
  return true;
}
