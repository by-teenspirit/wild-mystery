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

export type LigneDeBilan = {
  readonly pseudo: string;
  readonly captures: readonly { readonly espece: string; readonly niveau: number }[];
  readonly experience: readonly { readonly pokemon: string; readonly gain: number }[];
  readonly ajoutes: readonly { readonly objet: string; readonly quantite: number }[];
  readonly consommes: readonly { readonly objet: string; readonly quantite: number }[];
  readonly croisees: readonly string[];
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

/** Les lignes d'un joueur. Une rubrique absente n'est pas écrite : un
 *  bilan ne doit pas être une liste de « aucun » qu'il faut lire en
 *  entier pour trouver les deux lignes qui comptent. */
function rubriques(l: LigneDeBilan): string[] {
  const sortie: string[] = [];

  if (l.captures.length > 0) {
    sortie.push(
      "CAPTURÉ : " + enumerer(l.captures.map((c) => `${c.espece} niv. ${c.niveau}`)),
    );
  }
  if (l.croisees.length > 0) {
    sortie.push("CROISÉ : " + enumerer(l.croisees));
  }
  if (l.experience.length > 0) {
    sortie.push(
      "EXPÉRIENCE : " + enumerer(l.experience.map((x) => `${x.pokemon} +${x.gain}`)),
    );
  }
  if (l.ajoutes.length > 0) {
    sortie.push(
      "AJOUTÉ AU SAC : " + enumerer(l.ajoutes.map((o) => quantifie(o.quantite, o.objet))),
    );
  }
  if (l.consommes.length > 0) {
    sortie.push(
      "CONSOMMÉ : " + enumerer(l.consommes.map((o) => quantifie(o.quantite, o.objet))),
    );
  }
  if (l.pokedollarsApres !== l.pokedollarsAvant) {
    sortie.push(
      `POKÉDOLLARS : ${pokedollars(l.pokedollarsAvant)} → ${pokedollars(l.pokedollarsApres)}`,
    );
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
  code: string,
): string {
  const texte: string[] = ["Sujet clôturé. Tout est versé, d'un seul coup."];

  for (const l of lignes) {
    texte.push("", l.pseudo.toUpperCase());
    const r = rubriques(l);
    // Un joueur présent au registre mais sans aucun effet : on le dit,
    // plutôt que de laisser une colonne vide qui ressemble à un bogue.
    texte.push(...(r.length > 0 ? r : ["Rien à verser pour ce sujet."]));
  }

  texte.push("", `CODE : ${code}`);
  return texte.join("\n");
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
