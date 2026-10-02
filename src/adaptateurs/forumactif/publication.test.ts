// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/publication.test.ts
//
//  Le faux forum de ce fichier n'est pas un bouchon complaisant : il
//  reproduit les comportements qui font mal.
//    · il renvoie l'écran de connexion au lieu d'une erreur 401 ;
//    · il pose la session dans une 302, pas dans un corps de réponse ;
//    · il refuse un `lt` périmé, comme le vrai le fait quand un joueur
//      a posté entre le chargement du formulaire et l'envoi ;
//    · il peut lâcher en plein POST après avoir enregistré le message.
//
//  Ce dernier cas est celui qui justifie le fichier entier : sans le
//  filet, une relève qui bégaie poste deux bilans dans le même sujet.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  Bocal,
  champsDeLaReponse,
  ConnexionRefusee,
  enClair,
  estLaPageDeConnexion,
  FormulaireIntrouvable,
  ForumactifEnPublication,
  idDuMessagePoste,
  lireLeFormulaireDeReponse,
  messageDuForum,
  MotDePasseExpire,
  PublicationIncertaine,
  PublicationRefusee,
  type Reponse,
  type Requete,
  type Transport,
} from "./publication.ts";

const COMPTE = { compte: "Maître du Jeu", motDePasse: "ceci-est-un-faux" };
const CODE = "WM-7K4P-9QX";
const AUTH_A = "0123456789abcdef0123456789abcdef";
const AUTH_B = "fedcba9876543210fedcba9876543210";

// ── le gabarit, copié de la forme relevée le 2 octobre ───────────────

function pageDeConnexion(): string {
  return `<form action="/login" method="post" name="form_login">
<input type="text" name="username" /><input type="password" name="password" />
<input type="hidden" name="redirect" value="" /><input type="hidden" name="query" value="" />
<input type="submit" name="login" value="Connexion" /></form>`;
}

function formulaireDeReponse(sujetId: number, lt: number): string {
  // L'ordre des champs est volontairement différent de celui du vrai
  // forum : l'analyseur doit lire par attribut, pas par position.
  return `<form action="/post" method="post" enctype="multipart/form-data" name="post">
<input type="text" name="subject" value="" />
<textarea name="message"></textarea>
<input type="hidden" name="lt" value="${lt}" />
<input type="hidden" name="t" value="${sujetId}" />
<input type="hidden" name="auth[]" value="${AUTH_A}" />
<input type="hidden" name="mode" value="reply" />
<input type="hidden" name="auth[]" value="${AUTH_B}" />
<input type="submit" name="post" value="Envoyer" /></form>`;
}

function bloc(id: number, auteurId: number, pseudo: string, corps = ""): string {
  return `<div id="p${id}" class="post row1 post--${id} post-group-2">
<div class="postprofile-avatar" data-id="${auteurId}"></div>
<div class="postprofile-name"><a href="/u${auteurId}"><strong>${pseudo}</strong></a></div>
<div class="postbody">${corps}</div></div>`;
}

function pageDeSujet(corpsDesMessages: readonly string[]): string {
  return corpsDesMessages.join("\n");
}

// ── le faux forum ───────────────────────────────────────────────────

type Reglages = {
  /** `lt` que le formulaire annonce. */
  lt?: number;
  /** Le forum refuse un `lt` différent de celui-ci à l'envoi. */
  ltAttendu?: number;
  /** La session est refusée tant qu'on n'a pas appelé /login. */
  sessionExigee?: boolean;
  /** Le POST jette, après avoir quand même enregistré le message. */
  coupureApresEnregistrement?: boolean;
  /** Le POST répond 200 sans Location, sans rien enregistrer. */
  refusSansLocation?: boolean;
  /** /login resserre l'écran de connexion (mot de passe faux). */
  motDePasseFaux?: boolean;
  /** /login ne pose aucun cookie. */
  aucunCookie?: boolean;
};

