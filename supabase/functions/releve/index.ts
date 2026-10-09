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
import {
  BilansEnAttenteSupabase,
  ClotureSupabase,
} from "../../../src/adaptateurs/supabase/cloture.ts";
import {
  CatalogueSupabase,
  EtatDuJeuSupabase,
  HeuresSupabase,
} from "../../../src/adaptateurs/supabase/jeu.ts";
import {
  JournalSupabase,
  PokedexSupabase,
  SuiviSupabase,
  VerrouSupabase,
} from "../../../src/adaptateurs/supabase/releve.ts";
import { ForumactifEnLecture } from "../../../src/adaptateurs/forumactif/lecture.ts";
import {
  ForumactifEnPublication,
  transportFetch,
} from "../../../src/adaptateurs/forumactif/publication.ts";
import { FauneEnFichiers, lecteurHttp } from "../../../src/adaptateurs/faune/fichiers.ts";
import { FossilesEnFichiers } from "../../../src/adaptateurs/faune/fossiles.ts";
import { ComptoirsEnFichiers } from "../../../src/adaptateurs/faune/comptoirs.ts";
import { BoutiqueSupabase } from "../../../src/adaptateurs/supabase/boutique.ts";
import { FossilesSupabase } from "../../../src/adaptateurs/supabase/fossile.ts";
import { SignataireHmac } from "../../../src/adaptateurs/systeme/horloge-et-signature.ts";
import { CloturerUnSujet } from "../../../src/application/cloturer-un-sujet.ts";
import { LireLesNouveauxMessages } from "../../../src/application/lire-les-nouveaux-messages.ts";
import { ParcourirLesZones } from "../../../src/application/parcourir-les-zones.ts";
import { PosterLesBilans } from "../../../src/application/poster-les-bilans.ts";
import { ServirUneCommande } from "../../../src/application/servir-une-commande.ts";
import { RangerLePokedex } from "../../../src/application/ranger-le-pokedex.ts";
import { RendreLesFossiles } from "../../../src/application/rendre-les-fossiles.ts";

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
const VERSION = "2026-10-09-a";

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
  /** La reprise des bilans appliqués mais pas encore publiés. Tâche
   *  séparée, et c'est le fond de la correction du 2 octobre : la clôture
   *  est le seul point de non-retour, la publication se repasse. */
  readonly bilans: PosterLesBilans;
  /** Tâche 3 : la boutique. Les paniers posés dans les sujets de comptoir
   *  deviennent des commandes servies, et chacune reçoit son reçu. */
  readonly boutique: ServirUneCommande;
  readonly comptoirs: ComptoirsEnFichiers;
  /** Tâche 5 : le laboratoire. Les analyses de fossiles sont tranchées
   *  et annoncées. **Aucun réglage** : chaque analyse porte son sujet,
   *  donc la réponse part là où la demande a été faite. */
  readonly fossilesARendre: RendreLesFossiles;
  /** Tâche 7 : le pokédex, remis d'accord avec le registre. **Zéro est
   *  la réponse attendue** — `appliquer_cloture` l'écrit déjà. */
  readonly pokedex: RangerLePokedex;
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

  //  Les adaptateurs partagés une seule fois : ils n'ont pas d'état, mais
  //  en construire trois copies ferait croire le contraire au prochain
  //  lecteur.
  const faune = new FauneEnFichiers(lecteurHttp(), reglages.WM_RACINE_DONNEES);
  //  MÊME RACINE QUE LA FAUNE : les deux fichiers sont servis au même
  //  endroit, et une racine de plus serait une occasion de les
  //  désaccorder.
  const fossiles = new FossilesEnFichiers(lecteurHttp(), reglages.WM_RACINE_DONNEES);
  const jeu = new EtatDuJeuSupabase(appeler);
  const registre = new RegistreSupabase(appeler);
  const signataire = new SignataireHmac(reglages.WM_SECRET_SIGNATURE);

  //  Tâche 1 : les blocs d'action deviennent des lignes de registre. Elle
  //  s'exécute SUR UN SUJET ; c'est `ParcourirLesZones` qui l'appelle, au
  //  bon moment — avant la clôture, voir son en-tête.
  const lecture = new LireLesNouveauxMessages(
    faune,
    forumEnLecture,
    jeu,
    new HeuresSupabase(appeler),
    registre,
    { maintenant: () => new Date() },
    signataire,
    fossiles,
  );

  const parcourir = new ParcourirLesZones(
    faune,
    forumEnLecture,
    forumEnLecture,
    new SuiviSupabase(appeler),
    jeu,
    new CloturerUnSujet(
      registre,
      jeu,
      new ClotureSupabase(appeler),
      forumEnEcriture,
      new CatalogueSupabase(appeler),
      signataire,
    ),
    lecture,
    new JournalSupabase(appeler),
  );

  const bilans = new PosterLesBilans(
    new BilansEnAttenteSupabase(appeler),
    forumEnEcriture,
    new JournalSupabase(appeler),
  );

  //  Tâche 3 : la boutique. Elle tient SON curseur, celui du forum qui
  //  porte le comptoir — `ParcourirLesZones` tient ceux des zones, et
  //  deux tâches qui avancent le même curseur se voleraient des
  //  messages. C'est pour ça que `data/comptoirs.json` refuse deux
  //  comptoirs dans un même forum.
  const boutique = new ServirUneCommande(
    forumEnLecture,
    new BoutiqueSupabase(appeler),
    forumEnEcriture,
    new SuiviSupabase(appeler),
    new JournalSupabase(appeler),
    signataire,
  );

  return {
    parcourir,
    bilans,
    boutique,
    pokedex: new RangerLePokedex(
      new PokedexSupabase(appeler),
      new JournalSupabase(appeler),
    ),
    comptoirs: new ComptoirsEnFichiers(lecteurHttp(), reglages.WM_RACINE_DONNEES),
    //  Tâche 5 : le laboratoire. Même forme que `PosterLesBilans` — une
    //  file en base, et un message par ligne — et pour la même raison :
    //  rendre un fossile est le point de non-retour, l'annoncer se
    //  repasse.
    fossilesARendre: new RendreLesFossiles(
      new FossilesSupabase(appeler),
      forumEnEcriture,
      new JournalSupabase(appeler),
    ),
    verrou: new VerrouSupabase(appeler),
  };
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

  const { parcourir, bilans, boutique, comptoirs, fossilesARendre, pokedex, verrou } =
    assembler(reglages);

  if (!await verrou.prendre(NOM_DU_VERROU, VERROU_SECONDES)) {
    // Ce n'est pas une erreur : c'est le passage précédent qui travaille
    // encore. 409 pour que ça se voie dans les journaux sans alerter.
    return json({ version: VERSION, ignore: "un passage est déjà en cours" }, 409);
  }

  const debut = Date.now();
  try {
    // L'ORDRE COMPTE, et il a changé le 2 octobre au soir.
    //
    // On parcourt d'abord, on publie ensuite. `CloturerUnSujet` ne poste
    // plus rien : il applique la clôture et laisse le bilan dans la file.
    // `PosterLesBilans` est donc le SEUL publicateur — un seul endroit qui
    // écrit dans le sujet, un seul endroit qui marque le bilan comme posté.
    //
    // Publier en second plutôt qu'en premier n'ajoute aucune attente : un
    // sujet clôturé à l'instant voit son bilan partir dans le même passage,
    // quelques secondes plus tard. L'inverse l'aurait fait attendre cinq
    // minutes.
    const bilan = await parcourir.executer();
    const repris = await bilans.executer();

    //  ── LA BOUTIQUE PASSE EN DERNIER, ET C'EST UN CHOIX ──────────────
    //
    //  Elle est indépendante du reste : aucune zone, aucun registre,
    //  aucune clôture. Elle pourrait donc passer n'importe quand. En
    //  dernier, parce que c'est la seule tâche qui débite de l'argent, et
    //  qu'un passage qui meurt avant elle n'aura rien débité — alors
    //  qu'un passage qui meurt après aura au moins rendu les clôtures.
    //
    //  Un comptoir en panne n'empêche pas les autres : la boucle isole
    //  chacun, comme `ParcourirLesZones` isole chaque zone.
    const achats: { servies: number; refusees: number; erreurs: string[] } = {
      servies: 0,
      refusees: 0,
      erreurs: [],
    };
    try {
      for (const comptoir of await comptoirs.comptoirs()) {
        try {
          const passage = await boutique.executer(comptoir);
          achats.servies += passage.servies.length;
          achats.refusees += passage.refusees.length;
          achats.erreurs.push(...passage.erreurs);
        } catch (e) {
          achats.erreurs.push(`comptoir t${comptoir.sujetId} : ${(e as Error).message}`);
        }
      }
    } catch (e) {
      //  La LISTE des comptoirs est illisible : on ne sait pas où lire,
      //  donc on ne lit nulle part. Le reste du passage a déjà réussi et
      //  doit être rendu quand même.
      achats.erreurs.push(`data/comptoirs.json : ${(e as Error).message}`);
    }

    //  ── LE LABORATOIRE AVANT LE POKÉDEX, ET C'EST UN CHOIX ───────────
    //
    //  Une réanimation écrit un pokémon ET une ligne de pokédex. La
    //  passer après le rangement ferait vérifier par le pokédex le
    //  travail du passage PRÉCÉDENT — c'est exactement ce que l'en-tête
    //  du rangement reproche à l'ordre inverse.
    //
    //  Elle ne lève jamais : chaque analyse est isolée, et une analyse
    //  bloquée faute de donnée n'arrête pas les autres.
    const labo = await fossilesARendre.executer();

    //  ── LE POKÉDEX EN DERNIER, APRÈS LES CLÔTURES ────────────────────
    //
    //  Il réconcilie ce que les clôtures viennent d'écrire : le passer
    //  avant reviendrait à vérifier le travail du passage PRÉCÉDENT.
    //  Il n'écrit rien sur le forum et ne lève jamais.
    const rangement = await pokedex.executer();

    return json({
      version: VERSION,
      //  Ce que la tâche 1 a inscrit au registre pendant le même parcours.
      //  Rendu à part des clôtures : zéro clôture et douze inscriptions est
      //  un passage normal et actif, pas un passage vide.
      inscrites: bilan.inscrites,
      traitees: bilan.traitees,
      issues: bilan.issues,
      erreurs: bilan.erreurs,
      bilans_publies: repris.publies.length,
      bilans_en_echec: repris.erreurs,
      commandes_servies: achats.servies,
      commandes_refusees: achats.refusees,
      boutique_en_echec: achats.erreurs,
      fossiles_rendus: labo.rendus.length,
      fossiles_refuses: labo.refuses.length,
      //  Attendu à ZÉRO. Un nombre non nul veut dire qu'il manque une
      //  ligne dans `fossile_espece` : le joueur n'a rien perdu, n'est
      //  pas prévenu, et sa demande repartira toute seule le jour où la
      //  ligne existera. Les identifiants sont dans `fossiles_en_echec`.
      fossiles_bloques: labo.bloquees.length,
      fossiles_en_echec: labo.erreurs,
      //  Attendu à ZÉRO. Un nombre non nul veut dire qu'une ligne du
      //  pokédex était en retard sur le registre — à regarder, pas à
      //  ignorer.
      pokedex_corrige: rangement.corrigees,
      pokedex_en_echec: rangement.erreurs,
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
