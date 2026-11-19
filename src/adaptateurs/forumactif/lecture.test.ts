// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/lecture.test.ts
//
//  Les tests tournent sur une page ENREGISTRÉE SUR LE VRAI FORUM, pas
//  sur un gabarit écrit pour l'occasion. C'est la seule façon de savoir
//  que le parseur tient : on ne peut pas se tromper en sa faveur quand
//  l'entrée vient d'ailleurs.
//
//  fixtures/sujet-813.html : relevé le 2 octobre 2026 sur
//  /t813-petites-annonces, en visiteur non connecté.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertThrows } from "@std/assert";
import type { Recuperateur } from "./lecture.ts";
import {
  cheminDuSujet,
  decalagesDesPages,
  decoder,
  ForumactifEnLecture,
  lireLesMessages,
  lireLesSujetsRemues,
  messagePortantUnMarqueur,
  messagesApres,
  PageIllisible,
} from "./lecture.ts";

const PAGE = await Deno.readTextFile(
  new URL("./fixtures/sujet-813.html", import.meta.url),
);

Deno.test("lit les messages du sujet et laisse la publicité dehors", () => {
  const messages = lireLesMessages(PAGE, 813);
  // 15543 vient du relevé du 2 octobre sur /t975-test, ajouté à la même
  // fixture : un compte sans couleur de groupe.
  assertEquals(messages.map((m) => m.id), [12485, 15263, 15543]);
});

Deno.test("le bloc « Contenu sponsorisé » n'est pas un message", () => {
  // id p0, data-id -2 : c'est une régie publicitaire glissée au milieu
  // du sujet. L'inscrire au registre serait absurde.
  assert(PAGE.includes('data-id="-2"'), "la fixture doit bien contenir le piège");
  assertEquals(lireLesMessages(PAGE, 813).some((m) => m.id === 0), false);
});

Deno.test("l'auteur vient de l'avatar, pas d'un lien", () => {
  const [premier, second] = lireLesMessages(PAGE, 813);
  assertEquals(premier.auteurId, 3);
  assertEquals(premier.auteurPseudo, "Maître du Jeu");
  assertEquals(second.auteurId, 1);
  assertEquals(second.auteurPseudo, "Arceus");
});

Deno.test("le groupe du membre est lisible sur chaque message", () => {
  // C'est le mur de `_userdata` qui tombe : le groupe n'est pas exposé
  // au navigateur, mais il est écrit dans la page que le serveur lit.
  const [premier, second] = lireLesMessages(PAGE, 813);
  assertEquals(premier.groupeId, 2);
  assertEquals(second.groupeId, 5);
});

Deno.test("le sujet demandé est reporté sur chaque message", () => {
  for (const m of lireLesMessages(PAGE, 813)) assertEquals(m.sujetId, 813);
});

Deno.test("les marqueurs sont relevés, et seulement les nôtres", () => {
  const [sans, avec] = lireLesMessages(PAGE, 813);
  assertEquals(sans.marqueurs, []);
  assertEquals(avec.marqueurs.length, 2);
  assertEquals(avec.marqueurs[0].code, "WM-ACDE-FGH");
  assertEquals(avec.marqueurs[1].code, "WM-RTUV-WXY");
});

Deno.test("une page qui n'est pas un sujet lève au lieu de rendre une liste vide", () => {
  // Une liste vide serait une panne silencieuse : le registre se
  // viderait sans que personne ne s'en aperçoive.
  assertThrows(
    () => lireLesMessages("<html><body>maintenance</body></html>", 813),
    PageIllisible,
  );
  assertThrows(() => lireLesMessages("", 813), PageIllisible);
});

Deno.test("une page qui n'a que de la publicité lève aussi", () => {
  const seulementPub = PAGE.slice(
    PAGE.indexOf('<div id="p0"'),
    PAGE.indexOf('<div id="p15263"'),
  );
  assertThrows(() => lireLesMessages(seulementPub, 813), PageIllisible);
});

Deno.test("decoder · rend les accents que Forumactif encode", () => {
  assertEquals(decoder("Ma&icirc;tre du Jeu"), "Maître du Jeu");
  assertEquals(decoder("EST ARRIV&Eacute; LE"), "EST ARRIVÉ LE");
  assertEquals(decoder("&amp;&lt;&gt;&quot;&#39;"), "&<>\"'");
  assertEquals(decoder("&#233;t&eacute;"), "été");
  assertEquals(decoder("rien à décoder"), "rien à décoder");
  assertEquals(decoder("&inconnue;"), "&inconnue;");
});

