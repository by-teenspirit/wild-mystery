/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/catalogue.ts
//
//  Les deux fichiers de données dont la barre a besoin : la liste des
//  zones, et les lieux d'une zone. Les mêmes que le serveur lit — il n'y
//  a qu'une source, et c'est le dépôt.
//
//  ── LA RACINE SE DÉDUIT, ELLE NE SE CODE PAS ─────────────────────────
//
//  Le script est servi depuis `…/wild-mystery@<branche>/js/wild-mystery.js`.
//  Les données sont à côté, sous `…/data/`. On prend donc l'adresse du
//  script lui-même et on remonte d'un cran : la branche, le commit, le
//  dépôt — tout suit automatiquement.
//
//  Coder l'adresse en dur marcherait aujourd'hui et mentirait au premier
//  changement de branche, exactement comme le hash l'a fait pour le
//  template. On ne refait pas la même erreur deux jours de suite.
//
//  ── UNE PANNE DE RÉSEAU N'EST PAS UNE PANNE DE PAGE ──────────────────
//
//  Tout rend une valeur vide plutôt que de lever. Sans les données, il
//  manque un bouton ; avec une exception, c'est le thème, le masquage des
//  marqueurs et tout le reste qui tombent.
// ════════════════════════════════════════════════════════════════════

import {
  type LieuChoisissable,
  lieuxDepuis,
  type ZoneDuNavigateur,
  zonesDepuis,
} from "../../navigateur/zone.ts";

/** Ce dont la barre a besoin pour se poser. */
export interface Catalogue {
  zones(): Promise<readonly ZoneDuNavigateur[]>;
  lieuxDe(forumId: number): Promise<readonly LieuChoisissable[]>;
  /** Le nom français d'une espèce, ou `null` si on ne le connaît pas.
   *
   *  `null` et pas « Espèce 42 » : un nom inventé dans un bilan a l'air
   *  d'une donnée, et le joueur le recopierait dans une contestation.
   *  L'appelant décide quoi afficher à la place. */
  nomEspece(especeId: number): Promise<string | null>;
}

/** L'index des espèces, tel que `outils/especes.py` l'écrit.
 *
 *  Il ne couvre que les espèces présentes en zone sauvage — c'est
 *  exactement ce qu'une ligne de registre écrite en zone peut nommer. */
export function especesDepuis(donnees: unknown): ReadonlyMap<number, string> {
  const vide = new Map<number, string>();
  if (typeof donnees !== "object" || donnees === null) return vide;
  const brut = (donnees as { especes?: unknown }).especes;
  if (typeof brut !== "object" || brut === null) return vide;

  const index = new Map<number, string>();
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    const id = Number(cle);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (typeof valeur !== "string" || valeur === "") continue;
    index.set(id, valeur);
  }
  return index;
}

/** L'adresse du dossier `data/`, déduite de celle du script.
 *
 *  Rend null si on n'y arrive pas — page ouverte autrement, script
 *  recopié à la main, `currentScript` indisponible. Dans ce cas la barre
 *  ne se pose pas, ce qui vaut mieux que de la poser au hasard. */
export function racineDesDonnees(adresseDuScript: string | null): string | null {
  if (adresseDuScript === null) return null;
  //  `.../js/wild-mystery.js` → `.../data/`
  const coupe = adresseDuScript.lastIndexOf("/js/");
  if (coupe < 0) return null;
  return `${adresseDuScript.slice(0, coupe)}/data/`;
}

/** L'adresse du dossier `assets/`, déduite de celle du script.
 *
 *  Même coupe que `racineDesDonnees`, et c'est voulu : les deux
 *  dossiers sont frères dans le dépôt, donc ils le restent une fois
 *  servis, quel que soit le CDN. Une seconde racine à régler serait
 *  une seconde occasion de les désaccorder. */
export function racineDesImages(adresseDuScript: string | null): string | null {
  const donnees = racineDesDonnees(adresseDuScript);
  return donnees === null ? null : donnees.replace(/data\/$/, "assets/");
}

