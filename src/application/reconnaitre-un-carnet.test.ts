import { assertEquals } from "@std/assert";
import { ReconnaitreUnCarnet } from "./reconnaitre-un-carnet.ts";
import type { ReclamationDeCarnetLue } from "./ports.ts";

type Montage = {
  readonly tache: ReconnaitreUnCarnet;
  readonly enregistrees: ReclamationDeCarnetLue[];
  readonly curseurs: Map<number, number>;
  readonly notes: { tache: string; traites: number; erreurs: readonly string[] }[];
  readonly lues: { sujetId: number; depuis: number }[];
};

//  LE DÉPÔT SE COMPORTE COMME LA BASE : `on conflict do nothing`, donc
//  la PREMIÈRE empreinte gagne et les suivantes rendent `false`. Un
//  dépôt qui dirait toujours « neuve » cacherait le cas du copieur,
//  qui est précisément celui qu'on veut tenir.
function decor(reclamations: ReclamationDeCarnetLue[]): Montage {
  const enregistrees: ReclamationDeCarnetLue[] = [];
  const deja = new Set<string>();
  const curseurs = new Map<number, number>();
  const notes: { tache: string; traites: number; erreurs: readonly string[] }[] = [];
  const lues: { sujetId: number; depuis: number }[] = [];

  const tache = new ReconnaitreUnCarnet(
    {
      reclamationsDuSujet: (sujetId, depuis) => {
        lues.push({ sujetId, depuis });
        return Promise.resolve(reclamations.filter((r) => r.messageId > depuis));
      },
    },
    {
      enregistrer: (r) => {
        enregistrees.push(r);
        const neuve = !deja.has(r.empreinte);
        deja.add(r.empreinte);
        return Promise.resolve(neuve);
      },
    },
    {
      dernierMessageLu: (f) => Promise.resolve(curseurs.get(f) ?? 0),
      avancer: (f, m) => {
        curseurs.set(f, m);
        return Promise.resolve();
      },
    },
    {
      dernierPassage: () => Promise.resolve(null),
      noter: (tache, traites, erreurs) => {
        notes.push({ tache, traites, erreurs });
        return Promise.resolve();
      },
    },
  );
  return { tache, enregistrees, curseurs, notes, lues };
}

function r(messageId: number, auteurId: number, empreinte: string): ReclamationDeCarnetLue {
  return { messageId, auteurId, auteurPseudo: `Joueur ${auteurId}`, empreinte };
}

const A = "a".repeat(48);
const B = "b".repeat(48);

Deno.test("chaque empreinte lue est enregistrée avec son auteur", async () => {
  const d = decor([r(10, 42, A), r(11, 43, B)]);
  const bilan = await d.tache.executer(500);
  assertEquals(bilan, { lues: 2, liees: 2 });
  assertEquals(d.enregistrees.map((x) => [x.empreinte, x.auteurId]), [[A, 42], [B, 43]]);
});

Deno.test("le curseur avance jusqu'au dernier message lu", async () => {
  const d = decor([r(10, 42, A), r(17, 43, B)]);
  await d.tache.executer(500);
  assertEquals(d.curseurs.get(500), 17);
  //  ET LE PASSAGE SUIVANT NE RELIT PAS CE QUI EST DÉJÀ LIÉ.
  await d.tache.executer(500);
  assertEquals(d.lues[1], { sujetId: 500, depuis: 17 });
  assertEquals(d.enregistrees.length, 2);
});

Deno.test("UNE EMPREINTE DÉJÀ LIÉE NE BLOQUE PAS LE CURSEUR", async () => {
  //  Un copieur recolle l'empreinte de quelqu'un d'autre : la base la
  //  refuse, et c'est voulu. Mais si son message retenait le curseur,
  //  la relève le relirait toutes les cinq minutes pour toujours.
  const d = decor([r(10, 42, A), r(11, 99, A)]);
  const bilan = await d.tache.executer(500);
  assertEquals(bilan, { lues: 2, liees: 1 });
  assertEquals(d.curseurs.get(500), 11);
  //  ET C'EST BIEN LE PREMIER QUI A LIÉ.
  assertEquals(d.enregistrees[0].auteurId, 42);
});

Deno.test("sans sujet configuré, la tâche ne lit rien et le note", async () => {
  //  L'état du jour où la migration est passée mais où le sujet
  //  d'ouverture n'existe pas encore. Planter ici ferait échouer toute
  //  la relève pour une ligne de configuration manquante.
  const d = decor([r(10, 42, A)]);
  const bilan = await d.tache.executer(null);
  assertEquals(bilan, { lues: 0, liees: 0 });
  assertEquals(d.lues.length, 0);
  assertEquals(d.notes[0].erreurs.length, 1);
});

Deno.test("un sujet sans réclamation ne touche ni au curseur ni au journal", async () => {
  const d = decor([]);
  const bilan = await d.tache.executer(500);
  assertEquals(bilan, { lues: 0, liees: 0 });
  assertEquals(d.curseurs.size, 0);
  assertEquals(d.notes.length, 0);
});