Deno.test("lireLesSujetsRemues · garde le plus grand identifiant par sujet", () => {
  const liste = `
    <a href="/t813-petites-annonces">Petites Annonces</a>
    <a href="/t813-petites-annonces#15263">dernier</a>
    <a href="/t916-joyeux-anniversaire#14676">dernier</a>
    <a href="/t906-mise-a-jour#0">pas de message</a>`;
  assertEquals(lireLesSujetsRemues(liste), [
    { sujetId: 813, dernierMessageId: 15263 },
    { sujetId: 916, dernierMessageId: 14676 },
  ]);
});

Deno.test("l'adaptateur ne garde que ce qui est arrivé après le dernier vu", async () => {
  const forum = new ForumactifEnLecture((_chemin: string) => Promise.resolve(PAGE));
  assertEquals((await forum.messagesDuSujet(813, 0)).map((m) => m.id), [12485, 15263, 15543]);
  assertEquals((await forum.messagesDuSujet(813, 12485)).map((m) => m.id), [15263, 15543]);
  assertEquals(await forum.messagesDuSujet(813, 99999), []);
});

Deno.test("l'adaptateur demande bien la page du sujet", async () => {
  const demandes: string[] = [];
  const forum = new ForumactifEnLecture((chemin: string) => {
    demandes.push(chemin);
    return Promise.resolve(PAGE);
  });
  await forum.messagesDuSujet(813, 0);
  assertEquals(demandes, ["/t813-"]);
});

// ── la forme relevée le 2 octobre sur /t975-test ────────────────────

Deno.test("un pseudo SANS <strong> est lu quand même", async () => {
  // Forumactif sert deux formes selon que le membre a une couleur de
  // groupe ou non. La seconde faisait lever PageIllisible, et la relève
  // s'arrêtait sur tout le sujet.
  const html = await Deno.readTextFile(
    new URL("./fixtures/sujet-813.html", import.meta.url),
  );
  const messages = lireLesMessages(html, 975);
  const sansGroupe = messages.find((m) => m.id === 15543);
  assert(sansGroupe !== undefined, "le message sans groupe doit être lu");
  assertEquals(sansGroupe.auteurPseudo, "Compte de test");
  assertEquals(sansGroupe.auteurId, 4);
  assertEquals(sansGroupe.groupeId, null, "pas de post-group-N : null, pas une erreur");
});

Deno.test("les deux formes de pseudo cohabitent dans la même page", () => {
  const avec =
    `<div id="p1" class="post row1 post--1 post-group-2"><div class="postprofile-avatar" data-id="3"></div><div class="postprofile-name"><span class="group-2"><strong>Ma&icirc;tre du Jeu</strong></span></div></div>`;
  const sans =
    `<div id="p2" class="post row2 post--2 "><div class="postprofile-avatar" data-id="4"></div><div class="postprofile-name">Compte de test</div></div>`;
  const lus = lireLesMessages(avec + sans, 975);
  assertEquals(lus.map((m) => m.auteurPseudo), ["Maître du Jeu", "Compte de test"]);
});

Deno.test("un bloc de pseudo vide lève plutôt que de rendre un pseudo vide", () => {
  const html =
    `<div id="p1" class="post row1 post--1 "><div class="postprofile-avatar" data-id="4"></div><div class="postprofile-name">  </div></div>`;
  assertThrows(() => lireLesMessages(html, 975), PageIllisible);
});

// ── les actions, tâche 1 de la relève ───────────────────────────────

Deno.test("l'adaptateur rend les actions rattachées à leur sujet", async () => {
  //  La page enregistrée ne contient aucun bloc d'action — elle date
  //  d'avant les boutons. On en pose un dans une copie plutôt que de
  //  réenregistrer la page : ce qu'on teste ici, c'est le branchement
  //  entre `lireLesMessages` et `actionsDemandees`, pas la lecture du
  //  HTML, qui a ses propres tests juste au-dessus.
  const avecAction = PAGE.replace(
    /(<div id="p15543"[\s\S]{0,4000}?<div class="content">)/,
    "$1[[WM-ACTION:fouiller]]",
  );

  const forum = new ForumactifEnLecture((_c: string) => Promise.resolve(avecAction));
  const actions = await forum.actionsDuSujet(813, 0);

  assertEquals(actions.length, 1);
  assertEquals(actions[0].sujetId, 813);
  assertEquals(actions[0].messageId, 15543);
  assertEquals(actions[0].action, { type: "fouiller" });
  assertEquals(actions[0].auteurPseudo, "Compte de test");
});

