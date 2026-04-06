-- Index de performance pour les requêtes fréquentes
-- À exécuter dans Supabase SQL Editor

-- reservistes — filtres principaux de la page admin/reservistes
CREATE INDEX IF NOT EXISTS idx_reservistes_groupe ON reservistes(groupe);
CREATE INDEX IF NOT EXISTS idx_reservistes_statut ON reservistes(statut);
CREATE INDEX IF NOT EXISTS idx_reservistes_region ON reservistes(region);
CREATE INDEX IF NOT EXISTS idx_reservistes_antecedents ON reservistes(antecedents_statut);
CREATE INDEX IF NOT EXISTS idx_reservistes_nom ON reservistes(nom);
CREATE INDEX IF NOT EXISTS idx_reservistes_user_id ON reservistes(user_id);
CREATE INDEX IF NOT EXISTS idx_reservistes_benevole_id ON reservistes(benevole_id);

-- reserviste_organisations — jointures fréquentes
CREATE INDEX IF NOT EXISTS idx_reserviste_organisations_benevole ON reserviste_organisations(benevole_id);

-- formations_benevoles — enrichissement + page certificats
CREATE INDEX IF NOT EXISTS idx_formations_benevoles_benevole ON formations_benevoles(benevole_id);
CREATE INDEX IF NOT EXISTS idx_formations_benevoles_resultat ON formations_benevoles(resultat);

-- inscriptions_camps — enrichissement + page camps
CREATE INDEX IF NOT EXISTS idx_inscriptions_camps_benevole ON inscriptions_camps(benevole_id);
CREATE INDEX IF NOT EXISTS idx_inscriptions_camps_session ON inscriptions_camps(session_id);

-- audit / logs — page stats
CREATE INDEX IF NOT EXISTS idx_auth_logs_created ON auth_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_pages_visite ON audit_pages(visite_a DESC);

-- courriels
CREATE INDEX IF NOT EXISTS idx_courriels_created ON courriels(created_at DESC);
