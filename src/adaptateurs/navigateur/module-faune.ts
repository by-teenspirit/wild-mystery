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
import { type BasesDeForme, basesDepuis, rangerDansLeDex } from "../../navigateur/dex.ts";
import {
  type ChoixDeFaune,
  type EspeceDeZone,
  filtresDeFaune,
  fourchetteDeNiveaux,
  motDeLaChance,
  motDeLaFrequence,
  motDesConditions,
  motDuCompteDeFaune,
  type ObjetDeZone,
  parFrequence,
  partsDuSol,
  pourCent,
  typesDe,
  visibleDansLaFaune,
} from "../../navigateur/faune.ts";
import type { TauxDeFouille } from "../../domaine/fouille.ts";
import {
  type CarteDeCouverture,
  type Emplacement,
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
  /** La carte prend toute la largeur, sa colonne passe dessous. */
  readonly large?: boolean;
  /** Les villes restent dessinées, mais ni cliquables ni listées. */
  readonly sansVilles?: boolean;
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
  //  L'EMPLACEMENT EST UN ARGUMENT, ET IL A FAILLI NE PAS L'ÊTRE.
  //
  //  Il était écrit en dur à « pokedex ». Pour faire bouger les
  //  sprites de la zone (4 novembre) je l'ai passé à « zone » — et le
  //  carnet, qui appelle la MÊME fonction, s'est mis à servir 933 GIF
  //  animés dans sa grille. Mesuré par `outils/carnet.mjs` dans la
  //  minute : c'est exactement ce que le commentaire de `sprites.ts`
  //  interdisait, et une constante partagée ne pouvait pas dire deux
  //  choses à la fois.
  ou: Emplacement = "pokedex",
): string | null {
  if (sprites === null) return null;
  const chemin = sprites.adresse(especeId, style, ou);
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
  //  CE QUE LIT LA BARRE DE TRI. Un seul attribut pour les espèces et
  //  les objets, sinon le filtre devrait connaître deux vocabulaires.
  li.dataset.wmTri = rarete;

  // ── la tête : la rareté à gauche, la chance à droite ───────────
  //
  //  « Le tag commun en haut à gauche. Le pourcentage de le voir, en
  //  haut à droite. » (4 novembre) C'était un pied, sous le nom et les
  //  types ; les deux choses qu'on compare d'une carte à l'autre
  //  étaient donc les dernières lues, et à des hauteurs différentes
  //  selon qu'une espèce a un type ou deux.
  const tete = el(doc, "span", "wm-faune__tete");
  tete.appendChild(el(doc, "span", "wm-faune__rarete", rarete));
  tete.appendChild(el(doc, "b", "wm-faune__pct", pourCent(e.pct)));
  li.appendChild(tete);

  // ── le sprite, dans une boîte de hauteur fixe ──────────────────
  //
  //  LA BOÎTE EST FIXE, L'IMAGE NON. Les sprites vont de 41 × 56 à
  //  207 × 185 : leur imposer 96 × 96 agrandissait les petits — un
  //  Aspicot de 44 pixels étiré à 96 bave — et écrasait les grands.
  //  On ne donne donc PAS de `width` ni de `height` : la feuille
  //  borne la boîte, l'image garde sa taille tant qu'elle y tient, et
  //  ne se réduit que si elle dépasse. Jamais d'agrandissement.
  const boite = el(doc, "span", "wm-faune__boite");
  const adresse = adresseDuSprite(sprites, depot, e.espece, style, "zone");
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

  //  PAS DE « ENVIRON 1 SUR 50 » SUR CHAQUE CARTE : répétée soixante
  //  fois, elle noyait le reste. Le pourcentage, lui, est en tête — il
  //  est court, et c'est lui qu'on vient chercher.
  return li;
}

