// ════════════════════════════════════════════════════════════════════
//  supabase/functions/releve/index.ts
//
//  LA RACINE DE COMPOSITION. C'est le seul fichier du projet où l'on écrit
//  `new …Supabase(…)` et `new Forumactif…(…)`, et le garde-fou refuse qu'on
//  le fasse ailleurs.
//
//  Elle ne contient AUCUNE RÈGLE. Elle lit des secrets, assemble des
//  adaptateurs, prend un verrou, lance une tâche, rend le verrou, et
//  répond. Tout ce qui décide est dans `domaine/` ; tout ce qui orchestre
//  est dans `application/`. Si une condition métier apparaît ici un jour,
//  c'est qu'elle est au mauvais endroit.
//
//  LES SECRETS
//  Ils ne vivent que dans Supabase › Project Settings › Edge Functions ›
//  Secrets. Jamais dans le dépôt, jamais dans un fichier servi par
//  jsDelivr, et jamais écrits dans un journal — ce fichier ne consigne que
//  des noms de variables manquantes, jamais leur contenu.
// ════════════════════════════════════════════════════════════════════

import { appelPostgrest } from "../../../src/adaptateurs/supabase/appel.ts";
import { RegistreSupabase } from "../../../src/adaptateurs/supabase/registre.ts";
import { ClotureSupabase } from "../../../src/adaptateurs/supabase/cloture.ts";
import { CatalogueSupabase, EtatDuJeuSupabase } from "../../../src/adaptateurs/supabase/jeu.ts";
import {
  JournalSupabase,
  SuiviSupabase,
  VerrouSupabase,
} from "../../../src/adaptateurs/supabase/releve.ts";
import { ForumactifEnLecture } from "../../../src/adaptateurs/forumactif/lecture.ts";
import {
  ForumactifEnPublication,
  transportFetch,
} from "../../../src/adaptateurs/forumactif/publication.ts";
import { FauneEnFichiers, lecteurHttp } from "../../../src/adaptateurs/faune/fichiers.ts";
import { SignataireHmac } from "../../../src/adaptateurs/systeme/horloge-et-signature.ts";
import { CloturerUnSujet } from "../../../src/application/cloturer-un-sujet.ts";
import { ParcourirLesZones } from "../../../src/application/parcourir-les-zones.ts";

/**
 * La version de ce déploiement, et elle sert à DEUX choses.
 *
 * 1 · Elle est rendue dans chaque réponse. On sait donc toujours quel code
 *     a répondu, au lieu de le déduire d'un message d'erreur.
 * 2 · Elle force l'outil Supabase à voir un changement. Cette fonction
 *     importe du code situé HORS de son dossier (`src/`), et le CLI ne
 *     semble regarder que `supabase/functions/` pour décider s'il y a
 *     quelque chose à redéployer : il répond « No change found » alors
 *     qu'un fichier importé a changé, et c'est l'ancien code qui reste en
 *     ligne. Toucher à CE fichier à chaque livraison supprime le piège.
 *
 * À incrémenter à chaque envoi. Vu le 2 octobre 2026.
 */
const VERSION = "2026-10-02-g";

// ── les secrets, tous lus au même endroit ───────────────────────────

const ATTENDUS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FORUM_URL",
  "FORUM_COMPTE",
  "FORUM_MOTDEPASSE",
  "WM_SECRET_SIGNATURE",
  "WM_CLE_DE_RELEVE",
  "WM_RACINE_DONNEES",
] as const;

type Reglages = Record<(typeof ATTENDUS)[number], string>;

/** Lit la configuration, et refuse de démarrer s'il manque quelque chose.
 *
 *  Démarrer à moitié configuré serait pire que ne pas démarrer : la relève
 *  tournerait, ne trouverait rien, et noterait « 0 traité » toutes les cinq
 *  minutes sans que personne ne comprenne pourquoi. Le message nomme les
 *  variables manquantes — **jamais leur valeur.** */
function lireLesReglages(): Reglages {
  const manquantes: string[] = [];
  const valeurs: Record<string, string> = {};

  for (const nom of ATTENDUS) {
    const valeur = Deno.env.get(nom) ?? "";
    if (valeur.trim() === "") manquantes.push(nom);
    else valeurs[nom] = valeur;
  }

  if (manquantes.length > 0) {
    throw new Error(
      `Configuration incomplète. À poser dans Supabase › Edge Functions › Secrets : ` +
        manquantes.join(", "),
    );
  }
  return valeurs as Reglages;
}

/** Comparaison à durée constante. Comparer deux clés avec `===` laisse
 *  fuir, par le temps de réponse, la longueur du préfixe commun. */
