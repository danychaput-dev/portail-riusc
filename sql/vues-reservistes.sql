-- Vues sauvegardées pour la page réservistes
-- Permet de sauvegarder/restaurer des filtres nommés (personnel ou partagé)

CREATE TABLE IF NOT EXISTS vues_reservistes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  -- Filtres sauvegardés (JSON flexible pour supporter l'évolution des filtres)
  filtres JSONB NOT NULL DEFAULT '{}',
  -- Partage : false = personnel, true = partagé avec tous les admins/coordonnateurs
  partage BOOLEAN NOT NULL DEFAULT false,
  -- Ordre d'affichage (pour le drag & drop)
  position INT NOT NULL DEFAULT 0,
  -- Couleur optionnelle pour distinguer visuellement
  couleur TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour requêtes rapides
CREATE INDEX IF NOT EXISTS idx_vues_reservistes_user ON vues_reservistes(user_id);
CREATE INDEX IF NOT EXISTS idx_vues_reservistes_partage ON vues_reservistes(partage) WHERE partage = true;

-- RLS
ALTER TABLE vues_reservistes ENABLE ROW LEVEL SECURITY;

-- Lecture : ses propres vues + vues partagées
CREATE POLICY "vues_select" ON vues_reservistes
  FOR SELECT USING (
    auth.uid() = user_id
    OR partage = true
  );

-- Insertion : uniquement ses propres vues
CREATE POLICY "vues_insert" ON vues_reservistes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Modification : uniquement ses propres vues
CREATE POLICY "vues_update" ON vues_reservistes
  FOR UPDATE USING (auth.uid() = user_id);

-- Suppression : uniquement ses propres vues
CREATE POLICY "vues_delete" ON vues_reservistes
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_vues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vues_updated_at ON vues_reservistes;
CREATE TRIGGER trg_vues_updated_at
  BEFORE UPDATE ON vues_reservistes
  FOR EACH ROW EXECUTE FUNCTION update_vues_updated_at();

/*
Structure du champ filtres (JSONB) :
{
  "recherche": "texte libre",
  "groupes": ["Approuvé", "Intérêt"],
  "sortKey": "nom",
  "sortDir": "asc",
  "filtreBottes": false,
  "filtreOrganisme": "",
  "filtreGroupeRS": "",
  "filtresReadiness": { "profil": null, "initiation": null, "camp": null, "antecedents": null },
  "filtreDeployable": null
}
*/
