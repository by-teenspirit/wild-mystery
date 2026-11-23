import { assertEquals } from "@std/assert";
import { actionDe, ecrireUneAction, sansActions, VERBES } from "./action.ts";

const CHERCHER = { type: "chercher" } as const;
const FOUILLER = { type: "fouiller" } as const;
//  Les cinq du combat, ouverts le 18 novembre.
const ATTAQUER = { type: "attaquer", capacite: 52 } as const;
const BALL = { type: "ball", objetId: 990001 } as const;
const OBJET = { type: "objet", objetId: 990020 } as const;
const CHANGER = { type: "changer", position: 2 } as const;
const FUIR = { type: "fuir" } as const;
//  Les deux du duel, ouverts le 23 novembre. Sans argument : le défi ne
//  nomme personne, et c'est l'acceptation qui désigne.
const DEFIER = { type: "defier" } as const;
const ACCEPTER = { type: "accepter" } as const;
//  Les quatre de la pension, ouverts le 23 novembre. `gerer` porte le
//  tarif, `confier` la case d'équipe ; les deux autres ne désignent
//  rien, parce que c'est le SUJET qui désigne la pension.
const GERER = { type: "gerer", tarif: 2000 } as const;
const CONFIER = { type: "confier", position: 3 } as const;
const PRENDRE = { type: "prendre" } as const;
const REPRENDRE = { type: "reprendre" } as const;
//  Le seul verbe à DEUX arguments : quel Pokémon, et vers quoi. Et son
//  voisin, qui n'en a qu'un.
const EVOLUER = { type: "evoluer", position: 2, espece: 470 } as const;
const PURIFIER = { type: "purifier", position: 5 } as const;

Deno.test("ce que le bouton écrit, le serveur le relit", () => {
  // Le trajet complet, pour chaque action. C'est le test qui empêche
  // d'ajouter un verbe d'un seul côté — et il a fait exactement ça le
  // 18 novembre, quand les cinq verbes du combat sont arrivés dans le
  // type sans passer par ici.
  for (
    const action of [
      CHERCHER,
      FOUILLER,
      ATTAQUER,
      BALL,
      OBJET,
      CHANGER,
      FUIR,
      DEFIER,
      ACCEPTER,
      GERER,
      CONFIER,
      PRENDRE,
      REPRENDRE,
      EVOLUER,
      PURIFIER,
    ]
  ) {
    const bloc = ecrireUneAction(action);
    assertEquals(actionDe(`Elle avance prudemment.\n\n${bloc}`), action);
  }
  // Et le vocabulaire déclaré est bien celui qu'on sait écrire.
  assertEquals([...VERBES].sort(), [
    "accepter",
    "attaquer",
    "ball",
    "changer",
    "chercher",
    "confier",
    "defier",
    "evoluer",
    "fouiller",
    "fuir",
    "gerer",
    "objet",
    "prendre",
    "purifier",
    "reprendre",
  ]);
});

Deno.test("UN ARGUMENT ABÎMÉ N'EST PAS UNE ACTION PAR DÉFAUT", () => {
  //  « Attaque avec n'importe laquelle » serait une décision prise à la
  //  place du joueur, dans un combat qu'il peut perdre. On ne lit rien,
  //  et le message reste un message.
  for (
    const bloc of [
      "[[WM-ACTION:attaquer]]",
      "[[WM-ACTION:attaquer:0]]",
      "[[WM-ACTION:attaquer:feu]]",
      "[[WM-ACTION:ball]]",
      "[[WM-ACTION:objet]]",
      "[[WM-ACTION:changer]]",
      "[[WM-ACTION:changer:0]]",
    ]
  ) {
    assertEquals(actionDe(bloc), null, bloc);
  }
});

Deno.test("UNE SEPTIÈME CASE D'ÉQUIPE N'EXISTE PAS", () => {
  //  La seule borne tenue dans le domaine, parce qu'elle ne dépend
  //  d'aucune base : une équipe a six cases.
  assertEquals(actionDe("[[WM-ACTION:changer:6]]"), { type: "changer", position: 6 });
  assertEquals(actionDe("[[WM-ACTION:changer:7]]"), null);
});

Deno.test("« fuir » ne prend pas d'argument, comme « fouiller »", () => {
  assertEquals(actionDe("[[WM-ACTION:fuir]]"), { type: "fuir" });
  assertEquals(actionDe("[[WM-ACTION:fuir:vite]]"), null);
});

Deno.test("l'identifiant de capacité est lu tel quel, pas arrondi", () => {
  //  `Number()` aurait accepté « 1e3 », « 0x10 » et « 1.5 ». Aucun des
  //  trois n'est un identifiant, et aucun n'est ce que le bouton écrit.
  assertEquals(actionDe("[[WM-ACTION:attaquer:33]]"), { type: "attaquer", capacite: 33 });
  assertEquals(actionDe("[[WM-ACTION:attaquer:1e3]]"), null);
});

