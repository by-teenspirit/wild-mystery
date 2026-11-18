/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-reveil.ts
//
//  COUVERT PAR : outils/sujet.mjs — on pose une action en dernier
//  message, et on vérifie que la relève est sonnée une fois, que la
//  page guette, et qu'elle ne sonne pas quand le Maître du Jeu a déjà
//  répondu.
//
//  « Toutes les cinq minutes, c'est trop long. On peut pas avoir
//  quelque chose d'immédiat ? » — 18 novembre.
//
//  ── CE QU'ON ENVOIE : RIEN ──────────────────────────────────────────
//
//  Un POST vide sur la fonction `releve`. Pas de clé, pas d'identité,
//  pas de numéro de sujet. La fonction est déployée sans vérification
//  de jeton et prend un verrou avant de travailler (migration 0005) :
//  on ne lui demande pas un traitement particulier, on lui demande un
//  passage, et le passage lit ce qu'il a toujours lu.
//
//  DIX CLICS NE FONT PAS DIX PASSAGES : le second se heurte au verrou
//  et rend la main. C'est ce verrou qui rend ce réveil acceptable, et
//  c'est pour ça qu'on ne réinvente pas de limite ici.
//
//  ── ET LE CRON RESTE ────────────────────────────────────────────────
//
//  Celui de cinq minutes ne bouge pas. Un joueur qui ferme son onglet
//  juste après avoir posté n'a plus de page pour sonner : sa réponse
//  arrive au passage suivant. Le réveil est un raccourci, pas le
//  chemin.
// ════════════════════════════════════════════════════════════════════

import { type ConfigSupabase } from "./registre.ts";
import {
  type EtatDeLaPage,
  faut_il_sonner,
  GUET_SECONDES,
  instantsDuGuet,
  PAS_SECONDES,
} from "../../navigateur/reveil.ts";

/** Le dernier message du sujet, et ce qu'il porte. */
export function dernierMessage(doc: Document): Element | null {
  const posts = [...doc.querySelectorAll(".post")].filter((p) => /^p\d+$/.test(p.id));
  return posts.at(-1) ?? null;
}

/** Y a-t-il une action en attente de réponse ?
 *
 *  ON LIT LE MARQUEUR, PAS LE TEXTE. `[[WM-ACTION:…]]` est posé par la
 *  barre et masqué par `marqueurs.ts` ; c'est la seule marque qui dit
 *  « ce message demande quelque chose au Maître du Jeu ». Le texte du
 *  joueur, lui, peut dire n'importe quoi.
 *
 *  ET LA RÉPONSE DU MAÎTRE DU JEU PORTE `[[WM:…]]`, un autre marqueur :
 *  si le dernier message est le sien, il n'y a plus rien à attendre. */
export function actionEnAttente(doc: Document): boolean {
  const dernier = dernierMessage(doc);
  if (dernier === null) return false;
  const marqueurs = [...dernier.querySelectorAll(".wm-marqueur")]
    .map((m) => m.textContent ?? "");
  return marqueurs.some((t) => t.includes("[[WM-ACTION:"));
}

/** L'âge du dernier message, en secondes, ou `null`.
 *
 *  FORUMACTIF N'ÉCRIT PAS DE DATE LISIBLE PAR MACHINE : `.topic-date`
 *  dit « Aujourd'hui à 15:34 » ou « Mar 27 Oct 2026 - 18:52 ». On ne
 *  lit donc QUE le cas « Aujourd'hui », le seul qui puisse concerner
 *  une action qu'on vient de poster — tout le reste rend `null`, et
 *  `faut_il_sonner` traite l'inconnu comme « sonne quand même ».
 *
 *  C'est volontairement rustique : une bibliothèque de dates pour
 *  savoir s'il s'est écoulé plus de dix minutes serait disproportionnée,
 *  et le pire que l'imprécision puisse faire est un passage à vide. */
