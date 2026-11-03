import { assertEquals } from "@std/assert";
import { compteDansLaPage } from "./compte-du-forum.ts";

//  ════════════════════════════════════════════════════════════════════
//  LES EXTRAITS SONT CEUX DU FORUM, relevés le 3 novembre 2026 depuis
//  `/h15-mon-carnet` en demandant `/privmsg?folder=inbox` et
//  `/memberlist`. Les inventer aurait fait un analyseur d'accord avec
//  mon idée de Forumactif et pas avec Forumactif.
//  ════════════════════════════════════════════════════════════════════

const CONNECTE = `
  var _userdata = new Object();
  _userdata["session_logged_in"] = 1;
  _userdata["username"] = "Arceus";
  _userdata["user_id"] = 1;
  _userdata["user_level"] = 1;
`;

Deno.test("le membre connecté se lit : son numéro et son pseudo", () => {
  assertEquals(compteDansLaPage(CONNECTE), { id: 1, pseudo: "Arceus" });
});

Deno.test("UN INVITÉ REND null, ET CE N'EST PAS UNE PANNE", () => {
  //  Forumactif écrit les DEUX : le drapeau à 0 et un numéro négatif.
  const invite = `
    _userdata["session_logged_in"] = 0;
    _userdata["username"] = "Anonymous";
    _userdata["user_id"] = -1;
  `;
  assertEquals(compteDansLaPage(invite), null);
});

Deno.test("UN NUMÉRO NÉGATIF NE PASSE PAS, MÊME AVEC LE DRAPEAU À 1", () => {
  //  Le drapeau seul ne suffit pas : un `-1` qui partirait en base
  //  serait un appel de plus pour rien, et un carnet introuvable
  //  ressemblerait à une panne.
  const bancal = `
    _userdata["session_logged_in"] = 1;
    _userdata["user_id"] = -1;
  `;
  assertEquals(compteDansLaPage(bancal), null);
});

Deno.test("une page sans _userdata rend null", () => {
  assertEquals(compteDansLaPage("<html><body>rien</body></html>"), null);
  assertEquals(compteDansLaPage(""), null);
});

Deno.test("l'apostrophe échappée et les entités reviennent en clair", () => {
  //  « L'Inconnu » s'écrit `"L\\'Inconnu"` dans le JavaScript de
  //  Forumactif, et un pseudo peut porter une entité HTML.
  const a =
    `_userdata["session_logged_in"] = 1; _userdata["username"] = "L\\'Inconnu"; _userdata["user_id"] = 12;`;
  assertEquals(compteDansLaPage(a)?.pseudo, "L'Inconnu");
  const b =
    `_userdata["session_logged_in"] = 1; _userdata["username"] = "Jean&#039;s"; _userdata["user_id"] = 13;`;
  assertEquals(compteDansLaPage(b)?.pseudo, "Jean's");
});

Deno.test("un pseudo absent ne fait pas refuser le compte", () => {
  //  Le pseudo affiché vient de la base ; celui-ci ne sert qu'à dire
  //  « connecté en tant que… » à un compte sans carnet.
  const sansNom = `_userdata["session_logged_in"] = 1; _userdata["user_id"] = 42;`;
  assertEquals(compteDansLaPage(sansNom), { id: 42, pseudo: "" });
});

Deno.test("LES GUILLEMETS SIMPLES AUSSI, parce que Forumactif en met", () => {
  const simples =
    `_userdata['session_logged_in'] = 1; _userdata['user_id'] = 7; _userdata['username'] = 'Noa';`;
  assertEquals(compteDansLaPage(simples), { id: 7, pseudo: "Noa" });
});
