// ════════════════════════════════════════════════════════════════════
//  outils/poster.mjs — la page d'écriture, montée dans un navigateur
//
//  Lancement : `deno task poster`
//
//  ── POURQUOI CE HARNAIS EXISTE ─────────────────────────────────────
//
//  « Améliore aussi l'affichage de cette page », 27 octobre, sur
//  `/post`. Le § 9 de `css/06-ecrire.css` a donné au formulaire la
//  surface, la bordure et le rayon qu'il n'avait pas, et fait de son
//  titre une étiquette comme les autres.
//
//  Rien ne retenait ces corrections. Le relevé du projet le disait
//  noir sur blanc — « il n'existe aucun harnais pour la page d'un
//  sujet, ni pour /post » — et le premier a été monté le 28 octobre.
//  Voici le second.
//
//  ── CE QU'IL MONTE ─────────────────────────────────────────────────
//
//  Le VRAI `posting_body.nouveau.html`, celui qu'on publiera, avec un
//  décor qui reproduit ce que ModernBB impose au formulaire : la
//  teinte du panneau, les marges d'époque du `fieldset`, et le trait
//  bleu sous les titres. Sans ces trois-là, le harnais ne pourrait pas
//  voir les défauts qu'on a corrigés : il testerait une page nue que
//  personne ne sert.
//
//  ── CE QU'IL NE FAIT PAS ───────────────────────────────────────────
//
//  Il ne monte ni SCEditor ni notre JavaScript. L'éditeur est un
//  greffon de Forumactif chargé à l'exécution ; le § 3 de la feuille
//  le style par ses classes, et les vérifier demanderait de le servir
//  en entier. C'est une dette, elle est dite ici.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";
import { ouvrirChromium } from "./chromium.mjs";

const R = new URL("..", import.meta.url).pathname;

// ── résoudre le gabarit ─────────────────────────────────────────────

/** Retire un bloc Forumactif AVEC son contenu. */
function sansBloc(s, nom) {
  const re = new RegExp(`<!--\\s*BEGIN ${nom}\\s*-->[\\s\\S]*?<!--\\s*END ${nom}\\s*-->`, "g");
  return s.replace(re, "");
}

/** Garde le contenu d'un bloc et retire ses marqueurs. */
function gardeBloc(s, nom) {
  const re = new RegExp(
    `<!--\\s*BEGIN ${nom}\\s*-->([\\s\\S]*?)<!--\\s*END ${nom}\\s*-->`,
    "g",
  );
  return s.replace(re, "$1");
}

/*  LES COMMENTAIRES DE DOCUMENTATION PARTENT AVANT TOUT REMPLACEMENT.
    Le piège est connu et il a coûté deux jours : Forumactif remplace
    ses variables JUSQUE DANS LES COMMENTAIRES — relevé sur `/f2` le 28
    octobre, où un commentaire du gabarit citait une variable entre
    accolades et le moteur l'a rendue, refermant le commentaire et
    déversant le texte dans la page. On ne garde que les commentaires
    qui portent un marqueur BEGIN/END. */
function sansCommentaires(s) {
  return s.replace(
    /<!--([\s\S]*?)-->/g,
    (tout, dedans) => /\b(BEGIN|END) \w/.test(dedans) ? tout : "",
  );
}

/** Ce que Forumactif met dans les variables qu'on garde. */
const MOTS = {
  L_POST_A: "Écrire un message",
  L_SUBJECT: "Sujet",
  L_MESSAGE_BODY: "Message",
  L_PREVIEW: "Prévisualiser",
  L_SUBMIT: "Envoyer",
  L_CANCEL: "Annuler",
  SUBJECT: "Un sujet de test",
  MESSAGE: "Le corps du message.",
  S_POST_ACTION: "/post",
};

function pageDePost() {
  let t = sansCommentaires(readFileSync(R + "templates/posting_body.nouveau.html", "utf8"));

  //  Ce qu'on garde : l'encart, son titre, le champ de sujet, la zone
  //  de message et les boutons d'envoi. C'est l'écran qu'on a corrigé.
  for (const b of ["switch_post_a", "switch_subject", "switch_preview"]) t = gardeBloc(t, b);

  //  Tout le reste part : ce sont des cas de figure — message privé,
  //  sondage, pièces jointes, modération — qui ne changent rien à la
  //  surface du formulaire et qui encombreraient la mesure.
  for (
    const b of [
      "switch_forum_rules",
      "switch_forum_rule_image",
      "switch_quote_limit",
      "switch_username",
      "switch_username_select",
      "switch_reasons",
      "edit_reason",
      "switch_privmsg",
      "switch_privmsg_friend",
      "switch_privmsg_group",
      "switch_description",
      "switch_subject_color",
      "switch_type_toggle",
      "switch_type_cal",
      "switch_type_seo",
      "switch_icon_checkbox",
      "switch_attachment",
      "switch_attachment_list",
      "switch_attachments",
      "attachments",
      "switch_html_checkbox",
      "switch_bbcode_checkbox",
      "switch_smilies_checkbox",
      "switch_signature_checkbox",
      "switch_notify_checkbox",
      "switch_delete_checkbox",
      "switch_draft",
      "switch_publish",
      "switch_roll_dice",
      "switch_signature",
      "switch_topic_button",
      "switch_topic_modif",
      "switch_warning_msg",
      "switch_is_orphan",
      "switch_is_not_orphan",
      "switch_jumpbox",
      "switch_image_resize",
      "row",
      "row_replace",
      "cell",
    ]
  ) t = sansBloc(t, b);

  //  LES SCRIPTS DE FORUMACTIF PARTENT. Le gabarit en porte plusieurs
  //  qui s'appuient sur le jQuery du forum : sans lui, chacun lève
  //  « $ is not defined », et un gabarit à moitié résolu lève en plus
  //  « Unexpected token '<' ». Du bruit qui noierait une vraie erreur
  //  de page. On mesure une mise en page, pas les scripts de
  //  Forumactif, qui ont leur propre place dans `barre.mjs`.
  t = t.replace(/<script[\s\S]*?<\/script>/g, "");

  return t.replace(/\{([\w.]+)\}/g, (_, n) => MOTS[n] ?? "");
}

//  ── CE QUE MODERNBB POSE ET QU'ON SUBIT ────────────────────────────
//
//  Le décor ne charge pas la feuille entière de Forumactif : on y met
//  ce qui a vraiment piégé cette page.
//
//  · LA TEINTE DU PANNEAU. `.panel` arrive avec son propre fond et sa
//    bordure ; sans elle, un formulaire sans surface aurait l'air
//    correct dans le harnais et nu sur le forum.
//  · LES MARGES D'ÉPOQUE DU `fieldset`, que le § 9 remet à zéro.
//  · LE TRAIT BLEU SOUS LES TITRES, celui qu'on a retiré partout au
//    § 12 de `02`. C'est un `h3` comme ailleurs.
const BASE_MODERNBB = `
/*  BORDER-BOX PARTOUT, comme ModernBB : sa feuille le pose sur
    l'universel, verifie sur le forum le 30 octobre. Sans cette
    ligne, le decor mesure en content-box et invente des
    debordements : la boite a smileys sortait de trois pixels a
    700 px de large, et le defaut n'existait que dans le harnais.
    (Pas d'accents ni de guillemets obliques ici : ce commentaire
     vit dans un gabarit de chaine, ou un seul accent grave
     fermerait la chaine.) */
*, ::before, ::after { box-sizing: border-box; }
.panel { background: #f0f0f0; border: 1px solid #ccc; padding: 10px; }
#postingbox fieldset.fields1 { margin: 1em 0; padding: 0.5em; border: 1px solid #ddd; }
/*  LE FIELDSET DES BOUTONS, tel que ModernBB le peint : une bordure,
    un fond et un rembourrage de groupe de champs. Sans lui ici, la
    regle qui les retire n'aurait rien a retirer. */
fieldset.submit-buttons { margin: 1em 0; padding: 8px; border: 1px solid #ccc; background: #f5f5f5; }
.h3 { border-bottom: 1px solid #ccc; padding-bottom: 4px; }`;

