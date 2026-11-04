// ════════════════════════════════════════════════════════════════════
//  outils/natures.ts — `deno task natures`
//
//  Les six nombres de la planche 79, mesurés contre les dix-sept zones
//  réelles au lieu d'être crus.
//
//  ── POURQUOI CET OUTIL EXISTE ───────────────────────────────────────
//
//  La planche 79 § 4 : « Simuler les six nombres du § 1 avant de les
//  publier, et vérifier que la fouille d'un Jovial tombe toujours à
//  100. » Les nombres y sont marqués « premier jet » — une relance,
//  19 %, 10 %, 15 %, une fois par sujet, 20 %. Les écrire dans l'annexe
//  06 sans les avoir mesurés, c'est publier une règle de jeu dont
//  personne ne connaît l'effet.
//
//  ── IL MESURE LE DOMAINE, PAS UNE COPIE DU DOMAINE ──────────────────
//
//  Il importe `src/domaine/nature.ts`, `fouille.ts` et `rencontre.ts`.
//  Réécrire les tirages ici pour « aller plus vite » mesurerait cet
//  outil et rien d'autre — c'est l'erreur payée trois fois sur les
//  décors du harnais, et elle coûte plus cher à chaque fois.
//
//  ── ET IL LIT LA DONNÉE, PAS DES CHIFFRES RECOPIÉS ──────────────────
//
//  Les taux viennent de `data/butin.json`, les raretés des dix-sept
//  tables de `data/faune/`. Donc le jour où Callista change la part
//  « objet » ou une table de zone, cet outil dit les nouveaux chiffres
//  sans qu'on y touche.
//
//  ── CE QU'IL NE MESURE PAS, ET POURQUOI ─────────────────────────────
//
//  Malin (+10 % d'XP à six types) et Doux (+15 % de ₽ en sujet à
//  plusieurs) sont des multiplicateurs plats : il n'y a rien à simuler,
//  leur effet EST le nombre. Brave n'existe pas dans le domaine — le
//  combat n'y est pas. Les trois qui changent un tirage sont Hardi,
//  Sérieux et Jovial, et ce sont les trois que cet outil chiffre.
// ════════════════════════════════════════════════════════════════════

import {
  fouillerSelonLaNature,
  tauxSelonLaNature,
  tirerUneRencontreSelonLaNature,
} from "../src/domaine/nature.ts";
import {
  type LigneDeButin,
  type TauxDeFouille,
  verifieLesTaux,
} from "../src/domaine/fouille.ts";
import { type EntreeDeTable, type Rarete, verifieTable } from "../src/domaine/rencontre.ts";

/** Combien de sujets on simule par zone et par nature. La planche dit
 *  « vingt mille sujets ». À dix mille, la part « fossile entier »
 *  (0,2 %) tombe à une vingtaine de cas et son chiffre devient du
 *  bruit ; à vingt mille elle en voit une quarantaine. */
const SUJETS = 20_000;

type ZoneDeButin = {
  readonly forumId: number;
  readonly zone: string;
  readonly palier: number;
  readonly objets: readonly { readonly objet: number; readonly pct: number }[];
};

type Butin = {
  readonly fouille: TauxDeFouille & { readonly pokedollars: number };
  readonly zones: readonly ZoneDeButin[];
};

type Faune = {
  readonly forumId: number;
  readonly zone: string;
  readonly conditions: Readonly<
    Record<
      string,
      readonly {
        readonly espece: number;
        readonly pct: number;
        readonly min: number;
        readonly max: number;
        readonly rarete: Rarete;
      }[]
    >
  >;
};

async function lire<T>(chemin: string): Promise<T> {
  return JSON.parse(await Deno.readTextFile(new URL(chemin, import.meta.url))) as T;
}

/** Les parts d'une fouille, en pour cent, sur `SUJETS` tirages.
 *
 *  `relances` compte les fouilles où Hardi a dépensé sa relance : c'est
 *  le nombre qui dit combien de fois l'avantage SERT, à côté de celui
 *  qui dit ce qu'il rapporte. */
