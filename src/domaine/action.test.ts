import { assertEquals } from "@std/assert";
import { actionDe, ecrireUneAction, sansActions, VERBES } from "./action.ts";

const CHERCHER = { type: "chercher", lieu: "clairiere-aux-lucioles" } as const;
const FOUILLER = { type: "fouiller" } as const;

Deno.test("ce que le bouton écrit, le serveur le relit", () => {
  // Le trajet complet, pour chaque action. C'est le test qui empêche
  // d'ajouter un verbe d'un seul côté.
  for (const action of [CHERCHER, FOUILLER]) {
    const bloc = ecrireUneAction(action);
    assertEquals(actionDe(`Elle avance prudemment.\n\n${bloc}`), action);
  }
  // Et le vocabulaire déclaré est bien celui qu'on sait écrire.
  assertEquals([...VERBES].sort(), ["chercher", "fouiller"]);
});

Deno.test("« CHERCHER » SANS LIEU EST LA FORME NORMALE", () => {
  // CE TEST DISAIT L'INVERSE JUSQU'AU 15 OCTOBRE : « on ne devine pas ».
  // Il encodait une décision, et la décision a changé — Callista :
  // « on est déjà dans une zone sauvage, avec un palier, donc y'a pas
  // d'autres zones à rajouter. » Le joueur ne choisit plus de lieu ;
  // c'est le serveur qui le tire, avec la graine du message.
  //
  // Le raisonnement d'avant n'était pas faux : il FAUT savoir où. Mais
  // ce n'est pas au joueur de le dire, et c'est ce glissement qui avait
  // mis un menu déroulant dans la barre d'actions.
  assertEquals(actionDe("[[WM-ACTION:chercher]]"), { type: "chercher" });
  // Et c'est bien ce que le bouton écrit maintenant.
  assertEquals(ecrireUneAction({ type: "chercher" }), "[[WM-ACTION:chercher]]");
});

Deno.test("UN LIEU ÉCRIT À LA MAIN EST ENCORE LU", () => {
  // La compatibilité, et elle n'est pas théorique : un message portant
  // `[[WM-ACTION:chercher:etang-vaseux]]` est posté sur `t976` depuis le
  // 3 octobre. **Un message posté ne change pas de sens parce qu'on a
  // changé le bouton.**
  assertEquals(actionDe("[[WM-ACTION:chercher:etang-vaseux]]"), {
    type: "chercher",
    lieu: "etang-vaseux",
  });
  // Les deux formes cohabitent dans un même texte, et la PREMIÈRE
  // l'emporte — une seule action par message, règle inchangée.
  assertEquals(
    actionDe("[[WM-ACTION:chercher:berge-est]] puis [[WM-ACTION:chercher]]"),
    { type: "chercher", lieu: "berge-est" },
  );
});

Deno.test("« fouiller » avec un lieu dit quelque chose qu'on ne sait pas honorer", () => {
  // Fouiller vaut pour la zone entière. Un argument ici serait du sens
  // qu'on inventerait à la lecture.
  assertEquals(actionDe("[[WM-ACTION:fouiller:clairiere-aux-lucioles]]"), null);
});

Deno.test("la clé de lieu traverse le bloc telle quelle", () => {
  for (const cle of ["lisiere-de-samaragd", "berge-est", "grotte-n-2", "meandres"]) {
    assertEquals(actionDe(ecrireUneAction({ type: "chercher", lieu: cle })), {
      type: "chercher",
      lieu: cle,
    });
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
