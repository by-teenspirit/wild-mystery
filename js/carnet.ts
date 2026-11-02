/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  js/carnet.ts — le troisième paquet, et il ne sert qu'à une page
//
//  POURQUOI PAS `wild-mystery.js`. Même raison que pour les annexes :
//  `/h15-mon-carnet` est créée SANS l'en-tête du forum, donc sans
//  jQuery, sans `_userdata`, sans les scripts de la Gestion des codes.
//  Et le gros paquet réécrit une barre d'outils qui n'existe pas ici,
//  pose le tchat, les territoires — et monte le switcheroo, qui écrit
//  des mots de passe dans le navigateur. Il n'a rien à faire sur cette
//  page.
//
//  POURQUOI PAS `annexes.js` NON PLUS. Celui-là ne sait poser qu'un
//  sommaire. Le carnet demande un appel à Supabase, une clé gardée et
//  trois vues : c'est un autre métier, et le mélanger ferait payer aux
//  quatorze annexes le poids du carnet.
//
//  ── L'ORDRE, ET IL COMPTE ───────────────────────────────────────────
//
//  1. Le thème, tout de suite : chaque milliseconde de retard est un
//     éclair blanc chez quelqu'un en thème sombre.
//  2. Les onglets, avant même d'avoir des données : la page doit
//     répondre au clic pendant que ça charge.
//  3. La clé. Pas de clé, pas de requête — on demande, et on s'arrête.
//  4. Un seul appel, puis les trois vues peintes d'un coup.
// ════════════════════════════════════════════════════════════════════
import {
  CLE_DE_STOCKAGE,
  type Decor,
  direLeSouci,
  poserLaBarre,
  poserLEtat,
  poserLesOnglets,
  poserMonJeu,
  poserMonPokedex,
  poserMonSac,
} from "../src/adaptateurs/navigateur/module-carnet.ts";
import { poserLeTheme } from "../src/adaptateurs/navigateur/module-theme-annexe.ts";
import { Preferences } from "../src/navigateur/preferences.ts";
import { StockageLocal } from "../src/adaptateurs/navigateur/stockage.ts";
import {
  adresseDuScript,
  especesDepuis,
  racineDesDonnees,
  racineDesImages,
} from "../src/adaptateurs/navigateur/catalogue.ts";
import { appeler, RefusSupabase } from "../src/adaptateurs/navigateur/supabase.ts";
import { configDepuis } from "../src/adaptateurs/navigateur/registre.ts";
import type { Carnet } from "../src/navigateur/carnet.ts";
import { blocDeReclamation, secretBienForme } from "../src/domaine/reclamation.ts";
import {
  adresseDeReponse,
  empreinteDuSecret,
  tirerUnSecret,
} from "../src/adaptateurs/navigateur/reclamation.ts";

const RACINE = racineDesDonnees(adresseDuScript(document));
const IMAGES = racineDesImages(adresseDuScript(document));

poserLeTheme(document, new Preferences(new StockageLocal()));

function lireLaCle(): string | null {
  try {
    const v = localStorage.getItem(CLE_DE_STOCKAGE);
    return v !== null && /^[0-9a-f]{32}$/.test(v) ? v : null;
  } catch {
    //  Navigation privée, stockage refusé : on demandera la clé à
    //  chaque visite. C'est pénible, ce n'est pas cassé.
    return null;
  }
}

function garderLaCle(cle: string): void {
  try {
    localStorage.setItem(CLE_DE_STOCKAGE, cle);
  } catch { /* voir ci-dessus */ }
}

function oublierLaCle(): void {
  try {
    localStorage.removeItem(CLE_DE_STOCKAGE);
  } catch { /* idem */ }
}