Deno.test("« CHERCHER » N'A PLUS DE LIEU DU TOUT", () => {
  // CE TEST A CHANGÉ DEUX FOIS LE 15 OCTOBRE, et ça valait la peine de
  // le noter : le matin il exigeait un lieu (« on ne devine pas »), à
  // midi il acceptait les deux formes, et le soir il n'y a plus de lieu
  // — Callista : « enlève tous les petits lieux. On a 3 paliers, 17
  // zones sauvages, et tu répartis le pokédex comme ça. »
  assertEquals(actionDe("[[WM-ACTION:chercher]]"), { type: "chercher" });
  assertEquals(ecrireUneAction({ type: "chercher" }), "[[WM-ACTION:chercher]]");
});

Deno.test("UN LIEU ÉCRIT À LA MAIN EST ENCORE LU, ET IGNORÉ", () => {
  // La compatibilité, et elle n'est pas théorique : un message portant
  // `[[WM-ACTION:chercher:etang-vaseux]]` est posté sur `t976` depuis le
  // 3 octobre. **Un message posté ne change pas de sens parce qu'on a
  // changé la donnée.** Il demande toujours un Pokémon ; le lieu, lui,
  // ne désigne plus rien — la table est celle de la zone.
  assertEquals(actionDe("[[WM-ACTION:chercher:etang-vaseux]]"), { type: "chercher" });
  // Et refuser ces messages serait pire que les lire : ce serait effacer
  // ce qu'un joueur a demandé.
  assertEquals(
    actionDe("[[WM-ACTION:chercher:berge-est]] puis [[WM-ACTION:chercher]]"),
    { type: "chercher" },
  );
});

Deno.test("« fouiller » avec un lieu dit quelque chose qu'on ne sait pas honorer", () => {
  // Fouiller vaut pour la zone entière. Un argument ici serait du sens
  // qu'on inventerait à la lecture.
  assertEquals(actionDe("[[WM-ACTION:fouiller:clairiere-aux-lucioles]]"), null);
});

Deno.test("n'importe quelle ancienne clé de lieu se lit encore", () => {
  for (const cle of ["lisiere-de-samaragd", "berge-est", "grotte-n-2", "meandres"]) {
    assertEquals(actionDe(`[[WM-ACTION:chercher:${cle}]]`), { type: "chercher" });
  }
});

Deno.test("un message de RP pur ne demande rien", () => {
  // L'état par défaut : ne pas cliquer ne doit RIEN déclencher.
  assertEquals(actionDe("Le vent se lève sur la Forêt Marécageuse."), null);
  assertEquals(actionDe(""), null);
});

// ── la règle qui porte le fichier ───────────────────────────────────

Deno.test("cinquante blocs dans un message ne font qu'une action", () => {
  // Sans ça, on colle le bloc cinquante fois et on fouille cinquante
  // fois en un seul message.
  const bloc = ecrireUneAction(FOUILLER);
  assertEquals(actionDe(bloc.repeat(50)), FOUILLER);
});

Deno.test("c'est la PREMIÈRE qui compte, pas la dernière", () => {
  // Sinon il suffirait d'en ajouter une à la fin pour écraser la
  // précédente, et l'ordre de lecture du joueur ne serait plus celui du
  // serveur.
  const texte = `${ecrireUneAction(CHERCHER)} puis ${ecrireUneAction(FOUILLER)}`;
  assertEquals(actionDe(texte), CHERCHER);
});

// ── ce qui ne doit pas se déclencher par accident ───────────────────

Deno.test("un verbe inconnu est ignoré, et ne consomme pas le tour", () => {
  // Une version du forum peut écrire un bloc qu'une version du serveur
  // ne connaît pas encore. Elle ne doit ni faire tomber la relève, ni
  // manger l'action valide qui suit.
  assertEquals(actionDe("[[WM-ACTION:danser]]"), null);
  assertEquals(actionDe(`[[WM-ACTION:danser]] ${ecrireUneAction(FOUILLER)}`), FOUILLER);
});

Deno.test("ce qui ressemble au bloc sans en être ne déclenche rien", () => {
  for (
    const presque of [
      "[[WM-ACTION:]]",
      "[[WM-ACTION:Fouiller]]", // la casse compte
      "[[WM-ACTION: fouiller]]",
      "[[WM-ACTION:fouiller]",
      "[WM-ACTION:fouiller]]",
      "[[WMACTION:fouiller]]",
      "[[WM-ACTION:fouiller_2]]",
      "[[WM-ACTION:chercher:Clairiere]]", // la clé est en minuscules
      "[[WM-ACTION:chercher:]]",
    ]
  ) {
    assertEquals(actionDe(presque), null, presque);
  }
});

