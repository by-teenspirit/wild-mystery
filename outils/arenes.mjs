// ════════════════════════════════════════════════════════════════════
//  outils/arenes.mjs — l'annexe 06 rendue, mesurée
//
//      deno task arenes
//
//  CE QUE LE GARDE-FOU NE PEUT PAS VOIR. Il relit `data/arenes.json` et
//  `data/equipes-de-champions.json`, il recalcule les chiffres, il
//  compte les paliers — et tout ça peut être juste pendant que la page
//  montre quatre onglets qui en cachent onze, une infobulle qui sort du
//  cadre, ou six cases écrasées à cinquante pixels.
//
//  TROIS CHOSES COMPTENT ICI, et aucune ne se lit dans un JSON :
//
//  1. QUE LES SOUS-ONGLETS S'IMBRIQUENT. Le groupe du haut a quatre
//     boutons, pas quinze. C'est exactement le défaut du 5 novembre —
//     `querySelectorAll` ramassait toute la descendance et le groupe du
//     dessus posait des boutons qui cachaient la page entière.
//
//  2. QUE L'INFOBULLE RESTE DANS LE CADRE. Elle est posée contre la
//     LISTE, bornée au `clamp`, et le calcul se trompe sans rien
//     casser : mesuré à 19 px dehors sur la carte dresseur le jour où
//     elle était posée contre la case.
//
//  3. QUE LE PLUS FORT PORTE LE NIVEAU DU DÉFI. « Niveau de l'arène =
//     celui du pokémon le plus fort : oui » (6 novembre). C'est écrit
//     sur les cases : on le relit là où le lecteur le lit.
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";

const R = new URL("..", import.meta.url).pathname;
const lire = (c) => readFileSync(R + c, "utf8");
const PAGE = lire("pages/annexe-06-arenes-colosseums-ligues.html");
const ARENES = JSON.parse(lire("data/arenes.json"));
const EQUIPES = JSON.parse(lire("data/equipes-de-champions.json")).equipes;

//  UNE VRAIE IMAGE DU DÉPÔT, et pas un PNG inventé en base64. Le
//  premier essai servait seize lignes de base64 écrites à la main :
//  Chromium ne les décodait pas, `naturalWidth` restait à zéro, et les
//  soixante-six cases ET les onze badges étaient déclarés absents. Une
//  image qu'on ne peut pas relire n'est pas une mesure.
//
//  Le badge Feu fait l'affaire : il est dans le dépôt, il se décode, et
//  il a la taille d'un sprite. On ne sert pas les VRAIES images des
//  pokémon — soixante-six requêtes vers GitHub par essai — et on ne
//  prétend donc pas qu'elles existent : c'est la règle 25 du garde-fou
//  qui vérifie que les 955 espèces en ont une, et ici qu'une adresse
//  est bien posée et que la case s'aligne sur sa voisine.
const SPRITE = readFileSync(R + "img/badges/feu.png");

let fautes = 0;
function ok(quoi, vrai, detail) {
  if (vrai) console.log(`  ok   ${quoi}`);
  else {
    fautes++;
    console.log(`  DÉFAUT ${quoi} — ${JSON.stringify(detail)}`);
  }
}

async function ouvrir(nav, { largeur = 1440 } = {}) {
  const p = await nav.newPage({ viewport: { width: largeur, height: 1200 } });
  p.on("pageerror", (e) => {
    fautes++;
    console.log(`  DÉFAUT erreur JS — ${e.message}`);
  });
  await p.route("**/*", (q) => {
    const u = q.request().url();
    const f = (t, b) => q.fulfill({ contentType: t, body: b });
    if (/annexe-06/.test(u)) return f("text/html; charset=utf-8", PAGE);
    if (/jetons\.css$/.test(u)) return f("text/css", lire("panneau-admin/jetons.css"));
    if (/wild-mystery\.css$/.test(u)) return f("text/css", lire("css/wild-mystery.css"));
    if (/\/js\/annexes\.js$/.test(u)) return f("text/javascript", lire("js/annexes.js"));
    if (/\.(png|gif|jpe?g)$/.test(new URL(u).pathname)) {
      return q.fulfill({ contentType: "image/png", body: SPRITE });
    }
    if (/\/data\/([a-z-]+)\.json$/.test(u)) {
      try {
        return f(
          "application/json",
          lire(`data/${/\/data\/([a-z-]+)\.json$/.exec(u)[1]}.json`),
        );
      } catch {
        return q.fulfill({ status: 404, body: "" });
      }
    }
    return q.fulfill({ status: 404, body: "" });
  });
  await p.goto("https://exemple.test/annexe-06", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".wm-sous-onglets--posee", { timeout: 15000 });
  await new Promise((x) => setTimeout(x, 400));
  return p;
}

/** Les boutons d'un groupe de sous-onglets, et de lui seul. */
const boutonsDuGroupe = (selecteur) =>
  Array.from(document.querySelectorAll(selecteur))
    .map((g) => {
      const barre = g.querySelector(":scope > .wm-sous-onglets__barre");
      return barre === null
        ? null
        : Array.from(barre.querySelectorAll(":scope > .wm-onglet")).map((b) =>
          b.textContent.trim()
        );
    })
    .filter((x) => x !== null);