/** Une carte d'objet : même gabarit que l'espèce, autre contenu. */
function carteDObjet(
  doc: Document,
  o: ObjetDeZone,
  sprites: Sprites | null,
): HTMLElement {
  //  ── LA MÊME CARTE QUE POUR UNE ESPÈCE ────────────────────────
  //
  //  Elles sont maintenant dans LA MÊME LISTE : deux gabarits dans une
  //  grille se verraient. L'objet reprend donc les classes de
  //  l'espèce, et c'est `data-wm-frequence` qui le colore au lieu de
  //  `data-wm-rarete`.
  const li = el(doc, "li", "wm-faune__espece wm-faune__objet");
  li.dataset.wmObjet = String(o.objet);
  li.dataset.wmFrequence = motDeLaFrequence(o.pct);
  li.dataset.wmTri = "objet";

  const tete = el(doc, "span", "wm-faune__tete");
  tete.appendChild(el(doc, "span", "wm-faune__rarete", motDeLaFrequence(o.pct)));
  tete.appendChild(el(doc, "b", "wm-faune__pct", pourCent(o.pct)));
  li.appendChild(tete);

  //  LA VIGNETTE VIENT DE LA CARTE, PAS D'UN `onerror`. Trente-trois
  //  des trente-quatre objets en ont une au commit épinglé ; le
  //  trente-quatrième garde sa place vide, comme une espèce hors
  //  couverture.
  const boite = el(doc, "span", "wm-faune__boite wm-faune__boite--objet");
  const adresse = o.slug === undefined ? null : sprites?.adresseDObjet(o.slug) ?? null;
  if (adresse !== null) {
    const image = doc.createElement("img");
    image.className = "wm-faune__sprite";
    image.src = adresse;
    image.alt = "";
    image.loading = "lazy";
    boite.appendChild(image);
  } else {
    boite.classList.add("wm-faune__boite--vide");
  }
  li.appendChild(boite);

  li.appendChild(el(doc, "b", "wm-faune__nom", o.nom));

  const familles = el(doc, "span", "wm-faune__types");
  familles.appendChild(el(doc, "span", "wm-faune__type", o.famille));
  li.appendChild(familles);
  return li;
}

/**
 * LA LISTE D'UNE ZONE : toutes les espèces, puis les objets, dans une
 * seule grille, avec la barre qui la trie.
 *
 * « Tu mets toutes les espèces ensemble dans l'ordre, tu rajoutes un
 * filtre : commun, peu commun, rare, objet » (4 novembre).
 *
 * C'ÉTAIT TROIS TRANCHES ET UNE QUATRIÈME LISTE. Pour savoir si une
 * espèce est dans la zone, il fallait deviner sa rareté avant de
 * savoir où regarder — et les objets étaient ailleurs encore. Une
 * grille, l'ordre du dex, et quatre boutons pour la réduire.
 *
 * L'ORDRE EST CELUI DU DEX NATIONAL, chaque forme régionale derrière
 * l'espèce qu'elle décline. Voir `src/navigateur/dex.ts`.
 */
