-- ════════════════════════════════════════════════════════════════════
--  0022 · Les groupes sont les six natures
--
--  ── CE QUI A CHANGÉ, ET OÙ LA BASE EST RESTÉE ───────────────────────
--
--  `0001` contraignait `joueur.groupe` à six légendaires :
--
--      ho-oh · reshiram · deoxys · xerneas · zamazenta · mew
--
--  Les groupes sont devenus les six NATURES (planche 79) :
--
--      hardi · serieux · malin · doux · brave · jovial
--
--  Relevé le 2 novembre : `data/groupes.json` porte les six natures
--  avec leur nom, leur description, leur avantage et leur emblème ;
--  `assets/groupes/` porte leurs six images ; le code à coller de la
--  carte dresseur les nomme dans `data-wm-nature`. **Les anciens
--  légendaires ne survivent plus nulle part dans le dépôt que dans
--  cette contrainte.** Elle refusait donc tout groupe réel : poser
--  « hardi » sur un joueur levait `joueur_groupe_check`.
--
--  ── LES LIGNES QUI PORTENT UNE VIEILLE VALEUR ───────────────────────
--
--  Elles sont remises à `null` avant que la nouvelle contrainte entre,
--  sinon elle ne peut pas s'appliquer. **On ne traduit pas un
--  légendaire en nature** : Mew n'est pas Doux, et inventer la
--  correspondance mettrait un groupe faux sur le personnage de
--  quelqu'un. `null` veut dire « à redire », ce qui est la vérité.
--  Le compte est affiché à l'application.
--
--  `groupe` reste nullable : un joueur lié avant d'avoir choisi sa
--  maison n'a pas de groupe, et c'est un état normal.
-- ════════════════════════════════════════════════════════════════════

do $$
declare n integer;
begin
  update joueur set groupe = null
   where groupe is not null
     and groupe not in ('hardi', 'serieux', 'malin', 'doux', 'brave', 'jovial');
  get diagnostics n = row_count;
  if n > 0 then
    raise notice '% joueur(s) portaient un ancien groupe : remis à null, à redire.', n;
  end if;
end $$;

alter table joueur drop constraint if exists joueur_groupe_check;

alter table joueur add constraint joueur_groupe_check
  check (groupe in ('hardi', 'serieux', 'malin', 'doux', 'brave', 'jovial'));

comment on column joueur.groupe is
  'L''une des six natures de Rhode : hardi, serieux, malin, doux, '
  'brave, jovial. Mêmes clés que `data/groupes.json` et que les images '
  'de `assets/groupes/`. `null` tant que le joueur n''a pas choisi.';