const page = (corps) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${BASE_MODERNBB}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>html,body{margin:0}body{background:var(--wm-fond-page)}</style>
</head><body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp">
<div id="wrap"><div id="page-body">${corps}</div></div>
</div>
</body></html>`;

// ── le navigateur ───────────────────────────────────────────────────

//  ── UN HARNAIS QUI NE DÉMARRE PAS DOIT ÉCHOUER ───────────────────
//
//  Troisième fois le 23 novembre : la liste de chemins figée ne
//  trouvait pas le Chromium de la machine, le lancement cassait dans
//  une promesse de haut niveau, **et Deno sortait en code 0**. Le CI
//  lisait « réussi » sur un harnais qui n'avait pas ouvert une page.
globalThis.addEventListener("unhandledrejection", (e) => {
  e.preventDefault();
  console.error("\nLE HARNAIS A CASSÉ EN COURS DE ROUTE :\n" + String(e.reason));
  Deno.exit(1);
});

let nav;
try {
  nav = await ouvrirChromium(chromium);
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e));
  Deno.exit(1);
}
const soucis = [];

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

const p = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
p.on("pageerror", (e) => {
  soucis.push("erreur JS : " + e.message);
  console.log("  ERREUR JS :", e.message);
});
await p.route(
  "**/*",
  (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: page(pageDePost()) }),
);
await p.goto("https://exemple.test/post");

console.log("\n── la page d'écriture ──");

const releve = await p.evaluate(() => {
  const boite = document.querySelector("#postingbox");
  if (boite === null) return null;
  const st = getComputedStyle(boite);
  const titre = boite.querySelector(".h3");
  const champs = boite.querySelector("fieldset.fields1");
  const inner = boite.querySelector(".inner");
  const r = boite.getBoundingClientRect();
  return {
    //  L'ENCART A UNE SURFACE. C'est la correction du 27 octobre : le
    //  formulaire flottait sur le fond de page, sans rien qui dise où
    //  il commence.
    fond: st.backgroundColor,
    fondPage: getComputedStyle(document.body).backgroundColor,
    bordure: st.borderTopWidth,
    rayon: st.borderTopLeftRadius,
    rembourrageHaut: st.paddingTop,
    rembourrageCote: st.paddingLeft,
    largeur: Math.round(r.width),
    //  SON TITRE EST UNE ÉTIQUETTE, pas un titre souligné de bleu.
    titre: titre === null ? null : {
      filet: getComputedStyle(titre).borderBottomWidth,
      casse: getComputedStyle(titre).textTransform,
      taille: getComputedStyle(titre).fontSize,
      texte: titre.textContent.trim(),
    },
    //  ET LE `fieldset` A PERDU SES MARGES D'ÉPOQUE.
    champs: champs === null ? null : {
      marge: getComputedStyle(champs).marginTop,
      rembourrage: getComputedStyle(champs).paddingTop,
      bordure: getComputedStyle(champs).borderTopWidth,
    },
    //  `.inner` est une coquille de ModernBB : elle ne doit pas
    //  rajouter une seconde surface dans la première.
    inner: inner === null ? null : {
      fond: getComputedStyle(inner).backgroundColor,
      rembourrage: getComputedStyle(inner).paddingTop,
    },
  };
});

dire("LE FORMULAIRE EST MONTÉ", releve !== null);

dire(
  "L'ENCART A UNE SURFACE, UNE BORDURE ET UN RAYON",
  //  « Améliore aussi l'affichage de cette page », 27 octobre. Le
  //  formulaire n'avait aucune des trois : il flottait sur le fond.
  releve !== null && releve.fond !== releve.fondPage &&
    releve.fond !== "rgba(0, 0, 0, 0)" &&
    parseFloat(releve.bordure) >= 1 && parseFloat(releve.rayon) >= 8,
  JSON.stringify({
    fond: releve?.fond,
    page: releve?.fondPage,
    bordure: releve?.bordure,
    rayon: releve?.rayon,
  }),
);

dire(
  "et ses 22 px de rembourrage sur les côtés, comme les bandes de section",
  releve !== null && releve.rembourrageCote === "22px" &&
    parseFloat(releve.rembourrageHaut) >= 16,
  `${releve?.rembourrageHaut} / ${releve?.rembourrageCote}`,
);

dire(
  "SON TITRE EST UNE ÉTIQUETTE, SANS LE TRAIT BLEU DE MODERNBB",
  //  Le trait a été retiré partout au § 12 de `02` ; le décor le
  //  remet pour que ce test puisse échouer.
  releve?.titre !== null && releve?.titre !== undefined &&
    releve.titre.filet === "0px" && releve.titre.casse === "uppercase",
  JSON.stringify(releve?.titre),
);

dire(
  "LE FIELDSET A PERDU SES MARGES DE FORMULAIRE D'ÉPOQUE",
  //  ModernBB lui met 1em de marge, un rembourrage et une bordure ;
  //  l'encart lui en donne déjà autour.
  releve?.champs !== null && releve?.champs !== undefined &&
    releve.champs.marge === "0px" && releve.champs.rembourrage === "0px" &&
    releve.champs.bordure === "0px",
  JSON.stringify(releve?.champs),
);

dire(
  "ET LA COQUILLE `.inner` N'AJOUTE PAS UNE SECONDE SURFACE",
  releve?.inner !== null && releve?.inner !== undefined &&
    releve.inner.rembourrage === "0px" &&
    releve.inner.fond === "rgba(0, 0, 0, 0)",
  JSON.stringify(releve?.inner),
);

//  ── LE FORMULAIRE NE DÉBORDE PAS, ET IL RESTE LISIBLE À L'ÉTROIT ───
//
//  Le § 8 de la feuille prévoit une bascule sous 740 px. On vérifie
//  aux deux bouts : à 1440 le formulaire suit la laisse du forum, et à
//  700 rien ne sort de l'écran.

for (const largeur of [1440, 700]) {
  await p.setViewportSize({ width: largeur, height: 1000 });
  const mesure = await p.evaluate(() => ({
    debord: document.documentElement.scrollWidth > innerWidth,
    boite: Math.round(document.querySelector("#postingbox").getBoundingClientRect().width),
    fenetre: innerWidth,
    //  ET QUI DÉBORDE. Un « ça déborde » qui ne dit pas quoi oblige à
    //  remonter la page à la main.
    boiteSmileys: (() => {
      const e = document.getElementById("smiley-box");
      if (e === null) return null;
      const c = getComputedStyle(e);
      const par = e.parentElement;
      return {
        l: Math.round(e.getBoundingClientRect().width),
        x: Math.round(e.getBoundingClientRect().x),
        box: c.boxSizing,
        w: c.width,
        maxw: c.maxWidth,
        pos: c.position,
        parent: (par.id || par.className || par.tagName) + " l=" +
          Math.round(par.getBoundingClientRect().width) + " x=" +
          Math.round(par.getBoundingClientRect().x),
      };
    })(),
    coupables: [...document.querySelectorAll("#postingbox *")]
      .filter((n) => Math.round(n.getBoundingClientRect().right) > innerWidth + 1)
      .slice(0, 5)
      .map((n) =>
        (n.tagName + (n.id ? "#" + n.id : "") +
          (typeof n.className === "string" && n.className.trim()
            ? "." + n.className.trim().split(/\s+/)[0]
            : "")) + " → " + Math.round(n.getBoundingClientRect().right)
      ),
  }));
  dire(
    `à ${largeur} px, le formulaire ne déborde pas`,
    !mesure.debord && mesure.boite <= mesure.fenetre,
    JSON.stringify(mesure),
  );
}

// ── la page « Êtes-vous sûr ? » ─────────────────────────────────────

/*  « Quand je veux supprimer un sujet, la page "êtes-vous sûr" le fond
    est vide, est-ce que tu peux faire comme la page "informations" ? »,
    30 octobre.

    Les deux pages sont le MÊME `<div class="panel">` nu — relevé dans
    `confirm_body.tpl` et `message_body.tpl` amont. La seule différence
    est que Forumactif ajoute `msgdie-panel` à l'une. Le harnais monte
    donc les deux côte à côte, plus un `.panel` nu : si la carte de la
    confirmation ne tenait qu'au prix de rendre son fond à tous les
    `.panel`, le troisième le dirait tout de suite. */
const confirmation = readFileSync(
  R + "templates/confirm_body.a-publier.html",
  "utf8",
)
  .replace(/\{MESSAGE_TITLE\}/g, "Confirmation")
  .replace(/\{MESSAGE_TEXT\}/g, "Êtes-vous sûr de vouloir supprimer ce sujet ?")
  .replace(/\{L_YES\}/g, "Oui")
  .replace(/\{L_NO\}/g, "Non")
  .replace(/\{[\w.]+\}/g, "");

const informations = `<div class="panel msgdie-panel"><div class="inner">
    <h1 class="page-title">Informations</h1>
    <p>Ce sujet n'existe pas.</p>
  </div></div>`;

/*  ON REVIENT À 1 440 PX, ET C'EST TOUT L'ENJEU. Le contrôle du
    débordement juste au-dessus rétrécit la fenêtre à 700 et ne la
    rend jamais. Les premières mesures de cette page-ci tournaient
    donc sous `@media (max-width: 760px)`, où `.submit-buttons` passe
    en `justify-content: stretch` et `padding-right: 0` — c'est-à-dire
    dans un état où la règle qu'on croyait prouver était déjà posée
    par quelqu'un d'autre. Trois déclarations ont été déclarées mortes
    sur cette mesure-là ; elles ne l'étaient pas. */
await p.setViewportSize({ width: 1440, height: 1000 });

await p.setContent(
  page(confirmation + informations + '<div class="panel" id="nu">rien</div>'),
  { waitUntil: "load" },
);

const cartes = await p.evaluate(() => {
  const conf = document.querySelector(".wm-confirmer");
  const info = document.querySelector(".msgdie-panel");
  const nu = document.querySelector("#nu");
  if (conf === null || info === null) return null;
  const st = (e) => getComputedStyle(e);
  return {
    //  LA MÊME CARTE QUE « INFORMATIONS », à la lettre : même fond,
    //  même bordure, même rayon. C'est ce qui a été demandé.
    memeFond: st(conf).backgroundColor === st(info).backgroundColor,
    memeBordure: st(conf).borderTopColor === st(info).borderTopColor &&
      st(conf).borderTopWidth === st(info).borderTopWidth,
    memeRayon: st(conf).borderTopLeftRadius === st(info).borderTopLeftRadius,
    //  ET SURTOUT : elle a VRAIMENT un fond. Deux transparents se
    //  ressemblent aussi.
    fondPlein: st(conf).backgroundColor !== "rgba(0, 0, 0, 0)",
    //  ET LE `.panel` NU RESTE TRANSPARENT. La règle du 8 octobre —
    //  le bloc d'accueil ne veut pas de deuxième carte derrière lui —
    //  ne doit pas avoir été défaite pour arranger celle-ci.
    nuTransparent: st(nu).backgroundColor === "rgba(0, 0, 0, 0)",
  };
});

dire(
  "la page de confirmation prend la carte de « Informations »",
  cartes !== null && cartes.memeFond && cartes.memeBordure &&
    cartes.memeRayon && cartes.fondPlein && cartes.nuTransparent,
  JSON.stringify(cartes),
);

const boutons = await p.evaluate(() => {
  const champ = document.querySelector(".wm-confirmer__actions");
  const oui = document.querySelector('.wm-confirmer input[name="confirm"]');
  const non = document.querySelector('.wm-confirmer input[name="cancel"]');
  if (champ === null || oui === null || non === null) return null;
  const st = (e) => getComputedStyle(e);
  const r = (e) => e.getBoundingClientRect();
  const carte = document.querySelector(".wm-confirmer");
  return {
    //  LES DEUX NOMS SONT LÀ — c'est le `return null` plus haut qui
    //  le dit, puisque les deux sélecteurs les cherchent par `name`.
    //  C'est par eux que Forumactif sait lequel a été cliqué : une
    //  page qui les perd ne confirme plus rien. Un champ
    //  `lesDeuxNoms: true` écrit en dur ne mesurait rien de plus.
    surUneLigne: Math.round(r(oui).top) === Math.round(r(non).top),
    //  Poussés à droite, comme partout ailleurs.
    aDroite: Math.round(r(carte).right - r(non).right) <= 24,
    //  « Oui » est plein, « Non » ne l'est pas — ils ne se
    //  distinguent pas qu'à la teinte, mais au remplissage.
    ouiPlein: st(oui).backgroundColor !== st(non).backgroundColor &&
      st(oui).backgroundColor !== "rgba(0, 0, 0, 0)",
    //  Le fieldset a perdu la bordure ET LE FOND de formulaire de
    //  ModernBB. Le fond était le trou du premier jet : seule la
    //  bordure était mesurée, et `background: none` passait donc pour
    //  une règle morte alors qu'elle retient le gris du décor.
    sansBordureDeChamp: parseFloat(st(champ).borderTopWidth) === 0,
    sansFondDeChamp: st(champ).backgroundColor === "rgba(0, 0, 0, 0)",
    //  Et chacun garde la cible tactile du socle.
    cible: Math.min(Math.round(r(oui).height), Math.round(r(non).height)),
    rembourrageDroit: st(champ).paddingRight,
    //  LES BOUTONS SE DÉTACHENT DU TEXTE QU'ILS CONFIRMENT.
    //  `.submit-buttons` pose `margin: 0`, qui les collait sous la
    //  phrase : on lit « supprimer ce sujet ? Oui Non » d'un trait.
    ecartAuTexte: Math.round(
      r(champ).top - r(document.querySelector(".wm-confirmer__texte")).bottom,
    ),
    ecartDroite: Math.round(r(carte).right - r(non).right),
  };
});

dire(
  "« Oui » et « Non » sont à droite, sur une ligne, et gardent leurs noms",
  boutons !== null && boutons.surUneLigne && boutons.aDroite &&
    boutons.ouiPlein && boutons.sansBordureDeChamp &&
    boutons.sansFondDeChamp && boutons.cible >= 36 &&
    boutons.ecartAuTexte >= 16,
  JSON.stringify(boutons),
);

await p.close();
//  ══════════════════════════════════════════════════════════════════
//  LE FORMULAIRE DE LA FICHE DE PRÉSENTATION — 23 novembre
//
//  « Normalement, quand on crée un sujet [dans Présentations] ça
//  remplit un formulaire HTML. Et d'ailleurs quand on édite son
//  message, ce serait super que ça reste comme ça. »
//
//  CE HARNAIS MONTE NOTRE JAVASCRIPT, contrairement au reste du
//  fichier qui ne mesure que la feuille de style. C'est nécessaire :
//  le formulaire n'existe pas dans le gabarit, il est posé par le
//  script, et une page sans script ne montrerait rien à mesurer.
//
//  SANS SCEDITOR, ET C'EST LE BON CAS À MESURER. `BrouillonForumactif`
//  a deux chemins — l'instance sceditor et le champ brut — et le
//  second est celui de la réponse rapide, donc un chemin réel. C'est
//  aussi le seul qu'on puisse monter ici sans servir le greffon entier
//  de Forumactif. La dette est dite : le chemin sceditor n'est mesuré
//  par rien.
//  ══════════════════════════════════════════════════════════════════

const STARTERS = {
  spriteBase: "https://exemple.test/sprites",
  especes: [
    {
      id: 172,
      nom: "Pichu",
      sprite: "ultra-sun-ultra-moon/172.gif",
      types: ["electrik"],
      talents: [{ nom: "Statik" }, { nom: "Paratonnerre", cache: true }],
    },
    {
      id: 133,
      nom: "Évoli",
      sprite: "ultra-sun-ultra-moon/133.gif",
      types: ["normal"],
      talents: [{ nom: "Échauffement" }],
    },
    { id: 1, nom: "Bulbizarre", types: ["plante", "poison"], talents: [{ nom: "Engrais" }] },
  ],
};

//  LE FIL D'ARIANE DIT LE FORUM, et c'est par lui que le script sait
//  qu'il est dans les Présentations — `forumDeLaPage` lit le dernier
//  maillon en `/fN-`.
//  `.sub-header-path` EST LE VRAI NOM, relevé dans `catalogue.ts` :
//  c'est l'une des deux classes que `forumDeLaPage` interroge. Un
//  décor qui en invente une autre mesure une page que le forum ne
//  sert pas — et le formulaire ne se poserait jamais, sans qu'on
//  sache pourquoi.
const ARIANE_PRESENTATIONS =
  '<div class="sub-header-path"><a href="/">Index</a> <a href="/c1-categorie">Le forum</a> ' +
  '<a href="/f7-presentations">Présentations</a></div>';

const pageAvecScript = (corps, message = "", ariane = ARIANE_PRESENTATIONS) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${BASE_MODERNBB}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>html,body{margin:0}body{background:var(--wm-fond-page)}</style>
</head><body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp">
<div id="wrap">${ariane}<div id="page-body">${
    corps.replace("Le corps du message.", message)
  }</div></div>
</div>
</body></html>`;

