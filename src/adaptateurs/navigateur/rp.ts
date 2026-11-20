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
  familleDuForum,
  garderLesRp,
  type LigneDeRp,
  MOTS,
  rangerLesRp,
  sujetDeLAdresse,
  type TableDesForums,
} from "../../navigateur/tableau-des-rp.ts";

export type ReglagesRp = {
  readonly doc: Document;
  readonly acces: ConfigSupabase;
  readonly jeton: string;
  readonly joueurId: string;
  readonly pseudo: string;
  //  LA RACINE DES DONNÉES, pour `carte.json` et `forums.json` — les
  //  deux fichiers qui donnent son tag à un RP. Facultative : sans
  //  elle, les cartes s'affichent sans tag, et rien d'autre ne change.
  readonly racine?: string | null;
};

/** Le tag d'un forum, lu une fois au chargement.
 *
 *  DEUX FICHIERS, PARCE QU'IL Y A DEUX VÉRITÉS : `carte.json` sait ce
 *  qu'est un lieu de Rhode — zone, ville, ligue — et c'est lui qui
 *  décide, puisque c'est lui qui dessine la carte. `forums.json` ne
 *  porte que ce qui n'est pas un lieu : le reste du monde, le voyage
 *  dans le temps, le Messenger. Recopier les vingt-six premiers dans
 *  le second ferait deux listes pour une même vérité. */
async function lireLesForums(racine: string | null | undefined): Promise<TableDesForums> {
  if (racine === undefined || racine === null || racine === "") return {};
  const lire = async (nom: string): Promise<unknown> => {
    const reponse = await fetch(`${racine}${nom}`, { credentials: "omit" }).catch(() => null);
    if (reponse === null || !reponse.ok) return null;
    return await reponse.json().catch(() => null);
  };
  const [carte, forums] = await Promise.all([lire("carte.json"), lire("forums.json")]);
  const mots = (forums as { mots?: Record<string, string> } | null)?.mots ?? {};
  const table: Record<number, string> = {};
  for (const l of (carte as { lieux?: unknown[] } | null)?.lieux ?? []) {
    const o = l as { forumId?: unknown; type?: unknown };
    if (typeof o.forumId !== "number" || typeof o.type !== "string") continue;
    const mot = mots[o.type];
    if (mot !== undefined) table[o.forumId] = mot;
  }
  for (const f of (forums as { hors_carte?: unknown[] } | null)?.hors_carte ?? []) {
    const o = f as { forumId?: unknown; type?: unknown };
    if (typeof o.forumId !== "number" || typeof o.type !== "string") continue;
    const mot = mots[o.type];
    if (mot !== undefined) table[o.forumId] = mot;
  }
  return table;
}

