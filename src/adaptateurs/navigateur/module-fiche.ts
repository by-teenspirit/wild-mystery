// ════════════════════════════════════════════════════════════════════
//  Le formulaire de la fiche de présentation, posé sur la page de
//  réponse du forum des Présentations.
//
//  « Normalement, quand on crée un sujet [dans Présentations] ça
//  remplit un formulaire HTML. Et d'ailleurs quand on édite son
//  message, ce serait super que ça reste comme ça. » — 23 novembre.
//
//  ── IL SE POSE EN JAVASCRIPT, ET RIEN N'EST À RECOLLER ──────────────
//
//  Le gabarit `posting_body` n'est pas touché. Le formulaire est
//  inséré devant `#postingbox`, par script, à l'ouverture de la page.
//
//  C'est un choix de déploiement autant que de code : un gabarit
//  modifié se recolle à la main dans le panneau d'administration, et
//  chaque recollage est une occasion de perdre un bloc. Le paquet, lui,
//  part tout seul avec le `git push`.
//
//  ── LE FORMULAIRE ÉCRIT LE MESSAGE, IL NE LE POSTE PAS ──────────────
//
//  C'est la même règle que la fiche de liens du carnet (`33-…`, § 4) :
//  le joueur garde son bouton « Envoyer », il peut relire, retoucher à
//  la main, annuler. **Aucun robot ne poste la fiche de son
//  personnage.**
//
//  ── ET IL S'ARRÊTE DÈS QU'IL NE RECONNAÎT PLUS LE MESSAGE ───────────
//
//  C'est la garde la plus importante du fichier. Le formulaire réécrit
//  le message ENTIER à chaque frappe. Sur un message qu'il n'a pas
//  écrit — une fiche de la V1, un texte retouché à la main — écrire
//  reviendrait à effacer le travail de quelqu'un sans le lui demander.
//
//  Deux moments :
//
//   · À L'OUVERTURE. Message vide → fiche neuve. Message qui est une
//     fiche → on la relit dans les champs. Message qui n'en est pas
//     une → **on ne touche à rien**, et un bandeau propose de
//     reprendre, ce qui demande un clic explicite.
//
//   · AVANT CHAQUE ÉCRITURE. On relit ce qu'il y a dans l'éditeur. Si
//     ce n'est plus exactement ce qu'on y avait mis, le joueur a écrit
//     à la main entre-temps : on s'arrête et on le dit, plutôt que
//     d'écraser.
//
//  COUVERT PAR : outils/poster.mjs
//
//  PAS DE `surChangement` POUR ÇA. Il écoute le formulaire entier, donc
//  les frappes dans NOS champs le déclencheraient aussi, et nos propres
//  écritures émettent un `input`. Comparer avant d'écrire fait le même
//  travail sans boucle à démêler.
// ════════════════════════════════════════════════════════════════════

import {
  type Champ,
  type Fiche,
  ficheVide,
  IDENTITE,
  JOUEUR,
  lireUneFiche,
  type Moment,
  OMBRE,
  publier,
  ressembleAUneFiche,
  type Starter,
} from "../../navigateur/fiche.ts";
import type { Brouillon } from "./editeur.ts";

/** Une espèce choisissable, telle que `data/starters.json` la rend. */
export type EspeceDeDepart = {
  readonly id: number;
  readonly nom: string;
  readonly types: readonly string[];
  readonly talents: readonly { readonly nom: string; readonly cache?: boolean }[];
};

export type DependancesDeLaFiche = {
  readonly doc: Document;
  readonly brouillon: Brouillon;
  /** Les espèces de départ. Appelée une fois, à l'ouverture. Une
   *  lecture qui échoue ne doit pas empêcher le reste du formulaire :
   *  le bloc du starter se dit indisponible, les autres marchent. */
  readonly starters: () => Promise<readonly EspeceDeDepart[]>;
};

const ID = "wm-fiche";

/** Deux fiches portent-elles les mêmes valeurs ?
 *
 *  `JSON.stringify` SUFFIT ET NE MENT PAS ICI : une `Fiche` n'est faite
 *  que de chaînes, de nombres, de tableaux et d'objets littéraux, tous
 *  construits dans le même ordre par `ficheVide` et `lireUneFiche`.
 *  Aucune date, aucune `Map`, aucun `undefined` — les trois choses qui
 *  rendraient la comparaison fausse sans le dire. */
