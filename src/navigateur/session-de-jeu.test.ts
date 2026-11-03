import { assert, assertEquals } from "@std/assert";
import {
  adresseSansJeton,
  encoreBon,
  type Laissez,
  laissezDuFragment,
  MARGE_MS,
  refusDuFragment,
} from "./session-de-jeu.ts";

const MAINTENANT = 1_762_000_000_000;

//  LA FORME DU FRAGMENT EST CELLE DE SUPABASE, flot implicite. Les
//  jetons sont raccourcis : ce qui est mesuré ici est la lecture du
//  fragment, pas la validité d'un JWT.
const RETOUR = "#access_token=aaa.bbb.ccc&expires_in=3600" +
  "&refresh_token=rrr&token_type=bearer&type=magiclink";

Deno.test("le laissez-passer se lit dans le fragment, avec son expiration", () => {
  const l = laissezDuFragment(RETOUR, MAINTENANT);
  assertEquals(l?.jeton, "aaa.bbb.ccc");
  assertEquals(l?.rafraichir, "rrr");
  assertEquals(l?.expireLe, MAINTENANT + 3_600_000);
});

Deno.test("UN RETOUR SANS JETON DE RAFRAÎCHISSEMENT EST UN ÉCHEC", () => {
  //  Sans lui la session meurt au bout d'une heure et la personne
  //  devrait se relier — ce serait rompre le « une seule fois ».
  const l = laissezDuFragment("#access_token=aaa&expires_in=3600", MAINTENANT);
  assertEquals(l, null);
});

Deno.test("une visite ordinaire n'a pas de laissez-passer dans son fragment", () => {
  assertEquals(laissezDuFragment("", MAINTENANT), null);
  assertEquals(laissezDuFragment("#mon-pokedex", MAINTENANT), null);
  assertEquals(laissezDuFragment("#attrape", MAINTENANT), null);
});

Deno.test("une expiration absente ou absurde retombe sur une heure", () => {
  const sans = laissezDuFragment("#access_token=a&refresh_token=r", MAINTENANT);
  assertEquals(sans?.expireLe, MAINTENANT + 3_600_000);
  const absurde = laissezDuFragment(
    "#access_token=a&refresh_token=r&expires_in=nimportequoi",
    MAINTENANT,
  );
  assertEquals(absurde?.expireLe, MAINTENANT + 3_600_000);
});

Deno.test("LA MARGE DÉCIDE : un jeton qui expire dans trente secondes est périmé", () => {
  //  Il serait encore valable au moment du test et mort à l'arrivée de
  //  la requête. C'est le genre de défaut qui ne se voit qu'en
  //  production, une fois sur cent.
  const bientot: Laissez = { jeton: "a", rafraichir: "r", expireLe: MAINTENANT + 30_000 };
  assertEquals(encoreBon(bientot, MAINTENANT), false);
  const large: Laissez = { jeton: "a", rafraichir: "r", expireLe: MAINTENANT + MARGE_MS + 1 };
  assertEquals(encoreBon(large, MAINTENANT), true);
});

Deno.test("un lien de connexion mort se lit dans le fragment", () => {
  //  Cliquer le lien du mail d'avant arrive tout le temps, et ce n'est
  //  pas une panne.
  assertEquals(
    refusDuFragment("#error=access_denied&error_code=otp_expired"),
    "access_denied",
  );
  assertEquals(refusDuFragment("#error_code=otp_expired"), "otp_expired");
  assertEquals(refusDuFragment(RETOUR), null);
  assertEquals(refusDuFragment("#mon-sac"), null);
});

Deno.test("LE JETON EST EFFACÉ DE L'ADRESSE, pas gardé dans l'historique", () => {
  //  Un fragment ne part jamais au serveur, mais il reste dans la barre,
  //  dans l'historique, et dans le lien qu'on copie pour demander de
  //  l'aide. Celui-là ouvre le carnet.
  assertEquals(
    adresseSansJeton("https://exemple.test/h15-mon-carnet" + RETOUR, RETOUR),
    "https://exemple.test/h15-mon-carnet",
  );
  assertEquals(
    adresseSansJeton(
      "https://exemple.test/h15?x=1#error=access_denied",
      "#error=access_denied",
    ),
    "https://exemple.test/h15?x=1",
  );
});

Deno.test("et une adresse sans jeton n'est pas touchée", () => {
  //  L'onglet ouvert vit dans le fragment : l'effacer renverrait sur
  //  « Mon jeu » quelqu'un qui lisait son Pokédex.
  const avecOnglet = "https://exemple.test/h15-mon-carnet#mon-pokedex";
  assertEquals(adresseSansJeton(avecOnglet, "#mon-pokedex"), avecOnglet);
  assert(adresseSansJeton(avecOnglet, "#mon-pokedex").includes("#mon-pokedex"));
});