//  ── LE DÉCOR DES PAGES QUI NE DISENT PAS LE FORUM ──────────────────
//
//  `sansForum` retire le fil d'Ariane ET le `?f=` : c'est exactement
//  ce que servent l'édition d'un message (`/post?p=…&mode=editpost`)
//  et la prévisualisation (qui re-poste sur `/post` tout court).
//
//  SANS CETTE OPTION, LE BANC NE POUVAIT PAS VOIR LE DÉFAUT : son
//  décor a toujours porté le fil d'Ariane des Présentations, donc le
//  module trouvait le forum même là où la vraie page ne le donne pas.
async function monterLaFiche(message = "", { sujetVide = false, sansForum = false } = {}) {
  const q = await nav.newPage({ viewport: { width: 1440, height: 1200 } });
  q.on("pageerror", (e) => {
    soucis.push("erreur JS (fiche) : " + e.message);
    console.log("  ERREUR JS :", e.message);
  });
  await q.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith("/starters.json")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(STARTERS),
      });
    }
    if (u.pathname === "/js/wild-mystery.js") {
      return route.fulfill({
        contentType: "text/javascript; charset=utf-8",
        body: readFileSync(R + "js/wild-mystery.js", "utf8"),
      });
    }
    //  TOUT LE RESTE EST SERVI VIDE : le paquet va chercher d'autres
    //  fichiers pour d'autres modules, et aucun ne concerne la fiche.
    if (u.pathname.startsWith("/data/")) {
      return route.fulfill({ contentType: "application/json", body: "{}" });
    }
    if (u.pathname !== "/post") return route.fulfill({ status: 404, body: "" });
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: pageAvecScript(pageDePost(), message, sansForum ? "" : ARIANE_PRESENTATIONS),
    });
  });
  await q.goto("https://exemple.test/post");
  //  LE CHAMP « SUJET » VIDE, COMME À LA CRÉATION D'UN SUJET. Il doit
  //  l'être AVANT que le script se pose : c'est à ce moment-là que le
  //  formulaire décide si le titre suivra le nom du personnage.
  if (sujetVide) {
    await q.evaluate(() => {
      document.querySelector('input[name="subject"]').value = "";
    });
  }
  await q.evaluate(() => {
    const s = document.createElement("script");
    s.src = "/js/wild-mystery.js";
    document.body.appendChild(s);
  });
  await q.waitForTimeout(900);
  return q;
}

console.log("\n── l'éditeur de la fiche ──");

//  ── CE QU'ON TAPE DANS UNE ZONE ─────────────────────────────────────
//
//  Il n'y a plus de champ à qui donner une `value` : on écrit DANS la
//  fiche. Le harnais fait donc ce que fait un doigt — il pose le texte
//  dans la zone et émet `input`, exactement l'évènement que le
//  navigateur émet à la frappe.
//
//  ON REQUÊTE À CHAQUE FOIS, et jamais une référence gardée : trois
//  commandes redessinent la fiche, et une zone gardée d'avant le
//  redessin ne serait plus dans la page.
const OUTILS = () => {
  globalThis.wmZone = (clef, rang = 0) =>
    [...document.querySelectorAll(`[data-wmf-zone="${clef}"]`)][rang] ?? null;
  globalThis.wmTaper = (clef, v, rang = 0) => {
    const z = globalThis.wmZone(clef, rang);
    if (z === null) throw new Error(`pas de zone ${clef} au rang ${rang}`);
    z.textContent = v;
    z.dispatchEvent(new InputEvent("input", { bubbles: true }));
  };
  globalThis.wmTexte = (clef, rang = 0) => globalThis.wmZone(clef, rang)?.innerText ?? null;
  globalThis.wmMessage = () => document.querySelector("#text_editor_textarea").value;
  globalThis.wmPause = (ms = 180) => new Promise((r) => setTimeout(r, ms));
};

