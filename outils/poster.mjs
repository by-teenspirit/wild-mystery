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
import { chromium } from "npm:playwright@1.49.1";

//  LE MÊME CHROMIUM QUE LES AUTRES HARNAIS, et la même façon de le
//  trouver : le garde-fou n° 20 vérifie qu'il n'y en a qu'un.
const CHROME = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux64/chrome",
].find((c) => {
  try {
    readFileSync(c);
    return true;
  } catch {
    return false;
  }
});

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

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
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
await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
Deno.exit(soucis.length === 0 ? 0 : 1);
