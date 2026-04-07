-- Ajouter le suivi des notes lues
-- lu_par = array d'user_ids qui ont lu la note (l'auteur est auto-marqué)
ALTER TABLE notes_reservistes ADD COLUMN IF NOT EXISTS lu_par TEXT[] NOT NULL DEFAULT '{}';

-- Index pour la recherche de notes non lues
CREATE INDEX IF NOT EXISTS idx_notes_reservistes_created ON notes_reservistes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_reservistes_auteur ON notes_reservistes(auteur_id);