Deno.test("le curseur s'applique aussi aux actions", async () => {
  const avecAction = PAGE.replace(
    /(<div id="p15543"[\s\S]{0,4000}?<div class="content">)/,
    "$1[[WM-ACTION:fouiller]]",
  );
  const forum = new ForumactifEnLecture((_c: string) => Promise.resolve(avecAction));
  assertEquals((await forum.actionsDuSujet(813, 15543)).length, 0);
});

Deno.test("un sujet sans aucun bloc ne rend aucune action", async () => {
  const forum = new ForumactifEnLecture((_c: string) => Promise.resolve(PAGE));
  assertEquals(await forum.actionsDuSujet(813, 0), []);
});

// ── L'ANNUAIRE DES PSEUDOS ─────────────────────────────────────────
//
//  Les décors viennent du gabarit du dépôt, `templates/memberlist_body`,
//  qui est celui que le forum sert. Les parseurs ont leurs propres
//  tests dans `membres.test.ts` ; ici on mesure LE PARCOURS : combien de
//  pages sont demandées, lesquelles, et ce qui se passe quand l'une
//  tombe.

const ligne = (id: number, nom: string) =>
  `<a class="wm-membres__nom" href="/u${id}"><span class="group-5 usr_grp_clr"><strong>${nom}</strong></span></a>`;

Deno.test("l'annuaire suit la pagination du forum, et ne la devine pas", async () => {
  //  MESURÉ LE 16 NOVEMBRE : `?start=50` répond 200 avec zéro membre.
  //  Un pas deviné de 50 sauterait la moitié des membres si le forum en
  //  affiche 25 par page — les liens, eux, disent la vérité.
  const demandes: string[] = [];
  const forum = new ForumactifEnLecture((chemin: string) => {
    demandes.push(chemin);
    if (chemin === "/memberlist") {
      return Promise.resolve(
        `<ul id="memberlist">${ligne(5, "Erin Kavanagh")}${ligne(1, "Arceus")}</ul>
         <div class="pagination"><a href="/memberlist?start=0">1</a>
         <a href="/memberlist?start=25">2</a></div>`,
      );
    }
    return Promise.resolve(`<ul id="memberlist">${ligne(4, "Jake Dalziel")}</ul>`);
  });

  const table = await forum.pseudosDuForum();
  assertEquals(demandes, ["/memberlist", "/memberlist?start=25"]);
  assertEquals(table.size, 3);
  assertEquals(table.get(4), "Jake Dalziel");
});

Deno.test("UNE PAGE QUI SE NOMME ELLE-MÊME NE FAIT PAS BOUCLER L'ANNUAIRE", async () => {
  //  Ce n'est pas de la méfiance envers Forumactif : il suffit d'un
  //  paramètre de tri en plus pour que deux adresses DIFFÉRENTES
  //  rendent la même page, et l'ensemble des adresses déjà vues n'y
  //  suffit pas. La fonction Edge a trente secondes.
  let appels = 0;
  const forum = new ForumactifEnLecture((_c: string) => {
    appels += 1;
    //  Chaque page annonce une suivante, toujours neuve.
    return Promise.resolve(
      `<ul id="memberlist">${ligne(appels + 100, `Membre ${appels}`)}</ul>
       <a href="/memberlist?page=${appels}&start=${appels * 25}">suite</a>`,
    );
  });

  const table = await forum.pseudosDuForum();
  assertEquals(appels, 20, "le plafond arrête la boucle");
  assertEquals(table.size, 20);
});

Deno.test("UNE PAGE SUIVANTE QUI TOMBE N'EMPORTE PAS LES PRÉCÉDENTES", async () => {
  //  On rend ce qu'on a lu : la table peut être partielle, c'est écrit
  //  dans le port, et un membre absent garde le nom qu'on lui connaît.
  const forum = new ForumactifEnLecture((chemin: string) => {
    if (chemin === "/memberlist") {
      return Promise.resolve(
        `<ul id="memberlist">${ligne(5, "Erin Kavanagh")}</ul>
         <a href="/memberlist?start=25">2</a>`,
      );
    }
    return Promise.reject(new Error("HTTP 503"));
  });

  const table = await forum.pseudosDuForum();
  assertEquals(table.size, 1);
  assertEquals(table.get(5), "Erin Kavanagh");
});

Deno.test("mais la PREMIÈRE page qui tombe, elle, remonte", async () => {
  //  Sans elle on n'a rien, et rendre une table vide ferait croire à un
  //  forum sans membres — donc à trente personnages à ne pas renommer,
  //  silencieusement.
  const forum = new ForumactifEnLecture((_c: string) => Promise.reject(new Error("HTTP 503")));
  let leve = false;
  try {
    await forum.pseudosDuForum();
  } catch {
    leve = true;
  }
  assertEquals(leve, true);
});

