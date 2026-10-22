// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/fichiers.ts
//
//  La faune, lue dans les fichiers JSON du dépôt.
//
//  Le même adaptateur sert des deux côtés, parce qu'il ne lit pas les
//  fichiers lui-même : il reçoit une fonction de lecture.
//    · côté serveur  → Deno.readTextFile
//    · côté navigateur → fetch sur jsDelivr, à un tag figé
//
//  C'est le domaine qui juge une table (verifieTable) : rien de la règle
//  n'est réécrit ici. Cet adaptateur traduit une forme de fichier en
//  type du domaine, et refuse ce qui ne tient pas.
// ════════════════════════════════════════════════════════════════════

import type { EntreeDeTable, Rarete } from "../../domaine/rencontre.ts";
import { verifieTable } from "../../domaine/rencontre.ts";
import type { Faune, ZoneSauvage } from "../../application/ports.ts";

/** Comment on obtient le texte d'un fichier. Le chemin est relatif à la
 *  racine du dépôt : « data/zones.json », « data/faune/9.json ». */
export type LecteurDeTexte = (chemin: string) => Promise<string>;

export class DonneesIllisibles extends Error {
  constructor(chemin: string, raison: string) {
    super(`${chemin} : ${raison}`);
    this.name = "DonneesIllisibles";
  }
}

export class ZoneInconnue extends Error {
  constructor(forumId: number) {
    super(`Le forum ${forumId} n'est pas une zone sauvage.`);
    this.name = "ZoneInconnue";
  }
}

export class ZoneSansFaune extends Error {
  constructor(forumId: number, nom: string) {
    super(`La zone ${nom} (f${forumId}) n'a aucune table de faune.`);
    this.name = "ZoneSansFaune";
  }
}

//  `LieuInconnu` A DISPARU LE 15 OCTOBRE, avec le niveau de lieu
//  lui-même : il n'y a plus de nom à ne pas reconnaître.

export class ConditionInconnue extends Error {
  constructor(condition: string, zone: string, connues: readonly string[]) {
    super(`« ${condition} » n'existe pas en ${zone}. Connues : ${connues.join(", ")}.`);
    this.name = "ConditionInconnue";
  }
}

const RARETES: readonly string[] = ["commun", "peu commun", "rare"];

/** Un nom de condition traverse un fichier de données écrit à la main.
 *  On compare donc sur une forme réduite : sans accent, sans casse, sans
 *  espaces en trop — « Tempête de Sable » et « tempete de sable » sont
 *  la même condition. */
export function reduire(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// ── la forme des fichiers, telle qu'elle est sur le disque ───────────

type ZoneDuFichier = {
  forumId: number;
  nom: string;
  palier: number;
  parentId: number;
  faune: string | null;
};

type EntreeDuFichier = {
  espece: number;
  pct: number;
  min: number;
  max: number;
  rarete: string;
};

function exige(condition: boolean, chemin: string, raison: string): asserts condition {
  if (!condition) throw new DonneesIllisibles(chemin, raison);
}

function analyse(chemin: string, texte: string): unknown {
  try {
    return JSON.parse(texte);
  } catch (e) {
    throw new DonneesIllisibles(chemin, `JSON invalide (${(e as Error).message})`);
  }
}

function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
    ? valeur as Record<string, unknown>
    : null;
}

/** Traduit une entrée de fichier en entrée du domaine. Les noms d'espèce
 *  du fichier sont ignorés : c'est le Catalogue qui les sert. */
function versDomaine(chemin: string, brut: unknown): EntreeDeTable {
  const o = objet(brut);
  exige(o !== null, chemin, "une entrée de table n'est pas un objet");
  const e = o as unknown as EntreeDuFichier;
  exige(
    typeof e.espece === "number" && typeof e.pct === "number" &&
      typeof e.min === "number" && typeof e.max === "number",
    chemin,
    `entrée incomplète : ${JSON.stringify(brut)}`,
  );
  exige(
    RARETES.includes(e.rarete),
    chemin,
    `rareté « ${e.rarete} » inconnue pour l'espèce ${e.espece}`,
  );
  return {
    especeId: e.espece,
    pourcentage: e.pct,
    niveauMin: e.min,
    niveauMax: e.max,
    rarete: e.rarete as Rarete,
  };
}

type FauneChargee = {
  /** forme réduite de la condition → table de la zone */
  readonly tables: ReadonlyMap<string, readonly EntreeDeTable[]>;
  /** les noms de condition tels que le fichier les écrit, dans l'ordre */
  readonly conditions: readonly string[];
};

export class FauneEnFichiers implements Faune {
  /** zones.json, lu une seule fois. */
  private zones: Promise<readonly ZoneDuFichier[]> | null = null;
  /** un fichier de faune par zone, lu à la demande puis gardé. */
  private readonly chargees = new Map<number, Promise<FauneChargee>>();

  /**
   * @param lire   comment obtenir le texte d'un fichier
   * @param racine préfixe ajouté devant chaque chemin. Vide côté Deno,
   *               l'URL jsDelivr figée côté navigateur.
   */
  constructor(
    private readonly lire: LecteurDeTexte,
    private readonly racine = "",
  ) {}

  // ── zones ──────────────────────────────────────────────────────────

  private lesZones(): Promise<readonly ZoneDuFichier[]> {
    if (this.zones === null) this.zones = this.chargerLesZones();
    return this.zones;
  }

