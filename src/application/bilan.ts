// ════════════════════════════════════════════════════════════════════
//  src/application/bilan.ts
//  Le texte du bilan de clôture, tel qu'il est posté dans le sujet.
//
//  C'est le SEUL message que la relève publie pour une clôture, et il doit
//  rester lisible dans dix ans, sans JavaScript, sans CSS, sans Supabase
//  (planche 38, et §5 de la planche 45). Donc : du texte, des lignes
//  nommées, aucune mise en forme qui porterait du sens.
//
//  Fonction PURE. Les noms d'objets et d'espèces lui sont donnés déjà
//  résolus — c'est le cas d'usage qui interroge le catalogue. Ainsi le
//  texte se teste caractère par caractère, sans base ni réseau.
// ════════════════════════════════════════════════════════════════════

/** Un Pokémon nommé dans un bilan : de quoi l'écrire ET le dessiner.
 *
 *  `especeId` EST LÀ POUR LE SPRITE, et pour rien d'autre : le texte
 *  n'en a pas besoin. Il vaut `null` quand l'espèce est hors Pokédex
 *  — l'espèce de test — et la fiche n'affiche alors pas d'image. */
import { echapper, joindre } from "./fiche-de-combat.ts";
import { adresseDuSpriteFige } from "./sprite.ts";

export type PokemonDuBilan = {
  readonly nom: string;
  readonly especeId: number | null;
};

export type LigneDeBilan = {
  readonly pseudo: string;
  readonly captures: readonly (PokemonDuBilan & { readonly niveau: number })[];
  /** LE NOM, PAS L'IDENTIFIANT — et c'était une faute, trouvée le
   *  18 novembre. `Effets.xpParPokemon` est indexée par `pokemonId`, et
   *  cette ligne la recopiait telle quelle sous un champ `pokemon` : le
   *  bilan écrivait « EXPÉRIENCE : 3f2a7c1e-… +48 ».
   *
   *  Le décor du test écrivait un nom là où l'appelant passe un
   *  identifiant, donc aucun test ne pouvait le dire. Le champ s'appelle
   *  `nom` depuis, parce qu'un champ nommé `pokemon` accepte les deux
   *  sans broncher. */
  readonly experience: readonly (PokemonDuBilan & { readonly gain: number })[];
  readonly ajoutes: readonly { readonly objet: string; readonly quantite: number }[];
  readonly consommes: readonly { readonly objet: string; readonly quantite: number }[];
  readonly croisees: readonly PokemonDuBilan[];
  readonly pokedollarsAvant: number;
  readonly pokedollarsApres: number;
};

/** Les milliers séparés par une espace insécable fine, comme dans la
 *  maquette : « 1 240 → 1 590 ». */
export function pokedollars(n: number): string {
  const signe = n < 0 ? "-" : "";
  const chiffres = Math.abs(n).toString();
  const groupes: string[] = [];
  for (let i = chiffres.length; i > 0; i -= 3) {
    groupes.unshift(chiffres.slice(Math.max(0, i - 3), i));
  }
  return signe + groupes.join(" ");
}

function quantifie(quantite: number, nom: string): string {
  return quantite === 1 ? `1 ${nom}` : `${quantite} ${nom}`;
}

function enumerer(morceaux: readonly string[]): string {
  return morceaux.join(" · ");
}

/** Ce qu'on écrit pour un joueur qui n'a rien gagné. Partagé pour que
 *  le module affiche la même phrase que le message posté. */
export const RIEN_A_VERSER = "Rien à verser pour ce sujet.";

/** Une rubrique du bilan : son étiquette, et ce qu'elle dit. */
export type Rubrique = {
  readonly etiquette: string;
  readonly valeur: string;
};

/** Les rubriques d'un joueur. Une rubrique absente n'est pas écrite : un
 *  bilan ne doit pas être une liste de « aucun » qu'il faut lire en
 *  entier pour trouver les deux lignes qui comptent.
 *
 *  ── POURQUOI C'EST EXPORTÉ, ET EN MORCEAUX ───────────────────────────
 *
 *  Le bilan existe à deux endroits : **posté** dans le sujet à la
 *  clôture, et **affiché** au-dessus du premier message pendant tout le
 *  RP (planche 38, `45-…` §5). Les deux doivent dire exactement la même
 *  chose — c'est la raison d'être de tout le partage de code entre le
 *  serveur et le navigateur.
 *
 *  S'ils sortaient de deux fonctions, ils divergeraient : pas le jour
 *  où on les écrit, le jour où on en corrige une seule. Le texte posté
 *  est donc `etiquette : valeur` recollé, et le module affiche les
 *  mêmes paires dans sa grille. Une rubrique ajoutée ici apparaît des
 *  deux côtés, sans qu'on y pense. */