{
  const q = await monterLaFiche("");
  await q.evaluate(OUTILS);

  const pose = await q.evaluate(() => {
    const f = document.getElementById("wm-fiche");
    if (f === null) return { pose: false };
    const boite = document.getElementById("postingbox");
    return {
      pose: true,
      //  AU-DESSUS DU BLOC D'ÉDITION : on remplit la fiche, puis on
      //  envoie. Dans l'autre ordre, elle serait hors de l'écran au
      //  moment où on en a besoin.
      avantLEditeur: !!(f.compareDocumentPosition(boite) & Node.DOCUMENT_POSITION_FOLLOWING),
      //  ET C'EST LA FICHE, pas un formulaire : le rendu publié vit
      //  dans l'éditeur, avec ses vraies classes.
      estLaFiche: !!f.querySelector(".wmf-form__fiche .wmf"),
      colonnes: !!f.querySelector(".wmf__haut .wmf__avatar") &&
        !!f.querySelector(".wmf__haut .wmf__infos"),
      bandeaux: [...f.querySelectorAll(".wmf__bandeau")].map((b) => b.textContent),
      tableaux: f.querySelectorAll("table").length,
      //  AUCUN CHAMP DE FORMULAIRE SAUF LES COMMANDES — le titre du
      //  sujet, les deux menus du starter, la case de l'organisation.
      //  S'il en revenait un, c'est que le vieux dessin serait revenu
      //  avec : des champs à remplir au lieu d'une fiche à écrire.
      //
      //  LES COMMANDES DES BARRES DE BALISES NE COMPTENT PAS : les
      //  menus de taille et de police et le sélecteur de couleur sont
      //  des OUTILS posés sur une zone, pas des champs de la fiche.
      //  Ils sont dans `.wmf-form__balises`, et c'est à ça qu'on les
      //  reconnaît.
      champs: [...f.querySelectorAll("input, textarea, select")]
        .filter((e) => e.closest(".wmf-form__balises") === null)
        .map((e) => e.id || e.type),
    };
  });
  dire(
    "L'ÉDITEUR EST POSÉ, AU-DESSUS DU BLOC D'ÉDITION",
    pose.pose === true && pose.avantLEditeur === true,
    JSON.stringify({ pose: pose.pose, avant: pose.avantLEditeur }),
  );
  //  « Je veux pas juste remplir les champs. Je veux visuellement
  //  remplir ma fiche de présentation. »
  dire(
    "   ET C'EST LA FICHE ELLE-MÊME, avec ses deux colonnes",
    pose.estLaFiche === true && pose.colonnes === true,
    JSON.stringify({ fiche: pose.estLaFiche, colonnes: pose.colonnes }),
  );
  dire(
    "   et ses sections sont celles de la fiche publiée",
    JSON.stringify(pose.bandeaux) === JSON.stringify([
      "INFORMATIONS",
      "RACONTE-NOUS TON HISTOIRE",
      "COMPAGNON D'UNE VIE",
      "L'ÉQUIPE D'AVANT",
      "L'ORGANISATION",
      "DERRIÈRE L'ÉCRAN",
    ]),
    JSON.stringify(pose.bandeaux),
  );
  //  « Je veux pas de tableau, que du flexbox. »
  dire("   et aucun tableau", pose.tableaux === 0, String(pose.tableaux));
  dire(
    "   et plus aucun champ de formulaire, hors les quatre commandes",
    JSON.stringify(pose.champs) ===
      JSON.stringify(["wmf-titre", "wmf-espece", "wmf-talent", "wmf-ombre"]),
    JSON.stringify(pose.champs),
  );

  //  ── CHAQUE VALEUR A SA ZONE, VIDE COMPRISE ─────────────────────
  //
  //  C'est la propriété dont tout le reste dépend : une valeur sans
  //  zone est une valeur qu'on ne peut pas écrire, et la fiche neuve
  //  en est pleine.
  const zones = await q.evaluate(() => {
    const vues = [...document.querySelectorAll("[data-wmf-zone]")];
    return {
      clefs: vues.map((z) => z.dataset.wmfZone),
      //  ET CHACUNE DIT CE QU'ON Y MET, sinon une fiche neuve serait
      //  une suite d'étiquettes suivies de rien.
      sansInvite: vues.filter((z) => (z.dataset.wmfVide ?? "") === "")
        .map((z) => z.dataset.wmfZone),
      modifiables: vues.filter((z) => z.getAttribute("contenteditable") === "plaintext-only")
        .length,
    };
  });
  const attendues = [
    "nom",
    "tw",
    "avatar",
    "surnom",
    "metier",
    "traits",
    "histoire",
    "s-surnom",
    "s-rencontre",
    "ancienne",
    "o-avis",
    "j-pseudo",
    "j-credits",
  ];
  dire(
    "CHAQUE VALEUR A SA ZONE, MÊME VIDE",
    attendues.every((c) => zones.clefs.includes(c)),
    JSON.stringify(attendues.filter((c) => !zones.clefs.includes(c))),
  );
  dire(
    "   et chaque zone dit ce qu'on y met",
    zones.sansInvite.length === 0,
    JSON.stringify(zones.sansInvite),
  );
  //  L'ESPÈCE ET LE TALENT NE SONT PAS DES ZONES : ils se choisissent.
  dire(
    "   l'espèce et le talent sont des menus, pas des zones",
    !zones.clefs.includes("s-espece") && !zones.clefs.includes("s-talent"),
    JSON.stringify(zones.clefs.filter((c) => c.startsWith("s-"))),
  );

  //  ── CE QU'ON TAPE PART DANS LE MESSAGE ─────────────────────────
  const ecrit = await q.evaluate(async () => {
    globalThis.wmTaper("nom", "Jak A. Fering");
    globalThis.wmTaper("metier", "Ranger");
    globalThis.wmTaper("histoire", "Il est né un <b>mardi</b>.");
    await globalThis.wmPause(220);
    return globalThis.wmMessage();
  });
  dire(
    "CE QU'ON TAPE S'ÉCRIT DANS LE MESSAGE",
    ecrit.includes("<wmf-nom>Jak A. Fering</wmf-nom>") &&
      ecrit.includes("<y>MÉTIER</y>") && ecrit.includes("Ranger"),
    JSON.stringify(ecrit.slice(0, 120)),
  );
  dire(
    "   et les balises du joueur traversent",
    ecrit.includes("Il est né un <b>mardi</b>."),
    "",
  );
  //  « Le nom du personnage en haut, en titre, collé à gauche. »
  dire(
    "   le nom est en titre, et rien n'est centré",
    ecrit.includes('<div class="wmf__titre">') && !/<center>/i.test(ecrit),
    "",
  );
  //  ── L'ÉCRAN MONTRE PLUS QUE LE MESSAGE, ET C'EST VOULU ─────────
  //
  //  La garde du dessin : l'éditeur affiche les trente zones, le
  //  message n'emporte que les trois qu'on a remplies. Si elle
  //  cassait, chaque fiche partirait avec « SURNOM : » suivi de rien,
  //  trente fois.
  dire(
    "   MAIS LE MESSAGE NE PORTE PAS CE QU'ON N'A PAS REMPLI",
    !ecrit.includes("<wmf-surnom>") && !ecrit.includes("<wmf-j-pseudo>") &&
      !ecrit.includes('class="wmf__ombre"'),
    JSON.stringify({
      surnom: ecrit.includes("<wmf-surnom>"),
      ombre: ecrit.includes('class="wmf__ombre"'),
    }),
  );

  //  ── LES DEUX IMAGES, ET LÀ OÙ ELLES SONT ALLÉES ───────────────
  //
  //  « Le mieux, mettre ça sous l'avatar, dans un encadré » pour le
  //  faceclaim ; « c'est une image carrée, mettre le lien et
  //  l'intégrer » pour la trainer card. Les deux ont quitté le bloc
  //  « derrière l'écran », et le risque de ce remaniement est qu'un
  //  champ déplacé soit un champ perdu.
  const images = await q.evaluate(async () => {
    const f = document.querySelector(".wmf-form__fiche");
    const place = {
      fcSousLAvatar: !!f.querySelector('.wmf__avatar .wmf__fc [data-wmf-zone="j-avatar"]'),
      tcardDansLePied: !!f.querySelector('.wmf__tcard [data-wmf-zone="j-tcard"]'),
      //  ET NULLE PART AILLEURS : un champ écrit deux fois serait relu
      //  deux fois, et la seconde écraserait la première.
      fcEnDouble: f.querySelectorAll('[data-wmf-zone="j-avatar"]').length,
      tcardEnDouble: f.querySelectorAll('[data-wmf-zone="j-tcard"]').length,
    };
    globalThis.wmTaper("j-avatar", "Alex Høgh Andersen");
    globalThis.wmTaper("j-tcard", "https://exemple.test/carte.png");
    await globalThis.wmPause(220);
    return {
      place,
      carree: document
        .querySelector(".wmf-form__fiche .wmf__tcard img")
        ?.getAttribute("src"),
      message: globalThis.wmMessage(),
    };
  });
  dire(
    "LE FACECLAIM EST SOUS L'AVATAR, LA TRAINER CARD DANS LE PIED",
    images.place.fcSousLAvatar === true && images.place.tcardDansLePied === true,
    JSON.stringify(images.place),
  );
  dire(
    "   et chacun n'est écrit qu'une fois",
    images.place.fcEnDouble === 1 && images.place.tcardEnDouble === 1,
    JSON.stringify({ fc: images.place.fcEnDouble, tcard: images.place.tcardEnDouble }),
  );
  dire(
    "   l'adresse collée devient l'image carrée",
    images.carree === "https://exemple.test/carte.png" &&
      images.message.includes(
        '<div class="wmf__cadre wmf__cadre--carre"><img src="https://exemple.test/carte.png"',
      ),
    JSON.stringify({ src: images.carree }),
  );

  //  ── LA BARRE DE BALISES ────────────────────────────────────────
  //
  //  « Permettre aussi de modifier l'histoire et la description du
  //  compagnon d'une vie comme un bloc d'édition pour mettre des
  //  balises si on en a envie » — et « oui » pour les moments.
  //
  //  ON SÉLECTIONNE VRAIMENT, et on clique vraiment : c'est tout
  //  l'objet. Poser les balises à la main dans la zone prouverait
  //  seulement que la chaîne se concatène.
  const balises = await q.evaluate(async () => {
    const ou = (clef) =>
      globalThis.wmZone(clef)?.previousElementSibling?.classList
        .contains("wmf-form__balises") === true;
    const avant = {
      histoire: ou("histoire"),
      rencontre: ou("s-rencontre"),
      //  ET NULLE PART AILLEURS : trente barres pour trente champs
      //  seraient trente barres de trop.
      metier: ou("metier"),
      nom: ou("nom"),
      combien: document.querySelectorAll(".wmf-form__balises").length,
    };
    //  on écrit, on sélectionne « mardi », on clique sur Gras.
    globalThis.wmTaper("histoire", "Il est né un mardi.");
    await globalThis.wmPause(200);
    const z = globalThis.wmZone("histoire");
    const noeud = z.firstChild;
    const texte = noeud.textContent;
    const debut = texte.indexOf("mardi");
    const r = document.createRange();
    r.setStart(noeud, debut);
    r.setEnd(noeud, debut + 5);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    [...document.querySelectorAll(".wmf-form__balise")]
      .find((b) =>
        b.getAttribute("aria-label") === "Gras" &&
        b.closest(".wmf-form__balises") === z.previousElementSibling
      )
      .click();
    await globalThis.wmPause(250);
    return { avant, zone: globalThis.wmTexte("histoire"), message: globalThis.wmMessage() };
  });
  dire(
    "LA BARRE DE BALISES EST SUR LES ZONES DE RÉCIT, ET SUR ELLES SEULES",
    balises.avant.histoire === true && balises.avant.rencontre === true &&
      balises.avant.metier === false && balises.avant.nom === false,
    JSON.stringify(balises.avant),
  );
  dire(
    "   et elle entoure VRAIMENT ce qui est sélectionné",
    balises.zone === "Il est né un <b>mardi</b>.",
    JSON.stringify(balises.zone),
  );
  dire(
    "   et ça part dans le message, en balise vivante",
    balises.message.includes("Il est né un <b>mardi</b>."),
    "",
  );

  //  ── LE CURSEUR NE SAUTE PAS À LA FRAPPE ────────────────────────
  //
  //  LA MESURE QUI PROTÈGE TOUT LE DESSIN. L'éditeur est du HTML
  //  redessiné depuis `publier` : le redessiner à chaque `input`
  //  remplacerait la zone sous le doigt, et le curseur repartirait au
  //  début à chaque caractère. On ne redessine donc que sur les trois
  //  commandes — et seulement elles.
  const curseur = await q.evaluate(async () => {
    const z = globalThis.wmZone("metier");
    z.dataset.wmTemoin = "ici";
    z.focus();
    globalThis.wmTaper("metier", "Rangeuse");
    await globalThis.wmPause(220);
    const apres = globalThis.wmZone("metier");
    return {
      memeNoeud: apres?.dataset.wmTemoin === "ici",
      garde: document.activeElement === apres,
    };
  });
  dire(
    "LE CURSEUR NE SAUTE PAS : LA ZONE N'EST PAS REMPLACÉE À LA FRAPPE",
    curseur.memeNoeud === true && curseur.garde === true,
    JSON.stringify(curseur),
  );

  //  ── L'AVATAR : L'IMAGE SUIT L'ADRESSE, SANS REDESSIN ───────────
  const image = await q.evaluate(async () => {
    const z = globalThis.wmZone("avatar");
    z.dataset.wmTemoin = "ici";
    globalThis.wmTaper("avatar", "https://exemple.test/a.png");
    await globalThis.wmPause(200);
    return {
      src: document.querySelector(".wmf-form__fiche .wmf__avatar img")?.getAttribute("src"),
      memeNoeud: globalThis.wmZone("avatar")?.dataset.wmTemoin === "ici",
    };
  });
  dire(
    "L'IMAGE SUIT L'ADRESSE, et la zone n'est pas redessinée pour autant",
    image.src === "https://exemple.test/a.png" && image.memeNoeud === true,
    JSON.stringify(image),
  );

  //  ── CE QU'ON ÉCRIT AVANT DE CHOISIR L'ESPÈCE N'EST PAS PERDU ───
  //
  //  Sans espèce, la carte du Pokémon fait partie du gabarit — « la
  //  fiche doit quand même garder son gabarit », 24 novembre — mais
  //  elle ne porte PAS de numéro d'espèce, et c'est ce numéro qui dit
  //  à `lireUneFiche` qu'il y a un starter à relire. Le surnom et la
  //  rencontre déjà tapés partent avec elle et restent à l'écran.
  const avantLEspece = await q.evaluate(async () => {
    globalThis.wmTaper("s-rencontre", "Dans une grange, un soir de pluie.");
    globalThis.wmTaper("s-surnom", "Noisette");
    await globalThis.wmPause(200);
    const m = globalThis.wmMessage();
    return {
      carte: m.includes('class="wmf__starter"'),
      sansEspece: /<wmf-s-id>0?<\/wmf-s-id>/.test(m),
      sansSprite: !m.includes("wmf__sprite"),
      aLEcran: globalThis.wmTexte("s-rencontre"),
    };
  });
  dire(
    "SANS ESPÈCE, LA CARTE RESTE MAIS LE STARTER N'EXISTE PAS",
    avantLEspece.carte === true && avantLEspece.sansEspece === true &&
      avantLEspece.sansSprite === true,
    JSON.stringify(avantLEspece),
  );
  dire(
    "   mais ce qu'on a écrit reste à l'écran",
    avantLEspece.aLEcran === "Dans une grange, un soir de pluie.",
    JSON.stringify(avantLEspece.aLEcran),
  );

  //  ── LA LISTE DES ESPÈCES ARRIVE, ET LES TALENTS SUIVENT ────────
  const starter = await q.evaluate(async () => {
    const menu = document.getElementById("wmf-espece");
    const options = [...menu.options].map((o) => o.textContent);
    const place = !!document.querySelector(".wmf__pokemon #wmf-espece") &&
      !!document.querySelector(".wmf__pokemon #wmf-talent");
    menu.value = "172";
    menu.dispatchEvent(new Event("change", { bubbles: true }));
    await globalThis.wmPause(200);
    return {
      options,
      place,
      talents: [...document.getElementById("wmf-talent").options].map((o) => o.textContent),
      message: globalThis.wmMessage(),
    };
  });
  //  ── ET LE POKÉMON CHOISI S'AFFICHE ────────────────────────────
  //
  //  « Affiche le pokémon qui est sélectionné. » L'image doit suivre
  //  le menu SANS redessin — changer d'espèce ne change qu'une image,
  //  et refaire la fiche ferait sauter le curseur de qui écrivait à
  //  côté.
  const sprite = await q.evaluate(() => {
    const img = document.querySelector(".wmf-form__fiche .wmf__pokemon img");
    return {
      src: img?.getAttribute("src") ?? null,
      //  DANS LA CARTE, et pas ailleurs dans la fiche.
      dansLaCarte: img?.closest(".wmf__pokemon") !== null,
      //  ET HABILLÉE. L'image qui apparaît au choix de l'espèce est
      //  posée par le code, pas par `publier` : sans sa classe, le
      //  CSS ne l'atteint pas et elle sort à sa taille d'origine.
      classe: img?.className ?? "",
      large: Math.round(img?.getBoundingClientRect().width ?? 0),
      message: globalThis.wmMessage(),
    };
  });
  dire(
    "LE POKÉMON CHOISI S'AFFICHE DANS SA CARTE",
    sprite.src?.endsWith("/ultra-sun-ultra-moon/172.gif") === true &&
      sprite.dansLaCarte === true,
    JSON.stringify({ src: sprite.src }),
  );
  dire(
    "   ET ELLE EST HABILLÉE — sinon elle sort à sa taille d'origine",
    sprite.classe === "wmf__sprite" && sprite.large === 96,
    JSON.stringify({ classe: sprite.classe, large: sprite.large }),
  );
  dire(
    "   et son adresse part dans le message",
    sprite.message.includes('<img class="wmf__sprite" src=') &&
      sprite.message.includes("/ultra-sun-ultra-moon/172.gif"),
    "",
  );

  dire(
    "LES ESPÈCES SONT DANS LE MENU, et le menu est dans la carte du Pokémon",
    starter.options.includes("Pichu") && starter.options.includes("Évoli") &&
      starter.place === true,
    JSON.stringify({ place: starter.place, n: starter.options.length }),
  );
  //  « Il peut choisir le talent » — et le talent caché est dit, pas
  //  retiré : c'est au staff de trancher.
  dire(
    "   les talents suivent l'espèce, et le talent caché est marqué",
    JSON.stringify(starter.talents) ===
      JSON.stringify(["Statik", "Paratonnerre (talent caché)"]),
    JSON.stringify(starter.talents),
  );
  dire(
    "   et l'espèce choisie entre dans le message, avec son numéro",
    starter.message.includes("<wmf-s-id>172</wmf-s-id>") &&
      starter.message.includes("Pichu"),
    "",
  );
  //  ET LE RÉCIT ÉCRIT AVANT LE CHOIX PART AVEC LUI.
  dire(
    "   et le récit écrit avant le choix part avec lui",
    starter.message.includes("Dans une grange, un soir de pluie.") &&
      starter.message.includes("Noisette"),
    "",
  );
  //  « Les niveaux ne sont pas choisis par les joueurs. »
  dire(
    "   LE NIVEAU N'EST DEMANDÉ NULLE PART",
    !/niveau/i.test(starter.message),
    "",
  );

  //  ── LE LIEN DEMANDE SON ADRESSE ───────────────────────────────
  //
  //  Le seul bouton qui n'insère pas tout de suite. On vérifie les
  //  deux moitiés : que le champ s'ouvre, et que la SÉLECTION D'AVANT
  //  survit au passage dans ce champ — c'est elle qui décide quel
  //  texte devient cliquable, et taper dedans l'efface.
  const lien = await q.evaluate(async () => {
    const z = globalThis.wmZone("histoire");
    const barre = z.previousElementSibling;
    globalThis.wmTaper("histoire", "Il écrit sur Bazzart tous les jours.");
    await globalThis.wmPause(200);
    const noeud = globalThis.wmZone("histoire").firstChild;
    const debut = noeud.textContent.indexOf("Bazzart");
    const r = document.createRange();
    r.setStart(noeud, debut);
    r.setEnd(noeud, debut + 7);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    [...barre.querySelectorAll(".wmf-form__balise")]
      .find((b) => b.getAttribute("aria-label") === "Insérer un lien")
      .click();
    await globalThis.wmPause(200);
    const boite = barre.nextElementSibling;
    const ouvert = boite?.classList.contains("wmf-form__lien") === true;
    const champ = boite.querySelector("input");
    //  SANS PROTOCOLE, comme on colle neuf fois sur dix.
    champ.value = "bazzart.net";
    champ.focus();
    [...boite.querySelectorAll("button")]
      .find((b) => b.textContent === "Poser le lien")
      .click();
    await globalThis.wmPause(250);
    return {
      ouvert,
      refermee: barre.nextElementSibling?.classList.contains("wmf-form__lien") !== true,
      zone: globalThis.wmTexte("histoire"),
      message: globalThis.wmMessage(),
    };
  });
  dire(
    "LE BOUTON « LIEN » DEMANDE L'ADRESSE AVANT D'INSÉRER",
    lien.ouvert === true && lien.refermee === true,
    JSON.stringify({ ouvert: lien.ouvert, referme: lien.refermee }),
  );
  dire(
    "   ET LA SÉLECTION SURVIT AU PASSAGE DANS LE CHAMP",
    lien.zone === 'Il écrit sur <a href="https://bazzart.net">Bazzart</a> tous les jours.',
    JSON.stringify(lien.zone),
  );
  dire(
    "   et le lien part dans le message",
    lien.message.includes('<a href="https://bazzart.net">Bazzart</a>'),
    "",
  );

  //  CE QU'IL Y A DANS LE PAVÉ AVANT DE BASCULER. On le relève
  //  plutôt que de l'écrire dans l'attente : la mesure cesse ainsi de
  //  dépendre de tout ce qui a été tapé plus haut.
  const avantLaChrono = await q.evaluate(() => globalThis.wmTexte("histoire"));

  //  ── LA CHRONOLOGIE ─────────────────────────────────────────────
  const chrono = await q.evaluate(async () => {
    const vers = (mot) =>
      [...document.querySelectorAll(".wmf-form__forme")].find((b) =>
        b.textContent.includes(mot)
      );
    vers("Chronologie").click();
    await globalThis.wmPause(200);
    //  UNE CHRONOLOGIE VIDE OFFRE DÉJÀ UN MOMENT : sans lui, choisir
    //  la chronologie n'afficherait rien, et il faudrait deviner
    //  qu'un bouton attend quelque part.
    const dEmblee = document.querySelectorAll(".wmf-form__fiche .wmf__moment").length;
    globalThis.wmTaper("m-date", "2015");
    globalThis.wmTaper("m-texte", "Le départ.");
    await globalThis.wmPause(200);
    document.querySelector(".wmf-form__plus").click();
    await globalThis.wmPause(200);
    return {
      dEmblee,
      moments: document.querySelectorAll(".wmf-form__fiche .wmf__moment").length,
      message: globalThis.wmMessage(),
    };
  });
  //  ── ET CHAQUE MOMENT A SA BARRE ────────────────────────────────
  //
  //  « Oui » — 23 novembre, à la question de savoir si la barre va
  //  aussi sur les moments. Ils sont redessinés à chaque ajout et à
  //  chaque retrait, donc la barre doit se reposer avec eux : c'est
  //  exactement le genre de chose qui marche une fois et plus jamais.
  const barresDesMoments = await q.evaluate(async () => {
    const z = globalThis.wmZone("m-texte");
    //  LA BARRE D'UN MOMENT EST EN TÊTE DU MOMENT depuis le 24
    //  novembre, pour que la date tombe en face du texte et pas en
    //  face des outils. Elle n'est donc plus la voisine de la zone.
    const barre = z?.closest(".wmf__moment")?.querySelector(".wmf-form__balises");
    const noeud = z.firstChild;
    const texte = noeud.textContent;
    const debut = texte.indexOf("départ");
    const r = document.createRange();
    r.setStart(noeud, debut);
    r.setEnd(noeud, debut + 6);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    [...barre.querySelectorAll(".wmf-form__balise")]
      .find((b) => b.getAttribute("aria-label") === "Italique")
      .click();
    await globalThis.wmPause(250);
    return {
      barres: document.querySelectorAll(".wmf__moment .wmf-form__balises").length,
      moments: document.querySelectorAll(".wmf-form__fiche .wmf__moment").length,
      zone: globalThis.wmTexte("m-texte"),
    };
  });
  dire(
    "   CHAQUE MOMENT A SA BARRE, ET ELLE REVIENT APRÈS UN REDESSIN",
    barresDesMoments.barres === barresDesMoments.moments && barresDesMoments.barres === 2,
    JSON.stringify(barresDesMoments),
  );
  dire(
    "   et elle entoure la sélection du bon moment",
    barresDesMoments.zone === "Le <i>départ</i>.",
    JSON.stringify(barresDesMoments.zone),
  );

  dire(
    "LA CHRONOLOGIE OFFRE UN MOMENT D'EMBLÉE",
    chrono.dEmblee === 1,
    String(chrono.dEmblee),
  );
  dire(
    "   on y écrit, et ça entre dans le message",
    chrono.message.includes('data-mode="chronologie"') &&
      chrono.message.includes("<wmf-m-date>2015</wmf-m-date>") &&
      chrono.message.includes("<wmf-m-texte>Le départ.</wmf-m-texte>"),
    JSON.stringify(chrono.message.slice(0, 80)),
  );
  dire(
    "   et le bouton en ajoute un second",
    chrono.moments === 2,
    String(chrono.moments),
  );

  //  ── LA CROIX RETIRE UN MOMENT ──────────────────────────────────
  const oté = await q.evaluate(async () => {
    document.querySelectorAll(".wmf-form__croix")[1].click();
    await globalThis.wmPause(200);
    return {
      moments: document.querySelectorAll(".wmf-form__fiche .wmf__moment").length,
      //  ET C'EST BIEN LE SECOND QUI PART, pas le premier.
      garde: globalThis.wmTexte("m-date"),
    };
  });
  dire(
    "   la croix retire SON moment, et pas un autre",
    oté.moments === 1 && oté.garde === "2015",
    JSON.stringify(oté),
  );

  //  CHANGER DE FORME NE PERD PAS LE PAVÉ tant qu'on n'a pas quitté la
  //  page : on peut se raviser.
  const retour = await q.evaluate(async () => {
    const vers = (mot) =>
      [...document.querySelectorAll(".wmf-form__forme")].find((b) =>
        b.textContent.includes(mot)
      );
    vers("Bloc").click();
    await globalThis.wmPause(220);
    return {
      pave: globalThis.wmTexte("histoire"),
      //  ET LA FORME CHOISIE SE VOIT SUR LE BOUTON.
      marque: vers("Bloc").getAttribute("aria-pressed"),
    };
  });
  dire(
    "SE RAVISER NE PERD PAS LE PAVÉ QU'ON AVAIT ÉCRIT",
    retour.pave === avantLaChrono && retour.marque === "true",
    JSON.stringify({ attendu: avantLaChrono, rendu: retour.pave }),
  );

  //  ── LE GROUPE OMBRE ────────────────────────────────────────────
  //
  //  « On la garde, en option du formulaire. » Les cinq questions se
  //  LISENT sans la case : on décide en les ayant lues. Elles ne se
  //  tapent qu'une fois la case cochée, sinon on écrirait un texte qui
  //  ne part pas dans le message sans que rien ne le dise.
  const ombre = await q.evaluate(async () => {
    const bloc = () => document.querySelector(".wmf-form__fiche .wmf__ombre");
    const avant = {
      visible: !!bloc(),
      actif: bloc()?.dataset.wmActive,
      verrou: globalThis.wmZone("o-avis")?.getAttribute("contenteditable"),
    };
    const case_ = document.getElementById("wmf-ombre");
    case_.checked = true;
    case_.dispatchEvent(new Event("change", { bubbles: true }));
    await globalThis.wmPause(220);
    globalThis.wmTaper("o-avis", "Elle me fait peur.");
    await globalThis.wmPause(200);
    const coche = {
      verrou: globalThis.wmZone("o-avis")?.getAttribute("contenteditable"),
      message: globalThis.wmMessage(),
    };
    const encore = document.getElementById("wmf-ombre");
    encore.checked = false;
    encore.dispatchEvent(new Event("change", { bubbles: true }));
    await globalThis.wmPause(220);
    const decoche = {
      aLEcran: globalThis.wmTexte("o-avis"),
      message: globalThis.wmMessage(),
    };
    const derechef = document.getElementById("wmf-ombre");
    derechef.checked = true;
    derechef.dispatchEvent(new Event("change", { bubbles: true }));
    await globalThis.wmPause(220);
    return { avant, coche, decoche, revenu: globalThis.wmMessage() };
  });
  dire(
    "LE GROUPE OMBRE SE LIT SANS LA CASE, ET NE S'ÉCRIT QU'AVEC",
    ombre.avant.visible === true && ombre.avant.actif === "non" &&
      ombre.avant.verrou === "false" && ombre.coche.verrou === "plaintext-only",
    JSON.stringify({ avant: ombre.avant, coche: ombre.coche.verrou }),
  );
  dire(
    "   cochée, le bloc entre dans le message",
    ombre.coche.message.includes('class="wmf__ombre"') &&
      ombre.coche.message.includes("Elle me fait peur."),
    "",
  );
  dire(
    "   DÉCOCHÉE, LE BLOC SORT DU MESSAGE MAIS LA RÉPONSE RESTE À L'ÉCRAN",
    !ombre.decoche.message.includes('class="wmf__ombre"') &&
      ombre.decoche.aLEcran === "Elle me fait peur.",
    JSON.stringify({
      message: ombre.decoche.message.includes('class="wmf__ombre"'),
      ecran: ombre.decoche.aLEcran,
    }),
  );
  dire(
    "   et la recocher la remet dans le message",
    ombre.revenu.includes("Elle me fait peur."),
    "",
  );

  //  ── LE HTML DU JOUEUR NE S'ANALYSE PAS DANS L'ÉDITEUR ─────────
  //
  //  L'éditeur rend la fiche, donc il rendrait aussi le HTML du
  //  joueur. DEUX RAISONS DE NE PAS LE FAIRE, et la première est la
  //  plus importante :
  //
  //   · ANALYSÉ, IL EST PERDU. Son `<b>mardi</b>` deviendrait un vrai
  //     élément, et relire la zone rendrait « mardi » tout court. La
  //     frappe suivante réécrirait le message appauvri, sans que rien
  //     ne le dise.
  //
  //   · ET UN `<script>` RECOPIÉ D'UN GÉNÉRATEUR DE BANNIÈRES
  //     casserait sa page de réponse au milieu de la rédaction.
  const propre = await q.evaluate(async () => {
    globalThis.__wmTouche = false;
    const colle = "<script>globalThis.__wmTouche = true;<\/script>" +
      '<img src="x" onerror="globalThis.__wmTouche = true">' +
      '<b>gras</b> & "guillemets" <wmf-nom>forgé</wmf-nom>';
    globalThis.wmTaper("histoire", colle);
    await globalThis.wmPause(300);
    //  ON REDESSINE, parce que c'est là que le danger serait : la
    //  frappe laisse le texte dans sa zone, le redessin le fait
    //  repasser par `publier`.
    const vers = (mot) =>
      [...document.querySelectorAll(".wmf-form__forme")].find((b) =>
        b.textContent.includes(mot)
      );
    vers("Chronologie").click();
    await globalThis.wmPause(200);
    vers("Bloc").click();
    await globalThis.wmPause(300);
    const f = document.querySelector(".wmf-form__fiche");
    return {
      execute: globalThis.__wmTouche,
      script: f.querySelectorAll("script").length,
      gras: f.querySelectorAll(".wmf__histoire b").length,
      image: f.querySelectorAll(".wmf__histoire img").length,
      //  LA BALISE FORGÉE N'EN DEVIENT PAS UNE : sinon un joueur
      //  pourrait écrire `<wmf-nom>` dans son histoire et déplacer son
      //  propre nom.
      forgee: f.querySelectorAll(".wmf__histoire wmf-nom").length,
      //  ET LA ZONE REND EXACTEMENT CE QU'IL A TAPÉ.
      relu: globalThis.wmTexte("histoire"),
      attendu: colle,
      //  LE MESSAGE, LUI, PART AVEC SES BALISES VIVANTES.
      message: globalThis.wmMessage(),
    };
  });
  dire(
    "LE HTML DU JOUEUR RESTE DU TEXTE DANS L'ÉDITEUR",
    propre.execute === false && propre.script === 0 && propre.gras === 0 &&
      propre.image === 0 && propre.forgee === 0,
    JSON.stringify({
      execute: propre.execute,
      script: propre.script,
      gras: propre.gras,
      forgee: propre.forgee,
    }),
  );
  //  LA MESURE QUI COMPTE : L'ALLER-RETOUR NE PERD RIEN.
  dire(
    "   ET LA ZONE REND EXACTEMENT CE QU'IL A TAPÉ, APRÈS REDESSIN",
    propre.relu === propre.attendu,
    JSON.stringify({ relu: propre.relu }),
  );
  dire(
    "   et le message part avec ses balises vivantes",
    propre.message.includes("<b>gras</b>") &&
      propre.message.includes("<script>"),
    JSON.stringify(propre.message.includes("<b>gras</b>")),
  );
  await q.close();
}