export function memeFiche(a: Fiche, b: Fiche): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function el<T extends HTMLElement>(
  doc: Document,
  balise: string,
  classe: string,
  texte?: string,
): T {
  const e = doc.createElement(balise) as T;
  if (classe !== "") e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/*  UNE LIGNE DE FORMULAIRE EST UN `<dl>`, pas une ligne de tableau.

    C'est le vocabulaire de Forumactif lui-même, relevé le 10 novembre
    (`89-…`) : `<dt>` porte l'étiquette, `<dd>` le champ. En le reprenant,
    le formulaire hérite du style du forum au lieu de s'y superposer —
    et « je veux pas de tableau, que du flexbox » tient tout seul. */
function ligne(
  doc: Document,
  etiquette: string,
  champ: HTMLElement,
  aide?: string,
): HTMLElement {
  const dl = el(doc, "dl", "");
  const dt = el(doc, "dt", "");
  const label = el<HTMLLabelElement>(doc, "label", "", etiquette);
  if (champ.id !== "") label.htmlFor = champ.id;
  dt.appendChild(label);
  if (aide !== undefined && aide !== "") {
    dt.appendChild(el(doc, "span", "wmf-form__aide", aide));
  }
  const dd = el(doc, "dd", "");
  dd.appendChild(champ);
  dl.append(dt, dd);
  return dl;
}

function saisie(
  doc: Document,
  clef: string,
  valeur: string,
  long: boolean,
): HTMLInputElement | HTMLTextAreaElement {
  if (long) {
    const t = el<HTMLTextAreaElement>(doc, "textarea", "inputbox");
    t.id = `wmf-${clef}`;
    t.rows = 3;
    t.value = valeur;
    return t;
  }
  const i = el<HTMLInputElement>(doc, "input", "inputbox medium");
  i.id = `wmf-${clef}`;
  i.type = "text";
  i.value = valeur;
  return i;
}

function section(doc: Document, titre: string): HTMLElement {
  const bloc = el(doc, "div", "panel wmf-form__section");
  const dedans = el(doc, "div", "inner");
  dedans.appendChild(el(doc, "div", "h3", titre));
  const champs = el(doc, "fieldset", "fields1 wmf-form__champs");
  dedans.appendChild(champs);
  bloc.appendChild(dedans);
  //  LE `fieldset` EST RENDU, pas le panneau : c'est là qu'on ajoute
  //  les lignes, et l'appelant n'a pas à connaître l'emboîtement de
  //  ModernBB pour poser un champ.
  (bloc as unknown as { champs: HTMLElement }).champs = champs;
  return bloc;
}

function champsDe(bloc: HTMLElement): HTMLElement {
  return (bloc as unknown as { champs: HTMLElement }).champs;
}

/*  CE QU'ON RETIRE DE L'APERÇU, ET POURQUOI SEULEMENT DE L'APERÇU.

    « Faut voir directement ce que ça va faire, c'est pas juste des
    champs à remplir » — 23 novembre. L'aperçu rend donc le VRAI HTML
    publié, avec la vraie feuille de style : c'est la seule façon
    honnête de montrer le résultat, et toute autre construction
    finirait par diverger de ce qui part vraiment.

    Mais le rendre, c'est l'exécuter. Le texte vient du joueur
    lui-même, dans sa propre page, donc il ne peut atteindre que lui —
    il n'y a personne à protéger de lui. Ce n'est pas une barrière de
    sécurité et ça ne prétend pas l'être.

    C'EST UNE BARRIÈRE CONTRE L'ACCIDENT. Un `<script>` collé depuis un
    tutoriel, une `<iframe>` recopiée d'un générateur de bannières, et
    l'aperçu se met à charger des choses ou à casser la page de
    réponse — au milieu de la rédaction, sans que le joueur comprenne
    ce qui arrive. Ce qui part dans le message, lui, n'est pas touché :
    c'est le filtre de Forumactif qui en décide, comme pour n'importe
    quel message. */
const HORS_APERCU = "script, iframe, object, embed, link, meta, base, form";

export function pourLApercu(doc: Document, html: string): DocumentFragment {
  const lu = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  for (const e of lu.querySelectorAll(HORS_APERCU)) e.remove();
  for (const e of lu.querySelectorAll("*")) {
    for (const a of [...e.attributes]) {
      //  LES GESTIONNAIRES D'ÉVÈNEMENTS ET LES ADRESSES EXÉCUTABLES.
      //  `onerror` sur une image suffit, et il se recopie sans qu'on
      //  le voie dans un collage.
      if (/^on/i.test(a.name)) e.removeAttribute(a.name);
      else if (
        (a.name === "href" || a.name === "src") &&
        /^\s*javascript:/i.test(a.value)
      ) e.removeAttribute(a.name);
    }
  }
  const sortie = doc.createDocumentFragment();
  for (const n of [...(lu.body.firstElementChild?.childNodes ?? [])]) {
    sortie.appendChild(doc.importNode(n, true));
  }
  return sortie;
}

/** Pose le formulaire. Rend `false` si la page ne s'y prête pas. */
export function poserLaFiche(d: DependancesDeLaFiche): boolean {
  const { doc, brouillon } = d;
  const boite = doc.querySelector("#postingbox");
  if (boite === null || doc.getElementById(ID) !== null) return false;

  //  ── CE QU'IL Y A DÉJÀ DANS L'ÉDITEUR ───────────────────────────
  const avant = brouillon.lire().trim();
  const connu = avant === "" || ressembleAUneFiche(avant);
  let fiche: Fiche = connu && avant !== "" ? lireUneFiche(avant) : ficheVide();

  //  CE QU'ON A ÉCRIT EN DERNIER, pour reconnaître une retouche à la
  //  main. La chaîne vide veut dire « on n'a encore rien écrit », donc
  //  la première écriture passe toujours.
  let dernier = "";
  let arrete = !connu;

  const cadre = el(doc, "div", "wmf-form");
  cadre.id = ID;

  const dit = el(doc, "p", "wmf-form__dit");
  dit.setAttribute("role", "status");

  //  ── L'APERÇU ────────────────────────────────────────────────────
  //
  //  « Faut voir directement ce que ça va faire, c'est pas juste des
  //  champs à remplir » — 23 novembre.
  //
  //  Il rend LE VRAI HTML PUBLIÉ, avec la vraie feuille de style.
  //  C'est la seule façon honnête de montrer le résultat : une mise
  //  en page reconstruite pour l'occasion finirait par ne plus
  //  ressembler à ce qui part.
  const apercu = el(doc, "div", "panel wmf-form__apercu");
  const dedansApercu = el(doc, "div", "inner");
  dedansApercu.appendChild(el(doc, "div", "h3", "Ce que ça donnera"));
  const rendu = el(doc, "div", "wmf-form__rendu");
  dedansApercu.appendChild(rendu);
  apercu.appendChild(dedansApercu);

  //  ── LE BLOC D'ÉDITION S'EFFACE, MAIS IL REVIENT SUR DEMANDE ─────
  //
  //  « Ça remplace tout. » Le `#postingbox` de Forumactif disparaît —
  //  le titre du sujet est repris plus haut, et le bouton d'envoi vit
  //  dans un AUTRE panneau, donc il survit.
  //
  //  LA PORTE DE SORTIE N'EST PAS UNE PRÉCAUTION DE PRINCIPE. Le jour
  //  où un champ manque, où quelqu'un veut coller un bout de code à
  //  lui, ou simplement relire le message tel qu'il part, un
  //  formulaire qui a mangé l'éditeur et ne le rend pas est une
  //  impasse. Elle rend le message visible ET rend la main : le
  //  formulaire cesse d'écrire, plutôt que d'écraser par-dessus.
  const boiteEditeur = boite as HTMLElement;
  const voirLeTexte = el<HTMLButtonElement>(
    doc,
    "button",
    "button2 wmf-form__brut",
    "Écrire le message à la main",
  );
  voirLeTexte.type = "button";
  voirLeTexte.addEventListener("click", () => {
    boiteEditeur.hidden = false;
    arrete = true;
    cadre.dataset.wmArrete = "oui";
    voirLeTexte.hidden = true;
    reprendre.hidden = false;
    dit.textContent = "Le message est en dessous, tel qu'il partira. " +
      "Le formulaire a cessé d'écrire pour ne pas effacer tes retouches.";
  });

  const ecrire = (): void => {
    if (arrete) return;
    const actuel = brouillon.lire();
    //  ── LA GARDE : ON NE RÉÉCRIT PAS PAR-DESSUS UNE RETOUCHE ─────
    //
    //  ON COMPARE LA FICHE RELUE, PAS LA CHAÎNE. Une comparaison au
    //  caractère près serait la plus simple à écrire et la plus
    //  fragile à l'usage : sceditor est un éditeur WYSIWYG, et rien ne
    //  promet qu'il rende EXACTEMENT le HTML qu'on lui a donné — un
    //  espace déplacé, un attribut réordonné, et la garde se
    //  déclencherait dès la seconde frappe, sur un message que
    //  personne n'a touché. Le formulaire s'arrêterait tout seul, et
    //  le joueur n'aurait aucun moyen de comprendre pourquoi.
    //
    //  La fiche relue, elle, ne bouge que si quelqu'un a changé une
    //  VALEUR. C'est exactement la question qu'on pose.
    //
    //  LA LIMITE, ÉCRITE PLUTÔT QUE TUE : du texte ajouté À CÔTÉ de la
    //  fiche, hors de ses balises, ne se voit pas dans la comparaison
    //  et sera emporté à la prochaine écriture. Reste à mesurer sur le
    //  vrai éditeur si c'est un cas réel.
    if (dernier !== "" && !memeFiche(lireUneFiche(actuel), lireUneFiche(dernier))) {
      arrete = true;
      cadre.dataset.wmArrete = "oui";
      dit.textContent = "Tu as modifié le message à la main : le formulaire s'est " +
        "arrêté pour ne pas l'effacer. Reprends-le quand tu veux.";
      reprendre.hidden = false;
      return;
    }
    const html = publier(fiche);
    brouillon.ecrire(html);
    dernier = html;
    dit.textContent = "";
    peindreLApercu(html);
  };

  const peindreLApercu = (html: string): void => {
    rendu.textContent = "";
    rendu.appendChild(pourLApercu(doc, html));
  };

  //  ── REPRENDRE LA MAIN, ET SEULEMENT SUR UN CLIC ────────────────
  //
  //  Le seul chemin par lequel le formulaire écrase un message qu'il
  //  n'a pas écrit. Il est explicite, il est nommé, et il ne se
  //  déclenche jamais tout seul.
  const reprendre = el<HTMLButtonElement>(
    doc,
    "button",
    "button2 wmf-form__reprendre",
    "Remplacer le message par cette fiche",
  );
  reprendre.type = "button";
  reprendre.hidden = connu;
  reprendre.addEventListener("click", () => {
    arrete = false;
    dernier = "";
    delete cadre.dataset.wmArrete;
    reprendre.hidden = true;
    //  LE FORMULAIRE REPREND LA PLACE qu'il avait laissée : il écrit
    //  de nouveau, donc laisser l'éditeur visible montrerait un texte
    //  qui change tout seul sous les doigts.
    boiteEditeur.hidden = true;
    voirLeTexte.hidden = false;
    ecrire();
  });

  if (!connu) {
    dit.textContent = "Ce message n'a pas été écrit avec ce formulaire. " +
      "Le remplir ne le touchera pas tant que tu ne l'auras pas demandé.";
  }

  // ── le personnage ────────────────────────────────────────────────

  const unChamp = (
    parent: HTMLElement,
    c: Champ,
    valeur: string,
    poser: (v: string) => void,
  ): void => {
    const champ = saisie(doc, c.clef, valeur, c.long === true);
    champ.addEventListener("input", () => {
      poser(champ.value);
      ecrire();
    });
    parent.appendChild(ligne(doc, c.etiquette, champ, c.exemple));
  };

  //  ── LE TITRE DU SUJET VIENT ICI ────────────────────────────────
  //
  //  « Pas besoin d'avoir ce qui est écrit en dessous, le bloc
  //  d'édition, ça remplace tout » — 23 novembre.
  //
  //  Le champ « Sujet » de Forumactif est DANS `#postingbox`, qu'on
  //  s'apprête à masquer. Sans ce relais, le joueur ne pourrait plus
  //  nommer son sujet du tout — et il s'en apercevrait au moment
  //  d'envoyer, pas avant.
  //
  //  IL SE REMPLIT TOUT SEUL DU NOM DU PERSONNAGE tant que personne
  //  n'y a touché : c'est ce que les fiches s'appellent, et une chose
  //  de moins à taper. Dès qu'on l'édite à la main, il cesse de
  //  suivre.
  const sujetNatif = doc.querySelector<HTMLInputElement>('input[name="subject"]');
  let titreSuitLeNom = (sujetNatif?.value ?? "").trim() === "";
  const titre = saisie(doc, "titre", sujetNatif?.value ?? "", false);
  titre.addEventListener("input", () => {
    titreSuitLeNom = false;
    if (sujetNatif !== null) sujetNatif.value = titre.value;
  });

  const perso = section(doc, "Le personnage");
  {
    const dedans = champsDe(perso);
    dedans.appendChild(
      ligne(doc, "TITRE DU SUJET", titre, "ce qui s'affichera dans la liste des sujets"),
    );
    unChamp(dedans, { clef: "nom", etiquette: "NOM DU PERSONNAGE" }, fiche.nom, (v) => {
      fiche = { ...fiche, nom: v };
      if (titreSuitLeNom) {
        titre.value = v;
        if (sujetNatif !== null) sujetNatif.value = v;
      }
    });
    unChamp(
      dedans,
      {
        clef: "tw",
        etiquette: "TRIGGER WARNINGS",
        exemple: "ce que ta fiche contient, et qu'on préfère annoncer",
        long: true,
      },
      fiche.tw,
      (v) => {
        fiche = { ...fiche, tw: v };
      },
    );
    unChamp(
      dedans,
      {
        clef: "avatar",
        etiquette: "IMAGE DE LA FICHE",
        exemple: "l'adresse de l'image à afficher à gauche",
      },
      fiche.avatar,
      (v) => {
        fiche = { ...fiche, avatar: v };
      },
    );
    for (const c of IDENTITE) {
      unChamp(dedans, c, fiche.identite[c.clef] ?? "", (v) => {
        fiche = { ...fiche, identite: { ...fiche.identite, [c.clef]: v } };
      });
    }
  }

  // ── son histoire ─────────────────────────────────────────────────

  const hist = section(doc, "Son histoire");
  const corpsHistoire = el(doc, "div", "wmf-form__histoire");
  {
    const dedans = champsDe(hist);
    //  ── LE CHOIX DE LA FORME, EN BOUTONS RADIO ───────────────────
    //
    //  « Soit un grand pavé […], soit une chronologie » — et c'est le
    //  joueur qui choisit. Deux radios plutôt qu'une liste
    //  déroulante : il y a deux choix, ils tiennent sur une ligne, et
    //  on voit les deux sans cliquer.
    const choix = el(doc, "div", "wmf-form__formes");
    for (const [mode, mot] of [["pave", "Un grand pavé"], ["chronologie", "Une chronologie"]]) {
      const label = el<HTMLLabelElement>(doc, "label", "wmf-form__forme");
      const radio = el<HTMLInputElement>(doc, "input", "");
      radio.type = "radio";
      radio.name = "wmf-forme";
      radio.value = mode;
      radio.checked = fiche.histoire.mode === mode;
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        //  CHANGER DE FORME NE PERD RIEN TANT QU'ON NE SAUVE PAS :
        //  on garde le pavé et les moments côte à côte dans la page,
        //  et seule la forme choisie part dans la fiche.
        fiche = {
          ...fiche,
          histoire: mode === "pave" ? { mode: "pave", texte: pave.value } : {
            mode: "chronologie",
            moments: lesMoments(),
          },
        };
        peindreHistoire();
        ecrire();
      });
      label.append(radio, doc.createTextNode(" " + mot));
      choix.appendChild(label);
    }
    dedans.appendChild(ligne(doc, "LA FORME", choix));
    dedans.appendChild(corpsHistoire);
  }

  const pave = el<HTMLTextAreaElement>(doc, "textarea", "inputbox wmf-form__pave");
  pave.id = "wmf-histoire";
  pave.rows = 10;
  pave.value = fiche.histoire.mode === "pave" ? fiche.histoire.texte : "";
  pave.addEventListener("input", () => {
    fiche = { ...fiche, histoire: { mode: "pave", texte: pave.value } };
    ecrire();
  });

  const chrono = el(doc, "div", "wmf-form__chrono");
  let moments: Moment[] = fiche.histoire.mode === "chronologie"
    ? [...fiche.histoire.moments]
    : [];
  const lesMoments = (): readonly Moment[] => moments;

  const peindreChrono = (): void => {
    chrono.textContent = "";
    moments.forEach((m, i) => {
      const bloc = el(doc, "div", "wmf-form__moment");
      const date = el<HTMLInputElement>(doc, "input", "inputbox wmf-form__date");
      date.type = "text";
      date.value = m.date;
      date.placeholder = "2015, ou « l'hiver d'après »";
      date.setAttribute("aria-label", `Date du moment ${i + 1}`);
      const texte = el<HTMLTextAreaElement>(doc, "textarea", "inputbox");
      texte.rows = 3;
      texte.value = m.texte;
      texte.setAttribute("aria-label", `Ce qui s'est passé, moment ${i + 1}`);
      const majJ = (): void => {
        moments[i] = { date: date.value, texte: texte.value };
        fiche = { ...fiche, histoire: { mode: "chronologie", moments: [...moments] } };
        ecrire();
      };
      date.addEventListener("input", majJ);
      texte.addEventListener("input", majJ);
      //  LA CROIX EST SUR CHAQUE MOMENT, comme sur chaque carte du
      //  carnet : « peu importe si c'est prévu ou dans une autre
      //  colonne », 23 novembre. Un seul endroit pour retirer, et il
      //  est là où on regarde.
      const croix = el<HTMLButtonElement>(doc, "button", "wmf-form__croix", "×");
      croix.type = "button";
      croix.setAttribute("aria-label", `Retirer le moment ${i + 1}`);
      croix.addEventListener("click", () => {
        moments.splice(i, 1);
        fiche = { ...fiche, histoire: { mode: "chronologie", moments: [...moments] } };
        peindreChrono();
        ecrire();
      });
      bloc.append(date, texte, croix);
      chrono.appendChild(bloc);
    });
    const plus = el<HTMLButtonElement>(
      doc,
      "button",
      "button2 wmf-form__plus",
      "Ajouter un moment",
    );
    plus.type = "button";
    plus.addEventListener("click", () => {
      moments = [...moments, { date: "", texte: "" }];
      fiche = { ...fiche, histoire: { mode: "chronologie", moments: [...moments] } };
      peindreChrono();
      ecrire();
      chrono.querySelector<HTMLInputElement>(".wmf-form__moment:last-of-type input")?.focus();
    });
    chrono.appendChild(plus);
  };

  const peindreHistoire = (): void => {
    corpsHistoire.textContent = "";
    if (fiche.histoire.mode === "pave") corpsHistoire.appendChild(pave);
    else {
      peindreChrono();
      corpsHistoire.appendChild(chrono);
    }
  };
  peindreHistoire();

  // ── son premier Pokémon ──────────────────────────────────────────

  const poke = section(doc, "Son premier Pokémon");
  const especeMenu = el<HTMLSelectElement>(doc, "select", "inputbox");
  especeMenu.id = "wmf-espece";
  const talentMenu = el<HTMLSelectElement>(doc, "select", "inputbox");
  talentMenu.id = "wmf-talent";
  let catalogue: readonly EspeceDeDepart[] = [];

  const starterCourant = (): Starter | null => {
    const id = Number(especeMenu.value);
    if (!Number.isInteger(id) || id <= 0) return null;
    const e = catalogue.find((x) => x.id === id);
    return {
      especeId: id,
      espece: e?.nom ?? fiche.starter?.espece ?? "",
      surnom: surnom.value,
      talent: talentMenu.value,
      rencontre: rencontre.value,
    };
  };
  const majStarter = (): void => {
    fiche = { ...fiche, starter: starterCourant() };
    ecrire();
  };

  const peindreTalents = (): void => {
    const e = catalogue.find((x) => x.id === Number(especeMenu.value));
    const choisi = talentMenu.value;
    talentMenu.textContent = "";
    if (e === undefined || e.talents.length === 0) {
      talentMenu.disabled = true;
      const vide = el<HTMLOptionElement>(doc, "option", "", "—");
      vide.value = "";
      talentMenu.appendChild(vide);
      return;
    }
    talentMenu.disabled = false;
    for (const t of e.talents) {
      const o = el<HTMLOptionElement>(doc, "option", "");
      o.value = t.nom;
      //  LE TALENT CACHÉ EST DIT, pas retiré : le staff tranchera.
      o.textContent = t.cache === true ? `${t.nom} (talent caché)` : t.nom;
      o.selected = t.nom === choisi;
      talentMenu.appendChild(o);
    }
  };

  const surnom = saisie(doc, "s-surnom", fiche.starter?.surnom ?? "", false);
  const rencontre = saisie(doc, "s-rencontre", fiche.starter?.rencontre ?? "", true);
  (rencontre as HTMLTextAreaElement).rows = 5;
  const ancienne = saisie(doc, "ancienne", fiche.ancienneEquipe, true);

  especeMenu.addEventListener("change", () => {
    peindreTalents();
    majStarter();
  });
  talentMenu.addEventListener("change", majStarter);
  surnom.addEventListener("input", majStarter);
  rencontre.addEventListener("input", majStarter);
  ancienne.addEventListener("input", () => {
    fiche = { ...fiche, ancienneEquipe: ancienne.value };
    ecrire();
  });

  {
    const dedans = champsDe(poke);
    dedans.appendChild(
      ligne(doc, "L'ESPÈCE", especeMenu, "une forme de base, sans évolution ni légendaire"),
    );
    dedans.appendChild(ligne(doc, "SON SURNOM", surnom));
    dedans.appendChild(ligne(doc, "SON TALENT", talentMenu));
    dedans.appendChild(
      ligne(
        doc,
        "COMPAGNON D'UNE VIE",
        rencontre,
        "comment vous vous êtes rencontrés — c'est ce qui permet au staff de fixer son niveau",
      ),
    );
    dedans.appendChild(
      ligne(
        doc,
        "L'ÉQUIPE D'AVANT",
        ancienne,
        "les Pokémon que ton personnage avait déjà, et qu'il récupérera aux paliers",
      ),
    );
    //  LE NIVEAU N'EST PAS DEMANDÉ, ET ON LE DIT. Sans cette phrase,
    //  la première question du premier joueur sera « où je mets son
    //  niveau ? ».
    const note = el(
      doc,
      "p",
      "wmf-form__note",
      "Le niveau n'est pas à choisir : le staff l'attribue à la validation, " +
        "d'après l'âge, le métier et le passé de ton personnage.",
    );
    dedans.appendChild(note);
  }

  // ── le Groupe Ombre ──────────────────────────────────────────────

  const ombre = section(doc, "Le Groupe Ombre");
  const corpsOmbre = el(doc, "div", "wmf-form__ombre");
  {
    const dedans = champsDe(ombre);
    const bascule = el<HTMLInputElement>(doc, "input", "");
    bascule.type = "checkbox";
    bascule.id = "wmf-ombre";
    bascule.checked = fiche.ombre !== null;
    const peindreOmbre = (): void => {
      corpsOmbre.hidden = fiche.ombre === null;
    };
    bascule.addEventListener("change", () => {
      fiche = {
        ...fiche,
        ombre: bascule.checked
          ? Object.fromEntries(OMBRE.map((c) => [c.clef, valeursOmbre[c.clef] ?? ""]))
          : null,
      };
      peindreOmbre();
      ecrire();
    });
    dedans.appendChild(
      ligne(doc, "MON PERSONNAGE REJOINT LE GROUPE OMBRE", bascule),
    );
    const valeursOmbre: Record<string, string> = { ...(fiche.ombre ?? {}) };
    for (const c of OMBRE) {
      const champ = saisie(doc, c.clef, valeursOmbre[c.clef] ?? "", true);
      champ.addEventListener("input", () => {
        valeursOmbre[c.clef] = champ.value;
        if (fiche.ombre !== null) {
          fiche = { ...fiche, ombre: { ...fiche.ombre, [c.clef]: champ.value } };
          ecrire();
        }
      });
      corpsOmbre.appendChild(ligne(doc, c.etiquette, champ));
    }
    dedans.appendChild(corpsOmbre);
    peindreOmbre();
  }

  // ── derrière l'écran ─────────────────────────────────────────────

  const joueur = section(doc, "Derrière l'écran");
  for (const c of JOUEUR) {
    unChamp(champsDe(joueur), c, fiche.joueur[c.clef] ?? "", (v) => {
      fiche = { ...fiche, joueur: { ...fiche.joueur, [c.clef]: v } };
    });
  }

  // ── l'assemblage ─────────────────────────────────────────────────

  const tete = el(doc, "div", "panel wmf-form__tete");
  const dedansTete = el(doc, "div", "inner");
  dedansTete.appendChild(el(doc, "div", "h3", "Ta fiche de présentation"));
  dedansTete.appendChild(
    el(
      doc,
      "p",
      "wmf-form__mot",
      "Remplis ce que tu veux : le message en dessous s'écrit tout seul, " +
        "et tu l'envoies quand tu es prête. Rien n'est posté sans toi.",
    ),
  );
  dedansTete.append(dit, reprendre, voirLeTexte);
  tete.appendChild(dedansTete);

  //  L'APERÇU EN DERNIER, après les champs : on remplit, puis on
  //  regarde. Au-dessus, il faudrait remonter pour saisir et
  //  redescendre pour voir.
  cadre.append(tete, perso, hist, poke, ombre, joueur, apercu);
  boite.parentNode?.insertBefore(cadre, boite);

  //  ── ET LE BLOC D'ÉDITION S'EFFACE ───────────────────────────────
  //
  //  SEULEMENT SI LA FICHE EST À NOUS. Sur un message qu'on ne
  //  reconnaît pas, le masquer priverait le joueur du seul endroit où
  //  son texte existe encore — et le formulaire, lui, n'écrit pas.
  //  Il réapparaîtra quand il aura cliqué sur « remplacer ».
  boiteEditeur.hidden = connu;
  voirLeTexte.hidden = !connu;
  //  L'APERÇU DÈS L'OUVERTURE, et pas seulement à la première frappe :
  //  une fiche qu'on rouvre doit se montrer telle qu'elle est.
  peindreLApercu(connu && avant !== "" ? avant : publier(fiche));

  //  ── LE DERNIER MOT AVANT L'ENVOI ────────────────────────────────
  //
  //  Une frappe peut arriver après la dernière écriture — on écrit à
  //  chaque `input`, mais rien n'empêche le navigateur de poster entre
  //  les deux. On réécrit donc au moment de l'envoi, où c'est la
  //  dernière chose qui compte.
  boite.closest("form")?.addEventListener("submit", () => {
    ecrire();
  });

  //  ── LE CATALOGUE ARRIVE APRÈS, ET LE RESTE N'ATTEND PAS ─────────
  //
  //  436 espèces. Les attendre pour poser le formulaire ferait une
  //  page vide le temps de la requête, et une lecture qui échoue
  //  emporterait les trente autres champs avec elle.
  const vide = el<HTMLOptionElement>(doc, "option", "", "Chargement…");
  vide.value = "";
  especeMenu.appendChild(vide);
  especeMenu.disabled = true;
  void d.starters().then((liste) => {
    catalogue = liste;
    especeMenu.textContent = "";
    const aucun = el<HTMLOptionElement>(doc, "option", "", "— aucun pour l'instant —");
    aucun.value = "";
    especeMenu.appendChild(aucun);
    for (const e of liste) {
      const o = el<HTMLOptionElement>(doc, "option", "", e.nom);
      o.value = String(e.id);
      o.selected = e.id === fiche.starter?.especeId;
      especeMenu.appendChild(o);
    }
    especeMenu.disabled = false;
    peindreTalents();
    //  ON REPOSE LE TALENT RELU : le menu vient d'être rempli, et la
    //  valeur d'une fiche rouverte n'y était pas une seconde plus tôt.
    if (fiche.starter !== null) talentMenu.value = fiche.starter.talent;
  }).catch(() => {
    especeMenu.textContent = "";
    const raté = el<HTMLOptionElement>(doc, "option", "", "La liste n'a pas pu être lue");
    raté.value = "";
    especeMenu.appendChild(raté);
  });

  return true;
}

