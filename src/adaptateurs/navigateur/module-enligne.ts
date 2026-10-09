/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-enligne.ts
//
//  « Qui est en ligne ? », maquette `390:3387`.
//
//  ── TROIS COLONNES, ET TROIS SOURCES ────────────────────────────────
//
//  À gauche, qui est connecté maintenant, et deux compteurs. Au
//  milieu, le dernier arrivé et les connectés des vingt-quatre
//  heures. À droite, le clan du moment, sa description et son
//  avantage.
//
//  Ce qui vient d'où est écrit dans `src/navigateur/enligne.ts`, et ça
//  vaut d'être relu avant de toucher à ce fichier : les compteurs et
//  le dernier arrivé sont DANS la page, les listes de connectés n'y
//  sont que si l'option est cochée dans le panneau d'administration,
//  et le clan vient de `data/clans.json`.
//
//  ── CE QU'ON FAIT QUAND FORUMACTIF NE DIT RIEN ──────────────────────
//
//  Relevé sur Wild Mystery le 8 octobre : l'option « qui est en
//  ligne » n'est pas cochée, et la page ne porte aucune liste. Les
//  deux cartes gardent alors leur titre et disent qu'elles sont vides,
//  au lieu de disparaître.
//
//  C'est un choix, et il tient à qui lit : une carte absente laisse
//  croire que la page est cassée ; une carte qui dit « personne pour
//  l'instant » dit la vérité, et le jour où l'option est cochée elle
//  se remplit sans qu'on touche à rien.
// ════════════════════════════════════════════════════════════════════

import {
  type Chiffres,
  type Clan,
  clanDuMoment,
  nombreEcrit,
  type Onglet,
  ongletsDesClans,
  rienAMontrer,
} from "../../navigateur/enligne.ts";
import { estLIndex } from "./module-vie.ts";

/** Le conteneur que le module remplit. Il se pose lui-même. */
export const ANCRE = "wm-enligne";

/** Le bloc que `index_body` sert, et que le panneau REMPLACE.
 *
 *  ── POURQUOI IL Y EN AVAIT DEUX ─────────────────────────────────────
 *
 *  « Pourquoi est-ce que j'en ai 2 qui s'affiche ? », 9 octobre. Parce
 *  que le gabarit imprimait le bloc « qui est en ligne » de ModernBB
 *  et que le script en AJOUTAIT un second à la fin de l'index. Deux
 *  blocs, deux vérités, et aucune des deux n'était fausse.
 *
 *  La correction est dans le gabarit, pas dans le script : le bloc de
 *  Forumactif devient une SOURCE — `templates/index_body.nouveau.html`
 *  met les deux listes de connectés dans des balises nommées — et le
 *  script se pose À SA PLACE, en le retirant.
 *
 *  ── POURQUOI PAS UN `display: none` DANS LA FEUILLE ─────────────────
 *
 *  Parce qu'un script qui ne tourne pas ne doit pas emporter
 *  l'information avec lui. Caché en CSS, le bloc d'origine disparaît
 *  même quand il est le seul à rester. Retiré par le script, il ne
 *  disparaît qu'une fois remplacé. */
export const SOURCE = "wm-qeel";

/** Où chercher les connectés. Le nom du gabarit d'abord, celui de
 *  ModernBB ensuite : le module marche avant que le gabarit soit posé,
 *  et il marchera encore si un jour il ne l'est plus. */
export const SOURCES_MAINTENANT = ["#wm-qeel-maintenant", "#onlinelist"] as const;
export const SOURCES_24H = ["#wm-qeel-24h", "#onlinelist_24h"] as const;

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  nom: K,
  classe: string,
  texte?: string,
): HTMLElementTagNameMap[K] {
  const n = doc.createElement(nom);
  n.className = classe;
  if (texte !== undefined) n.textContent = texte;
  return n;
}

// ── ce que la page sait déjà ────────────────────────────────────────