{
  //  ── CE QU'IL NE FAUT SURTOUT PAS ÉCRASER ───────────────────────
  //
  //  Une fiche de la V1, ou n'importe quel message écrit à la main.
  //  L'éditeur réécrit le message ENTIER : s'il se posait ici, il
  //  effacerait le travail de quelqu'un.
  //
  //  IL Y AVAIT UN BANDEAU ET UN BOUTON « REPRENDRE ». Les boutons
  //  sont partis le 23 novembre, et les garder en silence aurait
  //  laissé une impasse : trente champs remplis, rien d'écrit, et
  //  plus rien à cliquer pour demander. On ne se pose donc plus du
  //  tout — le joueur garde son bloc d'édition, comme partout
  //  ailleurs sur le forum.
  const q = await monterLaFiche(
    '<center><div class="bk1"><div class="bkt2">Prénom P. Nom</div>son ancienne fiche</div></center>',
  );
  const vu = await q.evaluate(() => ({
    pose: document.getElementById("wm-fiche") !== null,
    editeurVisible: document.getElementById("postingbox").hidden === false,
    message: document.querySelector("#text_editor_textarea").value,
  }));
  dire(
    "SUR UN MESSAGE QU'ON NE RECONNAÎT PAS, L'ÉDITEUR NE SE POSE PAS",
    vu.pose === false && vu.editeurVisible === true,
    JSON.stringify({ pose: vu.pose, editeur: vu.editeurVisible }),
  );
  dire(
    "   et le message reste intact, à sa place",
    vu.message.includes("son ancienne fiche"),
    "",
  );
  await q.close();
}

