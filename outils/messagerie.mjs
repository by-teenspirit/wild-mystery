// ════════════════════════════════════════════════════════════════════
//  outils/messagerie.mjs — la boîte de réception, dans un vrai
//  navigateur.
//
//  COUVRE : css/30-messagerie.css
//
//      deno run -A outils/messagerie.mjs
//      deno run -A outils/messagerie.mjs --photo
//
//  ── TROIS ÉTATS, PARCE QUE LE DÉFAUT LE PLUS LAID EST DANS LE VIDE ─
//
//  Un dossier PLEIN, un dossier VIDE et une liste de sujets ordinaire
//  sont montés sur la même page.
//
//  Le dossier vide n'est pas une variante : c'est là que le défaut
//  était le plus visible, parce que sans message il n'y a pas de
//  pastille, et le `dt` du message « Vous n'avez pas de messages dans
//  ce dossier » tombait alors dans la colonne de 48 px — un mot par
//  ligne. Un harnais qui ne monterait que des lignes pleines serait
//  vert sur une page cassée.
//
//  La liste de sujets est là pour l'autre moitié de la demande, celle
//  de la page de recherche : rien de ce qu'on fait ici ne doit
//  l'atteindre.
//
//  Le balisage vient d'un relevé fait le 13 novembre dans le
//  navigateur de Callista, sur `/privmsg?folder=sentbox` et
//  `?folder=inbox` : la page est derrière la connexion, et on ne s'y
//  connecte pas d'ici. Les mesures d'origine sont dans l'en-tête de
//  la feuille.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";

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
const lire = (c) => readFileSync(R + c, "utf8");

/** L'en-tête, dans sa propre liste — c'est ainsi que Forumactif l'écrit. */
const entete = (mot) => `
  <ul class="topiclist topics">
    <li class="header">
      <dl>
        <dt><div class="list-inner">Sujet</div></dt>
        <dd class="mark">${mot}</dd>
      </dl>
    </li>
  </ul>`;

/*  LES 24 × 20 PX DU `div` VIDE VIENNENT DE LA FEUILLE DE MODERNBB,
    que ce fac-similé ne charge pas : relevés le 13 novembre sur la
    vraie page, ils sont reposés ici en style en ligne. Sans eux le
    défaut n'existerait pas sur cette page, et la règle qui le corrige
    serait gardée par un contrôle vert d'avance. Même principe que le
    bleu de ModernBB reposé dans `outils/statistiques.mjs`. */
const PLACE_DU_DOSSIER = 'style="width: 24px; height: 20px"';

/** Une ligne de message privé. Le `div` vide est celui du relevé. */
const message = (n, sujet, qui, quand) => `
  <li class="row row${n % 2 === 0 ? 2 : 1}">
    <div ${PLACE_DU_DOSSIER}></div>
    <dl class="icon">
      <span class="wm-pastille"></span>
      <dt>
        <a class="topictitle" href="/privmsg?mode=read">${sujet}</a><br>
        <span>${qui} - ${quand}</span>
      </dt>
      <dd class="mark"><input type="checkbox"></dd>
    </dl>
  </li>`;

/*  LA MÊME LIGNE, SANS JAVASCRIPT. La pastille est posée par
    `module-categories` ; sans script elle n'existe pas, et Forumactif
    laisse son image dans un `style` en ligne sur le `dl`. C'est un
    état réel de la page, pas une hypothèse — et c'est celui où la
    case à cocher, si on ne lui nommait pas son aire, retomberait dans
    la première colonne, celle de la pastille absente. */
const sansScript = (sujet, qui) => `
  <li class="row row1">
    <div ${PLACE_DU_DOSSIER}></div>
    <dl class="icon" style="background:url(https://i.servimg.com/u/f11/no-new.png) no-repeat scroll 10px 50%;">
      <dt>
        <a class="topictitle" href="/privmsg?mode=read">${sujet}</a><br>
        <span>${qui} - Hier à 9:02</span>
      </dt>
      <dd class="mark"><input type="checkbox"></dd>
    </dl>
  </li>`;

