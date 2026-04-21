-- ────────────────────────────────────────────────────────────────────────────
-- sql/batch-responsables-aqbrs.sql
--
-- Crée les 23 réservistes responsables manquants (extraits du répertoire
-- AQBRS août 2025) et les lie à leurs groupes R&S via la table
-- groupes_recherche_responsables (31 liaisons au total).
--
-- - 7 réservistes existaient déjà (pas recréés) : Guy Lapointe, Serge Côté,
--   Thierry Gaudron, Kévin Normandin, Marc Chassé, Raynald Leclerc, René Roy.
-- - Raynald Leclerc n'est créé qu'UNE fois (dedup) mais lié à 2 groupes
--   (SIUCQ Mauricie + Eurêka) via son benevole_id existant.
--
-- Script idempotent :
--   - INSERT dans reservistes avec ON CONFLICT (benevole_id) ne pose pas de
--     problème (benevole_id est unique par construction du CTE).
--   - INSERT dans groupes_recherche_responsables avec ON CONFLICT DO NOTHING.
--
-- ATTENTION : si quelqu'un a créé entre-temps un compte avec un de ces emails,
-- il ne sera pas recréé (contrainte UNIQUE sur email probable). Dans ce cas,
-- la liaison utilise quand même le compte existant (via JOIN sur email).
-- ────────────────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 1 — Créer les 23 réservistes manquants
-- ════════════════════════════════════════════════════════════════════════════

