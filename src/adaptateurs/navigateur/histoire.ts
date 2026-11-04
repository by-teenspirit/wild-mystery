/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/histoire.ts
//
//  COUVERT PAR : outils/carnet.mjs — les interrupteurs, les champs
//  libres, les traits, l'image, et les moments du serveur qu'on masque
//  sans pouvoir les réécrire.
//
//  Note de code `399:1365` : « Chaque champ a son interrupteur, et rien
//  ne fuit par défaut ».
//
//  ── CE QUE CET ÉCRAN MONTRE, ET CE QU'IL NE MONTRE PAS ──────────────
//
//  Il montre TOUT, masqué compris — ce sont les interrupteurs du
//  joueur, il lui faut les voir. C'est la FABRIQUE DE LA FICHE, dans le
//  lot « Mes liens », qui ne lira que `affiche = true`. Confondre les
//  deux lectures donnerait soit un écran où l'on ne peut rien rallumer,
//  soit une fiche qui publie ce qu'on avait éteint.
//
//  ── LES INTERRUPTEURS ÉCRIVENT, ILS NE CACHENT PAS ──────────────────
//
//  Un champ masqué ne part pas de la base : la bascule fait un PATCH
//  sur `affiche`, et le mot « affiché » ou « masqué » est écrit à côté
//  de la pastille. Une couleur seule ne dit rien à qui ne la voit pas,
//  et c'est précisément l'information qui décide si un texte intime
//  sort du carnet.
// ════════════════════════════════════════════════════════════════════

import type { ConfigSupabase } from "./registre.ts";

export type Champ = {
  champ: string;
  valeur: string;
  affiche: boolean;
  ordre: number;
};

export type Description = {
  texte: string;
  affiche: boolean;
  image_mode: "avatar" | "lien";
  image_lien: string;
  carte_affiche: boolean;
};

export type Trait = { mot: string; ordre: number };

export type Moment = {
  id: string;
  quand: string;
  titre: string;
  texte: string;
  auto: boolean;
  affiche: boolean;
};

export type Fiche = {
  champs: Champ[];
  description: Description | null;
  traits: Trait[];
  moments: Moment[];
};

export const DESCRIPTION_VIDE: Description = {
  texte: "",
  affiche: false,
  image_mode: "avatar",
  image_lien: "",
  carte_affiche: false,
};

// ── le réseau ──────────────────────────────────────────────────────

type Reponse = { ok: boolean; corps: unknown };

async function demander(
  acces: ConfigSupabase,
  jeton: string,
  chemin: string,
  options: RequestInit = {},
): Promise<Reponse> {
  const r = await fetch(`${acces.url}/rest/v1/${chemin}`, {
    credentials: "omit",
    ...options,
    headers: {
      apikey: acces.clePubliable,
      Authorization: `Bearer ${jeton}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  }).catch(() => null);
  if (r === null || !r.ok) {
    console.error("wm/histoire :", chemin, "→", r?.status);
    return { ok: false, corps: null };
  }
  const corps = r.status === 204 ? null : await r.json().catch(() => null);
  return { ok: true, corps };
}

/** Les quatre tables, en une fois.
 *
 *  QUATRE REQUÊTES EN PARALLÈLE, PAS QUATRE À LA SUITE : elles ne
 *  dépendent pas les unes des autres, et les enchaîner ajouterait trois
 *  allers-retours pour rien. */
export async function lireLaFiche(
  acces: ConfigSupabase,
  jeton: string,
): Promise<Fiche | null> {
  const [c, d, t, m] = await Promise.all([
    demander(acces, jeton, "fiche_champ?select=*&order=ordre,champ"),
    demander(acces, jeton, "fiche_description?select=*"),
    demander(acces, jeton, "fiche_trait?select=*&order=ordre,mot"),
    demander(acces, jeton, "fiche_moment?select=*&order=quand"),
  ]);
  if (!c.ok || !d.ok || !t.ok || !m.ok) return null;
  const premiere = Array.isArray(d.corps) ? d.corps[0] : null;
  return {
    champs: Array.isArray(c.corps) ? c.corps as Champ[] : [],
    description: (premiere ?? null) as Description | null,
    traits: Array.isArray(t.corps) ? t.corps as Trait[] : [],
    moments: Array.isArray(m.corps) ? m.corps as Moment[] : [],
  };
}

/** Un PATCH sur une ligne, désignée par ce qui la distingue. */
export function ecrireLaLigne(
  acces: ConfigSupabase,
  jeton: string,
  table: string,
  ou: string,
  valeurs: Record<string, unknown>,
): Promise<Reponse> {
  return demander(acces, jeton, `${table}?${ou}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(valeurs),
  });
}

export function poserLaLigne(
  acces: ConfigSupabase,
  jeton: string,
  table: string,
  valeurs: Record<string, unknown>,
): Promise<Reponse> {
  return demander(acces, jeton, table, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(valeurs),
  });
}