/*  LE DOSSIER VIDE : pas de pastille, un `strong` dans le `dt`. */
const vide = `
  <li class="row row1">
    <div ${PLACE_DU_DOSSIER}></div>
    <dl class="icon">
      <dt><strong>Vous n'avez pas de messages dans ce dossier</strong></dt>
      <dd class="mark"></dd>
    </dl>
  </li>`;

/** Une ligne de liste de sujets, pour le témoin. */
const sujet = `
  <li class="row row1">
    <dl class="icon">
      <span class="wm-pastille"></span>
      <dd class="dterm">
        <div class="topic-title-container">
          <a class="topic-title" href="/t9-x">Un sujet de forum</a>
        </div>
      </dd>
      <dd class="posts">12</dd>
      <dd class="views">51</dd>
      <dd class="lastpost"><span><a href="/t9-x">Hier à 17:54</a></span></dd>
    </dl>
  </li>`;

/*  ── LES ONGLETS DE DOSSIER, TELS QUE MODERNBB LES ÉCRIT ──────────

    LES QUATRE `li` PORTENT UN `div.active`, et il est VIDE : c'est un
    calque posé en absolu sur toute la surface de l'onglet, pas le
    marqueur du dossier courant. Le dossier courant est celui qui n'a
    PAS de `<a>` — son nom est un nœud de texte posé directement dans
    le `li`, SOUS le calque.

    C'est ce qui rend le fac-similé indispensable ici : un fond opaque
    posé sur le calque recouvre ce nom, et c'est exactement le défaut
    que ma règle du 13 novembre au matin avait introduit. Sans le
    calque et sans sa position, la page montée ici ne pourrait pas le
    montrer.

    `position`, `top`, `left` et les 88 px de hauteur viennent de la
    feuille de ModernBB, que ce fac-similé ne charge pas : relevés sur
    la vraie page, ils sont reposés en style en ligne. */
const CALQUE = 'class="active" style="position: absolute; top: 0; left: 0; width: 100%; height: 88px"';

/*  La mise en page du menu vient elle aussi de ModernBB : des `li` en
    ligne de 129 px, centrés, hauts de 88, avec un rond d'icône de 33
    au-dessus du nom. Reposée ici pour que la photo montre les onglets
    tels qu'ils sont, et pas quatre puces empilées. */
const LI = "box-sizing: border-box; position: relative; display: inline-block;" +
  " width: 129px; height: 88px;" +
  " padding: 18px 9px 0; text-align: center; vertical-align: top";
const ICONE = "display: block; width: 33px; height: 33px; margin: 0 auto;" +
  " border-radius: 33px; line-height: 31px";

const onglet = (icone, nom, adresse) =>
  adresse === null
    //  Le dossier ouvert : pas de lien, le nom à même le `li`.
    ? `<li style="${LI}"><i class="${icone}" style="${ICONE}"></i>${nom}<div ${CALQUE}></div></li>`
    : `<li style="${LI}"><i class="${icone}" style="${ICONE}"></i><a href="${adresse}">${nom}</a><div ${CALQUE}></div></li>`;

const MENU = `
<ul id="privmsgs-menu">
  ${onglet("ion-archive", "Boîte de réception", "/privmsg?folder=inbox")}
  ${onglet("ion-paper-airplane", "Messages envoyés", null)}
  ${onglet("ion-share", "Boîte d'envoi", "/privmsg?folder=outbox")}
  ${onglet("ion-bookmark", "Archives", "/privmsg?folder=savebox")}
</ul>`;

