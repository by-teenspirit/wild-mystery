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
  especes: [
    {
      id: 172,
      nom: "Pichu",
      types: ["electrik"],
      talents: [{ nom: "Statik" }, { nom: "Paratonnerre", cache: true }],
    },
    { id: 133, nom: "Évoli", types: ["normal"], talents: [{ nom: "Échauffement" }] },
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

const pageAvecScript = (corps, message = "") =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${BASE_MODERNBB}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>html,body{margin:0}body{background:var(--wm-fond-page)}</style>
</head><body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp">
<div id="wrap">${ARIANE_PRESENTATIONS}<div id="page-body">${
    corps.replace("Le corps du message.", message)
  }</div></div>
</div>
</body></html>`;

async function monterLaFiche(message = "") {
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
      body: pageAvecScript(pageDePost(), message),
    });
  });
  await q.goto("https://exemple.test/post");
  await q.evaluate(() => {
    const s = document.createElement("script");
    s.src = "/js/wild-mystery.js";
    document.body.appendChild(s);
  });
  await q.waitForTimeout(900);
  return q;
}

console.log("\n── le formulaire de la fiche ──");

{
  const q = await monterLaFiche("");

  const pose = await q.evaluate(() => {
    const f = document.getElementById("wm-fiche");
    if (f === null) return { pose: false };
    const boite = document.getElementById("postingbox");
    return {
      pose: true,
      //  AU-DESSUS DE L'ÉDITEUR : on remplit la fiche, puis on relit
      //  le message qu'elle a écrit, puis on envoie. Dans l'autre
      //  ordre, le formulaire serait hors de l'écran au moment où on
      //  en a besoin.
      avantLEditeur: !!(f.compareDocumentPosition(boite) & Node.DOCUMENT_POSITION_FOLLOWING),
      sections: [...f.querySelectorAll(".h3")].map((h) => h.textContent),
      champs: f.querySelectorAll("input[type=text], textarea, select").length,
      tableaux: f.querySelectorAll("table").length,
    };
  });
  dire(
    "LE FORMULAIRE EST POSÉ, AU-DESSUS DE L'ÉDITEUR",
    pose.pose === true && pose.avantLEditeur === true,
    JSON.stringify({ pose: pose.pose, avant: pose.avantLEditeur }),
  );
  dire(
    "   et il porte les cinq sections qu'elle a décrites",
    JSON.stringify(pose.sections) === JSON.stringify([
      "Ta fiche de présentation",
      "Le personnage",
      "Son histoire",
      "Son premier Pokémon",
      "Le Groupe Ombre",
      "Derrière l'écran",
    ]),
    JSON.stringify(pose.sections),
  );
  //  « Je veux pas de tableau, que du flexbox. »
  dire("   et aucun tableau", pose.tableaux === 0, String(pose.tableaux));

  //  ── CE QU'ON TAPE PART DANS L'ÉDITEUR ──────────────────────────
  const ecrit = await q.evaluate(async () => {
    const poser = (id, v) => {
      const e = document.getElementById(id);
      e.value = v;
      e.dispatchEvent(new Event("input", { bubbles: true }));
    };
    poser("wmf-nom", "Jak A. Fering");
    poser("wmf-metier", "Ranger");
    poser("wmf-histoire", "Il est né un <b>mardi</b>.");
    await new Promise((r) => setTimeout(r, 200));
    return document.querySelector("#text_editor_textarea").value;
  });
  dire(
    "CE QU'ON TAPE S'ÉCRIT DANS LE MESSAGE",
    ecrit.includes("<wmf-nom>Jak A. Fering</wmf-nom>") &&
      ecrit.includes("MÉTIER :") && ecrit.includes("Ranger"),
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

  //  ── LA LISTE DES ESPÈCES ARRIVE, ET LES TALENTS SUIVENT ────────
  const starter = await q.evaluate(async () => {
    const menu = document.getElementById("wmf-espece");
    const options = [...menu.options].map((o) => o.textContent);
    menu.value = "172";
    menu.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    return {
      options,
      talents: [...document.getElementById("wmf-talent").options].map((o) => o.textContent),
      message: document.querySelector("#text_editor_textarea").value,
    };
  });
  dire(
    "LES ESPÈCES SONT DANS LE MENU",
    starter.options.includes("Pichu") && starter.options.includes("Évoli"),
    JSON.stringify(starter.options),
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
  //  « Les niveaux ne sont pas choisis par les joueurs. »
  dire(
    "   LE NIVEAU N'EST DEMANDÉ NULLE PART",
    !/niveau/i.test(starter.message),
    "",
  );

  //  ── LA CHRONOLOGIE ─────────────────────────────────────────────
  const chrono = await q.evaluate(async () => {
    const radio = [...document.querySelectorAll('input[name="wmf-forme"]')]
      .find((r) => r.value === "chronologie");
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    document.querySelector(".wmf-form__plus").click();
    await new Promise((r) => setTimeout(r, 120));
    const bloc = document.querySelector(".wmf-form__moment");
    const date = bloc.querySelector("input");
    const texte = bloc.querySelector("textarea");
    date.value = "2015";
    date.dispatchEvent(new Event("input", { bubbles: true }));
    texte.value = "Le départ.";
    texte.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    return {
      moments: document.querySelectorAll(".wmf-form__moment").length,
      message: document.querySelector("#text_editor_textarea").value,
    };
  });
  dire(
    "LA CHRONOLOGIE S'AJOUTE, ET ELLE ENTRE DANS LE MESSAGE",
    chrono.moments === 1 &&
      chrono.message.includes('data-mode="chronologie"') &&
      chrono.message.includes("<wmf-m-date>2015</wmf-m-date>") &&
      chrono.message.includes("<wmf-m-texte>Le départ.</wmf-m-texte>"),
    JSON.stringify({ moments: chrono.moments }),
  );
  //  CHANGER DE FORME NE PERD PAS LE PAVÉ tant qu'on n'a pas quitté la
  //  page : on peut se raviser.
  const retour = await q.evaluate(async () => {
    const radio = [...document.querySelectorAll('input[name="wmf-forme"]')]
      .find((r) => r.value === "pave");
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    return document.getElementById("wmf-histoire").value;
  });
  dire(
    "   et se raviser ne perd pas le pavé qu'on avait écrit",
    retour === "Il est né un <b>mardi</b>.",
    JSON.stringify(retour),
  );

  //  ── LA CROIX RETIRE UN MOMENT ──────────────────────────────────
  const oté = await q.evaluate(async () => {
    const radio = [...document.querySelectorAll('input[name="wmf-forme"]')]
      .find((r) => r.value === "chronologie");
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    document.querySelector(".wmf-form__croix").click();
    await new Promise((r) => setTimeout(r, 150));
    return document.querySelectorAll(".wmf-form__moment").length;
  });
  dire("   et la croix retire le moment", oté === 0, String(oté));

  //  ── LE GROUPE OMBRE ────────────────────────────────────────────
  const ombre = await q.evaluate(async () => {
    const avant = document.querySelector(".wmf-form__ombre").hidden;
    const case_ = document.getElementById("wmf-ombre");
    case_.checked = true;
    case_.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    return {
      avant,
      apres: document.querySelector(".wmf-form__ombre").hidden,
      message: document.querySelector("#text_editor_textarea").value,
    };
  });
  dire(
    "LE GROUPE OMBRE EST UNE OPTION : caché par défaut, montré sur la case",
    ombre.avant === true && ombre.apres === false &&
      ombre.message.includes('class="wmf__ombre"'),
    JSON.stringify({ avant: ombre.avant, apres: ombre.apres }),
  );
  await q.close();
}

{
  //  ── CE QU'IL NE FAUT SURTOUT PAS ÉCRASER ───────────────────────
  //
  //  Une fiche de la V1, ou n'importe quel message écrit à la main.
  //  Le formulaire réécrit le message ENTIER : s'il le faisait ici,
  //  il effacerait le travail de quelqu'un sans le lui demander.
  const q = await monterLaFiche(
    '<center><div class="bk1"><div class="bkt2">Prénom P. Nom</div>son ancienne fiche</div></center>',
  );
  const vu = await q.evaluate(async () => {
    const champ = document.querySelector("#text_editor_textarea");
    const avant = champ.value;
    const nom = document.getElementById("wmf-nom");
    nom.value = "Quelqu'un";
    nom.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    return {
      intact: champ.value === avant,
      dit: document.querySelector(".wmf-form__dit").textContent,
      boutonVisible: !document.querySelector(".wmf-form__reprendre").hidden,
    };
  });
  dire(
    "UNE FICHE DE LA V1 N'EST PAS ÉCRASÉE — on tape, le message ne bouge pas",
    vu.intact === true,
    JSON.stringify(vu.dit?.slice(0, 60)),
  );
  dire(
    "   et le formulaire le dit, avec un bouton pour reprendre la main",
    /n'a pas été écrit avec ce formulaire/.test(vu.dit ?? "") && vu.boutonVisible === true,
    JSON.stringify({ bouton: vu.boutonVisible }),
  );
  //  LE SEUL CHEMIN QUI ÉCRASE EST UN CLIC EXPLICITE.
  const apres = await q.evaluate(async () => {
    document.querySelector(".wmf-form__reprendre").click();
    await new Promise((r) => setTimeout(r, 200));
    return document.querySelector("#text_editor_textarea").value;
  });
  dire(
    "   et il ne remplace QUE sur un clic nommé",
    apres.includes("<wmf-nom>Quelqu'un</wmf-nom>") && !apres.includes("ancienne fiche"),
    JSON.stringify(apres.slice(0, 80)),
  );
  await q.close();
}

{
  //  ── ROUVRIR SA FICHE LA RETROUVE ───────────────────────────────
  //
  //  « Quand on édite son message, ce serait super que ça reste comme
  //  ça. » C'est la demande, mesurée de bout en bout : une fiche
  //  publiée est remise dans l'éditeur, et le formulaire doit la
  //  présenter remplie.
  const { publier } = await import("../src/navigateur/fiche.ts");
  const { ficheVide } = await import("../src/navigateur/fiche.ts");
  const deja = publier({
    ...ficheVide(),
    nom: "Erin Kavanagh",
    identite: { ...ficheVide().identite, metier: "Infirmière", surnom: "Rin" },
    histoire: { mode: "chronologie", moments: [{ date: "2012", texte: "L'incendie." }] },
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
  const relu = await q.evaluate(() => ({
    nom: document.getElementById("wmf-nom").value,
    metier: document.getElementById("wmf-metier").value,
    surnom: document.getElementById("wmf-surnom").value,
    pseudo: document.getElementById("wmf-j-pseudo").value,
    forme: [...document.querySelectorAll('input[name="wmf-forme"]')]
      .find((r) => r.checked)?.value,
    moments: [...document.querySelectorAll(".wmf-form__moment")].map((m) => [
      m.querySelector("input").value,
      m.querySelector("textarea").value,
    ]),
    rencontre: document.getElementById("wmf-s-rencontre").value,
    surnomDuPoke: document.getElementById("wmf-s-surnom").value,
    dit: document.querySelector(".wmf-form__dit").textContent,
  }));
  dire(
    "ROUVRIR SA FICHE LA RETROUVE REMPLIE",
    relu.nom === "Erin Kavanagh" && relu.metier === "Infirmière" &&
      relu.surnom === "Rin" && relu.pseudo === "Callista",
    JSON.stringify(relu),
  );
  dire(
    "   la chronologie revient en chronologie, avec ses moments",
    relu.forme === "chronologie" &&
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
  await q.close();
}

await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
Deno.exit(soucis.length === 0 ? 0 : 1);
