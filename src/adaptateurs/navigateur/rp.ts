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
import { aNommer, ligneEnAttente, lignesDepuis } from "../../navigateur/bilan.ts";
import { rubriquesEnAttente } from "../../application/bilan.ts";
import { cumuler, type LigneRegistre } from "../../domaine/cloture.ts";
import { especesDepuis } from "./catalogue.ts";
import {
  adresseDuSujet,
  etatVu,
  FAMILLE_ZONE,
  familleDuForum,
  garderLesRp,
  type LigneDeRp,
  MOTS,
  partagerLesRp,
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
  //  LA RACINE DES DONNÉES, pour `carte.json`, `forums.json` et
  //  `especes.json` — les fichiers qui donnent son tag à un RP et un
  //  nom à une espèce. Facultative : sans elle, les cartes s'affichent
  //  sans tag, et rien d'autre ne change.
  readonly racine?: string | null;
  //  LES POKÉMON DE LA PERSONNE, pour nommer l'expérience du récap.
  //
  //  LE MODULE POSÉ DANS LE SUJET NE PEUT PAS LES NOMMER : il ne
  //  connaît que des identifiants, et `joueur` n'est lisible que par
  //  son propriétaire — c'est la bonne politique. Ici, on EST chez
  //  soi : le carnet les a déjà en main, sans une requête de plus.
  //
  //  Facultatifs : sans eux, `ligneEnAttente` écrit « ton Pokémon »,
  //  ce qui est vrai et lisible.
  readonly pokemon?: readonly PokemonNomme[];
};

/** Juste ce qu'il faut d'un Pokémon pour l'écrire dans un récap.
 *
 *  PAS `PokemonDuCarnet` : ce fichier n'a pas besoin du niveau, du
 *  sexe ni de la boîte, et un type large ici obligerait l'appelant à
 *  tout donner pour afficher un nom. */
