-- ════════════════════════════════════════════════════════════════════
--  0039 · La relève se réveille seule
--
--  « J'ai cliqué sur "faire apparaître un pokémon" mais y'a rien eu »,
--  13 novembre.
--
--  ── CE QUI MANQUAIT N'ÉTAIT NI LE BOUTON NI LA FONCTION ─────────────
--
--  Mesuré ce jour-là sur le forum : le message portait bien son
--  `[[WM-ACTION:chercher]]` — six marqueurs sur la page, aucun traité.
--  Le navigateur faisait son travail, et `supabase/functions/releve`
--  porte la tâche 1 depuis des semaines.
--
--  Ce qui manquait, c'est L'HORLOGE. La fonction attend qu'on
--  l'appelle, et rien ne l'appelait : ni `pg_cron`, ni `pg_net`, ni un
--  service dehors. Elle se déploie sur un tag `v*` par la CI, puis
--  dort. Un bouton qui écrit dans le vide et une fonction que personne
--  ne réveille font exactement le même bruit : aucun.
--
--  ── LA CLÉ N'EST PAS DANS CE FICHIER, ET NE PEUT PAS Y ÊTRE ─────────
--
--  Cette migration est dans le dépôt, qui est public. `WM_CLE_DE_RELEVE`
--  est ce qui empêche n'importe qui de déclencher la relève en boucle :
--  l'écrire ici reviendrait à la publier.
--
--  Elle est donc lue dans le COFFRE de Supabase (`vault`), au moment de
--  chaque appel. Les deux secrets sont posés à la main, une fois, dans
--  Supabase › Project Settings › Vault :
--
--      wm_url_releve      https://<projet>.supabase.co/functions/v1/releve
--      wm_cle_de_releve   la même valeur que le secret WM_CLE_DE_RELEVE
--                         des Edge Functions
--
--  Les deux doivent correspondre : la fonction compare en temps
--  constant, et répond 401 sans rien faire si elles diffèrent.
--
--  ── POURQUOI CINQ MINUTES, ET PAS PLUS SOUVENT ──────────────────────
--
--  C'est l'intervalle sur lequel tout le reste est écrit : le verrou
--  `releve_prendre_le_verrou` expire au bout de quatre minutes, et les
--  tâches qui coûtent cher au forum se rationnent elles-mêmes dans le
--  journal (une heure pour les RP, le ménage une fois par jour). Un
--  passage plus fréquent ne ferait rien de plus et taperait sur un
--  hébergement partagé qu'on ne possède pas.
--
--  ── LA FONCTION DOIT ÊTRE DÉPLOYÉE SANS VÉRIFICATION DE JWT ─────────
--
--  Par défaut, Supabase refuse une requête sans `Authorization: Bearer`
--  AVANT d'entrer dans la fonction. Le cron n'envoie que `x-wm-cle` :
--  la relève répondrait 401 sans jamais voir la clé, et la vue plus bas
--  montrerait des 401 en boucle sans dire pourquoi.
--
--  Le déploiement doit donc se faire avec `--no-verify-jwt`, dans le
--  CI :
--
--      supabase functions deploy releve --no-verify-jwt
--
--  Ce n'est pas un relâchement. La fonction a sa propre porte, et elle
--  est plus étroite : `WM_CLE_DE_RELEVE`, comparée en temps constant.
--  Le JWT qu'on retire serait la clé publiable, qui est publique par
--  construction et qui ne prouve rien.
--
--  ── ET SI UN PASSAGE DÉBORDE ────────────────────────────────────────
--
--  `net.http_post` ne bloque pas : il met la requête en file et rend la
--  main tout de suite. Deux passages peuvent donc se croiser si l'un
--  traîne — c'est précisément ce que le verrou en base empêche, et
--  c'est pour ça qu'il existe depuis le premier jour. Le délai est posé
--  à 55 secondes, sous la minute, pour qu'une requête morte ne reste
--  pas en file jusqu'au passage suivant.
-- ════════════════════════════════════════════════════════════════════

