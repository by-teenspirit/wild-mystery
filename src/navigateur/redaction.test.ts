import { assertEquals } from "@std/assert";
import {
  actionDuBrouillon,
  avecAction,
  avecLaCloture,
  basculer,
  basculerLaCloture,
  clotureDemandee,
  MOT_DE_CLOTURE,
  sansAction,
  sansLaCloture,
} from "./redaction.ts";
import { demandeLaCloture } from "../adaptateurs/forumactif/demandes.ts";
import { actionDe } from "../domaine/action.ts";

const FOUILLER = { type: "fouiller" } as const;
const CHERCHER = { type: "chercher" } as const;

Deno.test("le bloc se pose en fin de message, après une ligne vide", () => {
  assertEquals(
    avecAction("Elle écarte les roseaux.", FOUILLER),
    "Elle écarte les roseaux.\n\n[[WM-ACTION:fouiller]]",
  );
});

Deno.test("sur un message vide, le bloc est seul", () => {
  assertEquals(avecAction("", FOUILLER), "[[WM-ACTION:fouiller]]");
  assertEquals(avecAction("   \n\n ", FOUILLER), "[[WM-ACTION:fouiller]]");
});

Deno.test("poser deux fois ne double pas le bloc", () => {
  // Le pendant, côté interface, de la règle « une seule action par
  // message ». Mieux vaut que les deux soient d'accord plutôt que l'une
  // rattrape l'autre.
  const une = avecAction("Texte.", FOUILLER);
  assertEquals(avecAction(une, FOUILLER), une);
});

Deno.test("poser une autre action remplace, sans demander", () => {
  const texte = avecAction("Texte.", CHERCHER);
  assertEquals(avecAction(texte, FOUILLER), "Texte.\n\n[[WM-ACTION:fouiller]]");
  assertEquals(actionDe(avecAction(texte, FOUILLER)), FOUILLER);
});

// ── la bascule ──────────────────────────────────────────────────────

Deno.test("recliquer le même bouton annule", () => {
  // Cliquer « Fouiller » deux fois ne fouille pas deux fois.
  const pose = basculer("Elle écarte les roseaux.", FOUILLER);
  assertEquals(actionDe(pose), FOUILLER);
  assertEquals(basculer(pose, FOUILLER), "Elle écarte les roseaux.");
});

Deno.test("cliquer un autre bouton bascule vers lui", () => {
  const pose = basculer("Texte.", CHERCHER);
  const autre = basculer(pose, FOUILLER);
  assertEquals(actionDe(autre), FOUILLER);
});

Deno.test("IL N'Y A PLUS QUE DEUX ACTIONS, ET ELLES S'EXCLUENT", () => {
  // CE TEST EN VÉRIFIAIT TROIS JUSQU'AU 15 OCTOBRE : « chercher à Berge
  // Est » et « chercher aux Méandres » étaient deux actions différentes,
  // et recliquer la première annulait quand cliquer la seconde déplaçait.
  // Les lieux ont disparu — « enlève tous les petits lieux » —, donc
  // « chercher » est une action et une seule.
  const pose = basculer("Texte.", CHERCHER);
  assertEquals(actionDe(pose), CHERCHER);
  assertEquals(basculer(pose, CHERCHER), "Texte.");
  assertEquals(actionDe(basculer(pose, FOUILLER)), FOUILLER);
});

// ── le texte du joueur ──────────────────────────────────────────────

Deno.test("retirer le bloc ne touche pas au message", () => {
  const texte = "Elle écarte les roseaux.\nL'eau est tiède.";
  assertEquals(sansAction(avecAction(texte, FOUILLER)), texte);
});

Deno.test("un message sans action traverse sans être abîmé", () => {
  const texte = "Elle écarte les roseaux.";
  assertEquals(sansAction(texte), texte);
  assertEquals(actionDuBrouillon(texte), null);
});

Deno.test("poser puis retirer rend exactement le texte de départ", () => {
  // La boucle complète, parce que c'est elle que le joueur fait sans y
  // penser : il clique, il relit, il déclique.
  for (const texte of ["", "Un mot.", "Deux\nlignes.", "Ponctuation !?"]) {
    assertEquals(sansAction(avecAction(texte, FOUILLER)), texte.replace(/\s+$/, ""), texte);
  }
});

// ── la clôture ──────────────────────────────────────────────────────

Deno.test("le mot de clôture se pose en fin de message, après une ligne vide", () => {
  assertEquals(
    basculerLaCloture("Elle range sa ball."),
    "Elle range sa ball.\n\n[cloture]",
  );
});

Deno.test("sur un brouillon vide, le mot est posé seul", () => {
  assertEquals(basculerLaCloture(""), "[cloture]");
  assertEquals(basculerLaCloture("   \n\n "), "[cloture]");
});