/*  LA PAGINATION, ET LE `float: left` QUI EXPLIQUE TOUT.

    Ses pastilles rondes de 32 px viennent de `04-forum`, donc du vrai
    habillage. Mais le `<p>` qui les porte ne fait que DIX-HUIT pixels
    de haut, et c'est ce flottement — posé par la feuille de
    Forumactif, que ce fac-similé ne charge pas — qui en est la cause :
    un enfant flottant ne compte pas dans la hauteur de son parent. Le
    `p` se règle donc sur son seul `<br>`, et la barre déborde de
    quatorze pixels par le bas, dans la marge de dix-huit qu'il
    déclare. Il restait quatre pixels avant la rangée de boutons.

    Sans ce `float` reposé ici, la page montée n'a pas le défaut, et la
    règle qui le corrige serait gardée par un contrôle vert d'avance —
    c'était le cas au premier essai. */
const PAGINATION =
  `<span class="pagination" style="float: left">Page <strong>1</strong> sur <strong>1</strong></span><br>`;

const PAGE = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Messages privés</title>
<link rel="stylesheet" href="/jetons.css"><link rel="stylesheet" href="/wild-mystery.css">
</head><body><div id="modernbb"><div class="wrap"><div id="main-content">

${MENU}
<div class="pm-actions"><a class="ion-ios-compose-outline button-round" href="/privmsg?mode=post"></a></div>

<p>${PAGINATION}</p>
<div class="pm-actions bottom"><input class="button1" type="submit" value="Tout supprimer"></div>

<!-- UN DOSSIER PLEIN -->
<div class="forabg" id="plein">
  <div class="inner">
    ${entete("Sélectionner")}
    <ul class="topiclist pmlist bg_none">
      ${message(1, "C'est Noël sur Wild Mystery !", "Arceus", "Mer 1 Déc 2021 - 0:49")}
      ${message(2, "Nous sommes de retour !", "Arceus", "Dim 5 Sep 2021 - 18:35")}
    </ul>
  </div>
</div>

<!-- LE MÊME DOSSIER, SANS JAVASCRIPT -->
<div class="forabg" id="sans-script">
  <div class="inner">
    ${entete("Sélectionner")}
    <ul class="topiclist pmlist bg_none">
      ${sansScript("Un message reçu sans script", "Arceus")}
    </ul>
  </div>
</div>

<!-- UN DOSSIER VIDE -->
<div class="forabg" id="dossier-vide">
  <div class="inner">
    ${entete("Sélectionner")}
    <ul class="topiclist pmlist bg_none">${vide}</ul>
  </div>
</div>

<!-- ET UNE LISTE DE SUJETS, QUI NE DOIT RIEN RECEVOIR -->
<div class="forabg" id="forum">
  <div class="inner">
    ${entete("Vues")}
    <ul class="topiclist topics">${sujet}</ul>
  </div>
</div>

</div></div></div></body></html>`;

let passes = 0;
const soucis = [];
function ok(quoi, vrai, detail) {
  if (vrai) {
    passes += 1;
    console.log(`  ok   ${quoi}`);
  } else {
    soucis.push(quoi);
    console.log(
      `  NON  ${quoi}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
    );
  }
}

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1384, height: 1200 } });
await p.route("**/*", (r) => {
  const u = r.request().url();
  if (/\/privmsg$/.test(u)) {
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: PAGE });
  }
  if (/jetons\.css$/.test(u)) {
    return r.fulfill({ contentType: "text/css", body: lire("panneau-admin/jetons.css") });
  }
  if (/wild-mystery\.css$/.test(u)) {
    return r.fulfill({ contentType: "text/css", body: lire("css/wild-mystery.css") });
  }
  return r.fulfill({ status: 404, body: "" });
});
await p.goto("https://exemple.test/privmsg", { waitUntil: "load" });
await p.waitForTimeout(150);

