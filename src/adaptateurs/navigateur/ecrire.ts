/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/ecrire.ts
//
//  COUVERT PAR : outils/carnet.mjs — les trois places, l'enregistrement
//  différé, le filet local, le compteur, les outils, le focus, la
//  session et l'envoi par le formulaire natif.
//
//  Note de code `385:1005`. Ce fichier est l'adaptateur : il tient le
//  DOM, le réseau et le temps. Tout ce qui se calcule est dans
//  `src/navigateur/brouillon.ts`, qui est pur et mesuré à part.
//
//  ── LA PREMIÈRE ÉCRITURE DU PROJET, ET CE QU'ELLE CHANGE ────────────
//
//  Jusqu'ici le carnet appelait UNE fonction `security definer` et
//  peignait le résultat. Ici on écrit dans une table, par PostgREST,
//  avec le jeton du joueur. Ce n'est plus une fonction qui décide ce
//  qu'on touche : c'est la RLS de la `0032`. Le navigateur peut donc
//  demander n'importe quoi — il n'obtiendra que ses propres lignes, et
//  c'est mesuré côté base (`garanties.sql`, treize assertions).
//
//  ── LE FILET LOCAL N'EST PAS UNE SAUVEGARDE ─────────────────────────
//
//  « Le texte part aussi dans localStorage à chaque frappe : si le
//  réseau lâche, rien n'est perdu au rechargement. » C'est un filet,
//  pas une source : au chargement, la base fait foi, et le texte local
//  n'est proposé que s'il est PLUS RÉCENT que ce que la base rend. Sans
//  cette comparaison, écrire depuis un second appareil ferait ressurgir
//  un vieux texte oublié dans le navigateur du premier.
// ════════════════════════════════════════════════════════════════════

import type { ConfigSupabase } from "./registre.ts";
import {
  adresseDuFormulaire,
  commencerUneSession,
  compterLesMots,
  direLeTemps,
  DUREES,
  motsDeLaSession,
  OUTILS,
  poserLOutil,
  restantEnSecondes,
  type Session,
  sessionFinie,
} from "../../navigateur/brouillon.ts";

export type Brouillon = {
  place: number;
  sujet_id: number | null;
  titre: string;
  corps: string;
  mots: number;
  modifie_le: string;
};

export const PLACES = [1, 2, 3] as const;
export const ATTENTE_MS = 2000;
const CLEF_LOCALE = "wm.carnet.brouillon";

// ── le réseau ──────────────────────────────────────────────────────

/** PostgREST, pas une fonction : c'est la RLS qui filtre.
 *
 *  ON NE DEMANDE PAS `joueur_id = …` : la politique de lecture ne rend
 *  déjà que les siens. Ajouter le filtre donnerait l'illusion que c'est
 *  lui qui protège, et le jour où quelqu'un l'enlève pour déboguer, la
 *  protection partirait avec. */
export async function lireLesBrouillons(
  acces: ConfigSupabase,
  jeton: string,
): Promise<Brouillon[] | null> {
  const r = await fetch(`${acces.url}/rest/v1/brouillon?select=*&order=place`, {
    credentials: "omit",
    headers: {
      apikey: acces.clePubliable,
      Authorization: `Bearer ${jeton}`,
      Accept: "application/json",
    },
  }).catch(() => null);
  if (r === null || !r.ok) {
    console.error("wm/ecrire : les brouillons n'ont pas pu être lus —", r?.status);
    return null;
  }
  const brut = await r.json().catch(() => null);
  return Array.isArray(brut) ? brut as Brouillon[] : null;
}

/** Écrit une place, en créant la ligne si elle n'existe pas.
 *
 *  `resolution=merge-duplicates` est l'`upsert` de PostgREST : la clé
 *  primaire est (joueur_id, place), donc la même place se réécrit au
 *  lieu de lever un conflit. `joueur_id` doit être posé à l'insertion —
 *  la politique d'écriture vérifie qu'il est bien l'un des siens. */
