-- Données de départ : saison 2026-2027 (courante) + référentiel des clubs.
-- La saison suivante se prépare directement dans l'app (onglet Président) :
-- création, composition (promus/relégués), 5 équipes concernées, échéances.

insert into seasons (name, paiement_deadline, bonus_deadline, is_current)
values ('Ligue 1 2026-2027', '2026-09-30', '2026-09-30 23:59:59+02', true);

-- Référentiel des clubs (les alias servent au parseur : écritures acceptées
-- sans passage en Commission). NANTES et METZ, relégués à l'été 2026, restent
-- dans le référentiel pour l'historique et les futures remontées.
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
  ('BREST',      'Stade Brestois 29',      '{SB29}'),
  ('LE HAVRE',   'Le Havre AC',            '{HAC,HAVRE}'),
  ('ANGERS',     'Angers SCO',             '{SCO}'),
  ('AUXERRE',    'AJ Auxerre',             '{AJA,"AJ AUXERRE"}'),
  ('LORIENT',    'FC Lorient',             '{FCL,MERLUS}'),
  ('PARIS FC',   'Paris FC',               '{PFC}'),
  ('TROYES',     'ESTAC Troyes',           '{ESTAC}'),
  ('LE MANS',    'Le Mans FC',             '{"LE MANS FC",MANS}'),
  ('NANTES',     'FC Nantes',              '{FCN,"FC NANTES"}'),
  ('METZ',       'FC Metz',                '{"FC METZ"}');

-- NB : « PARIS » tout seul est volontairement absent des alias — ambigu entre
-- PSG et PARIS FC (article 7, exemple du règlement). Le parseur le signalera.

-- Composition de la Ligue 1 2026-2027 : 18 clubs (montées : TROYES, LE MANS ;
-- descentes : NANTES, METZ). Équipes concernées cochées : TFC, PSG, OM (fixes
-- au règlement). Les 2 autres — celle tirée au sort par le Président et celle
-- choisie par le vainqueur sortant — se cochent dans l'app (★) une fois
-- connues.
insert into season_teams (season_id, team_id, tracked)
select s.id, t.id, t.short_name in ('TFC', 'PSG', 'OM')
from seasons s, teams t
where s.name = 'Ligue 1 2026-2027'
  and t.short_name not in ('NANTES', 'METZ');

-- Après la première connexion de chacun, attribuez les rôles (« Ne pas oublier ») :
-- update profiles set role = 'president'            where display_name = 'Greg R.';
-- update profiles set role = 'premier_ministre'     where display_name = 'Steve L.';
-- update profiles set role = 'president_commission' where display_name = 'Seb D.';
-- update profiles set role = 'secretaire'           where display_name = 'Alex G.';
-- update profiles set role = 'charge_mission'       where display_name = 'Jéré R.';
