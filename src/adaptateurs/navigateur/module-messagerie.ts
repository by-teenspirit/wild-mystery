/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  module-messagerie.ts — la jauge de quota des messages privés
//
//  COUVERT PAR : outils/messagerie.mjs
//
//  La maquette `343:538` montre le quota en barre. Forumactif n'en dit
//  qu'une phrase, dans `p.left-box` : « Votre boîte des messages
//  envoyés est pleine à 8% ». `pourcentageDeQuota` en tire le nombre ;
//  ce module dessine la jauge sous la phrase.
//
//  ── LA PHRASE RESTE ───────────────────────────────────────────────
//
//  On ne la remplace pas par la barre. C'est elle qui dit DE QUELLE
//  BOÎTE on parle — réception, envoyés, brouillons — et c'est elle que
//  lit un lecteur d'écran. La barre ne fait que donner la mesure à
//  l'œil, et elle est donc posée en `aria-hidden`.
//
//  ── ET SANS SCRIPT, IL NE MANQUE RIEN ─────────────────────────────
//
//  La phrase est dans la page, écrite par Forumactif. Sans nous, elle
//  reste : on n'enlève rien, on ajoute une lecture.
// ════════════════════════════════════════════════════════════════════
import { pourcentageDeQuota } from "../../navigateur/messagerie.ts";

/** La classe de la gouttière, et celle de la part remplie. */
export const CLASSE_QUOTA = "wm-pm-quota";

/**
 * Pose la jauge de quota sous la phrase de Forumactif.
 *
 * Rend le pourcentage posé, ou `null` si la page n'en portait pas —
 * une boîte vide, une autre page, ou une phrase qu'on ne reconnaît
 * pas.
 */
export function poserLaJaugeDeQuota(doc: Document): number | null {
  //  `p.left-box` DANS UN `.panel`, et pas n'importe quel `left-box` :
  //  la classe est générique chez Forumactif, et c'est le panneau qui
  //  en fait l'entête de la boîte.
  const phrase = doc.querySelector<HTMLElement>(".panel p.left-box");
  if (phrase === null) return null;

  //  IDEMPOTENCE. Le module peut repasser — une page qui se recharge
  //  en partie, un harnais qui l'appelle deux fois — et deux jauges
  //  l'une sous l'autre seraient pires qu'aucune.
  if (phrase.parentElement?.querySelector(`.${CLASSE_QUOTA}`) !== null) {
    return null;
  }

  const part = pourcentageDeQuota(phrase.textContent);
  if (part === null) return null;

  const gouttiere = doc.createElement("div");
  gouttiere.className = CLASSE_QUOTA;
  //  LA BARRE NE DIT RIEN QUE LA PHRASE NE DISE DÉJÀ : elle sort donc
  //  de l'arbre d'accessibilité plutôt que d'y répéter le chiffre.
  gouttiere.setAttribute("aria-hidden", "true");

  const remplie = doc.createElement("div");
  remplie.className = `${CLASSE_QUOTA}__part`;
  //  La largeur est une DONNÉE, pas un style : elle vient de la page et
  //  change à chaque message. Une feuille ne peut pas la porter.
  remplie.style.width = `${part}%`;
  gouttiere.appendChild(remplie);

  phrase.insertAdjacentElement("afterend", gouttiere);
  return part;
}