type FauxForum = {
  readonly transport: Transport;
  /** Les requêtes reçues, dans l'ordre : c'est ainsi qu'on vérifie
   *  qu'on ne se reconnecte pas pour rien et qu'on ne poste qu'une fois. */
  readonly journal: string[];
  /** Le corps du message enregistré, ou null si rien n'est passé. */
  readonly posteCorps: string | null;
};

function fauxForum(reglages: Reglages = {}): FauxForum {
  const lt = reglages.lt ?? 15263;
  const journal: string[] = [];
  let connecte = false;
  let posteCorps: string | null = null;
  let prochainId = lt + 1;

  const transport: Transport = (r: Requete): Promise<Reponse> => {
    journal.push(`${r.methode} ${r.chemin}`);
    const sansSession = reglages.sessionExigee === true && !connecte;

    if (r.chemin === "/login" && r.methode === "GET") {
      // Le vrai forum pose une session anonyme sur la page de connexion.
      return Promise.resolve({
        statut: 200,
        corps: pageDeConnexion(),
        cookies: ["fa_sid=anonyme; path=/"],
        emplacement: null,
      });
    }

    if (r.chemin === "/login") {
      if (reglages.motDePasseFaux === true) {
        return Promise.resolve({
          statut: 200,
          corps: pageDeConnexion(),
          cookies: ["fa_sid=rien; path=/"],
          emplacement: null,
        });
      }
      if (reglages.aucunCookie === true) {
        return Promise.resolve({ statut: 302, corps: "", cookies: [], emplacement: "/" });
      }
      connecte = true;
      return Promise.resolve({
        statut: 302,
        corps: "",
        cookies: ["fa_sid=abc123; path=/; HttpOnly", "fa_data=xyz789; path=/"],
        emplacement: "/",
      });
    }

    if (r.chemin.startsWith("/post?")) {
      if (sansSession) {
        return Promise.resolve({
          statut: 200,
          corps: pageDeConnexion(),
          cookies: [],
          emplacement: null,
        });
      }
      const sujetId = Number(new URLSearchParams(r.chemin.slice(5)).get("t"));
      return Promise.resolve({
        statut: 200,
        corps: formulaireDeReponse(sujetId, lt),
        cookies: [],
        emplacement: null,
      });
    }

    if (r.chemin === "/post" && r.methode === "POST") {
      const champs = new Map(r.corps?.champs.map(([n, v]) => [n, v]));
      const envoye = champs.get("lt");
      if (reglages.ltAttendu !== undefined && envoye !== String(reglages.ltAttendu)) {
        return Promise.resolve({
          statut: 200,
          corps: "<p>Un nouveau message a été posté pendant que vous écriviez.</p>",
          cookies: [],
          emplacement: null,
        });
      }
      if (reglages.refusSansLocation === true) {
        return Promise.resolve({
          statut: 200,
          corps: "<p>Votre message est trop court.</p>",
          cookies: [],
          emplacement: null,
        });
      }
      posteCorps = champs.get("message") ?? "";
      if (reglages.coupureApresEnregistrement === true) {
        return Promise.reject(new Error("connexion réinitialisée"));
      }
      const id = prochainId++;
      return Promise.resolve({
        statut: 302,
        corps: "",
        cookies: [],
        emplacement: `/t${champs.get("t")}-un-sujet#${id}`,
      });
    }

    if (r.chemin.startsWith("/t")) {
      const sujetId = Number(r.chemin.slice(2).replace("-", ""));
      const blocs = [bloc(12485, 3, "Dresseuse")];
      if (posteCorps !== null) blocs.push(bloc(prochainId, 3, "Maître du Jeu", posteCorps));
      return Promise.resolve({
        statut: 200,
        corps: pageDeSujet(blocs) + `<!-- sujet ${sujetId} -->`,
        cookies: [],
        emplacement: null,
      });
    }

    return Promise.reject(new Error(`chemin inattendu : ${r.chemin}`));
  };

  return {
    transport,
    journal,
    get posteCorps(): string | null {
      return posteCorps;
    },
  };
}

// ── le bocal à cookies ──────────────────────────────────────────────