//  L'ORDRE EST CELUI DE CALLISTA, 20 novembre : « la première colonne :
//  prévu. et ensuite, en cours. » Ce qui n'a pas commencé d'abord, ce
//  qui vit ensuite, et ce qui s'est arrêté à la fin.
//
//  `solo` EST UNE COLONNE ET PAS UNE DÉDUCTION : le jeu poste lui-même
//  dans les sujets de zone sauvage, donc compter les participants
//  rangerait toutes les fouilles hors du solo (0058).
const ETATS: readonly { readonly clef: string; readonly mot: string }[] = [
  { clef: "prevu", mot: "prévu" },
  { clef: "en-cours", mot: "en cours" },
  { clef: "solo", mot: "solo" },
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

  //  LES DEUX TABLES SONT VIDES TANT QU'ELLES N'ONT PAS RÉPONDU, et la
  //  page se peint quand même : un tag qui manque ou un compagnon qui
  //  n'est pas encore là n'empêche pas de lire ses RP.
  let forums: TableDesForums = {};
  const compagnons = new Map<number, string[]>();
  //  LES NOMS DE COLONNES, par clé d'état. Vide au départ : une
  //  colonne sans entrée porte son mot par défaut.
  const noms = new Map<string, string>();

  const tableau = doc.querySelector<HTMLElement>("[data-wm-rp-tableau]");
  if (tableau === null) {
    console.error("wm/rp : la page n'a pas le tableau");
    return false;
  }

  let lignes: LigneDeRp[] = [];
  let filtre = "tous";
  let vue = "tableau";
  let clotures = true;

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

  /** Écrire le nom qu'on donne à une colonne.
   *
   *  UN UPSERT ET PAS UN PATCH : la première fois qu'on renomme, la
   *  ligne n'existe pas. `merge-duplicates` fait les deux cas en une
   *  requête, sans avoir à demander d'abord si elle est là. */
  const poserLeNom = async (clef: string, nom: string): Promise<void> => {
    const fait = await rest(r, "rp_colonne", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ joueur_id: r.joueurId, etat: clef, nom }),
    });
    if (!fait.ok) {
      dit.textContent = "Ce nom de colonne n'a pas pu être enregistré.";
      return;
    }
    noms.set(clef, nom);
    peindre();
  };

  /** Rendre à une colonne son mot par défaut.
   *
   *  ON EFFACE LA LIGNE AU LIEU D'Y ÉCRIRE LE MOT PAR DÉFAUT : le jour
   *  où un mot change dans `ETATS`, une colonne jamais renommée doit
   *  suivre, et une ligne qui recopie l'ancien mot ne suivrait pas. */
  const oublierLeNom = async (clef: string): Promise<void> => {
    const fait = await rest(
      r,
      `rp_colonne?joueur_id=eq.${r.joueurId}&etat=eq.${clef}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    );
    if (!fait.ok) {
      dit.textContent = "Ce nom de colonne n'a pas pu être effacé.";
      return;
    }
    noms.delete(clef);
    peindre();
  };

  //  ── L'AFFICHAGE EN GRAND ────────────────────────────────────────
  //
  //  UN SEUL DIALOGUE POUR TOUTES LES CARTES, rempli à l'ouverture :
  //  cinquante dialogues dans la page, un par RP, feraient cinquante
  //  champs de texte dans l'ordre de tabulation pour un seul ouvert.
  const grand = doc.querySelector<HTMLDialogElement>("[data-wm-rp-grand]");
  const g = (quoi: string): HTMLElement | null =>
    grand?.querySelector<HTMLElement>(`[data-wm-rp-grand-${quoi}]`) ?? null;

  const ouvrirEnGrand = (sujetId: number): void => {
    const l = lignes.find((x) => x.sujetId === sujetId);
    if (grand === null || l === undefined) return;

    const titre = g("titre");
    if (titre instanceof HTMLAnchorElement) {
      titre.textContent = l.titre === "" ? `Sujet ${l.sujetId}` : l.titre;
      titre.href = adresseDuSujet(l.sujetId, l.dernierMessage);
    }

    const lieu = g("lieu");
    if (lieu !== null) {
      lieu.textContent = "";
      const famille = familleDuForum(l.forumId, forums);
      if (famille !== null) {
        const tag = doc.createElement("span");
        tag.className = "wm-rp__tag";
        tag.setAttribute("data-wm-rp-tag", famille);
        tag.textContent = famille;
        lieu.append(tag);
      }
      if (l.forumNom !== "") {
        const ou = doc.createElement("span");
        ou.className = "wm-rp__carte-ou";
        ou.textContent = l.forumNom;
        lieu.append(ou);
      }
    }

    const avec = g("avec");
    if (avec !== null) {
      const qui = (compagnons.get(l.sujetId) ?? [])
        .filter((p) => p.trim() !== r.pseudo.trim());
      avec.textContent = qui.length === 0 ? "" : `avec ${qui.join(", ")}`;
      avec.hidden = qui.length === 0;
    }

    const extrait = g("extrait");
    if (extrait !== null) {
      extrait.textContent = l.extrait;
      extrait.hidden = l.extrait === "";
    }

    const champ = g("description");
    if (champ instanceof HTMLTextAreaElement) champ.value = l.description;
    const ditG = g("dit");
    if (ditG !== null) ditG.textContent = "";
    grand.setAttribute("data-wm-rp-grand-sujet", String(sujetId));
    grand.showModal();
  };

  if (grand !== null) {
    g("fermer")?.addEventListener("click", () => grand.close());
    g("garder")?.addEventListener("click", () => {
      const champ = g("description");
      const ditG = g("dit");
      const sujetId = Number(grand.getAttribute("data-wm-rp-grand-sujet"));
      if (!(champ instanceof HTMLTextAreaElement) || !Number.isInteger(sujetId)) return;
      //  LA BORNE EST CELLE DE LA BASE (600 signes, contrainte de la
      //  0059) : couper ici évite un refus que personne ne saurait
      //  lire, et le `maxlength` de la page dit déjà la même chose.
      const description = champ.value.slice(0, 600);
      void (async () => {
        const fait = await rest(r, `rp?sujet_id=eq.${sujetId}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ description }),
        });
        if (!fait.ok) {
          if (ditG !== null) ditG.textContent = "Ça n'a pas pu être enregistré.";
          return;
        }
        lignes = lignes.map((x) => (x.sujetId === sujetId ? { ...x, description } : x));
        if (ditG !== null) ditG.textContent = "Gardé.";
        peindre();
      })();
    });
  }

  const peindreLeTableau = (): void => {
    tableau.textContent = "";
    for (const colonne of ETATS) {
      //  LA COLONNE DES CLÔTURÉS SE REPLIE, et elle seule : c'est la
      //  seule qui ne demande rien et qui grossit sans fin.
      if (colonne.clef === "cloture" && !clotures) continue;
      const dedans = rangerLesRp(lignes.filter((l) => l.etat === colonne.clef));
      const bloc = doc.createElement("div");
      bloc.className = "wm-rp__colonne";
      bloc.setAttribute("data-wm-rp-colonne", colonne.clef);

      //  ── LE NOM DE LA COLONNE S'ÉCRIT ──────────────────────────
      //
      //  « L'idée était de changer le nom de la colonne, que chacun
      //  puisse la personnaliser. » C'est l'ÉTIQUETTE qui change, pas
      //  la clé : `etat` garde ses cinq mots, le tri ne bouge pas, et
      //  une carte déposée ici écrit toujours `colonne.clef`.
      //
      //  UN BOUTON ET PAS UN CHAMP TOUJOURS OUVERT : cinq champs de
      //  texte en haut du tableau attraperaient le focus à chaque
      //  tabulation, pour un geste qu'on fait une fois.
      const tete = doc.createElement("p");
      tete.className = "wm-rp__colonne-tete";
      const nom = doc.createElement("button");
      nom.type = "button";
      nom.className = "wm-rp__colonne-nom";
      nom.textContent = noms.get(colonne.clef) ?? colonne.mot;
      nom.title = "Renommer cette colonne";
      nom.setAttribute("data-wm-rp-renommer", colonne.clef);
      const nb = doc.createElement("span");
      nb.textContent = String(dedans.length);
      tete.append(nom, nb);
      bloc.append(tete);

      nom.addEventListener("click", () => {
        const champ = doc.createElement("input");
        champ.type = "text";
        champ.className = "wm-rp__colonne-champ";
        champ.maxLength = 24;
        champ.value = nom.textContent ?? "";
        champ.setAttribute("aria-label", "Le nom de cette colonne");
        //  LE VIDE REMET LE NOM D'ORIGINE, et c'est la seule façon de
        //  revenir en arrière sans un second bouton : une colonne sans
        //  ligne dans `rp_colonne` porte son nom par défaut.
        //
        //  UN VERROU, PARCE QUE SORTIR DU CHAMP LE FERME AUSSI :
        //  retirer du document l'élément qui a le focus déclenche
        //  `blur` dans plusieurs navigateurs, donc Entrée écrirait
        //  deux fois sans ce garde-fou.
        let ferme = false;
        const fini = (garder: boolean): void => {
          if (ferme) return;
          ferme = true;
          const mot = champ.value.trim().slice(0, 24);
          champ.replaceWith(nom);
          if (!garder) return;
          if (mot === "" || mot === colonne.mot) void oublierLeNom(colonne.clef);
          else void poserLeNom(colonne.clef, mot);
        };
        champ.addEventListener("keydown", (e) => {
          const touche = (e as KeyboardEvent).key;
          if (touche === "Enter") {
            e.preventDefault();
            fini(true);
          } else if (touche === "Escape") {
            e.preventDefault();
            fini(false);
          }
        });
        champ.addEventListener("blur", () => fini(true));
        nom.replaceWith(champ);
        champ.focus();
        champ.select();
      });

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

        //  ── LE TITRE MÈNE AU SUJET ────────────────────────────────
        //
        //  « On doit pouvoir cliquer sur notre rp pour pouvoir s'y
        //  rendre. » C'est une ancre, pas un `onclick` : on veut
        //  l'ouvrir dans un onglet, le copier, le voir visité. Et elle
        //  vise le DERNIER MESSAGE quand on le connaît — arriver en
        //  haut d'un sujet de cent messages n'aide personne.
        const titre = doc.createElement("a");
        titre.className = "wm-rp__carte-titre";
        titre.href = adresseDuSujet(l.sujetId, l.dernierMessage);
        titre.textContent = l.titre === "" ? `Sujet ${l.sujetId}` : l.titre;
        //  LE GLISSER-DÉPOSER L'EMPORTE SUR LE LIEN : sans ça, prendre
        //  une carte par son titre traîne l'adresse au lieu de la
        //  carte, et le dépôt ne comprend rien.
        titre.draggable = false;

        //  ── OÙ, ET DE QUELLE FAMILLE ──────────────────────────────
        const lieu = doc.createElement("p");
        lieu.className = "wm-rp__carte-lieu";
        const famille = familleDuForum(l.forumId, forums);
        if (famille !== null) {
          const tag = doc.createElement("span");
          tag.className = "wm-rp__tag";
          tag.setAttribute("data-wm-rp-tag", famille);
          tag.textContent = famille;
          lieu.append(tag);
        }
        if (l.forumNom !== "") {
          const ou = doc.createElement("span");
          ou.className = "wm-rp__carte-ou";
          ou.textContent = l.forumNom;
          lieu.append(ou);
        }
        if (lieu.childElementCount > 0) carte.append(lieu);

        //  ── AVEC QUI ──────────────────────────────────────────────
        //
        //  Soi-même n'est pas un compagnon : la relève range TOUS les
        //  participants, y compris celui qui lit. L'afficher ferait
        //  « avec Jake Dalziel » sur la carte de Jake.
        const avec = (compagnons.get(l.sujetId) ?? [])
          .filter((p) => p.trim() !== r.pseudo.trim());
        if (avec.length > 0) {
          const qui = doc.createElement("p");
          qui.className = "wm-rp__carte-avec";
          qui.textContent = `avec ${avec.join(", ")}`;
          carte.append(qui);
        }

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
        //  ── L'AFFICHER EN GRAND ───────────────────────────────────
        //
        //  « Dans chaque card, pouvoir l'afficher en grand et mettre
        //  une description. » Un bouton, et pas un clic sur la carte :
        //  le titre mène déjà au sujet et la carte se glisse, donc un
        //  troisième sens au même clic en aurait fait trop.
        const loupe = doc.createElement("button");
        loupe.type = "button";
        loupe.className = "wm-rp__carte-loupe";
        loupe.setAttribute("data-wm-rp-ouvrir", String(l.sujetId));
        loupe.append(doc.createTextNode("⤢"));
        const ditLoupe = doc.createElement("span");
        ditLoupe.className = "wm-carnet__hors-ecran";
        ditLoupe.textContent = `Afficher « ${l.titre} » en grand`;
        loupe.append(ditLoupe);
        loupe.addEventListener("click", () => ouvrirEnGrand(l.sujetId));
        pied.append(etiquette, quand, loupe);
        //  LE TITRE EN PREMIER, quoi qu'on ait ajouté entre-temps :
        //  `prepend` le remet en tête, et le pied ferme la carte.
        carte.prepend(titre);
        carte.append(pied);

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
        //  LE MENU DIT LE NOM QU'ON A DONNÉ À LA COLONNE : deux vues
        //  de la même chose qui ne l'appellent pas pareil, et on ne
        //  sait plus laquelle croire.
        o.textContent = noms.get(e.clef) ?? e.mot;
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

      //  LA LISTE OUVRE LE MÊME GRAND QUE LE TABLEAU : c'est le repli
      //  accessible du tableau, et un geste qui n'existe que dans la
      //  vue qu'on ne peut pas atteindre au clavier n'existe pas.
      const voir = doc.createElement("button");
      voir.type = "button";
      voir.textContent = "en grand";
      voir.setAttribute("data-wm-rp-ouvrir", String(l.sujetId));
      voir.addEventListener("click", () => ouvrirEnGrand(l.sujetId));
      outils.append(voir);

      //  ON N'EFFACE QU'UNE CARTE PRÉVUE, et la base le tient aussi
      //  (0037). Le bouton n'apparaît pas ailleurs pour la même raison
      //  qu'on ne grise pas : proposer un geste qui sera refusé
      //  apprend à se méfier de l'écran.
      if (l.etat === "prevu") {
        const oter = doc.createElement("button");
        oter.type = "button";
        oter.textContent = "retirer";
        oter.setAttribute("data-wm-rp-retirer", String(l.sujetId));
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
        forumId: 0,
        forumNom: "",
        reponses: 0,
        dernierLe: null,
        dernierAuteur: "",
        dernierMessage: null,
        extrait: "",
        etat: "prevu",
        ordre: 0,
        description: "",
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

  //  ── LE BOUTON DES CLÔTURÉS ──────────────────────────────────────
  //
  //  Il garde son choix d'une visite à l'autre : quelqu'un qui a replié
  //  cette colonne ne veut pas la rouvrir à chaque fois. Le stockage
  //  local peut jeter, refuser ou ne pas exister — en privé, en
  //  préversion — donc chaque accès est gardé et la valeur par défaut
  //  est « montrés ».
  const CLEF = "wm-rp-clotures";
  const bouton = doc.querySelector<HTMLButtonElement>("[data-wm-rp-clotures]");
  if (bouton !== null) {
    try {
      clotures = globalThis.localStorage?.getItem(CLEF) !== "non";
    } catch { /* rien : on reste sur « montrés » */ }
    const direLeBouton = (): void => {
      bouton.setAttribute("aria-pressed", clotures ? "true" : "false");
      bouton.textContent = clotures ? "Montrer les clôturés" : "Clôturés cachés";
    };
    direLeBouton();
    bouton.addEventListener("click", () => {
      clotures = !clotures;
      try {
        globalThis.localStorage?.setItem(CLEF, clotures ? "oui" : "non");
      } catch { /* rien : le choix ne survivra pas, la page marche */ }
      direLeBouton();
      peindre();
    });
  }

  let charge = false;
  const charger = (): void => {
    if (charge) return;
    charge = true;
    void (async () => {
      //  LES QUATRE LECTURES PARTENT ENSEMBLE. Les compagnons, les
      //  forums et les noms de colonnes ne dépendent pas des RP : les
      //  enchaîner ajouterait trois allers-retours au premier
      //  affichage pour rien.
      const [lus, avec, titres] = await Promise.all([
        rest(r, "rp?select=*&order=ordre,dernier_le.desc"),
        rest(r, "rp_participant?select=sujet_id,pseudo"),
        rest(r, "rp_colonne?select=etat,nom"),
        lireLesForums(r.racine).then((t) => {
          forums = t;
        }),
      ]);
      if (Array.isArray(titres.corps)) {
        for (const c of titres.corps as Record<string, unknown>[]) {
          const clef = String(c.etat ?? "");
          const nom = String(c.nom ?? "").trim();
          if (clef !== "" && nom !== "") noms.set(clef, nom);
        }
      }
      if (Array.isArray(avec.corps)) {
        for (const p of avec.corps as Record<string, unknown>[]) {
          const sujetId = Number(p.sujet_id);
          const pseudo = String(p.pseudo ?? "").trim();
          if (!Number.isInteger(sujetId) || pseudo === "") continue;
          const deja = compagnons.get(sujetId) ?? [];
          if (!deja.includes(pseudo)) compagnons.set(sujetId, [...deja, pseudo]);
        }
      }
      if (Array.isArray(lus.corps)) {
        lignes = (lus.corps as Record<string, unknown>[]).map((c) => ({
          sujetId: Number(c.sujet_id),
          titre: String(c.titre ?? ""),
          forumId: Number(c.forum_id ?? 0),
          forumNom: String(c.forum_nom ?? ""),
          reponses: Number(c.reponses ?? 0),
          dernierLe: typeof c.dernier_le === "string" ? c.dernier_le : null,
          dernierAuteur: String(c.dernier_auteur ?? ""),
          dernierMessage: typeof c.dernier_message === "number" ? c.dernier_message : null,
          extrait: String(c.extrait ?? ""),
          etat: String(c.etat ?? "en-cours"),
          ordre: Number(c.ordre ?? 0),
          description: String(c.description ?? ""),
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
