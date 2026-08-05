-- Données de départ : saison + 18 clubs de Ligue 1 2025-2026.
-- Les alias servent au parseur (écritures acceptées sans passage en Commission).

insert into season_settings (id) values (1);

insert into teams (short_name, full_name, aliases, tracked) values
  ('TFC',        'Toulouse FC',                 '{TOULOUSE,TEFECE}',                          true),
  ('PSG',        'Paris Saint-Germain',         '{"PARIS SG","PARIS SAINT GERMAIN","PARIS SAINT-GERMAIN","PARIS-SG"}', true),
  ('OM',         'Olympique de Marseille',      '{MARSEILLE}',                                true),
  ('RENNES',     'Stade Rennais FC',            '{"STADE RENNAIS",SRFC}',                     true),
  ('MONACO',     'AS Monaco',                   '{ASM,"AS MONACO"}',                          true),
  ('OL',         'Olympique Lyonnais',          '{LYON}',                                     false),
  ('LOSC',       'LOSC Lille',                  '{LILLE}',                                    false),
  ('NICE',       'OGC Nice',                    '{OGCN,"OGC NICE"}',                          false),
  ('LENS',       'RC Lens',                     '{RCL,"RC LENS"}',                            false),
  ('STRASBOURG', 'RC Strasbourg Alsace',        '{RCSA,STRASBG}',                             false),
  ('NANTES',     'FC Nantes',                   '{FCN,"FC NANTES"}',                          false),
  ('BREST',      'Stade Brestois 29',           '{SB29}',                                     false),
  ('LE HAVRE',   'Le Havre AC',                 '{HAC,HAVRE}',                                false),
  ('ANGERS',     'Angers SCO',                  '{SCO}',                                      false),
  ('AUXERRE',    'AJ Auxerre',                  '{AJA,"AJ AUXERRE"}',                         false),
  ('METZ',       'FC Metz',                     '{"FC METZ"}',                                false),
  ('LORIENT',    'FC Lorient',                  '{FCL,MERLUS}',                               false),
  ('PARIS FC',   'Paris FC',                    '{PFC}',                                      false);

-- NB : « PARIS » tout seul est volontairement absent des alias — ambigu entre
-- PSG et PARIS FC (article 7, exemple du règlement). Le parseur le signalera.

-- Après la première connexion de chacun, attribuez les rôles (art. « Ne pas oublier ») :
-- update profiles set role = 'president'            where display_name = 'Greg R.';
-- update profiles set role = 'premier_ministre'     where display_name = 'Steve L.';
-- update profiles set role = 'president_commission' where display_name = 'Seb D.';
-- update profiles set role = 'secretaire'           where display_name = 'Alex G.';
-- update profiles set role = 'charge_mission'       where display_name = 'Jéré R.';
