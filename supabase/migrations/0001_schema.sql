-- La Ligue des Copains — schéma de base (multi-saisons)
-- À exécuter dans l'éditeur SQL de Supabase (ou via `supabase db push`).

create type member_role as enum (
  'president',            -- Greg R. (art. 1 : a toujours raison)
  'premier_ministre',     -- Steve L. (reçoit les bonus cachés du Président, art. 5)
  'president_commission', -- Seb D.
  'secretaire',           -- Alex G.
  'charge_mission',       -- Jéré R. (aucun pouvoir de décision)
  'membre'
);

create type matchday_type as enum ('classique', 'multiplex');
create type matchday_status as enum ('brouillon', 'publiee', 'terminee');

create type prediction_status as enum (
  'auto_valide',        -- parsé sans anomalie, comptabilisé sauf décision contraire
  'a_examiner',         -- anomalie détectée, en attente de la Commission
  'comptabilise',       -- validé par la Commission
  'non_comptabilise'    -- refusé par la Commission (art. 7/8) ou doublon écarté (art. 6)
);

create type bonus_type as enum (
  'vainqueur',       -- 15 pts
  'buteur',          -- 20 pts
  'passeur',         -- 25 pts
  'top3',            -- ordre 25 / désordre 15
  'bottom3',         -- ordre 25 / désordre 15
  'classement_tfc'   -- 10 pts (à l'issue de la J34)
);

create type ledger_type as enum ('mise', 'amende', 'ajustement');

-- ---------------------------------------------------------------------------
-- Profils (1 ligne par membre, créée automatiquement à l'inscription ;
-- les profils traversent les saisons)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role member_role not null default 'membre',
  is_radie boolean not null default false, -- art. 3
  created_at timestamptz not null default now()
);

