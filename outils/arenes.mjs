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
  for (const n of [1, 2]) {
    const attendu = ARENES.arenes.filter((a) => a.palier === n).length;
    ok(
      `palier ${n} : ${attendu} défis listés`,
      paliers[n - 1]?.defis.length === attendu,
      { lu: paliers[n - 1]?.defis, attendu },
    );
  }
  ok("le palier 3 dit qu'il n'a aucun défi", paliers[2]?.vide === true, paliers[2]);

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
        badge: (() => {
          const i = section.querySelector(".wm-defi__badge img");
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
          chiffres: bulle.querySelector(".wm-equipe__chiffres")?.textContent.trim() ?? null,
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
    "elle porte le niveau et les trois chiffres",
    bulles.every((b) =>
      /^Niv\. \d+$/.test(b.niveau) && /\d+ PV · \d+ ATT · \d+ DEF/.test(b.chiffres)
    ),
    bulles.map((b) => [b.niveau, b.chiffres]),
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

await nav.close();
console.log(fautes === 0 ? "\n  TOUT PASSE." : `\n  ${fautes} défaut(s).`);
Deno.exit(fautes === 0 ? 0 : 1);