/** Les trois sources de chiffres, du gabarit vers ModernBB.
 *
 *  ── POURQUOI LE GABARIT PASSE DEVANT ────────────────────────────────
 *
 *  « Pourquoi j'ai plus le nombre de messages et le nombre de membres
 *  dans le QEEL ? », 9 octobre. Parce que `div.statistics` n'est pas
 *  dans `index_body` : ModernBB l'écrit dans `overall_footer_begin`,
 *  lignes 38 à 50. Le panneau dépendait donc d'un gabarit qu'on ne
 *  touche pas, et le jour où ce bloc a disparu — gabarit republié,
 *  option du panneau d'administration —, les compteurs sont passés à
 *  « — » sans que rien n'explique pourquoi.
 *
 *  `index_body.nouveau.html` sert maintenant les trois variables dans
 *  ses propres balises, à côté des listes de connectés. Le panneau les
 *  lit là d'abord. `.statistics` reste le second recours, pour le
 *  forum dont le gabarit n'est pas encore posé. */
export const SOURCES_MESSAGES = ["#wm-qeel-messages"] as const;
export const SOURCES_MEMBRES = ["#wm-qeel-membres"] as const;
export const SOURCES_DERNIER = ["#wm-qeel-dernier"] as const;

/** Le nombre porté par un conteneur, qu'il soit nu ou dans une phrase.
 *
 *  ── UNE VARIABLE FORUMACTIF N'EST PAS UN NOMBRE ─────────────────────
 *
 *  `{TOTAL_POSTS}` ne rend pas « 436 » : il rend « Nos membres ont
 *  posté un total de <strong>436</strong> messages ». La phrase change
 *  avec la langue du forum, le `<strong>` non — on prend donc le
 *  PREMIER `<strong>` quand il y en a un, et le texte entier sinon,
 *  pour le cas où une version servirait le nombre nu.
 *
 *  C'est la même règle que pour `.statistics`, et c'est elle qui fait
 *  qu'un forum passé en anglais rend les mêmes nombres. */
export function nombreDuBloc(bloc: Element | null): number | null {
  if (bloc === null) return null;
  const fort = bloc.querySelector("strong");
  return nombreEcrit((fort ?? bloc).textContent ?? "");
}

/** Lit les trois chiffres : le gabarit d'abord, `.statistics` ensuite.
 *
 *  ON LIT DES POSITIONS ET DES BALISES, PAS DES PHRASES. ModernBB écrit
 *  « Nos membres ont posté un total de 436 messages » ; chercher le
 *  nombre dans ce texte marcherait aujourd'hui et rendrait zéro le jour
 *  où le forum change de langue ou de libellés. Ce qui ne change pas,
 *  c'est la structure : un `<strong>` dans chaque ligne, et trois
 *  `.statistics-item` dans l'ordre.
 *
 *  Chaque ligne manquante vaut `null`, pas zéro — « ce forum a zéro
 *  message » et « je n'ai pas su lire » ne s'affichent pas pareil. */
export function chiffresDe(doc: Document): Chiffres {
  const premier = (selecteurs: readonly string[]): Element | null =>
    selecteurs.map((x) => doc.querySelector(x)).find((e) => e !== null) ?? null;

  const items = Array.from(doc.querySelectorAll(".statistics .statistics-item"));

  //  Le gabarit d'abord. Un bloc présent mais illisible ne fait pas
  //  retomber sur `.statistics` : s'il est là et vide, c'est que la
  //  variable n'a rien rendu, et `.statistics` dirait la même chose.
  const duGabarit = premier(SOURCES_MESSAGES) !== null;

  const messages = duGabarit
    ? nombreDuBloc(premier(SOURCES_MESSAGES))
    : nombreDuBloc(items[0] ?? null);
  const membres = duGabarit
    ? nombreDuBloc(premier(SOURCES_MEMBRES))
    : nombreDuBloc(items[1] ?? null);

  //  Le dernier arrivé est le seul des trois à porter un lien : c'est
  //  ce lien qu'on reprend, et pas une adresse reconstruite à partir
  //  du pseudo — un pseudo n'est pas un identifiant.
  const boite = duGabarit ? premier(SOURCES_DERNIER) : (items[2] ?? null);
  const lien = boite?.querySelector<HTMLAnchorElement>("a[href]") ?? null;
  const pseudo = (lien?.textContent ?? "").replace(/\s+/g, " ").trim();
  const url = lien?.getAttribute("href") ?? "";

  return {
    messages,
    membres,
    dernierArrive: pseudo === "" || url === "" ? null : { pseudo, url },
  };
}

