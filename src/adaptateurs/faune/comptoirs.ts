// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/comptoirs.ts
//
//  Les comptoirs de boutique, lus dans `data/comptoirs.json`.
//
//  MÊME DOSSIER QUE LA FAUNE, et ce n'est pas un rangement par défaut :
//  c'est le même genre de donnée — de la configuration de jeu qui vit
//  dans le dépôt, servie par jsDelivr, et qui change par un `git push`
//  plutôt que par un déploiement. Le lecteur est le même
//  (`LecteurDeTexte`), donc les deux côtés — relève et navigateur — la
//  lisent avec le même code.
//
//  ── POURQUOI PAS UN SECRET, NI UNE CONSTANTE ────────────────────────
//
//  Un secret (`WM_COMPTOIRS=977:3`) demanderait à Callista d'en poser un
//  de plus, et surtout de le modifier dans une interface web pour ouvrir
//  une boutique d'évent. Une constante dans le code demanderait un
//  déploiement. Un fichier du dépôt se relit, se versionne, et se corrige
//  en poussant.
//
//  C'est aussi la cohérence avec le module côté navigateur, qui se
//  reconnaît à `.wm-boutique` et jamais à `t977` : aucun identifiant de
//  sujet n'est écrit en dur, nulle part.
//
//  ── ON REFUSE PLUTÔT QUE DE DEVINER ────────────────────────────────
//
//  Un comptoir à moitié écrit — un `sujetId` sans `forumId` — ferait lire
//  le bon sujet et avancer le curseur du forum 0. La relève croirait
//  avoir traité, et chaque passage reprendrait tout depuis le début en
//  republiant les reçus. D'où un refus nommé, à la lecture.
// ════════════════════════════════════════════════════════════════════

import type { Comptoir } from "../../application/servir-une-commande.ts";
import { DonneesIllisibles, type LecteurDeTexte } from "./fichiers.ts";

const FICHIER = "data/comptoirs.json";

function entier(valeur: unknown, quoi: string, ou: string): number {
  if (typeof valeur !== "number" || !Number.isInteger(valeur) || valeur <= 0) {
    throw new DonneesIllisibles(
      ou,
      `${quoi} : entier positif attendu, reçu ${JSON.stringify(valeur)}`,
    );
  }
  return valeur;
}

/** Relit la liste. Exportée pour être testée sans réseau : c'est la seule
 *  partie de ce fichier qui contient une décision. */
export function comptoirsDepuis(texte: string, ou = FICHIER): readonly Comptoir[] {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch (e) {
    throw new DonneesIllisibles(ou, `JSON illisible — ${(e as Error).message}`);
  }
  const liste = (brut as { comptoirs?: unknown })?.comptoirs;
  if (!Array.isArray(liste)) {
    throw new DonneesIllisibles(ou, "« comptoirs » doit être un tableau");
  }

  const sortie: Comptoir[] = [];
  const sujets = new Set<number>();
  const forums = new Set<number>();
  for (const [i, c] of liste.entries()) {
    const ligne = `comptoirs[${i}]`;
    if (c === null || typeof c !== "object") {
      throw new DonneesIllisibles(ou, `${ligne} : objet attendu`);
    }
    const o = c as Record<string, unknown>;
    const sujetId = entier(o.sujetId, `${ligne}.sujetId`, ou);
    const forumId = entier(o.forumId, `${ligne}.forumId`, ou);

    //  DEUX COMPTOIRS DANS LE MÊME FORUM PARTAGERAIENT LEUR CURSEUR, et
    //  le second ferait reculer celui du premier à chaque passage : les
    //  reçus du premier seraient republiés sans fin. C'est le genre de
    //  panne qu'on ne comprend qu'après avoir lu ce fichier, donc on
    //  l'interdit ici.
    if (forums.has(forumId)) {
      throw new DonneesIllisibles(
        ou,
        `${ligne} : le forum ${forumId} porte déjà un comptoir — ` +
          "deux comptoirs dans un même forum se voleraient leur curseur",
      );
    }
    if (sujets.has(sujetId)) {
      throw new DonneesIllisibles(ou, `${ligne} : le sujet ${sujetId} est en double`);
    }
    sujets.add(sujetId);
    forums.add(forumId);
    sortie.push({ sujetId, forumId });
  }
  return sortie;
}

/** Les comptoirs, lus une fois et gardés : le fichier ne change pas en
 *  cours de passage, et le relire par comptoir ferait un appel réseau de
 *  plus pour la même réponse. */
export class ComptoirsEnFichiers {
  #lus: readonly Comptoir[] | null = null;

  constructor(
    private readonly lire: LecteurDeTexte,
    private readonly racine = "",
  ) {}

  async comptoirs(): Promise<readonly Comptoir[]> {
    if (this.#lus === null) {
      this.#lus = comptoirsDepuis(await this.lire(this.racine + FICHIER), FICHIER);
    }
    return this.#lus;
  }
}