-- Art. 4 : 20 membres maximum (les radiés ne libèrent pas leur place,
-- ils restent comptés pour garder l'historique — le Bureau peut purger).
create function enforce_member_cap() returns trigger
language plpgsql security definer as $$
begin
  if (select count(*) from profiles) >= 20 then
    raise exception 'Article 4 : 20 membres maximum';
  end if;
  return new;
end $$;

create trigger member_cap before insert on profiles
  for each row execute function enforce_member_cap();

-- Création automatique du profil à l'inscription.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Saisons : la ligue se rejoue chaque année (2025-26, 2026-27, …).
-- Une seule saison « courante » à la fois ; les autres sont en préparation
-- ou archivées (leur classement reste consultable).
-- ---------------------------------------------------------------------------
create table seasons (
  id serial primary key,
  name text not null unique,                       -- « Ligue 1 2025-2026 »
  mise_cents int not null default 2000,            -- art. 2 : 20 €
  part_vainqueur_cents int not null default 1500,  -- 15 € × candidats
  part_ballon_or_cents int not null default 500,   -- 5 € pour le Ballon d'Or
  paiement_deadline date not null,                 -- art. 3
  bonus_deadline timestamptz not null,             -- dépôt des bonus cachés
  bonus_reveles boolean not null default false,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index seasons_single_current on seasons ((true)) where is_current;

-- ---------------------------------------------------------------------------
-- Équipes : le référentiel des clubs traverse les saisons ; la composition
-- de la Ligue 1 (18 clubs, promus/relégués) et les 5 « équipes concernées »
-- se règlent saison par saison dans season_teams.
-- ---------------------------------------------------------------------------
create table teams (
  id serial primary key,
  short_name text not null unique,   -- écriture canonique attendue (art. 7)
  full_name text not null,
  aliases text[] not null default '{}'
);

create table season_teams (
  season_id int not null references seasons (id) on delete cascade,
  team_id int not null references teams (id) on delete cascade,
  tracked boolean not null default false, -- équipe concernée cette saison-là
  primary key (season_id, team_id)
);

-- ---------------------------------------------------------------------------
-- Journées et matchs
-- ---------------------------------------------------------------------------
create table matchdays (
  id serial primary key,
  season_id int not null references seasons (id) on delete cascade,
  number int not null,
  type matchday_type not null default 'classique',
  status matchday_status not null default 'brouillon', -- art. 10 : pas jouable avant diffusion
  published_at timestamptz,
  unique (season_id, number)
);

create table fixtures (
  id serial primary key,
  matchday_id int not null references matchdays (id) on delete cascade,
  position int not null,             -- ordre de la programmation (art. 10)
  home_team_id int not null references teams (id),
  away_team_id int not null references teams (id),
  kickoff_at timestamptz not null,   -- verrouillage à kickoff - 30 min (art. 6)
  home_score int,
  away_score int,
  unique (matchday_id, position),
  check (home_team_id <> away_team_id),
  check ((home_score is null) = (away_score is null))
);

-- ---------------------------------------------------------------------------
-- Pronostics : saisie libre, insert-only, texte brut horodaté faisant foi.
-- Aucune modification ni suppression possible (art. 12).
-- ---------------------------------------------------------------------------
create table predictions (
  id uuid primary key default gen_random_uuid(),
  fixture_id int not null references fixtures (id) on delete cascade,
  member_id uuid not null references profiles (id) on delete cascade,
  raw_text text not null,
  home_score_parsed int,
  away_score_parsed int,
  status prediction_status not null default 'a_examiner',
  flag_reason text,                  -- ex : « doublon (article 6) », « ambigu (article 7) »
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index predictions_fixture_member on predictions (fixture_id, member_id, created_at);

-- ---------------------------------------------------------------------------
-- Bonus cachés : scellés jusqu'à la révélation, par saison.
-- ---------------------------------------------------------------------------
create table hidden_bonuses (
  id uuid primary key default gen_random_uuid(),
  season_id int not null references seasons (id) on delete cascade,
  member_id uuid not null references profiles (id) on delete cascade,
  type bonus_type not null,
  answer jsonb not null,             -- {"value": "PSG"} ou {"values": ["A","B","C"]} (ordonné)
  points_awarded int,                -- attribué en fin de saison par le Président
  submitted_at timestamptz not null default now(),
  unique (season_id, member_id, type)
);

-- ---------------------------------------------------------------------------
-- Trésorerie (art. 2 & 3) : registre par saison, pas de paiement réel.
-- ---------------------------------------------------------------------------
create table ledger (
  id uuid primary key default gen_random_uuid(),
  season_id int not null references seasons (id) on delete cascade,
  member_id uuid not null references profiles (id) on delete cascade,
  type ledger_type not null,
  amount_cents int not null,
  note text,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ajustements de points (sanctions art. 12, 21-24, décisions du Bureau…)
-- ---------------------------------------------------------------------------
create table point_adjustments (
  id uuid primary key default gen_random_uuid(),
  season_id int not null references seasons (id) on delete cascade,
  member_id uuid not null references profiles (id) on delete cascade,
  matchday_id int references matchdays (id) on delete set null,
  points int not null,
  reason text not null,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS : lecture pour les membres authentifiés, écritures uniquement via les
-- server actions de l'app (clé service role). Personne ne peut modifier ou
-- supprimer un pronostic, même pas le Président (art. 12).
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table seasons enable row level security;
alter table teams enable row level security;
alter table season_teams enable row level security;
alter table matchdays enable row level security;
alter table fixtures enable row level security;
alter table predictions enable row level security;
alter table hidden_bonuses enable row level security;
alter table ledger enable row level security;
alter table point_adjustments enable row level security;

create policy "profils visibles de tous les membres"
  on profiles for select to authenticated using (true);

create policy "saisons visibles"
  on seasons for select to authenticated using (true);

create policy "équipes visibles"
  on teams for select to authenticated using (true);

create policy "composition des saisons visible"
  on season_teams for select to authenticated using (true);

-- Art. 10 : une journée en brouillon n'existe pas pour les membres.
create policy "journées publiées visibles"
  on matchdays for select to authenticated
  using (
    status <> 'brouillon'
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'president')
  );

create policy "matchs des journées publiées visibles"
  on fixtures for select to authenticated
  using (
    exists (
      select 1 from matchdays m
      where m.id = matchday_id
        and (m.status <> 'brouillon'
             or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'president'))
    )
  );

-- Les pronostics sont publics entre membres (comme sur WhatsApp).
create policy "pronostics visibles de tous"
  on predictions for select to authenticated using (true);

-- Bonus cachés : chacun voit les siens ; tout le monde voit tout une fois la
-- saison révélée.
create policy "bonus cachés scellés"
  on hidden_bonuses for select to authenticated
  using (
    member_id = auth.uid()
    or (select bonus_reveles from seasons s where s.id = season_id)
  );

create policy "registre visible"
  on ledger for select to authenticated using (true);

create policy "ajustements visibles"
  on point_adjustments for select to authenticated using (true);