Deno.test("Bocal · garde nom=valeur et jette le reste", () => {
  const b = new Bocal();
  assert(b.vide);
  b.avaler([
    "fa_sid=abc; path=/; HttpOnly; SameSite=Lax",
    "fa_data=xyz; expires=Thu, 01 Jan 2099",
  ]);
  assertEquals(b.entete(), "fa_sid=abc; fa_data=xyz");
  assert(!b.vide);
});

Deno.test("Bocal · une valeur réécrite remplace l'ancienne", () => {
  const b = new Bocal();
  b.avaler(["fa_sid=un; path=/"]);
  b.avaler(["fa_sid=deux; path=/"]);
  assertEquals(b.entete(), "fa_sid=deux");
});

Deno.test("Bocal · « deleted » et le vide effacent le pot", () => {
  const b = new Bocal();
  b.avaler(["fa_sid=abc", "fa_data=xyz"]);
  b.avaler(["fa_sid=deleted; expires=jeudi dernier", "fa_data=; path=/"]);
  assert(b.vide, b.entete());
});

Deno.test("Bocal · ignore ce qui n'a pas de signe égal utile", () => {
  const b = new Bocal();
  b.avaler(["ceci-nest-pas-un-cookie", "=sansnom; path=/"]);
  assert(b.vide);
});

// ── la lecture du formulaire ────────────────────────────────────────

Deno.test("lireLeFormulaireDeReponse · relève auth[], t et lt quel que soit l'ordre", () => {
  const f = lireLeFormulaireDeReponse(formulaireDeReponse(813, 15263));
  assertEquals(f.sujetId, 813);
  assertEquals(f.dernierMessageId, 15263);
  assertEquals(f.auth, [AUTH_A, AUTH_B]);
});

Deno.test("lireLeFormulaireDeReponse · refuse une page qui n'est pas un formulaire de réponse", () => {
  assertThrows(() => lireLeFormulaireDeReponse(pageDeConnexion()), FormulaireIntrouvable);
});

Deno.test("lireLeFormulaireDeReponse · refuse un seul auth[] au lieu de deux", () => {
  const html = `<input type="hidden" name="mode" value="reply" />
<input type="hidden" name="t" value="813" /><input type="hidden" name="lt" value="1" />
<input type="hidden" name="auth[]" value="${AUTH_A}" />`;
  const e = assertThrows(() => lireLeFormulaireDeReponse(html), FormulaireIntrouvable);
  assert(e.message.includes("1 champ"), e.message);
});

Deno.test("lireLeFormulaireDeReponse · refuse un formulaire sans lt", () => {
  const html = `<input type="hidden" name="mode" value="reply" />
<input type="hidden" name="t" value="813" />
<input type="hidden" name="auth[]" value="${AUTH_A}" />
<input type="hidden" name="auth[]" value="${AUTH_B}" />`;
  const e = assertThrows(() => lireLeFormulaireDeReponse(html), FormulaireIntrouvable);
  assert(e.message.includes("lt"), e.message);
});

Deno.test("champsDeLaReponse · envoie les deux auth[] et le lt du formulaire", () => {
  const champs = champsDeLaReponse(
    { auth: [AUTH_A, AUTH_B], sujetId: 813, dernierMessageId: 15263 },
    "coucou",
  );
  assertEquals(champs.filter(([n]) => n === "auth[]").map(([, v]) => v), [AUTH_A, AUTH_B]);
  assertEquals(new Map(champs).get("lt"), "15263");
  assertEquals(new Map(champs).get("post"), "Envoyer");
  assertEquals(new Map(champs).get("message"), "coucou");
});

Deno.test("idDuMessagePoste · lit l'ancre de la redirection", () => {
  assertEquals(idDuMessagePoste("/t813-petites-annonces#15264"), 15264);
  assertEquals(idDuMessagePoste("/t813-x?p=15264"), 15264);
  assertEquals(idDuMessagePoste("/t813-x"), null);
  assertEquals(idDuMessagePoste(null), null);
});

