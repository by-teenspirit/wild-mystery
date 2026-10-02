// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/publication.ts
//
//  Écrire sur Forumactif. C'est la pièce la plus fragile du montage :
//  il n'y a pas d'API, donc on se connecte et on soumet des formulaires
//  comme un navigateur le ferait.
//
//  Les deux formulaires ont été relevés sur le forum réel le 2 octobre
//  2026, en les lisant, sans rien envoyer :
//
//  POST /login  (application/x-www-form-urlencoded)
//      username, password, autologin=on, redirect="", query="",
//      login="Connexion"
//      → aucun jeton anti-rejeu : la connexion est un simple envoi.
//
//  GET  /post?t=<sujet>&mode=reply
//      → donne auth[] (deux valeurs de 32 caractères), mode=reply,
//        t=<sujet>, lt=<id du dernier message du sujet>
//
//  POST /post  (multipart/form-data)
//      subject (vide sur une réponse), message, auth[] ×2, mode, t, lt,
//      post="Envoyer"
//
//  Deux conséquences qui tiennent tout ce fichier :
//
//  · **`lt` ne se garde pas en cache.** C'est l'identifiant du dernier
//    message au moment où le formulaire a été servi. Si quelqu'un poste
//    entre-temps, Forumactif refuse. Donc : un GET du formulaire avant
//    chaque envoi, jamais de réemploi.
//  · **Un POST ne se rejoue jamais à l'aveugle.** Une coupure après
//    l'envoi mais avant la réponse laisse le message publié. Alors en
//    cas d'échec on va RELIRE le sujet et chercher le code du marqueur :
//    s'il y est, c'était passé. Sans ça, une relève qui bégaie poste
//    deux bilans.
// ════════════════════════════════════════════════════════════════════

import type { PosteurSurForum } from "../../application/ports.ts";
import { marqueursDe } from "./marqueur.ts";
import { lireLesMessages } from "./lecture.ts";

// ── le transport ────────────────────────────────────────────────────

export type Champ = readonly [nom: string, valeur: string];

export type Corps = {
  /** `formulaire` → x-www-form-urlencoded ; `multipart` → multipart/form-data.
   *  Les deux formulaires de Forumactif n'utilisent pas le même. */
  readonly encodage: "formulaire" | "multipart";
  readonly champs: readonly Champ[];
};

export type Requete = {
  readonly chemin: string;
  readonly methode: "GET" | "POST";
  /** L'en-tête Cookie à envoyer, déjà assemblé. */
  readonly cookie: string;
  readonly corps?: Corps;
};

export type Reponse = {
  readonly statut: number;
  readonly corps: string;
  /** Les valeurs brutes de Set-Cookie, dans l'ordre d'arrivée. */
  readonly cookies: readonly string[];
  /** L'en-tête Location, si la réponse redirige. */
  readonly emplacement: string | null;
};

/** Ce dont cet adaptateur a besoin du réseau, et rien de plus. Les
 *  redirections ne doivent PAS être suivies : c'est dans la 302 que
 *  Forumactif pose la session, et c'est son Location qui dit où le
 *  message a atterri. */
export type Transport = (requete: Requete) => Promise<Reponse>;

// ── les refus ───────────────────────────────────────────────────────

export class ConnexionRefusee extends Error {
  constructor(detail: string) {
    super(`Connexion au forum refusée : ${detail}`);
    this.name = "ConnexionRefusee";
  }
}

/** Forumactif fait expirer le mot de passe d'un compte resté longtemps
 *  sans servir. Relevé le 2 octobre sur le compte de publication, après
 *  trois allers-retours à chercher ailleurs.
 *
 *  **Conséquence d'exploitation, et elle compte :** le compte de
 *  publication est par nature peu utilisé à la main. Il expirera donc
 *  encore. Ce n'est pas une panne à déboguer, c'est un mot de passe à
 *  renouveler — d'où une erreur qui porte son propre mode d'emploi. */
export class MotDePasseExpire extends Error {
  constructor() {
    super(
      "Le mot de passe du compte de publication a EXPIRÉ : Forumactif le " +
        "périme après une longue inactivité. Rien à corriger dans le code. " +
        "Réinitialiser le mot de passe du compte sur le forum, puis le " +
        "remplacer dans Supabase › Edge Functions › Secrets › FORUM_MOTDEPASSE.",
    );
    this.name = "MotDePasseExpire";
  }
}

