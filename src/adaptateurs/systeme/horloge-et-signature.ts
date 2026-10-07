// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/systeme/horloge-et-signature.ts
//
//  Les deux adaptateurs qui touchent au monde sans passer par le réseau :
//  l'heure, et la signature.
//
//  Ils sont ici et pas dans le domaine parce que le domaine n'a pas le
//  droit de lire l'horloge ni d'appeler `crypto` — le garde-fou le refuse,
//  et c'est ce qui garde les règles rejouables à l'identique.
// ════════════════════════════════════════════════════════════════════

import type { Horloge, Signataire } from "../../application/ports.ts";

export class HorlogeSysteme implements Horloge {
  maintenant(): Date {
    return new Date();
  }
}

/** Une horloge figée, pour les tests et pour rejouer un passage.
 *
 *  Elle garde un NOMBRE, pas la `Date` qu'on lui donne : une `Date` est
 *  modifiable, et l'appelant qui garderait la sienne pourrait décaler
 *  l'horloge après coup. Elle rend aussi une copie à chaque appel, pour la
 *  même raison dans l'autre sens. */
export class HorlogeFigee implements Horloge {
  private readonly instant: number;

  constructor(instant: Date) {
    this.instant = instant.getTime();
  }

  maintenant(): Date {
    return new Date(this.instant);
  }
}

export class SecretManquant extends Error {
  constructor() {
    super(
      "Le secret de signature est vide. Sans lui, un joueur pourrait " +
        "fabriquer un code de vérification et se faire créditer d'une capture.",
    );
    this.name = "SecretManquant";
  }
}

/**
 * La signature des codes de vérification : HMAC-SHA-256, par la Web Crypto
 * API — présente dans Deno comme dans le navigateur, donc rien à recopier
 * dans `vendoreur/`.
 *
 * Le secret ne vit que dans les secrets de la fonction Edge. Il ne part
 * jamais vers le navigateur : c'est pour ça que le code de vérification est
 * fabriqué côté serveur et seulement **relu** côté client.
 */
export class SignataireHmac implements Signataire {
  private cle: Promise<CryptoKey> | null = null;

  constructor(private readonly secret: string) {
    if (secret.trim() === "") throw new SecretManquant();
  }

  private clef(): Promise<CryptoKey> {
    // Importée une seule fois : la relève signe des dizaines de fois par
    // passage.
    if (this.cle === null) {
      this.cle = crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(this.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
    }
    return this.cle;
  }

  async empreinte(message: string): Promise<Uint8Array> {
    const signature = await crypto.subtle.sign(
      "HMAC",
      await this.clef(),
      new TextEncoder().encode(message),
    );
    return new Uint8Array(signature);
  }
}
