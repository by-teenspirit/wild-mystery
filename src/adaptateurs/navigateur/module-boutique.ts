/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-boutique.ts
//
//  Le panier, posé par-dessus le catalogue écrit dans le message.
//
//  ── ON RECONNAÎT LA BOUTIQUE À SON BALISAGE, PAS À SON NUMÉRO ────────
//
//  La porte d'entrée est la présence de `.wm-boutique` dans la page,
//  jamais `t977`. Trois raisons, et la troisième suffirait :
//
//    · Callista peut déplacer ou renommer le sujet sans rien casser ;
//    · elle peut en ouvrir un deuxième — une boutique saisonnière, un
//      stand d'évent — sans qu'on touche au code ;
//    · un identifiant en dur serait une quatrième source de vérité, et
//      on en a déjà perdu assez à les faire diverger.
//
//  ── SANS JAVASCRIPT, LE SUJET RESTE UNE BOUTIQUE ─────────────────────
//
//  Planche 30 : le catalogue est écrit en dur dans le message, et le
//  script ne fait qu'ajouter des boutons par-dessus une liste qui existe
//  déjà. Si ce fichier ne se charge pas, on lit les prix et on commande
//  à la main. **Rien de ce qu'on ajoute ici n'est nécessaire à la
//  lecture.**
//
//  ── ET RIEN NE PART SANS LE JOUEUR ───────────────────────────────────
//
//  « Commander » écrit le bloc dans la réponse rapide et amène le joueur
//  dessus. C'est lui qui envoie. Même règle que le bouton de clôture, et
//  même raison : il n'existe aucune API d'écriture chez Forumactif, et
//  c'est très bien.
// ════════════════════════════════════════════════════════════════════

import {
  ajuster,
  type Article,
  combien,
  etatDuBouton,
  lignesDuPanier,
  type Panier,
  PANIER_VIDE,
  pokedollars,
} from "../../navigateur/boutique.ts";
import { poserLePanier } from "../../navigateur/redaction.ts";
import type { Brouillon } from "./editeur.ts";

/** Le catalogue, lu dans le message.
 *
 *  Le prix est repris du TEXTE affiché, pas d'un attribut : ce que le
 *  joueur lit est ce qu'on additionne. Un attribut qui dirait autre
 *  chose que le texte visible serait un piège, et la planche 30 est
 *  claire — c'est le message qui fait foi côté joueur, et le serveur
 *  côté facture. */
export function catalogueDe(doc: Document): readonly Article[] {
  const sortie: Article[] = [];
  const vus = new Set<number>();
  for (const li of doc.querySelectorAll<HTMLElement>(".wm-boutique li[data-wm-objet]")) {
    const objetId = Number(li.dataset.wmObjet);
    if (!Number.isInteger(objetId) || objetId <= 0 || vus.has(objetId)) continue;
    const nom = li.querySelector(".wm-boutique__nom")?.textContent?.trim() ?? "";
    const brut = li.querySelector(".wm-boutique__prix")?.textContent ?? "";
    //  « 1 200 ₽ » : on retire tout ce qui n'est pas un chiffre. Les
    //  espaces des milliers peuvent être fines, insécables ou ordinaires
    //  selon ce que l'éditeur de Forumactif a laissé passer.
    const prix = Number(brut.replace(/[^\d]/g, ""));
    if (nom === "" || !Number.isInteger(prix) || prix <= 0) continue;
    vus.add(objetId);
    sortie.push({ objetId, nom, prix });
  }
  return sortie;
}

