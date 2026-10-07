// ════════════════════════════════════════════════════════════════════
//  Ce que ces tests protègent.
//
//  **Qu'un fichier abîmé ne casse pas un passage de relève.** C'est le
//  choix que cet adaptateur fait, contrairement à `comptoirs.ts` qui
//  lève : une fouille sans fossile est le cas NORMAL du jeu, et perdre
//  un sujet entier pour une virgule dans un fichier de rareté serait
//  hors de proportion.
//
//  **Que le fichier ne soit lu qu'une fois.** Une relève lit des
//  dizaines de messages ; une lecture par fouille ferait des dizaines
//  d'appels réseau pour la même réponse.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { FossilesEnFichiers, tableDepuis } from "./fossiles.ts";
import { REGLES_PAR_DEFAUT } from "../../domaine/fossile.ts";

const VRAI = await Deno.readTextFile(
  new URL("../../../data/fossiles.json", import.meta.url),
);

Deno.test("LE VRAI FICHIER DU DÉPÔT SE LIT", async () => {
  //  Celui-là est le seul test qui touche au disque, et il le vaut : il
  //  attrape le jour où quelqu'un renomme un champ du JSON sans toucher
  //  au code. Le garde-fou n° 13 vérifie le CONTENU ; celui-ci vérifie
  //  que l'adaptateur en tire bien quelque chose.
  const table = new FossilesEnFichiers(() => Promise.resolve(VRAI));
  const fossiles = await table.fossiles();
  assertEquals(fossiles.length, 11);
  assertEquals(fossiles[0].clef, "racine");
  assertEquals(await table.regles(), {
    morceauxParFossile: 3,
    chanceDeMorceau: 0.06,
    chanceDEntier: 0.008,
  });
});

Deno.test("un JSON illisible rend une table vide, il ne lève pas", () => {
  assertEquals(tableDepuis("{ ceci n'est pas"), {
    fossiles: [],
    regles: REGLES_PAR_DEFAUT,
  });
});

Deno.test("UN FICHIER INJOIGNABLE N'ARRÊTE PAS LA RELÈVE", async () => {
  const table = new FossilesEnFichiers(() => Promise.reject(new Error("HTTP 503")));
  assertEquals(await table.fossiles(), []);
  assertEquals(await table.regles(), REGLES_PAR_DEFAUT);
});

Deno.test("le fichier n'est lu QU'UNE FOIS", async () => {
  let lectures = 0;
  const table = new FossilesEnFichiers(() => {
    lectures++;
    return Promise.resolve(VRAI);
  });
  //  En parallèle, exprès : c'est la promesse qui est gardée, pas son
  //  résultat, donc deux appels simultanés ne font qu'une lecture.
  await Promise.all([table.fossiles(), table.regles(), table.fossiles()]);
  assertEquals(lectures, 1);
});

Deno.test("la racine est posée devant le chemin", async () => {
  const vus: string[] = [];
  const table = new FossilesEnFichiers((c) => {
    vus.push(c);
    return Promise.resolve(VRAI);
  }, "https://exemple.test/");
  await table.fossiles();
  assertEquals(vus, ["https://exemple.test/data/fossiles.json"]);
});