export function ageDuDernierMessage(doc: Document, maintenant: Date): number | null {
  const dernier = dernierMessage(doc);
  const dit = dernier?.querySelector(".topic-date")?.textContent?.trim() ?? "";
  const m = /aujourd'hui.*?(\d{1,2})\s*[:h]\s*(\d{2})/i.exec(dit);
  if (m === null) return null;
  const heure = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(heure) || !Number.isInteger(minute)) return null;
  const poste = new Date(maintenant);
  poste.setHours(heure, minute, 0, 0);
  return Math.round((maintenant.getTime() - poste.getTime()) / 1000);
}

export function etatDeLaPage(doc: Document, maintenant: Date): EtatDeLaPage {
  return {
    derniereActionEstLaMienne: actionEnAttente(doc),
    ageDuMessage: ageDuDernierMessage(doc, maintenant),
  };
}

export type DependancesDuReveil = {
  readonly doc: Document;
  readonly acces: ConfigSupabase;
  readonly maintenant?: () => Date;
  /** Pour les essais : remplace `fetch`. */
  readonly appeler?: (url: string, init: RequestInit) => Promise<unknown>;
  /** Pour les essais : remplace l'attente. */
  readonly attendre?: (secondes: number) => Promise<void>;
  /** Pour les essais : remplace le rechargement. */
  readonly recharger?: () => void;
};

const dormir = (s: number) => new Promise<void>((r) => setTimeout(r, s * 1000));

/** Combien de messages porte la page en ce moment.
 *
 *  ON COMPTE, ON NE COMPARE PAS LES IDENTIFIANTS : un message effacé
 *  pendant le guet ferait un compte égal, donc pas de rechargement —
 *  ce qui est exactement ce qu'on veut. Un identifiant maximum, lui,
 *  aurait déclenché un rechargement sur une suppression. */
function combienDeMessages(doc: Document): number {
  return [...doc.querySelectorAll(".post")].filter((p) => /^p\d+$/.test(p.id)).length;
}

/** Sonne la relève et guette sa réponse. Rend `true` si elle est
 *  arrivée pendant le guet.
 *
 *  NE FAIT RIEN HORS D'UN SUJET AVEC UNE ACTION EN ATTENTE. */
export async function reveillerLaReleve(d: DependancesDuReveil): Promise<boolean> {
  const maintenant = (d.maintenant ?? (() => new Date()))();
  if (!faut_il_sonner(etatDeLaPage(d.doc, maintenant))) return false;

  const appeler = d.appeler ??
    ((url: string, init: RequestInit) => fetch(url, init));
  const attendre = d.attendre ?? dormir;
  const recharger = d.recharger ?? (() => d.doc.defaultView?.location.reload());

  //  LE RÉVEIL EST SANS CONSÉQUENCE S'IL ÉCHOUE : le cron de cinq
  //  minutes reste derrière. On ne dit donc rien au joueur et on
  //  guette quand même — la réponse peut très bien arriver du cron
  //  pendant qu'on regarde.
  await appeler(`${d.acces.url}/functions/v1/releve`, {
    method: "POST",
    //  AUCUN CORPS, AUCUNE EN-TÊTE D'IDENTITÉ. La fonction n'attend
    //  rien de nous, et lui envoyer une clé depuis une page publique
    //  serait la publier.
    body: "",
    credentials: "omit",
  }).catch(() => null);

  const depart = combienDeMessages(d.doc);
  let ecoule = 0;
  for (const t of instantsDuGuet(GUET_SECONDES, PAS_SECONDES)) {
    await attendre(t - ecoule);
    ecoule = t;
    //  ON REDEMANDE LA PAGE, on ne devine pas. Le sujet est sur le
    //  même domaine, donc une simple requête suffit — et c'est la
    //  seule façon de voir un message qui n'est pas encore dans le
    //  DOM.
    const html = await appeler(d.doc.location.href, { credentials: "same-origin" })
      .then((r) => (r instanceof Response ? r.text() : String(r)))
      .catch(() => null);
    if (html === null) continue;
    const page = new DOMParser().parseFromString(html, "text/html");
    if (combienDeMessages(page) > depart) {
      recharger();
      return true;
    }
  }
  return false;
}
