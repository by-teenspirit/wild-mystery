// ════════════════════════════════════════════════════════════════════
//  « Qui est en ligne ? » — les règles. La lecture du DOM et le dessin
//  sont dans le module, et c'est le harnais de navigateur qui les voit.
//
//  CE QUI EST TESTÉ ICI est ce qui se trompe en silence : un nombre
//  écrit à la française qu'on lit de travers, et un clan qu'on affiche
//  alors qu'on en demandait un autre.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  avatarParmi,
  type Chiffres,
  clanDepuis,
  clanDuMoment,
  nombreEcrit,
  ongletsDesClans,
  rienAMontrer,
} from "./enligne.ts";

const HO_OH = {
  cle: "ho-oh",
  nom: "Ho-Oh",
  description: "Ils sont venus ici, sur les terres de Rhode.",
  avantage: "+ 10 % d'XP dans les combats d'arène.",
  pokemons: [250, 230],
};

Deno.test("LES MILLIERS DE FORUMACTIF SE LISENT", () => {
  //  La maquette montre « 3 214 messages », avec une espace fine
  //  insécable. `parseInt` s'y arrête et rend 3.
  assertEquals(nombreEcrit("436"), 436);
  assertEquals(nombreEcrit("3 214"), 3214);
  assertEquals(nombreEcrit("3 214"), 3214);
  assertEquals(nombreEcrit("3 214"), 3214);
  assertEquals(nombreEcrit("0"), 0);
});

Deno.test("et ce qui n'est pas un nombre n'en devient pas un", () => {
  //  « 12 membres » n'est pas « 12 » : si la structure change et qu'on
  //  attrape une phrase entière, mieux vaut rien que douze.
  assertEquals(nombreEcrit("436 messages"), null);
  assertEquals(nombreEcrit(""), null);
  assertEquals(nombreEcrit("—"), null);
  assertEquals(nombreEcrit("-3"), null);
});

Deno.test("un clan complet se relit entier", () => {
  const c = clanDepuis(HO_OH);
  assertEquals(c?.nom, "Ho-Oh");
  assertEquals(c?.cle, "ho-oh");
  assertEquals(c?.pokemons, [250, 230]);
});

Deno.test("UN CLAN SANS DESCRIPTION NE S'AFFICHE PAS", () => {
  //  Cinq des six clans sont des trous en attendant leurs textes. Une
  //  carte au nom d'un clan et au corps vide ferait croire à une
  //  panne, et on chercherait le défaut dans le code.
  assertEquals(clanDepuis({ ...HO_OH, description: "" }), null);
  assertEquals(clanDepuis({ ...HO_OH, description: "   " }), null);
  assertEquals(clanDepuis({ ...HO_OH, nom: "" }), null);
});

Deno.test("un avantage manquant, en revanche, ne l'empêche pas", () => {
  //  L'avantage est une règle de jeu qui peut se décider après le
  //  texte de présentation. Le module masque l'encart, le clan reste.
  assertEquals(clanDepuis({ ...HO_OH, avantage: "" })?.avantage, "");
});

Deno.test("les numéros de pokémon se filtrent", () => {
  //  Un zéro, un nombre à virgule ou une chaîne viendraient d'une
  //  faute de saisie dans `data/clans.json` — et donneraient une case
  //  vide dans la bande de sprites.
  assertEquals(clanDepuis({ ...HO_OH, pokemons: [250, 0, -1, 2.5, "151"] })?.pokemons, [250]);
  assertEquals(clanDepuis({ ...HO_OH, pokemons: "250" })?.pokemons, []);
});

Deno.test("`duMoment` désigne le clan, et lui seul", () => {
  const fichier = {
    duMoment: "ho-oh",
    clans: [{ ...HO_OH, cle: "mew", nom: "Mew" }, HO_OH],
  };
  assertEquals(clanDuMoment(fichier)?.nom, "Ho-Oh");
});

Deno.test("UNE CLÉ QUI NE DÉSIGNE RIEN NE RETOMBE PAS SUR LE PREMIER", () => {
  //  Afficher silencieusement un autre clan que celui demandé est pire
  //  que de n'en afficher aucun : personne ne s'aperçoit de l'erreur,
  //  et le forum annonce le mauvais avantage pendant un mois.
  assertEquals(clanDuMoment({ duMoment: "zapdos", clans: [HO_OH] }), null);
  assertEquals(clanDuMoment({ duMoment: "", clans: [HO_OH] }), null);
  assertEquals(clanDuMoment({ clans: [HO_OH] }), null);
});

Deno.test("et un clan encore vide ne se montre pas non plus", () => {
  //  `duMoment` pointe un clan dont le texte n'est pas écrit : on ne
  //  montre pas une carte creuse.
  assertEquals(
    clanDuMoment({ duMoment: "mew", clans: [{ cle: "mew", nom: "Mew", description: "" }] }),
    null,
  );
});

Deno.test("un fichier illisible ne fait pas tomber le bloc", () => {
  assertEquals(clanDuMoment(null), null);
  assertEquals(clanDuMoment("ho-oh"), null);
  assertEquals(clanDuMoment({ duMoment: "ho-oh", clans: "non" }), null);
});

