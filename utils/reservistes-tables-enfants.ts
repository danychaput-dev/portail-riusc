// utils/reservistes-tables-enfants.ts
// Liste des tables enfant qui referencent reservistes.benevole_id
// Utilisee par la suppression et la purge definitive (hard-delete).
// Ordre: enfants d'abord (au cas ou il y aurait des FK croisees).

export const TABLES_ENFANTS = [
  'reserviste_organisations',
  'reserviste_langues',
  'formations_benevoles',
  'inscriptions_camps',
  'inscriptions_camps_logs',
  'disponibilites_v2',
  'ciblages',
  'assignations',
  'messages',
  'message_reactions',
  'lms_progression',
  'rappels_camps',
  'reserviste_etat',
  'dossier_reserviste',
  'documents_officiels',
  'courriels',
] as const
