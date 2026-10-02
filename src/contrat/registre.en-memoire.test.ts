// ════════════════════════════════════════════════════════════════════
//  src/contrat/registre.en-memoire.test.ts
//  La suite de contrat, passée au faux.
//  Le vrai la passera aussi, dans registre.supabase.test.ts.
// ════════════════════════════════════════════════════════════════════

import { RegistreEnMemoire } from "../adaptateurs/en-memoire/registre.ts";
import { type Chantier, contratDuRegistre } from "./registre.contrat.ts";

contratDuRegistre("en mémoire", (): Promise<Chantier> =>
  Promise.resolve({
    registre: new RegistreEnMemoire(),
    ranger: (): Promise<void> => Promise.resolve(),
  }));