const vu = await p.evaluate(() => {
  const g = (s) => document.querySelector(s);
  const b = (e) => {
    const x = e.getBoundingClientRect();
    return {
      g: Math.round(x.left),
      d: Math.round(x.right),
      h: Math.round(x.top),
      ht: Math.round(x.height),
    };
  };
  const lignes = (e) => {
    //  COMBIEN DE LIGNES DE TEXTE le navigateur a vraiment tracées.
    //  C'est la mesure du défaut : « Vous n'avez pas de messages dans
    //  ce dossier » en faisait huit, une par mot.
    const r = document.createRange();
    r.selectNodeContents(e);
    return r.getClientRects().length;
  };
  const plein = g("#plein li.row dl.icon");
  const titre = g("#plein li.row a.topictitle");
  const case1 = g("#plein li.row dd.mark");
  const videDl = g("#dossier-vide li.row dl.icon");
  const videTexte = g("#dossier-vide li.row strong");
  const teteP = g("#plein li.header dl");
  const forum = g("#forum li.row dl.icon");
  return {
    plein: {
      hauteurLigne: b(g("#plein li.row")).ht,
      colonnes: getComputedStyle(plein).gridTemplateColumns,
      rangees: getComputedStyle(plein).gridTemplateRows,
      //  La case à cocher doit être à droite, pas au milieu.
      caseDroite: b(plein).d - b(case1).d,
      caseGauche: b(case1).g,
      milieu: Math.round((b(plein).g + b(plein).d) / 2),
      titreGauche: b(titre).g,
      //  Le `div` vide de la place de l'image de dossier.
      divVide: g("#plein li.row > div").getBoundingClientRect().height,
    },
    sansScript: (() => {
      const dl = g("#sans-script li.row dl.icon");
      const m = g("#sans-script li.row dd.mark");
      return {
        caseGauche: b(m).g,
        milieu: Math.round((b(dl).g + b(dl).d) / 2),
        titreGauche: b(g("#sans-script li.row a.topictitle")).g,
      };
    })(),
    vide: {
      lignesDeTexte: lignes(videTexte),
      largeurTexte: b(videTexte).d - b(videTexte).g,
      //  Il débordait de cinquante pixels AU-DESSUS de sa ligne.
      debordeEnHaut: b(videDl).h - b(videTexte).h,
      colonnes: getComputedStyle(videDl).gridTemplateColumns,
    },
    tete: {
      //  Une seule ligne, et chaque mot au-dessus de ce qu'il annonce.
      hauteur: b(teteP).ht,
      sujetGauche: b(g("#plein li.header dt")).g,
      selectionnerDroite: b(teteP).d - b(g("#plein li.header dd.mark")).d,
      affichage: getComputedStyle(teteP).display,
    },
    forum: {
      colonnes: getComputedStyle(forum).gridTemplateColumns,
      teteAffichage: getComputedStyle(g("#forum li.header dl")).display,
      hauteurLigne: b(g("#forum li.row")).ht,
    },
    bouton: getComputedStyle(g(".pm-actions .button-round")).backgroundColor,
    onglets: (() => {
      const lis = [...document.querySelectorAll("#privmsgs-menu li")];
      const ouvert = lis.find((li) => li.querySelector("a") === null);
      const ferme = lis.find((li) => li.querySelector("a") !== null);
      //  LE NOM DU DOSSIER OUVERT EST SOUS LE CALQUE : on compare ce
      //  que le calque peint à ce que le `li` peint derrière le texte.
      //  Opaque sur le calque, le nom disparaît — c'est le défaut.
      const calque = ouvert.querySelector(".active");
      const menu = document.querySelector("#privmsgs-menu");
      const transparent = (c) => c === "transparent" || /, *0\)$/.test(c);
      //  Le rapport de contraste, calculé et pas affirmé.
      const lum = (couleur) => {
        const [r, v, b] = couleur.match(/\d+/g).slice(0, 3).map(Number);
        const f = (x) =>
          x / 255 <= 0.03928 ? x / 255 / 12.92 : ((x / 255 + 0.055) / 1.055) ** 2.4;
        return 0.2126 * f(r) + 0.7152 * f(v) + 0.0722 * f(b);
      };
      const ratio = (x, y) => {
        const [h, b2] = [lum(x), lum(y)].sort((m, n) => n - m);
        return Math.round(((h + 0.05) / (b2 + 0.05)) * 100) / 100;
      };
      return {
        fondDuCalque: getComputedStyle(calque).backgroundColor,
        calqueTransparent: transparent(getComputedStyle(calque).backgroundColor),
        fondDuDossierOuvert: getComputedStyle(ouvert).backgroundColor,
        ouvertADuFond: !transparent(getComputedStyle(ouvert).backgroundColor),
        //  LA BARRE EST BLANCHE DE BASE, et l'onglet ouvert se peint
        //  dessus : c'est la demande du 13 novembre au soir, et c'est
        //  la grammaire de `.wm-onglet`. Les deux fonds doivent donc
        //  différer, et le fermé rester celui de la barre.
        fondDeLaBarre: getComputedStyle(menu).backgroundColor,
        fondDuDossierFerme: getComputedStyle(ferme).backgroundColor,
        fermeNePeintRien: transparent(getComputedStyle(ferme).backgroundColor),
        //  LE JETON RÉSOLU PAR LE NAVIGATEUR, pas lu tel quel : la
        //  variable vaut « #fffbf7 » et un fond calculé vaut
        //  « rgb(255, 251, 247) ». Les comparer directement ne dit
        //  jamais vrai — premier essai rouge pour cette raison. On
        //  passe donc par un témoin, qui les met dans la même langue.
        surface: (() => {
          const t = document.createElement("span");
          t.style.cssText = "position:absolute;background-color:var(--wm-fond-surface)";
          document.body.appendChild(t);
          const c = getComputedStyle(t).backgroundColor;
          t.remove();
          return c;
        })(),
        couleurOuvert: getComputedStyle(ouvert).color,
        couleurLien: getComputedStyle(ferme.querySelector("a")).color,
        //  Le nom de l'onglet ouvert est en texte inverse sur l'accent :
        //  on mesure que ça se lit, plutôt que de l'affirmer.
        contrasteDuNomOuvert: ratio(
          getComputedStyle(ouvert).color,
          getComputedStyle(ouvert).backgroundColor,
        ),
        contrasteDuNomFerme: ratio(
          getComputedStyle(ferme.querySelector("a")).color,
          getComputedStyle(menu).backgroundColor,
        ),
      };
    })(),
    pagination: (() => {
      const p = g("#main-content p:has(.pagination)");
      const barre = g(".pagination");
      const apres = p.nextElementSibling;
      return {
        hauteurDuP: Math.round(p.getBoundingClientRect().height),
        hauteurDeLaBarre: Math.round(barre.getBoundingClientRect().height),
        //  L'AIR QU'ELLE VOYAIT : du bas de la barre au bloc suivant.
        air: Math.round(
          apres.getBoundingClientRect().top - barre.getBoundingClientRect().bottom,
        ),
      };
    })(),
    deborde: [...document.querySelectorAll("#modernbb *")]
      .filter((e) =>
        e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      ).length,
  };
});

