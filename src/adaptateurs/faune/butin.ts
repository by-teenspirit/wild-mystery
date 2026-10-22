// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/butin.ts
//
//  La table de butin, lue dans `data/butin.json`.
//
//  MÊME DOSSIER, MÊME RAISON QUE `fossiles.ts` ET `comptoirs.ts` : c'est
//  de la configuration de jeu qui vit dans le dépôt, servie par GitHub
//  Pages, et qui change par un `git push` plutôt que par un déploiement.
//  Le fichier est écrit par `outils/butin.py` depuis `data/objets.json`,
//  `data/fossiles.json` et les types mesurés des espèces de chaque zone.
//
//  ── ON REFUSE ICI, ET C'EST LA DIFFÉRENCE AVEC LES FOSSILES ──────────
//
//  `fossiles.ts` rend une table vide quand le fichier est illisible, et
//  c'est juste : une fouille sans fossile est le cas NORMAL, le plus
//  fréquent de tous.
//
//  Ici, non. Une table de butin vide ou cassée ne veut pas dire « pas
//  d'objet cette fois » : elle veut dire que **les cinq parts d'une
//  fouille ne sont plus connues**, donc qu'on ne sait plus ce qu'une
//  fouille doit rendre. Fouiller quand même reviendrait à verser des
//  Pokédollars à la place d'objets sans que personne le sache, et à
//  écrire ça dans le registre, où ça reste. On lève, la relève note la
//  zone en échec, et le curseur ne bouge pas : les messages seront
//  relus quand le fichier sera réparé.
//
//  C'est le même arbitrage que `comptoirs.ts` : on refuse là où le
//  silence coûterait de la donnée fausse, pas là où il coûte une
//  trouvaille en moins.
// ════════════════════════════════════════════════════════════════════

import type { LigneDeButin, TauxDeFouille } from "../../domaine/fouille.ts";
import { verifieLesTaux } from "../../domaine/fouille.ts";
import type { TableDeButin } from "../../application/ports.ts";
import type { LecteurDeTexte } from "./fichiers.ts";

const FICHIER = "data/butin.json";

export class ButinIllisible extends Error {
  constructor(raison: string) {
    super(`${FICHIER} : ${raison}`);
    this.name = "ButinIllisible";
  }
}

type Charge = {
  readonly taux: TauxDeFouille;
  /** forumId → les lignes de la zone */
  readonly parZone: ReadonlyMap<number, readonly LigneDeButin[]>;
};

function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
    ? valeur as Record<string, unknown>
    : null;
}

function nombre(valeur: unknown, quoi: string): number {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
    throw new ButinIllisible(`${quoi} n'est pas un nombre (${JSON.stringify(valeur)})`);
  }
  return valeur;
}

/** Relit le fichier. Exportée pour être testée sans réseau. */
export function tableDepuis(texte: string): Charge {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch (e) {
    throw new ButinIllisible(`JSON invalide (${(e as Error).message})`);
  }
  const racine = objet(brut);
  if (racine === null) throw new ButinIllisible("la racine n'est pas un objet");

  const bruts = objet(racine.fouille);
  if (bruts === null) throw new ButinIllisible("la clé « fouille » n'est pas un objet");
  const taux: TauxDeFouille = {
    bredouille: nombre(bruts.bredouille, "fouille.bredouille"),
    fossileEntier: nombre(bruts.fossileEntier, "fouille.fossileEntier"),
    morceauDeFossile: nombre(bruts.morceauDeFossile, "fouille.morceauDeFossile"),
    objet: nombre(bruts.objet, "fouille.objet"),
  };

  const zones = racine.zones;
  if (!Array.isArray(zones)) throw new ButinIllisible("la clé « zones » n'est pas un tableau");
  if (zones.length === 0) throw new ButinIllisible("aucune zone");

  const parZone = new Map<number, readonly LigneDeButin[]>();
  for (const brute of zones as unknown[]) {
    const z = objet(brute);
    if (z === null) throw new ButinIllisible("une zone n'est pas un objet");
    const forumId = nombre(z.forumId, "zone.forumId");
    if (parZone.has(forumId)) throw new ButinIllisible(`le forum ${forumId} est là deux fois`);
    const objets = z.objets;
    if (!Array.isArray(objets)) {
      throw new ButinIllisible(`le forum ${forumId} n'a pas de tableau « objets »`);
    }
    const lignes: LigneDeButin[] = (objets as unknown[]).map((b) => {
      const o = objet(b);
      if (o === null) {
        throw new ButinIllisible(`forum ${forumId} : une ligne n'est pas un objet`);
      }
      return {
        objetId: nombre(o.objet, `forum ${forumId} : objet`),
        pourcentage: nombre(o.pct, `forum ${forumId} : pct`),
      };
    });
    //  LE DOMAINE JUGE, ICI COMME POUR LES TABLES DE RENCONTRE. Une
    //  table dont la somme ne vaut pas la part « objet » doit casser au
    //  CHARGEMENT, pas au premier joueur qui fouille.
    verifieLesTaux(taux, lignes);
    parZone.set(forumId, lignes);
  }
  return { taux, parZone };
}

/** La table, lue une fois et gardée : le fichier ne change pas en cours
 *  de passage, et le relire à chaque fouille ferait un appel réseau par
 *  message pour la même réponse. */
export class ButinEnFichiers implements TableDeButin {
  #lue: Promise<Charge> | null = null;

  constructor(
    private readonly lire: LecteurDeTexte,
    private readonly racine = "",
  ) {}

  /** La promesse est gardée, pas son résultat : deux fouilles dans le
   *  même passage ne lancent qu'une lecture. */
  #table(): Promise<Charge> {
    if (this.#lue === null) this.#lue = this.#charger();
    return this.#lue;
  }

  async #charger(): Promise<Charge> {
    return tableDepuis(await this.lire(this.racine + FICHIER));
  }

  async taux(): Promise<TauxDeFouille> {
    return (await this.#table()).taux;
  }

  async butinDe(forumId: number): Promise<readonly LigneDeButin[]> {
    const trouve = (await this.#table()).parZone.get(forumId);
    if (trouve === undefined) {
      //  UNE ZONE SANS LIGNE DANS LE FICHIER N'EST PAS UNE ZONE SANS
      //  BUTIN : c'est une zone que `outils/butin.py` n'a pas écrite,
      //  donc un fichier en retard sur `data/zones.json`. Rendre une
      //  liste vide ferait fouiller avec une part « objet » de 25 % et
      //  aucun objet à tirer — le domaine lèverait, mais plus loin et
      //  avec un message qui ne dirait pas ça.
      throw new ButinIllisible(`le forum ${forumId} n'a pas de table de butin`);
    }
    return trouve;
  }
}
