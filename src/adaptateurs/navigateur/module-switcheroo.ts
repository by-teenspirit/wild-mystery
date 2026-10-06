/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-switcheroo.ts
//
//  Le switcheroo : le gestionnaire de multicomptes de Forumactif, celui
//  que la V1 utilisait déjà. C'est lui qui remplit « Mes personnages ».
//
//  ── IL N'EST PAS RECOPIÉ DANS LE DÉPÔT ──────────────────────────────
//
//  `Lostmindy/switcheroo-fork` **n'a aucune licence**, donc on ne le
//  vendorise pas : on le charge depuis jsDelivr.
//
//  ── ET IL EST ÉPINGLÉ À UN COMMIT ───────────────────────────────────
//
//  `@3f58158…` et pas `@master`. C'est la leçon du 6 octobre, payée sur
//  notre propre dépôt : **jsDelivr garde la résolution d'une branche** et
//  sert un fichier vieux de plusieurs jours qu'aucune purge ne débloque.
//  Pour du code tiers c'est pire — il changerait sous nos pieds sans
//  qu'on l'ait demandé.
//
//  ── CE QU'IL FAIT, ET CE QU'ON LUI LAISSE FAIRE ─────────────────────
//
//  Il garde les comptes du joueur dans `localStorage` et les rejoue pour
//  basculer. **Choix assumé par Callista le 6 octobre**, après lecture de
//  son code de chiffrement.
//
//  Nous, on ne touche à rien de tout ça : on lui donne son conteneur, on
//  l'instancie, et on lit sa liste. Les mots de passe ne passent jamais
//  par notre code, et ce fichier n'en voit aucun.
//
//  ── SON CONTENEUR EST CACHÉ, ET C'EST VOULU ─────────────────────────
//
//  Il dessine des pastilles rondes ; la maquette veut des cartes avec le
//  nom, le niveau et le groupe. On garde donc NOTRE rendu dans le
//  panneau, et son conteneur reste hors écran — mais **présent et
//  vivant**, parce que c'est lui qui porte les gestionnaires de clic.
//  Nos cartes lui délèguent le clic plutôt que de refaire sa bascule.
//
//  Caché par `clip-path`, pas par `display: none` : un élément en
//  `display: none` ne reçoit pas de clic programmatique dans tous les
//  navigateurs, et c'est précisément le clic qu'on lui envoie.
// ════════════════════════════════════════════════════════════════════

const SHA = "3f58158805cb37c4a5f2ce37c688a9c3f1035956";
const SOURCE = `https://cdn.jsdelivr.net/gh/Lostmindy/switcheroo-fork@${SHA}`;

/** Charge un script et attend qu'il soit prêt.
 *
 *  Rend `false` plutôt que de lever : le switcheroo est un confort, et
 *  une panne de CDN ne doit pas emporter le reste de la page. */
function charger(doc: Document, adresse: string): Promise<boolean> {
  return new Promise((resoudre) => {
    const s = doc.createElement("script");
    s.src = adresse;
    s.async = false;
    s.addEventListener("load", () => resoudre(true), { once: true });
    s.addEventListener("error", () => resoudre(false), { once: true });
    doc.head.appendChild(s);
  });
}

type FabriqueDeSwitcheroo = new (
  selecteur: string,
  options: Record<string, unknown>,
) => unknown;

/**
 * Pose le switcheroo, et rend `true` s'il a démarré.
 *
 * Ne fait rien pour un visiteur déconnecté : il n'a pas de comptes à
 * gérer, et le conteneur resterait vide.
 */
export async function poserLeSwitcheroo(
  doc: Document,
  connectee: boolean,
): Promise<boolean> {
  if (!connectee) return false;
  if (doc.querySelector("#switcheroo") !== null) return true;

  const conteneur = doc.createElement("nav");
  conteneur.id = "switcheroo";
  conteneur.className = "switcheroo wm-switcheroo-cache";
  //  Il n'est pas annoncé : c'est notre panneau qui présente la même
  //  liste, en mieux. L'entendre deux fois n'aide personne.
  conteneur.setAttribute("aria-hidden", "true");
  doc.body?.appendChild(conteneur);

  //  `monomer` D'ABORD : `switcheroo.js` l'instancie au chargement.
  //  L'ordre n'est pas un détail de confort, c'est une dépendance.
  if (!await charger(doc, `${SOURCE}/monomer.js`)) return false;
  if (!await charger(doc, `${SOURCE}/switcheroo.js`)) return false;

  const fabrique = (globalThis as unknown as { Switcheroo?: FabriqueDeSwitcheroo }).Switcheroo;
  if (fabrique === undefined) return false;

  try {
    new fabrique("#switcheroo", {
      //  Pas de logo : le nôtre est dans la barre, et celui-ci n'est
      //  jamais vu puisque le conteneur est hors écran.
      logo: "",
      //  On garde la confirmation : une bascule de compte par mégarde
      //  déconnecte, et il faut tout retaper.
      confirm: true,
      confirmMsg: "Changer de personnage ?",
      errorMsg: "Le changement de personnage n'a pas abouti.",
      //  Le glisser-déposer ne sert à rien dans un conteneur caché, et
      //  il attache trois écouteurs par pastille.
      enableReorder: false,
    });
  } catch {
    return false;
  }
  return true;
}