export class FormulaireIntrouvable extends Error {
  constructor(detail: string) {
    super(`Formulaire de réponse illisible : ${detail}`);
    this.name = "FormulaireIntrouvable";
  }
}

export class PublicationRefusee extends Error {
  constructor(detail: string) {
    super(`Publication refusée par le forum : ${detail}`);
    this.name = "PublicationRefusee";
  }
}

/** Le message est peut-être passé, peut-être pas, et on n'a pas pu le
 *  vérifier. Celui-là ne doit JAMAIS déclencher un nouvel envoi
 *  automatique : il appelle un œil humain. */
export class PublicationIncertaine extends Error {
  constructor(sujetId: number, detail: string) {
    super(
      `Sujet ${sujetId} : impossible de savoir si le message est passé (${detail}). ` +
        `Vérifier à la main avant de relancer.`,
    );
    this.name = "PublicationIncertaine";
  }
}

// ── les cookies ─────────────────────────────────────────────────────

/** Un bocal à cookies minuscule : Forumactif en pose deux, on ne garde
 *  que `nom=valeur` et on ignore tout le reste (domaine, expiration,
 *  chemin). On ne parle qu'à un seul hôte, sur un seul chemin. */
export class Bocal {
  private readonly pots = new Map<string, string>();

  avaler(entetes: readonly string[]): void {
    for (const brut of entetes) {
      const premier = brut.split(";", 1)[0] ?? "";
      const egal = premier.indexOf("=");
      if (egal <= 0) continue;
      const nom = premier.slice(0, egal).trim();
      const valeur = premier.slice(egal + 1).trim();
      // `deleted` est ce que Forumactif renvoie pour effacer un cookie.
      if (valeur === "" || valeur === "deleted") this.pots.delete(nom);
      else this.pots.set(nom, valeur);
    }
  }

  entete(): string {
    return [...this.pots].map(([n, v]) => `${n}=${v}`).join("; ");
  }

  get vide(): boolean {
    return this.pots.size === 0;
  }

  oublier(): void {
    this.pots.clear();
  }
}

// ── la lecture du formulaire de réponse ─────────────────────────────

export type FormulaireDeReponse = {
  readonly auth: readonly [string, string];
  readonly sujetId: number;
  readonly dernierMessageId: number;
};

const CHAMP_CACHE = /<input[^>]*type="hidden"[^>]*>/gi;
const ATTRIBUT = /(\w+)="([^"]*)"/g;

/** Relit les champs cachés du formulaire de réponse.
 *
 *  Par attribut et non par position : Forumactif réordonne ses champs
 *  d'une version de template à l'autre, et un analyseur positionnel
 *  casserait en silence. */
export function lireLeFormulaireDeReponse(html: string): FormulaireDeReponse {
  const auth: string[] = [];
  let t: number | null = null;
  let lt: number | null = null;
  let mode: string | null = null;

  for (const balise of html.match(CHAMP_CACHE) ?? []) {
    let nom = "";
    let valeur = "";
    for (const a of balise.matchAll(ATTRIBUT)) {
      if (a[1].toLowerCase() === "name") nom = a[2];
      if (a[1].toLowerCase() === "value") valeur = a[2];
    }
    if (nom === "auth[]") auth.push(valeur);
    else if (nom === "t") t = Number(valeur);
    else if (nom === "lt") lt = Number(valeur);
    else if (nom === "mode") mode = valeur;
  }

  if (mode !== "reply") {
    throw new FormulaireIntrouvable(`mode attendu « reply », trouvé ${JSON.stringify(mode)}`);
  }
  if (auth.length !== 2) {
    throw new FormulaireIntrouvable(`${auth.length} champ(s) auth[] au lieu de deux`);
  }
  if (t === null || !Number.isInteger(t)) throw new FormulaireIntrouvable("pas de champ t");
  if (lt === null || !Number.isInteger(lt)) throw new FormulaireIntrouvable("pas de champ lt");

  return { auth: [auth[0], auth[1]], sujetId: t, dernierMessageId: lt };
}

/** Les champs à envoyer pour publier. L'ordre est celui du formulaire
 *  réel : Forumactif ne s'en soucie pas, mais une différence visible
 *  dans un journal aide à comparer avec ce que fait un navigateur. */