{
  //  ── ROUVRIR SA FICHE LA RETROUVE ───────────────────────────────
  //
  //  « Quand on édite son message, ce serait super que ça reste comme
  //  ça. » C'est la demande, mesurée de bout en bout : une fiche
  //  publiée est remise dans l'éditeur, et elle doit s'y présenter
  //  remplie — dans sa mise en page, et non dans des champs.
  const { ficheVide, publier } = await import("../src/navigateur/fiche.ts");
  const deja = publier({
    ...ficheVide(),
    nom: "Erin Kavanagh",
    identite: { ...ficheVide().identite, metier: "Infirmière", surnom: "Rin" },
    histoire: {
      mode: "chronologie",
      moments: [{ date: "2012", texte: "L'incendie.", image: "", credit: "" }],
    },
    starter: {
      especeId: 133,
      espece: "Évoli",
      surnom: "Noisette",
      talent: "Échauffement",
      rencontre: "Dans une grange.",
    },
    joueur: { ...ficheVide().joueur, "j-pseudo": "Callista" },
  });
  const q = await monterLaFiche(deja);
  await q.evaluate(OUTILS);
  const relu = await q.evaluate(() => ({
    nom: globalThis.wmTexte("nom"),
    metier: globalThis.wmTexte("metier"),
    surnom: globalThis.wmTexte("surnom"),
    pseudo: globalThis.wmTexte("j-pseudo"),
    forme: [...document.querySelectorAll(".wmf-form__forme")]
      .find((b) => b.getAttribute("aria-pressed") === "true")?.textContent,
    moments: [...document.querySelectorAll(".wmf-form__fiche .wmf__moment")].map((m) => [
      m.querySelector('[data-wmf-zone="m-date"]')?.innerText,
      m.querySelector('[data-wmf-zone="m-texte"]')?.innerText,
    ]),
    rencontre: globalThis.wmTexte("s-rencontre"),
    surnomDuPoke: globalThis.wmTexte("s-surnom"),
    dit: document.querySelector(".wmf-form__dit").textContent,
  }));
  dire(
    "ROUVRIR SA FICHE LA RETROUVE REMPLIE, À SA PLACE",
    relu.nom === "Erin Kavanagh" && relu.metier === "Infirmière" &&
      relu.surnom === "Rin" && relu.pseudo === "Callista",
    JSON.stringify(relu),
  );
  dire(
    "   la chronologie revient en chronologie, avec ses moments",
    (relu.forme ?? "").includes("Chronologie") &&
      JSON.stringify(relu.moments) === JSON.stringify([["2012", "L'incendie."]]),
    JSON.stringify({ forme: relu.forme, moments: relu.moments }),
  );
  dire(
    "   et le starter revient aussi",
    relu.surnomDuPoke === "Noisette" && relu.rencontre === "Dans une grange.",
    JSON.stringify({ surnom: relu.surnomDuPoke }),
  );
  //  ET SA PROPRE FICHE N'EST PAS « UN MESSAGE QU'ON NE RECONNAÎT PAS ».
  dire(
    "   et rien ne l'avertit : c'est bien SA fiche",
    (relu.dit ?? "") === "",
    JSON.stringify(relu.dit),
  );
  //  LE TALENT REVIENT APRÈS LE CATALOGUE, et c'est un piège réel : le
  //  menu est vide à la pose, rempli une requête plus tard.
  const talent = await q.evaluate(() => document.getElementById("wmf-talent").value);
  dire(
    "   et le talent revient, bien que son menu soit arrivé après",
    talent === "Échauffement",
    JSON.stringify(talent),
  );
  //  ── ET LA ROUVRIR SANS RIEN TOUCHER NE CHANGE PAS LE MESSAGE ───
  //
  //  La garde la plus silencieuse du lot : si le rendu de l'écran
  //  fuyait dans le message — les trente zones vides avec — une
  //  simple relecture de sa fiche la gonflerait d'étiquettes creuses.
  const inchange = await q.evaluate(async () => {
    const avant = globalThis.wmMessage();
    globalThis.wmTaper("metier", "Infirmière");
    await globalThis.wmPause(250);
    return { avant, apres: globalThis.wmMessage() };
  });
  //  LA SEULE DIFFÉRENCE ADMISE EST LE SPRITE. La fiche du décor a été
  //  publiée sans racine, donc sans image ; l'éditeur, lui, en écrit
  //  une. Tout le reste doit être identique au caractère près — et
  //  surtout, aucun champ vide ne doit apparaître.
  const sansSprite = (s) => s.replace(/<img class="wmf__sprite"[^>]*>/g, "");
  dire(
    "   et retaper la même valeur ne gonfle pas le message",
    sansSprite(inchange.avant) === sansSprite(inchange.apres) &&
      !inchange.apres.includes("<wmf-j-age>"),
    JSON.stringify({
      egal: sansSprite(inchange.avant) === sansSprite(inchange.apres),
      creux: inchange.apres.includes("<wmf-j-age>"),
    }),
  );
  dire(
    "   et la seule chose qu'elle gagne, c'est le sprite de son starter",
    !inchange.avant.includes("wmf__sprite") && inchange.apres.includes("wmf__sprite"),
    "",
  );
  await q.close();
}

{
  //  ── « ÇA REMPLACE TOUT » ─────────────────────────────────────────
  //
  //  « Pas besoin d'avoir ce qui est écrit en dessous, le bloc
  //  d'édition, ça remplace tout. » — 23 novembre.
  const q = await monterLaFiche("");
  await q.evaluate(OUTILS);
  const vu = await q.evaluate(() => ({
    editeurMasque: document.getElementById("postingbox").hidden,
    //  LE BOUTON D'ENVOI SURVIT : il vit dans un AUTRE panneau que le
    //  bloc d'édition. Si masquer l'un emportait l'autre, personne ne
    //  pourrait plus poster.
    envoiVisible: !!document.querySelector('input[name="post"]')?.offsetParent,
    //  ET LE TITRE DU SUJET EST REPRIS, puisque son champ natif était
    //  dans le bloc masqué.
    champTitre: !!document.getElementById("wmf-titre"),
    sujetNatif: !!document.querySelector('input[name="subject"]'),
  }));
  dire(
    "LE BLOC D'ÉDITION EST MASQUÉ, ET L'ENVOI RESTE",
    vu.editeurMasque === true && vu.envoiVisible === true,
    JSON.stringify(vu),
  );
  dire(
    "   le titre du sujet est repris dans l'éditeur",
    vu.champTitre === true && vu.sujetNatif === true,
    JSON.stringify({ champ: vu.champTitre }),
  );

  //  ── UN SUJET DÉJÀ ÉCRIT NE SE FAIT PAS ÉCRASER ──────────────────
  //
  //  Le décor pré-remplit le champ « Sujet », comme le fait une
  //  ÉDITION : le sujet existe déjà, et il porte peut-être un titre
  //  que personne ne veut voir remplacé par le nom du personnage.
  const garde = await q.evaluate(async () => {
    globalThis.wmTaper("nom", "Quelqu'un d'autre");
    await globalThis.wmPause(200);
    return document.querySelector('input[name="subject"]').value;
  });
  dire(
    "UN SUJET DÉJÀ ÉCRIT NE SE FAIT PAS ÉCRASER PAR LE NOM",
    garde === "Un sujet de test",
    JSON.stringify(garde),
  );

  //  ── UNE RETOUCHE À LA MAIN ARRÊTE L'ÉDITEUR, ET REND LE BLOC ───
  //
  //  C'EST CE QUI REMPLACE LES DEUX BOUTONS. S'arrêter en gardant le
  //  message caché laisserait le joueur devant un formulaire qui
  //  n'écrit plus et un texte qu'il ne peut plus voir : l'arrêt rend
  //  donc le bloc d'édition de lui-même.
  const retouche = await q.evaluate(async () => {
    globalThis.wmTaper("nom", "Jak");
    await globalThis.wmPause(220);
    //  quelqu'un écrit dans le message, par-dessus la fiche.
    const champ = document.querySelector("#text_editor_textarea");
    champ.value =
      '<div class="wmf"><div class="wmf__titre"><wmf-nom>À la main</wmf-nom></div></div>';
    globalThis.wmTaper("nom", "Jak A. Fering");
    await globalThis.wmPause(250);
    return {
      arrete: document.getElementById("wm-fiche").dataset.wmArrete === "oui",
      editeurRendu: document.getElementById("postingbox").hidden === false,
      message: champ.value,
      dit: document.querySelector(".wmf-form__dit").textContent,
    };
  });
  dire(
    "UNE RETOUCHE À LA MAIN ARRÊTE L'ÉDITEUR ET REND LE BLOC",
    retouche.arrete === true && retouche.editeurRendu === true,
    JSON.stringify({ arrete: retouche.arrete, rendu: retouche.editeurRendu }),
  );
  dire(
    "   la retouche n'est pas écrasée, et l'éditeur le dit",
    retouche.message.includes("À la main") &&
      /il te le rend tel qu'il est/.test(retouche.dit ?? ""),
    JSON.stringify(retouche.dit?.slice(0, 70)),
  );

  //  ── ET PLUS AUCUN BOUTON DANS L'EN-TÊTE ────────────────────────
  const sansBoutons = await q.evaluate(() => {
    const tete = document.querySelector(".wmf-form__tete");
    return {
      boutons: tete.querySelectorAll("button").length,
      brut: document.querySelector(".wmf-form__brut") !== null,
      reprendre: document.querySelector(".wmf-form__reprendre") !== null,
    };
  });
  dire(
    "   et l'en-tête ne porte plus aucun bouton",
    sansBoutons.boutons === 0 && sansBoutons.brut === false &&
      sansBoutons.reprendre === false,
    JSON.stringify(sansBoutons),
  );
  await q.close();
}

{
  //  ── SUR UN SUJET NEUF, LE TITRE SUIT LE NOM ─────────────────────
  //
  //  C'est le cas réel d'une création : `/post?f=7&mode=newtopic` sert
  //  un champ « Sujet » VIDE.
  const q = await monterLaFiche("", { sujetVide: true });
  await q.evaluate(OUTILS);
  const titres = await q.evaluate(async () => {
    globalThis.wmTaper("nom", "Jak A. Fering");
    await globalThis.wmPause(200);
    const suivi = {
      editeur: document.getElementById("wmf-titre").value,
      natif: document.querySelector('input[name="subject"]').value,
    };
    const champ = document.getElementById("wmf-titre");
    champ.value = "Un titre à moi";
    champ.dispatchEvent(new Event("input", { bubbles: true }));
    globalThis.wmTaper("nom", "Autre nom");
    await globalThis.wmPause(200);
    return {
      suivi,
      apres: {
        editeur: document.getElementById("wmf-titre").value,
        natif: document.querySelector('input[name="subject"]').value,
      },
    };
  });
  dire(
    "LE TITRE SE REMPLIT DU NOM DU PERSONNAGE",
    titres.suivi.editeur === "Jak A. Fering" && titres.suivi.natif === "Jak A. Fering",
    JSON.stringify(titres.suivi),
  );
  dire(
    "   et dès qu'on l'écrit soi-même, il cesse de suivre",
    titres.apres.editeur === "Un titre à moi" && titres.apres.natif === "Un titre à moi",
    JSON.stringify(titres.apres),
  );
  await q.close();
}

{
  //  ── PRÉVISUALISER, PUIS MODIFIER : ÇA RESTE LE FORMULAIRE ──────
  //
  //  « Quand je fais prévisualiser, ou si je publie et que je
  //  modifie, ça doit rester le formulaire. » — 23 novembre.
  //
  //  Ces deux pages ne disent pas dans quel forum on est : l'édition
  //  s'ouvre sur `/post?p=…&mode=editpost`, la prévisualisation
  //  re-poste sur `/post`, et il n'y a de fil d'Ariane ni sur l'une
  //  ni sur l'autre. Le décor le reproduit avec `sansForum`.
  const { ficheVide, publier } = await import("../src/navigateur/fiche.ts");
  const deja = publier({
    ...ficheVide(),
    nom: "Erin Kavanagh",
    identite: { ...ficheVide().identite, metier: "Infirmière" },
    joueur: { ...ficheVide().joueur, "j-pseudo": "Callista" },
  });

  const q = await monterLaFiche(deja, { sansForum: true });
  await q.evaluate(OUTILS);
  const vu = await q.evaluate(() => ({
    pose: document.getElementById("wm-fiche") !== null,
    editeurMasque: document.getElementById("postingbox").hidden,
    nom: globalThis.wmTexte("nom"),
    metier: globalThis.wmTexte("metier"),
    //  ET SANS AVERTISSEMENT : c'est bien SA fiche, pas un message
    //  qu'on ne reconnaît pas.
    dit: document.querySelector(".wmf-form__dit")?.textContent ?? null,
  }));
  dire(
    "SANS NUMÉRO DE FORUM, UNE FICHE RESTE UNE FICHE",
    vu.pose === true && vu.editeurMasque === true,
    JSON.stringify({ pose: vu.pose, masque: vu.editeurMasque }),
  );
  dire(
    "   et elle revient remplie, sans avertissement",
    vu.nom === "Erin Kavanagh" && vu.metier === "Infirmière" && vu.dit === "",
    JSON.stringify({ nom: vu.nom, dit: vu.dit }),
  );
  await q.close();

  //  ── MAIS UNE FICHE CITÉE N'EN EST PAS UNE ──────────────────────
  //
  //  LE CAS QU'IL NE FAUT SURTOUT PAS ATTRAPER. Quelqu'un répond à une
  //  présentation en citant son auteur : son message porte nos
  //  balises, dans un forum qui n'est pas celui des présentations. Si
  //  le formulaire se posait, la première frappe remplacerait sa
  //  réponse par une fiche.
  const r = await monterLaFiche(
    `<blockquote><div>Erin a écrit :</div>${deja}</blockquote><br />Bienvenue à toi !`,
    { sansForum: true },
  );
  const cite = await r.evaluate(() => ({
    pose: document.getElementById("wm-fiche") !== null,
    editeurVisible: document.getElementById("postingbox").hidden === false,
    message: document.querySelector("#text_editor_textarea").value,
  }));
  dire(
    "UNE FICHE CITÉE NE DÉCLENCHE PAS LE FORMULAIRE",
    cite.pose === false && cite.editeurVisible === true &&
      cite.message.includes("Bienvenue à toi"),
    JSON.stringify({ pose: cite.pose, editeur: cite.editeurVisible }),
  );
  await r.close();
}

