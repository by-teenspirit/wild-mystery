/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  js/carte.ts — l'annexe de la carte, et elle seule
//
//  ── POURQUOI UN QUATRIÈME PAQUET ────────────────────────────────────
//
//  La carte pèse un millier de lignes. Mise dans `annexes.js`, elle
//  serait téléchargée par les QUATORZE pages d'annexe pour servir sur
//  UNE — le paquet passerait de 6 Ko à une quarantaine. Les treize
//  autres n'ont rien à payer pour celle-ci.
//
//  La page charge donc deux scripts : `annexes.js` pour le sommaire et
//  le thème, comme ses sœurs, et celui-ci pour la carte. L'ordre n'a
//  pas d'importance, les deux remplissent des trous différents.
//
//  ── ET IL NE CHARGE PAS `wild-mystery.js` ───────────────────────────
//
//  Même raison que `annexes.js` : ce paquet-là suppose un DOM de forum,
//  et il monte le switcheroo, qui écrit des mots de passe dans le
//  `localStorage`. Il n'a rien à faire sur une page d'annexe.
// ════════════════════════════════════════════════════════════════════
import { poserLAnnexeDeLaCarte } from "../src/adaptateurs/navigateur/module-faune.ts";
import {
  adresseDuScript,
  racineDesDonnees,
  racineDuDepot,
} from "../src/adaptateurs/navigateur/catalogue.ts";
import { Preferences } from "../src/navigateur/preferences.ts";
import { StockageLocal } from "../src/adaptateurs/navigateur/stockage.ts";
import { dexDuJoueur } from "../src/adaptateurs/navigateur/dex-du-joueur.ts";
import { configDepuis, type ConfigSupabase } from "../src/adaptateurs/navigateur/registre.ts";

//  `currentScript` n'est renseigné que pendant l'exécution initiale du
//  module : on le lit tout de suite, pas après le premier `await`.
const ADRESSE = adresseDuScript(document);
const RACINE = racineDesDonnees(ADRESSE);
const DEPOT = racineDuDepot(ADRESSE);

/** `prefers-reduced-motion`, lu une fois. Il fige TOUT : une personne
 *  qui demande moins d'animation ne demande pas « moins sauf là où
 *  c'est joli ». */
function mouvementRefuse(): boolean {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

/** L'accès à Supabase, ou `null`. Il ne sert qu'aux marques du dex : un
 *  fichier absent n'empêche donc rien d'autre. */
async function acces(racine: string): Promise<ConfigSupabase | null> {
  const brut = await fetch(`${racine}supabase.json`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return configDepuis(brut);
}

async function poser(): Promise<void> {
  if (RACINE === null || DEPOT === null) return;
  const racine = RACINE;
  await poserLAnnexeDeLaCarte({
    doc: document,
    racine: RACINE,
    depot: DEPOT,
    style: new Preferences(new StockageLocal()).styleDeSprite(),
    mouvementRefuse: mouvementRefuse(),
    //  « Ne rends pas les villes cliquables, on en a pas besoin » :
    //  elles restent dessinées, parce qu'elles situent les zones, mais
    //  un clic dessus ne pouvait répondre que « aucune faune ici ».
    sansVilles: true,
    //  ── LE CARNET DU JOUEUR, S'IL EN A UN ─────────────────────────
    //
    //  « Affiche une icône si on l'a déjà vu ou si on l'a dans notre
    //  pokedex, c'est possible ça ? » (5 novembre)
    //
    //  C'EST UNE FONCTION, ET ELLE N'EST PAS ATTENDUE. La carte se pose
    //  sans elle ; les marques arrivent après, sur les cartes déjà
    //  construites. Un invité ne déclenche AUCUN appel : le
    //  laissez-passer est lu dans le navigateur avant toute requête, et
    //  s'il n'y en a pas, la lecture s'arrête là.
    dexDuJoueur: async () => await dexDuJoueur({ acces: await acces(racine) }),
  });
}

//  LA PAGE RESTE LISIBLE SANS CE SCRIPT : les dix-sept zones, leurs
//  niveaux et leur compte d'espèces sont écrits en dur dedans. On
//  n'affiche donc aucune erreur — il manquerait une carte, pas le
//  contenu.
poser().catch(() => {});