export function champsDeLaReponse(
  formulaire: FormulaireDeReponse,
  message: string,
): readonly Champ[] {
  return [
    ["subject", ""],
    ["message", message],
    ["auth[]", formulaire.auth[0]],
    ["auth[]", formulaire.auth[1]],
    ["mode", "reply"],
    ["t", String(formulaire.sujetId)],
    ["lt", String(formulaire.dernierMessageId)],
    ["post", "Envoyer"],
  ];
}

const ANCRE_DE_MESSAGE = /[?&#]p=?(\d+)|#(\d+)/;

/** L'identifiant du message qui vient d'être posté, lu dans le Location
 *  de la redirection (`/t813-…#15264`). */
export function idDuMessagePoste(emplacement: string | null): number | null {
  if (emplacement === null) return null;
  const m = emplacement.match(ANCRE_DE_MESSAGE);
  if (m === null) return null;
  const id = Number(m[1] ?? m[2]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Un extrait lisible de ce que le forum a répondu : les balises, les
 *  scripts et les styles retirés, l'espace resserré. Sert à mettre le
 *  message d'erreur du forum DANS notre message d'erreur, au lieu de le
 *  laisser deviner. */
export function enClair(html: string, combien = 200): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, combien);
}

/** Les mots autour desquels Forumactif écrit ce qui s'est passé. Relevés
 *  le 2 octobre : la réponse à un envoi de connexion est une « page
 *  d'information » dont les deux cents premiers caractères ne sont que le
 *  menu du forum. Chercher le message plutôt que couper au début. */
const MOTS_DU_MESSAGE = [
  "mot de passe",
  "incorrect",
  "nom d'utilisateur",
  "authentifi",
  "succès",
  "erreur",
  "tentative",
  "patienter",
  "désactiv",
  "banni",
  "captcha",
  "inconnu",
  "invalide",
];

/** Ce que le forum a voulu dire, extrait de sa page.
 *
 *  On rend une fenêtre autour du premier mot reconnu ; à défaut, un large
 *  extrait qui saute le menu. Un message d'erreur qui cite le forum fait
 *  gagner une demi-heure à chaque fois. */
export function messageDuForum(html: string): string {
  const texte = enClair(html, 4000);
  const bas = texte.toLowerCase();
  for (const mot of MOTS_DU_MESSAGE) {
    const ou = bas.indexOf(mot);
    if (ou >= 0) return texte.slice(Math.max(0, ou - 120), ou + 240).trim();
  }
  // Rien de reconnu : on saute le menu, qui fait environ deux cents
  // caractères, et on rend la suite.
  return texte.slice(200, 800).trim();
}

/** Vrai si la page servie est l'écran de connexion : c'est ainsi qu'on
 *  reconnaît une session expirée, Forumactif ne renvoyant pas de 401. */
export function estLaPageDeConnexion(html: string): boolean {
  return /name="form_login"/i.test(html) || /name="password"/i.test(html);
}

// ── l'adaptateur ────────────────────────────────────────────────────

export type Identifiants = {
  readonly compte: string;
  readonly motDePasse: string;
};

export class ForumactifEnPublication implements PosteurSurForum {
  private readonly bocal = new Bocal();

  /**
   * @param transport   le réseau, injecté : ce fichier se teste sans lui
   * @param identifiants ceux du compte de publication (Maître du Jeu).
   *        Ils viennent des secrets de la fonction Edge, jamais du dépôt.
   */
  constructor(
    private readonly transport: Transport,
    private readonly identifiants: Identifiants,
  ) {}

  /** Se connecte. Appelée paresseusement, et une seconde fois si la
   *  session tombe en cours de relève. */
  /** Se connecter, en deux temps, **comme un navigateur**.
   *
   *  D'abord un GET sur la page de connexion, parce que c'est ce que fait
   *  un navigateur et que certains forums y posent une session anonyme
   *  qu'ils exigent ensuite.
   *
   *  **L'ORDRE DES VÉRIFICATIONS COMPTE.** On regarde d'abord si le forum
   *  nous a resservi l'écran de connexion — c'est le signe d'identifiants
   *  refusés, et c'est la cause la plus fréquente. Chercher l'absence de
   *  cookie en premier donnerait « aucune session posée » pour un simple
   *  mot de passe faux, et on chercherait du mauvais côté pendant une
   *  heure. C'est exactement ce qui est arrivé le 2 octobre.
   *
   *  Le message d'erreur porte tout ce qu'il faut pour trancher sans
   *  relancer : les deux statuts, les deux comptes de cookies, et ce que
   *  le forum a répondu. Jamais le mot de passe, évidemment. */
  private async seConnecter(): Promise<void> {
    this.bocal.oublier();

    const page = await this.transport({ chemin: "/login", methode: "GET", cookie: "" });
    this.bocal.avaler(page.cookies);
    const apresVisite = this.bocal.entete();

    const reponse = await this.transport({
      chemin: "/login",
      methode: "POST",
      cookie: apresVisite,
      corps: {
        encodage: "formulaire",
        champs: [
          ["username", this.identifiants.compte],
          ["password", this.identifiants.motDePasse],
          ["autologin", "on"],
          ["redirect", ""],
          ["query", ""],
          ["login", "Connexion"],
        ],
      },
    });
    this.bocal.avaler(reponse.cookies);

    const detail = `visite ${page.statut} (${page.cookies.length} cookie(s)), ` +
      `envoi ${reponse.statut} (${reponse.cookies.length} cookie(s))` +
      `, le forum dit « ${messageDuForum(reponse.corps)} »`;

    // Un cas nommé plutôt qu'une erreur générique : il a sa cause, son
    // remède, et il reviendra.
    if (/mot de passe a expir/i.test(reponse.corps)) {
      this.bocal.oublier();
      throw new MotDePasseExpire();
    }
    if (estLaPageDeConnexion(reponse.corps)) {
      this.bocal.oublier();
      throw new ConnexionRefusee(
        `le forum a resservi l'écran de connexion — identifiants probablement ` +
          `refusés. ${detail}`,
      );
    }
    if (this.bocal.vide) {
      throw new ConnexionRefusee(`aucune session posée. ${detail}`);
    }
  }

  private async assurerLaSession(): Promise<void> {
    if (this.bocal.vide) await this.seConnecter();
  }

  /** Le formulaire de réponse, frais. Jamais mis en cache : `lt` vieillit
   *  dès qu'un joueur poste. */
  private async formulaire(sujetId: number): Promise<FormulaireDeReponse> {
    const chemin = `/post?t=${sujetId}&mode=reply`;
    let reponse = await this.transport({ chemin, methode: "GET", cookie: this.bocal.entete() });

    // Un cas nommé plutôt qu'une erreur générique : il a sa cause, son
    // remède, et il reviendra.
    if (/mot de passe a expir/i.test(reponse.corps)) {
      this.bocal.oublier();
      throw new MotDePasseExpire();
    }
    if (estLaPageDeConnexion(reponse.corps)) {
      // La session est tombée. On se reconnecte une fois, pas deux.
      await this.seConnecter();
      reponse = await this.transport({ chemin, methode: "GET", cookie: this.bocal.entete() });
      // Un cas nommé plutôt qu'une erreur générique : il a sa cause, son
      // remède, et il reviendra.
      if (/mot de passe a expir/i.test(reponse.corps)) {
        this.bocal.oublier();
        throw new MotDePasseExpire();
      }
      if (estLaPageDeConnexion(reponse.corps)) {
        throw new ConnexionRefusee("session perdue juste après la connexion");
      }
    }
    this.bocal.avaler(reponse.cookies);
    return lireLeFormulaireDeReponse(reponse.corps);
  }

  /** Cherche dans le sujet un message portant ce code de marqueur, et
   *  rend son identifiant. C'est le filet contre le double envoi. */
  private async messagePortantLeCode(sujetId: number, code: string): Promise<number | null> {
    const reponse = await this.transport({
      chemin: `/t${sujetId}-`,
      methode: "GET",
      cookie: this.bocal.entete(),
    });
    const messages = lireLesMessages(reponse.corps, sujetId);
    // Le dernier d'abord : un bilan vient d'être posté, il est en fin de page.
    for (const m of [...messages].reverse()) {
      if (m.marqueurs.some((q) => q.code === code)) return m.id;
    }
    return null;
  }

  async repondre(sujetId: number, mentionne: string, corps: string): Promise<number> {
    await this.assurerLaSession();

    const message = mentionne === "" ? corps : `@${mentionne}\n\n${corps}`;
    // Le code du marqueur sert de preuve d'identité du message. S'il n'y
    // en a pas, on ne saura pas reconnaître notre propre envoi.
    const codes = marqueursDe(message).map((m) => m.code);
    const formulaire = await this.formulaire(sujetId);

    let reponse: Reponse;
    try {
      reponse = await this.transport({
        chemin: "/post",
        methode: "POST",
        cookie: this.bocal.entete(),
        corps: { encodage: "multipart", champs: champsDeLaReponse(formulaire, message) },
      });
    } catch (e) {
      // Le réseau a lâché. Le message est peut-être parti : on regarde.
      const retrouve = codes.length === 1
        ? await this.messagePortantLeCode(sujetId, codes[0])
        : null;
      if (retrouve !== null) return retrouve;
      throw new PublicationIncertaine(sujetId, (e as Error).message);
    }

    this.bocal.avaler(reponse.cookies);

    const id = idDuMessagePoste(reponse.emplacement);
    if (id !== null) return id;

    // Pas de Location exploitable : soit le forum a refusé, soit il a
    // répondu par une page. Dans les deux cas on va voir le sujet plutôt
    // que de supposer.
    if (codes.length === 1) {
      const retrouve = await this.messagePortantLeCode(sujetId, codes[0]);
      if (retrouve !== null) return retrouve;
      throw new PublicationRefusee(
        `statut ${reponse.statut}, et le message n'est pas dans le sujet`,
      );
    }
    throw new PublicationIncertaine(
      sujetId,
      `statut ${reponse.statut}, ${codes.length} code(s) de marqueur dans le message`,
    );
  }
}

// ── le transport réel, pour la racine de composition ────────────────

/** Les en-têtes Set-Cookie, un par un.
 *
 *  `getSetCookie()` est la bonne façon — elle rend les valeurs séparées.
 *  Elle n'existe pas partout ; là où elle manque, `get("set-cookie")` rend
 *  TOUT collé en une chaîne, et découper sur les virgules casserait les
 *  dates (« expires=Thu, 01 Jan »). On découpe donc sur une virgule suivie
 *  d'un nom de cookie, et sur rien d'autre. */
function lireLesCookies(entetes: Headers): readonly string[] {
  const avecMethode = entetes as Headers & { getSetCookie?: () => string[] };
  if (typeof avecMethode.getSetCookie === "function") return avecMethode.getSetCookie();
  const brut = entetes.get("set-cookie");
  if (brut === null || brut === "") return [];
  return brut.split(/,(?=\s*[A-Za-z0-9_\-]+=)/).map((c) => c.trim());
}

/** Le `fetch` de Deno, habillé en Transport. **Les redirections ne sont
 *  pas suivies** : la session arrive dans la 302, et son Location dit où
 *  le message a atterri. */
export function transportFetch(
  base: string,
  recuperer: typeof fetch = fetch,
): Transport {
  return async (requete) => {
    const entetes: Record<string, string> = {
      // Forumactif sert des pages différentes — voire rien du tout — à ce
      // qui ne ressemble pas à un navigateur. On se présente donc comme
      // un navigateur, parce que c'est exactement ce qu'on imite : il n'y
      // a pas d'API, et le forum n'a pas d'autre langue pour nous parler.
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "fr-FR,fr;q=0.9",
      "referer": base + "/",
    };
    if (requete.cookie !== "") entetes["cookie"] = requete.cookie;

    let body: BodyInit | undefined;
    if (requete.corps !== undefined) {
      if (requete.corps.encodage === "formulaire") {
        const p = new URLSearchParams();
        for (const [n, v] of requete.corps.champs) p.append(n, v);
        body = p;
      } else {
        const f = new FormData();
        for (const [n, v] of requete.corps.champs) f.append(n, v);
        body = f;
      }
    }

    const reponse = await recuperer(base + requete.chemin, {
      method: requete.methode,
      headers: entetes,
      body,
      redirect: "manual",
    });

    return {
      statut: reponse.status,
      corps: await reponse.text(),
      cookies: lireLesCookies(reponse.headers),
      emplacement: reponse.headers.get("location"),
    };
  };
}