{
  //  ── LE SOUS-TITRE ET LES TW SONT DEUX CHOSES ───────────────────
  //
  //  « Avoir une section différente pour les triggers warnings et
  //  pour le sous-titre » — 24 novembre. Les deux zones existent, on
  //  peut écrire dans chacune, et ce qu'on tape dans l'une ne part
  //  pas dans l'autre.
  const q = await monterLaFiche("");
  await q.evaluate(OUTILS);
  const vu = await q.evaluate(async () => {
    globalThis.wmTaper("nom", "Erin Kavanagh");
    globalThis.wmTaper("soustitre", "elle court encore");
    globalThis.wmTaper("tw", "incendie, brûlures");
    await globalThis.wmPause(250);
    const m = globalThis.wmMessage();
    const tete = /<div class="wmf__tete">([\s\S]*?)<\/div>\s*<div class="wmf__tw"/.exec(m);
    return {
      sousTitre: /<wmf-soustitre>([\s\S]*?)<\/wmf-soustitre>/.exec(m)?.[1] ?? "",
      tw: /<wmf-tw>([\s\S]*?)<\/wmf-tw>/.exec(m)?.[1] ?? "",
      sousTitreDansLaTete: tete?.[1].includes("<wmf-soustitre>") ?? false,
      twHorsDeLaTete: !(tete?.[1].includes("<wmf-tw>") ?? true),
      etiquette: m.includes("<y>TRIGGER WARNINGS</y>"),
      //  LE CADRE, ET LE SEUL ENDROIT OÙ ON PEUT LE MESURER : à
      //  l'écran, avec la vraie feuille. « Mettre un contour, là ça
      //  fait vide. »
      cadre: getComputedStyle(document.querySelector(".wmf")).borderTopWidth,
    };
  });
  dire(
    "LE SOUS-TITRE ET LES TW SE TAPENT CHACUN DE SON CÔTÉ",
    vu.sousTitre === "elle court encore" && vu.tw === "incendie, brûlures" &&
      vu.sousTitreDansLaTete && vu.twHorsDeLaTete,
    JSON.stringify(vu),
  );
  dire(
    "   et les TW s'annoncent : un avertissement sans étiquette passe pour une citation",
    vu.etiquette,
    "",
  );
  dire(
    "   et la fiche porte un contour, pour ne plus flotter dans le message",
    vu.cadre !== "0px",
    JSON.stringify(vu.cadre),
  );
  await q.close();
}

{
  //  ── LE CRÉDIT EST DANS LE CADRE DE SON IMAGE ───────────────────
  //
  //  « En haut à droite, placer le champ pour indiquer le crédit. Sur
  //  la présentation finale : l'afficher comme un tag. » — 24
  //  novembre. Ce qui compte : le crédit est DANS le cadre de son
  //  image, donc on sait de quelle image il parle sans le dire, et
  //  l'adresse est sous la même image, sur une ligne qui défile.
  const q = await monterLaFiche("");
  await q.evaluate(OUTILS);
  const vu = await q.evaluate(async () => {
    globalThis.wmTaper("avatar", "https://exemple.test/portrait.png");
    globalThis.wmTaper("j-credit-avatar", "@quelquun");
    await globalThis.wmPause(250);
    const cadre = document.querySelector(".wmf__avatar .wmf__cadre");
    const m = globalThis.wmMessage();
    const zone = document.querySelector(".wmf__adresse [data-wmf-zone]");
    return {
      imageDansLeCadre: cadre?.querySelector("img")?.getAttribute("src") ?? null,
      tagDansLeCadre: cadre?.querySelector(".wmf__credit-tag wmf-j-credit-avatar") !== null,
      adresseDansLeCadre: cadre?.querySelector(".wmf__adresse") !== null,
      //  « Le mettre sur une ligne, laisse le champ en défilement
      //  horizontal si besoin. » On mesure le COMPORTEMENT : une
      //  adresse très longue doit déborder sur les côtés, pas
      //  descendre sur une deuxième ligne.
      hauteurLigne: zone === null ? null : Math.round(zone.getBoundingClientRect().height),
      defile: zone === null ? null : getComputedStyle(zone).overflowX,
      creditDansLeMessage: /<wmf-j-credit-avatar>@quelquun</.test(m),
      //  L'adresse part aussi : c'est elle qui retrouve l'image à la
      //  réouverture. Elle ne se voit simplement pas.
      adresseDansLeMessage: m.includes("https://exemple.test/portrait.png"),
      plusDeBlocDeCredits: !m.includes("wmf__credits"),
    };
  });
  dire(
    "LE CRÉDIT ET L'ADRESSE VIVENT DANS LE CADRE DE LEUR IMAGE",
    vu.imageDansLeCadre === "https://exemple.test/portrait.png" &&
      vu.tagDansLeCadre && vu.adresseDansLeCadre,
    JSON.stringify(vu),
  );
  //  LA MÊME ZONE, AVEC UNE ADRESSE QUI NE TIENT PAS. C'est le seul
  //  cas qui distingue « sur une ligne » d'un champ ordinaire.
  const longue = await q.evaluate(async () => {
    globalThis.wmTaper("avatar", "https://exemple.test/" + "x".repeat(300) + ".png");
    await globalThis.wmPause(200);
    const z = document.querySelector(".wmf__adresse [data-wmf-zone]");
    return {
      hauteur: Math.round(z.getBoundingClientRect().height),
      deborde: z.scrollWidth > z.clientWidth,
    };
  });
  dire(
    "   et une adresse trop longue défile au lieu de passer à la ligne",
    longue.deborde === true && longue.hauteur === vu.hauteurLigne,
    JSON.stringify({ ...longue, uneLigne: vu.hauteurLigne }),
  );
  dire(
    "   le crédit part dans le message, l'adresse aussi, et le bloc de crédits n'est plus",
    vu.creditDansLeMessage && vu.adresseDansLeMessage && vu.plusDeBlocDeCredits,
    JSON.stringify({
      credit: vu.creditDansLeMessage,
      adresse: vu.adresseDansLeMessage,
      sansBloc: vu.plusDeBlocDeCredits,
    }),
  );
  await q.close();
}

{
  //  ── UNE FICHE VIDE GARDE SON GABARIT, À L'ÉCRAN AUSSI ──────────
  //
  //  « Si je remplis rien, la fiche doit quand même garder son
  //  gabarit, avoir du texte par défaut. » Mesuré sur le message,
  //  avec la vraie feuille : ce sont les `::before` qui le rendent
  //  visible, et eux seuls disent si le texte arrive vraiment.
  const q = await monterLaFiche("");
  const vu = await q.evaluate(() => {
    //  LA PLACE EST TENUE PAR LE CADRE, pas par la colonne : les
    //  deux carrés de « derrière l'écran » venaient justement de ce
    //  qu'une règle dessinait encore sur la colonne.
    const zone = document.querySelector(".wmf__avatar .wmf__cadre:not(:has(img))");
    const avant = zone === null ? null : getComputedStyle(zone, "::before").height;
    return {
      placeDeLImage: avant,
      //  Le texte par défaut vit dans un attribut, donc il ne peut
      //  pas se retrouver dans le message comme une réponse.
      dansUnAttribut: document.querySelectorAll(".wmf [data-wmf-vide]").length > 0,
    };
  });
  dire(
    "LE CADRE DE L'AVATAR GARDE SA PLACE SANS IMAGE",
    vu.placeDeLImage !== null && vu.placeDeLImage !== "0px" &&
      vu.placeDeLImage !== "auto",
    JSON.stringify(vu.placeDeLImage),
  );
  await q.close();
}

