/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/liens.ts
//
//  COUVERT PAR : outils/carnet.mjs — l'ajout, l'ordre, l'état de la
//  fiche, et la publication qui ouvre le formulaire natif au lieu de
//  poster.
//
//  Note de code `397:1564` : « Le carnet écrit la fiche, le joueur la
//  publie ».
//
//  ── LE BOUTON NE POSTE PAS, ET C'EST LE CŒUR ────────────────────────
//
//  « Il pourrait poster, il a les identifiants. Mais la fiche serait
//  signée d'un robot, le joueur ne pourrait plus l'éditer lui-même, et
//  ce n'est plus sa page. Une seconde de clic vaut mieux que ça. »
//
//  Donc : le texte est copié, le formulaire natif s'ouvre — en création
//  la première fois, en édition ensuite — et la personne relit, envoie,
//  puis revient dire où c'est parti. C'est à ce moment-là seulement que
//  `fiche_est_publiee` fige l'empreinte.
//
//  ── LA FABRIQUE N'EST PAS ICI ───────────────────────────────────────
//
//  Le BBCode vient de `fiche_en_bbcode`, dans la base (0034). Cette
//  page ne le construit pas, ne le modifie pas et ne choisit pas ce qui
//  y entre : si le tri sur `affiche` vivait ici, un défaut d'une ligne
//  publierait ce que quelqu'un avait éteint.
// ════════════════════════════════════════════════════════════════════

import type { ConfigSupabase } from "./registre.ts";
import { appelerAvecLeJeton } from "./auth-supabase.ts";
import { adresseDuSujet } from "../../navigateur/tableau-des-rp.ts";

export type Lien = {
  cible_forum_id: number;
  cible_pseudo: string;
  court: string;
  long: string;
  image: string;
  ordre: number;
};

export type EtatDeLaFiche = {
  texte: string;
  empreinte: string;
  sujetId: number | null;
  messageId: number | null;
  publieLe: string | null;
  aChange: boolean;
};

/** Où envoyer le joueur pour publier, selon ce qui existe déjà.
 *
 *  PREMIÈRE FOIS : un nouveau sujet dans le forum des fiches. ENSUITE :
 *  l'édition de SON message, pas une réponse — sinon la fiche se
 *  retrouve en trois morceaux au fil des mises à jour, et personne ne
 *  sait plus laquelle lire. */
export const FORUM_DES_FICHES = 46;

export function adresseDePublication(e: EtatDeLaFiche | null): string {
  const message = e === null ? null : e.messageId;
  if (message !== null) return `/post?p=${message}&mode=editpost`;
  return `/post?f=${FORUM_DES_FICHES}&mode=newtopic`;
}

/** Ce que le bandeau dit, selon l'état. */
export function motDeLEtat(e: EtatDeLaFiche | null): string {
  if (e === null || e.publieLe === null) return "Ta fiche n'est pas encore publiée.";
  if (e.aChange) return "Ta fiche a changé depuis que tu l'as publiée.";
  return "Ta fiche publiée est à jour.";
}

export function motDuBouton(e: EtatDeLaFiche | null): string {
  if (e === null || e.publieLe === null) return "Publier ma fiche";
  return "Mettre à jour ma fiche";
}

// ── l'écran ────────────────────────────────────────────────────────

export type ReglagesLiens = {
  readonly doc: Document;
  readonly acces: ConfigSupabase;
  readonly jeton: string;
  readonly joueurId: string;
  readonly forumUserId: number;
};

const ATTENTE_MS = 2000;

