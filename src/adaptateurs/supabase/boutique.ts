// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/boutique.ts
//
//  Soumettre un panier à `boutique_servir` (migration 0011), et traduire
//  ce qu'elle rend en un verdict typé.
//
//  ── TOUT LE TRAVAIL DE CE FICHIER EST DE SE MÉFIER ──────────────────
//
//  Un appel PostgREST rend du `unknown`. Le tenter en `VerdictDeCommande`
//  marcherait jusqu'au jour où la fonction SQL change de forme, et ce
//  jour-là le cas d'usage lirait `undefined` et écrirait un reçu vide à
//  un joueur qui vient d'être débité. On vérifie donc chaque champ, et on
//  lève un `AppelEchoue` nommé plutôt que de laisser passer.
//
//  C'est la leçon de `cloture.ts` prise par l'autre bout : là-bas une
//  `Map` sérialisée en `{}` faisait disparaître un bilan en silence. Ici
//  c'est un verdict amputé qui ferait disparaître un reçu.
//
//  ── `lignes` N'EST LU QUE POUR UNE COMMANDE SERVIE ──────────────────
//
//  Sur un refus, `boutique_servir` range les identifiants fautifs dans la
//  même colonne `lignes` de la table — c'est le seul endroit disponible,
//  et ils y sont utiles pour comprendre un refus en relisant la base.
//  Mais ce ne sont PAS des lignes facturées, et le port ne les expose
//  donc pas sur la variante « refusee ». On les laisse ici.
// ════════════════════════════════════════════════════════════════════

import type { LignePanier } from "../../domaine/panier.ts";
import type { Boutique, LigneFacturee, VerdictDeCommande } from "../../application/ports.ts";
import { CompteNonLie } from "../../application/servir-une-commande.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";

const NOM = "boutique_servir";

/** `raise exception 'COMPTE_NON_LIE %'` remonte dans le message d'erreur
 *  de PostgREST comme dans celui de psql. On le reconnaît au mot, pas à
 *  un code SQLSTATE : la fonction n'en pose pas, et en poser un
 *  obligerait à choisir dans la plage réservée aux applications — un
 *  détail de plus à tenir pour un seul cas. */
const COMPTE_NON_LIE = /COMPTE_NON_LIE/;

function objet(valeur: unknown, quoi: string): Record<string, unknown> {
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) {
    throw new AppelEchoue(NOM, `${quoi} : objet attendu, reçu ${JSON.stringify(valeur)}`);
  }
  return valeur as Record<string, unknown>;
}

function entier(valeur: unknown, quoi: string): number {
  if (typeof valeur !== "number" || !Number.isInteger(valeur)) {
    throw new AppelEchoue(NOM, `${quoi} : entier attendu, reçu ${JSON.stringify(valeur)}`);
  }
  return valeur;
}

function texte(valeur: unknown, quoi: string): string {
  if (typeof valeur !== "string" || valeur === "") {
    throw new AppelEchoue(NOM, `${quoi} : texte attendu, reçu ${JSON.stringify(valeur)}`);
  }
  return valeur;
}

function lignesFacturees(valeur: unknown): readonly LigneFacturee[] {
  if (!Array.isArray(valeur) || valeur.length === 0) {
    //  Une commande servie SANS ligne n'existe pas : `boutique_servir`
    //  refuse un panier vide avant d'arriver là. Si on en reçoit une,
    //  c'est que la forme a changé — et un reçu sans ligne ne doit pas
    //  partir.
    throw new AppelEchoue(NOM, `commande servie sans ligne : ${JSON.stringify(valeur)}`);
  }
  return valeur.map((l, i) => {
    const o = objet(l, `lignes[${i}]`);
    const quantite = entier(o.quantite, `lignes[${i}].quantite`);
    const prix = entier(o.prix, `lignes[${i}].prix`);
    const sousTotal = entier(o.sousTotal, `lignes[${i}].sousTotal`);
    //  LE SOUS-TOTAL EST VÉRIFIÉ, pas recopié. C'est la base qui facture,
    //  et c'est elle qui a raison ; mais si son produit ne tombe pas
    //  juste, le reçu mentirait au joueur, et un reçu qui ment est pire
    //  qu'un reçu absent.
    if (quantite * prix !== sousTotal) {
      throw new AppelEchoue(
        NOM,
        `lignes[${i}] : ${quantite} × ${prix} ne fait pas ${sousTotal}`,
      );
    }
    return {
      objetId: entier(o.objetId, `lignes[${i}].objetId`),
      nom: texte(o.nom, `lignes[${i}].nom`),
      quantite,
      prix,
      sousTotal,
    };
  });
}

/** Le verdict, relu champ par champ. Exportée pour être testée sans
 *  base : c'est la seule partie de ce fichier qui contient une décision. */
export function verdictDepuis(recu: unknown): VerdictDeCommande {
  const o = objet(recu, "verdict");
  const etat = o.etat;
  const commandeId = texte(o.commandeId, "commandeId");
  const total = entier(o.total, "total");
  const solde = entier(o.solde, "solde");
  //  `deja` absent vaut faux : c'est le cas courant, et une relève qui le
  //  croirait vrai à tort reposterait un reçu — sans danger grâce au
  //  marqueur. L'inverse serait pire, donc le défaut va dans ce sens.
  const deja = o.deja === true;

  if (etat === "servie") {
    return { etat, commandeId, total, solde, deja, lignes: lignesFacturees(o.lignes) };
  }
  if (etat === "refusee") {
    return {
      etat,
      commandeId,
      total,
      solde,
      deja,
      motif: texte(o.motif, "motif"),
      detail: texte(o.detail, "detail"),
    };
  }
  //  `en_attente` en fait partie : la fonction ne doit JAMAIS rendre une
  //  commande qu'elle laisse en attente. Si ça arrive, c'est l'ancien
  //  `servir_commande` qui est revenu, et il ne débitait personne.
  throw new AppelEchoue(NOM, `état inattendu : ${JSON.stringify(etat)}`);
}

export class BoutiqueSupabase implements Boutique {
  constructor(private readonly appeler: AppelSql) {}

  async servir(demande: {
    readonly messageId: number;
    readonly forumUserId: number;
    readonly lignes: readonly LignePanier[];
    readonly code: string;
  }): Promise<VerdictDeCommande> {
    //  Un panier vide n'a rien à faire sur le réseau : la base le
    //  refuserait, mais elle écrirait une commande refusée pour un
    //  message qui ne demandait rien. Le domaine ne produit pas ce cas
    //  (`panierDe` rend « aucun »), et on le dit ici avec le numéro du
    //  message plutôt qu'en SQL.
    if (demande.lignes.length === 0) {
      throw new AppelEchoue(NOM, `panier vide pour le message ${demande.messageId}`);
    }
    try {
      return verdictDepuis(
        await this.appeler(NOM, {
          messageId: demande.messageId,
          forumUserId: demande.forumUserId,
          code: demande.code,
          lignes: demande.lignes.map((l) => ({
            objetId: l.objetId,
            quantite: l.quantite,
          })),
        }),
      );
    } catch (e) {
      if (e instanceof AppelEchoue && COMPTE_NON_LIE.test(e.message)) {
        throw new CompteNonLie(demande.forumUserId);
      }
      throw e;
    }
  }
}
