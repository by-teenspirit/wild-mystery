/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/rp.ts
//
//  COUVERT PAR : outils/carnet.mjs — le tableau, les filtres, l'état
//  qu'on pose, et la carte « prévue » qu'on ajoute.
//
//  LE TABLEAU EST REMPLI PAR LA RELÈVE. Cette page lit, filtre, et
//  écrit DEUX colonnes : `etat` et `ordre`. Ce n'est pas une politesse
//  — le droit PostgreSQL ne lui en accorde pas plus (0037), et un
//  PATCH sur le titre se fait refuser par la base.
// ════════════════════════════════════════════════════════════════════

import type { ConfigSupabase } from "./registre.ts";
import {
  adresseDuSujet,
  etatVu,
  garderLesRp,
  type LigneDeRp,
  MOTS,
  rangerLesRp,
  sujetDeLAdresse,
} from "../../navigateur/tableau-des-rp.ts";

export type ReglagesRp = {
  readonly doc: Document;
  readonly acces: ConfigSupabase;
  readonly jeton: string;
  readonly joueurId: string;
  readonly pseudo: string;
};

const ETATS: readonly { readonly clef: string; readonly mot: string }[] = [
  { clef: "en-cours", mot: "en cours" },
  { clef: "prevu", mot: "prévu" },
  { clef: "en-pause", mot: "en pause" },
  { clef: "cloture", mot: "clôturé" },
];

async function rest(
  r: ReglagesRp,
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
    console.error("wm/rp :", chemin, "→", reponse?.status);
    return { ok: false, corps: null };
  }
  const corps = reponse.status === 204 ? null : await reponse.json().catch(() => null);
  return { ok: true, corps };
}

