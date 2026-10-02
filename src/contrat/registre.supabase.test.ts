// ════════════════════════════════════════════════════════════════════
//  src/contrat/registre.supabase.test.ts
//
//  LA MÊME suite que registre.en-memoire.test.ts, contre un vrai
//  PostgreSQL. C'est ce fichier qui empêche l'adaptateur en mémoire de
//  mentir : si les deux divergent, le CI casse.
//
//  Il ne tourne que si on le lui demande, par deux variables :
//      CONTRAT_CIBLE=postgres
//      CONTRAT_PGURL=postgres://…
//  Sans elles il s'annonce ignoré, à voix haute. Un test qui se saute en
//  silence est pire que pas de test : on croit avoir une couverture
//  qu'on n'a pas.
// ════════════════════════════════════════════════════════════════════

import { RegistreSupabase } from "../adaptateurs/supabase/registre.ts";
import { appelPsql } from "./appel-psql.ts";
import { type Chantier, contratDuRegistre } from "./registre.contrat.ts";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

/** Les deux joueurs du contrat. `registre.joueur_id` référence
 *  `joueur(id)`, donc ils doivent exister avant la première ligne — la
 *  base impose ce que l'adaptateur en mémoire n'impose pas, et c'est
 *  précisément le genre d'écart que cette suite est là pour trouver. */
const ANNA = "11111111-1111-1111-1111-111111111111";
const BORIS = "22222222-2222-2222-2222-222222222222";

function psql(url: string, sql: string): Promise<void> {
  return new Deno.Command("psql", {
    args: [url, "--no-psqlrc", "--quiet", "--set=ON_ERROR_STOP=1", "--command", sql],
    stdout: "null",
    stderr: "piped",
  }).output().then(({ code, stderr }) => {
    if (code !== 0) throw new Error(new TextDecoder().decode(stderr).trim());
  });
}

if (CIBLE === "postgres" && PGURL !== undefined) {
  const url = PGURL;

  const monter = async (): Promise<Chantier> => {
    // Table rase avant chaque essai : la suite suppose un registre vide.
    await psql(
      url,
      `delete from registre;
       delete from cloture;
       insert into joueur (id, forum_user_id, pseudo) values
         ('${ANNA}', 90901, 'Anna du contrat'),
         ('${BORIS}', 90902, 'Boris du contrat')
       on conflict (id) do nothing;`,
    );
    return {
      registre: new RegistreSupabase(appelPsql({ url })),
      ranger: () => psql(url, "delete from registre; delete from cloture;"),
    };
  };

  contratDuRegistre("Supabase", monter);
} else {
  Deno.test("contrat Supabase · IGNORÉ faute de base", () => {
    console.warn(
      "\n  ⚠ Le contrat Supabase ne tourne pas : il faut CONTRAT_CIBLE=postgres " +
        "et CONTRAT_PGURL=postgres://…\n    Tant qu'il ne tourne pas, rien ne prouve que " +
        "l'adaptateur en mémoire dit la vérité.\n",
    );
  });
}
