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

export class LieuInconnu extends Error {
  constructor(lieu: string, zone: string, connus: readonly string[]) {
    super(`« ${lieu} » n'est pas un lieu de ${zone}. Connus : ${connus.join(", ")}.`);
    this.name = "LieuInconnu";
  }
}

export class ConditionInconnue extends Error {
  constructor(condition: string, lieu: string, connues: readonly string[]) {
    super(`« ${condition} » n'existe pas à ${lieu}. Connues : ${connues.join(", ")}.`);
    this.name = "ConditionInconnue";
  }
}

const RARETES: readonly string[] = ["commun", "peu commun", "rare"];

/** Le nom d'un lieu traverse l'éditeur du forum, un copier-coller et
 *  parfois un clavier sans accents. On compare donc sur une forme
 *  réduite : sans accent, sans casse, sans espaces en trop. */
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
  /** forme réduite du lieu → nom affiché */
  readonly noms: ReadonlyMap<string, string>;
  /** forme réduite du lieu → (forme réduite de la condition → table) */
  readonly tables: ReadonlyMap<string, ReadonlyMap<string, readonly EntreeDeTable[]>>;
  /** forme réduite de la condition → nom affiché, par lieu réduit */
  readonly conditions: ReadonlyMap<string, readonly string[]>;
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
    const lieux = objet(racine.lieux);
    exige(lieux !== null, chemin, "la clé « lieux » n'est pas un objet");

    const noms = new Map<string, string>();
    const tables = new Map<string, Map<string, readonly EntreeDeTable[]>>();
    const conditions = new Map<string, string[]>();

    for (const [lieu, brutParCondition] of Object.entries(lieux)) {
      const parCondition = objet(brutParCondition);
      exige(parCondition !== null, chemin, `le lieu « ${lieu} » n'est pas un objet`);
      const cleLieu = reduire(lieu);
      exige(!noms.has(cleLieu), chemin, `deux lieux se réduisent à « ${cleLieu} »`);
      noms.set(cleLieu, lieu);

      const parCle = new Map<string, readonly EntreeDeTable[]>();
      const nomsConditions: string[] = [];
      for (const [condition, brute] of Object.entries(parCondition)) {
        exige(
          Array.isArray(brute),
          chemin,
          `${lieu} / ${condition} n'est pas un tableau`,
        );
        const table = (brute as unknown[]).map((b) => versDomaine(chemin, b));
        // Le domaine juge. Une table fausse doit casser au chargement,
        // pas au premier joueur qui passe.
        try {
          verifieTable(table);
        } catch (e) {
          throw new DonneesIllisibles(
            chemin,
            `${lieu} / ${condition} : ${(e as Error).message}`,
          );
        }
        parCle.set(reduire(condition), table);
        nomsConditions.push(condition);
      }
      exige(parCle.size > 0, chemin, `le lieu « ${lieu} » n'a aucune condition`);
      tables.set(cleLieu, parCle);
      conditions.set(cleLieu, nomsConditions);
    }
    exige(tables.size > 0, chemin, "aucun lieu");
    return { noms, tables, conditions };
  }

  // ── le port ────────────────────────────────────────────────────────

  async lieuxDe(forumId: number): Promise<readonly string[]> {
    const zone = await this.laZone(forumId);
    if (typeof zone.faune !== "string" || zone.faune.length === 0) return [];
    return [...(await this.laFaune(zone)).noms.values()];
  }

  async conditionsDe(forumId: number, lieu: string): Promise<readonly string[]> {
    const zone = await this.laZone(forumId);
    const faune = await this.laFaune(zone);
    const cle = reduire(lieu);
    const trouvees = faune.conditions.get(cle);
    if (trouvees === undefined) {
      throw new LieuInconnu(lieu, zone.nom, [...faune.noms.values()]);
    }
    return trouvees;
  }

  async tableDe(
    forumId: number,
    lieu: string,
    condition: string,
  ): Promise<readonly EntreeDeTable[]> {
    const zone = await this.laZone(forumId);
    const faune = await this.laFaune(zone);
    const parCondition = faune.tables.get(reduire(lieu));
    if (parCondition === undefined) {
      throw new LieuInconnu(lieu, zone.nom, [...faune.noms.values()]);
    }
    const table = parCondition.get(reduire(condition));
    if (table === undefined) {
      throw new ConditionInconnue(
        condition,
        lieu,
        faune.conditions.get(reduire(lieu)) ?? [],
      );
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