export type PokemonNomme = {
  readonly id: string;
  readonly surnom: string | null;
  readonly especeId: number;
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
/** Les noms d'espèces, lus une fois.
 *
 *  LE MÊME FICHIER QUE LE MODULE DU SUJET — `especes.json`, 444
 *  espèces — et pris en entier : un récap en nomme volontiers une
 *  dizaine, et une requête par identifiant serait dix allers-retours
 *  pour le même fichier. */
async function lireLesEspeces(
  racine: string | null | undefined,
): Promise<ReadonlyMap<number, string>> {
  if (racine === undefined || racine === null || racine === "") return new Map();
  const reponse = await fetch(`${racine}especes.json`, { credentials: "omit" })
    .catch(() => null);
  if (reponse === null || !reponse.ok) return new Map();
  return especesDepuis(await reponse.json().catch(() => null));
}

const ETATS: readonly { readonly clef: string; readonly mot: string }[] = [
  { clef: "prevu", mot: "prévu" },
  { clef: "en-cours", mot: "en cours" },
  { clef: "solo", mot: "solo" },
  { clef: "en-pause", mot: "en pause" },
  //  ── LE SIXIÈME, DEPUIS LE 23 NOVEMBRE ────────────────────────────
  //
  //  « Il faudrait aussi une colonne abandonné. »
  //
  //  ABANDONNÉ N'EST PAS EN-PAUSE, et c'est pour ça qu'il faut un mot
  //  de plus plutôt qu'un usage détourné : une pause est un RP qu'on
  //  reprendra, un abandon un RP qu'on ne reprendra pas. Le joueur sait
  //  lequel est lequel ; le code, non.
  //
  //  IL EST AVANT « clôturé » parce que l'ordre de cette liste EST
  //  l'ordre des colonnes, et qu'on lit de l'intention vers la fin : du
  //  prévu au clos, en passant par ce qui s'est arrêté.
  { clef: "abandonne", mot: "abandonné" },
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
  //  ── LES GENS QU'ON ATTEND, TAPÉS À LA MAIN ───────────────────────
  //
  //  « Si la personne n'a pas encore répondu, faudrait pouvoir les
  //  rajouter manuellement. » — 23 novembre.
  //
  //  DEUX SOURCES, ET C'EST VOULU : `rp_participant` dit qui a POSTÉ,
  //  un fait du forum ; `rp_invite` dit qui J'ATTENDS, une annotation
  //  qui peut être fausse. Les fondre en une seule table aurait fait
  //  d'une intention un fait.
  const invites = new Map<number, string[]>();
  /** Les colonnes que le joueur a cachées.
   *
   *  ── UN ENSEMBLE DES CACHÉES, PAS DES MONTRÉES ────────────────────
   *
   *  C'est le même choix que le `default true` de la base, et pour la
   *  même raison : au premier affichage, avant que la lecture réponde,
   *  cet ensemble est VIDE — donc tout est montré. Un ensemble des
   *  montrées serait vide aussi, et la page s'ouvrirait sans aucune
   *  colonne pendant un aller-retour réseau. */
  const cachees = new Set<string>();
  /** Les deux listes fondues, sans moi et sans doublon.
   *
   *  SANS MOI : la relève range TOUS les participants, y compris celui
   *  qui lit, et l'afficher ferait « avec Jake » sur le carnet de Jake.
   *
   *  SANS DOUBLON, ET LA CASSE NE COMPTE PAS : quand l'invité finit par
   *  poster, la relève l'écrit dans `rp_participant` et il serait là
   *  deux fois. Comparer en minuscules, parce que « Erin » et « erin »
   *  sont la même personne pour qui a tapé le nom.
   *
   *  L'INVITÉ NE S'EFFACE PAS TOUT SEUL quand le fait le rejoint : c'est
   *  au joueur de le retirer. Effacer son annotation parce qu'elle s'est
   *  réalisée serait effacer ce qu'il avait écrit. */
  const avecQui = (sujetId: number): string[] => {
    const vus = new Set<string>([r.pseudo.trim().toLowerCase()]);
    const sortie: string[] = [];
    for (const p of [...(compagnons.get(sujetId) ?? []), ...(invites.get(sujetId) ?? [])]) {
      const clef = p.trim().toLowerCase();
      if (clef === "" || vus.has(clef)) continue;
      vus.add(clef);
      sortie.push(p.trim());
    }
    return sortie;
  };
  //  LES NOMS DE COLONNES, par clé d'état. Vide au départ : une
  //  colonne sans entrée porte son mot par défaut.
  const noms = new Map<string, string>();

  //  LE BLOC DES SMS EST FACULTATIF : une page collée avant le
  //  20 novembre ne l'a pas, et le reste doit marcher quand même. Les
  //  conversations restent alors dans le tableau, comme avant.
  const sms = doc.querySelector<HTMLElement>("[data-wm-rp-sms]");
  const smsBloc = doc.querySelector<HTMLElement>("[data-wm-rp-sms-bloc]");
  const smsCompte = doc.querySelector<HTMLElement>("[data-wm-rp-sms-compte]");

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

  //  ── CE QUE LA CLÔTURE VERSERAIT ─────────────────────────────────
  //
  //  « Ce serait cool aussi d'avoir un récap pour les rps des zones
  //  sauvages de ce qu'on va récupérer si on clôture le sujet (rp solo
  //  et à plusieurs). » — 20 novembre.
  //
  //  LE CUMUL EST CELUI DU DOMAINE, PAS UN SECOND CALCUL. `cumuler`
  //  rejoue le registre dans l'ordre des messages : une ball trouvée au
  //  message 3 peut être lancée au message 7, et seul l'ordre le dit.
  //  Recompter ici donnerait deux vérités pour le même sujet, et la
  //  nôtre serait la fausse le jour où une règle change.
  //
  //  « SOLO ET À PLUSIEURS » SE RÈGLE TOUT SEUL : on ne garde que les
  //  lignes à son nom. Un RP à trois montre donc ce que la personne
  //  toucherait, elle, et pas le butin de la table.
  //
  //  UNE SEULE ESPÈCE DE CACHE : les noms d'espèces, qui sont un
  //  fichier. Le registre, lui, est relu à chaque ouverture — il bouge
  //  à chaque message posté, et un récap d'hier serait pire que pas de
  //  récap.
  let lesEspeces: Promise<ReadonlyMap<number, string>> | null = null;

  const nomsDObjets = async (ids: readonly number[]): Promise<ReadonlyMap<number, string>> => {
    const index = new Map<number, string>();
    //  `in.()` SUR UNE LISTE VIDE EST UNE ERREUR CÔTÉ POSTGREST, d'où
    //  ce retour avant la requête.
    if (ids.length === 0) return index;
    const lu = await rest(r, `objet?id=in.(${ids.join(",")})&select=id,nom`);
    if (!Array.isArray(lu.corps)) return index;
    for (const o of lu.corps as Record<string, unknown>[]) {
      const id = Number(o.id);
      const nom = String(o.nom ?? "");
      if (Number.isInteger(id) && nom !== "") index.set(id, nom);
    }
    return index;
  };

  const peindreLeButin = async (sujetId: number): Promise<void> => {
    const bloc = g("butin");
    const ou = g("butin-liste");
    if (bloc === null || ou === null) return;
    bloc.hidden = true;
    ou.textContent = "";

    const lu = await rest(
      r,
      `registre?sujet_id=eq.${sujetId}` +
        `&select=joueur_id,message_id,type,charge&order=message_id.asc`,
    );
    //  LE SUJET A PU CHANGER PENDANT LA REQUÊTE : on a rouvert une
    //  autre carte avant que celle-ci réponde. Sans ce test, le récap
    //  d'un sujet s'écrit dans le dialogue d'un autre.
    if (grand?.getAttribute("data-wm-rp-grand-sujet") !== String(sujetId)) return;
    if (!lu.ok) return;

    const miennes: LigneRegistre[] = lignesDepuis(lu.corps)
      .filter((x) => x.joueurId === r.joueurId)
      .map((x) => x.ligne);
    if (miennes.length === 0) return;

    const quoi = aNommer(cumuler(miennes));
    lesEspeces ??= lireLesEspeces(r.racine);
    const [especes, objets] = await Promise.all([lesEspeces, nomsDObjets(quoi.objets)]);
    if (grand?.getAttribute("data-wm-rp-grand-sujet") !== String(sujetId)) return;

    const pokemon = new Map<string, { nom: string; especeId: number }>();
    for (const p of r.pokemon ?? []) {
      //  LE SURNOM D'ABORD, puis le nom d'espèce : c'est l'ordre dans
      //  lequel la personne reconnaît son Pokémon.
      pokemon.set(p.id, {
        nom: p.surnom ?? especes.get(p.especeId) ?? "ton Pokémon",
        especeId: p.especeId,
      });
    }

    const rubriques = rubriquesEnAttente(
      ligneEnAttente(r.pseudo, miennes, { especes, objets, pokemon }),
    );
    if (rubriques.length === 0) return;

    for (const rub of rubriques) {
      const li = doc.createElement("li");
      li.className = "wm-rp__butin-ligne";
      const quoiDit = doc.createElement("span");
      quoiDit.className = "wm-rp__butin-etiquette";
      quoiDit.textContent = rub.etiquette;
      const valeur = doc.createElement("span");
      valeur.className = "wm-rp__butin-valeur";
      valeur.textContent = rub.valeur;
      li.append(quoiDit, valeur);
      ou.append(li);
    }
    bloc.hidden = false;
  };

  /** La liste des gens qu'on attend, avec une croix sur chacun.
   *
   *  ── ON N'Y MET QUE LES INVITÉS, PAS LES PARTICIPANTS RELEVÉS ─────
   *
   *  La ligne « avec … » au-dessus montre déjà les deux fondus. Ici, ce
   *  sont les seuls qu'on peut RETIRER : on n'efface pas quelqu'un qui a
   *  posté, ce serait nier un fait du forum. Une croix qui ne marche
   *  qu'une fois sur deux apprend à se méfier de l'écran.
   *
   *  ET CELUI QUI A FINI PAR POSTER RESTE AFFICHÉ ICI, avec sa croix :
   *  c'est le joueur qui décide de ranger son annotation, pas nous.
   *  Elle est devenue redondante, elle n'est pas devenue fausse. */
  const peindreLesInvites = (sujetId: number): void => {
    const ou = g("invites");
    if (ou === null) return;
    ou.textContent = "";
    const miens = invites.get(sujetId) ?? [];
    if (miens.length === 0) {
      const vide = doc.createElement("li");
      vide.className = "wm-rp__invites-vide";
      //  UN MOT PLUTÔT QU'UNE LISTE VIDE : « personne pour l'instant »
      //  se lit, un blanc laisse croire que ça n'a pas chargé.
      vide.textContent = "Personne d'ajouté pour l'instant.";
      ou.append(vide);
      return;
    }
    for (const pseudo of miens) {
      const li = doc.createElement("li");
      li.className = "wm-rp__invite";
      const mot = doc.createElement("span");
      mot.textContent = pseudo;
      const oter = doc.createElement("button");
      oter.type = "button";
      oter.className = "wm-rp__invite-oter";
      oter.setAttribute("data-wm-rp-desinviter", pseudo);
      oter.append(doc.createTextNode("×"));
      const ditOter = doc.createElement("span");
      ditOter.className = "wm-carnet__hors-ecran";
      ditOter.textContent = `Retirer ${pseudo}`;
      oter.append(ditOter);
      oter.addEventListener("click", () => {
        void (async () => {
          //  LE PSEUDO EST DANS L'ADRESSE, donc il s'échappe : un nom
          //  avec une virgule ou un espace casserait la requête, et
          //  « Jean-Luc, dit Jango » est un pseudo possible.
          const fait = await rest(
            r,
            `rp_invite?sujet_id=eq.${sujetId}&pseudo=eq.${encodeURIComponent(pseudo)}`,
            { method: "DELETE", headers: { Prefer: "return=minimal" } },
          );
          if (!fait.ok) return;
          invites.set(sujetId, (invites.get(sujetId) ?? []).filter((x) => x !== pseudo));
          peindreLesInvites(sujetId);
          peindre();
        })();
      });
      li.append(mot, oter);
      ou.append(li);
    }
  };

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
      const qui = avecQui(l.sujetId);
      avec.textContent = qui.length === 0 ? "" : `avec ${qui.join(", ")}`;
      avec.hidden = qui.length === 0;
    }

    peindreLesInvites(l.sujetId);

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

    //  ── LE RÉCAP ARRIVE APRÈS, ET LE DIALOGUE N'ATTEND PAS ─────────
    //
    //  Il demande le registre : une requête. Retenir l'ouverture le
    //  temps qu'elle réponde ferait un clic sans effet visible, pour
    //  une ligne qui n'est pas celle qu'on vient chercher.
    //
    //  ET SEULEMENT EN ZONE SAUVAGE : ailleurs, le registre n'a rien à
    //  verser, et la requête serait posée pour rien. Le tag se déduit
    //  du même fichier que celui de la carte, donc les deux disent
    //  toujours la même chose.
    const butin = g("butin");
    if (butin !== null) butin.hidden = true;
    if (familleDuForum(l.forumId, forums) === FAMILLE_ZONE) {
      void peindreLeButin(sujetId);
    }
  };

  if (grand !== null) {
    g("fermer")?.addEventListener("click", () => grand.close());
    const inviter = (): void => {
      const champ = g("invite");
      const sujetId = Number(grand.getAttribute("data-wm-rp-grand-sujet"));
      if (!(champ instanceof HTMLInputElement) || !Number.isInteger(sujetId)) return;
      //  LA BORNE EST CELLE DE LA BASE (40 signes, contrainte de la
      //  0066), et un pseudo vide n'est pas un pseudo.
      const pseudo = champ.value.trim().slice(0, 40);
      const ditG = g("dit");
      if (pseudo === "") {
        if (ditG !== null) ditG.textContent = "Il me faut un pseudo.";
        return;
      }
      //  ── DÉJÀ LÀ ? ON LE DIT, ON NE RÉÉCRIT PAS ────────────────────
      //
      //  La clé primaire de la base refuserait le doublon, et le refus
      //  arriverait sous la forme d'un « ça n'a pas pu être ajouté »
      //  que personne ne comprend. On compare en minuscules, comme
      //  `avecQui` : pour qui tape un nom, « Erin » et « erin » sont la
      //  même personne.
      const bas = pseudo.toLowerCase();
      if ((invites.get(sujetId) ?? []).some((x) => x.toLowerCase() === bas)) {
        if (ditG !== null) ditG.textContent = `${pseudo} y est déjà.`;
        champ.value = "";
        return;
      }
      void (async () => {
        const fait = await rest(r, "rp_invite", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            joueur_id: r.joueurId,
            sujet_id: sujetId,
            pseudo,
          }),
        });
        if (!fait.ok) {
          if (ditG !== null) ditG.textContent = "Ça n'a pas pu être ajouté.";
          return;
        }
        invites.set(sujetId, [...(invites.get(sujetId) ?? []), pseudo]);
        champ.value = "";
        if (ditG !== null) ditG.textContent = `${pseudo} ajouté.`;
        peindreLesInvites(sujetId);
        //  ET LA CARTE DERRIÈRE SUIT : le « avec … » du tableau et de
        //  la liste lit la même fusion.
        peindre();
      })();
    };
    g("inviter")?.addEventListener("click", inviter);
    //  ENTRÉE VAUT LE BOUTON : on tape un nom, on tape Entrée. Sans ça,
    //  un champ dans un dialogue sans formulaire avale la touche.
    g("invite")?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key !== "Enter") return;
      e.preventDefault();
      inviter();
    });
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
        if (ditG !== null) ditG.textContent = "Enregistré.";
        peindre();
      })();
    });
  }

  //  ── ON DEMANDE AVANT D'EFFACER ────────────────────────────────────
  //
  //  « Avoir une boîte de dialogue qui demande si on veut vraiment
  //  supprimer ce rp. » — 23 novembre.
  //
  //  UN `<dialog>` ET PAS `confirm()`. La fenêtre du navigateur sort du
  //  cadre, n'a pas notre typographie, et se fait bloquer par certains
  //  réglages — un geste définitif qui ne demande rien parce que la
  //  question n'a pas pu s'afficher, c'est le pire des deux mondes.
  //
  //  LE TITRE DU RP EST DANS LA QUESTION : « supprimer cette carte ? »
  //  ne dit pas laquelle quand on vient de cliquer sur la mauvaise.
  const confirme = doc.querySelector<HTMLDialogElement>("[data-wm-rp-confirme]");
  let aEffacer: number | null = null;

  const effacerVraiment = (sujetId: number): void => {
    void (async () => {
      const fait = await rest(r, `rp?sujet_id=eq.${sujetId}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      //  ON NE RETIRE DE L'ÉCRAN QUE CE QUI EST PARTI DE LA BASE. Sans
      //  ce test, un refus faisait disparaître la carte jusqu'au
      //  rechargement, et le joueur croyait l'avoir effacée.
      if (!fait.ok) {
        dit.textContent = "Cette carte n'a pas pu être retirée.";
        return;
      }
      lignes = lignes.filter((x) => x.sujetId !== sujetId);
      peindre();
    })();
  };

  const demanderAEffacer = (l: LigneDeRp): void => {
    if (confirme === null) {
      //  PAS DE DIALOGUE DANS LA PAGE : on n'efface pas en silence, et
      //  on n'efface pas sans demander non plus. Ce cas n'arrive que si
      //  le markup a été recollé à moitié.
      dit.textContent = "Le dialogue de confirmation manque dans la page.";
      return;
    }
    aEffacer = l.sujetId;
    const quoi = confirme.querySelector("[data-wm-rp-confirme-quoi]");
    if (quoi !== null) {
      quoi.textContent = l.titre === "" ? `Sujet ${l.sujetId}` : `« ${l.titre} »`;
    }
    confirme.showModal();
  };

  if (confirme !== null) {
    confirme.querySelector("[data-wm-rp-confirme-non]")
      ?.addEventListener("click", () => confirme.close());
    confirme.querySelector("[data-wm-rp-confirme-oui]")
      ?.addEventListener("click", () => {
        const sujetId = aEffacer;
        confirme.close();
        //  ON OUBLIE LA CIBLE EN FERMANT : un dialogue réouvert sans
        //  cible effacerait la dernière carte visée, et c'est
        //  exactement le genre de geste qu'on ne peut pas reprendre.
        aEffacer = null;
        if (sujetId !== null) effacerVraiment(sujetId);
      });
    //  ÉCHAP FERME ET OUBLIE AUSSI : `cancel` part avant `close`.
    confirme.addEventListener("close", () => {
      aEffacer = null;
    });
  }

  /** La croix d'une carte, la même dans les deux vues.
   *
   *  ── SUR TOUTES LES COLONNES, DEPUIS LE 23 NOVEMBRE ───────────────
   *
   *  « Peu importe si c'est prévu ou dans une autre colonne. » Elle
   *  n'était que sur les cartes prévues, et la base ne permettait que
   *  celles-là (0037) : la 0066 ouvre les deux.
   *
   *  LA RAISON D'ALORS ÉTAIT BONNE, ET ELLE A CHANGÉ DE SENS : on
   *  n'ajoute qu'une INTENTION, donc on n'effaçait qu'une intention.
   *  Mais la carte n'est pas le sujet — le forum, les messages et le
   *  registre restent, et la relève la remettra si le sujet vit
   *  toujours. On ne disparaît pas d'un RP, on range son carnet. */
  const croix = (l: LigneDeRp): HTMLButtonElement => {
    const oter = doc.createElement("button");
    oter.type = "button";
    oter.className = "wm-rp__croix";
    oter.setAttribute("data-wm-rp-retirer", String(l.sujetId));
    oter.append(doc.createTextNode("×"));
    const ditOter = doc.createElement("span");
    ditOter.className = "wm-carnet__hors-ecran";
    //  LE NOM DANS L'ÉTIQUETTE : six croix identiques dans une colonne
    //  ne se distinguent pas au lecteur d'écran.
    ditOter.textContent = `Retirer « ${l.titre === "" ? `Sujet ${l.sujetId}` : l.titre}` +
      ` » de ton carnet`;
    oter.append(ditOter);
    oter.addEventListener("click", () => demanderAEffacer(l));
    return oter;
  };

  const peindreLeTableau = (lesRp: readonly LigneDeRp[]): void => {
    tableau.textContent = "";
    for (const colonne of ETATS) {
      //  ── CHACUNE SE CACHE, Y COMPRIS LES CLÔTURÉS ─────────────────
      //
      //  « La personne peut afficher les colonnes qu'elle souhaite. » Un
      //  seul chemin pour les six : les clôturés avaient leur
      //  interrupteur à part, et c'était un contrôle de trop dès que le
      //  panneau a existé — voir plus bas.
      if (cachees.has(colonne.clef)) continue;
      const dedans = rangerLesRp(lesRp.filter((l) => l.etat === colonne.clef));
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
        //
        //  ET LES INVITÉS COMPTENT ICI AUSSI, depuis le 23 novembre :
        //  une carte prévue n'a aucun participant relevé — personne n'a
        //  posté — et elle affichait donc un vide alors que le joueur
        //  SAIT avec qui il va écrire.
        const avec = avecQui(l.sujetId);
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
        pied.append(etiquette, quand, loupe, croix(l));
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

  /** Les conversations du Messenger, à plat et dans l'ordre.
   *
   *  PAS DE COLONNES, PAS DE MENU D'ÉTAT : on ne met pas un SMS « en
   *  pause ». Ce qu'on veut savoir d'une conversation, c'est avec qui,
   *  qui a parlé en dernier, et quand.
   *
   *  ── ET ELLES NE RESSEMBLENT NI AU TABLEAU NI À LA LISTE ──────────
   *
   *  « Les sms ça pourrait faire partie des deux onglets. Mais faudrait
   *  les afficher autrement. » — 20 novembre. Des vignettes dans une
   *  rangée qui défile, avec LE NOM DE LA PERSONNE EN PREMIER : un fil
   *  s'appelle « Tu es où ? », ce qui ne dit pas à qui on parle. Un RP
   *  se retrouve par son titre, une conversation par son
   *  correspondant.
   *
   *  `rangerLesRp` TRIE COMME AILLEURS : deux listes du même carnet qui
   *  ne rangent pas pareil se lisent comme deux carnets. */
  const peindreLesSms = (lesSms: readonly LigneDeRp[]): void => {
    if (sms === null) return;
    sms.textContent = "";
    //  AUCUNE CONVERSATION, AUCUN BLOC. Un encadré qui dit « rien »
    //  prend la place d'un encadré qui dirait quelque chose, et sur une
    //  page qui a déjà un tableau il se lit comme une panne. Le tuto
    //  dit où elles arriveront.
    if (smsBloc !== null) smsBloc.hidden = lesSms.length === 0;
    if (lesSms.length === 0) return;
    if (smsCompte !== null) {
      smsCompte.textContent = lesSms.length === 1
        ? "Une conversation au Messenger."
        : `${lesSms.length} conversations au Messenger.`;
    }

    for (const l of rangerLesRp(lesSms)) {
      const vu = etatVu(l, r.pseudo);
      const li = doc.createElement("li");
      li.className = "wm-rp__sms-carte";
      li.setAttribute("data-wm-rp-sms-fil", String(l.sujetId));

      //  ── AVEC QUI, EN PREMIER ──────────────────────────────────
      //
      //  Et pas le titre : un fil de SMS s'appelle « Tu es où ? » ou
      //  « Demain, 9 h », ce qui ne dit pas de qui il s'agit. On
      //  retrouve une conversation par la personne, pas par son sujet.
      //  C'est la différence de fond avec un RP, et c'est pour ça que
      //  ces vignettes ne ressemblent pas aux cartes du tableau.
      //
      //  SOI-MÊME EXCLU, même règle que partout : « avec Jake
      //  Dalziel » sur la conversation de Jake ne dit rien.
      //
      //  MAIS PAS LES INVITÉS : un destinataire de conversation est
      //  quelqu'un qui est DANS la conversation, pas quelqu'un qu'on
      //  attend. Ajouter les invités ici dirait « tu parles avec Erin »
      //  à propos d'une personne qui n'a rien reçu.
      const avec = (compagnons.get(l.sujetId) ?? [])
        .filter((p) => p.trim() !== r.pseudo.trim());
      const qui = doc.createElement("p");
      qui.className = "wm-rp__sms-qui";
      qui.textContent = avec.length === 0 ? "Sans destinataire connu" : avec.join(", ");
      li.append(qui);

      const titre = doc.createElement("a");
      titre.className = "wm-rp__sms-titre";
      titre.textContent = l.titre === "" ? `Conversation ${l.sujetId}` : l.titre;
      titre.href = adresseDuSujet(l.sujetId, l.dernierMessage);
      li.append(titre);

      if (l.extrait !== "") {
        const extrait = doc.createElement("p");
        extrait.className = "wm-rp__sms-extrait";
        extrait.textContent = `« ${l.extrait} »`;
        li.append(extrait);
      }

      const pied = doc.createElement("p");
      pied.className = "wm-rp__sms-pied";
      const etiquette = doc.createElement("span");
      etiquette.className = "wm-rp__etat" +
        (vu === "a-moi" || vu === "neuf" ? " wm-rp__etat--a-moi" : "");
      etiquette.textContent = MOTS[vu];
      const quand = doc.createElement("span");
      quand.className = "wm-rp__quand";
      const nb = `${l.reponses} message${l.reponses > 1 ? "s" : ""}`;
      quand.textContent = l.dernierLe === null
        ? nb
        : `${nb} · ${
          new Date(l.dernierLe).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          })
        }`;
      pied.append(etiquette, quand);
      li.append(pied);
      sms.append(li);
    }
  };

  const peindre = (): void => {
    tableau.hidden = vue !== "tableau";
    liste.hidden = vue !== "liste";

    //  LE PARTAGE SE FAIT À LA PEINTURE ET PAS AU CHARGEMENT : la table
    //  des forums arrive par une autre requête, qui peut répondre après
    //  les RP. Partager une fois pour toutes au chargement laisserait
    //  les conversations dans le tableau jusqu'au prochain repeint.
    //  SANS LE <ul> DES SMS, ON NE PARTAGE PAS : les sortir du tableau
    //  sans avoir où les mettre les ferait disparaître des deux côtés.
    const partage = sms === null
      ? { rp: lignes, sms: [] as readonly LigneDeRp[] }
      : partagerLesRp(lignes, forums);
    if (vue === "tableau") peindreLeTableau(partage.rp);
    //  LES SMS SE PEIGNENT DANS LES DEUX VUES, parce qu'ils ne sont pas
    //  une vue : « tableau et liste c'est un style d'affichage des rps,
    //  alors que les sms ça pourrait faire partie des deux onglets ».
    peindreLesSms(partage.sms);
    const vues = rangerLesRp(garderLesRp(partage.rp, filtre, r.pseudo));
    const aMoi = partage.rp.filter((l) => {
      const v = etatVu(l, r.pseudo);
      return v === "a-moi" || v === "neuf";
    }).length;
    //  ET IL NE PARLE QUE DES RP : les conversations ont leur propre
    //  bloc, avec son propre compte. Les annoncer deux fois ferait
    //  chercher où est la différence.
    compte.textContent = partage.rp.length === 0
      ? "Rien pour l'instant. La relève remplit ce tableau une fois par heure."
      : `${partage.rp.length} RP, dont ${aMoi} où c'est à toi d'écrire.`;

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
      //  ── UNE ICÔNE, PAS LE MOT « EN GRAND » ──────────────────────
      //
      //  « Pourquoi en liste tu écris "en grand" pour afficher les
      //  infos du rp ? Mets juste un bouton avec une icône pour avoir
      //  les infos. » — 23 novembre.
      //
      //  ELLE A RAISON SUR LE MOT AVANT LA FORME : « en grand » décrit
      //  ce que le bouton FAIT À LA FENÊTRE, pas ce qu'on va y trouver.
      //  Ce qu'on vient chercher, ce sont les infos du RP — le lieu,
      //  les gens, le récap, sa description. Un « i » dans un cercle le
      //  dit sans mot, et c'est le signe que tout le monde connaît.
      //
      //  LE MOT RESTE POUR QUI ÉCOUTE LA PAGE : l'icône est
      //  `aria-hidden`, l'étiquette hors écran nomme le RP. Une icône
      //  qui porte le sens n'est lisible que par qui l'a déjà appris.
      const voir = doc.createElement("button");
      voir.type = "button";
      voir.className = "wm-rp__infos";
      voir.setAttribute("data-wm-rp-ouvrir", String(l.sujetId));
      const oeil = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      oeil.setAttribute("viewBox", "0 0 20 20");
      oeil.setAttribute("aria-hidden", "true");
      oeil.setAttribute("focusable", "false");
      oeil.setAttribute("fill", "none");
      oeil.setAttribute("stroke", "currentColor");
      oeil.setAttribute("stroke-width", "1.5");
      for (const d of ["M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z", "M10 9v4.6", "M10 6.3v.1"]) {
        const trait = doc.createElementNS("http://www.w3.org/2000/svg", "path");
        trait.setAttribute("d", d);
        trait.setAttribute("stroke-linecap", "round");
        oeil.append(trait);
      }
      voir.append(oeil);
      const ditVoir = doc.createElement("span");
      ditVoir.className = "wm-carnet__hors-ecran";
      ditVoir.textContent = `Les infos de « ${titre.textContent} »`;
      voir.append(ditVoir);
      voir.addEventListener("click", () => ouvrirEnGrand(l.sujetId));
      outils.append(voir);

      //  LA CROIX EST LA MÊME QUE SUR LES CARTES DU TABLEAU, et elle
      //  est sur TOUTES les lignes depuis le 23 novembre — voir
      //  `croix`.
      outils.append(croix(l));

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

  /** Le titre d'un sujet, lu sur le forum.
   *
   *  ── « EST-CE QUE TU PEUX RÉCUPÉRER LE TITRE DIRECTEMENT ? » ─────────
   *
   *  Oui, et sans rien demander à Supabase : le carnet TOURNE sur le
   *  forum. Une page de sujet est à la même origine, donc un `fetch`
   *  l'atteint avec la session du joueur, exactement comme s'il cliquait
   *  le lien.
   *
   *  LE `<title>` PLUTÔT QUE LE FIL D'ARIANE : Forumactif l'écrit en
   *  premier dans la page, il ne dépend d'aucun gabarit qu'on a modifié,
   *  et il survit aux versions. Il porte souvent le nom du forum en
   *  suffixe, après un tiret cadratin ou un pipe — on coupe au premier.
   *
   *  ── ET C'EST UN CONFORT, JAMAIS UNE CONDITION ───────────────────────
   *
   *  Tout refus rend `null` : réseau coupé, sujet d'un forum interdit,
   *  page qui a changé de forme. La carte s'ajoute quand même avec ce que
   *  le joueur a tapé — et de toute façon **la relève écrira le vrai
   *  titre au prochain passage.** Ce champ ne sert qu'à ce que la carte
   *  ne s'appelle pas « Sujet 996 » en attendant.
   */
  async function titreDuSujet(sujetId: number): Promise<string | null> {
    try {
      const reponse = await fetch(`/t${sujetId}-`, { credentials: "same-origin" });
      if (!reponse.ok) return null;
      const html = await reponse.text();
      const trouve = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html);
      if (trouve === null) return null;
      //  LES ENTITÉS SE DÉCODENT, et il en faut : un titre avec une
      //  apostrophe arrive en `&#039;`, et l'afficher brut serait pire
      //  que de ne rien afficher.
      const brut = new DOMParser()
        .parseFromString(trouve[1], "text/html").documentElement.textContent ?? "";
      const titre = brut.split(/\s[—|·]\s/)[0].trim();
      return titre === "" ? null : titre.slice(0, 160);
    } catch {
      return null;
    }
  }

  //  ── UN AJOUT À LA FOIS, ET IL LE DIT ──────────────────────────────
  //
  //  « Je peux plus ajouter de cartes. » — 23 novembre.
  //
  //  CE QUI S'EST PASSÉ : depuis que le titre se cherche tout seul, le
  //  clic attend une PAGE DE FORUMACTIF avant d'écrire quoi que ce soit
  //  — une à trois secondes. Et pendant ce temps, l'écran ne disait
  //  rien. On clique, rien ne bouge, on reclique : le second clic part
  //  avant que `lignes` ait appris la carte, la base refuse la clé en
  //  double, et le seul mot qu'on lit est « cette carte n'a pas pu être
  //  ajoutée ».
  //
  //  **UN BOUTON MUET PENDANT TROIS SECONDES EST UN BOUTON CASSÉ**, même
  //  quand le code derrière est juste. Deux choses, donc : il se grise
  //  le temps du vol, et il dit ce qu'il attend.
  let enVol = false;
  doc.querySelector("[data-wm-rp-ajouter]")?.addEventListener("click", () => {
    const adresse = doc.querySelector<HTMLInputElement>("[data-wm-rp-neuf-adresse]");
    const titre = doc.querySelector<HTMLInputElement>("[data-wm-rp-neuf-titre]");
    const bouton = doc.querySelector<HTMLButtonElement>("[data-wm-rp-ajouter]");
    if (adresse === null || titre === null) return;
    if (enVol) return;
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
      //  ── LE TITRE SE CHERCHE TOUT SEUL ─────────────────────────────
      //
      //  « Est-ce que tu peux récupérer le titre du sujet
      //  directement ? » — 23 novembre.
      //
      //  SEULEMENT SI LE CHAMP EST VIDE : ce que le joueur a tapé
      //  l'emporte sur ce qu'on trouve. Il a peut-être un nom à lui
      //  pour ce RP, et l'écraser par le titre du sujet lui retirerait
      //  ce qu'il venait d'écrire.
      //
      //  ET ÇA NE RETIENT RIEN : si la lecture échoue, la carte part
      //  avec « Sujet 996 », et la relève écrira le vrai titre au
      //  prochain passage.
      const tape = titre.value.trim().slice(0, 160);
      enVol = true;
      if (bouton !== null) bouton.disabled = true;
      //  LE MOT PART AVANT L'ATTENTE, pas après : c'est tout l'objet.
      if (tape === "") dit.textContent = "Je cherche le titre du sujet…";
      const trouve = tape === "" ? await titreDuSujet(sujetId) : null;
      const neuf: LigneDeRp = {
        sujetId,
        titre: trouve ?? tape,
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
      //  LE BOUTON SE REND AVANT TOUT RETOUR, réussite ou échec : laissé
      //  grisé sur un refus, il transformerait une carte ratée en page
      //  bloquée, et c'est pire que le défaut qu'on répare.
      enVol = false;
      if (bouton !== null) bouton.disabled = false;
      if (!fait.ok) {
        dit.textContent = "Cette carte n'a pas pu être ajoutée.";
        return;
      }
      lignes = [...lignes, neuf];
      adresse.value = "";
      titre.value = "";
      dit.textContent = trouve === null
        ? "Ajouté. Dès que tu y écriras, la relève le remplira."
        : `Ajouté : « ${trouve} ».`;
      peindre();
    })();
  });

  //  ── CHOISIR SES COLONNES ────────────────────────────────────────
  //
  //  « La personne peut afficher les colonnes qu'elle souhaite. »
  //
  //  SIX CASES, ET PAS DE BOUTON « ENREGISTRER ». Cocher EST le geste :
  //  un panneau de réglages qui demande une validation en plus fait
  //  deux clics pour une case, et laisse croire qu'on peut annuler.
  //
  //  LA CASE DIT « MONTRÉE », PAS « CACHÉE ». C'est l'état de la chose
  //  qu'on regarde, et une case à cocher pour cacher se lit à l'envers
  //  — cochée voudrait dire absente.
  const panneau = doc.querySelector<HTMLElement>("[data-wm-rp-colonnes]");
  const peindreLesColonnes = (): void => {
    if (panneau === null) return;
    panneau.textContent = "";
    for (const colonne of ETATS) {
      const ligne = doc.createElement("label");
      ligne.className = "wm-rp__colonnes-choix";
      const case_ = doc.createElement("input");
      case_.type = "checkbox";
      case_.checked = !cachees.has(colonne.clef);
      case_.setAttribute("data-wm-rp-colonne-montree", colonne.clef);
      const mot = doc.createElement("span");
      //  LE NOM QU'ELLE PORTE, pas le mot du code : si le joueur a
      //  renommé « prévu » en « mes envies », c'est « mes envies »
      //  qu'il cherche dans cette liste.
      mot.textContent = noms.get(colonne.clef) ?? colonne.mot;
      ligne.append(case_, mot);
      case_.addEventListener("change", () => {
        const montree = case_.checked;
        if (montree) cachees.delete(colonne.clef);
        else cachees.add(colonne.clef);
        //  ON REPEINT TOUT DE SUITE, ET ON ENREGISTRE DERRIÈRE : la
        //  colonne doit disparaître au clic, pas après un
        //  aller-retour. Si l'écriture échoue, le mot le dit et le
        //  choix ne survivra pas au rechargement — ce qui est plus
        //  honnête que de refuser le clic.
        peindre();
        void (async () => {
          const fait = await rest(r, "rp_colonne", {
            method: "POST",
            headers: {
              //  `merge-duplicates` : la ligne existe peut-être déjà
              //  parce que le joueur a renommé la colonne. Un POST sec
              //  se ferait refuser par la clé primaire.
              Prefer: "return=minimal,resolution=merge-duplicates",
            },
            body: JSON.stringify({
              joueur_id: r.joueurId,
              etat: colonne.clef,
              //  LE NOM EST OBLIGATOIRE EN BASE (entre 1 et 24
              //  signes) : on repose celui qui est en place, ou le mot
              //  par défaut. Sans ça, cacher une colonne jamais
              //  renommée se ferait refuser par la contrainte.
              nom: noms.get(colonne.clef) ?? colonne.mot,
              montree,
            }),
          });
          if (!fait.ok) {
            dit.textContent = "Ce choix de colonnes n'a pas pu être enregistré.";
          }
        })();
      });
      panneau.append(ligne);
    }
  };
  peindreLesColonnes();

  //  ── L'INTERRUPTEUR DES CLÔTURÉS S'EN EST ALLÉ ───────────────────
  //
  //  « Dans ce cas, si on peut choisir quelles colonnes afficher, tu
  //  n'es plus obligé de mettre celui qui est tout à droite. » —
  //  23 novembre, après le panneau des colonnes.
  //
  //  ELLE A RAISON, ET C'EST MOI QUI AVAIS DÉFENDU LE CONTRAIRE une
  //  heure plus tôt : « deux gestes pour deux besoins », disais-je, l'un
  //  à portée parce qu'on le bascule souvent, l'autre rangé parce qu'on
  //  le règle une fois. L'argument tenait tant que le panneau n'existait
  //  pas. Dès qu'il existe, c'est DEUX CONTRÔLES POUR UNE SEULE CHOSE —
  //  et deux chemins vers le même état finissent toujours par se
  //  contredire : l'interrupteur gardait son choix dans `localStorage`,
  //  le panneau l'écrit en base. Un joueur qui cachait les clôturés d'un
  //  côté et les montrait de l'autre aurait eu raison de ne plus savoir
  //  lequel croire.
  //
  //  LES CLÔTURÉS N'ONT DONC PLUS RIEN DE PARTICULIER : ils sont la
  //  sixième ligne du panneau, comme les cinq autres. Le choix suit le
  //  joueur d'un appareil à l'autre, ce que `localStorage` ne faisait
  //  pas, et la page a un contrôle de moins.

  let charge = false;
  const charger = (): void => {
    if (charge) return;
    charge = true;
    void (async () => {
      //  LES CINQ LECTURES PARTENT ENSEMBLE. Les compagnons, les
      //  invités, les forums et les noms de colonnes ne dépendent pas
      //  des RP : les enchaîner ajouterait quatre allers-retours au
      //  premier affichage pour rien.
      const [lus, avec, titres, pris] = await Promise.all([
        rest(r, "rp?select=*&order=ordre,dernier_le.desc"),
        rest(r, "rp_participant?select=sujet_id,pseudo"),
        //  `montree` EN MÊME TEMPS QUE `nom` : c'est la même ligne, et
        //  une seconde requête pour une colonne de la même table serait
        //  un aller-retour offert.
        rest(r, "rp_colonne?select=etat,nom,montree"),
        rest(r, "rp_invite?select=sujet_id,pseudo"),
        lireLesForums(r.racine).then((t) => {
          forums = t;
        }),
      ]);
      if (Array.isArray(titres.corps)) {
        for (const c of titres.corps as Record<string, unknown>[]) {
          const clef = String(c.etat ?? "");
          const nom = String(c.nom ?? "").trim();
          if (clef !== "" && nom !== "") noms.set(clef, nom);
          //  ── MONTRÉE SAUF SI LA LIGNE DIT NON ───────────────────────
          //
          //  Une ligne de `rp_colonne` n'existe que si le joueur a
          //  touché à la colonne. Lire l'absence comme « cachée »
          //  viderait un carnet neuf de toutes ses colonnes — c'est la
          //  raison du `default true` en base, et elle vaut ici aussi.
          if (clef !== "" && c.montree === false) cachees.add(clef);
        }
      }
      if (Array.isArray(pris.corps)) {
        for (const p of pris.corps as Record<string, unknown>[]) {
          const sujetId = Number(p.sujet_id);
          const pseudo = String(p.pseudo ?? "").trim();
          if (!Number.isInteger(sujetId) || pseudo === "") continue;
          const deja = invites.get(sujetId) ?? [];
          if (!deja.includes(pseudo)) invites.set(sujetId, [...deja, pseudo]);
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
      //  LE PANNEAU SE REPEINT APRÈS LA LECTURE, et il le faut : il est
      //  posé avant, donc avec les mots du code et toutes les cases
      //  cochées. Sans ce second passage, un joueur qui avait caché
      //  trois colonnes les verrait cochées dans le panneau et absentes
      //  du tableau.
      peindreLesColonnes();
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