const nav = await chromium.launch(
  Deno.env.get("CHROME") === undefined ? {} : { executablePath: Deno.env.get("CHROME") },
);

// ── 1440 ────────────────────────────────────────────────────────────
{
  const p = await ouvrir(nav);

  // ── les quatre onglets du haut, et PAS un de plus ─────────────────
  const groupes = await p.evaluate(boutonsDuGroupe, ".wm-annexe__carte.wm-sous-onglets");
  ok("un seul groupe d'onglets en tête", groupes.length === 1, groupes);
  const tete = groupes[0] ?? [];
  ok("quatre onglets en tête, pas quinze", tete.length === 4, tete);
  ok(
    "le dernier onglet est la Ligue",
    tete[3] === ARENES.textes.ligue.titre,
    { lu: tete[3], attendu: ARENES.textes.ligue.titre },
  );

  // ── les deux groupes imbriqués ────────────────────────────────────
  const imbriques = await p.evaluate(boutonsDuGroupe, ".wm-defis.wm-sous-onglets");
  ok("deux groupes imbriqués", imbriques.length === 2, imbriques.map((g) => g.length));
  const sept = ARENES.arenes.filter((a) => a.genre === "arene");
  const quatre = ARENES.arenes.filter((a) => a.genre === "colosseum");
  ok("sept sous-onglets d'arène", imbriques[0]?.length === sept.length, imbriques[0]);
  ok("quatre sous-onglets de colosseum", imbriques[1]?.length === quatre.length, imbriques[1]);
  //  L'ORDRE EST CELUI DES NIVEAUX, pas celui du tableau : c'est la
  //  décision du 6 novembre, et elle se vérifie sur les boutons.
  ok(
    "les arènes sont dans l'ordre des niveaux",
    JSON.stringify(imbriques[0]) ===
      JSON.stringify([...sept].sort((x, y) => x.niveau - y.niveau).map((a) => a.nom)),
    imbriques[0],
  );
  //  ── LE BADGE EST MONTÉ SUR LE BOUTON ───────────────────────────
  //
  //  « Dans chaque onglet, tu affiches le badge » (6 novembre). Le
  //  module recopie l'image de la tête de section ; il ne cherchait
  //  que des SVG jusqu'à aujourd'hui, et un badge est un png. Si la
  //  recherche se referme sur les SVG, les onze boutons perdent leur
  //  badge sans que rien d'autre ne bouge.
  const badgesSurLesOnglets = await p.evaluate(() =>
    Array.from(document.querySelectorAll(".wm-defis > .wm-sous-onglets__barre"))
      .flatMap((b) => Array.from(b.querySelectorAll(":scope > .wm-onglet")))
      .map((b) => b.querySelector(":scope > img") !== null)
  );
  ok(
    "les onze boutons de défi portent leur badge",
    badgesSurLesOnglets.length === 11 && badgesSurLesOnglets.every(Boolean),
    badgesSurLesOnglets,
  );

  ok(
    "les colosseums sont dans l'ordre des niveaux",
    JSON.stringify(imbriques[1]) ===
      JSON.stringify([...quatre].sort((x, y) => x.niveau - y.niveau).map((a) => a.nom)),
    imbriques[1],
  );

  // ── les trois paliers de l'onglet de présentation ─────────────────
  const paliers = await p.evaluate(() =>
    Array.from(document.querySelectorAll(".wm-palier")).map((l) => ({
      titre: l.querySelector(".wm-palier__titre").textContent.trim(),
      defis: Array.from(l.querySelectorAll(".wm-palier__defi a")).map((a) =>
        a.textContent.trim()
      ),
      vide: l.querySelector(".wm-palier__defis--vide") !== null,
    }))
  );
  ok("trois paliers", paliers.length === 3, paliers.map((x) => x.titre));
  //  LES TROIS PALIERS PORTENT DES DÉFIS, depuis les listes du
  //  8 novembre : 4 / 4 / 3. Le palier 3 était vide jusque-là, et ce
  //  harnais exigeait encore qu'il le soit — une attente qui avait
  //  survécu à la donnée qu'elle décrivait.
  for (const n of [1, 2, 3]) {
    const attendu = ARENES.arenes.filter((a) => a.palier === n).length;
    ok(
      `palier ${n} : ${attendu} défis listés`,
      attendu > 0 && paliers[n - 1]?.defis.length === attendu &&
        paliers[n - 1]?.vide === false,
      { lu: paliers[n - 1]?.defis, attendu, vide: paliers[n - 1]?.vide },
    );
  }

  // ── chaque défi, ouvert, mesuré ───────────────────────────────────
  const defis = [...ARENES.arenes].sort((a, b) => a.niveau - b.niveau);
  const soucis = [];
  for (const a of defis) {
    //  On ouvre l'onglet du genre, puis celui du défi. Sans le premier
    //  clic, les sections d'un groupe caché mesurent zéro — et zéro
    //  passe toutes les comparaisons « ça tient dans le cadre ».
    const genre = a.genre === "arene"
      ? ARENES.textes.arenes.titre
      : ARENES.textes.colosseums.titre;
    await p.getByRole("tab", { name: genre, exact: true }).click();
    await p.getByRole("tab", { name: a.nom, exact: true }).click();
    await new Promise((x) => setTimeout(x, 120));

    const vu = await p.evaluate((nom) => {
      //  `offsetParent !== null` ET PAS `!s.hidden`. Deux groupes de
      //  sous-onglets sont imbriqués : celui des colosseums garde une
      //  section ouverte pendant que le groupe entier est caché. Avec
      //  `!hidden`, on ramassait cette section-là aussi, et elle
      //  mesure zéro — or zéro passe toutes les comparaisons « ça tient
      //  dans le cadre ». Le défaut exact que ce harnais doit attraper.
      const section = Array.from(document.querySelectorAll(".wm-defi")).find((s) =>
        s.querySelector(".wm-defi__titre")?.textContent.trim() === nom &&
        s.offsetParent !== null
      );
      if (section === undefined) return null;
      const liste = section.querySelector(".wm-equipe");
      const cases = Array.from(section.querySelectorAll(".wm-equipe__pkmn"));
      const cadre = liste.getBoundingClientRect();
      return {
        hauteur: Math.round(cadre.height),
        cases: cases.length,
        niveaux: cases.map((c) =>
          Number(c.querySelector(".wm-equipe__niveau").textContent.replace(/\D+/g, ""))
        ),
        sprites: cases.filter((c) => {
          const i = c.querySelector("img.wm-equipe__sprite");
          return i !== null && i.naturalWidth > 0;
        }).length,
        //  LA HAUTEUR DES CASES, toutes égales : une case sans sprite
        //  plus courte que ses voisines décale la rangée.
        hauteurs: [...new Set(cases.map((c) => Math.round(c.getBoundingClientRect().height)))],
        //  LA BOÎTE DU SPRITE EST FIXE ET L'IMAGE SE POSE EN BAS : six
        //  boîtes de hauteurs différentes, et les six noms ne sont plus
        //  sur la même ligne. On mesure la boîte, pas l'encre — c'est
        //  `object-fit` qui place l'encre dedans.
        boitesDeSprite: [
          ...new Set(cases.map((c) => {
            const i = c.querySelector(".wm-equipe__sprite");
            return i === null ? -1 : Math.round(i.getBoundingClientRect().height);
          })),
        ],
        //  LE BADGE EST L'IMAGE DU TITRE depuis le 6 novembre — c'est
        //  ce qui le met aussi sur le bouton d'onglet. Chercher
        //  « .wm-defi__badge img » revenait à chercher une image dans
        //  une image.
        badge: (() => {
          const i = section.querySelector("h3 > img.wm-defi__badge");
          return i !== null && i.naturalWidth > 0;
        })(),
        typeArene: section.querySelector(".wm-defi__fait dd .wm-type")?.dataset.wmType ?? null,
        conseil: Array.from(
          section.querySelectorAll(".wm-defi__fait:nth-of-type(2) dd .wm-type"),
        ).map((t) => t.dataset.wmType),
        defier: section.querySelector(".wm-defi__liens a")?.getAttribute("href") ?? null,
        prelien: section.querySelectorAll(".wm-defi__liens a")[1]?.getAttribute("href") ?? null,
        debord: section.scrollWidth > Math.ceil(section.getBoundingClientRect().width) + 1,
      };
    }, a.nom);

    if (vu === null) {
      soucis.push(`${a.nom} : section introuvable ou cachée`);
      continue;
    }
    const eq = EQUIPES[a.slug];
    if (vu.cases !== 6) soucis.push(`${a.nom} : ${vu.cases} cases`);
    if (vu.hauteur === 0) soucis.push(`${a.nom} : liste de hauteur nulle`);
    if (vu.sprites !== 6) soucis.push(`${a.nom} : ${vu.sprites}/6 sprites`);
    if (!vu.badge) soucis.push(`${a.nom} : pas de badge`);
    if (vu.hauteurs.length !== 1) soucis.push(`${a.nom} : cases inégales ${vu.hauteurs}`);
    if (vu.boitesDeSprite.length !== 1) {
      soucis.push(`${a.nom} : boîtes de sprite inégales ${vu.boitesDeSprite}`);
    }
    if (vu.typeArene !== a.type) soucis.push(`${a.nom} : type « ${vu.typeArene} »`);
    if (JSON.stringify(vu.conseil) !== JSON.stringify(eq.conseil.types)) {
      soucis.push(`${a.nom} : conseil ${vu.conseil} au lieu de ${eq.conseil.types}`);
    }
    if (vu.defier !== `https://mysteryinrhode.forumactif.com${a.forum}`) {
      soucis.push(`${a.nom} : « défier » mène à ${vu.defier}`);
    }
    if (!String(vu.prelien).endsWith(`#${eq.message}`)) {
      soucis.push(`${a.nom} : pré-lien ${vu.prelien} au lieu de #${eq.message}`);
    }
    //  LE PLUS FORT PORTE LE NIVEAU DU DÉFI, et l'étagement est 2-2-2.
    if (Math.max(...vu.niveaux) !== a.niveau) {
      soucis.push(`${a.nom} : plus fort au niveau ${Math.max(...vu.niveaux)} pour ${a.niveau}`);
    }
    if (
      JSON.stringify(vu.niveaux) !==
        JSON.stringify(eq.membres.map((m) => m.niveau))
    ) {
      soucis.push(`${a.nom} : niveaux ${vu.niveaux}`);
    }
    if (vu.debord) soucis.push(`${a.nom} : la section déborde`);
  }
  ok(
    `les ${defis.length} défis : cases, badge, types, liens, niveaux`,
    soucis.length === 0,
    soucis,
  );

  //  ── L'AIR SOUS LA BARRE D'ONGLETS ────────────────────────────────
  //
  //  « Ajoute un padding dans les arènes entre les onglets et la
  //  description » (10 nov.). La barre a sa marge, mais le 9 novembre
  //  on a réduit le rembourrage des onglets pour les faire tenir sur
  //  une ligne — et un bouton moins haut rapproche tout ce qui suit.
  //  Le contrôle mesure l'écart RENDU, pas la marge déclarée.
  const airSousLaBarre = await p.evaluate(() => {
    const g = Array.from(document.querySelectorAll(".wm-sous-onglets"))
      .find((x) => x.querySelector(".wm-defi") !== null && x.offsetParent !== null);
    const barre = g.querySelector(".wm-sous-onglets__barre");
    const section = Array.from(g.querySelectorAll(".wm-defi"))
      .find((s) => s.offsetParent !== null);
    return Math.round(
      section.getBoundingClientRect().top - barre.getBoundingClientRect().bottom,
    );
  });
  ok(
    "la barre d'onglets garde son air avant la section",
    airSousLaBarre >= 32,
    `${airSousLaBarre} px sous la barre`,
  );

  //  ── LES TROIS OBSCURS, ET LA BULLE QUI SUIT LA CASE ──────────────
  //
  //  « Oui, dragon, ténèbres et elec », le dernier de chaque équipe
  //  (10 nov.). Ici la bulle est montée par `module-equipe.ts`, qui
  //  lit la classe de la case : le contrôle vérifie donc les DEUX
  //  bouts de la chaîne, le générateur Python et le module.
  const obscurs = await p.evaluate(() => {
    const cases = Array.from(document.querySelectorAll(".wm-equipe__pkmn"));
    const marquees = cases.filter((c) =>
      c.classList.contains("wm-equipe__pkmn--obscur")
    );
    return {
      cases: cases.length,
      marquees: marquees.length,
      leMot: marquees.every((c) =>
        c.querySelector(".wm-equipe__obscur")?.textContent?.trim() === "Obscur"
      ),
      bulleViolette: marquees.every((c) =>
        c.querySelector(".wm-infobulle")?.classList
          .contains("wm-infobulle--obscur") === true
      ),
    };
  });
  ok(
    "TROIS POKÉMON OBSCURS, chacun avec le mot et sa bulle violette",
    obscurs.marquees === 3 && obscurs.leMot && obscurs.bulleViolette,
    obscurs,
  );

  // ── l'infobulle : cachée, puis dans le cadre ──────────────────────
  await p.getByRole("tab", { name: ARENES.textes.arenes.titre, exact: true }).click();
  await new Promise((x) => setTimeout(x, 120));
  const avant = await p.evaluate(() => {
    const vue = Array.from(document.querySelectorAll(".wm-defi")).find((s) =>
      s.offsetParent !== null
    );
    const b = vue.querySelector(".wm-equipe__pkmn .wm-infobulle");
    const s = getComputedStyle(b);
    return { visibilite: s.visibility, opacite: s.opacity };
  });
  ok("l'infobulle est cachée au repos", avant.visibilite === "hidden", avant);

  //  ── LA BULLE VIENT DU SCRIPT, PAS DE LA PAGE ──────────────────────
  //
  //  Depuis le 9 novembre la page ne porte que `data-wm-bulle` ; c'est
  //  `module-equipe.ts` qui construit la balise. Les deux moitiés de
  //  cette phrase se vérifient : rien dans le HTML collé, tout dans le
  //  DOM affiché. Si quelqu'un remet la bulle dans le générateur, la
  //  page repasse au-dessus des 128 000 caractères de Forumactif sans
  //  que rien ne le dise — sauf ici.
  ok(
    "aucune infobulle dans la page collée, seulement ses données",
    !/wm-infobulle/.test(PAGE) && /data-wm-bulle="/.test(PAGE),
    {
      bullesEcrites: (PAGE.match(/wm-infobulle/g) ?? []).length,
      donneesEcrites: (PAGE.match(/data-wm-bulle="/g) ?? []).length,
      caracteres: PAGE.length,
    },
  );
  const construites = await p.evaluate(() => ({
    cases: document.querySelectorAll("[data-wm-bulle]").length,
    bulles: document.querySelectorAll("[data-wm-bulle] .wm-infobulle").length,
  }));
  ok(
    "et le script en a posé une dans chaque case",
    construites.cases > 0 && construites.bulles === construites.cases,
    construites,
  );

  //  LES SIX CASES, UNE PAR UNE. La première et la dernière sont les
  //  seules qui peuvent sortir : c'est là que le `clamp` travaille.
  const bulles = [];
  for (let rang = 1; rang <= 6; rang++) {
    //  LA SECTION VISIBLE D'ABORD, SES CASES ENSUITE. Un sélecteur en
    //  une passe ramasse aussi les cases d'une section cachée par un
    //  ancêtre — deux groupes sont imbriqués, celui des colosseums
    //  garde une section ouverte sous un groupe caché — et les rangs
    //  glissent.
    const cible = p.locator(".wm-defi:visible").first()
      .locator(".wm-equipe__pkmn").nth(rang - 1);
    await cible.hover();
    await new Promise((x) => setTimeout(x, 180));
    bulles.push(
      await p.evaluate((n) => {
        const li = document.querySelectorAll(
          ".wm-defi:not([hidden]) .wm-equipe__pkmn",
        )[n - 1];
        const bulle = li.querySelector(".wm-infobulle");
        const liste = li.closest(".wm-equipe").getBoundingClientRect();
        const b = bulle.getBoundingClientRect();
        const c = li.getBoundingClientRect();
        return {
          rang: n,
          visible: getComputedStyle(bulle).visibility === "visible",
          dedansGauche: Math.round(b.left - liste.left),
          dedansDroite: Math.round(liste.right - b.right),
          auDessus: Math.round(c.top - b.bottom),
          niveau: bulle.querySelector(".wm-infobulle__niveau")?.textContent.trim() ?? null,
          //  LES TROIS LIGNES, chacune avec son mot et son nombre — et
          //  leur ALIGNEMENT, qui est tout l'intérêt de la colonne :
          //  trois nombres qui ne finissent pas au même endroit ne se
          //  comparent pas d'un pokémon à l'autre.
          chiffres: Array.from(bulle.querySelectorAll(".wm-infobulle__stat")).map(
            (l) => {
              const mot = l.querySelector("span:first-child");
              const val = l.querySelector("span:last-child");
              const sm = getComputedStyle(mot);
              const sv = getComputedStyle(val);
              return {
                mot: mot?.textContent.trim() ?? null,
                valeur: val?.textContent.trim() ?? null,
                droite: Math.round(val.getBoundingClientRect().right),
                //  LE BORD GAUCHE DE LA COLONNE, et pas seulement le
                //  droit : « 84 » au-dessus de « 112 » finissent au
                //  même pixel sans commencer dans la même colonne, et
                //  c'est le début du nombre que l'œil suit.
                gauche: Math.round(val.getBoundingClientRect().left),
                //  LE MOT EST AFFAIBLI, LE NOMBRE NON.
                opaciteMot: Number(sm.opacity),
                opaciteValeur: Number(sv.opacity),
                graisseValeur: Number(sv.fontWeight),
              };
            },
          ),
        };
      }, rang),
    );
  }
  ok("l'infobulle s'ouvre au survol des six cases", bulles.every((b) => b.visible), bulles);
  ok(
    "l'infobulle ne sort jamais de la liste",
    bulles.every((b) => b.dedansGauche >= -1 && b.dedansDroite >= -1),
    bulles.map((b) => [b.rang, b.dedansGauche, b.dedansDroite]),
  );
  ok(
    "l'infobulle est au-dessus de sa case",
    bulles.every((b) => b.auDessus >= 0),
    bulles.map((b) => [b.rang, b.auDessus]),
  );
  ok(
    "elle porte le niveau et les trois chiffres, l'un sous l'autre",
    bulles.every((b) =>
      /^Niv\. \d+$/.test(b.niveau) &&
      b.chiffres.length === 3 &&
      b.chiffres.every((c) => c.mot && /^\d+$/.test(c.valeur ?? ""))
    ),
    bulles.map((b) => [b.niveau, b.chiffres]),
  );
  ok(
    "les trois nombres finissent au même endroit",
    bulles.every((b) => new Set(b.chiffres.map((c) => c.droite)).size === 1),
    bulles.map((b) => b.chiffres.map((c) => c.droite)),
  );
  ok(
    "et ils commencent tous dans la même colonne",
    bulles.every((b) => new Set(b.chiffres.map((c) => c.gauche)).size === 1),
    bulles.map((b) => b.chiffres.map((c) => c.gauche)),
  );
  ok(
    "le mot est affaibli, le nombre est plein et gras",
    bulles.every((b) =>
      b.chiffres.every((c) =>
        c.opaciteMot > 0.7 && c.opaciteMot < 1 &&
        c.opaciteValeur === 1 && c.graisseValeur >= 700
      )
    ),
    bulles.map((b) => b.chiffres.map((c) => [c.opaciteMot, c.opaciteValeur, c.graisseValeur])),
  );

  //  ── LE MOT AFFAIBLI RESTE LISIBLE ────────────────────────────────
  //
  //  Un `opacity` n'est pas une couleur : aucun outil de contraste ne
  //  le voit, et c'est par là que la charte fuit. On remonte donc la
  //  couleur réellement peinte — le texte mélangé à son fond selon
  //  l'opacité — et on la mesure comme n'importe quelle autre.
  const lisibilite = await p.evaluate(() => {
    const lin = (c) => (c /= 255, c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const rgb = (t) => t.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const bulle = document.querySelector(".wm-infobulle");
    const fond = rgb(getComputedStyle(bulle).backgroundColor);
    const mot = bulle.querySelector(".wm-infobulle__stat > span:first-child");
    const st = getComputedStyle(mot);
    const o = Number(st.opacity);
    const t = rgb(st.color);
    const peint = t.map((v, i) => o * v + (1 - o) * fond[i]);
    const [hi, lo] = [lum(peint), lum(fond)].sort((a, b) => b - a);
    return { rapport: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, opacite: o };
  });
  ok(
    "le mot affaibli tient les 4,5 de la charte sur le fond de la bulle",
    lisibilite.rapport >= 4.5,
    lisibilite,
  );

  //  ── AUCUN SPRITE N'EST GROSSI ─────────────────────────────────
  //
  //  Un sprite affiché plus grand que sa taille réelle est flou : il
  //  n'a pas plus de pixels à montrer. Le harnais de la faune mesure
  //  déjà ça sur la grille des zones ; les cases d'équipe ne l'étaient
  //  pas, et `object-fit: contain` les grossissait d'un cinquième.
  //  ON MESURE LA RÈGLE, PAS LA BOÎTE — et c'est une leçon payée en
  //  écrivant ce contrôle. Avec `object-fit`, la boîte de l'`<img>`
  //  garde la taille que la feuille lui donne ; c'est l'image PEINTE
  //  qui rétrécit dedans, et aucune API ne la mesure. Comparer la
  //  boîte à la taille naturelle accusait donc une règle correcte.
  //
  //  Deux valeurs d'`object-fit` ne grossissent jamais : `scale-down`
  //  (le plus petit entre `none` et `contain`) et `none` (taille
  //  réelle). Les trois autres — `contain`, `cover`, `fill` —
  //  remplissent la boîte, donc grossissent dès qu'elle est plus
  //  grande que l'image. C'est cela qu'on interdit.
  const agrandis = await p.evaluate(() =>
    [...document.querySelectorAll(".wm-equipe__sprite")]
      .filter((i) => i.naturalWidth > 0)
      .map((i) => {
        const r = i.getBoundingClientRect();
        const fit = getComputedStyle(i).objectFit;
        const tientSansGrossir = fit === "scale-down" || fit === "none" ||
          (r.width <= i.naturalWidth + 0.5 && r.height <= i.naturalHeight + 0.5);
        return { n: `${i.naturalWidth}×${i.naturalHeight}`, fit, tientSansGrossir };
      })
      .filter((x) => !x.tientSansGrossir)
  );
  ok(
    "aucun sprite d'équipe n'est affiché plus grand que nature",
    agrandis.length === 0,
    agrandis.slice(0, 4),
  );

  const debord = await p.evaluate(() => ({
    page: document.documentElement.scrollWidth > window.innerWidth + 1,
    largeur: document.documentElement.scrollWidth,
    vue: window.innerWidth,
  }));
  ok("la page ne déborde pas à 1440", !debord.page, debord);
  await p.close();
}

// ── 390, le téléphone ───────────────────────────────────────────────
{
  const p = await ouvrir(nav, { largeur: 390 });
  await p.getByRole("tab", { name: ARENES.textes.arenes.titre, exact: true }).click();
  await new Promise((x) => setTimeout(x, 200));
  const petit = await p.evaluate(() => {
    const vue = Array.from(document.querySelectorAll(".wm-defi")).find((s) =>
      s.offsetParent !== null
    );
    const liste = vue.querySelector(".wm-equipe");
    const cases = Array.from(liste.querySelectorAll(".wm-equipe__pkmn"));
    const cadre = liste.getBoundingClientRect();
    //  COMBIEN DE CASES PAR RANGÉE : on compte les `top` distincts.
    const rangees = new Set(cases.map((c) => Math.round(c.getBoundingClientRect().top)));
    return {
      debord: document.documentElement.scrollWidth > window.innerWidth + 1,
      rangees: rangees.size,
      parRangee: cases.length / rangees.size,
      plusEtroite: Math.min(...cases.map((c) => Math.round(c.getBoundingClientRect().width))),
      dansLeCadre: cases.every((c) => {
        const b = c.getBoundingClientRect();
        return b.left >= cadre.left - 1 && b.right <= cadre.right + 1;
      }),
      lignesMax: Math.max(...cases.map((c) => {
        const n = c.querySelector(".wm-equipe__nom");
        return Math.round(
          n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight),
        );
      })),
      debordInterne: cases.some((c) =>
        c.scrollWidth > Math.ceil(c.getBoundingClientRect().width) + 1
      ),
    };
  });
  ok("la page ne déborde pas à 390", !petit.debord, petit);
  //  TROIS PAR RANGÉE, DONC DEUX RANGÉES. Et ce n'est pas acquis : la
  //  case est en `border-box` depuis le 6 novembre, parce qu'en
  //  `content-box` — le défaut de ModernBB — son rembourrage
  //  s'ajoutait à la base flex et il n'en tenait que deux.
  ok("les six cases passent sur deux rangées", petit.rangees === 2, petit);
  ok("les cases restent dans la liste", petit.dansLeCadre, petit);
  //  UN SPRITE D'ULTRA-LUNE FAIT JUSQU'À 68 PX. En dessous, la case le
  //  rétrécit et le nom passe sur trois lignes.
  ok("aucune case sous 68 px", petit.plusEtroite >= 68, petit);
  //  LE NOM TIENT SUR DEUX LIGNES AU PLUS, y compris « Sablaireau
  //  d'Alola », qui est le plus long des soixante-six.
  ok("aucun nom sur plus de deux lignes", petit.lignesMax <= 2, petit);
  ok("rien ne déborde d'une case", !petit.debordInterne, petit);
  await p.close();
}

// ── 1440 · LES DOUBLES TYPES TIENNENT SUR UNE LIGNE ─────────────────
//
//  « Fais-les plus petits pour que les doubles types tiennent sur une
//  seule ligne » (9 novembre). Le réglage qui le permet est serré :
//  9 px de texte, point de 8, rembourrage de 4, et quatre pixels de
//  marge sur la pire paire — Ténèbres + Spectre.
//
//  QUATRE PIXELS NE SURVIVENT PAS À UNE DISTRACTION. Remonter le
//  texte d'un pixel, rendre deux pixels de rembourrage à une case, et
//  trois cases se replient sans que rien ne le signale. On mesure
//  donc la MARGE, pas seulement le repli : savoir qu'il en reste
//  quatre vaut mieux qu'apprendre qu'il n'en reste plus.
{
  const p = await ouvrir(nav);
  const m = await p.evaluate(() => {
    //  Les équipes vivent dans des panneaux d'onglets fermés ; on les
    //  ouvre tous, sinon on ne mesure que la première arène.
    for (const e of document.querySelectorAll("[hidden]")) e.hidden = false;
    const pires = [];
    for (const c of document.querySelectorAll(".wm-equipe__pkmn")) {
      const ps = [...c.querySelectorAll(".wm-equipe__types .wm-type")];
      if (ps.length < 2 || c.getBoundingClientRect().width === 0) continue;
      const s = getComputedStyle(c);
      const dispo = c.getBoundingClientRect().width -
        parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) -
        parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth);
      const large = ps.reduce((a, t) => a + t.getBoundingClientRect().width, 0) +
        parseFloat(getComputedStyle(ps[0].parentElement).gap || "0");
      pires.push({
        pkmn: c.querySelector(".wm-equipe__nom")?.textContent.trim(),
        paire: ps.map((t) => t.dataset.wmType).join("+"),
        marge: Math.round(dispo - large),
        lignes: new Set(ps.map((t) => Math.round(t.getBoundingClientRect().top))).size,
      });
    }
    pires.sort((a, b) => a.marge - b.marge);
    return {
      combien: pires.length,
      pire: pires[0] ?? null,
      replies: pires.filter((x) => x.lignes > 1).map((x) => `${x.paire} (${x.pkmn})`),
    };
  });
  ok(
    `les ${m.combien} doubles types de l'annexe tiennent sur UNE ligne`,
    m.combien > 0 && m.replies.length === 0,
    JSON.stringify(m.replies.slice(0, 5)),
  );
  ok(
    "et la paire la plus large garde au moins 3 px de marge",
    m.pire !== null && m.pire.marge >= 3,
    JSON.stringify(m.pire),
  );

  //  ── CHAQUE BARRE D'ONGLETS TIENT SUR UNE LIGNE ──────────────────
  //
  //  « Fais en sorte que les onglets des arènes dans l'annexe
  //  tiennent sur une seule ligne. » Les sept onglets d'arène
  //  demandaient 896 px dans une barre de 832, et la deuxième ligne
  //  ne portait qu'un bouton.
  //
  //  ON MESURE TOUTES LES BARRES, pas seulement celle des arènes :
  //  le réglage est commun, et le jour où un colosseum ou une maison
  //  s'ajoute, c'est une autre barre qui débordera la première.
  const barres = await p.evaluate(() => {
    for (const e of document.querySelectorAll("[hidden]")) e.hidden = false;
    return [...document.querySelectorAll(".wm-sous-onglets__barre")]
      .filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => {
        const bs = [...b.children];
        const g = parseFloat(getComputedStyle(b).gap || "0");
        return {
          premier: bs[0]?.textContent.trim() ?? "?",
          combien: bs.length,
          lignes: new Set(bs.map((x) => Math.round(x.getBoundingClientRect().top))).size,
          marge: Math.round(
            b.getBoundingClientRect().width -
              (bs.reduce((a, x) => a + x.getBoundingClientRect().width, 0) + (bs.length - 1) * g),
          ),
        };
      });
  });
  ok(
    `les ${barres.length} barres d'onglets tiennent chacune sur une ligne`,
    barres.length >= 3 && barres.every((x) => x.lignes === 1),
    JSON.stringify(barres.filter((x) => x.lignes > 1)),
  );
  //  DIX PIXELS DE MARGE AU MINIMUM. En dessous, un libellé rallongé
  //  d'un caractère renvoie la barre sur deux lignes, et c'est le
  //  genre de régression qu'on ne voit qu'en rouvrant la page.
  ok(
    "avec au moins 10 px de marge sur la plus chargée",
    barres.every((x) => x.marge >= 10),
    JSON.stringify(barres.slice().sort((a, b) => a.marge - b.marge)[0]),
  );
  await p.close();
}