/** Les cinq rubriques qui ne dépendent d'aucun solde. */
function rubriquesCommunes(
  l: Omit<LigneDeBilan, "pokedollarsAvant" | "pokedollarsApres">,
): Rubrique[] {
  const sortie: Rubrique[] = [];
  const pose = (etiquette: string, valeur: string) => sortie.push({ etiquette, valeur });

  if (l.captures.length > 0) {
    pose("CAPTURÉ", enumerer(l.captures.map((c) => `${c.nom} niv. ${c.niveau}`)));
  }
  if (l.croisees.length > 0) {
    pose("CROISÉ", enumerer(l.croisees.map((c) => c.nom)));
  }
  if (l.experience.length > 0) {
    pose("EXPÉRIENCE", enumerer(l.experience.map((x) => `${x.nom} +${x.gain}`)));
  }
  if (l.ajoutes.length > 0) {
    pose("AJOUTÉ AU SAC", enumerer(l.ajoutes.map((o) => quantifie(o.quantite, o.objet))));
  }
  if (l.consommes.length > 0) {
    pose("CONSOMMÉ", enumerer(l.consommes.map((o) => quantifie(o.quantite, o.objet))));
  }
  return sortie;
}

/** Les Pokémon qu'un bilan montre, dans l'ordre où ils comptent.
 *
 *  « Les captures, ceux qui ont gagné de l'expérience, les espèces
 *  croisées » — les trois, demandés le 18 novembre, et dans cet ordre :
 *  ce qu'on emporte, puis ce qui a grandi, puis ce qu'on a vu passer.
 *
 *  ── LA MÊME DISCIPLINE QUE `rubriques` ───────────────────────────
 *
 *  Le bilan vit à DEUX endroits — posté dans le sujet à la clôture, et
 *  affiché au-dessus du premier message pendant tout le RP. Les deux
 *  doivent montrer les mêmes Pokémon, et ils divergeraient s'ils
 *  tiraient chacun sa liste. Une fonction, deux rendus : des `<img>`
 *  dans le message, des nœuds dans le module.
 *
 *  ── UN DOUBLON N'EST PAS UNE ERREUR, MAIS IL NE SE DESSINE PAS ───
 *
 *  Un Pokémon croisé puis capturé est les deux à la fois, et le texte
 *  le dit deux fois — c'est juste, ce sont deux rubriques. Deux fois
 *  le même sprite côte à côte, non : on garde la PREMIÈRE mention,
 *  donc la plus forte.
 *
 *  Une espèce hors Pokédex n'a pas de sprite, donc pas de ligne : la
 *  rubrique en texte la nomme quand même. */
export type SpriteDuBilan = {
  readonly especeId: number;
  readonly nom: string;
  readonly legende: string;
};

export function spritesDuBilan(
  l: Omit<LigneDeBilan, "pokedollarsAvant" | "pokedollarsApres">,
): readonly SpriteDuBilan[] {
  const sortie: SpriteDuBilan[] = [];
  const vus = new Set<number>();
  const pose = (p: PokemonDuBilan, legende: string) => {
    if (p.especeId === null || vus.has(p.especeId)) return;
    vus.add(p.especeId);
    sortie.push({ especeId: p.especeId, nom: p.nom, legende });
  };

  for (const c of l.captures) pose(c, `niv. ${c.niveau}`);
  for (const x of l.experience) pose(x, `+${x.gain} XP`);
  for (const c of l.croisees) pose(c, "croisé");
  return sortie;
}

/** La vignette d'un Pokémon du bilan : le sprite, son nom, sa légende.
 *
 *  PLUS PETITE QUE LA FICHE DE COMBAT, et c'est volontaire : un bilan
 *  à quatre joueurs peut en aligner vingt, là où un combat en montre
 *  deux. La fiche de combat sert à comparer ; celle-ci sert à
 *  reconnaître. */
function vignette(s: SpriteDuBilan, racine: string): string {
  const adresse = adresseDuSpriteFige(racine, s.especeId);
  return joindre([
    '<span class="wm-bilanp__prise">',
    adresse === null
      ? ""
      : `<img class="wm-bilanp__sprite" src="${echapper(adresse)}" alt="" loading="lazy">`,
    `<span class="wm-bilanp__nom">${echapper(s.nom)}</span>`,
    `<span class="wm-bilanp__legende">${echapper(s.legende)}</span>`,
    "</span>",
  ]);
}

export function rubriques(l: LigneDeBilan): readonly Rubrique[] {
  const sortie = rubriquesCommunes(l);
  if (l.pokedollarsApres !== l.pokedollarsAvant) {
    sortie.push({
      etiquette: "POKÉDOLLARS",
      valeur: `${pokedollars(l.pokedollarsAvant)} → ${pokedollars(l.pokedollarsApres)}`,
    });
  }
  return sortie;
}