/** Un membre relevé dans une liste de connectés.
 *
 *  `couleur` est celle de son GROUPE, telle que Forumactif l'écrit —
 *  vide s'il n'en a pas. `groupes` garde ses classes `group-N`, pour
 *  qu'une règle de feuille puisse les viser un jour. */
export type Connecte = {
  readonly pseudo: string;
  readonly url: string;
  readonly couleur: string;
  readonly groupes: readonly string[];
};

/** La couleur de groupe écrite dans un `style` en ligne.
 *
 *  ── POURQUOI ON LA CHERCHE À TROIS ENDROITS ─────────────────────────
 *
 *  « Les joueurs connectés, on doit voir la couleur de leur groupe »,
 *  9 octobre. Je ne la perdais pas par choix ici : je ne lisais que le
 *  TEXTE du lien, et la couleur n'est pas dans le texte.
 *
 *  Forumactif l'écrit de trois façons selon la page et la version :
 *  sur le `<a>` lui-même, sur un `<span class="group-N usr_grp_clr">`
 *  DEDANS, ou sur un `<span>` qui ENVELOPPE le lien. On regarde les
 *  trois, dans cet ordre, et on prend la première trouvée.
 *
 *  ON LIT L'ATTRIBUT, PAS LE STYLE CALCULÉ : un style calculé rendrait
 *  la couleur héritée de la feuille pour un membre sans groupe, donc
 *  tout le monde aurait une couleur et plus personne ne se
 *  distinguerait. L'attribut, lui, n'existe que si Forumactif l'a
 *  écrit. */
export function couleurDeGroupe(a: Element): string {
  const candidats: (Element | null)[] = [
    a,
    a.querySelector("[style*='color']"),
    a.closest("span[style*='color']"),
  ];
  for (const n of candidats) {
    if (n === null) continue;
    const m = (n.getAttribute("style") ?? "").match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    const c = (m?.[1] ?? "").trim();
    if (c !== "") return c;
  }
  return "";
}

/** Ses classes `group-N`, sur le lien ou juste dedans. */
export function groupesDe(a: Element): readonly string[] {
  const vus = new Set<string>();
  for (const n of [a, ...Array.from(a.querySelectorAll("[class*='group-']"))]) {
    for (const c of Array.from(n.classList)) {
      if (/^group-\d+$/.test(c)) vus.add(c);
    }
  }
  return Array.from(vus);
}

/** Les membres d'une liste de connectés servie par Forumactif.
 *
 *  ── POURQUOI ON CHERCHE LARGE ───────────────────────────────────────
 *
 *  Le bloc « qui est en ligne » n'est pas dans la page de Wild Mystery
 *  — l'option est décochée — donc on ne peut pas relever son balisage
 *  exact comme on l'a fait pour tout le reste. On vise donc ce qui est
 *  stable d'un thème à l'autre : un conteneur dont l'identifiant parle
 *  de connexion, et dedans, des liens de profil.
 *
 *  UN LIEN DE PROFIL SE RECONNAÎT À SON ADRESSE, `/uN`. C'est plus sûr
 *  qu'une classe : Forumactif met `usr_grp_clr` et `group-N` sur les
 *  pseudos colorés, mais pas sur ceux des groupes sans couleur. */
