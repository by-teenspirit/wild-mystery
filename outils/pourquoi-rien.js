// ════════════════════════════════════════════════════════════════════
//  outils/pourquoi-rien.js
//
//  À coller dans la console (F12), sur la page du sujet, connectée au
//  forum. NE MODIFIE RIEN : six lectures et un affichage.
//
//  Le récapitulatif, le bilan et les boutons de combat passent tous
//  les trois par la même file de portes. Chacune se referme EN
//  SILENCE — c'est écrit comme ça exprès, un bonus qui manque ne doit
//  pas crier sur une page publique — et on ne sait donc pas laquelle.
//  Ceci le dit.
// ════════════════════════════════════════════════════════════════════

(async () => {
  const q = (s) => Array.from(document.querySelectorAll(s));

  //  1 · LE SCRIPT, DONC LA RACINE DES DONNÉES. Tout en dépend.
  const scripts = q("script[src]").map((x) => x.src)
    .filter((x) => x.indexOf("/js/wild-mystery.js") >= 0);
  const script = scripts.length ? scripts[scripts.length - 1] : null;
  const racine = script
    ? script.slice(0, script.lastIndexOf("/js/")) + "/data/"
    : null;

  //  2 · LE NUMÉRO DU SUJET, lu dans l'adresse.
  const sujet = (/\/t(\d+)/.exec(location.pathname) || [])[1] || null;

  //  3 · LE FORUM, lu dans le fil d'Ariane — les deux sélecteurs que
  //  le module regarde, et pas un de plus.
  const ariane = q(".sub-header-path a[href], .wm-sujet__ariane a[href]")
    .map((a) => a.getAttribute("href") || "")
    .filter((h) => /^\/f\d+-/.test(h));
  const forum = ariane.length
    ? Number(/^\/f(\d+)-/.exec(ariane[ariane.length - 1])[1])
    : null;

  const lire = (f) =>
    racine === null ? Promise.resolve(null) : fetch(racine + f)
      .then((r) => (r.ok ? r.text() : null)).catch(() => null);

  //  4 · LA ZONE. zones.json décide où le récap et le bilan se posent.
  const zones = await lire("zones.json");
  const zone = zones !== null && forum !== null &&
    new RegExp('"forumId"\\s*:\\s*' + forum + "\\b").test(zones);

  //  5 · L'ACCÈS SUPABASE.
  const brut = await lire("supabase.json");
  let conf = null;
  try {
    conf = brut === null ? null : JSON.parse(brut);
  } catch (e) { /* laissé à null */ }

  //  6 · LE LAISSEZ-PASSER, et ce que la base répond avec.
  let l = null;
  try {
    l = JSON.parse(localStorage.getItem("wm.carnet.laissez") || "null");
  } catch (e) { /* laissé à null */ }

  let combat = "pas appelé";
  let sien = "pas appelé";
  if (l && conf && sujet) {
    const appel = (f) =>
      fetch(conf.url + "/rest/v1/rpc/" + f, {
        method: "POST",
        credentials: "omit",
        headers: {
          apikey: conf.clePubliable,
          Authorization: "Bearer " + l.jeton,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ p: { sujetId: Number(sujet) } }),
      }).then((r) => (r.ok ? r.json() : "HTTP " + r.status))
        .catch((e) => String(e));
    combat = await appel("mon_combat");
    sien = await appel("mon_sujet");
  }

  console.log({
    script: script,
    racine: racine,
    sujet: sujet,
    forum: forum,
    zoneReconnue: zone,
    supabaseLu: conf !== null,
    laissez: l
      ? "oui, expire dans " + Math.round((l.expireLe - Date.now()) / 1000) + " s"
      : "AUCUN",
    mon_combat: combat,
    mon_sujet: sien,
  });
})();