/** Ce qu'un joueur a fait dans un sujet encore ouvert. */
export type LigneEnAttente =
  & Omit<LigneDeBilan, "pokedollarsAvant" | "pokedollarsApres">
  & { readonly pokedollars: number };

/** Les mêmes rubriques, pour le module affiché pendant le RP.
 *
 *  UNE SEULE DIFFÉRENCE, ET ELLE EST DE FOND : le bilan posté écrit un
 *  solde — « 1 240 → 1 590 » — parce qu'à la clôture le serveur connaît
 *  la bourse. Le module, lui, n'a pas à la connaître et ne doit surtout
 *  pas en afficher une : **rien n'est acquis avant la clôture**
 *  (`45-…` règle 1). Il écrit donc un écart en attente, « +350 ».
 *
 *  Les cinq autres rubriques sont les mêmes lignes de code que celles
 *  du message posté. C'est voulu : les deux doivent dire la même chose,
 *  et une rubrique ajoutée apparaît des deux côtés sans qu'on y pense. */
export function rubriquesEnAttente(l: LigneEnAttente): readonly Rubrique[] {
  const sortie = rubriquesCommunes(l);
  if (l.pokedollars !== 0) {
    const signe = l.pokedollars > 0 ? "+" : "−";
    sortie.push({
      etiquette: "POKÉDOLLARS",
      valeur: `${signe}${pokedollars(Math.abs(l.pokedollars))}`,
    });
  }
  return sortie;
}

/**
 * Le bilan complet d'une clôture.
 *
 * Le code de vérification est écrit en toutes lettres, parce qu'un joueur
 * qui conteste doit pouvoir le recopier. Le marqueur technique, lui, est
 * ajouté par l'adaptateur Forumactif : ce fichier ne connaît pas le forum.
 */
export function redigerLeBilan(
  lignes: readonly LigneDeBilan[],
  racine: string,
): string {
  const dedans: string[] = [
    '<p class="wm-bilanp__titre">Sujet clôturé. Tout est versé, d\'un seul coup.</p>',
  ];

  for (const l of lignes) {
    //  LE PSEUDO EN CAPITALES DANS LE TEXTE, pas en CSS : sans
    //  feuille de style, c'est ce qui distingue encore un nom de
    //  joueur d'une ligne de rubrique.
    dedans.push(`<p class="wm-bilanp__pseudo">${echapper(l.pseudo.toUpperCase())}</p>`);

    //  LES SPRITES D'ABORD : c'est ce qu'on regarde avant de lire.
    const sprites = spritesDuBilan(l);
    if (sprites.length > 0) {
      dedans.push(
        '<div class="wm-bilanp__prises">',
        ...sprites.map((s) => vignette(s, racine)),
        "</div>",
      );
    }

    const r = rubriques(l);
    if (r.length === 0) {
      //  Un joueur présent au registre mais sans aucun effet : on le
      //  dit, plutôt que de laisser une colonne vide qui ressemble à
      //  un bogue.
      dedans.push(`<p class="wm-bilanp__rien">${echapper(RIEN_A_VERSER)}</p>`);
      continue;
    }
    dedans.push(
      '<ul class="wm-bilanp__lignes">',
      //  LE « : » EST DU TEXTE, PAS UN `::after`. Sans feuille de
      //  style, « CAPTURÉ Farfuret niv. 19 » se lit moins bien que
      //  « CAPTURÉ : Farfuret niv. 19 » — et c'est exactement la
      //  forme que le module du navigateur affiche, donc les deux
      //  disent le même mot à la lettre près.
      ...r.map((x) =>
        '<li class="wm-bilanp__ligne">' +
        `<span class="wm-bilanp__etiquette">${echapper(x.etiquette)}</span> : ` +
        `<span class="wm-bilanp__valeur">${echapper(x.valeur)}</span></li>`
      ),
      "</ul>",
    );
  }

  return joindre(['<div class="wm-bilanp">', ...dedans, "</div>"]);
}

/** Le refus, quand il manque quelque chose à quelqu'un.
 *
 *  « On ne grise pas le bouton : on explique » (planche 38). Le joueur
 *  doit savoir quoi racheter, et savoir que rien n'a bougé. */
export type ManqueLisible = {
  readonly pseudo: string;
  readonly manques: readonly string[];
};

export function redigerLeRefus(
  manques: readonly ManqueLisible[],
  code: string,
): string {
  const texte: string[] = ["Rien n'a été versé : il manque quelque chose."];

  for (const m of manques) {
    texte.push("", m.pseudo.toUpperCase());
    for (const quoi of m.manques) texte.push(`— ${quoi}`);
  }

  texte.push(
    "",
    "Le registre du sujet est intact : rien n'est perdu, rien n'a bougé " +
      "dans les sacs ni dans les boîtes. Rachetez ce qui manque, puis " +
      "redemandez la clôture.",
    "",
    `CODE : ${code}`,
  );
  return texte.join("\n");
}