Deno.test("un second clic retire le mot et rend le texte de départ", () => {
  for (const texte of ["", "Un mot.", "Deux\nlignes.", "Ponctuation !?"]) {
    const pose = basculerLaCloture(texte);
    assertEquals(basculerLaCloture(pose), texte.replace(/\s+$/, ""), texte);
  }
});

Deno.test("le mot est reconnu quelle que soit la forme tapée à la main", () => {
  // Le joueur a pu l'écrire lui-même avant qu'on ait un bouton.
  for (const forme of ["[cloture]", "[clôture]", "[ Clôture ]", "[CLOTURE]", "[\tcloture\t]"]) {
    assertEquals(clotureDemandee(`Fin du RP.\n\n${forme}`), true, forme);
    // et un second clic l'enlève, quelle que soit la forme
    assertEquals(basculerLaCloture(`Fin du RP.\n\n${forme}`), "Fin du RP.");
  }
});

Deno.test("un message ordinaire ne demande rien", () => {
  for (const texte of ["", "Elle clôture son sac.", "cloture", "[clotures]", "[ clot ure ]"]) {
    assertEquals(clotureDemandee(texte), false, texte);
  }
});

Deno.test("CE QUE LE BOUTON POSE EST CE QUE LA RELÈVE LIT", () => {
  //  Les deux expressions vivent dans deux fichiers — l'une côté
  //  navigateur, l'autre côté serveur — parce qu'ils ne partagent pas de
  //  dépendance. Ce test est ce qui les tient ensemble : s'il tombe,
  //  c'est qu'un bouton pose un mot que personne ne traitera.
  assertEquals(demandeLaCloture(basculerLaCloture("Fin du RP.")), true);
  assertEquals(demandeLaCloture(MOT_DE_CLOTURE), true);
  for (const forme of ["[cloture]", "[clôture]", "[ Clôture ]", "[CLOTURE]"]) {
    assertEquals(demandeLaCloture(forme), clotureDemandee(forme), forme);
  }
});

Deno.test("une action et une clôture tiennent dans le même message", () => {
  //  AU NIVEAU DU TEXTE, oui : la clôture n'est pas une action, elle ne
  //  la remplace pas, et un message tapé à la main peut porter les deux.
  //
  //  LA BARRE, ELLE, NE L'OFFRE PLUS depuis le 17 novembre : ses quatre
  //  choix s'excluent. C'est une règle d'INTERFACE, gardée par
  //  `outils/barre.mjs` — pas une règle du texte, et il ne faut pas la
  //  faire descendre ici : la relève doit continuer à lire correctement
  //  un vieux message qui porte les deux.
  const texte = basculerLaCloture(avecAction("Un dernier tour.", FOUILLER));
  assertEquals(clotureDemandee(texte), true);
  assertEquals(actionDuBrouillon(texte)?.type, "fouiller");
});

Deno.test("poser et retirer le mot ne dépendent pas de ce qui est déjà là", () => {
  //  LA BASCULE NE SUFFISAIT PLUS. Quatre choix qui s'excluent ont
  //  besoin de « pose » et de « retire », pas de « inverse » : la barre
  //  sait ce qu'elle veut obtenir, pas ce qu'il y avait avant.
  assertEquals(avecLaCloture("Elle part."), "Elle part.\n\n[cloture]");
  assertEquals(avecLaCloture("Elle part.\n\n[cloture]"), "Elle part.\n\n[cloture]");
  assertEquals(sansLaCloture("Elle part.\n\n[cloture]"), "Elle part.");
  assertEquals(sansLaCloture("Elle part."), "Elle part.");
});

Deno.test("poser deux fois ne pose qu'une fois, quelle que soit la forme tapée", () => {
  for (const forme of ["[cloture]", "[clôture]", "[ Clôture ]", "[CLOTURE]"]) {
    const texte = `Fin du RP.\n\n${forme}`;
    assertEquals(avecLaCloture(texte), texte, forme);
    assertEquals(sansLaCloture(avecLaCloture(texte)), "Fin du RP.", forme);
  }
});

Deno.test("la bascule n'est que les deux autres mises bout à bout", () => {
  //  Le mot exact et sa distance au texte sont écrits UNE fois. Le
  //  module au-dessus du premier message bascule encore, et il ne peut
  //  donc pas poser un mot différent de celui de la barre.
  for (const texte of ["", "Un mot.", "Deux\nlignes.", "Fin.\n\n[CLOTURE]"]) {
    assertEquals(
      basculerLaCloture(texte),
      clotureDemandee(texte) ? sansLaCloture(texte) : avecLaCloture(texte),
      texte,
    );
  }
});