Deno.test("le marqueur de vérification n'est pas lu comme une action", () => {
  // Les deux blocs cohabitent dans le même message : une expression trop
  // gourmande les confondrait, et une clôture deviendrait une fouille.
  assertEquals(actionDe("[[WM:eyJzIjo5NzZ9:WM-UJW3-G3P]]"), null);
  assertEquals(
    actionDe(`[[WM:eyJzIjo5NzZ9:WM-UJW3-G3P]] ${ecrireUneAction(CHERCHER)}`),
    CHERCHER,
  );
});

// ── l'affichage ─────────────────────────────────────────────────────

Deno.test("on retire les blocs de la vue, jamais du message", () => {
  const texte = `Elle fouille les herbes. ${ecrireUneAction(FOUILLER)}`;
  assertEquals(sansActions(texte), "Elle fouille les herbes. ");
  // Et le texte d'origine n'a pas bougé : c'est la trace de ce que le
  // joueur a demandé.
  assertEquals(actionDe(texte), FOUILLER);
});

Deno.test("retirer les blocs ne mange pas le texte autour", () => {
  assertEquals(sansActions("avant[[WM-ACTION:fouiller]]après"), "avantaprès");
  assertEquals(sansActions("a[[WM-ACTION:chercher:berge-est]]b"), "ab");
  assertEquals(sansActions("rien à retirer"), "rien à retirer");
});

Deno.test("LE DÉFI NE NOMME PERSONNE, ET UN ARGUMENT NE LE REND PAS PLUS PRÉCIS", () => {
  //  `defier:murphy` dirait quelque chose qu'on ne sait pas honorer :
  //  c'est l'ACCEPTATION qui désigne l'adversaire. On passe, plutôt que
  //  de lire le bloc en laissant tomber son argument — un joueur qui a
  //  cru choisir quelqu'un ne doit pas se retrouver à défier le
  //  premier venu.
  for (
    const bloc of [
      "[[WM-ACTION:defier:murphy]]",
      "[[WM-ACTION:accepter:murphy]]",
      "[[WM-ACTION:defier:4]]",
    ]
  ) {
    assertEquals(actionDe(bloc), null);
  }
  //  Et les deux formes nues se lisent.
  assertEquals(actionDe("[[WM-ACTION:defier]]"), { type: "defier" });
  assertEquals(actionDe("[[WM-ACTION:accepter]]"), { type: "accepter" });
});

Deno.test("LES DEUX ARGUMENTS D'`evoluer` SONT EXIGÉS, ET LES AUTRES EN REFUSENT UN SECOND", () => {
  //  ── LA CIBLE NE SE DEVINE PAS ─────────────────────────────────────
  //
  //  L'annexe laisse le choix de la forme au joueur — Évoli en a huit.
  //  Compléter un `evoluer:3` d'office lui donnerait une forme
  //  définitive qu'il n'a pas choisie, et c'est irréversible. On
  //  préfère ne rien faire.
  for (
    const abime of [
      "[[WM-ACTION:evoluer]]",
      "[[WM-ACTION:evoluer:2]]",
      "[[WM-ACTION:evoluer::470]]",
      //  Une case hors de l'équipe : six, pas sept.
      "[[WM-ACTION:evoluer:7:470]]",
      "[[WM-ACTION:evoluer:0:470]]",
      "[[WM-ACTION:evoluer:deux:470]]",
    ]
  ) {
    assertEquals(actionDe(abime), null, abime);
  }
  assertEquals(actionDe("[[WM-ACTION:evoluer:2:470]]"), {
    type: "evoluer",
    position: 2,
    espece: 470,
  });

  //  ── ET UN SECOND ARGUMENT AILLEURS EST UN BLOC ABÎMÉ ──────────────
  //
  //  La forme s'est ouverte à deux arguments pour un seul verbe. Les
  //  dix autres n'en lisent pas un second : le lire quand même
  //  reviendrait à honorer un bloc qu'on ne sait pas composer.
  for (
    const trop of [
      "[[WM-ACTION:attaquer:52:3]]",
      "[[WM-ACTION:purifier:2:470]]",
      "[[WM-ACTION:fuir:1:2]]",
      "[[WM-ACTION:changer:2:3]]",
    ]
  ) {
    assertEquals(actionDe(trop), null, trop);
  }
});

Deno.test("UN BLOC À UN ARGUMENT N'A PAS CHANGÉ DE SENS", () => {
  //  LA FORME S'EST ÉLARGIE, PAS DÉPLACÉE. Des messages postés portent
  //  ces blocs-là, et ils doivent se lire exactement comme avant — la
  //  même prudence que pour `chercher:<lieu>`, qui se lit encore alors
  //  que les lieux n'existent plus.
  assertEquals(actionDe("[[WM-ACTION:attaquer:52]]"), { type: "attaquer", capacite: 52 });
  assertEquals(actionDe("[[WM-ACTION:chercher:etang-vaseux]]"), { type: "chercher" });
  assertEquals(actionDe("[[WM-ACTION:changer:3]]"), { type: "changer", position: 3 });
  assertEquals(actionDe("[[WM-ACTION:fuir]]"), { type: "fuir" });
});
