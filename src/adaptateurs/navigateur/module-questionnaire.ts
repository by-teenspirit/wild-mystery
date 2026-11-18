/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-questionnaire.ts
//
//  COUVERT PAR : outils/groupes.mjs — on répond aux huit questions
//  dans un vrai navigateur, et on lit les jauges.
//
//  Le questionnaire des six natures, dans l'annexe 07.
//
//  ── LES QUESTIONS SONT DANS LA PAGE, PAS DANS UNE REQUÊTE ───────────
//
//  `outils/annexe-groupes.py` les écrit depuis `data/groupes.json` au
//  moment de générer la page. Rien à charger, donc : le questionnaire
//  marche à la seconde où la page s'affiche, et il marcherait même si
//  GitHub Pages tombait. Ce module ne fait que LIRE ce qui est coché.
//
//  ── IL MARCHE AUSSI SANS CE SCRIPT ──────────────────────────────────
//
//  Les huit questions sont de vrais boutons radio dans un formulaire :
//  sans JavaScript, on peut répondre, et il ne manque que le compte.
//  C'est pour ça que les poids sont en attributs sur chaque bouton
//  plutôt que dans une table ici — une seule source, dans la page.
//
//  ── LE RÉSULTAT NE S'ANNONCE QU'À LA FIN ────────────────────────────
//
//  Les jauges, elles, bougent à chaque réponse : c'est ce qui donne
//  envie de finir. Mais la phrase qui désigne une nature attend les
//  huit — annoncer « tu es Brave » après deux questions serait faux, et
//  la personne s'arrêterait là.
// ════════════════════════════════════════════════════════════════════

import { type Choix, depouiller } from "../../navigateur/questionnaire.ts";

const RACINE = "[data-wm-questionnaire]";

function texte(e: Element | null, quoi: string): void {
  if (e !== null) e.textContent = quoi;
}

/** Les réponses cochées, dans l'ordre des questions. */
export function choixCoches(formulaire: HTMLFormElement): readonly Choix[] {
  const coches: Choix[] = [];
  for (const champ of formulaire.querySelectorAll("fieldset")) {
    const choisi = champ.querySelector<HTMLInputElement>("input:checked");
    if (choisi === null) continue;
    const premier = choisi.dataset.wmPremier ?? "";
    const second = choisi.dataset.wmSecond ?? "";
    if (premier !== "" && second !== "") coches.push({ premier, second });
  }
  return coches;
}

/** La phrase du résultat.
 *
 *  ELLE DIT CE QU'ELLE SAIT ET RIEN DE PLUS. Tant que les huit ne sont
 *  pas répondues, elle compte ce qui manque ; à la fin elle nomme une
 *  nature, ou deux quand elles sont à égalité — « le questionnaire ne
 *  décide de rien, il dit ce que tes réponses racontent ». */
export function phraseDuResultat(
  repondues: number,
  total: number,
  tetes: readonly string[],
  noms: ReadonlyMap<string, string>,
): string {
  if (repondues < total) {
    const reste = total - repondues;
    return reste === 1 ? "Encore une question." : `Encore ${reste} questions.`;
  }
  const dits = tetes.map((c) => noms.get(c) ?? c);
  if (dits.length > 1) {
    return `Tes réponses tirent autant vers ${dits[0]} que vers ${dits[1]}. ` +
      "Prends celle que tu veux : à égalité, c'est toi qui tranches.";
  }
  return `Tu penches vers ${dits[0]}. Prends-la si elle te parle — le ` +
    "questionnaire ne décide de rien, il dit seulement ce que tes " +
    "réponses racontent.";
}

/** Pose le questionnaire. Rend `false` si la page n'en a pas. */
export function poserLeQuestionnaire(doc: Document): boolean {
  const racine = doc.querySelector<HTMLElement>(RACINE);
  if (racine === null) return false;
  const formulaire = racine.querySelector("form");
  if (formulaire === null) return false;

  const jauges = new Map<string, HTMLElement>();
  for (const j of racine.querySelectorAll<HTMLElement>("[data-wm-jauge]")) {
    const cle = j.dataset.wmJauge;
    if (cle !== undefined) jauges.set(cle, j);
  }
  const noms = new Map<string, string>();
  for (const [cle, j] of jauges) {
    noms.set(cle, j.dataset.wmNom ?? cle);
  }
  const cles = [...jauges.keys()];
  const questions = formulaire.querySelectorAll("fieldset").length;

  const resultat = racine.querySelector("[data-wm-resultat]");
  const recommencer = racine.querySelector<HTMLButtonElement>("[data-wm-recommencer]");

  function compter(): void {
    const d = depouiller(choixCoches(formulaire!), cles);
    for (const r of d.classement) {
      const jauge = jauges.get(r.cle);
      if (jauge === undefined) continue;
      const barre = jauge.querySelector<HTMLElement>(".wm-sonde__barre");
      //  LA LARGEUR PREND LA PART EXACTE, le texte la part arrondie :
      //  un trait au pixel près n'a pas besoin d'être arrondi, et un
      //  pourcentage à douze décimales ne se lit pas.
      if (barre !== null) barre.style.width = `${r.partExacte}%`;
      texte(jauge.querySelector(".wm-sonde__part"), `${r.part} %`);
      //  LA TÊTE EST MARQUÉE, et par un attribut : le CSS la teinte,
      //  et un relevé peut la vérifier sans connaître les classes.
      if (d.tetes.includes(r.cle)) jauge.dataset.wmTete = "oui";
      else delete jauge.dataset.wmTete;
      //  L'ORDRE SUIT LE CLASSEMENT. `order` et pas un déplacement de
      //  nœud : déplacer un élément pendant qu'on clique dessus
      //  ferait perdre le focus au clavier.
      jauge.style.order = String(d.classement.indexOf(r));
    }
    texte(resultat, phraseDuResultat(d.repondues, questions, d.tetes, noms));
    racine!.dataset.wmFini = d.repondues === questions ? "oui" : "non";
  }

  formulaire.addEventListener("change", compter);
  recommencer?.addEventListener("click", () => {
    formulaire.reset();
    compter();
    //  ON REMONTE À LA PREMIÈRE QUESTION : sans ça, « recommencer »
    //  laisse la personne en bas de page devant huit questions vides
    //  qu'elle ne voit pas.
    formulaire.querySelector("fieldset")?.scrollIntoView({ block: "center" });
  });

  //  UN PREMIER COMPTE TOUT DE SUITE : le navigateur garde les boutons
  //  cochés quand on recharge la page, et les jauges doivent repartir
  //  d'accord avec eux plutôt qu'à zéro.
  compter();
  return true;
}
