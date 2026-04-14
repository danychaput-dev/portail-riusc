-- Création de deux comptes partenaires SOPFEU
-- Modèle: Laurence Goulet-Beaudry (benevole_id 11286590969)
-- Groupe: Partenaires | Rôle: partenaire | Statut: Actif

-- ============================================================================
-- 1) Insérer les deux réservistes
-- ============================================================================
INSERT INTO reservistes (benevole_id, prenom, nom, email, groupe, statut, role, antecedents_statut)
VALUES
  (floor(random() * 89999999999 + 10000000000)::bigint::text, 'Laurent', 'Joseph', 'ljoseph@sopfeu.qc.ca', 'Partenaires', 'Actif', 'partenaire', 'en_attente'),
  (floor(random() * 89999999999 + 10000000000)::bigint::text, 'Josée',   'Demers', 'jodemers@sopfeu.qc.ca', 'Partenaires', 'Actif', 'partenaire', 'en_attente');

-- ============================================================================
-- 2) Lier les deux comptes à l'organisation SOPFEU
-- ============================================================================
INSERT INTO reserviste_organisations (benevole_id, organisation_id)
SELECT r.benevole_id, o.id
FROM reservistes r
CROSS JOIN organisations o
WHERE r.email IN ('ljoseph@sopfeu.qc.ca', 'jodemers@sopfeu.qc.ca')
  AND o.nom ILIKE 'SOPFEU';

-- ============================================================================
-- 3) Transférer Philippe Rouleau (existant) vers Partenaires / rôle partenaire
-- ============================================================================
UPDATE reservistes
SET groupe = 'Partenaires',
    role = 'partenaire'
WHERE email = 'prouleau@sopfeu.qc.ca';

-- Lier Philippe à SOPFEU s'il n'y est pas déjà
INSERT INTO reserviste_organisations (benevole_id, organisation_id)
SELECT r.benevole_id, o.id
FROM reservistes r
CROSS JOIN organisations o
WHERE r.email = 'prouleau@sopfeu.qc.ca'
  AND o.nom ILIKE 'SOPFEU'
  AND NOT EXISTS (
    SELECT 1 FROM reserviste_organisations ro
    WHERE ro.benevole_id = r.benevole_id AND ro.organisation_id = o.id
  );

-- ============================================================================
-- 4) Vérification
-- ============================================================================
SELECT r.benevole_id, r.prenom, r.nom, r.email, r.groupe, r.role, r.statut,
       string_agg(o.nom, ', ') AS organisations
FROM reservistes r
LEFT JOIN reserviste_organisations ro ON ro.benevole_id = r.benevole_id
LEFT JOIN organisations o ON o.id = ro.organisation_id
WHERE r.email IN ('ljoseph@sopfeu.qc.ca', 'jodemers@sopfeu.qc.ca', 'prouleau@sopfeu.qc.ca')
GROUP BY r.benevole_id, r.prenom, r.nom, r.email, r.groupe, r.role, r.statut;