console.log("\n── un dossier qui a des messages ──");
//  150 px de ligne pour deux lignes de texte, relevé le 13 novembre.
ok(
  "la ligne a la hauteur de ce qu'elle contient",
  vu.plein.hauteurLigne < 100,
  vu.plein,
);
ok(
  "trois colonnes, pas les quatre d'une liste de sujets",
  vu.plein.colonnes.split(" ").length === 3,
  vu.plein.colonnes,
);
//  Elle était à 864 px sur une ligne qui en fait 1120, soit à peu près
//  au milieu, pendant que son étiquette était tout à droite.
ok(
  "la case à cocher est à droite, sous son étiquette",
  vu.plein.caseGauche > vu.plein.milieu + 200,
  vu.plein,
);
ok(
  "la place vide de l'image de dossier a disparu",
  vu.plein.divVide === 0,
  vu.plein.divVide,
);

console.log("\n── et le même, sans JavaScript ──");
//  SANS PASTILLE, LA PREMIÈRE COLONNE EST LIBRE : c'est là que la case
//  à cocher irait se placer toute seule si son aire n'était pas nommée.
ok(
  "la case reste à droite même sans pastille",
  vu.sansScript.caseGauche > vu.sansScript.milieu + 200,
  vu.sansScript,
);
ok(
  "et le titre reste dans la colonne de l'identité",
  Math.abs(vu.sansScript.titreGauche - vu.plein.titreGauche) < 14,
  { sansScript: vu.sansScript.titreGauche, plein: vu.plein.titreGauche },
);

