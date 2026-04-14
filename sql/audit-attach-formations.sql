-- ============================================================================
-- Niveau 1 : Tracabilite complete des donnees critiques reservistes
--
-- Attache l'audit_log aux tables qui definissent la "deployabilite"
-- d'un reserviste. Toute modification INSERT/UPDATE/DELETE y sera
-- capturee avec auteur + timestamp + diff par champ.
--
-- Si un certificat ou une config disparait, on saura qui, quand, comment.
--
-- Prerequis : sql/audit-log.sql deja execute (fonction audit_attach_table)
-- ============================================================================

-- Certificats et formations (la plus critique - historique de pertes)
select audit_attach_table('formations_benevoles', 'id');

-- Liens aux organismes partenaires (SOPFEU, Croix-Rouge, etc.)
select audit_attach_table('reserviste_organisations', 'benevole_id');

-- Langues parlees
select audit_attach_table('reserviste_langues', 'benevole_id');

-- Etat du reserviste (verification antecedents, bottes, etc.)
select audit_attach_table('reserviste_etat', 'benevole_id');

-- Dossier reserviste (donnees operationnelles etendues)
select audit_attach_table('dossier_reserviste', 'benevole_id');

-- ============================================================================
-- Verification : lister les tables surveillees
-- ============================================================================
select tgrelid::regclass as table_surveillee, tgname as trigger_name
from pg_trigger
where tgname like 'audit_capture_%'
order by 1;