function listeDeLaZone(
  doc: Document,
  table: readonly EspeceDeZone[],
  objets: readonly ObjetDeZone[],
  sprites: Sprites | null,
  depot: string,
  style: StyleDeSprite,
  fiches: Fiches,
  bases: BasesDeForme,
): HTMLElement {
  const hote = el(doc, "div", "wm-faune__tranches");

  const liste = el(doc, "ul", "wm-faune__especes");
  liste.dataset.wmListe = "";
  for (const e of rangerDansLeDex(table, (x) => x.espece, bases)) {
    liste.appendChild(
      carteDEspece(doc, e, sprites, depot, style, typesDe(fiches, e.espece), e.rarete),
    );
  }
  //  LES OBJETS FERMENT LA MARCHE, par fréquence : ils n'ont pas de
  //  numéro de dex, donc rien pour les ranger parmi les espèces.
  for (const o of parFrequence(objets)) liste.appendChild(carteDObjet(doc, o, sprites));

  //  ── LA BARRE EST POSÉE ICI, AVEC LA LISTE ────────────────────
  //
  //  Contrairement à celle de l'annexe 11, elle ne peut pas être posée
  //  au chargement : la liste est refaite à chaque clic sur la carte,
  //  et les comptes changent de zone en zone. Elle naît donc avec sa
  //  liste, et meurt avec elle.
  const filtres = filtresDeFaune(table, objets);
  if (filtres.length > 0) {
    const barre = el(doc, "div", "wm-filtres");
    barre.setAttribute("role", "group");
    barre.setAttribute("aria-label", "Trier la liste");

    const annonce = el(doc, "p", "wm-filtres__compte");
    annonce.setAttribute("role", "status");
    annonce.setAttribute("aria-live", "polite");

    const boutons = new Map<string, HTMLButtonElement>();
    const montrer = (choix: ChoixDeFaune): void => {
      let vues = 0;
      for (const li of Array.from(liste.children) as HTMLElement[]) {
        const oui = visibleDansLaFaune(li.dataset.wmTri ?? "", choix);
        li.hidden = !oui;
        if (oui) vues += 1;
      }
      for (const [k, b] of boutons) {
        const sien = k === choix;
        b.classList.toggle("wm-filtre--actif", sien);
        b.setAttribute("aria-pressed", String(sien));
      }
      annonce.textContent = motDuCompteDeFaune(vues, choix);
    };

    for (const f of filtres) {
      const bouton = doc.createElement("button");
      bouton.type = "button";
      bouton.className = "wm-filtre";
      bouton.setAttribute("aria-pressed", "false");
      bouton.dataset.wmFiltre = f.cle;
      bouton.appendChild(el(doc, "span", "wm-filtre__mot", f.mot));
      bouton.appendChild(el(doc, "span", "wm-filtre__nombre", String(f.nombre)));
      bouton.addEventListener("click", () => montrer(f.cle));
      boutons.set(f.cle, bouton);
      barre.appendChild(bouton);
    }
    hote.appendChild(barre);
    hote.appendChild(annonce);
    montrer("tous");
  }

  hote.appendChild(liste);
  return hote;
}

/** Ce qu'on trouve au sol : les cinq issues d'une fouille. */
function sol(doc: Document, taux: TauxDeFouille | undefined): HTMLElement {
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
      "Une fouille donne UNE chose, jamais deux. Les cinq parts font cent. " +
        "Quand c'est un objet, le bouton « Objet » dit lequel, et avec " +
        "quelle chance.",
    ),
  );

  const issues = el(doc, "ul", "wm-faune__issues");
  for (const i of partsDuSol(taux)) {
    const li = el(doc, "li", "wm-faune__issue");
    li.dataset.wmIssue = i.clef;
    //  LE CHIFFRE D'ABORD : c'est ce qu'on vient chercher dans un
    //  tableau de cinq lignes, et le mot l'explique.
    li.appendChild(el(doc, "b", "wm-faune__issue-pct", pourCent(i.pct)));
    li.appendChild(el(doc, "span", "wm-faune__issue-mot", i.mot));
    const sur = motDeLaChance(i.pct, "fouille");
    if (sur !== "") li.appendChild(el(doc, "span", "wm-faune__sur", sur));
    issues.appendChild(li);
  }
  hote.appendChild(issues);
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

  //  L'ORDRE DU DEX. Absent, `basesDepuis` rend un objet vide et les
  //  formes régionales partent à la fin : la page reste lisible, elle
  //  est seulement moins bien rangée.
  const bases = basesDepuis(await lire("ordre-du-dex.json"));

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
    //  LE SOL AVANT LA LISTE : il explique ce que « objet » veut dire
    //  dans la barre juste en dessous. L'inverse obligeait à redescendre
    //  sous soixante cartes pour comprendre le quatrième bouton.
    panneau.replaceChildren(
      tete,
      sol(doc, taux),
      listeDeLaZone(
        doc,
        table,
        objetsParZone.get(forumId) ?? [],
        sprites,
        r.depot,
        style,
        fiches,
        bases,
      ),
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
    large: r.large,
    sansVilles: r.sansVilles,
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
