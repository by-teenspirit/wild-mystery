/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/editeur.ts
//
//  Lire et écrire le message en cours de rédaction.
//
//  CE QUI A ÉTÉ RELEVÉ SUR LE FORUM RÉEL, le 2 octobre, plutôt que
//  supposé :
//
//    · le champ du formulaire est `#text_editor_textarea` (name=message),
//      et il est **masqué** ;
//    · le `textarea` que le joueur voit appartient à **sceditor**, dont le
//      conteneur porte `sceditor-container` ;
//    · `window.sceditor` n'existe pas, mais jQuery est là et
//      `$(champ).sceditor("instance")` rend l'éditeur, avec `val()`,
//      `insertText()`, `sourceMode()` et `updateOriginal()` ;
//    · le forum sert deux modes — source (BBCode) et WYSIWYG — et le
//      joueur passe de l'un à l'autre quand il veut.
//
//  D'OÙ LE CHOIX DE PASSER PAR L'INSTANCE. Écrire dans le `textarea`
//  masqué marcherait… jusqu'à ce que sceditor le réécrive à l'envoi
//  depuis son propre contenu. Écrire dans le `textarea` visible ne
//  marcherait qu'en mode source. L'instance, elle, sait les deux.
//
//  ET LE REPLI, parce qu'un thème peut ne pas charger sceditor : on écrit
//  alors directement dans le champ du formulaire. Mieux vaut un bouton
//  qui marche à peu près qu'un bouton qui ne fait rien.
//
//  CE QUI A ÉTÉ RELEVÉ EN PLUS, le 2 octobre au soir, sur la réponse
//  rapide du sujet 976 :
//
//    · `window.$` est un **objet**, pas une fonction. Un script du thème
//      l'a écrasé. `$(champ)` lève donc, et tout code qui part de `$`
//      tombe dans son repli sans jamais le dire ;
//    · `window.jQuery`, lui, est resté la vraie fonction, et
//      `jQuery.fn.sceditor` existe ;
//    · sur la réponse RAPIDE, `#text_editor_textarea` est visible et
//      **aucune instance sceditor n'y est attachée** : le champ brut EST
//      l'éditeur. Le repli n'est pas un cas d'erreur, c'est le cas
//      courant.
//
//  D'OÙ `jQueryDe` : on cherche `jQuery` AVANT `$`, et on exige que ce
//  soit appelable. Deviner lequel des deux est bon coûtait un bouton muet.
// ════════════════════════════════════════════════════════════════════

/** Ce dont la barre d'actions a besoin. Rien de plus : elle n'a pas à
 *  savoir qu'il existe un sceditor, ni deux modes, ni un champ masqué. */
export interface Brouillon {
  lire(): string;
  ecrire(texte: string): void;
  /** Prévient quand le joueur tape : la barre doit refléter ce qu'il a
   *  pu effacer à la main. */
  surChangement(quoi: () => void): void;
}

const CHAMP = "#text_editor_textarea";

type InstanceSceditor = {
  val(nouveau?: string): string;
  updateOriginal?: () => void;
};

type ObjetJQuery = { sceditor?: (quoi: string) => unknown };

/** jQuery vu de l'extérieur : on l'appelle sur un élément, et c'est tout
 *  ce qu'on lui demande. */
export type FabriqueJQuery = (cible: unknown) => ObjetJQuery;

/** Les deux noms sous lesquels jQuery peut vivre, **dans cet ordre**.
 *  `$` en second et pas en premier : voir l'en-tête. */
const GLOBALES = ["jQuery", "$"] as const;

/** Le premier des deux noms qui porte quelque chose d'appelable, ou null.
 *
 *  On prend le bac de globales en argument plutôt que `globalThis` : c'est
 *  la seule façon de tester ça sans navigateur, et c'est cette fonction
 *  qui s'est trompée. */
export function jQueryDe(globales: Record<string, unknown>): FabriqueJQuery | null {
  for (const nom of GLOBALES) {
    const candidat = globales[nom];
    if (typeof candidat === "function") return candidat as FabriqueJQuery;
  }
  return null;
}

/** L'instance sceditor du champ, si elle existe. Tout est enveloppé :
 *  une version de jQuery ou de sceditor qui ne répond pas comme prévu ne
 *  doit pas casser la page, juste faire tomber dans le repli. */
function instance(champ: HTMLTextAreaElement): InstanceSceditor | null {
  const jq = jQueryDe(globalThis as unknown as Record<string, unknown>);
  if (jq === null) return null;
  try {
    const sur = jq(champ);
    if (typeof sur?.sceditor !== "function") return null;
    const trouvee = sur.sceditor("instance") as InstanceSceditor | null | undefined;
    return trouvee && typeof trouvee.val === "function" ? trouvee : null;
  } catch {
    return null;
  }
}

export class BrouillonForumactif implements Brouillon {
  readonly #champ: HTMLTextAreaElement;

  private constructor(champ: HTMLTextAreaElement) {
    this.#champ = champ;
  }

  /** Rend null s'il n'y a pas de formulaire de réponse sur cette page —
   *  ce qui est le cas de la plupart des pages du forum. */
  static surLaPage(doc: Document): BrouillonForumactif | null {
    const champ = doc.querySelector<HTMLTextAreaElement>(CHAMP);
    return champ ? new BrouillonForumactif(champ) : null;
  }

  lire(): string {
    return instance(this.#champ)?.val() ?? this.#champ.value;
  }

  ecrire(texte: string): void {
    const edit = instance(this.#champ);
    if (edit) {
      edit.val(texte);
      //  Recopie dans le champ du formulaire. Sans ça, ce qu'on vient
      //  d'écrire ne part pas avec le message.
      edit.updateOriginal?.();
      return;
    }
    this.#champ.value = texte;
    //  Un `input` à la main : le compteur de mots du forum l'écoute, et
    //  un compteur qui ne bouge pas donne l'impression que rien n'a été
    //  écrit.
    this.#champ.dispatchEvent(new Event("input", { bubbles: true }));
  }

  surChangement(quoi: () => void): void {
    //  On écoute le conteneur plutôt que le champ masqué : c'est là que
    //  les frappes arrivent, quel que soit le mode de l'éditeur.
    const zone = this.#champ.closest("form") ?? this.#champ;
    for (const quand of ["input", "keyup"]) {
      zone.addEventListener(quand, quoi, { passive: true });
    }
  }
}