Deno.test("SANS RIEN DU TOUT, LE BLOC NE SE POSE PAS", () => {
  //  Mieux vaut pas de bloc qu'un cadre avec trois tirets dedans.
  const vide: Chiffres = { messages: null, membres: null, dernierArrive: null };
  assertEquals(rienAMontrer(vide, null), true);
  assertEquals(rienAMontrer({ ...vide, messages: 0 }, null), false);
  assertEquals(rienAMontrer(vide, clanDepuis(HO_OH)), false);
});

Deno.test("et zéro message est une information, pas une absence", () => {
  //  Un forum neuf a zéro message et mérite son bloc : c'est vrai, et
  //  c'est même ce qu'un visiteur doit voir.
  assertEquals(rienAMontrer({ messages: 0, membres: 0, dernierArrive: null }, null), false);
});

// ════════════════════════════════════════════════════════════════════
//  La bande des six onglets, maquette `390:3387`.
//
//  CE QU'ELLE GARDE QUE `clanDuMoment` JETTE : un clan sans
//  description. Il a son icône dans la bande, et il n'est pas
//  ouvrable. Cinq des six sont dans ce cas au 9 octobre.
// ════════════════════════════════════════════════════════════════════

Deno.test("la bande porte TOUS les clans, même ceux sans texte", () => {
  const onglets = ongletsDesClans({
    clans: [
      { cle: "ho-oh", nom: "Ho-Oh", description: "Les conquérants.", avantage: "" },
      { cle: "mew", nom: "Mew", description: "", avantage: "" },
    ],
  });
  assertEquals(onglets.length, 2);
  assertEquals(onglets[0].cle, "ho-oh");
  assertEquals(onglets[0].clan?.description, "Les conquérants.");
  //  Celui-là est dans la bande, et il n'est pas ouvrable.
  assertEquals(onglets[1].nom, "Mew");
  assertEquals(onglets[1].clan, null);
});

Deno.test("l'ordre est celui du fichier, pas un tri", () => {
  const onglets = ongletsDesClans({
    clans: [
      { cle: "zamazenta", nom: "Zamazenta", description: "" },
      { cle: "ho-oh", nom: "Ho-Oh", description: "x" },
    ],
  });
  assertEquals(onglets.map((o) => o.cle), ["zamazenta", "ho-oh"]);
});

Deno.test("une entrée sans clé ni nom n'est pas un onglet", () => {
  assertEquals(ongletsDesClans({ clans: [{ description: "x" }, null, 3] }).length, 0);
  assertEquals(ongletsDesClans(null).length, 0);
  assertEquals(ongletsDesClans({}).length, 0);
});

// ════════════════════════════════════════════════════════════════════
//  L'AVATAR DU DERNIER ARRIVÉ
//
//  « Pour le dernier arrivant, le rond à côté c'est pour afficher son
//  avatar », 9 octobre. Forumactif ne le sert nulle part sur l'index :
//  il faut le lire sur la page de profil, qui porte vingt images.
//  Choisir la bonne, c'est une règle, et une règle se teste.
// ════════════════════════════════════════════════════════════════════

const img = (classes: string, src: string, largeur = 0) => ({ classes, src, largeur });

Deno.test("LA CLASSE « AVATAR » GAGNE, c'est le nom de l'emplacement", () => {
  assertEquals(
    avatarParmi([
      img("flag", "/images/flags/fr.png", 16),
      img("avatar-profile", "https://i.servimg.com/u/f11/20/12/34/56/moi.png", 200),
      img("rang", "/images/rangs/mj.png", 60),
    ]),
    "https://i.servimg.com/u/f11/20/12/34/56/moi.png",
  );
});

Deno.test("sans la classe, le CHEMIN la trouve", () => {
  assertEquals(
    avatarParmi([
      img("logo", "/logo.png", 200),
      img("", "/users/2015/11/22/avatars/44-13.png", 150),
    ]),
    "/users/2015/11/22/avatars/44-13.png",
  );
});

Deno.test("LES PETITES IMAGES SONT ÉCARTÉES : drapeaux et icônes de rang", () => {
  //  Une image de 16 px dans un conteneur nommé « avatar » reste une
  //  icône. Sans ce filtre, le drapeau du pays passerait pour un
  //  visage.
  assertEquals(avatarParmi([img("avatar", "/flags/fr.png", 16)]), null);
});

Deno.test("UNE PAGE SANS AVATAR NE REND RIEN, et surtout pas la première image", () => {
  assertEquals(
    avatarParmi([img("logo", "/logo.png", 300), img("pub", "/pub.jpg", 728)]),
    null,
  );
});

Deno.test("une image sans largeur déclarée est acceptée", () => {
  //  `width` n'est pas toujours écrit dans le balisage, et une image
  //  pas encore chargée a une largeur naturelle de zéro. L'écarter
  //  reviendrait à n'en trouver aucune sur la moitié des profils.
  assertEquals(
    avatarParmi([img("avatar-profile", "/users/avatars/7.png", 0)]),
    "/users/avatars/7.png",
  );
});