Deno.test("estLaPageDeConnexion · reconnaît l'écran de connexion", () => {
  assert(estLaPageDeConnexion(pageDeConnexion()));
  assert(!estLaPageDeConnexion(formulaireDeReponse(813, 1)));
});

// ── le parcours complet ─────────────────────────────────────────────

Deno.test("repondre · se connecte, relit le formulaire, poste, rend l'id", async () => {
  const forum = fauxForum({ sessionExigee: true });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);

  const id = await p.repondre(813, "Dresseuse", "Bilan du sujet.", CODE);

  assertEquals(id, 15264);
  // Le GET /login n'est pas décoratif : Forumactif pose une session
  // anonyme dessus et l'exige dans le POST qui suit.
  assertEquals(forum.journal, [
    "GET /login",
    "POST /login",
    "GET /post?t=813&mode=reply",
    "POST /post",
  ]);
  assert(forum.posteCorps?.startsWith("@Dresseuse\n\n"), forum.posteCorps ?? "rien");
});

Deno.test("repondre · ne se reconnecte pas pour le deuxième message", async () => {
  const forum = fauxForum({ sessionExigee: true });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);
  await p.repondre(813, "A", "Bilan du sujet.", CODE);
  await p.repondre(813, "B", "Bilan du sujet.", "WM-ACDE-FGH");
  assertEquals(forum.journal.filter((l) => l === "POST /login").length, 1);
});

Deno.test("repondre · relit le formulaire à CHAQUE envoi, jamais en cache", async () => {
  // C'est tout l'enjeu de `lt` : un formulaire réemployé fait refuser
  // l'envoi dès qu'un joueur a posté entre les deux.
  const forum = fauxForum();
  const p = new ForumactifEnPublication(forum.transport, COMPTE);
  await p.repondre(813, "", "Bilan du sujet.", CODE);
  await p.repondre(813, "", "Bilan du sujet.", "WM-ACDE-FGH");
  assertEquals(forum.journal.filter((l) => l.startsWith("GET /post?")).length, 2);
});

Deno.test("repondre · sans personne à mentionner, le corps part tel quel", async () => {
  const forum = fauxForum();
  const p = new ForumactifEnPublication(forum.transport, COMPTE);
  await p.repondre(813, "", "Juste un mot.", CODE);
  assert(!forum.posteCorps?.startsWith("@"), forum.posteCorps ?? "rien");
});

Deno.test("repondre · une session tombée en cours de route est reprise une fois", async () => {
  let premierPassage = true;
  const vrai = fauxForum();
  const transport: Transport = (r) => {
    if (r.chemin.startsWith("/post?") && premierPassage) {
      premierPassage = false;
      return Promise.resolve({
        statut: 200,
        corps: pageDeConnexion(),
        cookies: [],
        emplacement: null,
      });
    }
    return vrai.transport(r);
  };

  const p = new ForumactifEnPublication(transport, COMPTE);
  assertEquals(await p.repondre(813, "", "Bilan du sujet.", CODE), 15264);
  // Deux connexions : la paresseuse, puis celle de la reprise.
  assertEquals(vrai.journal.filter((l) => l === "POST /login").length, 2);
});

Deno.test("repondre · une session qui retombe aussitôt n'est pas reprise sans fin", async () => {
  const transport: Transport = (r) => {
    if (r.chemin === "/login") {
      return Promise.resolve({
        statut: 302,
        corps: "",
        cookies: ["fa_sid=abc"],
        emplacement: "/",
      });
    }
    return Promise.resolve({
      statut: 200,
      corps: pageDeConnexion(),
      cookies: [],
      emplacement: null,
    });
  };
  const p = new ForumactifEnPublication(transport, COMPTE);
  await assertRejects(() => p.repondre(813, "", "Bilan du sujet.", CODE), ConnexionRefusee);
});

Deno.test("un mot de passe faux est reconnu malgré le statut 200", async () => {
  const forum = fauxForum({ sessionExigee: true, motDePasseFaux: true });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);
  const e = await assertRejects(
    () => p.repondre(813, "", "Bilan du sujet.", CODE),
    ConnexionRefusee,
  );
  assert(e.message.includes("resservi"), e.message);
});