// ════════════════════════════════════════════════════════════════════
//  LA PAGINATION
//
//  Le 19 novembre, un sujet a dépassé vingt-cinq messages, et six
//  lectures sont devenues aveugles d'un coup : clôture, fouille,
//  panier, réclamation de carnet, messages du sujet, et la
//  vérification de publication. Toutes les six demandaient `/t<id>-`.
//
//  Les adresses de page sont relevées sur le forum le même jour, sur
//  /t1000-sujet-2 : /t1000p25-, p50, p75, p100 — vingt-cinq messages
//  par page, et le slug est facultatif.
//
//  Les pages d'essai ci-dessous ne sont PAS un gabarit écrit pour
//  l'occasion : on découpe un vrai message de la fixture et on lui
//  change son numéro. Le parseur voit donc du HTML de Forumactif.
// ════════════════════════════════════════════════════════════════════

/** Un vrai bloc de message de la fixture, renuméroté.
 *
 *  Le découpage traîne derrière lui le bloc de publicité `p0` que
 *  Forumactif glisse entre les messages — on le garde, c'est le vrai
 *  HTML. Ce qu'on ajoute au message va donc DEVANT la publicité : au
 *  delà, le texte appartiendrait au bloc suivant, pas à celui-ci. */
function blocReel(id: number, ajout = ""): string {
  const debut = PAGE.indexOf('<div id="p12485"');
  const fin = PAGE.indexOf('<div id="p15263"');
  assert(debut >= 0 && fin > debut, "la fixture doit contenir ses deux messages");
  const bloc = PAGE.slice(debut, fin).replaceAll("12485", String(id));
  if (ajout === "") return bloc;
  const pub = bloc.indexOf('<div id="p0"');
  return pub < 0 ? bloc + ajout : bloc.slice(0, pub) + ajout + bloc.slice(pub);
}

/** La pagination telle que Forumactif la sème, pour `pages` pages. */
function pagination(sujetId: number, pages: number): string {
  if (pages < 2) return "";
  const liens = [];
  for (let p = 1; p < pages; p++) {
    liens.push(`<a href="/t${sujetId}p${p * 25}-petites-annonces">${p + 1}</a>`);
  }
  return `<div class="pagination"><span>${liens.join("")}</span></div>`;
}

/** Un sujet de `pages` pages, vingt-cinq messages chacune, le dernier
 *  message portant éventuellement un texte en plus. */
function sujetPagine(
  sujetId: number,
  pages: number,
  ajout: Record<number, string> = {},
): {
  recuperer: Recuperateur;
  demandees: string[];
  dernierId: number;
} {
  const parPage = new Map<number, string>();
  let id = 1000;
  for (let p = 0; p < pages; p++) {
    const blocs = [];
    for (let i = 0; i < 25; i++, id++) {
      blocs.push(blocReel(id, ajout[id] ?? ""));
    }
    parPage.set(p * 25, blocs.join("\n") + pagination(sujetId, pages));
  }
  const demandees: string[] = [];
  const recuperer = (chemin: string) => {
    demandees.push(chemin);
    const m = /^\/t(\d+)(?:p(\d+))?-$/.exec(chemin);
    if (!m || Number(m[1]) !== sujetId) return Promise.reject(new Error(`404 ${chemin}`));
    const html = parPage.get(Number(m[2] ?? 0));
    if (html === undefined) return Promise.reject(new Error(`404 ${chemin}`));
    return Promise.resolve(html);
  };
  return { recuperer, demandees, dernierId: id - 1 };
}

Deno.test("les décalages de page se relèvent dans la pagination", () => {
  assertEquals(decalagesDesPages(pagination(1000, 5), 1000), [0, 25, 50, 75, 100]);
  // Un sujet d'une page n'a pas de pagination : il n'a que la sienne.
  assertEquals(decalagesDesPages("<div>rien</div>", 1000), [0]);
  // La pagination d'un AUTRE sujet ne compte pas.
  assertEquals(decalagesDesPages(pagination(999, 4), 1000), [0]);
});

Deno.test("l'adresse d'une page est celle du forum", () => {
  assertEquals(cheminDuSujet(1000, 0), "/t1000-");
  assertEquals(cheminDuSujet(1000, 100), "/t1000p100-");
});

