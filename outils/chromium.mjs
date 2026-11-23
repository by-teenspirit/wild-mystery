// ════════════════════════════════════════════════════════════════════
//  Où est Chromium — une seule réponse, pour tous les harnais.
//
//  ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────
//
//  Le 23 novembre, le harnais du sujet n'a pas démarré :
//
//      Executable doesn't exist at
//      /opt/pw-browsers/chromium_headless_shell-1194/…
//
//  Sa liste de chemins était FIGÉE sur une version de Playwright, et la
//  machine en avait une autre. Trente harnais portent la même liste
//  recopiée ; seul celui du carnet cherchait vraiment, parce qu'il
//  s'était déjà cogné au problème.
//
//  **UNE LISTE RECOPIÉE TRENTE FOIS EST UNE LISTE QU'ON NE MET À JOUR
//  NULLE PART.** Celle-ci vit à un seul endroit, et la mise à jour
//  suivante se fera une fois.
//
//  ── ET SURTOUT : UN HARNAIS QUI NE DÉMARRE PAS DOIT ÉCHOUER ─────────
//
//  C'est le vrai défaut, et il est pire que le chemin. Le lancement
//  ratait dans une promesse de haut niveau, Deno rendait **le code
//  0**, et le CI lisait « réussi » sur un harnais qui n'avait pas
//  ouvert une seule page. Un contrôle qui ne tourne pas ne doit jamais
//  ressembler à un contrôle qui passe.
//
//  `ouvrirChromium` lève une erreur claire plutôt que de rendre une
//  valeur, et les harnais sortent en code 1.
// ════════════════════════════════════════════════════════════════════

/*  CEUX QU'ON CONNAÎT, essayés en premier : c'est le cas ordinaire du
    CI, et un `stat` coûte moins qu'un parcours de dossier. */
const CONNUS = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux64/chrome",
];

const RACINES = ["/root/.cache/ms-playwright", "/opt/pw-browsers"];
const DEDANS = ["chrome-linux/chrome", "chrome-linux64/chrome"];

/** Le chemin d'un Chromium utilisable, ou `undefined`.
 *
 *  ON ÉCARTE `chromium_headless_shell` : c'est le paquet réduit que
 *  Playwright installe à côté, il ne range pas son binaire dans un
 *  dossier `chrome-linux`, et c'est précisément celui sur lequel le
 *  message d'erreur du 23 novembre pointait. */
export function chercherChromium() {
  for (const c of CONNUS) {
    try {
      Deno.statSync(c);
      return c;
    } catch { /* suivant */ }
  }
  //  LE PLUS RÉCENT GAGNE : plusieurs versions cohabitent après une
  //  mise à jour de Playwright, et `chromium-1243` doit l'emporter sur
  //  `chromium-1194` resté là. Le tri est sur le numéro, pas sur le
  //  texte — sinon « 1194 » passerait après « 1243 » une fois sur
  //  deux selon la longueur.
  const trouves = [];
  for (const base of RACINES) {
    let entrees;
    try {
      entrees = [...Deno.readDirSync(base)];
    } catch {
      continue;
    }
    for (const e of entrees) {
      if (!e.name.startsWith("chromium") || e.name.includes("headless_shell")) continue;
      for (const n of DEDANS) {
        const c = `${base}/${e.name}/${n}`;
        try {
          Deno.statSync(c);
          trouves.push([Number(/(\d+)$/.exec(e.name)?.[1] ?? 0), c]);
        } catch { /* suivant */ }
      }
    }
  }
  trouves.sort((a, b) => b[0] - a[0]);
  return trouves[0]?.[1];
}

/** Ouvre Chromium, ou LÈVE.
 *
 *  Elle lève plutôt que de rendre `{}` à `launch` : sans
 *  `executablePath`, Playwright cherche son propre paquet, ne le
 *  trouve pas, et affiche une bannière « npx playwright install » qui
 *  ressemble à un conseil plutôt qu'à une panne. */
export async function ouvrirChromium(chromium, options = {}) {
  const chemin = chercherChromium();
  if (chemin === undefined) {
    throw new Error(
      "Aucun Chromium trouvé sous /opt/pw-browsers ni /root/.cache/ms-playwright. " +
        "`deno task test:navigateur` en installe un.",
    );
  }
  return await chromium.launch({ ...options, executablePath: chemin });
}
