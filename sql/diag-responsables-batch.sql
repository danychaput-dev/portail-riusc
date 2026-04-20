-- ────────────────────────────────────────────────────────────────────────────
-- Diagnostic : croise la liste des 28 responsables extraits du PDF AQBRS
-- avec les données actuelles en base (reservistes + groupes_recherche).
--
-- Objectif : savoir qui existe déjà (par email) et quel groupe matche
-- chaque ligne du répertoire, AVANT de faire les créations/assignations.
-- ────────────────────────────────────────────────────────────────────────────

WITH repertoire AS (
  -- 28 responsables extraits du document, avec pattern de groupe à matcher
  SELECT * FROM (VALUES
    -- District 1
    ('Carole',       'Corson',               'carole.corson@hotmail.ca',         '%ebres%'),
    ('Marc',         'Chassé',               'marc_chasse@hotmail.com',          '%ebres%'),
    ('René',         'Roy',                  'reneroy11@telus.net',              '%grande ourse%'),
    ('Hugo',         'Perry',                'hugoperry@telus.net',              '%grande ourse%'),
    -- District 2
    ('André',        'Chouinard',            'president@sauvetage02.org',        '%région 02%'),
    ('Thierry',      'Gaudron',              'formation@sauvetage02.org',        '%région 02%'),
    -- District 3
    ('Clément',      'Caron',                'tourvillefeu@gmail.com',           '%tourville%'),
    ('André',        'Langlois',             'tloyd_1122@hotmail.com',           '%tourville%'),
    -- District 4
    ('Guy',          'Lapointe',             'aqbrs1@gmail.com',                 '%mauricie k9%'),
    ('Suzanne',      'Marchand',             'suzanne.marchand@hotmail.ca',      '%mauricie k9%'),
    ('Serge',        'Côté',                 'cotese04@cgocable.ca',             '%drummondville%'),
    ('Ghyslain',     'Parent',               'gparent150@hotmail.com',           '%drummondville%'),
    ('Jean-Guy',     'Paris',                'jg.paris@siucq.net',               '%arthabaska%'),
    ('Jacques',      'Bédard',               'j.bedard@siucq.net',               '%arthabaska%'),
    ('Raynald',      'Leclerc',              'r.leclerc@siucq.net',              '%siucq%mauricie%'),
    ('Kévin',        'Normandin',            'k.normandin@siucq.net',            '%siucq%mauricie%'),
    ('Pierre',       'Vallée',               'pierre.sar.mauricie@gmail.com',    '%eurêka%'),
    ('Raynald',      'Leclerc',              'raynald.leclerc.siucq@gmail.com',  '%eurêka%'),
    -- District 5
    ('Patrick',      'Pilon',                'patrickpilon2020@gmail.com',       '%estrie%'),
    -- District 6
    ('Wayne',        'Belvedere',            'wbelvedere@hotmail.com',           '%baie-d''urfé%'),
    ('George',       'Motz',                 'g.motz@hotmail.com',               '%baie-d''urfé%'),
    ('Bruno',        'Demmerle',             'bruno.demmerle@pointe-claire.ca',  '%pointe-claire%'),
    ('Marianna',     'Ferraiuolo',           'marianna.ferraiuolo@pointe-claire.ca', '%pointe-claire%'),
    ('Steve',        'Sirois',               'steve.sirois@asjquebec.ca',        '%ambulance%laval%'),
    ('Alexandre',    'Sapone',               'alexsapone@me.com',                '%ambulance%laval%'),
    ('Cliff',        'Neumann',              'balisebeaconk9@gmail.com',         '%balise%beacon%'),
    ('Vedis',        'Ronald',               'vedis.ronald@gmail.com',           '%balise%beacon%'),
    -- District 7
    ('Daniel',       'Boulet',               'president@sbo-ovsar.ca',           '%outaouais%'),
    ('Sandra',       'Schwerzmann',          'sandraschwerzmann@gmail.com',      '%sar 360%'),
    ('Nathalie',     'Desarzens',            'fathom.dps@gmail.com',             '%sar 360%'),
    -- District 8
    ('Marco',        'Dénommé',              'marcofrance@tlb.sympatico.ca',     '%restem%')
  ) AS t(prenom, nom, email, groupe_pattern)
)
SELECT
  r.prenom,
  r.nom,
  r.email,
  r.groupe_pattern,
  res.benevole_id   AS reserviste_existant,
  res.prenom        AS reserviste_prenom,
  res.nom           AS reserviste_nom,
  g.id              AS groupe_id,
  g.nom             AS groupe_nom_db,
  g.district        AS groupe_district
FROM repertoire r
LEFT JOIN reservistes res ON LOWER(res.email) = LOWER(r.email)
LEFT JOIN groupes_recherche g ON LOWER(g.nom) ILIKE r.groupe_pattern
ORDER BY r.email;