console.log("\n── et un dossier vide ──");
//  LE DÉFAUT PRINCIPAL : un mot par ligne dans douze pixels.
ok(
  "le message tient sur une ligne",
  vu.vide.lignesDeTexte === 1,
  vu.vide,
);
ok(
  "il dispose de la largeur de la liste",
  vu.vide.largeurTexte > 200,
  vu.vide,
);
ok(
  "et il ne déborde plus au-dessus de sa ligne",
  vu.vide.debordeEnHaut <= 0,
  vu.vide,
);

console.log("\n── l'en-tête tombe en face de ce qu'il annonce ──");
ok(
  "il tient sur une ligne",
  vu.tete.hauteur < 50,
  vu.tete,
);
ok(
  "« Sujet » est au-dessus des sujets",
  Math.abs(vu.tete.sujetGauche - vu.plein.titreGauche) < 14,
  { tete: vu.tete.sujetGauche, titre: vu.plein.titreGauche },
);
ok(
  "et « Sélectionner » au-dessus des cases",
  Math.abs(vu.tete.selectionnerDroite - vu.plein.caseDroite) < 14,
  { tete: vu.tete.selectionnerDroite, case: vu.plein.caseDroite },
);

console.log("\n── le dernier bleu de ModernBB ──");
ok(
  "le bouton rond n'est plus bleu",
  vu.bouton !== "rgb(55, 147, 255)",
  vu.bouton,
);

console.log("\n── les onglets de dossier ──");
//  LE DÉFAUT QUE J'AVAIS INTRODUIT : un fond opaque sur un calque posé
//  PAR-DESSUS le nom du dossier ouvert. L'onglet devenait un rectangle
//  blanc et vide.
ok(
  "le calque ne peint rien par-dessus le nom",
  vu.onglets.calqueTransparent,
  vu.onglets,
);
ok(
  "le dossier ouvert a son fond, derrière son nom",
  vu.onglets.ouvertADuFond,
  vu.onglets,
);
//  LA BARRE PORTE LE BLANC, ET LES ONGLETS FERMÉS NE PEIGNENT RIEN :
//  c'est le blanc de la barre qu'on voit à travers eux. Comparer leurs
//  deux fonds calculés dirait le contraire — un `li` transparent
//  au-dessus d'une barre blanche EST blanc.
ok(
  "la barre est blanche de base",
  vu.onglets.fondDeLaBarre === vu.onglets.surface &&
    vu.onglets.fermeNePeintRien,
  { barre: vu.onglets.fondDeLaBarre, ferme: vu.onglets.fondDuDossierFerme },
);
ok(
  "ET L'ONGLET OUVERT SE PEINT DESSUS",
  vu.onglets.fondDuDossierOuvert !== vu.onglets.fondDeLaBarre,
  { ouvert: vu.onglets.fondDuDossierOuvert, barre: vu.onglets.fondDeLaBarre },
);
ok(
  "son nom se lit sur ce fond",
  vu.onglets.contrasteDuNomOuvert >= 4.5,
  vu.onglets.contrasteDuNomOuvert,
);
ok(
  "et les trois autres se lisent sur le blanc",
  vu.onglets.contrasteDuNomFerme >= 4.5,
  vu.onglets.contrasteDuNomFerme,
);
ok(
  "les liens se lisent plus pâles que le dossier ouvert",
  vu.onglets.couleurLien !== vu.onglets.couleurOuvert,
  vu.onglets,
);

