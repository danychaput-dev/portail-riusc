-- Correction du type entity_id (uuid -> text) car benevole_id dans reservistes est du texte
-- Créé 2026-04-13

alter table public.retraits_temporaires
  alter column entity_id type text using entity_id::text;