/** L'adresse de notre propre script, telle que le navigateur la connaît.
 *
 *  `currentScript` n'est renseigné que pendant l'exécution initiale : on
 *  le lit tout de suite, au chargement du module, et pas à la première
 *  requête — qui arrive après un `await` et le trouverait à null. */
export function adresseDuScript(doc: Document): string | null {
  const courant = doc.currentScript;
  if (courant instanceof HTMLScriptElement && courant.src !== "") return courant.src;
  //  Repli : le dernier script de la page qui porte notre nom.
  const notres = Array.from(doc.querySelectorAll<HTMLScriptElement>("script[src]"))
    .filter((s) => s.src.includes("/js/wild-mystery.js"));
  return notres.length > 0 ? notres[notres.length - 1].src : null;
}

type Recuperateur = (url: string) => Promise<unknown>;

/** Récupère et décode, et rend `null` sur le moindre accroc. */
async function parDefaut(url: string): Promise<unknown> {
  const reponse = await fetch(url, { credentials: "omit" });
  if (!reponse.ok) return null;
  return await reponse.json();
}

export class CatalogueDistant implements Catalogue {
  readonly #racine: string;
  readonly #recuperer: Recuperateur;
  //  Une page peut poser la barre et, plus tard, ouvrir un menu : on ne
  //  retélécharge pas. La promesse est mise en cache, pas son résultat,
  //  pour que deux appels simultanés ne fassent qu'une requête.
  #zones: Promise<readonly ZoneDuNavigateur[]> | null = null;
  #especes: Promise<ReadonlyMap<number, string>> | null = null;
  readonly #lieux = new Map<number, Promise<readonly LieuChoisissable[]>>();

  constructor(racine: string, recuperer: Recuperateur = parDefaut) {
    this.#racine = racine;
    this.#recuperer = recuperer;
  }

  async #lire(chemin: string): Promise<unknown> {
    try {
      return await this.#recuperer(`${this.#racine}${chemin}`);
    } catch {
      //  Réseau coupé, CDN en panne, JSON tronqué : il manquera un
      //  bouton, et c'est tout.
      return null;
    }
  }

  zones(): Promise<readonly ZoneDuNavigateur[]> {
    this.#zones ??= this.#lire("zones.json").then(zonesDepuis);
    return this.#zones;
  }

  lieuxDe(forumId: number): Promise<readonly LieuChoisissable[]> {
    const connu = this.#lieux.get(forumId);
    if (connu !== undefined) return connu;
    const promesse = this.#lire(`faune/${forumId}.json`).then(lieuxDepuis);
    this.#lieux.set(forumId, promesse);
    return promesse;
  }

  async nomEspece(especeId: number): Promise<string | null> {
    //  Un seul fichier pour les 444 espèces : on le prend en entier, une
    //  fois, plutôt qu'une requête par identifiant. Un bilan en nomme
    //  volontiers une dizaine.
    this.#especes ??= this.#lire("especes.json").then(especesDepuis);
    return (await this.#especes).get(especeId) ?? null;
  }
}

/** Le forum de la page, lu dans le fil d'Ariane.
 *
 *  RELEVÉ SUR LE FORUM le 3 octobre : `.sub-header-path` porte la suite
 *  des forums parents, du plus général au plus précis. **Le DERNIER est
 *  celui du sujet** — « Zones Palier 1 » puis « Forêt Marécageuse ».
 *  Prendre le premier donnerait le forum de palier, qui n'est pas une
 *  zone, et la barre ne se poserait jamais. */
export function forumDeLaPage(doc: Document): number | null {
  const liens = Array.from(
    doc.querySelectorAll<HTMLAnchorElement>(".sub-header-path a[href]"),
  );
  for (let i = liens.length - 1; i >= 0; i--) {
    const trouve = /^\/f(\d+)-/.exec(liens[i].getAttribute("href") ?? "");
    if (trouve !== null) return Number(trouve[1]);
  }
  return null;
}