function element(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Fait défiler jusqu'au formulaire de réponse et y met le curseur.
 *
 *  Le catalogue est long : sans ça, on clique sur « Commander » tout en
 *  haut et il ne se passe rien de visible. */
function amenerAlaReponse(doc: Document): void {
  const cible = doc.querySelector("#quick_reply") ??
    doc.querySelector("form[name=post]") ??
    doc.querySelector("#text_editor_textarea");
  try {
    (cible as HTMLElement | null)?.scrollIntoView?.({ block: "center" });
    doc.querySelector<HTMLTextAreaElement>("#text_editor_textarea")?.focus?.();
  } catch {
    //  Le bloc est écrit, c'est l'essentiel.
  }
}

export type Dependances = {
  readonly doc: Document;
  /** Absent est un cas normal : visiteur déconnecté, sujet verrouillé.
   *  Le catalogue reste lisible, on n'ajoute simplement aucun bouton. */
  readonly brouillon: Brouillon | null;
};

/**
 * Pose les compteurs et le panier. Rend `true` s'ils ont été posés.
 *
 * Ne fait rien du tout si la page n'est pas une boutique, ou s'il n'y a
 * pas de formulaire de réponse.
 */
export function poserLaBoutique({ doc, brouillon }: Dependances): boolean {
  const bloc = doc.querySelector(".wm-boutique");
  if (bloc === null || brouillon === null) return false;

  const catalogue = catalogueDe(doc);
  if (catalogue.length === 0) return false;

  let panier: Panier = PANIER_VIDE;

  //  La barre de validation, posée à la fin du bloc. On la construit
  //  avant les compteurs : ils ont besoin de la rafraîchir.
  const barre = element(doc, "div", "wm-boutique__barre");
  const bouton = doc.createElement("button");
  bouton.type = "button";
  bouton.className = "wm-boutique__valider";
  const note = element(
    doc,
    "p",
    "wm-boutique__note",
    "Le bloc sera écrit dans ta réponse. Rien ne part sans toi, et c'est le serveur qui facture.",
  );

  const compteurs: (() => void)[] = [];
  const rafraichir = () => {
    const { actif, libelle } = etatDuBouton(panier, catalogue);
    bouton.textContent = libelle;
    bouton.disabled = !actif;
    for (const c of compteurs) c();
  };

  /** Écrit le panier dans le brouillon. Appelé à CHAQUE changement.
   *
   *  Écrire en continu plutôt qu'au clic sur « Commander » : le joueur
   *  voit son bloc se construire pendant qu'il remplit, et il peut
   *  l'effacer à la main s'il change d'avis — ce que le bouton de
   *  clôture lui permet déjà. */
  const ecrire = () => {
    brouillon.ecrire(poserLePanier(brouillon.lire(), lignesDuPanier(panier, catalogue)));
  };

  for (const li of doc.querySelectorAll<HTMLElement>(".wm-boutique li[data-wm-objet]")) {
    const objetId = Number(li.dataset.wmObjet);
    const article = catalogue.find((a) => a.objetId === objetId);
    if (article === undefined) continue;

    const commandes = element(doc, "span", "wm-boutique__commandes");
    const compte = element(doc, "span", "wm-boutique__compte");

    const pas = (delta: number, signe: string, quoi: string) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "wm-boutique__pas";
      b.textContent = signe;
      //  Le signe seul ne dit rien à un lecteur d'écran : il y en a
      //  trente-quatre paires sur la page, toutes identiques.
      b.setAttribute("aria-label", `${quoi} un ${article.nom}`);
      b.addEventListener("click", () => {
        panier = ajuster(panier, objetId, delta);
        ecrire();
        rafraichir();
      });
      return b;
    };

    commandes.appendChild(pas(-1, "−", "Retirer"));
    commandes.appendChild(compte);
    commandes.appendChild(pas(+1, "+", "Ajouter"));
    li.appendChild(commandes);

    compteurs.push(() => {
      const n = combien(panier, objetId);
      compte.textContent = n === 0 ? "" : String(n);
      li.classList.toggle("wm-boutique__article--pris", n > 0);
      //  Le sous-total ne s'affiche qu'à partir de deux : à un
      //  exemplaire il répéterait le prix affiché à côté.
      compte.title = n > 1 ? pokedollars(article.prix * n) : "";
    });
  }

  bouton.addEventListener("click", () => {
    ecrire();
    rafraichir();
    amenerAlaReponse(doc);
  });

  barre.appendChild(bouton);
  barre.appendChild(note);
  bloc.appendChild(barre);

  //  Le joueur peut effacer le bloc à la main. On ne cherche PAS à
  //  relire le panier depuis son texte pour se resynchroniser : le bloc
  //  ne porte que des identifiants et des quantités, et reconstruire un
  //  panier à partir de lui donnerait l'illusion d'un état partagé qui
  //  n'existe pas. Le panier vit dans la page, le temps de la page.
  brouillon.surChangement(rafraichir);
  rafraichir();
  return true;
}