Deno.test("une connexion sans cookie est refusée au lieu de continuer à vide", async () => {
  const forum = fauxForum({ sessionExigee: true, aucunCookie: true });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);
  await assertRejects(() => p.repondre(813, "", "Bilan du sujet.", CODE), ConnexionRefusee);
});

// ── le filet contre le double envoi ─────────────────────────────────

Deno.test("une coupure APRÈS enregistrement ne reposte pas : on retrouve le message", async () => {
  // Le cas qui justifie ce fichier. Le POST jette, mais le message est
  // passé. Sans le filet, la relève suivante poste un second bilan.
  const forum = fauxForum({ coupureApresEnregistrement: true });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);

  const id = await p.repondre(813, "", "Bilan du sujet.", CODE);

  assertEquals(id, 15264);
  assertEquals(forum.journal.filter((l) => l === "POST /post").length, 1);
  assert(forum.journal.includes("GET /t813-"), forum.journal.join(" · "));
});

Deno.test("une coupure AVANT enregistrement est signalée comme incertaine, pas rejouée", async () => {
  const transport: Transport = (r) => {
    if (r.chemin === "/login") {
      return Promise.resolve({
        statut: 302,
        corps: "",
        cookies: ["fa_sid=abc"],
        emplacement: "/",
      });
    }
    if (r.chemin.startsWith("/post?")) {
      return Promise.resolve({
        statut: 200,
        corps: formulaireDeReponse(813, 15263),
        cookies: [],
        emplacement: null,
      });
    }
    if (r.chemin === "/post") return Promise.reject(new Error("connexion réinitialisée"));
    // Le sujet ne contient pas notre marqueur : rien n'est passé.
    return Promise.resolve({
      statut: 200,
      corps: pageDeSujet([bloc(12485, 3, "Dresseuse")]),
      cookies: [],
      emplacement: null,
    });
  };
  const p = new ForumactifEnPublication(transport, COMPTE);
  const e = await assertRejects(
    () => p.repondre(813, "", "Bilan du sujet.", CODE),
    PublicationIncertaine,
  );
  assert(e.message.includes("à la main"), e.message);
});

Deno.test("un refus clair du forum est un refus, pas une incertitude", async () => {
  const forum = fauxForum({ refusSansLocation: true });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);
  await assertRejects(() => p.repondre(813, "", "Bilan du sujet.", CODE), PublicationRefusee);
});

Deno.test("un lt périmé fait refuser l'envoi, et on ne le prend pas pour un succès", async () => {
  // Le formulaire annonce 15263, le forum en attend 99999 : c'est
  // exactement ce qui arrive quand un joueur poste entre les deux.
  const forum = fauxForum({ lt: 15263, ltAttendu: 99999 });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);
  await assertRejects(() => p.repondre(813, "", "Bilan du sujet.", CODE), PublicationRefusee);
});

Deno.test("le marqueur est posé par l'adaptateur, donc le filet n'est jamais inerte", async () => {
  // Avant le 2 octobre, le marqueur devait venir de l'appelant — et le vrai
  // bilan n'en avait pas. Le filet contre le double envoi existait sans
  // pouvoir servir. C'est l'adaptateur qui l'écrit désormais : un corps
  // sans le moindre marqueur se retrouve quand même après une coupure.
  const forum = fauxForum({ coupureApresEnregistrement: true });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);

  const id = await p.repondre(813, "", "un bilan sans le moindre marqueur", CODE);

  assertEquals(id, 15264, "retrouvé dans le sujet grâce au marqueur ajouté");
  assert(forum.posteCorps?.includes(`:${CODE}]]`), forum.posteCorps ?? "rien");
});

Deno.test("avec deux marqueurs, on ne tranche pas tout seul", async () => {
  const forum = fauxForum({ refusSansLocation: true });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);
  // Le joueur a recopié un marqueur dans son message : avec celui que
  // l'adaptateur ajoute, il y en a deux, et on ne tranche pas tout seul.
  const corps = `Bilan. [[WM:eyJhIjoyfQ:WM-ACDE-FGH]]`;
  await assertRejects(() => p.repondre(813, "", corps, CODE), PublicationIncertaine);
});