async function lire(nom: string): Promise<unknown> {
  if (RACINE === null) return null;
  return await fetch(`${RACINE}${nom}`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

async function decorDuCarnet(): Promise<Decor> {
  const [especes, objets, arenes, dex, groupes] = await Promise.all([
    lire("especes.json"),
    lire("objets.json"),
    lire("arenes.json"),
    lire("pokedex-carnet.json"),
    lire("groupes.json"),
  ]);
  const liste = (d: unknown, clef: string): unknown[] => {
    if (typeof d !== "object" || d === null) return [];
    const v = (d as Record<string, unknown>)[clef];
    return Array.isArray(v) ? v : [];
  };
  return {
    especes: especesDepuis(especes),
    objets: liste(objets, "objets") as Decor["objets"],
    arenes: liste(arenes, "arenes") as Decor["arenes"],
    pokedex: liste(dex, "especes") as Decor["pokedex"],
    zones: liste(dex, "zones") as Decor["zones"],
    groupes: liste(groupes, "groupes") as Decor["groupes"],
    images: IMAGES,
  };
}

/** Le mot qu'on montre à la joueuse pour un refus de la base.
 *
 *  ON NE RECOPIE PAS LE MESSAGE DE POSTGRESQL : `CLE_INVALIDE` ne veut
 *  rien dire pour qui vient de coller une clé, et un texte d'erreur
 *  technique dans une page de jeu fait peur pour rien. */
function motDuRefus(e: unknown): string {
  if (e instanceof RefusSupabase && e.code === "CLE_INVALIDE") {
    return "Cette clé n'est pas reconnue. Vérifie que tu l'as collée en entier, " +
      "ou demande au staff de t'en donner une nouvelle.";
  }
  return "Le carnet n'a pas pu être chargé. Réessaie dans un moment.";
}

async function ouvrirLeCarnet(cle: string): Promise<void> {
  poserLEtat(document, "charge");
  direLeSouci(document, "");

  const config = configDepuis(await lire("supabase.json"));
  if (config === null) {
    direLeSouci(document, "Le carnet n'a pas pu joindre le serveur de jeu.");
    poserLEtat(document, "cle");
    return;
  }

  let brut: unknown;
  try {
    brut = await appeler(config, "carnet", { cle });
  } catch (e) {
    direLeSouci(document, motDuRefus(e));
    poserLEtat(document, "cle");
    return;
  }
  if (typeof brut !== "object" || brut === null) {
    direLeSouci(document, motDuRefus(null));
    poserLEtat(document, "cle");
    return;
  }

  //  LA CLÉ N'EST GARDÉE QU'UNE FOIS QU'ELLE A SERVI. L'écrire avant
  //  l'appel mettrait une clé fausse dans le navigateur, et la page
  //  rouvrirait sur la même erreur à chaque visite.
  garderLaCle(cle);

  const carnet = brut as Carnet;
  const decor = await decorDuCarnet();
  poserLaBarre(document, carnet, "mon-jeu", decor);
  poserMonJeu(document, carnet, decor);
  poserMonSac(document, carnet, decor);
  poserMonPokedex(document, carnet, decor);
  poserLEtat(document, "pret");
  //  LA BARRE SUIT L'ONGLET OUVERT, et elle ne pouvait pas le faire
  //  avant d'avoir le dresseur à écrire dedans.
  poserLesOnglets(document, (actif) => poserLaBarre(document, carnet, actif, decor));
}

//  LES ONGLETS D'ABORD, SANS DONNÉES. Cliquer doit marcher pendant que
//  ça charge, sinon la page a l'air morte.
poserLesOnglets(document, () => {});

/* ── ouvrir son carnet en postant ─────────────────────────────────── */

const CLE_DU_SECRET = "wm.carnet.secret";

/** Le secret de cette page : celui qui traîne, ou un neuf.
 *
 *  ON LE GARDE ENTRE DEUX VISITES, et c'est indispensable : le joueur
 *  poste, ferme l'onglet, revient dix minutes plus tard. Un secret
 *  tiré à chaque chargement ne retrouverait jamais sa réclamation. */
function secretDeLaPage(): string {
  try {
    const garde = localStorage.getItem(CLE_DU_SECRET);
    if (garde !== null && secretBienForme(garde)) return garde;
  } catch { /* stockage refusé : on en tire un pour cette visite */ }
  const neuf = tirerUnSecret();
  try {
    localStorage.setItem(CLE_DU_SECRET, neuf);
  } catch { /* idem */ }
  return neuf;
}

function oublierLeSecret(): void {
  try {
    localStorage.removeItem(CLE_DU_SECRET);
  } catch { /* idem */ }
}

async function poserLOuverture(): Promise<void> {
  const bloc = document.querySelector<HTMLElement>("[data-wm-carnet-ouvrir]");
  if (bloc === null) return;

  const config = await lire("carnet.json");
  const sujet = (config as { sujet?: unknown } | null)?.sujet;
  //  SANS SUJET CONFIGURÉ, ON NE MONTRE RIEN. Un code à poster sans
  //  dire où le poster ferait perdre dix minutes à chaque joueur.
  if (typeof sujet !== "number") return;

  const secret = secretDeLaPage();
  const empreinte = await empreinteDuSecret(secret);
  const code = blocDeReclamation(empreinte);

  const vue = document.querySelector("[data-wm-carnet-empreinte]");
  if (vue !== null) vue.textContent = code;
  const lien = document.querySelector<HTMLAnchorElement>("[data-wm-carnet-poster]");
  if (lien !== null) lien.href = adresseDeReponse(sujet, code);
  bloc.hidden = false;

  document.querySelector("[data-wm-carnet-jai-poste]")?.addEventListener("click", () => {
    reclamer(secret).catch(() => direLeSouci(document, motDuRefus(null)));
  });
}

/** Échange le secret contre la clé — et demande confirmation du nom.
 *
 *  POURQUOI DEMANDER. L'empreinte est publique : quelqu'un pourrait la
 *  recopier et la poster avant le joueur. La base garde alors la
 *  PREMIÈRE, donc celle du copieur, et le joueur recevrait une clé qui
 *  ouvre le carnet de l'autre. En base les deux messages sont
 *  identiques — rien ne les distingue là-bas. Ici, le nom se lit. */
async function reclamer(secret: string): Promise<void> {
  direLeSouci(document, "");
  const config = configDepuis(await lire("supabase.json"));
  if (config === null) {
    direLeSouci(document, "Le carnet n'a pas pu joindre le serveur de jeu.");
    return;
  }

  let recu: unknown;
  try {
    recu = await appeler(config, "carnet_reclamer", { secret });
  } catch (e) {
    direLeSouci(
      document,
      e instanceof RefusSupabase && e.code === "RECLAMATION_INCONNUE"
        ? "Je ne vois pas encore ton message. La relève passe toutes les cinq " +
          "minutes : laisse-lui un instant, puis reclique."
        : motDuRefus(e),
    );
    return;
  }

  const r = recu as { cle?: unknown; pseudo?: unknown };
  if (typeof r?.cle !== "string" || typeof r?.pseudo !== "string") {
    direLeSouci(document, motDuRefus(null));
    return;
  }

  const dit = document.querySelector<HTMLElement>("[data-wm-carnet-confirmer]");
  if (dit !== null) {
    dit.hidden = false;
    dit.textContent = `Reconnu : ${r.pseudo}. Si ce n'est pas toi, ne garde pas ce carnet ` +
      `et préviens le staff.`;
  }
  oublierLeSecret();
  await ouvrirLeCarnet(r.cle);
}

const formulaire = document.querySelector<HTMLFormElement>("[data-wm-carnet-formulaire]");
formulaire?.addEventListener("submit", (e) => {
  e.preventDefault();
  const champ = formulaire.querySelector<HTMLInputElement>("input");
  const cle = (champ?.value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(cle)) {
    direLeSouci(document, "Une clé fait 32 caractères, des chiffres et les lettres a à f.");
    return;
  }
  ouvrirLeCarnet(cle).catch(() => direLeSouci(document, motDuRefus(null)));
});

document.querySelector("[data-wm-carnet-oublier]")?.addEventListener("click", () => {
  oublierLaCle();
  poserLEtat(document, "cle");
  direLeSouci(document, "Clé oubliée sur cet ordinateur.");
  poserLOuverture().catch(() => {});
});

const gardee = lireLaCle();
if (gardee === null) {
  poserLEtat(document, "cle");
  poserLOuverture().catch(() => {});
}
else {ouvrirLeCarnet(gardee).catch(() => {
  direLeSouci(document, motDuRefus(null));
  poserLEtat(document, "cle");
  poserLOuverture().catch(() => {});
});}