Deno.test("un sujet d'une seule page se lit en une seule demande", async () => {
  //  Garde-fou de coût : la pagination ne doit rien changer au cas
  //  courant, sinon la relève double son trafic pour rien.
  const { recuperer, demandees } = sujetPagine(1000, 1);
  const lus = await messagesApres(recuperer, 1000, 1010);
  assertEquals(demandees, ["/t1000-"]);
  assertEquals(lus.map((m) => m.id), [
    1011,
    1012,
    ...Array.from({ length: 12 }, (_, i) => 1013 + i),
  ]);
});

Deno.test("LE BUG DU 19 NOVEMBRE : le neuf est sur la dernière page", async () => {
  //  Cinq pages, et le dernier message lu était l'avant-dernier du
  //  sujet. L'ancienne lecture demandait `/t1000-` et rendait zéro
  //  message : le sujet paraissait muet.
  const { recuperer, demandees, dernierId } = sujetPagine(1000, 5);
  const lus = await messagesApres(recuperer, 1000, dernierId - 1);
  assertEquals(lus.map((m) => m.id), [dernierId]);
  //  Deux pages lues : la première pour sa pagination, la dernière
  //  pour son contenu. Pas les cinq.
  assertEquals(demandees, ["/t1000-", "/t1000p100-"]);
});

Deno.test("et on remonte tant que la page lue ne contient que du neuf", async () => {
  const { recuperer, demandees, dernierId } = sujetPagine(1000, 5);
  //  La frontière est deux pages en arrière : il faut les traverser.
  const lus = await messagesApres(recuperer, 1000, dernierId - 30);
  assertEquals(lus.length, 30);
  assertEquals(lus[0].id, dernierId - 29);
  assertEquals(lus[lus.length - 1].id, dernierId);
  assertEquals(demandees, ["/t1000-", "/t1000p100-", "/t1000p75-"]);
});

Deno.test("LA FOUILLE : une action postée page 5 est vue", async () => {
  //  Le symptôme qu'elle décrit — « quand je fouille, ça ne fonctionne
  //  pas ». Le bloc du bouton est dans le dernier message du sujet.
  const { recuperer, dernierId } = sujetPagine(1000, 5, {});
  const avecFouille = sujetPagine(1000, 5, { [dernierId]: "[[WM-ACTION:fouiller]]" });
  const forum = new ForumactifEnLecture(avecFouille.recuperer);
  const actions = await forum.actionsDuSujet(1000, dernierId - 1);
  assertEquals(actions.map((a) => a.action.type), ["fouiller"]);
  assertEquals(actions[0].messageId, dernierId);
  //  Et la preuve que l'ancienne lecture ne le voyait pas : la
  //  première page ne contient pas ce bloc.
  const page1 = await recuperer("/t1000-");
  assertEquals(page1.includes("WM-ACTION"), false);
});

Deno.test("LES 144 : la carte posée page 5 est retrouvée", async () => {
  //  `carte_essais 144`, et l'erreur « statut 200, et le message n'est
  //  pas dans le sujet ». Le message Y ÉTAIT — page 5.
  const code = "WM-A4C7-D3E";
  const { recuperer, dernierId } = sujetPagine(1000, 5, {
    [1024]: `[[WM:vieux:WM-W9Y7-X4V]]`,
  });
  const avecCarte = sujetPagine(1000, 5, { [dernierId]: `[[WM:charge:${code}]]` });
  const trouve = await messagePortantUnMarqueur(avecCarte.recuperer, 1000, code);
  assertEquals(trouve?.id, dernierId);
  //  Et ce qui n'y est pas rend bien null, sans boucler.
  assertEquals(await messagePortantUnMarqueur(recuperer, 1000, code), null);
});

Deno.test("la pagination tronquée d'un très long sujet est suivie", async () => {
  //  Passé une poignée de pages, Forumactif masque le milieu : la
  //  première page ne montre que le début et la fin. On vérifie quand
  //  même sur la dernière page connue qu'elle n'en révèle pas de plus
  //  loin — ici elle en révèle.
  const demandees: string[] = [];
  const recuperer = (chemin: string) => {
    demandees.push(chemin);
    if (chemin === "/t1000-") {
      return Promise.resolve(blocReel(1) + `<a href="/t1000p25-x">2</a>`);
    }
    if (chemin === "/t1000p25-") {
      return Promise.resolve(blocReel(2) + `<a href="/t1000p50-x">3</a>`);
    }
    if (chemin === "/t1000p50-") return Promise.resolve(blocReel(3));
    return Promise.reject(new Error(`404 ${chemin}`));
  };
  const lus = await messagesApres(recuperer, 1000, 2);
  assertEquals(lus.map((m) => m.id), [3]);
  assert(demandees.includes("/t1000p50-"), "la dernière page doit être atteinte");
});
