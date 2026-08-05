-- Données de départ : saison 2025-2026 (courante) + clubs de Ligue 1.
-- La saison 2026-2027 se prépare directement dans l'app (onglet Président) :
-- création de la saison, sélection des 18 clubs (promus/relégués), choix des
-- 5 équipes concernées, échéances et montants — puis bascule.

insert into seasons (name, paiement_deadline, bonus_deadline, is_current)
values ('Ligue 1 2025-2026', '2025-09-30', '2025-09-30 23:59:59+02', true);

-- Référentiel des clubs (les alias servent au parseur : écritures acceptées
-- sans passage en Commission).
insert into teams (short_name, full_name, aliases) values
  ('TFC',        'Toulouse FC',            '{TOULOUSE,TEFECE}'),
  ('PSG',        'Paris Saint-Germain',    '{"PARIS SG","PARIS SAINT GERMAIN","PARIS SAINT-GERMAIN","PARIS-SG"}'),
  ('OM',         'Olympique de Marseille', '{MARSEILLE}'),
  ('RENNES',     'Stade Rennais FC',       '{"STADE RENNAIS",SRFC}'),
  ('MONACO',     'AS Monaco',              '{ASM,"AS MONACO"}'),
  ('OL',         'Olympique Lyonnais',     '{LYON}'),
  ('LOSC',       'LOSC Lille',             '{LILLE}'),
  ('NICE',       'OGC Nice',               '{OGCN,"OGC NICE"}'),
  ('LENS',       'RC Lens',                '{RCL,"RC LENS"}'),
  ('STRASBOURG', 'RC Strasbourg Alsace',   '{RCSA,STRASBG}'),
  ('NANTES',     'FC Nantes',              '{FCN,"FC NANTES"}'),
  ('BREST',      'Stade Brestois 29',      '{SB29}'),
  ('LE HAVRE',   'Le Havre AC',            '{HAC,HAVRE}'),
  ('ANGERS',     'Angers SCO',             '{SCO}'),
  ('AUXERRE',    'AJ Auxerre',             '{AJA,"AJ AUXERRE"}'),
  ('METZ',       'FC Metz',                '{"FC METZ"}'),
  ('LORIENT',    'FC Lorient',             '{FCL,MERLUS}'),
  ('PARIS FC',   'Paris FC',               '{PFC}');

-- NB : « PARIS » tout seul est volontairement absent des alias — ambigu entre
-- PSG et PARIS FC (article 7, exemple du règlement). Le parseur le signalera.

-- Composition de la Ligue 1 2025-2026 : les 18 clubs, dont les 5 équipes
-- concernées (TFC, PSG, OM + RENNES tirée au sort + MONACO choisie par le
-- vainqueur sortant).
insert into season_teams (season_id, team_id, tracked)
select s.id, t.id, t.short_name in ('TFC', 'PSG', 'OM', 'RENNES', 'MONACO')
from seasons s, teams t
where s.name = 'Ligue 1 2025-2026';

-- Après la première connexion de chacun, attribuez les rôles (« Ne pas oublier ») :
-- update profiles set role = 'president'            where display_name = 'Greg R.';
-- update profiles set role = 'premier_ministre'     where display_name = 'Steve L.';
-- update profiles set role = 'president_commission' where display_name = 'Seb D.';
-- update profiles set role = 'secretaire'           where display_name = 'Alex G.';
-- update profiles set role = 'charge_mission'       where display_name = 'Jéré R.';