function partsDeFouille(
  zone: ZoneDeButin,
  taux: TauxDeFouille,
  nature: "hardi" | "jovial" | "doux",
): Readonly<Record<string, number>> & { readonly relances: number } {
  const butin: readonly LigneDeButin[] = zone.objets.map((o) => ({
    objetId: o.objet,
    pourcentage: o.pct,
  }));
  const compte: Record<string, number> = {
    bredouille: 0,
    "fossile entier": 0,
    "morceau de fossile": 0,
    objet: 0,
    pokedollars: 0,
  };
  let relances = 0;
  let pokedollars = 0;

  for (let i = 0; i < SUJETS; i++) {
    //  La graine est le numéro du message. On prend une plage haute et
    //  décalée par zone : deux zones qui simuleraient les mêmes graines
    //  donneraient des parts corrélées, et l'écart entre zones ne
    //  voudrait plus rien dire.
    const graine = 1_000_000 + zone.forumId * SUJETS + i;
    const r = fouillerSelonLaNature(graine, zone.palier, taux, butin, nature, true);
    if (r.relanceUtilisee) relances++;
    const t = r.trouvaille;
    if (t.genre === "bredouille") compte.bredouille++;
    else if (t.genre === "objet") compte.objet++;
    else if (t.genre === "pokedollars") {
      compte.pokedollars++;
      pokedollars += t.montant;
    } else compte[t.entier ? "fossile entier" : "morceau de fossile"]++;
  }

  const parts: Record<string, number> = {};
  for (const [k, v] of Object.entries(compte)) parts[k] = (v * 100) / SUJETS;
  //  Le gain moyen par fouille, bredouilles comprises : c'est ce qu'un
  //  joueur ressent, pas la moyenne des fouilles qui ont payé.
  parts["₽ par fouille"] = pokedollars / SUJETS;
  return { ...parts, relances };
}

/** La part de chaque rareté, en pour cent, sur `SUJETS` rencontres. */
function partsDeRarete(
  faune: Faune,
  nature: "serieux" | "doux",
): Readonly<Record<Rarete, number>> {
  //  Jour et nuit sont identiques depuis le 15 octobre ; on prend la
  //  première condition écrite plutôt que de supposer laquelle existe.
  const [, brute] = Object.entries(faune.conditions)[0];
  const table: readonly EntreeDeTable[] = brute.map((e) => ({
    especeId: e.espece,
    pourcentage: e.pct,
    niveauMin: e.min,
    niveauMax: e.max,
    rarete: e.rarete,
  }));
  verifieTable(table);

  const compte: Record<Rarete, number> = { "commun": 0, "peu commun": 0, "rare": 0 };
  for (let i = 0; i < SUJETS; i++) {
    compte[tirerUneRencontreSelonLaNature(table, `f${faune.forumId}·m${i}`, nature).rarete]++;
  }
  return {
    "commun": (compte["commun"] * 100) / SUJETS,
    "peu commun": (compte["peu commun"] * 100) / SUJETS,
    "rare": (compte["rare"] * 100) / SUJETS,
  };
}