  private async chargerLesZones(): Promise<readonly ZoneDuFichier[]> {
    const chemin = "data/zones.json";
    const racine = objet(analyse(chemin, await this.lire(this.racine + chemin)));
    exige(racine !== null, chemin, "la racine n'est pas un objet");
    const brutes = racine.zones;
    exige(Array.isArray(brutes), chemin, "la clé « zones » n'est pas un tableau");

    const zones: ZoneDuFichier[] = [];
    for (const b of brutes as unknown[]) {
      const o = objet(b);
      exige(o !== null, chemin, "une zone n'est pas un objet");
      const z = o as unknown as ZoneDuFichier;
      exige(
        typeof z.forumId === "number" && typeof z.nom === "string",
        chemin,
        `zone incomplète : ${JSON.stringify(b)}`,
      );
      exige(
        z.palier === 1 || z.palier === 2 || z.palier === 3,
        chemin,
        `palier ${z.palier} hors de 1–3 pour ${z.nom}`,
      );
      zones.push(z);
    }
    exige(zones.length > 0, chemin, "aucune zone");
    return zones;
  }

  async zonesSauvages(): Promise<readonly ZoneSauvage[]> {
    return (await this.lesZones()).map((z) => ({
      forumId: z.forumId,
      nom: z.nom,
      palier: z.palier as 1 | 2 | 3,
      parentId: z.parentId,
      aUneFaune: typeof z.faune === "string" && z.faune.length > 0,
    }));
  }

  private async laZone(forumId: number): Promise<ZoneDuFichier> {
    const trouvee = (await this.lesZones()).find((z) => z.forumId === forumId);
    if (trouvee === undefined) throw new ZoneInconnue(forumId);
    return trouvee;
  }

  // ── faune d'une zone ───────────────────────────────────────────────

  private laFaune(zone: ZoneDuFichier): Promise<FauneChargee> {
    const deja = this.chargees.get(zone.forumId);
    if (deja !== undefined) return deja;
    const encours = this.chargerLaFaune(zone);
    this.chargees.set(zone.forumId, encours);
    return encours;
  }

  private async chargerLaFaune(zone: ZoneDuFichier): Promise<FauneChargee> {
    if (typeof zone.faune !== "string" || zone.faune.length === 0) {
      throw new ZoneSansFaune(zone.forumId, zone.nom);
    }
    const chemin = zone.faune;
    const racine = objet(analyse(chemin, await this.lire(this.racine + chemin)));
    exige(racine !== null, chemin, "la racine n'est pas un objet");
    exige(
      racine.forumId === zone.forumId,
      chemin,
      `annonce le forum ${racine.forumId}, attendu ${zone.forumId}`,
    );
    //  LA CLÉ EST « conditions » DEPUIS LE 15 OCTOBRE, et c'était
    //  « lieux ». Un ancien fichier doit être refusé, pas lu de travers :
    //  ses tables par lieu n'ont pas la même forme, et les accepter en
    //  silence donnerait une zone sans rencontre.
    exige(
      racine.lieux === undefined,
      chemin,
      "porte encore des « lieux » : c'est un fichier d'avant le 15 octobre " +
        "(les anciens sont dans data/faune-v1/)",
    );
    const parCondition = objet(racine.conditions);
    exige(parCondition !== null, chemin, "la clé « conditions » n'est pas un objet");

    const tables = new Map<string, readonly EntreeDeTable[]>();
    const conditions: string[] = [];
    for (const [condition, brute] of Object.entries(parCondition)) {
      exige(Array.isArray(brute), chemin, `la condition « ${condition} » n'est pas un tableau`);
      const table = (brute as unknown[]).map((b) => versDomaine(chemin, b));
      // Le domaine juge. Une table fausse doit casser au chargement,
      // pas au premier joueur qui passe.
      try {
        verifieTable(table);
      } catch (e) {
        throw new DonneesIllisibles(chemin, `${condition} : ${(e as Error).message}`);
      }
      const cle = reduire(condition);
      exige(!tables.has(cle), chemin, `deux conditions se réduisent à « ${cle} »`);
      tables.set(cle, table);
      conditions.push(condition);
    }
    exige(tables.size > 0, chemin, "aucune condition");
    return { tables, conditions };
  }

  // ── le port ────────────────────────────────────────────────────────

  async conditionsDe(forumId: number): Promise<readonly string[]> {
    const zone = await this.laZone(forumId);
    if (typeof zone.faune !== "string" || zone.faune.length === 0) return [];
    return (await this.laFaune(zone)).conditions;
  }

  async tableDe(forumId: number, condition: string): Promise<readonly EntreeDeTable[]> {
    const zone = await this.laZone(forumId);
    const faune = await this.laFaune(zone);
    const table = faune.tables.get(reduire(condition));
    if (table === undefined) {
      throw new ConditionInconnue(condition, zone.nom, faune.conditions);
    }
    return table;
  }
}

/** La lecture côté serveur. Appelée depuis la racine de composition. */
export function lecteurDeno(): LecteurDeTexte {
  return (chemin) => Deno.readTextFile(chemin);
}

/** La lecture côté navigateur. La racine jsDelivr est donnée au
 *  constructeur de FauneEnFichiers, donc ce qui arrive ici est déjà une
 *  URL complète. Elle doit contenir un tag ou un SHA : jamais @main,
 *  qui est mis en cache sept jours. */
export function lecteurHttp(recuperer: typeof fetch = fetch): LecteurDeTexte {
  return async (url) => {
    const reponse = await recuperer(url);
    if (!reponse.ok) throw new DonneesIllisibles(url, `HTTP ${reponse.status}`);
    return await reponse.text();
  };
}