{
  //  ── ENVOYER SANS RIEN TAPER ────────────────────────────────────
  //
  //  « Quand je poste la fiche, sans rien remplir, on perd les
  //  blocs » — 24 novembre. Le cas est réel et il n'était mesuré
  //  nulle part : toutes les mesures d'écriture tapent d'abord
  //  quelque chose, donc elles passaient par `ecrire()`. Qui ne
  //  touche à rien ne déclenche aucun `input` — il ne reste que
  //  l'écriture du `submit`.
  const q = await monterLaFiche("");
  const vu = await q.evaluate(async () => {
    const forme = document.querySelector("#text_editor_textarea").closest("form");
    const avant = document.querySelector("#text_editor_textarea").value;
    //  On déclenche l'envoi SANS le laisser partir : la mesure veut
    //  savoir ce que le message contient à cet instant, pas poster.
    forme.addEventListener("submit", (e) => e.preventDefault(), { once: false });
    forme.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    const apres = document.querySelector("#text_editor_textarea").value;
    const bloc = (c) => apres.includes(`class="${c}"`);
    return {
      videAvant: avant.trim() === "",
      sections: [
        "wmf__tete",
        "wmf__soustitre",
        "wmf__tw",
        "wmf__haut",
        "wmf__fc",
        "wmf__histoire",
        "wmf__starter",
        "wmf__ancienne",
        "wmf__joueur",
        "wmf__cadre",
      ].filter((c) => !bloc(c)),
      champs: (apres.match(/class="wmf__champ"/g) ?? []).length,
      invites: (apres.match(/ data-vide="/g) ?? []).length,
    };
  });
  dire(
    "ENVOYER SANS RIEN TAPER LAISSE LE GABARIT ENTIER DANS LE MESSAGE",
    vu.videAvant === true && vu.sections.length === 0 && vu.champs >= 18 &&
      vu.invites >= 18,
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  ── SUR UN TÉLÉPHONE, LA FICHE GARDE SES RANGÉES ───────────────
  //
  //  « Attention, en version mobile, tout est cassé » et « faut
  //  garder exactement la même structure » — 24 novembre.
  //
  //  Ce que la mesure attrape, et qu'aucun œil ne voit depuis un
  //  bureau : les colonnes d'image sont en pixels et leur voisine
  //  demande 320 de base, donc sous 560 px la rangée passait à la
  //  ligne et la fiche se dépliait en une seule colonne.
  //
  //  ON COMPARE DES POSITIONS, PAS DES RÈGLES. « Côte à côte » veut
  //  dire que les deux boîtes partagent une bande horizontale ; une
  //  liste de propriétés CSS ne le dirait pas.
  const q = await monterLaFiche("");
  await q.setViewportSize({ width: 390, height: 844 });
  await q.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  const vu = await q.evaluate(() => {
    const cote = (a, b) => {
      const x = document.querySelector(a)?.getBoundingClientRect();
      const y = document.querySelector(b)?.getBoundingClientRect();
      if (x === undefined || y === undefined) return null;
      //  Même bande : le haut de l'un est au-dessus du bas de
      //  l'autre, dans les deux sens.
      return x.top < y.bottom && y.top < x.bottom && x.right <= y.left + 1;
    };
    const large = (s) =>
      Math.round(document.querySelector(s)?.getBoundingClientRect().width ?? -1);
    return {
      tete: cote(".wmf__avatar", ".wmf__infos"),
      starter: cote(".wmf__pokemon", ".wmf__rencontre"),
      joueur: cote(".wmf__tcard", ".wmf__joueur-infos"),
      //  « DERRIÈRE L'ÉCRAN » N'EST PLUS UNE GRILLE. On mesure donc
      //  ce qui compte maintenant : sur un téléphone, deux
      //  informations ne se partagent pas une ligne.
      memeLigne: (() => {
        const c = [...document.querySelectorAll(".wmf__joueur-infos > .wmf__champ")];
        return c.length > 1 &&
          c[0].getBoundingClientRect().bottom > c[1].getBoundingClientRect().top + 1;
      })(),
      debordement: document.querySelector(".wmf").scrollWidth -
        document.querySelector(".wmf").clientWidth,
      sprite: large(".wmf__pokemon") >= 96,
    };
  });
  dire(
    "À 390 PX, LA FICHE GARDE SES TROIS RANGÉES",
    vu.tete === true && vu.starter === true && vu.joueur === true,
    JSON.stringify(vu),
  );
  dire(
    "   et rien ne déborde, ni la carte du Pokémon sous son sprite",
    vu.debordement <= 0 && vu.sprite === true,
    JSON.stringify({ debordement: vu.debordement, carte: vu.sprite }),
  );
  dire(
    "   « derrière l'écran » met une information par ligne",
    vu.memeLigne === false,
    JSON.stringify({ deuxSurUneLigne: vu.memeLigne }),
  );
  await q.close();
}

{
  //  ── LA BARRE PORTE CE QUE PORTE FORUMACTIF ─────────────────────
  //
  //  « Affiche la même chose que les options possibles dans le bloc
  //  d'édition de l'éditeur forumactif » — 24 novembre.
  //
  //  LA LISTE EST CELLE RELEVÉE SUR LA VRAIE PAGE, le 24 novembre :
  //  trente-huit boutons de sceditor. Vingt se reposent ici ; les
  //  dix-huit autres sont des services de Forumactif — du BBCode que
  //  seul son serveur rend, ou des fenêtres qui lui appartiennent.
  //  La mesure fige ce partage, pour qu'un bouton ne disparaisse pas
  //  sans qu'on s'en aperçoive.
  const q = await monterLaFiche("");
  const vu = await q.evaluate(() => {
    const barre = document.querySelector(".wmf__histoire-corps .wmf-form__balises");
    //  LES OUTILS SONT DES ICÔNES DEPUIS LE 24 NOVEMBRE : leur nom
    //  n'est plus à l'écran, il est dans l'`aria-label`. C'est aussi
    //  ce que la mesure vérifie au passage — une icône sans nom
    //  accessible est un bouton muet.
    const mots = [...barre.querySelectorAll(".wmf-form__balise")].map((b) =>
      b.getAttribute("aria-label")
    );
    const dessins = [...barre.querySelectorAll(".wmf-form__balise svg")].length;
    const menus = [...barre.querySelectorAll(".wmf-form__menu")].map((m) =>
      m.options[0].textContent
    );
    return {
      mots,
      menus,
      couleur: barre.querySelector('input[type="color"]') !== null,
      traits: barre.querySelectorAll(".wmf-form__balises-trait").length,
      dessins,
    };
  });
  //  LES NOMS SONT CEUX DE FORUMACTIF, relevés sur sa barre le
  //  24 novembre. C'est le nom accessible de chaque bouton, pas son
  //  texte : les outils sont des icônes.
  const ATTENDUS = [
    "Gras",
    "Italique",
    "Souligné",
    "Barré",
    "Indice",
    "Exposant",
    "Aligné à gauche",
    "Centré",
    "Aligné à droite",
    "Justifié",
    "Liste",
    "Liste ordonnée",
    "Citer",
    "Code",
    "Insérer une ligne",
    "Insérer un tableau",
    "Insérer un lien",
    "Insérer une image",
    "Supprimer le formatage du texte",
  ];
  dire(
    "LA BARRE PORTE LES OPTIONS DE FORUMACTIF, EN ICÔNES ET NOMMÉES",
    JSON.stringify(vu.mots) === JSON.stringify(ATTENDUS) &&
      vu.dessins === ATTENDUS.length,
    JSON.stringify({ mots: vu.mots, dessins: vu.dessins }),
  );
  dire(
    "   avec ses trois menus — taille, police, couleur",
    JSON.stringify(vu.menus) === JSON.stringify(["Taille", "Police"]) &&
      vu.couleur === true,
    JSON.stringify({ menus: vu.menus, couleur: vu.couleur }),
  );
  dire(
    "   et les familles sont séparées, sinon vingt boutons font un mur",
    vu.traits >= 5,
    JSON.stringify(vu.traits),
  );
  await q.close();
}

{
  //  ── LES GROS BLOCS SONT GROS, ET LES DEUX COLONNES ÉGALES ──────
  //
  //  « Tous les blocs d'édition (les gros) doivent avoir une hauteur
  //  minimum. On est sur un forum RPG, donc on écrit énormément. »
  //  Et « la hauteur du bloc doit être la même que le bloc du starter
  //  à gauche. » — 24 novembre.
  //
  //  LA MESURE EXISTE PARCE QUE LA RÈGLE AVAIT L'AIR JUSTE ET NE
  //  L'ÉTAIT PAS : une règle plus haut dans la feuille donnait 3,4 em
  //  à ces zones par `[data-wmf-zone]`, et un sélecteur par nom de
  //  balise pèse moins qu'un sélecteur par attribut. La hauteur
  //  retombait à 54 px. Relire la feuille ne le disait pas ; mesurer,
  //  si.
  const q = await monterLaFiche("");
  const vu = await q.evaluate(() => {
    const h = (s) =>
      Math.round(document.querySelector(s)?.getBoundingClientRect().height ?? -1);
    return {
      histoire: h(".wmf__histoire-corps > [data-wmf-zone]"),
      rencontre: h(".wmf__rencontre > [data-wmf-zone]"),
      ancienne: h(".wmf__ancienne > [data-wmf-zone]"),
      carte: h(".wmf__pokemon"),
      droite: h(".wmf__rencontre"),
    };
  });
  dire(
    "LES GROS BLOCS D'ÉDITION SONT HAUTS — on écrit des pavés",
    vu.histoire >= 420 && vu.rencontre >= 260 && vu.ancienne >= 260,
    JSON.stringify(vu),
  );
  dire(
    "   et le bloc de droite fait la hauteur de la carte de gauche",
    vu.carte === vu.droite && vu.carte > 0,
    JSON.stringify({ carte: vu.carte, droite: vu.droite }),
  );
  await q.close();
}

//  ── LA PHOTO ───────────────────────────────────────────────────────
//
//      deno task poster -- --photo
//
//  Les mesures disent que la barre porte vingt boutons ; elles ne
//  disent pas s'ils sont regardables. La photo est pour ça, et pour
//  montrer un changement sans avoir à poster sur le forum.
{
  //  ── LA CHRONOLOGIE : LE POINT, LE TRAIT, L'IMAGE ───────────────
  //
  //  « Mets une icône "+" et change le texte pour "Ajouter une
  //  date". Affiche bien la date en face du bloc et pas en face des
  //  outils d'édition […] ce serait bien de faire comme la
  //  chronologie du forum avec un point et un trait qui relie la
  //  chronologie. Faudrait permettre de rajouter un gif ou une image
  //  pour chaque moment. » — 24 novembre.
  const q = await monterLaFiche("");
  await q.evaluate(OUTILS);
  const vu = await q.evaluate(async () => {
    const vers = (mot) =>
      [...document.querySelectorAll(".wmf-form__forme")].find((b) =>
        b.textContent.includes(mot)
      );
    vers("Chronologie").click();
    await globalThis.wmPause(220);
    const plus = document.querySelector(".wmf-form__plus");
    const motDuPlus = plus.textContent.trim();
    const icone = plus.querySelector("svg") !== null;
    plus.click();
    await globalThis.wmPause(220);

    const moments = [...document.querySelectorAll(".wmf__moment")];
    const un = moments[0];
    const date = un.querySelector(".wmf__moment-date").getBoundingClientRect();
    const texte = un.querySelector(".wmf__moment-texte").getBoundingClientRect();
    const barre = un.querySelector(".wmf-form__balises").getBoundingClientRect();
    const trait = getComputedStyle(un, "::after");
    const dernier = getComputedStyle(moments[moments.length - 1], "::after");
    return {
      motDuPlus,
      icone,
      //  DEUX MOMENTS APRÈS UN CLIC : une chronologie vide en montre
      //  déjà un, donc n'en ajouter qu'un ne changeait rien à
      //  l'écran.
      combien: moments.length,
      //  « EN FACE DU BLOC ET PAS EN FACE DES OUTILS » : la date
      //  partage sa bande horizontale avec le texte, et la barre est
      //  au-dessus des deux.
      dateEnFaceDuTexte: date.top < texte.bottom && texte.top < date.bottom,
      barreAuDessus: barre.bottom <= date.top + 1,
      point: getComputedStyle(un, "::before").backgroundColor,
      trait: { l: trait.width, fond: trait.backgroundColor },
      //  LE DERNIER NE TIRE PAS DE TRAIT : il n'a personne à relier.
      traitDuDernier: dernier.content,
    };
  });
  dire(
    "LE BOUTON DIT « AJOUTER UNE DATE », AVEC SON ICÔNE",
    vu.motDuPlus === "Ajouter une date" && vu.icone === true,
    JSON.stringify({ mot: vu.motDuPlus, icone: vu.icone }),
  );
  dire(
    "   et un clic ajoute un moment DE PLUS que ce qu'on voyait",
    vu.combien === 2,
    JSON.stringify(vu.combien),
  );
  dire(
    "   la date est en face du texte, les outils au-dessus des deux",
    vu.dateEnFaceDuTexte === true && vu.barreAuDessus === true,
    JSON.stringify({ enFace: vu.dateEnFaceDuTexte, barre: vu.barreAuDessus }),
  );
  dire(
    "   un point par moment, un trait jusqu'au suivant, rien après le dernier",
    vu.point !== "rgba(0, 0, 0, 0)" && vu.trait.l === "2px" &&
      vu.traitDuDernier === "none",
    JSON.stringify(vu.trait) + " dernier: " + vu.traitDuDernier,
  );

  //  ── L'IMAGE D'UN MOMENT, ET SON CRÉDIT ─────────────────────────
  const img = await q.evaluate(async () => {
    const zones = [...document.querySelectorAll('[data-wmf-zone="m-image"]')];
    const credits = [...document.querySelectorAll('[data-wmf-zone="m-credit"]')];
    //  ON ÉCRIT DANS LE SECOND, pas le premier : c'est le rang qui
    //  doit suivre, et un code qui prendrait toujours le premier
    //  cadre passerait quand même sur le premier moment.
    zones[1].textContent = "https://exemple.test/souvenir.gif";
    zones[1].dispatchEvent(new InputEvent("input", { bubbles: true }));
    credits[1].textContent = "@quelquun";
    credits[1].dispatchEvent(new InputEvent("input", { bubbles: true }));
    await globalThis.wmPause(250);
    const cadres = [...document.querySelectorAll(".wmf__moment-image .wmf__cadre")];
    const m = globalThis.wmMessage();
    return {
      surLeBon: cadres[1]?.querySelector("img")?.getAttribute("src") ?? null,
      pasSurLAutre: cadres[0]?.querySelector("img") === null ||
        cadres[0]?.querySelector("img") === undefined,
      dansLeMessage: m.includes("<wmf-m-image>https://exemple.test/souvenir.gif"),
      creditDansLeMessage: m.includes("<wmf-m-credit>@quelquun"),
    };
  });
  dire(
    "CHAQUE MOMENT A SON IMAGE, ET C'EST LA SIENNE",
    img.surLeBon === "https://exemple.test/souvenir.gif" && img.pasSurLAutre === true,
    JSON.stringify(img),
  );
  dire(
    "   et elle part dans le message avec son crédit",
    img.dansLeMessage && img.creditDansLeMessage,
    JSON.stringify({ image: img.dansLeMessage, credit: img.creditDansLeMessage }),
  );
  await q.close();
}

//  ── LA PHOTO ───────────────────────────────────────────────────────
//
//      deno task poster -- --photo
//
//  Les mesures disent que la barre porte vingt boutons ; elles ne
//  disent pas s'ils sont regardables. La photo est pour ça, et pour
//  montrer un changement sans avoir à poster sur le forum.
if (Deno.args.includes("--mesure")) {
  const q = await monterLaFiche("");
  await q.evaluate(async () => {
    [...document.querySelectorAll(".wmf-form__forme")]
      .find((b) => b.textContent.includes("Chronologie")).click();
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector(".wmf-form__plus").click();
    await new Promise((r) => setTimeout(r, 200));
  });
  console.log(JSON.stringify(
    await q.evaluate(() => {
      const m = document.querySelector(".wmf__moment");
      const a = getComputedStyle(m, "::after");
      return {
        h: Math.round(m.getBoundingClientRect().height),
        after: {
          content: a.content,
          top: a.top,
          bottom: a.bottom,
          w: a.width,
          bg: a.backgroundColor,
          pos: a.position,
        },
        overflowChrono: getComputedStyle(document.querySelector(".wmf__chrono")).overflow,
        overflowMoment: getComputedStyle(m).overflow,
      };
    }),
    null,
    1,
  ));
  await q.close();
}

if (Deno.args.includes("--photo")) {
  const q = await monterLaFiche("");
  await q.evaluate(() => document.fonts.ready);
  //  LA CHRONOLOGIE EST OUVERTE SUR LA PHOTO, avec deux moments : à
  //  un seul, ni le trait ni le point ne se voient, et c'est
  //  justement eux qu'on vient regarder.
  await q.evaluate(async () => {
    [...document.querySelectorAll(".wmf-form__forme")]
      .find((b) => b.textContent.includes("Chronologie")).click();
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector(".wmf-form__plus").click();
    await new Promise((r) => setTimeout(r, 200));
  });
  for (const [nom, large] of [["editeur", 1200], ["editeur-mobile", 390]]) {
    await q.setViewportSize({ width: large, height: 1200 });
    await q.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    await q.screenshot({ path: `${R}apercu-fiche-${nom}.png`, fullPage: true });
    console.log(`  apercu-fiche-${nom}.png`);
  }
  await q.close();
}

await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
Deno.exit(soucis.length === 0 ? 0 : 1);