console.log("\n── la pagination ──");
//  « La pagination est trop collée. » Le `p` faisait 18 px, la barre
//  qu'il contient 32 : les 14 de débord mangeaient sa marge, et il
//  restait quatre pixels avant la rangée de boutons.
ok(
  "le paragraphe a la hauteur de la barre qu'il porte",
  vu.pagination.hauteurDuP >= vu.pagination.hauteurDeLaBarre,
  vu.pagination,
);
ok(
  "et il reste de l'air avant ce qui suit",
  vu.pagination.air >= 16,
  vu.pagination,
);

console.log("\n── et la liste d'un forum ne bouge pas ──");
//  L'AUTRE MOITIÉ DE LA DEMANDE, celle de la page de recherche :
//  « sans venir toucher aux catégories / liste des forums ».
ok(
  "elle garde ses quatre colonnes",
  vu.forum.colonnes.split(" ").length === 4,
  vu.forum.colonnes,
);
ok(
  "son en-tête n'est pas passé en grille",
  vu.forum.teteAffichage !== "grid",
  vu.forum.teteAffichage,
);
ok(
  "et ses lignes gardent leur hauteur",
  vu.forum.hauteurLigne >= 92,
  vu.forum.hauteurLigne,
);

console.log("\n── la page tient ──");
ok("rien ne déborde à 1384", vu.deborde === 0, vu.deborde);
for (const largeur of [1100, 740, 390]) {
  await p.setViewportSize({ width: largeur, height: 1200 });
  await p.waitForTimeout(80);
  const trop = await p.evaluate(() =>
    [...document.querySelectorAll("#modernbb *")]
      .filter((e) =>
        e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      ).map((e) => e.className).slice(0, 3)
  );
  ok(`rien ne déborde à ${largeur}`, trop.length === 0, trop);
}
await p.setViewportSize({ width: 1384, height: 1200 });