export async function ecrireLeBrouillon(
  acces: ConfigSupabase,
  jeton: string,
  joueurId: string,
  b: Brouillon,
): Promise<boolean> {
  const r = await fetch(`${acces.url}/rest/v1/brouillon`, {
    method: "POST",
    credentials: "omit",
    headers: {
      apikey: acces.clePubliable,
      Authorization: `Bearer ${jeton}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      joueur_id: joueurId,
      place: b.place,
      sujet_id: b.sujet_id,
      titre: b.titre,
      corps: b.corps,
      mots: b.mots,
      modifie_le: new Date().toISOString(),
    }),
  }).catch(() => null);
  if (r === null || !r.ok) {
    console.error("wm/ecrire : l'enregistrement a échoué —", r?.status);
    return false;
  }
  return true;
}

// ── le filet local ─────────────────────────────────────────────────

type Local = { place: number; corps: string; quand: number };

export function garderEnLocal(place: number, corps: string): void {
  try {
    localStorage.setItem(
      CLEF_LOCALE,
      JSON.stringify({ place, corps, quand: Date.now() } satisfies Local),
    );
  } catch { /* navigation privée : le filet n'existe pas, le reste marche */ }
}

export function lireLeLocal(): Local | null {
  try {
    const brut = localStorage.getItem(CLEF_LOCALE);
    if (brut === null) return null;
    const lu = JSON.parse(brut) as Partial<Local>;
    if (typeof lu?.corps !== "string" || typeof lu?.place !== "number") return null;
    if (typeof lu?.quand !== "number") return null;
    return { place: lu.place, corps: lu.corps, quand: lu.quand };
  } catch {
    return null;
  }
}

/** Le texte local l'emporte seulement s'il est PLUS RÉCENT que la base.
 *
 *  Sans cette comparaison, quelqu'un qui écrit depuis son téléphone puis
 *  rouvre son ordinateur verrait ressurgir le texte d'avant — et
 *  l'enregistrement automatique l'écraserait dans la base deux secondes
 *  plus tard. Un filet qui mange le travail n'est pas un filet. */
export function texteARetenir(b: Brouillon, local: Local | null): string {
  if (local === null || local.place !== b.place) return b.corps;
  const enBase = Date.parse(b.modifie_le);
  if (!Number.isFinite(enBase)) return local.corps;
  return local.quand > enBase ? local.corps : b.corps;
}

/** Le dernier message d'un sujet, lu sur le forum lui-même.
 *
 *  PAS UNE FONCTION DE LA BASE : ce message n'est pas chez nous. La
 *  table `rp` que la relève remplira le portera un jour (tâche 9) ;
 *  d'ici là, la page est servie par forumactif.com et peut donc
 *  demander n'importe quelle page du forum en même origine — c'est déjà
 *  comme ça qu'on lit `_userdata`.
 *
 *  ON NE REND QUE DU TEXTE, et c'est délibéré : coller le HTML d'un
 *  message dans la page du carnet y ferait entrer les images, les
 *  scripts et la mise en forme de quelqu'un d'autre. On relit pour se
 *  souvenir de ce qui s'est passé, pas pour l'admirer.
 *
 *  `null` si quoi que ce soit manque. Le tiroir est un confort : il ne
 *  doit jamais empêcher d'écrire. */
export async function dernierMessageDuSujet(
  sujetId: number,
  demander: (a: string) => Promise<string> = (a) =>
    fetch(a, { credentials: "same-origin" }).then((x) => x.text()),
): Promise<string | null> {
  const code = await demander(`/t${sujetId}`).catch(() => null);
  if (code === null) return null;
  return dernierMessageDansLaPage(code);
}

/** La partie pure : le texte du dernier message d'une page de sujet. */
export function dernierMessageDansLaPage(code: string): string | null {
  const doc = new DOMParser().parseFromString(code, "text/html");
  const corps = doc.querySelectorAll(".post .postbody .content, .post .entry-content");
  const dernier = corps[corps.length - 1];
  if (dernier === undefined) return null;
  const texte = (dernier.textContent ?? "").replace(/\s+/g, " ").trim();
  if (texte === "") return null;
  return texte.length > 1200 ? texte.slice(0, 1200) + "…" : texte;
}

// ── l'écran ────────────────────────────────────────────────────────

type Pieces = {
  corps: HTMLTextAreaElement;
  mots: HTMLElement;
  etat: HTMLElement;
  sujet: HTMLElement;
  outils: HTMLElement;
  places: HTMLElement;
  durees: HTMLElement;
  enCours: HTMLElement;
  focus: HTMLElement;
  envoyer: HTMLElement;
  relire: HTMLElement;
  tiroir: HTMLElement;
  tiroirTete: HTMLElement;
  tiroirCorps: HTMLElement;
  section: HTMLElement;
};

function pieces(doc: Document): Pieces | null {
  const q = <T extends HTMLElement>(s: string) => doc.querySelector<T>(s);
  const p = {
    corps: q<HTMLTextAreaElement>("[data-wm-ecrire-corps]"),
    mots: q("[data-wm-ecrire-mots]"),
    etat: q("[data-wm-ecrire-etat]"),
    sujet: q("[data-wm-ecrire-sujet]"),
    outils: q("[data-wm-ecrire-outils]"),
    places: q("[data-wm-ecrire-places]"),
    durees: q("[data-wm-ecrire-durees]"),
    enCours: q("[data-wm-ecrire-en-cours]"),
    focus: q("[data-wm-ecrire-focus]"),
    envoyer: q("[data-wm-ecrire-envoyer]"),
    relire: q("[data-wm-ecrire-relire]"),
    tiroir: q("[data-wm-ecrire-tiroir]"),
    tiroirTete: q("[data-wm-ecrire-tiroir-tete]"),
    tiroirCorps: q("[data-wm-ecrire-tiroir-corps]"),
    section: q('[data-wm-carnet-page="ecrire"]'),
  };
  //  UNE PIÈCE MANQUANTE ARRÊTE TOUT, ET LE DIT. C'est la leçon du
  //  3 novembre : une page plus vieille que le script laissait un écran
  //  muet, et on cherchait la panne ailleurs.
  for (const [nom, e] of Object.entries(p)) {
    if (e === null) {
      console.error("wm/ecrire : la page n'a pas", nom);
      return null;
    }
  }
  return p as Pieces;
}

/** Le texte d'un brouillon dans la liste des trois places. */
export function ditDeLaPlace(b: Brouillon | undefined): string {
  if (b === undefined) return "Place libre";
  if (b.titre !== "") return b.titre;
  if (b.sujet_id !== null) return `Sujet ${b.sujet_id}`;
  return "Sans sujet";
}

export type Reglages = {
  readonly doc: Document;
  readonly acces: ConfigSupabase;
  readonly jeton: string;
  readonly joueurId: string;
  readonly maintenant?: () => number;
};

/** Monte l'onglet Écrire. Rend `false` si la page ne s'y prête pas. */
export function poserEcrire(r: Reglages): boolean {
  const p = pieces(r.doc);
  if (p === null) return false;
  const horloge = r.maintenant ?? (() => Date.now());

  let brouillons: Brouillon[] = [];
  let ouverte = 1;
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  let session: Session | null = null;
  let tictac: ReturnType<typeof setInterval> | undefined;

  const courant = (): Brouillon => {
    const t = brouillons.find((b) => b.place === ouverte);
    return t ??
      {
        place: ouverte,
        sujet_id: null,
        titre: "",
        corps: "",
        mots: 0,
        modifie_le: new Date(0).toISOString(),
      };
  };

  // ── le compteur, les places, l'état ──────────────────────────────

  const peindreLeCompte = () => {
    p.mots.textContent = String(compterLesMots(p.corps.value));
  };

  const peindreLesPlaces = () => {
    p.places.textContent = "";
    for (const place of PLACES) {
      const b = brouillons.find((x) => x.place === place);
      const li = r.doc.createElement("li");
      const bouton = r.doc.createElement("button");
      bouton.type = "button";
      bouton.className = "wm-ecrire__place" +
        (b === undefined ? " wm-ecrire__place--vide" : "");
      bouton.setAttribute("aria-current", place === ouverte ? "true" : "false");
      const nom = r.doc.createElement("span");
      nom.className = "wm-ecrire__place-nom";
      nom.textContent = ditDeLaPlace(b);
      const dit = r.doc.createElement("span");
      dit.className = "wm-ecrire__place-dit";
      dit.textContent = b === undefined ? "—" : `${b.mots} mots`;
      bouton.append(nom, dit);
      bouton.addEventListener("click", () => ouvrirLaPlace(place));
      li.append(bouton);
      p.places.append(li);
    }
  };

  const peindreLaTete = () => {
    const b = courant();
    p.sujet.textContent = ditDeLaPlace(brouillons.find((x) => x.place === ouverte));
    p.etat.textContent = `Brouillon ${ouverte} sur 3`;
    p.envoyer.textContent = b.sujet_id === null
      ? "Ouvrir un nouveau sujet →"
      : "Envoyer dans le sujet →";
  };

  const ouvrirLaPlace = (place: number) => {
    ouverte = place;
    const b = courant();
    p.corps.value = texteARetenir(b, lireLeLocal());
    peindreLaTete();
    peindreLesPlaces();
    peindreLeCompte();
  };

  // ── l'enregistrement, deux secondes après la dernière frappe ─────

  const enregistrer = async () => {
    const corps = p.corps.value;
    const mots = compterLesMots(corps);
    const avant = courant();
    const b: Brouillon = { ...avant, place: ouverte, corps, mots };
    p.etat.textContent = "Enregistrement…";
    const fait = await ecrireLeBrouillon(r.acces, r.jeton, r.joueurId, b);
    if (!fait) {
      //  ON NE DIT PAS « ENREGISTRÉ » QUAND ÇA N'A PAS MARCHÉ, et le
      //  texte est dans localStorage de toute façon : la phrase dit
      //  quoi faire, pas seulement que c'est cassé.
      p.etat.textContent = "Pas enregistré — ton texte est gardé ici, réessaie dans un moment";
      return;
    }
    b.modifie_le = new Date().toISOString();
    brouillons = [...brouillons.filter((x) => x.place !== ouverte), b]
      .sort((x, y) => x.place - y.place);
    p.etat.textContent = "Enregistré";
    peindreLesPlaces();
  };

  p.corps.addEventListener("input", () => {
    peindreLeCompte();
    //  LE FILET LOCAL À CHAQUE FRAPPE, l'enregistrement après deux
    //  secondes de silence. L'un est gratuit, l'autre traverse le
    //  réseau : les confondre ferait une requête par lettre.
    garderEnLocal(ouverte, p.corps.value);
    if (minuteur !== undefined) clearTimeout(minuteur);
    minuteur = setTimeout(() => void enregistrer(), ATTENTE_MS);
  });

  // ── la barre d'outils ────────────────────────────────────────────

  for (const outil of OUTILS) {
    const bouton = r.doc.createElement("button");
    bouton.type = "button";
    bouton.className = "wm-ecrire__outil";
    bouton.textContent = outil.mot;
    bouton.title = outil.nom;
    bouton.setAttribute("aria-label", outil.nom);
    bouton.addEventListener("click", () => {
      const fait = poserLOutil(
        p.corps.value,
        outil,
        p.corps.selectionStart ?? 0,
        p.corps.selectionEnd ?? 0,
      );
      p.corps.value = fait.texte;
      p.corps.setSelectionRange(fait.de, fait.a);
      p.corps.focus();
      p.corps.dispatchEvent(new Event("input", { bubbles: true }));
    });
    p.outils.append(bouton);
  }

  // ── le focus : la même page, moins le reste ──────────────────────

  const carnet = r.doc.querySelector<HTMLElement>(".wm-carnet");
  const basculerLeFocus = (ouvert: boolean) => {
    if (ouvert) {
      p.section.setAttribute("data-wm-focus", "");
      carnet?.setAttribute("data-wm-focus", "");
      p.focus.textContent = "Quitter le focus";
      p.relire.hidden = false;
      //  LE PLEIN ÉCRAN PEUT ÊTRE REFUSÉ — un navigateur l'exige en
      //  réponse à un geste, et certains le bloquent. Le focus marche
      //  sans lui : c'est la classe qui fait le travail.
      void r.doc.documentElement.requestFullscreen?.().catch(() => {});
      void chargerLeTiroir();
      return;
    }
    p.section.removeAttribute("data-wm-focus");
    carnet?.removeAttribute("data-wm-focus");
    p.focus.textContent = "Mode focus";
    p.relire.hidden = true;
    p.tiroir.hidden = true;
    if (r.doc.fullscreenElement !== null) void r.doc.exitFullscreen?.().catch(() => {});
  };

  p.focus.addEventListener("click", () => {
    basculerLeFocus(!p.section.hasAttribute("data-wm-focus"));
  });

  //  ÉCHAP SORT DU PLEIN ÉCRAN TOUT SEUL : le navigateur s'en charge, et
  //  on écoute l'événement plutôt que la touche. Écouter la touche
  //  laisserait la classe posée quand le plein écran est quitté
  //  autrement — par le bouton du navigateur, par exemple.
  r.doc.addEventListener("fullscreenchange", () => {
    if (r.doc.fullscreenElement === null && p.section.hasAttribute("data-wm-focus")) {
      basculerLeFocus(false);
    }
  });

  // ── le tiroir de relecture ───────────────────────────────────────

  const chargerLeTiroir = async () => {
    const b = courant();
    if (b.sujet_id === null) return;
    p.tiroir.hidden = false;
    p.tiroirTete.textContent = "Le dernier message du sujet";
    p.tiroirCorps.textContent = "Un instant…";
    const dit = await dernierMessageDuSujet(b.sujet_id);
    //  PAS UNE PANNE DU CARNET : le tiroir est un confort. On le dit et
    //  on laisse écrire.
    p.tiroirCorps.textContent = dit ??
      "Le dernier message n'a pas pu être chargé. Tu peux l'ouvrir dans le sujet.";
  };

  p.relire.addEventListener("click", () => void chargerLeTiroir());

  // ── l'envoi : le formulaire natif, jamais nous ───────────────────

  p.envoyer.addEventListener("click", () => {
    const b = courant();
    const adresse = adresseDuFormulaire(b.sujet_id);
    if (adresse === null) return;
    //  LE CORPS NE PART PAS DANS L'ADRESSE. Il est copié, et le
    //  formulaire s'ouvre : « il pourrait poster, il a les identifiants.
    //  Mais la fiche serait signée d'un robot. »
    void navigator.clipboard?.writeText(p.corps.value).catch(() => {});
    p.etat.textContent = "Texte copié — colle-le dans le formulaire qui s'ouvre";
    globalThis.open(adresse, "_blank", "noopener");
  });

  // ── la session ───────────────────────────────────────────────────

  const direLaSession = () => {
    if (session === null) {
      p.enCours.hidden = true;
      return;
    }
    p.enCours.hidden = false;
    const n = horloge();
    if (!sessionFinie(session, n)) {
      p.enCours.textContent = `Il reste ${direLeTemps(restantEnSecondes(session, n))}.`;
      return;
    }
    //  LA FIN EST UNE PHRASE EN BAS DE L'ÉCRAN, jamais une fenêtre
    //  modale et sans aucun son. Et le bilan compte les mots DE LA
    //  SESSION, pas le total du message.
    const faits = motsDeLaSession(session, compterLesMots(p.corps.value));
    p.enCours.textContent = `Session terminée. ${faits} mots écrits pendant la session.`;
    session = null;
    if (tictac !== undefined) clearInterval(tictac);
  };

  const lancer = (minutes: number) => {
    const s = commencerUneSession(minutes, compterLesMots(p.corps.value), horloge());
    if (s === null) {
      p.enCours.hidden = false;
      p.enCours.textContent = "Cette durée n'est pas tenable. Entre entre 1 et 240 minutes.";
      return;
    }
    session = s;
    if (tictac !== undefined) clearInterval(tictac);
    tictac = setInterval(direLaSession, 1000);
    direLaSession();
    for (const b of p.durees.querySelectorAll("[aria-pressed]")) {
      b.setAttribute(
        "aria-pressed",
        b.getAttribute("data-minutes") === String(minutes) ? "true" : "false",
      );
    }
  };

  for (const minutes of DUREES) {
    const bouton = r.doc.createElement("button");
    bouton.type = "button";
    bouton.className = "wm-ecrire__duree";
    bouton.textContent = minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`;
    bouton.setAttribute("aria-pressed", "false");
    bouton.setAttribute("data-minutes", String(minutes));
    bouton.addEventListener("click", () => lancer(minutes));
    p.durees.append(bouton);
  }

  const libre = r.doc.createElement("button");
  libre.type = "button";
  libre.className = "wm-ecrire__duree";
  libre.textContent = "à moi de dire";
  libre.setAttribute("data-wm-ecrire-libre", "");
  libre.addEventListener("click", () => {
    const dit = globalThis.prompt("Combien de minutes ?", "90");
    if (dit === null) return;
    lancer(Number(dit));
  });
  p.durees.append(libre);

  // ── et on charge ─────────────────────────────────────────────────

  //  ── ON NE CHARGE QU'EN OUVRANT L'ONGLET, ET UNE SEULE FOIS ──────
  //
  //  La note du carnet dit « un seul appel au chargement » et « changer
  //  d'onglet ne déclenche aucune requête ». Les brouillons tiennent la
  //  première règle et s'écartent de la seconde, exprès :
  //
  //  · les prendre dans l'appel du carnet ferait descendre trois textes
  //    de RP — plusieurs kilo-octets — à chaque ouverture, pour
  //    quelqu'un qui vient regarder son équipe ;
  //  · et il faut qu'ils soient FRAIS : un brouillon écrit sur le
  //    téléphone il y a une heure ne doit pas revenir d'avant.
  //
  //  Donc une requête, la première fois qu'on ouvre Écrire, et plus
  //  jamais ensuite. C'est mesuré dans les deux sens.
  let charge = false;
  const charger = () => {
    if (charge) return;
    charge = true;
    void (async () => {
      const lus = await lireLesBrouillons(r.acces, r.jeton);
      if (lus !== null) brouillons = lus;
      ouvrirLaPlace(brouillons[0]?.place ?? 1);
    })();
  };

  peindreLesPlaces();
  peindreLaTete();
  for (const lien of r.doc.querySelectorAll('[data-wm-carnet-onglet="ecrire"]')) {
    lien.addEventListener("click", charger);
  }
  if (globalThis.location?.hash === "#ecrire") charger();

  return true;
}