export function connectesDe(
  doc: Document,
  selecteurs: readonly string[],
): readonly Connecte[] {
  //  Le PREMIER conteneur présent gagne, et on ne fusionne pas : deux
  //  conteneurs présents voudrait dire que le gabarit et ModernBB
  //  donnent la même liste deux fois, et on l'afficherait en double.
  //  C'est exactement la faute qu'on vient de corriger.
  const bloc = selecteurs.map((s) => doc.querySelector(s)).find((b) => b !== null) ?? null;
  if (bloc === null) return [];
  const vus = new Set<string>();
  const sortie: Connecte[] = [];
  for (const a of Array.from(bloc.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const url = a.getAttribute("href") ?? "";
    if (!/\/u\d+/.test(url)) continue;
    const pseudo = (a.textContent ?? "").replace(/\s+/g, " ").trim();
    //  Un même membre peut apparaître deux fois — une fois en lien,
    //  une fois dans une infobulle. On garde le premier.
    if (pseudo === "" || vus.has(url)) continue;
    vus.add(url);
    sortie.push({ pseudo, url, couleur: couleurDeGroupe(a), groupes: groupesDe(a) });
  }
  return sortie;
}

// ── le dessin ───────────────────────────────────────────────────────

function carte(doc: Document, titre: string, classe: string): HTMLElement {
  const c = el(doc, "section", `wm-enligne__carte ${classe}`);
  c.appendChild(el(doc, "h3", "wm-enligne__carte-titre", titre));
  return c;
}

/** La liste des connectés, ou la phrase qui dit qu'il n'y en a pas. */
function listeDeConnectes(doc: Document, gens: readonly Connecte[]): HTMLElement {
  if (gens.length === 0) {
    //  « Personne pour l'instant » plutôt que rien : une carte vide
    //  sans un mot laisse croire que le chargement a échoué.
    return el(doc, "p", "wm-enligne__personne", "Personne pour l'instant");
  }
  const ul = el(doc, "ul", "wm-enligne__gens");
  for (const g of gens) {
    const li = el(doc, "li", "wm-enligne__gens-item");
    const a = doc.createElement("a");
    a.className = "wm-enligne__gens-lien";
    for (const c of g.groupes) a.classList.add(c);
    a.href = g.url;
    a.textContent = g.pseudo;
    //  ── LA COULEUR DU GROUPE, EN LIGNE ───────────────────────────
    //  Elle ne peut pas venir de la feuille : les groupes sont créés
    //  dans le panneau d'administration et leurs couleurs avec, donc
    //  le dépôt ne les connaît pas. On recopie celle que Forumactif a
    //  écrite, et on la pose en PROPRIÉTÉ PERSONNALISÉE plutôt qu'en
    //  `color` : la feuille garde ainsi la main sur le survol et sur
    //  l'état visité, en faisant ce qu'elle veut de la teinte.
    if (g.couleur !== "") {
      a.style.setProperty("--wm-couleur-groupe", g.couleur);
      a.dataset.wmGroupeColore = "";
    }
    li.appendChild(a);
    ul.appendChild(li);
  }
  return ul;
}

function compteur(doc: Document, n: number | null, mot: string): HTMLElement {
  const c = el(doc, "div", "wm-enligne__compteur");
  //  Un tiret, et pas un zéro : « ce forum a zéro message » et « je
  //  n'ai pas su lire » ne disent pas la même chose.
  c.appendChild(
    el(doc, "span", "wm-enligne__compteur-n", n === null ? "—" : n.toLocaleString("fr-FR")),
  );
  c.appendChild(el(doc, "span", "wm-enligne__compteur-mot", mot));
  return c;
}

/** La carte d'un clan, seule.
 *
 *  Elle porte sa clé en `data-wm-clan` : la feuille y prend la paire
 *  de jetons `--wm-groupe-<clé>-fond` et `-texte`, qui existe déjà
 *  pour les six clans. Aucune couleur n'est écrite ici. */
function carteDuClan(doc: Document, clan: Clan): HTMLElement {
  const c = el(doc, "section", "wm-enligne__clan");
  c.dataset.wmClan = clan.cle;
  c.appendChild(el(doc, "h3", "wm-enligne__clan-nom", clan.nom));
  c.appendChild(el(doc, "p", "wm-enligne__clan-texte", clan.description));
  if (clan.avantage !== "") {
    const av = el(doc, "div", "wm-enligne__avantage");
    av.appendChild(el(doc, "p", "wm-enligne__avantage-titre", "L'avantage"));
    av.appendChild(el(doc, "p", "wm-enligne__avantage-texte", clan.avantage));
    c.appendChild(av);
  }
  return c;
}

/** La bande des six clans, et la carte de celui qu'on a choisi.
 *
 *  ── LES ONGLETS SONT LA BANDE DE GAUCHE DE LA MAQUETTE ──────────────
 *
 *  « Où sont les groupes en onglets ? », 9 octobre. `390:3387` dessine
 *  six vignettes carrées le long de la carte du clan, et ce sont elles :
 *  une par clan, et elle ouvre le sien. La version précédente montrait
 *  à cet endroit les pokémons emblématiques DU clan affiché — ça se
 *  ressemble de loin, et ça ne fait rien.
 *
 *  ── UN ONGLET SANS TEXTE RESTE, ET NE S'OUVRE PAS ───────────────────
 *
 *  Cinq clans sur six n'ont pas encore leur description. Les retirer
 *  donnerait une bande d'une seule vignette, qui ne ressemble à rien et
 *  qui cacherait le travail qui reste. On les montre donc, éteints et
 *  `aria-disabled` : la bande est complète, et rien d'ouvrable n'est
 *  vide. Le jour où le texte est écrit, l'onglet s'allume tout seul.
 *
 *  ── POURQUOI DES `<button>` ET PAS DES LIENS ────────────────────────
 *
 *  Ils ne mènent nulle part : ils changent ce qu'on voit, dans la page,
 *  sans rien charger. C'est la définition d'un bouton, et c'est aussi
 *  ce qui le rend atteignable au clavier sans qu'on s'en occupe.
 *
 *  Sans JavaScript il n'y a ni bande ni carte — tout ce bloc est posé
 *  par le script. */
function blocDesClans(
  doc: Document,
  onglets: readonly Onglet[],
  actif: Clan,
  icone: (cle: string) => string | null,
): HTMLElement {
  const bloc = el(doc, "div", "wm-enligne__clan-bloc");

  const bande = el(doc, "div", "wm-enligne__onglets");
  bande.setAttribute("role", "tablist");
  bande.setAttribute("aria-label", "Les clans de Rhode");
  const boutons: HTMLButtonElement[] = [];
  let carte = carteDuClan(doc, actif);

  for (const o of onglets) {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "wm-enligne__onglet";
    b.dataset.wmClan = o.cle;
    b.setAttribute("role", "tab");
    const url = icone(o.cle);
    if (url !== null) {
      const img = doc.createElement("img");
      img.src = url;
      //  Le nom est déjà dans le bouton, en texte : une alternative
      //  le dirait deux fois à qui écoute la page.
      img.alt = "";
      img.loading = "lazy";
      b.appendChild(img);
    }
    //  Le nom du clan, lisible par un lecteur d'écran et masqué à
    //  l'œil par la feuille : une vignette seule ne dit rien.
    b.appendChild(el(doc, "span", "wm-enligne__onglet-nom", o.nom));

    if (o.clan === null) {
      b.disabled = true;
      b.setAttribute("aria-disabled", "true");
      b.title = `${o.nom} — ce clan n'a pas encore sa description`;
    } else {
      const clan = o.clan;
      b.setAttribute("aria-selected", String(clan.cle === actif.cle));
      b.addEventListener("click", () => {
        const neuve = carteDuClan(doc, clan);
        carte.replaceWith(neuve);
        carte = neuve;
        for (const autre of boutons) {
          autre.setAttribute("aria-selected", String(autre.dataset.wmClan === clan.cle));
        }
      });
    }
    boutons.push(b);
    bande.appendChild(b);
  }

  bloc.appendChild(bande);
  bloc.appendChild(carte);
  return bloc;
}

export type Dependances = {
  readonly doc: Document;
  /** Le contenu de `data/clans.json`, déjà décodé. */
  readonly clans: unknown;
  /** Rend l'adresse de la vignette d'un clan, ou `null`. Injecté,
   *  comme tout ce qui est une adresse : ce module ne sait pas où le
   *  dépôt est servi, et il n'a pas à l'apprendre. */
  readonly icone?: (cle: string) => string | null;
  /** L'adresse du Sabelette de fond, ou `null`. */
  readonly mascotte?: string | null;
  /** Rend l'adresse de l'avatar d'un membre depuis l'adresse de son
   *  profil, ou `null`. Injecté : ce module ne fait pas de réseau, et
   *  le harnais doit pouvoir répondre sans en faire non plus. */
  readonly avatarDe?: (urlDuProfil: string) => Promise<string | null>;
};

/** Pose le bloc à la fin de l'index. Rend `true` s'il l'a posé.
 *
 *  Il se range APRÈS la vie de Rhode, donc tout en bas : c'est l'ordre
 *  de la maquette, et c'est aussi le bon ordre de lecture — les
 *  forums, ce qui s'y passe, puis qui l'habite. */
export function poserQuiEstEnLigne(
  { doc, clans, icone = () => null, mascotte = null, avatarDe }: Dependances,
): boolean {
  if (!estLIndex(doc.location?.pathname ?? "")) return false;

  //  Deux fois posé, c'est deux blocs à l'écran. Ça n'arrive pas
  //  aujourd'hui — le paquet n'appelle qu'une fois — mais le jour où
  //  un rechargement partiel le rappellerait, mieux vaut un retour
  //  sec qu'un doublon.
  if (doc.getElementById(ANCRE) !== null) return false;

  const chiffres = chiffresDe(doc);
  const clan = clanDuMoment(clans);
  if (rienAMontrer(chiffres, clan)) return false;

  //  ── OÙ LE PANNEAU SE POSE ───────────────────────────────────────
  //  À la place du bloc du gabarit quand il est là : c'est lui qui
  //  tient la bonne position, juste après `{BOARD_INDEX}`, et c'est
  //  en le remplaçant qu'on cesse d'en avoir deux.
  //
  //  Sinon, après la dernière catégorie — le cas d'un forum dont le
  //  gabarit n'est pas encore posé, ou dont l'option « qui est en
  //  ligne » est décochée : Forumactif ne sert alors pas le bloc du
  //  tout.
  const source = doc.getElementById(SOURCE);
  const blocs = doc.querySelectorAll(".forabg, .forumbg");
  const dernier = blocs.length === 0 ? null : blocs[blocs.length - 1];
  if (source === null && dernier === null) return false;

  const racine = el(doc, "section", "wm-enligne");
  racine.id = ANCRE;
  racine.setAttribute("aria-label", "Qui est en ligne");

  //  ── LE SABELETTE, EN FOND ──────────────────────────────────────
  //  « Le sabelette va dans le fond, comme sur la maquette. »
  //  `390:3387` le pose en haut à droite, grand, et il DÉBORDE du
  //  bloc par le haut — c'est ce débordement qui fait qu'il décore au
  //  lieu d'illustrer.
  //
  //  Un `<img>` et pas un fond CSS : une feuille du dépôt ne part pas
  //  chercher une image (garde-fou n° 7), et surtout un fond ne se
  //  cadre pas sur un débordement sans qu'on lui donne des cotes en
  //  dur. `aria-hidden` : il ne dit rien, il décore.
  if (mascotte !== null) {
    const bete = doc.createElement("img");
    bete.className = "wm-enligne__mascotte";
    bete.src = mascotte;
    bete.alt = "";
    bete.loading = "lazy";
    bete.setAttribute("aria-hidden", "true");
    racine.appendChild(bete);
  }

  racine.appendChild(el(doc, "h2", "wm-enligne__titre", "Qui est en ligne ?"));

  const panneau = el(doc, "div", "wm-enligne__panneau");

  // ── colonne 1 : en ligne maintenant, et les deux compteurs ───────
  const col1 = el(doc, "div", "wm-enligne__colonne");
  const maintenant = carte(doc, "Actuellement en ligne", "wm-enligne__carte--haute");
  maintenant.appendChild(listeDeConnectes(doc, connectesDe(doc, SOURCES_MAINTENANT)));
  col1.appendChild(maintenant);
  const compteurs = el(doc, "div", "wm-enligne__compteurs");
  compteurs.appendChild(compteur(doc, chiffres.messages, "messages"));
  compteurs.appendChild(compteur(doc, chiffres.membres, "membres"));
  col1.appendChild(compteurs);
  panneau.appendChild(col1);

  // ── colonne 2 : le dernier arrivé, et les vingt-quatre heures ────
  const col2 = el(doc, "div", "wm-enligne__colonne");
  if (chiffres.dernierArrive !== null) {
    const accueil = el(doc, "div", "wm-enligne__bienvenue");
    //  « Bienvenue » chevauche la carte dans la maquette, comme le
    //  titre des actualités sur l'accueil. C'est la feuille qui le
    //  fait ; ici il est simplement avant.
    accueil.appendChild(el(doc, "p", "wm-enligne__bienvenue-mot", "Bienvenue"));
    const fiche = el(doc, "div", "wm-enligne__arrive");
    //  ── LE ROND EST L'EMPLACEMENT DE SON AVATAR ─────────────────
    //
    //  « Pour le dernier arrivant, le rond à côté c'est pour afficher
    //  son avatar », 9 octobre.
    //
    //  IL RESTE VIDE PAR DÉFAUT, ET C'EST VOULU. Forumactif ne sert
    //  l'avatar nulle part sur l'index : il faut aller le lire sur la
    //  page de profil, donc une requête. On la lance, et le rond se
    //  remplit quand elle revient — jamais avant, jamais à sa place.
    //  Si elle échoue, ou si le membre n'a pas d'avatar, le rond
    //  garde son fond doux : c'est le dessin d'origine, pas une
    //  panne.
    const rond = el(doc, "span", "wm-enligne__arrive-rond");
    fiche.appendChild(rond);
    if (avatarDe !== undefined) {
      const qui = chiffres.dernierArrive;
      avatarDe(qui.url).then((adresse) => {
        if (adresse === null || adresse === "") return;
        const img = doc.createElement("img");
        img.className = "wm-enligne__arrive-avatar";
        img.src = adresse;
        //  Décoratif : son pseudo est juste à côté, en toutes
        //  lettres et en lien. Le dire deux fois encombre.
        img.alt = "";
        img.loading = "lazy";
        rond.appendChild(img);
        rond.dataset.wmAvatar = "";
      }).catch(() => {});
    }
    const a = doc.createElement("a");
    a.className = "wm-enligne__arrive-nom";
    a.href = chiffres.dernierArrive.url;
    a.textContent = chiffres.dernierArrive.pseudo;
    fiche.appendChild(a);
    accueil.appendChild(fiche);
    col2.appendChild(accueil);
  }
  const vingtQuatre = carte(
    doc,
    "Connectés dans les 24 dernières heures",
    "wm-enligne__carte--haute",
  );
  vingtQuatre.appendChild(listeDeConnectes(doc, connectesDe(doc, SOURCES_24H)));
  col2.appendChild(vingtQuatre);
  panneau.appendChild(col2);

  // ── colonne 3 : la bande des clans, et celui du moment ───────────
  if (clan !== null) {
    const col3 = el(doc, "div", "wm-enligne__colonne wm-enligne__colonne--clan");
    col3.appendChild(blocDesClans(doc, ongletsDesClans(clans), clan, icone));
    panneau.appendChild(col3);
  }

  racine.appendChild(panneau);

  //  LE REMPLACEMENT EST LE DERNIER GESTE, et c'est voulu : tout ce
  //  qui précède a LU la source. Si on l'avait retirée d'abord, les
  //  deux listes seraient vides et on aurait remplacé une information
  //  par deux « personne pour l'instant ».
  if (source !== null) source.replaceWith(racine);
  else dernier?.parentNode?.insertBefore(racine, dernier.nextSibling);
  return true;
}