function pct(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} %`;
}

async function main(): Promise<void> {
  const butin = await lire<Butin>("../data/butin.json");
  const base: TauxDeFouille = {
    bredouille: butin.fouille.bredouille,
    fossileEntier: butin.fouille.fossileEntier,
    morceauDeFossile: butin.fouille.morceauDeFossile,
    objet: butin.fouille.objet,
  };

  console.log(
    `\n  LES SIX NATURES, MESURÉES · ${SUJETS.toLocaleString("fr")} sujets par zone\n`,
  );

  // ── 1. La garde que la planche demande explicitement ──────────────
  //
  //  « vérifier que la fouille d'un Jovial tombe toujours à 100 » : le
  //  doubler du fossile prend ses 10,2 points sur les pokédollars, et
  //  si une zone avait une part « objet » plus grosse, la somme
  //  dépasserait cent et `verifieLesTaux` refuserait le tirage — en
  //  production, pas ici.
  const jovial = tauxSelonLaNature(base, "jovial");
  const refus: string[] = [];
  for (const z of butin.zones) {
    const lignes: readonly LigneDeButin[] = z.objets.map((o) => ({
      objetId: o.objet,
      pourcentage: o.pct,
    }));
    for (const [nom, t] of [["neutre", base], ["jovial", jovial]] as const) {
      try {
        verifieLesTaux(t, lignes);
      } catch (e) {
        refus.push(`${z.zone} (${nom}) : ${(e as Error).message}`);
      }
    }
  }
  const reste = (t: TauxDeFouille) =>
    100 - t.bredouille - t.fossileEntier - t.morceauDeFossile - t.objet;
  console.log(`  ── La garde de la planche 79 § 1 ──`);
  console.log(
    `  Les ${butin.zones.length} zones acceptent les taux d'un Jovial : ${
      refus.length === 0 ? "OUI" : "NON"
    }`,
  );
  for (const r of refus) console.log(`    ✗ ${r}`);
  console.log(
    `  Pokédollars : ${pct(reste(base))} pour les autres, ${pct(reste(jovial))} pour un Jovial`,
  );
  console.log(`  Le fossile gagne donc ${pct(reste(base) - reste(jovial))}, pris là.\n`);

  // ── 2. Hardi et Jovial, sur les trois paliers ─────────────────────
  //
  //  Une zone par palier suffit à dire la règle : les parts de fouille
  //  ne dépendent du palier que par les BORNES de pokédollars, et de la
  //  zone que par sa table d'objets, qui ne change pas la part « objet ».
  console.log(`  ── La fouille, par nature ──\n`);
  const temoins = [1, 2, 3].map((p) => butin.zones.find((z) => z.palier === p)!);
  for (const z of temoins) {
    console.log(`  ${z.zone} · palier ${z.palier}`);
    for (const n of ["doux", "hardi", "jovial"] as const) {
      const p = partsDeFouille(z, base, n);
      const etiquette = n === "doux" ? "les quatre autres" : n;
      console.log(
        `    ${etiquette.padEnd(17)} bredouille ${pct(p.bredouille).padStart(8)}` +
          ` · morceau ${pct(p["morceau de fossile"]).padStart(7)}` +
          ` · entier ${pct(p["fossile entier"]).padStart(6)}` +
          ` · objet ${pct(p.objet).padStart(7)}` +
          ` · ₽ ${pct(p.pokedollars).padStart(7)}` +
          ` (${p["₽ par fouille"].toFixed(1).replace(".", ",")} ₽ / fouille)` +
          (n === "hardi" ? ` · ${pct((p.relances * 100) / SUJETS)} de relances` : ""),
      );
    }
    console.log("");
  }

  // ── 3. Sérieux, sur les dix-sept zones ────────────────────────────
  //
  //  Celui-là DOIT se mesurer zone par zone : les tables sont écrites à
  //  la main, la part « rare » n'est pas la même partout, et la planche
  //  annonce « environ 19 % contre 10 % » en supposant 10 % de rare.
  console.log(`  ── La rareté, chez Sérieux ──\n`);
  let sommeNeutre = 0;
  let sommeSerieux = 0;
  for (const z of butin.zones) {
    const faune = await lire<Faune>(`../data/faune/${z.forumId}.json`);
    const neutre = partsDeRarete(faune, "doux");
    const vu = partsDeRarete(faune, "serieux");
    sommeNeutre += neutre["rare"];
    sommeSerieux += vu["rare"];
    console.log(
      `    ${z.zone.padEnd(22)} rare ${pct(neutre["rare"]).padStart(8)} → ${
        pct(vu["rare"]).padStart(8)
      }  ·  commun ${pct(neutre["commun"]).padStart(8)} → ${pct(vu["commun"]).padStart(8)}`,
    );
  }
  const n = butin.zones.length;
  console.log(
    `\n    MOYENNE des ${n} zones : rare ${pct(sommeNeutre / n)} → ${pct(sommeSerieux / n)}`,
  );
  console.log(
    `    La planche annonçait « environ 19 % contre 10 % ».\n`,
  );

  // ── 4. Les six sur un même axe ────────────────────────────────────
  //
  //  Trois avantages touchent les pokédollars, directement ou en
  //  creux : Hardi en relançant, Jovial en troquant l'argent contre du
  //  fossile, Doux en ajoutant 15 % à tout le monde. Les mettre sur une
  //  seule colonne est le seul moyen de voir si l'un écrase les autres —
  //  et c'est la question que la planche posait sans pouvoir y répondre.
  const palier1 = temoins[0];
  const neutre = partsDeFouille(palier1, base, "doux")["₽ par fouille"];
  const hardi = partsDeFouille(palier1, base, "hardi")["₽ par fouille"];
  const jov = partsDeFouille(palier1, base, "jovial")["₽ par fouille"];
  const ecart = (v: number) => `${v >= neutre ? "+" : ""}${pct(((v - neutre) * 100) / neutre)}`;
  console.log(`  ── Les trois qui touchent l'argent, ${palier1.zone} ──\n`);
  console.log(`    les trois autres  ${neutre.toFixed(1).replace(".", ",")} ₽ / fouille`);
  console.log(
    `    Hardi             ${hardi.toFixed(1).replace(".", ",")} ₽  ${
      ecart(hardi)
    }  — sans condition, à chaque fouille`,
  );
  console.log(
    `    Doux              ${(neutre * 1.15).toFixed(1).replace(".", ",")} ₽  +15,00 %` +
      `  — seulement en sujet à plusieurs`,
  );
  console.log(
    `    Jovial            ${jov.toFixed(1).replace(".", ",")} ₽  ${
      ecart(jov)
    }  — en échange du fossile doublé\n`,
  );

  // ── 5. Les trois qui n'ont rien à simuler ─────────────────────────
  console.log(`  ── Les trois autres ──`);
  console.log(
    `    Malin   +10 % d'XP à six types différents — un multiplicateur, rien à tirer.`,
  );
  console.log(`    Doux    +15 % de ₽ pour tout le monde, sujet à plusieurs, sans cumul.`);
  console.log(`    Brave   PAS MESURABLE : le combat n'existe pas dans le domaine.\n`);
}

await main();