// ── LA LIGUE, ET SON ÉQUIPE ───────────────────────────────────────
//
//  Elle n'est pas une arène : pas de badge, pas de type, pas de case
//  dans la grille de la carte dresseur. Elle a en revanche CINQ
//  équipes depuis le 9 novembre — le Conseil 4 et le champion —
//  relevées sur le deuxième message de `t100`, qui est devenu
//  lisible sans connexion.
//
//  CE QU'ON VÉRIFIE, ET QUI NE SE VOIT PAS À L'ŒIL : que le plus fort
//  de son équipe est AU niveau du défi. C'est la règle des onze
//  autres — le défi dragon est à 70 et son équipe monte à 70 — et
//  c'est tout ce qui rattache « niveau 80 » à six pokémon écrits à la
//  main dans le relevé.
{
  const p = await ouvrir(nav);

  const eq = EQUIPES.ligue;
  ok("la Ligue a une équipe dans les données", eq !== undefined, Object.keys(EQUIPES));

  const vu = await p.evaluate(() => {
    const s = document.querySelector('[data-wm-sous-onglet="la-ligue"]');
    if (s === null) return null;
    const cases = [...s.querySelectorAll(".wm-equipe__pkmn")];
    return {
      cases: cases.length,
      noms: cases.map((c) => c.querySelector(".wm-equipe__nom").textContent.trim()),
      niveaux: cases.map((c) =>
        Number(
          c.querySelector(".wm-equipe__niveau").textContent.replace(/\D+/g, ""),
        )
      ),
      faits: [...s.querySelectorAll(".wm-defi__mot")].map((d) => d.textContent.trim()),
      //  PLUS AUCUN RENVOI VERS LA CARTE DE DRESSEUR : « on affichera
      //  plus la carte de dresseur de Michael à l'avenir ». Le
      //  harnais exigeait l'inverse jusqu'au 9 novembre ; il exige
      //  maintenant son absence, sinon le lien reviendrait sans que
      //  rien ne le dise.
      carte: [...s.querySelectorAll("a")].map((a) => a.getAttribute("href"))
        .filter((h) => h !== null && h.includes("t8-trainer-card")).length,
      //  Les cinq intitulés d'équipe, dans l'ordre où on les monte.
      titres: [...s.querySelectorAll(".wm-defi__sous-titre")].map((h) =>
        h.textContent.trim()
      ),
      //  Les six dernières cases sont celles du champion : la page
      //  les écrit en dernier, après les quatre du Conseil.
      tousLesNiveaux: [...s.querySelectorAll(".wm-equipe__pkmn")].map((c) =>
        Number(c.querySelector(".wm-equipe__niveau").textContent.replace(/\D+/g, ""))
      ),
    };
  });
  ok("l'onglet de la Ligue existe", vu !== null, vu);
  if (vu !== null && eq !== undefined) {
    //  TRENTE CASES : quatre équipes de Conseil et celle du champion.
    ok("cinq équipes dans l'onglet de la Ligue, trente pokémon", vu.cases === 30, vu.cases);
    ok(
      "le Conseil 4 vient avant le champion, un type par membre",
      vu.titres.length === 5 &&
        vu.titres.slice(0, 4).every((h, i) =>
          h.startsWith("Conseil 4 · ") &&
          h.toLowerCase().includes(eq.conseil4[i].type.replace("psy", "psy"))
        ) &&
        vu.titres[4].startsWith("Michael"),
      vu.titres,
    );
    //  Les six DERNIÈRES cases sont celles de Michael.
    const duChampion = vu.noms.slice(-6);
    ok(
      "l'équipe du champion est celle du relevé, dans l'ordre",
      duChampion.join("|") === eq.membres.map((m) => m.nom).join("|"),
      { page: duChampion, donnees: eq.membres.map((m) => m.nom) },
    );
    //  ── LE CONSEIL RESTE SOUS LE CHAMPION ──────────────────────────
    //
    //  C'est l'échelle de la Ligue : on monte. Un membre du Conseil au
    //  niveau de Michael, ou au-dessus, voudrait dire qu'on peut
    //  perdre après avoir gagné.
    const duConseil = vu.tousLesNiveaux.slice(0, 24);
    ok(
      "les vingt-quatre pokémon du Conseil restent sous le champion",
      duConseil.length === 24 && Math.max(...duConseil) < eq.niveau,
      { plusFortDuConseil: Math.max(...duConseil), defi: eq.niveau },
    );
    ok(
      "et ils montent d'un membre à l'autre",
      eq.conseil4.every((m, i) =>
        i === 0 ||
        Math.max(...m.membres.map((x) => x.niveau)) >
          Math.max(...eq.conseil4[i - 1].membres.map((x) => x.niveau))
      ),
      eq.conseil4.map((m) => [m.type, m.membres.map((x) => x.niveau)]),
    );
    //  LE PLUS FORT EST AU NIVEAU DU DÉFI : la règle des onze autres.
    ok(
      `le plus fort de l'équipe est au niveau ${eq.niveau}`,
      Math.max(...vu.tousLesNiveaux) === eq.niveau && eq.niveau === 80,
      { niveaux: vu.tousLesNiveaux, defi: eq.niveau },
    );
    //  ET LEURS ÉCARTS SONT CEUX DE SA CARTE, décalés de cinq : c'est
    //  ce qui distingue cette équipe des onze étagées.
    ok(
      "les écarts de la carte sont gardés, décalés de cinq",
      vu.tousLesNiveaux.slice(-6).join(",") === "80,80,75,77,77,76",
      vu.tousLesNiveaux.slice(-6),
    );
    ok(
      "la Ligue a son type conseillé, comme les onze autres",
      vu.faits.includes("Type conseillé"),
      vu.faits,
    );
    ok("et la page ne renvoie plus vers sa carte de dresseur", vu.carte === 0, vu.carte);
  }
  await p.close();
}

await nav.close();
console.log(fautes === 0 ? "\n  TOUT PASSE." : `\n  ${fautes} défaut(s).`);
Deno.exit(fautes === 0 ? 0 : 1);