async function rest(
  r: ReglagesLiens,
  chemin: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; corps: unknown }> {
  const reponse = await fetch(`${r.acces.url}/rest/v1/${chemin}`, {
    credentials: "omit",
    ...options,
    headers: {
      apikey: r.acces.clePubliable,
      Authorization: `Bearer ${r.jeton}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  }).catch(() => null);
  if (reponse === null || !reponse.ok) {
    console.error("wm/liens :", chemin, "→", reponse?.status);
    return { ok: false, corps: null };
  }
  const corps = reponse.status === 204 ? null : await reponse.json().catch(() => null);
  return { ok: true, corps };
}

export function poserLesLiens(r: ReglagesLiens): boolean {
  const doc = r.doc;
  const q = <T extends HTMLElement>(s: string) => doc.querySelector<T>(s);
  const cartes = q("[data-wm-liens-cartes]");
  const compte = q("[data-wm-liens-compte]");
  const etatDit = q("[data-wm-liens-etat]");
  const etatSous = q("[data-wm-liens-etat-dit]");
  const voir = q<HTMLAnchorElement>("[data-wm-liens-voir]");
  const publier = q<HTMLButtonElement>("[data-wm-liens-publier]");
  if (
    cartes === null || compte === null || etatDit === null ||
    etatSous === null || voir === null || publier === null
  ) {
    console.error("wm/liens : la page n'a pas toutes ses pièces");
    return false;
  }

  let liens: Lien[] = [];
  let etat: EtatDeLaFiche | null = null;

  const peindreLEtat = () => {
    etatDit.textContent = motDeLEtat(etat);
    publier.textContent = motDuBouton(etat);
    const sujet = etat === null ? null : etat.sujetId;
    voir.hidden = sujet === null;
    if (sujet !== null) voir.href = adresseDuSujet(sujet);
    etatSous.textContent = etat === null || etat.publieLe === null
      ? "Le bouton copie le texte et ouvre le formulaire du forum. C'est toi qui envoies."
      : `Publiée le ${new Date(etat.publieLe).toLocaleDateString("fr-FR")}. ` +
        "Mettre à jour rouvre ton message avec le nouveau contenu — tu relis, tu valides.";
  };

  const peindreLesCartes = () => {
    compte.textContent = liens.length === 0
      ? ""
      : `${liens.length} lien${liens.length > 1 ? "s" : ""}`;
    cartes.textContent = "";
    if (liens.length === 0) {
      const vide = doc.createElement("p");
      vide.className = "wm-liens__vide";
      vide.textContent = "Aucun lien pour l'instant.";
      cartes.append(vide);
      return;
    }
    liens.forEach((l, i) => {
      const li = doc.createElement("li");
      li.className = "wm-liens__carte";
      li.setAttribute("data-wm-liens-carte", String(l.cible_forum_id));

      if (l.image !== "" && l.image.startsWith("https://")) {
        const img = doc.createElement("img");
        img.className = "wm-liens__carte-image";
        img.src = l.image;
        img.alt = "";
        li.append(img);
      }

      const corps = doc.createElement("div");
      corps.className = "wm-liens__carte-corps";
      const tete = doc.createElement("div");
      tete.className = "wm-liens__carte-tete";
      const nom = doc.createElement("span");
      nom.className = "wm-liens__carte-nom";
      nom.textContent = l.cible_pseudo !== "" ? l.cible_pseudo : `Membre ${l.cible_forum_id}`;
      tete.append(nom);
      if (l.court !== "") {
        const court = doc.createElement("span");
        court.className = "wm-liens__carte-court";
        court.textContent = l.court;
        tete.append(court);
      }

      const long = doc.createElement("textarea");
      long.className = "wm-liens__carte-long";
      long.value = l.long;
      long.placeholder = "Ce qu'il y a entre eux, en quelques lignes.";
      long.setAttribute("aria-label", `La description du lien avec ${nom.textContent}`);
      let minuteur: ReturnType<typeof setTimeout> | undefined;
      long.addEventListener("input", () => {
        if (minuteur !== undefined) clearTimeout(minuteur);
        minuteur = setTimeout(() => {
          l.long = long.value;
          void rest(r, `lien?cible_forum_id=eq.${l.cible_forum_id}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ long: long.value }),
          }).then(relireLEtat);
        }, ATTENTE_MS);
      });

      //  LES FLÈCHES PLUTÔT QUE LE GLISSER-DÉPOSER. La note demande le
      //  glisser, « avec un menu monter / descendre en repli ». Le repli
      //  est ici, et il marche au clavier, au doigt et à la souris ; le
      //  glisser viendra par-dessus sans rien changer aux données.
      const outils = doc.createElement("div");
      outils.className = "wm-liens__carte-outils";
      const monter = doc.createElement("button");
      monter.type = "button";
      monter.textContent = "↑ monter";
      monter.disabled = i === 0;
      monter.addEventListener("click", () => void deplacer(i, -1));
      const descendre = doc.createElement("button");
      descendre.type = "button";
      descendre.textContent = "↓ descendre";
      descendre.disabled = i === liens.length - 1;
      descendre.addEventListener("click", () => void deplacer(i, 1));
      const oter = doc.createElement("button");
      oter.type = "button";
      oter.textContent = "retirer";
      oter.addEventListener("click", () => {
        void (async () => {
          await rest(r, `lien?cible_forum_id=eq.${l.cible_forum_id}`, {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          });
          liens = liens.filter((x) => x.cible_forum_id !== l.cible_forum_id);
          peindreLesCartes();
          await relireLEtat();
        })();
      });
      outils.append(monter, descendre, oter);

      corps.append(tete, long, outils);
      li.append(corps);
      cartes.append(li);
    });
  };

  /** L'ordre de cette liste EST celui de la fiche : on réécrit les deux
   *  rangs échangés, pas la liste entière. */
  const deplacer = async (i: number, pas: number) => {
    const j = i + pas;
    if (j < 0 || j >= liens.length) return;
    const a = liens[i];
    const b = liens[j];
    [a.ordre, b.ordre] = [b.ordre, a.ordre];
    liens = [...liens].sort((x, y) => x.ordre - y.ordre || x.cible_forum_id - y.cible_forum_id);
    peindreLesCartes();
    await Promise.all([a, b].map((l) =>
      rest(r, `lien?cible_forum_id=eq.${l.cible_forum_id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ ordre: l.ordre }),
      })
    ));
    await relireLEtat();
  };

  const relireLEtat = async () => {
    const reponse = await appelerAvecLeJeton(r.acces, r.jeton, "fiche_a_publier", {
      forumUserId: r.forumUserId,
    }).catch(() => null);
    if (reponse === null || !reponse.ok) return;
    const lu = await reponse.json().catch(() => null);
    etat = (lu ?? null) as EtatDeLaFiche | null;
    peindreLEtat();
  };

  // ── ajouter ──────────────────────────────────────────────────────

  q("[data-wm-liens-ajouter]")?.addEventListener("click", () => {
    const pseudo = q<HTMLInputElement>("[data-wm-liens-neuf-pseudo]");
    const id = q<HTMLInputElement>("[data-wm-liens-neuf-id]");
    const court = q<HTMLInputElement>("[data-wm-liens-neuf-court]");
    if (pseudo === null || id === null || court === null) return;
    const cible = Number(id.value);
    if (!Number.isInteger(cible) || cible <= 0) {
      id.setCustomValidity("Il faut le numéro de membre, celui de son profil.");
      id.reportValidity();
      return;
    }
    id.setCustomValidity("");
    if (liens.some((l) => l.cible_forum_id === cible)) {
      id.setCustomValidity("Tu as déjà un lien avec cette personne.");
      id.reportValidity();
      return;
    }
    void (async () => {
      const neuf: Lien = {
        cible_forum_id: cible,
        cible_pseudo: pseudo.value.trim().slice(0, 60),
        court: court.value.trim().slice(0, 60),
        long: "",
        image: "",
        ordre: liens.length,
      };
      const fait = await rest(r, "lien", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ joueur_id: r.joueurId, ...neuf }),
      });
      if (!fait.ok) return;
      liens = [...liens, neuf];
      pseudo.value = "";
      id.value = "";
      court.value = "";
      peindreLesCartes();
      await relireLEtat();
    })();
  });

  // ── publier ──────────────────────────────────────────────────────

  publier.addEventListener("click", () => {
    void (async () => {
      await relireLEtat();
      if (etat === null) return;
      //  LE TEXTE VIENT DE LA BASE, ET IL EST COPIÉ — pas mis dans
      //  l'adresse : une fiche dépasse de loin ce qu'une URL supporte,
      //  et elle finirait dans les journaux du serveur.
      await navigator.clipboard?.writeText(etat.texte).catch(() => {});
      etatSous.textContent =
        "Le texte est copié. Colle-le dans le formulaire qui s'ouvre, relis, et envoie.";
      globalThis.open(adresseDePublication(etat), "_blank", "noopener");
      //  PUIS LA PERSONNE REVIENT DIRE OÙ C'EST PARTI. On ne devine pas :
      //  le carnet ne voit pas ce qui a été posté, et se déclarer publié
      //  tout seul serait mentir dès le premier échec d'envoi.
      const sujet = globalThis.prompt(
        "Une fois publiée : le numéro du sujet (celui de l'adresse, après le t).",
        etat.sujetId === null ? "" : String(etat.sujetId),
      );
      if (sujet === null || sujet.trim() === "") return;
      const message = globalThis.prompt(
        "Et le numéro de ton message, pour pouvoir le rouvrir ensuite (après le p= dans « Éditer »).",
        etat.messageId === null ? "" : String(etat.messageId),
      );
      const fait = await appelerAvecLeJeton(r.acces, r.jeton, "fiche_est_publiee", {
        forumUserId: r.forumUserId,
        sujetId: Number(sujet) || 0,
        messageId: Number(message) || 0,
      }).catch(() => null);
      if (fait === null || !fait.ok) {
        etatSous.textContent = "Le carnet n'a pas pu retenir où ta fiche est partie.";
        return;
      }
      await relireLEtat();
    })();
  });

  // ── et on charge, à la première ouverture ────────────────────────

  let charge = false;
  const charger = () => {
    if (charge) return;
    charge = true;
    void (async () => {
      const lus = await rest(r, "lien?select=*&order=ordre,cible_forum_id");
      if (Array.isArray(lus.corps)) liens = lus.corps as Lien[];
      peindreLesCartes();
      await relireLEtat();
    })();
  };

  peindreLEtat();
  peindreLesCartes();
  for (const l of doc.querySelectorAll('[data-wm-carnet-onglet="mes-liens"]')) {
    l.addEventListener("click", charger);
  }
  if (globalThis.location?.hash === "#mes-liens") charger();

  return true;
}