-- ── 0 · LA CI MONTE CE FICHIER SUR UN POSTGRES NU ──────────────────
--
--  Le travail « base » du CI rejoue toutes les migrations sur une image
--  `postgres:16` ordinaire, qui n'a ni `pg_cron`, ni `pg_net`, ni le
--  coffre de Supabase. Écrite sans précaution, cette migration rendait
--  le CI rouge sur une machine qui n'a aucune raison de planifier quoi
--  que ce soit.
--
--  Tout est donc posé dans un bloc qui REGARDE D'ABORD si les
--  extensions sont disponibles, et qui le DIT quand elles ne le sont
--  pas. Sauter en silence serait pire : on croirait la relève
--  planifiée.
--
--  Le bloc est écrit en SQL dynamique parce qu'un `create extension`
--  d'une extension absente fait échouer l'exécution du fichier entier ;
--  un `if` autour d'un ordre statique ne suffirait pas.

do $planifier$
declare
  dispo boolean;
begin
  select count(*) = 2 into dispo
    from pg_available_extensions
   where name in ('pg_cron', 'pg_net');

  if not dispo then
    raise notice
      'pg_cron ou pg_net indisponible : la releve n''est PAS planifiee ici. '
      'Normal sur une base de test ; sur Supabase, c''est un defaut.';
    return;
  end if;

  --  ── les deux extensions ─────────────────────────────────────────
  --
  --  `pg_cron` ne vit que dans la base `postgres` ; `pg_net` pose ses
  --  files dans son propre schéma. Jamais dans `public`, qui est
  --  exposé par PostgREST.
  execute 'create extension if not exists pg_cron with schema pg_catalog';
  execute 'create extension if not exists pg_net  with schema extensions';

  --  ── le réveil, toutes les cinq minutes ──────────────────────────
  --
  --  `cron.schedule` sur un nom qui existe déjà le REMPLACE. La
  --  migration peut donc repasser sans empiler deux horloges — et elle
  --  repassera, puisque `supabase db push` rejoue tout sur une base
  --  neuve.
  perform cron.schedule(
    'wm-releve',
    '*/5 * * * *',
    $tache$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets
                 where name = 'wm_url_releve'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          -- L'EN-TÊTE S'APPELLE `x-wm-cle`, et la fonction ne lit que
          -- celui-là (`index.ts`). Un nom approchant donne un 401 que
          -- rien ne distingue d'une mauvaise clé.
          'x-wm-cle', (select decrypted_secret from vault.decrypted_secrets
                        where name = 'wm_cle_de_releve')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      );
    $tache$
  );

  --  ── de quoi voir qu'elle tourne ─────────────────────────────────
  --
  --  Sans ça, « est-ce que la relève tourne ? » se répond en fouillant
  --  deux tables système dont personne ne retient le nom.
  --
  --  ELLE EST RÉSERVÉE AU STAFF : la réponse de la relève nomme les
  --  joueurs traités, et la file garde les en-têtes de la requête —
  --  donc la clé.
  --  ON NE JOINT PAS LA FILE. `net.http_request_queue` SE VIDE dès que
  --  la requête est partie : la jointure aurait rendu zéro ligne, et la
  --  vue aurait fait croire que rien n'était parti. `_http_response`
  --  porte déjà la date, et c'est la seule qui reste.
  execute $vue$
    create or replace view releve_les_reveils as
      select id,
             created               as parti_le,
             status_code           as reponse,
             error_msg             as erreur,
             left(content, 2000)   as dit
        from net._http_response
       order by created desc
       limit 20
  $vue$;
  execute 'revoke all on releve_les_reveils from public';
  execute 'revoke all on releve_les_reveils from anon, authenticated';
  execute 'grant select on releve_les_reveils to service_role';
  execute $c$
    comment on view releve_les_reveils is
      'Les vingt derniers reveils de la releve : quand, quelle reponse HTTP, '
      'et ce que la fonction a repondu. Reservee a service_role.'
  $c$;
end
$planifier$;