/** La forme attendue d'une entrée de `data/starters.json`, vérifiée.
 *
 *  Le fichier est dérivé et contrôlé par le garde-fou 40, mais il
 *  arrive par le réseau : une réponse tronquée ou une page d'erreur
 *  déguisée ne doit pas peupler le menu de `undefined`. */
export function lireLesStarters(brut: unknown): readonly EspeceDeDepart[] {
  const o = brut as { especes?: unknown };
  if (!Array.isArray(o?.especes)) return [];
  const sortie: EspeceDeDepart[] = [];
  for (const e of o.especes) {
    if (typeof e !== "object" || e === null) continue;
    const x = e as Record<string, unknown>;
    const id = typeof x.id === "number" && Number.isInteger(x.id) && x.id > 0 ? x.id : null;
    const nom = typeof x.nom === "string" && x.nom !== "" ? x.nom : null;
    if (id === null || nom === null) continue;
    sortie.push({
      id,
      nom,
      types: Array.isArray(x.types) ? x.types.filter((t) => typeof t === "string") : [],
      talents: Array.isArray(x.talents)
        ? x.talents.flatMap((t) => {
          const n = (t as Record<string, unknown>)?.nom;
          if (typeof n !== "string" || n === "") return [];
          return [{
            nom: n,
            ...((t as Record<string, unknown>).cache === true ? { cache: true } : {}),
          }];
        })
        : [],
    });
  }
  return sortie;
}