export function poserLesRp(r: ReglagesRp): boolean {
  const doc = r.doc;
  const liste = doc.querySelector<HTMLElement>("[data-wm-rp-liste]");
  const compte = doc.querySelector("[data-wm-rp-compte]");
  const dit = doc.querySelector("[data-wm-rp-dit]");
  if (liste === null || compte === null || dit === null) {
    console.error("wm/rp : la page n'a pas toutes ses pièces");
    return false;
  }

  const tableau = doc.querySelector<HTMLElement>("[data-wm-rp-tableau]");
  if (tableau === null) {
    console.error("wm/rp : la page n'a pas le tableau");
    return false;
  }

  let lignes: LigneDeRp[] = [];
  let filtre = "tous";
  let vue = "tableau";

  /** Poser un état, d'où qu'il vienne — du menu ou d'un dépôt.
   *
   *  LE MÊME CHEMIN POUR LES DEUX : glisser est un raccourci, pas une
   *  seconde façon d'écrire. Deux chemins qui écrivent la même chose
   *  finissent par ne plus écrire la même chose. */
  const poserLEtat = async (sujetId: number, etat: string): Promise<boolean> => {
    const fait = await rest(r, `rp?sujet_id=eq.${sujetId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ etat }),
    });
    if (!fait.ok) {
      dit.textContent = "Cet état n'a pas pu être enregistré.";
      return false;
    }
    lignes = lignes.map((x) => (x.sujetId === sujetId ? { ...x, etat } : x));
    peindre();
    return true;
  };

  const peindreLeTableau = (): void => {
    tableau.textContent = "";
    for (const colonne of ETATS) {
      const dedans = rangerLesRp(lignes.filter((l) => l.etat === colonne.clef));
      const bloc = doc.createElement("div");
      bloc.className = "wm-rp__colonne";
      bloc.setAttribute("data-wm-rp-colonne", colonne.clef);

      const tete = doc.createElement("p");
      tete.className = "wm-rp__colonne-tete";
      const nom = doc.createElement("span");
      nom.textContent = colonne.mot;
      const nb = doc.createElement("span");
      nb.textContent = String(dedans.length);
      tete.append(nom, nb);
      bloc.append(tete);

      if (dedans.length === 0) {
        const vide = doc.createElement("p");
        vide.className = "wm-rp__colonne-vide";
        vide.textContent = "—";
        bloc.append(vide);
      }

      for (const l of dedans) {
        const vu = etatVu(l, r.pseudo);
        const carte = doc.createElement("article");
        carte.className = "wm-rp__carte";
        carte.draggable = true;
        carte.setAttribute("data-wm-rp-carte", String(l.sujetId));
        const titre = doc.createElement("span");
        titre.className = "wm-rp__carte-titre";
        titre.textContent = l.titre === "" ? `Sujet ${l.sujetId}` : l.titre;
        const pied = doc.createElement("div");
        pied.className = "wm-rp__carte-pied";
        const etiquette = doc.createElement("span");
        etiquette.className = "wm-rp__etat" +
          (vu === "a-moi" || vu === "neuf" ? " wm-rp__etat--a-moi" : "");
        etiquette.textContent = MOTS[vu];
        const quand = doc.createElement("span");
        quand.className = "wm-rp__quand";
        quand.textContent = l.dernierLe === null
          ? "—"
          : new Date(l.dernierLe).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          });
        pied.append(etiquette, quand);
        carte.append(titre, pied);

        carte.addEventListener("dragstart", (e) => {
          (e as DragEvent).dataTransfer?.setData("text/plain", String(l.sujetId));
        });
        bloc.append(carte);
      }

      //  LE DÉPÔT EST UN RACCOURCI, ET LA LISTE RESTE LE CHEMIN SÛR :
      //  glisser-déposer ne marche ni au clavier ni au lecteur
      //  d'écran, et la maquette elle-même demandait « un menu monter
      //  / descendre en repli ». Ici le repli est la vue liste, qui
      //  porte le même menu d'état sur chaque ligne.
      bloc.addEventListener("dragover", (e) => {
        e.preventDefault();
        bloc.setAttribute("data-wm-survol", "");
      });
      bloc.addEventListener("dragleave", () => bloc.removeAttribute("data-wm-survol"));
      bloc.addEventListener("drop", (e) => {
        e.preventDefault();
        bloc.removeAttribute("data-wm-survol");
        const dit = (e as DragEvent).dataTransfer?.getData("text/plain") ?? "";
        const sujetId = Number(dit);
        if (!Number.isInteger(sujetId) || sujetId <= 0) return;
        const avant = lignes.find((l) => l.sujetId === sujetId);
        //  UN DÉPÔT DANS SA PROPRE COLONNE N'ÉCRIT RIEN : sans ce
        //  test, lâcher une carte où on l'a prise ferait une requête
        //  pour ne rien changer.
        if (avant === undefined || avant.etat === colonne.clef) return;
        void poserLEtat(sujetId, colonne.clef);
      });

      tableau.append(bloc);
    }
  };

  const peindre = (): void => {
    tableau.hidden = vue !== "tableau";
    liste.hidden = vue !== "liste";
    if (vue === "tableau") peindreLeTableau();
    const vues = rangerLesRp(garderLesRp(lignes, filtre, r.pseudo));
    const aMoi = lignes.filter((l) => {
      const v = etatVu(l, r.pseudo);
      return v === "a-moi" || v === "neuf";
    }).length;
    compte.textContent = lignes.length === 0
      ? "Rien pour l'instant. La relève remplit ce tableau une fois par heure."
      : `${lignes.length} RP, dont ${aMoi} où c'est à toi d'écrire.`;

    liste.textContent = "";
    for (const l of vues) {
      const vu = etatVu(l, r.pseudo);
      const li = doc.createElement("li");
      li.className = "wm-rp__ligne";
      li.setAttribute("data-wm-rp-sujet", String(l.sujetId));

      const mot = doc.createElement("div");
      mot.className = "wm-rp__mot";
      const titre = doc.createElement("a");
      titre.className = "wm-rp__titre";
      titre.textContent = l.titre === "" ? `Sujet ${l.sujetId}` : l.titre;
      //  LE LIEN VA AU DERNIER MESSAGE quand on le connaît : relire la
      //  première page d'un RP de quarante réponses pour retrouver où
      //  on en était, c'est le geste qu'on vient éviter.
      titre.href = adresseDuSujet(l.sujetId, l.dernierMessage);
      const lieu = doc.createElement("span");
      lieu.className = "wm-rp__lieu";
      lieu.textContent = l.forumNom === ""
        ? `${l.reponses} réponses`
        : `${l.forumNom} · ${l.reponses} réponses`;
      mot.append(titre, lieu);
      if (l.extrait !== "") {
        const extrait = doc.createElement("span");
        extrait.className = "wm-rp__extrait";
        extrait.textContent = `« ${l.extrait} »`;
        mot.append(extrait);
      }

      const etiquette = doc.createElement("span");
      etiquette.className = "wm-rp__etat" +
        (vu === "a-moi" || vu === "neuf" ? " wm-rp__etat--a-moi" : "");
      etiquette.textContent = MOTS[vu];

      const quand = doc.createElement("span");
      quand.className = "wm-rp__quand";
      quand.textContent = l.dernierLe === null
        ? "—"
        : new Date(l.dernierLe).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

      const outils = doc.createElement("div");
      outils.className = "wm-rp__outils";
      const choix = doc.createElement("select");
      choix.setAttribute("aria-label", `L'état de « ${titre.textContent} »`);
      for (const e of ETATS) {
        const o = doc.createElement("option");
        o.value = e.clef;
        o.textContent = e.mot;
        o.selected = e.clef === l.etat;
        choix.append(o);
      }
      choix.addEventListener("change", () => {
        void (async () => {
          const fait = await rest(r, `rp?sujet_id=eq.${l.sujetId}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ etat: choix.value }),
          });
          if (!fait.ok) {
            dit.textContent = "Cet état n'a pas pu être enregistré.";
            return;
          }
          lignes = lignes.map((x) => x.sujetId === l.sujetId ? { ...x, etat: choix.value } : x);
          peindre();
        })();
      });
      outils.append(choix);

      //  ON N'EFFACE QU'UNE CARTE PRÉVUE, et la base le tient aussi
      //  (0037). Le bouton n'apparaît pas ailleurs pour la même raison
      //  qu'on ne grise pas : proposer un geste qui sera refusé
      //  apprend à se méfier de l'écran.
      if (l.etat === "prevu") {
        const oter = doc.createElement("button");
        oter.type = "button";
        oter.textContent = "retirer";
        oter.addEventListener("click", () => {
          void (async () => {
            await rest(r, `rp?sujet_id=eq.${l.sujetId}`, {
              method: "DELETE",
              headers: { Prefer: "return=minimal" },
            });
            lignes = lignes.filter((x) => x.sujetId !== l.sujetId);
            peindre();
          })();
        });
        outils.append(oter);
      }

      li.append(mot, etiquette, quand, outils);
      liste.append(li);
    }
  };

  for (const b of doc.querySelectorAll("[data-wm-rp-vue]")) {
    b.addEventListener("click", () => {
      vue = b.getAttribute("data-wm-rp-vue") ?? "tableau";
      for (const autre of doc.querySelectorAll("[data-wm-rp-vue]")) {
        autre.setAttribute("aria-pressed", autre === b ? "true" : "false");
      }
      //  LES FILTRES NE SERVENT QU'À LA LISTE : le tableau montre déjà
      //  tout, rangé par colonnes. Les laisser visibles donnerait des
      //  colonnes à moitié vides sans qu'on comprenne pourquoi.
      const filtres = doc.querySelector<HTMLElement>("[data-wm-rp-filtres]");
      if (filtres !== null) filtres.hidden = vue === "tableau";
      peindre();
    });
  }
  const filtresAuDepart = doc.querySelector<HTMLElement>("[data-wm-rp-filtres]");
  if (filtresAuDepart !== null) filtresAuDepart.hidden = true;

  for (const b of doc.querySelectorAll("[data-wm-rp-filtre]")) {
    b.addEventListener("click", () => {
      filtre = b.getAttribute("data-wm-rp-filtre") ?? "tous";
      for (const autre of doc.querySelectorAll("[data-wm-rp-filtre]")) {
        autre.setAttribute("aria-pressed", autre === b ? "true" : "false");
      }
      peindre();
    });
  }

  doc.querySelector("[data-wm-rp-ajouter]")?.addEventListener("click", () => {
    const adresse = doc.querySelector<HTMLInputElement>("[data-wm-rp-neuf-adresse]");
    const titre = doc.querySelector<HTMLInputElement>("[data-wm-rp-neuf-titre]");
    if (adresse === null || titre === null) return;
    const sujetId = sujetDeLAdresse(adresse.value);
    if (sujetId === null) {
      //  SANS SUJET, PAS DE CARTE : la clé est (joueur, sujet), et un
      //  titre seul n'en fait pas une. Le dire plutôt que de laisser
      //  la base répondre par une erreur que personne ne lit.
      dit.textContent =
        "Il me faut l'adresse du sujet — celle qui contient un « t » suivi d'un numéro.";
      return;
    }
    if (lignes.some((l) => l.sujetId === sujetId)) {
      dit.textContent = "Ce RP est déjà dans ton tableau.";
      return;
    }
    void (async () => {
      const neuf: LigneDeRp = {
        sujetId,
        titre: titre.value.trim().slice(0, 160),
        forumNom: "",
        reponses: 0,
        dernierLe: null,
        dernierAuteur: "",
        dernierMessage: null,
        extrait: "",
        etat: "prevu",
        ordre: 0,
      };
      const fait = await rest(r, "rp", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          joueur_id: r.joueurId,
          sujet_id: sujetId,
          titre: neuf.titre,
          etat: "prevu",
        }),
      });
      if (!fait.ok) {
        dit.textContent = "Cette carte n'a pas pu être ajoutée.";
        return;
      }
      lignes = [...lignes, neuf];
      adresse.value = "";
      titre.value = "";
      dit.textContent = "Ajouté. Dès que tu y écriras, la relève le remplira.";
      peindre();
    })();
  });

  let charge = false;
  const charger = (): void => {
    if (charge) return;
    charge = true;
    void (async () => {
      const lus = await rest(r, "rp?select=*&order=ordre,dernier_le.desc");
      if (Array.isArray(lus.corps)) {
        lignes = (lus.corps as Record<string, unknown>[]).map((c) => ({
          sujetId: Number(c.sujet_id),
          titre: String(c.titre ?? ""),
          forumNom: String(c.forum_nom ?? ""),
          reponses: Number(c.reponses ?? 0),
          dernierLe: typeof c.dernier_le === "string" ? c.dernier_le : null,
          dernierAuteur: String(c.dernier_auteur ?? ""),
          dernierMessage: typeof c.dernier_message === "number" ? c.dernier_message : null,
          extrait: String(c.extrait ?? ""),
          etat: String(c.etat ?? "en-cours"),
          ordre: Number(c.ordre ?? 0),
        }));
      }
      peindre();
    })();
  };

  peindre();
  for (const l of doc.querySelectorAll('[data-wm-carnet-onglet="mes-rp"]')) {
    l.addEventListener("click", charger);
  }
  if (globalThis.location?.hash === "#mes-rp") charger();

  return true;
}