// ════════════════════════════════════════════════════════════════════
//  ── LA JAUGE DE QUOTA, SUR UNE PAGE À PART ─────────────────────────
//
//  Elle est posée par `module-messagerie`, donc il faut le PAQUET —
//  et le paquet réécrit la barre de navigation, guette l'éditeur et
//  cherche des données. Sur la page des vingt-neuf contrôles
//  ci-dessus, il changerait ce qu'ils mesurent.
//
//  Une seconde page, donc, avec le seul panneau de quota, et le
//  paquet dessus. La phrase est celle relevée le 13 novembre, mot pour
//  mot, dans `p.left-box` ; la boîte vide est l'autre cas réel, relevé
//  le même jour sur `?folder=inbox`.
// ════════════════════════════════════════════════════════════════════
{
  const panneau = (phrase) => `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Messages privés</title>
<link rel="stylesheet" href="/jetons.css"><link rel="stylesheet" href="/wild-mystery.css">
</head><body><div id="modernbb"><div class="wrap"><div id="main-content">
<form>
  <div class="panel"><div class="inner">
    <span class="corners-top"><span></span></span>
    <p class="left-box">${phrase}</p>
    <p class="right-box">Montrer les messages depuis :</p>
    <div class="clear"></div>
    <span class="corners-bottom"><span></span></span>
  </div></div>
</form>
</div></div></div></body></html>`;

  const mesurerLaJauge = async (phrase, deuxFois = false) => {
    const q = await nav.newPage({ viewport: { width: 1384, height: 600 } });
    await q.route("**/*", (r) => {
      const u = new URL(r.request().url()).pathname;
      if (u === "/jetons.css") {
        return r.fulfill({ contentType: "text/css", body: lire("panneau-admin/jetons.css") });
      }
      if (u === "/wild-mystery.css") {
        return r.fulfill({ contentType: "text/css", body: lire("css/wild-mystery.css") });
      }
      if (u === "/js/wild-mystery.js") {
        return r.fulfill({
          contentType: "text/javascript",
          body: lire("js/wild-mystery.js"),
        });
      }
      if (u.startsWith("/data/")) {
        try {
          return r.fulfill({ contentType: "application/json", body: lire(u.slice(1)) });
        } catch {
          return r.fulfill({ status: 404, body: "" });
        }
      }
      return r.fulfill({ contentType: "text/html; charset=utf-8", body: panneau(phrase) });
    });
    await q.goto("http://wild-mystery.test/privmsg?folder=sentbox");
    await q.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
    await q.waitForTimeout(250);
    //  LE PAQUET QUI REPASSE. Ce n'est pas une hypothèse : une page
    //  qui se recharge en partie, ou un second passage du script,
    //  poserait une deuxième jauge sous la première. C'est le seul cas
    //  qui rend la garde d'idempotence autre chose qu'une décoration.
    if (deuxFois) {
      await q.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
      await q.waitForTimeout(250);
    }
    const vuJauge = await q.evaluate(() => {
      const g = document.querySelector(".wm-pm-quota");
      const phraseEl = document.querySelector(".panel p.left-box");
      if (g === null) return { posee: false, phraseEncoreLa: phraseEl !== null };
      const part = g.querySelector(".wm-pm-quota__part");
      return {
        posee: true,
        phraseEncoreLa: phraseEl !== null,
        //  La phrase doit rester AU-DESSUS : c'est elle qui nomme la
        //  boîte, la barre ne fait que mesurer.
        sousLaPhrase: g.getBoundingClientRect().top >=
          phraseEl.getBoundingClientRect().bottom,
        largeurDeLaPart: Math.round(
          (part.getBoundingClientRect().width / g.getBoundingClientRect().width) * 100,
        ),
        styleEnLigne: part.getAttribute("style"),
        cachee: g.getAttribute("aria-hidden"),
        combien: document.querySelectorAll(".wm-pm-quota").length,
      };
    });
    await q.close();
    return vuJauge;
  };

  console.log("\n── la jauge de quota ──");
  const pleine = await mesurerLaJauge("Votre boîte des messages envoyés est pleine à 8%");
  ok("elle est posée quand la phrase porte un pourcentage", pleine.posee, pleine);
  ok(
    "et sa part vaut ce que la phrase annonce",
    pleine.largeurDeLaPart === 8,
    pleine,
  );
  ok("la phrase reste, et au-dessus", pleine.phraseEncoreLa && pleine.sousLaPhrase, pleine);
  //  ELLE NE RÉPÈTE RIEN À VOIX HAUTE : la phrase dit déjà tout, et de
  //  quelle boîte il s'agit.
  ok("la barre ne répète pas la phrase au lecteur d'écran", pleine.cachee === "true", pleine);
  ok("et il n'y en a qu'une", pleine.combien === 1, pleine);

  const deuxPassages = await mesurerLaJauge(
    "Votre boîte des messages envoyés est pleine à 8%",
    true,
  );
  ok(
    "ET LE PAQUET PEUT REPASSER SANS EN POSER UNE SECONDE",
    deuxPassages.combien === 1,
    deuxPassages,
  );

  //  LA BOÎTE VIDE : relevé le 13 novembre sur `?folder=inbox`. Pas de
  //  pourcentage, donc pas de jauge — une barre à zéro sur une boîte
  //  vide est du mobilier.
  const vide = await mesurerLaJauge("Votre boîte de réception est vide");
  ok("aucune jauge sur une boîte vide", !vide.posee, vide);
  ok("et la phrase y est toujours", vide.phraseEncoreLa, vide);
}

if (Deno.args.includes("--photo")) {
  for (const theme of ["clair", "sombre"]) {
    await p.evaluate(
      (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
      theme,
    );
    await p.waitForTimeout(80);
    await p.screenshot({ path: `${R}messagerie-${theme}.png` });
  }
  console.log("photos : messagerie-<thème>.png");
}

await p.close();
await nav.close();
console.log(soucis.length === 0 ? `\nTOUT PASSE (${passes}).` : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