export function oterLaLigne(
  acces: ConfigSupabase,
  jeton: string,
  table: string,
  ou: string,
): Promise<Reponse> {
  return demander(acces, jeton, `${table}?${ou}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

// ── des bouts purs, mesurés à part ─────────────────────────────────

/** Le mot de l'interrupteur. Écrit, jamais seulement coloré. */
export function motDeLInterrupteur(affiche: boolean): string {
  return affiche ? "affiché" : "masqué";
}

/** Une date de moment, telle qu'elle se lit dans la chronologie. */
export function direLaDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Le titre du bloc : « Depuis le 12 juin », ou rien si on ne sait pas.
 *
 *  LA PREMIÈRE DATE EST CELLE DE L'ARRIVÉE, écrite par le serveur. Sans
 *  moment, on ne devine pas : « Ta chronologie » dit la même chose sans
 *  inventer une date. */
export function depuisQuand(moments: readonly Moment[]): string {
  const premier = [...moments].sort((a, b) => a.quand.localeCompare(b.quand))[0];
  return premier === undefined ? "Ta chronologie" : `Depuis le ${direLaDate(premier.quand)}`;
}

/** L'adresse d'image à afficher, ou `null` s'il n'y en a pas.
 *
 *  `https` SEULEMENT, ET LA VÉRIFICATION EST DOUBLE : la base refuse
 *  déjà autre chose (0033), mais cette valeur descend ici pour entrer
 *  dans un attribut `src`. Une contrainte posée dans une migration
 *  d'octobre ne protège pas une ligne écrite avant elle, et ce n'est
 *  pas à l'attribut de faire confiance. */
export function adresseDeLImage(
  d: Description | null,
  avatar: string | null,
): string | null {
  if (d === null) return avatar;
  if (d.image_mode === "lien") {
    return d.image_lien.startsWith("https://") ? d.image_lien : null;
  }
  return avatar;
}

// ── l'écran ────────────────────────────────────────────────────────

export type ReglagesHistoire = {
  readonly doc: Document;
  readonly acces: ConfigSupabase;
  readonly jeton: string;
  readonly joueurId: string;
  readonly pseudo: string;
  readonly avatar: string | null;
  readonly carte: readonly { readonly chiffre: string; readonly mot: string }[];
};

const ATTENTE_MS = 2000;

/** Monte l'onglet « Mon histoire ». `false` si la page ne s'y prête pas. */
export function poserHistoire(r: ReglagesHistoire): boolean {
  const doc = r.doc;
  const q = <T extends HTMLElement>(s: string) => doc.querySelector<T>(s);
  const nom = q("[data-wm-histoire-nom]");
  const champs = q("[data-wm-histoire-champs]");
  const traits = q("[data-wm-histoire-traits]");
  const moments = q("[data-wm-histoire-moments]");
  const texte = q<HTMLTextAreaElement>("[data-wm-histoire-texte]");
  const image = q<HTMLImageElement>("[data-wm-histoire-image]");
  const imageVide = q("[data-wm-histoire-image-vide]");
  const lien = q<HTMLInputElement>("[data-wm-histoire-lien]");
  const carte = q("[data-wm-histoire-carte]");
  const depuis = q("[data-wm-histoire-depuis]");
  const placeDescription = q("[data-wm-histoire-description-bascule]");
  const placeCarte = q("[data-wm-histoire-carte-bascule]");
  const presentationDit = q("[data-wm-histoire-presentation-dit]");
  if (
    nom === null || champs === null || traits === null || moments === null ||
    texte === null || image === null || imageVide === null || lien === null ||
    carte === null || depuis === null || placeDescription === null ||
    placeCarte === null || presentationDit === null
  ) {
    console.error("wm/histoire : la page n'a pas toutes ses pièces");
    return false;
  }

  let fiche: Fiche = { champs: [], description: null, traits: [], moments: [] };
  const decrire = (): Description => fiche.description ?? { ...DESCRIPTION_VIDE };

  /** Une bascule : la pastille, et le mot à côté. */
  const bascule = (
    affiche: boolean,
    dessus: (valeur: boolean) => void,
  ): HTMLButtonElement => {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "wm-histoire__bascule";
    b.setAttribute("aria-pressed", affiche ? "true" : "false");
    b.append(doc.createTextNode(motDeLInterrupteur(affiche)));
    b.addEventListener("click", () => {
      const neuf = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", neuf ? "true" : "false");
      b.textContent = motDeLInterrupteur(neuf);
      dessus(neuf);
    });
    return b;
  };

  const ecrireLaDescription = async (valeurs: Record<string, unknown>) => {
    //  LA LIGNE PEUT NE PAS EXISTER ENCORE : un `upsert` plutôt qu'un
    //  PATCH, sinon la première modification d'un personnage neuf ne
    //  touche rien et ne dit rien.
    await poserLaLigne(r.acces, r.jeton, "fiche_description", {
      joueur_id: r.joueurId,
      ...decrire(),
      ...valeurs,
    });
    fiche.description = { ...decrire(), ...valeurs } as Description;
  };

  // ── les champs ───────────────────────────────────────────────────

  const peindreLesChamps = () => {
    champs.textContent = "";
    for (const c of fiche.champs) {
      const li = doc.createElement("li");
      li.className = "wm-histoire__champ";
      const etiquette = doc.createElement("span");
      etiquette.className = "wm-histoire__champ-nom";
      etiquette.textContent = c.champ;
      const valeur = doc.createElement("input");
      valeur.className = "wm-histoire__champ-valeur";
      valeur.value = c.valeur;
      valeur.setAttribute("aria-label", c.champ);
      let minuteur: ReturnType<typeof setTimeout> | undefined;
      valeur.addEventListener("input", () => {
        if (minuteur !== undefined) clearTimeout(minuteur);
        minuteur = setTimeout(() => {
          c.valeur = valeur.value;
          void ecrireLaLigne(
            r.acces,
            r.jeton,
            "fiche_champ",
            `champ=eq.${encodeURIComponent(c.champ)}`,
            { valeur: valeur.value },
          );
        }, ATTENTE_MS);
      });
      li.append(
        etiquette,
        valeur,
        bascule(c.affiche, (v) => {
          c.affiche = v;
          void ecrireLaLigne(
            r.acces,
            r.jeton,
            "fiche_champ",
            `champ=eq.${encodeURIComponent(c.champ)}`,
            { affiche: v },
          );
        }),
      );
      champs.append(li);
    }
  };

  q("[data-wm-histoire-ajouter-champ]")?.addEventListener("click", () => {
    const intitule = globalThis.prompt("L'intitulé du champ ?");
    if (intitule === null) return;
    const propre = intitule.trim().slice(0, 40).replace(/[<>]/g, "");
    if (propre === "") return;
    if (fiche.champs.some((c) => c.champ === propre)) return;
    //  IL NAÎT MASQUÉ, et on ne le dit même pas à la base : c'est son
    //  défaut depuis la 0033. L'écran se contente de ne rien demander.
    void (async () => {
      const fait = await poserLaLigne(r.acces, r.jeton, "fiche_champ", {
        joueur_id: r.joueurId,
        champ: propre,
        ordre: fiche.champs.length,
      });
      if (!fait.ok) return;
      fiche.champs = [...fiche.champs, {
        champ: propre,
        valeur: "",
        affiche: false,
        ordre: fiche.champs.length,
      }];
      peindreLesChamps();
    })();
  });

  // ── les traits ───────────────────────────────────────────────────

  const peindreLesTraits = () => {
    traits.textContent = "";
    for (const t of fiche.traits) {
      const li = doc.createElement("li");
      li.className = "wm-histoire__trait";
      li.append(doc.createTextNode(t.mot));
      const oter = doc.createElement("button");
      oter.type = "button";
      oter.textContent = "×";
      oter.setAttribute("aria-label", `Retirer ${t.mot}`);
      oter.addEventListener("click", () => {
        void (async () => {
          await oterLaLigne(
            r.acces,
            r.jeton,
            "fiche_trait",
            `mot=eq.${encodeURIComponent(t.mot)}`,
          );
          fiche.traits = fiche.traits.filter((x) => x.mot !== t.mot);
          peindreLesTraits();
        })();
      });
      li.append(oter);
      traits.append(li);
    }
  };

  q("[data-wm-histoire-ajouter-trait]")?.addEventListener("click", () => {
    const dit = globalThis.prompt("Un mot ?");
    if (dit === null) return;
    const mot = dit.trim().slice(0, 24).replace(/[<>]/g, "");
    if (mot === "" || fiche.traits.some((t) => t.mot === mot)) return;
    void (async () => {
      const fait = await poserLaLigne(r.acces, r.jeton, "fiche_trait", {
        joueur_id: r.joueurId,
        mot,
        ordre: fiche.traits.length,
      });
      if (!fait.ok) return;
      fiche.traits = [...fiche.traits, { mot, ordre: fiche.traits.length }];
      peindreLesTraits();
    })();
  });

  // ── les moments ──────────────────────────────────────────────────

  const peindreLesMoments = () => {
    moments.textContent = "";
    depuis.textContent = depuisQuand(fiche.moments);
    for (const m of fiche.moments) {
      const li = doc.createElement("li");
      li.className = "wm-histoire__moment" + (m.auto ? "" : " wm-histoire__moment--mien");
      const point = doc.createElement("span");
      point.className = "wm-histoire__point";
      point.setAttribute("aria-hidden", "true");
      const corps = doc.createElement("div");
      corps.className = "wm-histoire__moment-corps";
      const quand = doc.createElement("p");
      quand.className = "wm-histoire__moment-quand";
      quand.textContent = direLaDate(m.quand) + (m.auto ? "" : " · écrit par toi");
      const titre = doc.createElement("p");
      titre.className = "wm-histoire__moment-titre";
      titre.textContent = m.titre;
      const dit = doc.createElement("p");
      dit.className = "wm-histoire__moment-texte";
      dit.textContent = m.texte;
      corps.append(
        quand,
        titre,
        dit,
        bascule(m.affiche, (v) => {
          m.affiche = v;
          void ecrireLaLigne(r.acces, r.jeton, "fiche_moment", `id=eq.${m.id}`, {
            affiche: v,
          });
        }),
      );
      li.append(point, corps);
      moments.append(li);
    }
  };

  q("[data-wm-histoire-ajouter-moment]")?.addEventListener("click", () => {
    const titre = globalThis.prompt("Le titre du moment ?");
    if (titre === null) return;
    const propre = titre.trim().slice(0, 80).replace(/[<>]/g, "");
    if (propre === "") return;
    const quand = globalThis.prompt(
      "Quand ? (AAAA-MM-JJ)",
      new Date().toISOString().slice(0, 10),
    );
    if (quand === null || !/^\d{4}-\d{2}-\d{2}$/.test(quand)) return;
    void (async () => {
      //  `auto` RESTE FAUX, et la base le refuserait autrement : la
      //  politique d'insertion exige `not auto` (0033). On ne s'écrit
      //  pas un moment du jeu.
      const fait = await poserLaLigne(r.acces, r.jeton, "fiche_moment", {
        joueur_id: r.joueurId,
        quand,
        titre: propre,
      });
      if (!fait.ok) return;
      const relu = await lireLaFiche(r.acces, r.jeton);
      if (relu !== null) fiche = relu;
      peindreLesMoments();
    })();
  });

  // ── l'image ──────────────────────────────────────────────────────

  const peindreLImage = () => {
    const d = decrire();
    const adresse = adresseDeLImage(d, r.avatar);
    image.hidden = adresse === null;
    imageVide.hidden = adresse !== null;
    if (adresse !== null) image.src = adresse;
    lien.hidden = d.image_mode !== "lien";
    lien.value = d.image_lien;
    for (const b of doc.querySelectorAll("[data-wm-histoire-mode]")) {
      b.setAttribute(
        "aria-pressed",
        b.getAttribute("data-wm-histoire-mode") === d.image_mode ? "true" : "false",
      );
    }
  };

  for (const b of doc.querySelectorAll("[data-wm-histoire-mode]")) {
    b.addEventListener("click", () => {
      const mode = b.getAttribute("data-wm-histoire-mode") === "lien" ? "lien" : "avatar";
      void ecrireLaDescription({ image_mode: mode }).then(peindreLImage);
    });
  }

  lien.addEventListener("change", () => {
    const valeur = lien.value.trim();
    //  LA BASE REFUSERAIT CE QUI N'EST PAS `https` (0033), mais on le
    //  dit ici plutôt que de laisser partir une requête qui reviendra
    //  en erreur sans un mot pour la personne.
    if (valeur !== "" && !valeur.startsWith("https://")) {
      lien.setCustomValidity("L'adresse doit commencer par https://");
      lien.reportValidity();
      return;
    }
    lien.setCustomValidity("");
    void ecrireLaDescription({ image_lien: valeur }).then(peindreLImage);
  });

  // ── la description, la carte, le reste ───────────────────────────

  let minuteurTexte: ReturnType<typeof setTimeout> | undefined;
  texte.addEventListener("input", () => {
    if (minuteurTexte !== undefined) clearTimeout(minuteurTexte);
    minuteurTexte = setTimeout(
      () => void ecrireLaDescription({ texte: texte.value }),
      ATTENTE_MS,
    );
  });

  const peindreLeReste = () => {
    const d = decrire();
    nom.textContent = r.pseudo;
    texte.value = d.texte;
    placeDescription.textContent = "";
    placeDescription.append(
      bascule(d.affiche, (v) => void ecrireLaDescription({ affiche: v })),
    );
    placeCarte.textContent = "";
    placeCarte.append(
      bascule(d.carte_affiche, (v) => void ecrireLaDescription({ carte_affiche: v })),
    );
    carte.textContent = "";
    for (const ligne of r.carte) {
      const li = doc.createElement("li");
      const chiffre = doc.createElement("b");
      chiffre.textContent = ligne.chiffre;
      const mot = doc.createElement("span");
      mot.textContent = ligne.mot;
      li.append(chiffre, mot);
      carte.append(li);
    }
    //  LA FICHE DE PRÉSENTATION est un lien posé par le staff à la
    //  validation. La colonne qui le porte arrive avec le lot « Mes
    //  liens » ; d'ici là on dit l'attente plutôt que de cacher le bloc,
    //  parce que c'est une vraie étape du parcours.
    presentationDit.textContent = "Le staff l'enregistre au moment de valider ton personnage.";
  };

  // ── et on charge, à la première ouverture de l'onglet ────────────

  let charge = false;
  const charger = () => {
    if (charge) return;
    charge = true;
    void (async () => {
      const lu = await lireLaFiche(r.acces, r.jeton);
      if (lu !== null) fiche = lu;
      peindreLeReste();
      peindreLImage();
      peindreLesChamps();
      peindreLesTraits();
      peindreLesMoments();
    })();
  };

  peindreLeReste();
  for (const l of doc.querySelectorAll('[data-wm-carnet-onglet="mon-histoire"]')) {
    l.addEventListener("click", charger);
  }
  if (globalThis.location?.hash === "#mon-histoire") charger();

  return true;
}
