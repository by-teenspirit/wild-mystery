// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/services.ts
//
//  Le palier (tâche 6) et le ménage (tâche 8), branchés sur les deux
//  fonctions de la migration `0018`.
//
//  ── POURQUOI CHAQUE CHAMP EST RELU ──────────────────────────────────
//
//  Un appel PostgREST rend du `unknown`. Le tenir pour un verdict typé
//  marche jusqu'au jour où la fonction SQL change de forme — et ce
//  jour-là, personne ne le voit : `undefined.length` vaut une exception,
//  mais `undefined` journalisé vaut une ligne muette, au moment précis
//  où on vient y chercher un chiffre.
//
//  C'est la règle écrite en tête de `supabase/boutique.ts`, où un reçu
//  faux était pire qu'un reçu absent. Ici l'enjeu est plus petit — un
//  compte rendu —, mais le raisonnement ne change pas : **on préfère
//  une erreur nommée à un zéro inventé.**
// ════════════════════════════════════════════════════════════════════

import type {
  ChangementDePalier,
  Menage,
  MenageFait,
  Paliers,
} from "../../application/ports.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";

/** Un prédicat de type, et pas un simple booléen : c'est lui qui permet
 *  de rendre un `ChangementDePalier` typé sans un `as` de confiance à la
 *  fin — le compilateur sait, après l'appel, que la valeur est un
 *  nombre. Une assertion `as number` aurait vérifié puis oublié. */
function entierPositif(valeur: unknown): valeur is number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur >= 0;
}

// ── le palier ───────────────────────────────────────────────────────

/** `paliers_appliquer` (migration `0018`).
 *
 *  La fonction rend `{ nombre, changements }`. **On relit les deux et on
 *  exige qu'ils s'accordent** : si `nombre` dit trois et que la liste en
 *  porte deux, quelque chose s'est perdu entre la base et ici, et une
 *  liste tronquée est exactement ce qu'il ne faut pas journaliser — le
 *  staff mettrait deux rangs à jour sur trois et croirait avoir fini. */
export class PaliersSupabase implements Paliers {
  constructor(private readonly appeler: AppelSql) {}

  async appliquer(): Promise<readonly ChangementDePalier[]> {
    const nom = "paliers_appliquer";
    const recu = await this.appeler(nom, {});
    if (typeof recu !== "object" || recu === null) {
      throw new AppelEchoue(nom, `objet attendu, reçu ${JSON.stringify(recu)}`);
    }
    const { nombre, changements } = recu as Record<string, unknown>;
    if (!Array.isArray(changements)) {
      throw new AppelEchoue(
        nom,
        `changements doit être une liste, reçu ${JSON.stringify(changements)}`,
      );
    }
    if (!entierPositif(nombre) || nombre !== changements.length) {
      throw new AppelEchoue(
        nom,
        `nombre et changements ne s'accordent pas : ${
          JSON.stringify(nombre)
        } contre ${changements.length}`,
      );
    }

    return changements.map((brut, rang) => {
      const c = brut as Record<string, unknown>;
      const { joueurId, pseudo, avant, apres } = c;
      if (typeof joueurId !== "string" || joueurId === "") {
        throw new AppelEchoue(nom, `changement ${rang} : joueurId illisible`);
      }
      //  LE PSEUDO PEUT ÊTRE VIDE DANS LA BASE ? Non : `joueur.pseudo`
      //  est `not null`. Mais une chaîne vide passerait le `not null`,
      //  et « passe au palier 2 » sans nom devant ne sert à rien.
      if (typeof pseudo !== "string" || pseudo === "") {
        throw new AppelEchoue(nom, `changement ${rang} : pseudo illisible`);
      }
      if (!entierPositif(avant) || !entierPositif(apres)) {
        throw new AppelEchoue(
          nom,
          `changement ${rang} : paliers illisibles (${JSON.stringify(avant)} → ${
            JSON.stringify(apres)
          })`,
        );
      }
      //  UN CHANGEMENT QUI NE CHANGE RIEN EST UN DÉFAUT DE LA FONCTION,
      //  pas une ligne à journaliser : son `where` exclut l'égalité.
      if (avant === apres) {
        throw new AppelEchoue(nom, `changement ${rang} : palier inchangé (${avant})`);
      }
      return { joueurId, pseudo, avant, apres };
    });
  }
}

// ── le ménage ───────────────────────────────────────────────────────

/** `menage_oublier_les_abandons` (migration `0018`).
 *
 *  `jours` est relu dans la réponse plutôt que recopié depuis l'appel :
 *  c'est la base qui a le dernier mot sur la fenêtre qu'elle a comprise,
 *  et journaliser la valeur qu'on a DEMANDÉE alors qu'une autre a été
 *  appliquée serait un journal qui ment. */
export class MenageSupabase implements Menage {
  constructor(private readonly appeler: AppelSql) {}

  async oublierLesAbandons(jours?: number): Promise<MenageFait> {
    const nom = "menage_oublier_les_abandons";
    const recu = await this.appeler(nom, jours === undefined ? {} : { jours });
    if (typeof recu !== "object" || recu === null) {
      throw new AppelEchoue(nom, `objet attendu, reçu ${JSON.stringify(recu)}`);
    }
    const c = recu as Record<string, unknown>;
    for (const champ of ["sujets", "lignes", "jours"] as const) {
      if (!entierPositif(c[champ])) {
        throw new AppelEchoue(
          nom,
          `${champ} : entier positif ou nul attendu, reçu ${JSON.stringify(c[champ])}`,
        );
      }
    }
    //  PLUS DE SUJETS QUE DE LIGNES EST IMPOSSIBLE : chaque sujet oublié
    //  a au moins une ligne de registre, c'est ce qui le rend visible.
    //  Le vérifier coûte une comparaison et attrape un échange de champs.
    if ((c.sujets as number) > (c.lignes as number)) {
      throw new AppelEchoue(
        nom,
        `${c.sujets} sujets pour ${c.lignes} lignes : impossible`,
      );
    }
    return {
      sujets: c.sujets as number,
      lignes: c.lignes as number,
      jours: c.jours as number,
    };
  }
}