// ── le diagnostic de connexion ──────────────────────────────────────

Deno.test("un mot de passe faux est annoncé comme tel, pas comme une absence de cookie", async () => {
  // Le 2 octobre, l'ordre inverse a fait chercher du côté des cookies
  // pendant une heure pour un simple refus d'identifiants.
  const forum = fauxForum({ sessionExigee: true, motDePasseFaux: true });
  const p = new ForumactifEnPublication(forum.transport, COMPTE);
  const e = await assertRejects(
    () => p.repondre(813, "", "Bilan du sujet.", CODE),
    ConnexionRefusee,
  );
  assert(e.message.includes("identifiants probablement refusés"), e.message);
  assert(e.message.includes("visite 200"), e.message);
  assert(e.message.includes("envoi 200"), e.message);
});

Deno.test("le message d'erreur rapporte ce que le forum a répondu", async () => {
  const transport: Transport = (r) => {
    if (r.chemin === "/login" && r.methode === "GET") {
      return Promise.resolve({ statut: 200, corps: "", cookies: [], emplacement: null });
    }
    return Promise.resolve({
      statut: 200,
      corps:
        "<html><body><h1>Trop de tentatives</h1><p>Réessayez dans 15 minutes.</p></body></html>",
      cookies: [],
      emplacement: null,
    });
  };
  const p = new ForumactifEnPublication(transport, COMPTE);
  const e = await assertRejects(
    () => p.repondre(813, "", "Bilan du sujet.", CODE),
    ConnexionRefusee,
  );
  assert(e.message.includes("Trop de tentatives"), e.message);
  assert(e.message.includes("Réessayez dans 15 minutes"), e.message);
});

Deno.test("enClair retire les balises, les scripts et les styles", () => {
  assertEquals(
    enClair("<script>var a=1</script><style>p{}</style><p>Bonjour&nbsp;toi</p>"),
    "Bonjour toi",
  );
  assertEquals(enClair("<p>abcdefghij</p>", 4), "abcd");
});

Deno.test("messageDuForum trouve la phrase et saute le menu", () => {
  const menu =
    "<p>Accueil Calendrier FAQ Rechercher Membres Groupes S'enregistrer Connexion</p>";
  const page =
    `<html>${menu}<div>Le mot de passe que vous avez entré est incorrect.</div></html>`;
  const vu = messageDuForum(page);
  assert(vu.includes("mot de passe que vous avez entré est incorrect"), vu);
});

Deno.test("messageDuForum rend quand même quelque chose s'il ne reconnaît rien", () => {
  const long = "<p>" + "a".repeat(300) + "ce qui compte vraiment</p>";
  assert(messageDuForum(long).includes("ce qui compte vraiment"));
});

Deno.test("un mot de passe expiré est nommé, avec son remède", async () => {
  // Relevé le 2 octobre : Forumactif périme le mot de passe d'un compte
  // longtemps inutilisé. Le compte de publication est par nature peu
  // utilisé à la main : ça se reproduira.
  const transport: Transport = (r) => {
    if (r.chemin === "/login" && r.methode === "GET") {
      return Promise.resolve({ statut: 200, corps: "", cookies: [], emplacement: null });
    }
    return Promise.resolve({
      statut: 200,
      corps:
        "<p>Pour des raisons de sécurité, votre mot de passe a expiré suite à une longue période d'inactivité.</p>",
      cookies: [],
      emplacement: null,
    });
  };
  const e = await assertRejects(
    () =>
      new ForumactifEnPublication(transport, COMPTE).repondre(813, "", "Bilan du sujet.", CODE),
    MotDePasseExpire,
  );
  assert(e.message.includes("FORUM_MOTDEPASSE"), e.message);
  assert(e.message.includes("Rien à corriger dans le code"), e.message);
});
