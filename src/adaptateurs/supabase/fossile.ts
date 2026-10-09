// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/fossile.ts
//
//  La file des analyses de fossiles, et le verdict de `rendre_fossile`
//  (migrations `0016` puis `0017`).
//
//  ── TOUT LE TRAVAIL DE CE FICHIER EST DE SE MÉFIER ──────────────────
//
//  Même raison qu'ailleurs, avec une conséquence plus lourde : un
//  verdict mal relu ferait annoncer « Amonistar, niveau 15 » à un joueur
//  dont le fossile vient d'être consommé pour autre chose, ou écrirait
//  « undefined » dans un message qui ne peut plus être retiré. Chaque
//  champ est donc vérifié, et on lève un `AppelEchoue` nommé plutôt que
//  de laisser passer.
//
//  ── `deja` ABSENT VAUT FAUX ─────────────────────────────────────────
//
//  Comme pour la boutique, et le défaut va dans le même sens : le croire
//  vrai à tort ferait disparaître une réanimation des comptes du
//  journal, le croire faux à tort n'en gonfle qu'un chiffre.
//
//  ── UNE ANALYSE SANS `sujetId` N'ARRIVE PAS JUSQU'ICI ───────────────
//
//  `analyses_a_annoncer` les écarte en SQL : il n'y a nulle part où
//  poster leur réponse, et la rendre ferait échouer la tâche à chaque
//  passage sans espoir. On vérifie quand même le champ, parce qu'une
//  colonne qui devient nulle est exactement le genre de changement qu'on
//  découvre par un message vide.
// ════════════════════════════════════════════════════════════════════

import type { AnalyseAAnnoncer, Fossiles, VerdictDeFossile } from "../../application/ports.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";

const FILE = "analyses_a_annoncer";
const RENDRE = "rendre_fossile";

function objet(valeur: unknown, nom: string, quoi: string): Record<string, unknown> {
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) {
    throw new AppelEchoue(nom, `${quoi} : objet attendu, reçu ${JSON.stringify(valeur)}`);
  }
  return valeur as Record<string, unknown>;
}

function entier(valeur: unknown, nom: string, quoi: string): number {
  if (typeof valeur !== "number" || !Number.isInteger(valeur)) {
    throw new AppelEchoue(nom, `${quoi} : entier attendu, reçu ${JSON.stringify(valeur)}`);
  }
  return valeur;
}

function texte(valeur: unknown, nom: string, quoi: string): string {
  if (typeof valeur !== "string" || valeur === "") {
    throw new AppelEchoue(nom, `${quoi} : texte attendu, reçu ${JSON.stringify(valeur)}`);
  }
  return valeur;
}

/** Le verdict, relu champ par champ. Exportée pour être testée sans
 *  base : c'est la seule partie de ce fichier qui contient une
 *  décision. */
export function verdictDepuis(recu: unknown): VerdictDeFossile {
  const o = objet(recu, RENDRE, "verdict");
  const etat = o.etat;
  const analyseId = texte(o.analyseId, RENDRE, "analyseId");
  const deja = o.deja === true;

  if (etat === "rendue") {
    return {
      etat,
      analyseId,
      especeId: entier(o.especeId, RENDRE, "especeId"),
      //  LE NOM DE L'ESPÈCE VA DANS LE MESSAGE. Sans lui, le joueur lit
      //  « → , niveau 15 » et vient demander ce qu'il a obtenu.
      espece: texte(o.espece, RENDRE, "espece"),
      deja,
    };
  }
  if (etat === "refusee") {
    return {
      etat,
      analyseId,
      motif: texte(o.motif, RENDRE, "motif"),
      detail: texte(o.detail, RENDRE, "detail"),
      deja,
    };
  }
  if (etat === "impossible") {
    return {
      etat,
      analyseId,
      motif: texte(o.motif, RENDRE, "motif"),
      detail: texte(o.detail, RENDRE, "detail"),
    };
  }
  //  `en_attente` en fait partie : la fonction ne doit JAMAIS rendre une
  //  analyse qu'elle laisse sans verdict. Si ça arrive, c'est une
  //  version d'avant `0013` qui est revenue, et celle-là annulait ses
  //  refus.
  throw new AppelEchoue(RENDRE, `état inattendu : ${JSON.stringify(etat)}`);
}

/** Une ligne de la file, relue. Exportée pour la même raison. */
export function analyseDepuis(brut: unknown): AnalyseAAnnoncer {
  const o = objet(brut, FILE, "analyse");
  return {
    analyseId: texte(o.analyseId, FILE, "analyseId"),
    sujetId: entier(o.sujetId, FILE, "sujetId"),
    messageId: entier(o.messageId, FILE, "messageId"),
    pseudo: texte(o.pseudo, FILE, "pseudo"),
    fossile: texte(o.fossile, FILE, "fossile"),
    //  LE CODE EST OBLIGATOIRE : c'est lui qui pose le marqueur, donc
    //  lui qui permet de reconnaître un message déjà posté. Une analyse
    //  sans code ferait publier un doublon à chaque coupure.
    code: texte(o.code, FILE, "code"),
    essais: typeof o.essais === "number" ? o.essais : 0,
  };
}

export class FossilesSupabase implements Fossiles {
  constructor(private readonly appeler: AppelSql) {}

  async aAnnoncer(limite: number): Promise<readonly AnalyseAAnnoncer[]> {
    const recu = await this.appeler(FILE, { combien: limite });
    if (!Array.isArray(recu)) {
      throw new AppelEchoue(FILE, `tableau attendu, reçu ${JSON.stringify(recu)}`);
    }
    return recu.map(analyseDepuis);
  }

  async rendre(analyseId: string): Promise<VerdictDeFossile> {
    return verdictDepuis(await this.appeler(RENDRE, { analyseId }));
  }

  async annoncee(analyseId: string, messageId: number): Promise<void> {
    await this.appeler("analyse_annoncee", { analyseId, messageId });
  }

  async echouee(analyseId: string, erreur: string): Promise<number> {
    const recu = await this.appeler("analyse_annonce_echouee", { analyseId, erreur });
    return typeof recu === "number" ? recu : 0;
  }
}