function memeCle(a: string, b: string): boolean {
  const ao = new TextEncoder().encode(a);
  const bo = new TextEncoder().encode(b);
  if (ao.length !== bo.length) return false;
  let different = 0;
  for (let i = 0; i < ao.length; i++) different |= ao[i] ^ bo[i];
  return different === 0;
}

// ── l'assemblage ────────────────────────────────────────────────────

const NOM_DU_VERROU = "releve";
/** Un peu moins que l'intervalle d'appel (cinq minutes), pour qu'un passage
 *  mort libère son verrou avant le suivant plutôt qu'après. */
const VERROU_SECONDES = 240;

type Montage = {
  readonly parcourir: ParcourirLesZones;
  readonly verrou: VerrouSupabase;
};

function assembler(reglages: Reglages): Montage {
  const appeler = appelPostgrest({
    base: reglages.SUPABASE_URL,
    // La clé de service contourne les politiques RLS. C'est voulu : la
    // relève agit pour tout le monde. Elle ne sort jamais d'ici.
    cle: reglages.SUPABASE_SERVICE_ROLE_KEY,
  });

  const forumEnLecture = new ForumactifEnLecture(async (chemin) => {
    // La lecture se fait en simple visiteur : les zones de jeu sont
    // ouvertes aux invités (décision du 1er octobre), donc aucune session à
    // maintenir pour lire. C'est la pièce la plus fragile du montage en
    // moins.
    const reponse = await fetch(reglages.FORUM_URL + chemin, {
      headers: { "accept-language": "fr" },
    });
    if (!reponse.ok) throw new Error(`${chemin} : HTTP ${reponse.status}`);
    return await reponse.text();
  });

  const forumEnEcriture = new ForumactifEnPublication(
    transportFetch(reglages.FORUM_URL),
    { compte: reglages.FORUM_COMPTE, motDePasse: reglages.FORUM_MOTDEPASSE },
  );

  const parcourir = new ParcourirLesZones(
    new FauneEnFichiers(lecteurHttp(), reglages.WM_RACINE_DONNEES),
    forumEnLecture,
    forumEnLecture,
    new SuiviSupabase(appeler),
    new EtatDuJeuSupabase(appeler),
    new CloturerUnSujet(
      new RegistreSupabase(appeler),
      new EtatDuJeuSupabase(appeler),
      new ClotureSupabase(appeler),
      forumEnEcriture,
      new CatalogueSupabase(appeler),
      new SignataireHmac(reglages.WM_SECRET_SIGNATURE),
    ),
    new JournalSupabase(appeler),
  );

  return { parcourir, verrou: new VerrouSupabase(appeler) };
}

// ── le point d'entrée ───────────────────────────────────────────────

function json(corps: unknown, statut: number): Response {
  return new Response(JSON.stringify(corps, null, 1), {
    status: statut,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (requete: Request): Promise<Response> => {
  let reglages: Reglages;
  try {
    reglages = lireLesReglages();
  } catch (e) {
    return json({ erreur: (e as Error).message }, 500);
  }

  // Sans cette clé, n'importe qui pourrait déclencher la relève en boucle.
  if (!memeCle(requete.headers.get("x-wm-cle") ?? "", reglages.WM_CLE_DE_RELEVE)) {
    return json({ version: VERSION, erreur: "clé de relève absente ou fausse" }, 401);
  }

  const { parcourir, verrou } = assembler(reglages);

  if (!await verrou.prendre(NOM_DU_VERROU, VERROU_SECONDES)) {
    // Ce n'est pas une erreur : c'est le passage précédent qui travaille
    // encore. 409 pour que ça se voie dans les journaux sans alerter.
    return json({ version: VERSION, ignore: "un passage est déjà en cours" }, 409);
  }

  const debut = Date.now();
  try {
    const bilan = await parcourir.executer();
    return json({
      version: VERSION,
      traitees: bilan.traitees,
      issues: bilan.issues,
      erreurs: bilan.erreurs,
      duree_ms: Date.now() - debut,
    }, 200);
  } catch (e) {
    // Une panne ici est anormale : `ParcourirLesZones` isole déjà chaque
    // zone et chaque sujet. Si on arrive là, c'est la relève elle-même qui
    // est cassée, et ça doit se voir.
    return json({
      version: VERSION,
      erreur: (e as Error).message,
      duree_ms: Date.now() - debut,
    }, 500);
  } finally {
    // `finally` et pas après le `try` : un verrou qu'on ne rend pas bloque
    // la relève pendant quatre minutes à chaque panne.
    await verrou.rendre(NOM_DU_VERROU);
  }
});
