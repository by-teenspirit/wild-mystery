// ════════════════════════════════════════════════════════════════════
//  src/contrat/appel-psql.ts
//
//  Un AppelSql par `psql`, pour que la suite de contrat tourne contre un
//  VRAI PostgreSQL sans qu'aucune dépendance entre dans le dépôt.
//
//  Pourquoi pas un pilote Postgres : il faudrait le recopier dans
//  vendoreur/ (§8 du contrat), c'est-à-dire des milliers de lignes qui ne
//  servent qu'aux tests. `psql` est déjà là, dans l'image de CI comme sur
//  un poste de travail, et il exécute le vrai SQL sur la vraie base.
//
//  Pourquoi ce n'est pas un trou de sécurité : l'argument n'est JAMAIS
//  concaténé dans la requête. Il passe par une variable psql, relue avec
//  `:'arg'`, que psql échappe lui-même en littéral SQL. La requête
//  envoyée est toujours la même chaîne, mot pour mot.
//
//  Ce fichier ne sert qu'aux tests. Il n'est importé par aucun code livré,
//  et la racine de composition n'en sait rien.
// ════════════════════════════════════════════════════════════════════

import { AppelEchoue, type AppelSql } from "../adaptateurs/supabase/appel.ts";

export type Branchement = {
  /** L'URL de connexion, telle que psql l'accepte. */
  readonly url: string;
};

/** La requête est figée : seule la variable change. C'est ce qui rend
 *  l'injection impossible. */
function requete(fonction: string): string {
  return `select coalesce(to_jsonb(${fonction}(:'arg'::jsonb)), 'null'::jsonb)`;
}

const NOM_DE_FONCTION = /^[a-z_][a-z0-9_]*$/;

export function appelPsql(branchement: Branchement): AppelSql {
  return async (fonction, argument) => {
    // Le nom n'est pas une donnée : il vient du code de l'adaptateur. On
    // le vérifie quand même, parce qu'il est le seul morceau qui entre
    // dans la requête.
    if (!NOM_DE_FONCTION.test(fonction)) {
      throw new AppelEchoue(fonction, "nom de fonction refusé");
    }

    // La requête passe par l'entrée standard, pas par --command : psql
    // ne substitue PAS ses variables dans une chaîne donnée à -c, il
    // l'envoie telle quelle au serveur. Avec stdin, `:'arg'` est bien
    // relu et échappé par psql.
    const commande = new Deno.Command("psql", {
      args: [
        branchement.url,
        "--no-psqlrc",
        "--quiet",
        "--no-align",
        "--tuples-only",
        "--set=ON_ERROR_STOP=1",
        `--set=arg=${JSON.stringify(argument ?? {})}`,
      ],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const enfant = commande.spawn();
    const plume = enfant.stdin.getWriter();
    await plume.write(new TextEncoder().encode(requete(fonction) + ";\n"));
    await plume.close();

    const { code, stdout, stderr } = await enfant.output();
    const sortie = new TextDecoder().decode(stdout).trim();
    if (code !== 0) {
      throw new AppelEchoue(fonction, new TextDecoder().decode(stderr).trim());
    }
    if (sortie === "" || sortie === "null") return null;
    try {
      return JSON.parse(sortie);
    } catch {
      throw new AppelEchoue(fonction, `sortie illisible : ${sortie.slice(0, 160)}`);
    }
  };
}
