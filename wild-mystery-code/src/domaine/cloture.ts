// ════════════════════════════════════════════════════════════════════
//  src/domaine/cloture.ts
//  Le rejeu du registre à la clôture d'un sujet.
//
//  COUCHE DOMAINE : aucun import. Cette fonction ne lit ni n'écrit
//  rien — on lui donne le registre et l'état du joueur, elle rend un
//  verdict. C'est la base de données qui appliquera, ou pas.
//
//  La subtilité qui justifie ce fichier : une ball TROUVÉE au message 3
//  peut être UTILISÉE au message 7. L'ordre compte, donc on rejoue.
// ════════════════════════════════════════════════════════════════════

export type Evenement =
  | { readonly type: "croise"; readonly especeId: number }
  | { readonly type: "capture"; readonly especeId: number; readonly niveau: number }
  | { readonly type: "xp"; readonly pokemonId: string; readonly gain: number }
  | { readonly type: "objet_utilise"; readonly objetId: number; readonly quantite: number }
  | { readonly type: "objet_trouve"; readonly objetId: number; readonly quantite: number }
  | { readonly type: "pokedollars"; readonly montant: number };

export type LigneRegistre = {
  readonly messageId: number;
  readonly evenement: Evenement;
};

export type EtatDuJoueur = {
  readonly sac: ReadonlyMap<number, number>;
  readonly placesEnBoite: number;
  readonly pokedollars: number;
};

export type Manque =
  | {
    readonly quoi: "objet";
    readonly objetId: number;
    readonly demande: number;
    readonly disponible: number;
  }
  | { readonly quoi: "place"; readonly demande: number; readonly disponible: number }
  | { readonly quoi: "argent"; readonly demande: number; readonly disponible: number };

export type Effets = {
  readonly especesCroisees: readonly number[];
  readonly captures: readonly { readonly especeId: number; readonly niveau: number }[];
  readonly xpParPokemon: ReadonlyMap<string, number>;
  readonly objetsConsommes: ReadonlyMap<number, number>;
  readonly objetsAjoutes: ReadonlyMap<number, number>;
  readonly pokedollars: number;
};

export type Verdict =
  | { readonly possible: true; readonly effets: Effets }
  | { readonly possible: false; readonly manques: readonly Manque[] };

function ajoute(m: Map<number, number>, cle: number, n: number): void {
  m.set(cle, (m.get(cle) ?? 0) + n);
}

/**
 * Décide si un sujet peut être clôturé, et ce que ça verserait.
 *
 * Rien n'est appliqué ici. Le verdict est soit « possible », avec le
 * détail de ce qu'il faut verser, soit « impossible », avec la liste
 * de ce qui manque — c'est elle que le message de refus recopie.
 *
 * Les lignes sont rejouées dans l'ordre des messages. Deux événements
 * du même message gardent l'ordre où ils ont été écrits.
 */
export function evaluerCloture(
  lignes: readonly LigneRegistre[],
  etat: EtatDuJoueur,
): Verdict {
  const ordre = [...lignes]
    .map((l, i) => ({ l, i }))
    .sort((a, b) => a.l.messageId - b.l.messageId || a.i - b.i)
    .map(({ l }) => l);

  const stock = new Map<number, number>(etat.sac);
  const consommes = new Map<number, number>();
  const ajoutes = new Map<number, number>();
  const xp = new Map<string, number>();
  const croisees: number[] = [];
  const captures: { especeId: number; niveau: number }[] = [];
  const manques: Manque[] = [];
  let pokedollars = 0;

  for (const { evenement: e } of ordre) {
    switch (e.type) {
      case "croise":
        if (!croisees.includes(e.especeId)) croisees.push(e.especeId);
        break;

      case "capture":
        captures.push({ especeId: e.especeId, niveau: e.niveau });
        break;

      case "xp":
        xp.set(e.pokemonId, (xp.get(e.pokemonId) ?? 0) + e.gain);
        break;

      case "objet_trouve":
        ajoute(stock, e.objetId, e.quantite);
        ajoute(ajoutes, e.objetId, e.quantite);
        break;

      case "objet_utilise": {
        const dispo = stock.get(e.objetId) ?? 0;
        if (dispo < e.quantite) {
          manques.push({
            quoi: "objet",
            objetId: e.objetId,
            demande: e.quantite,
            disponible: dispo,
          });
          // on continue le rejeu : on veut TOUT ce qui manque,
          // pas seulement le premier manque rencontré.
          break;
        }
        stock.set(e.objetId, dispo - e.quantite);
        ajoute(consommes, e.objetId, e.quantite);
        break;
      }

      case "pokedollars":
        pokedollars += e.montant;
        break;
    }
  }

  if (captures.length > etat.placesEnBoite) {
    manques.push({
      quoi: "place",
      demande: captures.length,
      disponible: etat.placesEnBoite,
    });
  }

  if (etat.pokedollars + pokedollars < 0) {
    manques.push({
      quoi: "argent",
      demande: -pokedollars,
      disponible: etat.pokedollars,
    });
  }

  if (manques.length > 0) return { possible: false, manques };

  return {
    possible: true,
    effets: {
      especesCroisees: croisees,
      captures,
      xpParPokemon: xp,
      objetsConsommes: consommes,
      objetsAjoutes: ajoutes,
      pokedollars,
    },
  };
}
