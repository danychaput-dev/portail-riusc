-- ────────────────────────────────────────────────────────────────────────────
-- sql/assigner-responsables-initial.sql
--
-- Assigne les premiers responsables de groupes R&S selon la liste fournie
-- par Dany (2026-04-21).
--
-- Responsables à désigner :
--   - Québec Secours : Jean-Marc Tétreault-Renaud, Christophe Guillemette-Leclerc
--   - Recherche Sauvetage Laurentide-Lanaudière : Carol Desrosiers
--   - Recherche Sauvetage Estrie : Dany Chaput, Sébastien Bolduc
--   - RSQM (Recherche Sauvetage Québec Métro) : Marie Cauchon, François Arseneault
--
-- Le script est idempotent grâce à ON CONFLICT DO NOTHING.
-- Les recherches de noms utilisent ILIKE avec des wildcards pour être
-- tolérantes aux variations d'accents et d'espaces.
-- ────────────────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 1 — VÉRIFICATION (à exécuter AVANT les INSERT pour voir les matches)
-- ════════════════════════════════════════════════════════════════════════════

-- 1a. Groupes trouvés (devrait retourner 4 lignes)
SELECT 'GROUPE TROUVÉ' AS statut, id, nom, district
FROM groupes_recherche
WHERE nom ILIKE '%québec secours%'
   OR nom ILIKE '%laurentide%' OR nom ILIKE '%lanaudière%' OR nom ILIKE '%lanaudiere%'
   OR nom ILIKE '%estrie%'
   OR nom ILIKE '%rsqm%' OR nom ILIKE '%québec métro%' OR nom ILIKE '%quebec metro%'
ORDER BY nom;

-- 1b. Réservistes trouvés (devrait retourner 7 lignes)
SELECT 'RÉSERVISTE TROUVÉ' AS statut, benevole_id, prenom, nom, email
FROM reservistes
WHERE (prenom ILIKE 'jean-marc' AND nom ILIKE '%tétreault%')
   OR (prenom ILIKE 'christophe' AND nom ILIKE '%guillemette%')
   OR (prenom ILIKE 'carol' AND (nom ILIKE '%desrosiers%' OR nom ILIKE '%desrausier%'))
   OR (prenom ILIKE 'dany' AND nom ILIKE 'chaput')
   OR (prenom ILIKE 'sébastien' AND nom ILIKE 'bolduc')
   OR (prenom ILIKE 'marie' AND nom ILIKE 'cauchon')
   OR (prenom ILIKE 'françois' AND nom ILIKE 'arseneault')
ORDER BY nom;


-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 2 — INSERTIONS (à exécuter APRÈS avoir validé l'étape 1)
-- ════════════════════════════════════════════════════════════════════════════

-- Québec Secours : Jean-Marc Tétreault-Renaud
INSERT INTO groupes_recherche_responsables (groupe_id, benevole_id)
SELECT g.id, r.benevole_id
FROM groupes_recherche g, reservistes r
WHERE g.nom ILIKE '%québec secours%'
  AND r.prenom ILIKE 'jean-marc'
  AND r.nom ILIKE '%tétreault%'
ON CONFLICT DO NOTHING;

-- Québec Secours : Christophe Guillemette-Leclerc
INSERT INTO groupes_recherche_responsables (groupe_id, benevole_id)
SELECT g.id, r.benevole_id
FROM groupes_recherche g, reservistes r
WHERE g.nom ILIKE '%québec secours%'
  AND r.prenom ILIKE 'christophe'
  AND r.nom ILIKE '%guillemette%'
ON CONFLICT DO NOTHING;

-- Recherche Sauvetage Laurentide-Lanaudière : Carol Desrosiers
INSERT INTO groupes_recherche_responsables (groupe_id, benevole_id)
SELECT g.id, r.benevole_id
FROM groupes_recherche g, reservistes r
WHERE (g.nom ILIKE '%laurentide%' OR g.nom ILIKE '%lanaudière%' OR g.nom ILIKE '%lanaudiere%')
  AND r.prenom ILIKE 'carol'
  AND (r.nom ILIKE '%desrosiers%' OR r.nom ILIKE '%desrausier%')
ON CONFLICT DO NOTHING;

-- Recherche Sauvetage Estrie : Dany Chaput
INSERT INTO groupes_recherche_responsables (groupe_id, benevole_id)
SELECT g.id, r.benevole_id
FROM groupes_recherche g, reservistes r
WHERE g.nom ILIKE '%estrie%'
  AND r.prenom ILIKE 'dany'
  AND r.nom ILIKE 'chaput'
ON CONFLICT DO NOTHING;

-- Recherche Sauvetage Estrie : Sébastien Bolduc
INSERT INTO groupes_recherche_responsables (groupe_id, benevole_id)
SELECT g.id, r.benevole_id
FROM groupes_recherche g, reservistes r
WHERE g.nom ILIKE '%estrie%'
  AND r.prenom ILIKE 'sébastien'
  AND r.nom ILIKE 'bolduc'
ON CONFLICT DO NOTHING;

-- RSQM : Marie Cauchon
INSERT INTO groupes_recherche_responsables (groupe_id, benevole_id)
SELECT g.id, r.benevole_id
FROM groupes_recherche g, reservistes r
WHERE (g.nom ILIKE '%rsqm%' OR g.nom ILIKE '%québec métro%' OR g.nom ILIKE '%quebec metro%')
  AND r.prenom ILIKE 'marie'
  AND r.nom ILIKE 'cauchon'
ON CONFLICT DO NOTHING;

-- RSQM : François Arseneault
INSERT INTO groupes_recherche_responsables (groupe_id, benevole_id)
SELECT g.id, r.benevole_id
FROM groupes_recherche g, reservistes r
WHERE (g.nom ILIKE '%rsqm%' OR g.nom ILIKE '%québec métro%' OR g.nom ILIKE '%quebec metro%')
  AND r.prenom ILIKE 'françois'
  AND r.nom ILIKE 'arseneault'
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 — VÉRIFICATION FINALE (devrait retourner 7 lignes)
-- ════════════════════════════════════════════════════════════════════════════

SELECT
  groupe_nom,
  groupe_district,
  prenom || ' ' || nom AS responsable,
  email,
  recoit_cc_courriels,
  designe_le
FROM v_responsables_groupes_detail
ORDER BY groupe_district, groupe_nom, nom;