WITH nouveaux_reservistes (prenom, nom, email, groupe_rs_nom, row_num) AS (
  VALUES
    -- District 1
    ('Carole',      'Corson',      'carole.corson@hotmail.ca',            'District 1: EBRES du KRTB', 1),
    ('Hugo',        'Perry',       'hugoperry@telus.net',                 'District 1: Équipe de recherche et sauvetage La Grande-Ourse', 2),
    -- District 2
    ('André',       'Chouinard',   'president@sauvetage02.org',           'District 2: Sauvetage Région 02', 3),
    -- District 3
    ('Clément',     'Caron',       'tourvillefeu@gmail.com',              'District 3: Recherche Sauvetage Tourville', 4),
    ('André',       'Langlois',    'tloyd_1122@hotmail.com',              'District 3: Recherche Sauvetage Tourville', 5),
    -- District 4
    ('Suzanne',     'Marchand',    'suzanne.marchand@hotmail.ca',         'District 4: Sauvetage Mauricie K9', 6),
    ('Ghyslain',    'Parent',      'gparent150@hotmail.com',              'District 4: SIUCQ Drummondville', 7),
    ('Jean-Guy',    'Paris',       'jg.paris@siucq.net',                  'District 4: SIUCQ MRC Arthabaska', 8),
    ('Jacques',     'Bédard',      'j.bedard@siucq.net',                  'District 4: SIUCQ MRC Arthabaska', 9),
    ('Pierre',      'Vallée',      'pierre.sar.mauricie@gmail.com',       'District 4: Eurêka Recherche et sauvetage', 10),
    -- District 5
    ('Patrick',     'Pilon',       'patrickpilon2020@gmail.com',          'District 5: Recherche Sauvetage Estrie', 11),
    -- District 6
    ('Wayne',       'Belvedere',   'wbelvedere@hotmail.com',              'District 6: Sauvetage Baie-D''Urfé', 12),
    ('George',      'Motz',        'g.motz@hotmail.com',                  'District 6: Sauvetage Baie-D''Urfé', 13),
    ('Bruno',       'Demmerle',    'bruno.demmerle@pointe-claire.ca',     'District 6: Pointe-Claire Volunteer Rescue Unit', 14),
    ('Marianna',    'Ferraiuolo',  'marianna.ferraiuolo@pointe-claire.ca','District 6: Pointe-Claire Volunteer Rescue Unit', 15),
    ('Steve',       'Sirois',      'steve.sirois@asjquebec.ca',           'District 6: Ambulance St-Jean - Div. 971 Laval', 16),
    ('Alexandre',   'Sapone',      'alexsapone@me.com',                   'District 6: Ambulance St-Jean - Div. 971 Laval', 17),
    ('Cliff',       'Neumann',     'balisebeaconk9@gmail.com',            'District 6: S&R Balise Beacon R&S', 18),
    ('Vedis',       'Ronald',      'vedis.ronald@gmail.com',              'District 6: S&R Balise Beacon R&S', 19),
    -- District 7
    ('Daniel',      'Boulet',      'president@sbo-ovsar.ca',              'District 7: Sauvetage Bénévole Outaouais', 20),
    ('Sandra',      'Schwerzmann', 'sandraschwerzmann@gmail.com',         'District 7: SAR 360', 21),
    ('Nathalie',    'Desarzens',   'fathom.dps@gmail.com',                'District 7: SAR 360', 22),
    -- District 8
    ('Marco',       'Dénommé',     'marcofrance@tlb.sympatico.ca',        'District 8: Recherche et sauvetage du Témiscamingue R.E.S.Tem', 23)
)
INSERT INTO reservistes (
  benevole_id, prenom, nom, email, role, statut, groupe,
  responsable_groupe, groupe_recherche
)
SELECT
  -- benevole_id unique basé sur un timestamp + numéro de ligne (format numérique
  -- cohérent avec les benevole_id existants, qui sont typiquement des entiers
  -- sur 10-13 chiffres).
  (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000 + row_num)::TEXT,
  prenom, nom, email,
  'reserviste', 'Actif', 'Approuvé',
  TRUE,                    -- responsable_groupe (pour le badge RG dans l'admin)
  groupe_rs_nom
FROM nouveaux_reservistes nr
-- Ne pas recréer si un compte avec le même email existe déjà
WHERE NOT EXISTS (
  SELECT 1 FROM reservistes r WHERE LOWER(r.email) = LOWER(nr.email)
);


-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2 — Lier les 31 responsables à leurs groupes
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO groupes_recherche_responsables (groupe_id, benevole_id)
SELECT a.groupe_id, r.benevole_id
FROM (VALUES
  -- District 1
  ('1f66da91-ee82-4aaa-b7fe-e30ec0327f3d'::uuid, 'carole.corson@hotmail.ca'),
  ('1f66da91-ee82-4aaa-b7fe-e30ec0327f3d'::uuid, 'marc_chasse@hotmail.com'),
  ('ef7b277d-74a3-4380-ac8b-7b2edd258008'::uuid, 'reneroy11@telus.net'),
  ('ef7b277d-74a3-4380-ac8b-7b2edd258008'::uuid, 'hugoperry@telus.net'),
  -- District 2
  ('27557868-9b64-47f8-a349-a3287802f21d'::uuid, 'president@sauvetage02.org'),
  ('27557868-9b64-47f8-a349-a3287802f21d'::uuid, 'formation@sauvetage02.org'),
  -- District 3
  ('b9c01f10-69f1-4fde-87a9-61affa7e7e4e'::uuid, 'tourvillefeu@gmail.com'),
  ('b9c01f10-69f1-4fde-87a9-61affa7e7e4e'::uuid, 'tloyd_1122@hotmail.com'),
  -- District 4
  ('1303eaf2-8b58-4210-9cd3-10dd9b29ec50'::uuid, 'aqbrs1@gmail.com'),
  ('1303eaf2-8b58-4210-9cd3-10dd9b29ec50'::uuid, 'suzanne.marchand@hotmail.ca'),
  ('31ada578-de80-4014-bd09-e4596c5aeb90'::uuid, 'cotese04@cgocable.ca'),
  ('31ada578-de80-4014-bd09-e4596c5aeb90'::uuid, 'gparent150@hotmail.com'),
  ('0f78ba9d-acb6-48af-a169-780e63dc65f2'::uuid, 'jg.paris@siucq.net'),
  ('0f78ba9d-acb6-48af-a169-780e63dc65f2'::uuid, 'j.bedard@siucq.net'),
  -- SIUCQ Mauricie : Raynald (email gmail déjà en DB) + Kévin
  ('5155be42-9812-43aa-969e-077bc14734be'::uuid, 'raynald.leclerc.siucq@gmail.com'),
  ('5155be42-9812-43aa-969e-077bc14734be'::uuid, 'k.normandin@siucq.net'),
  -- Eurêka : Pierre + Raynald (même personne, même benevole_id)
  ('9f555210-98c8-4fb6-a683-8b01aaa596cc'::uuid, 'pierre.sar.mauricie@gmail.com'),
  ('9f555210-98c8-4fb6-a683-8b01aaa596cc'::uuid, 'raynald.leclerc.siucq@gmail.com'),
  -- District 5
  ('24d3f74c-824e-4764-81a6-2edfdb2d29fa'::uuid, 'patrickpilon2020@gmail.com'),
  -- District 6
  ('a60f9f20-e8da-4c3d-9a16-ca4a1fb19d8a'::uuid, 'wbelvedere@hotmail.com'),
  ('a60f9f20-e8da-4c3d-9a16-ca4a1fb19d8a'::uuid, 'g.motz@hotmail.com'),
  ('30b71820-a81f-4773-812d-5daba1519064'::uuid, 'bruno.demmerle@pointe-claire.ca'),
  ('30b71820-a81f-4773-812d-5daba1519064'::uuid, 'marianna.ferraiuolo@pointe-claire.ca'),
  ('a58e2ccc-5133-4636-af00-44e3e3047446'::uuid, 'steve.sirois@asjquebec.ca'),
  ('a58e2ccc-5133-4636-af00-44e3e3047446'::uuid, 'alexsapone@me.com'),
  ('5f825adb-9c3e-450a-882c-bdb2ea2572d9'::uuid, 'balisebeaconk9@gmail.com'),
  ('5f825adb-9c3e-450a-882c-bdb2ea2572d9'::uuid, 'vedis.ronald@gmail.com'),
  -- District 7
  ('5a26bd74-4f8d-4daa-ac9c-5492d3a38525'::uuid, 'president@sbo-ovsar.ca'),
  ('5d198a62-543c-4443-a4cd-afbeb004d75e'::uuid, 'sandraschwerzmann@gmail.com'),
  ('5d198a62-543c-4443-a4cd-afbeb004d75e'::uuid, 'fathom.dps@gmail.com'),
  -- District 8
  ('bc35e818-9c59-4183-baea-6e2dfbfa9364'::uuid, 'marcofrance@tlb.sympatico.ca')
) AS a(groupe_id, email)
JOIN reservistes r ON LOWER(r.email) = LOWER(a.email)
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 3 — Vérification finale
-- ════════════════════════════════════════════════════════════════════════════

-- Tous les responsables désignés par groupe (on s'attend à 31 nouveaux +
-- les 7 de la première fournée, soit ~38 au total)
SELECT
  groupe_district,
  groupe_nom,
  prenom || ' ' || nom AS responsable,
  email,
  designe_le::date AS designe_le_date
FROM v_responsables_groupes_detail
ORDER BY groupe_district, groupe_nom, nom;
