// ─── Constantes spécifiques au profil réserviste ────────────────────────────
// Extraites de profil/page.tsx pour réduire la taille du fichier principal.

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
export const AQBRS_ORG_ID = 'bb948f22-a29e-42db-bdd9-aabab8a95abd'

// ─── Langues épinglées en haut de la liste ──────────────────────────────────

export const LANGUES_EPINGLEES = ['Anglais', 'Français']

// ─── Groupes sanguins ───────────────────────────────────────────────────────

export const GROUPES_SANGUIN = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu']

export const GROUPE_SANGUIN_MAP: Record<string, number> = {
  'A+': 1, 'B+': 2, 'A-': 3, 'A−': 3,
  'B-': 4, 'B−': 4, 'AB+': 5,
  'AB-': 6, 'AB−': 6, 'O+': 7, 'O-': 8, 'O−': 8,
}

export const GROUPE_SANGUIN_REVERSE: Record<number, string> = {
  1: 'A+', 2: 'B+', 3: 'A-', 4: 'B-',
  5: 'AB+', 6: 'AB-', 7: 'O+', 8: 'O-',
}

// ─── Options de compétences (formulaire profil) ─────────────────────────────

export const OPTIONS: Record<string, { id: number; label: string }[]> = {
  competence_rs: [
    { id: 1, label: 'Niveau 1 - Équipier' },
    { id: 2, label: "Niveau 2 - Chef d'équipe" },
    { id: 3, label: 'Niveau 3 - Responsable des opérations' },
  ],
  certificat_premiers_soins: [
    { id: 1, label: 'a) RCR/DEA (4-6h) certificat' },
    { id: 2, label: 'b) Premiers soins standard (8-16h)' },
    { id: 3, label: 'c) Secourisme en milieu de travail (16h)' },
    { id: 4, label: 'd) Secourisme en milieu éloigné (20-40h)' },
    { id: 5, label: 'e) Premier répondant (80-120h)' },
    { id: 6, label: 'f) Infirmière / Infirmier' },
    { id: 7, label: 'g) Paramédic / Technicien ambulancier' },
    { id: 8, label: 'h) Médecin' },
  ],
  vehicule_tout_terrain: [
    { id: 1, label: 'VTT' },
    { id: 2, label: 'Motoneige' },
    { id: 3, label: 'Argo' },
    { id: 4, label: 'Côte à côte' },
  ],
  navire_marin: [
    { id: 1, label: "Permis d'embarcation de plaisance" },
  ],
  permis_conduire: [
    { id: 1, label: 'Classe 5 Voiture (classe G Ontario)' },
    { id: 2, label: 'Classe 4b Autobus (4-14 passagers)' },
    { id: 3, label: 'Classe 2 Autobus (24+ passagers)' },
    { id: 4, label: 'Classe 1 Ensemble de véhicules routiers' },
    { id: 5, label: "Classe 4a Véhicule d'urgence" },
    { id: 6, label: 'Classe 3 Camions' },
    { id: 7, label: 'Classe 6 Motocyclette' },
  ],
  disponible_covoiturage: [
    { id: 1, label: 'Je peux transporter des gens' },
  ],
  satp_drone: [
    { id: 4, label: 'Utilisation de drone (petit drone de moins de 250g)' },
    { id: 5, label: 'Licence de pilote de drone (Transport Canada)' },
  ],
  equipe_canine: [
    { id: 1, label: 'Ratissage' },
    { id: 2, label: 'Pistage' },
    { id: 3, label: 'Avalanche' },
    { id: 4, label: 'Décombres' },
  ],
  competences_securite: [
    { id: 1, label: 'Scies à chaînes' },
    { id: 2, label: 'Contrôle de la circulation routière' },
    { id: 3, label: 'Formateur certifié CNESST' },
  ],
  competences_sauvetage: [
    { id: 1, label: 'Sauvetage sur corde' },
    { id: 2, label: 'Sauvetage en eau vive' },
    { id: 3, label: 'Sauvetage sur glace' },
    { id: 4, label: 'Sauvetage en hauteur' },
  ],
  certification_csi: [
    { id: 2, label: '100 - Introduction au Système de commandement des interventions' },
    { id: 3, label: '200 - Système de commandement de base en cas d\'incident' },
    { id: 4, label: '300 - Fonctions de supervision et planification des incidents complexes' },
    { id: 5, label: '400 - Commandement et gestion des incidents complexes et de grande envergure' },
  ],
  communication: [
    { id: 2, label: 'Radio amateur' },
  ],
  cartographie_sig: [
    { id: 1, label: 'Lecture de cartes topographiques' },
    { id: 2, label: 'Utilisation GPS' },
    { id: 3, label: 'SIG (Système d\'information géographique)' },
  ],
  operation_urgence: [
    { id: 3, label: 'J\'ai déjà été déployé dans un contexte d\'urgence' },
  ],
}

// ─── Labels de compétences nécessitant un certificat ────────────────────────

export const CERT_REQUIRED_LABELS = new Set([
  "Permis d'embarcation de plaisance",
  "Scies à chaînes",
  "Contrôle de la circulation routière",
  "Formateur certifié CNESST",
  "Radio amateur",
  "Licence de pilote de drone (Transport Canada)",
])

// ─── Régions administratives du Québec ──────────────────────────────────────

export const REGIONS_QUEBEC = [
  'Bas-Saint-Laurent',
  'Saguenay–Lac-Saint-Jean',
  'Capitale-Nationale',
  'Mauricie',
  'Estrie',
  'Montréal',
  'Outaouais',
  'Abitibi-Témiscamingue',
  'Côte-Nord',
  'Nord-du-Québec',
  'Gaspésie–Îles-de-la-Madeleine',
  'Chaudière-Appalaches',
  'Laval',
  'Lanaudière',
  'Laurentides',
  'Montérégie',
  'Centre-du-Québec',
] as const

// ─── Mapping FSA (3 premiers caractères du code postal) → région ────────────

export const FSA_TO_REGION: Record<string, string> = {
  // Bas-Saint-Laurent
  G4W:'Bas-Saint-Laurent',G5L:'Bas-Saint-Laurent',G5M:'Bas-Saint-Laurent',G5N:'Bas-Saint-Laurent',
  G5R:'Bas-Saint-Laurent',G5S:'Bas-Saint-Laurent',G0J:'Bas-Saint-Laurent',G0K:'Bas-Saint-Laurent',G0L:'Bas-Saint-Laurent',
  // Saguenay–Lac-Saint-Jean
  G7H:'Saguenay–Lac-Saint-Jean',G7J:'Saguenay–Lac-Saint-Jean',G7K:'Saguenay–Lac-Saint-Jean',G7N:'Saguenay–Lac-Saint-Jean',
  G7P:'Saguenay–Lac-Saint-Jean',G7S:'Saguenay–Lac-Saint-Jean',G7T:'Saguenay–Lac-Saint-Jean',G7X:'Saguenay–Lac-Saint-Jean',
  G7Y:'Saguenay–Lac-Saint-Jean',G7Z:'Saguenay–Lac-Saint-Jean',G8A:'Saguenay–Lac-Saint-Jean',G8B:'Saguenay–Lac-Saint-Jean',
  G8C:'Saguenay–Lac-Saint-Jean',G8E:'Saguenay–Lac-Saint-Jean',G8G:'Saguenay–Lac-Saint-Jean',G8H:'Saguenay–Lac-Saint-Jean',
  G8J:'Saguenay–Lac-Saint-Jean',G8K:'Saguenay–Lac-Saint-Jean',G8L:'Saguenay–Lac-Saint-Jean',G8M:'Saguenay–Lac-Saint-Jean',
  G8N:'Saguenay–Lac-Saint-Jean',G8P:'Saguenay–Lac-Saint-Jean',G0W:'Saguenay–Lac-Saint-Jean',
  // Capitale-Nationale
  G1A:'Capitale-Nationale',G1B:'Capitale-Nationale',G1C:'Capitale-Nationale',G1E:'Capitale-Nationale',G1G:'Capitale-Nationale',
  G1H:'Capitale-Nationale',G1J:'Capitale-Nationale',G1K:'Capitale-Nationale',G1L:'Capitale-Nationale',G1M:'Capitale-Nationale',
  G1N:'Capitale-Nationale',G1P:'Capitale-Nationale',G1R:'Capitale-Nationale',G1S:'Capitale-Nationale',G1T:'Capitale-Nationale',
  G1V:'Capitale-Nationale',G1W:'Capitale-Nationale',G1X:'Capitale-Nationale',G1Y:'Capitale-Nationale',
  G2A:'Capitale-Nationale',G2B:'Capitale-Nationale',G2C:'Capitale-Nationale',G2E:'Capitale-Nationale',G2G:'Capitale-Nationale',
  G2J:'Capitale-Nationale',G2K:'Capitale-Nationale',G2L:'Capitale-Nationale',G2M:'Capitale-Nationale',G2N:'Capitale-Nationale',
  G3A:'Capitale-Nationale',G3B:'Capitale-Nationale',G3C:'Capitale-Nationale',G3E:'Capitale-Nationale',G3G:'Capitale-Nationale',
  G3H:'Capitale-Nationale',G3J:'Capitale-Nationale',G3K:'Capitale-Nationale',G3L:'Capitale-Nationale',G3M:'Capitale-Nationale',
  G3N:'Capitale-Nationale',G3Z:'Capitale-Nationale',G0A:'Capitale-Nationale',G0N:'Capitale-Nationale',
  // Mauricie
  G8T:'Mauricie',G8V:'Mauricie',G8W:'Mauricie',G8X:'Mauricie',G8Y:'Mauricie',G8Z:'Mauricie',
  G9A:'Mauricie',G9B:'Mauricie',G9C:'Mauricie',G9N:'Mauricie',G9P:'Mauricie',G9T:'Mauricie',G9X:'Mauricie',
  G0T:'Mauricie',G0V:'Mauricie',G0X:'Mauricie',
  // Estrie
  J1H:'Estrie',J1J:'Estrie',J1K:'Estrie',J1L:'Estrie',J1M:'Estrie',J1N:'Estrie',J1R:'Estrie',J1S:'Estrie',
  J1T:'Estrie',J1X:'Estrie',J1Z:'Estrie',J0B:'Estrie',
  // Montréal
  H1A:'Montréal',H1B:'Montréal',H1C:'Montréal',H1E:'Montréal',H1G:'Montréal',H1H:'Montréal',H1J:'Montréal',H1K:'Montréal',
  H1L:'Montréal',H1M:'Montréal',H1N:'Montréal',H1P:'Montréal',H1R:'Montréal',H1S:'Montréal',H1T:'Montréal',H1V:'Montréal',
  H1W:'Montréal',H1X:'Montréal',H1Y:'Montréal',H1Z:'Montréal',H2A:'Montréal',H2B:'Montréal',H2C:'Montréal',H2E:'Montréal',
  H2G:'Montréal',H2H:'Montréal',H2J:'Montréal',H2K:'Montréal',H2L:'Montréal',H2M:'Montréal',H2N:'Montréal',H2P:'Montréal',
  H2R:'Montréal',H2S:'Montréal',H2T:'Montréal',H2V:'Montréal',H2W:'Montréal',H2X:'Montréal',H2Y:'Montréal',H2Z:'Montréal',
  H3A:'Montréal',H3B:'Montréal',H3C:'Montréal',H3E:'Montréal',H3G:'Montréal',H3H:'Montréal',H3J:'Montréal',H3K:'Montréal',
  H3L:'Montréal',H3M:'Montréal',H3N:'Montréal',H3P:'Montréal',H3R:'Montréal',H3S:'Montréal',H3T:'Montréal',H3V:'Montréal',
  H3W:'Montréal',H3X:'Montréal',H3Y:'Montréal',H3Z:'Montréal',H4A:'Montréal',H4B:'Montréal',H4C:'Montréal',H4E:'Montréal',
  H4G:'Montréal',H4H:'Montréal',H4J:'Montréal',H4K:'Montréal',H4L:'Montréal',H4M:'Montréal',H4N:'Montréal',H4P:'Montréal',
  H4R:'Montréal',H4S:'Montréal',H4T:'Montréal',H4V:'Montréal',H4W:'Montréal',H4X:'Montréal',H4Y:'Montréal',H4Z:'Montréal',
  H5A:'Montréal',H5B:'Montréal',H8N:'Montréal',H8P:'Montréal',H8R:'Montréal',H8S:'Montréal',H8T:'Montréal',
  H9A:'Montréal',H9B:'Montréal',H9C:'Montréal',H9E:'Montréal',H9G:'Montréal',H9H:'Montréal',H9J:'Montréal',H9K:'Montréal',
  H9P:'Montréal',H9R:'Montréal',H9S:'Montréal',H9W:'Montréal',H9X:'Montréal',
  // Outaouais
  J8L:'Outaouais',J8M:'Outaouais',J8N:'Outaouais',J8P:'Outaouais',J8R:'Outaouais',J8T:'Outaouais',J8V:'Outaouais',
  J8X:'Outaouais',J8Y:'Outaouais',J8Z:'Outaouais',J9A:'Outaouais',J9H:'Outaouais',J9J:'Outaouais',
  J0V:'Outaouais',J0X:'Outaouais',
  // Abitibi-Témiscamingue
  J9B:'Abitibi-Témiscamingue',J9E:'Abitibi-Témiscamingue',J9L:'Abitibi-Témiscamingue',J9T:'Abitibi-Témiscamingue',
  J9V:'Abitibi-Témiscamingue',J9X:'Abitibi-Témiscamingue',J9Y:'Abitibi-Témiscamingue',J9Z:'Abitibi-Témiscamingue',
  J0Y:'Abitibi-Témiscamingue',J0Z:'Abitibi-Témiscamingue',
  // Côte-Nord
  G4R:'Côte-Nord',G4S:'Côte-Nord',G4T:'Côte-Nord',G5A:'Côte-Nord',G5B:'Côte-Nord',G5C:'Côte-Nord',
  G0G:'Côte-Nord',G0H:'Côte-Nord',
  // Nord-du-Québec
  J0M:'Nord-du-Québec',
  // Gaspésie–Îles-de-la-Madeleine
  G0C:'Gaspésie–Îles-de-la-Madeleine',G0E:'Gaspésie–Îles-de-la-Madeleine',G0M:'Gaspésie–Îles-de-la-Madeleine',
  G4V:'Gaspésie–Îles-de-la-Madeleine',G4X:'Gaspésie–Îles-de-la-Madeleine',G4Y:'Gaspésie–Îles-de-la-Madeleine',
  G4Z:'Gaspésie–Îles-de-la-Madeleine',G5H:'Gaspésie–Îles-de-la-Madeleine',
  // Chaudière-Appalaches
  G5Y:'Chaudière-Appalaches',G5Z:'Chaudière-Appalaches',G6A:'Chaudière-Appalaches',G6B:'Chaudière-Appalaches',
  G6C:'Chaudière-Appalaches',G6E:'Chaudière-Appalaches',G6G:'Chaudière-Appalaches',G6H:'Chaudière-Appalaches',
  G6J:'Chaudière-Appalaches',G6K:'Chaudière-Appalaches',G6L:'Chaudière-Appalaches',G6P:'Chaudière-Appalaches',
  G6R:'Chaudière-Appalaches',G6S:'Chaudière-Appalaches',G6T:'Chaudière-Appalaches',G6V:'Chaudière-Appalaches',
  G6W:'Chaudière-Appalaches',G6X:'Chaudière-Appalaches',G6Y:'Chaudière-Appalaches',G6Z:'Chaudière-Appalaches',
  G7A:'Chaudière-Appalaches',G7B:'Chaudière-Appalaches',G7C:'Chaudière-Appalaches',G7E:'Chaudière-Appalaches',G7G:'Chaudière-Appalaches',
  G0R:'Chaudière-Appalaches',G0S:'Chaudière-Appalaches',
  // Laval
  H7A:'Laval',H7B:'Laval',H7C:'Laval',H7E:'Laval',H7G:'Laval',H7H:'Laval',H7J:'Laval',H7K:'Laval',
  H7L:'Laval',H7M:'Laval',H7N:'Laval',H7P:'Laval',H7R:'Laval',H7S:'Laval',H7T:'Laval',H7V:'Laval',H7W:'Laval',H7X:'Laval',H7Y:'Laval',
  // Lanaudière
  J0K:'Lanaudière',J5L:'Lanaudière',J5R:'Lanaudière',J5T:'Lanaudière',J5V:'Lanaudière',J5W:'Lanaudière',
  J5X:'Lanaudière',J5Y:'Lanaudière',J5Z:'Lanaudière',J6E:'Lanaudière',J6S:'Lanaudière',J6V:'Lanaudière',
  J6W:'Lanaudière',J6X:'Lanaudière',J6Y:'Lanaudière',J6Z:'Lanaudière',
  // Laurentides
  J0N:'Laurentides',J0R:'Laurentides',J0T:'Laurentides',J7A:'Laurentides',J7B:'Laurentides',J7C:'Laurentides',
  J7E:'Laurentides',J7G:'Laurentides',J7H:'Laurentides',J7J:'Laurentides',J7K:'Laurentides',J7L:'Laurentides',
  J7M:'Laurentides',J7N:'Laurentides',J7P:'Laurentides',J7R:'Laurentides',J7S:'Laurentides',J7T:'Laurentides',
  J7V:'Laurentides',J7W:'Laurentides',J7X:'Laurentides',J7Y:'Laurentides',J7Z:'Laurentides',
  J8A:'Laurentides',J8B:'Laurentides',J8C:'Laurentides',J8E:'Laurentides',J8G:'Laurentides',J8H:'Laurentides',J8K:'Laurentides',
  // Montérégie
  J0H:'Montérégie',J0L:'Montérégie',J0S:'Montérégie',J3A:'Montérégie',J3B:'Montérégie',J3E:'Montérégie',J3G:'Montérégie',
  J3H:'Montérégie',J3L:'Montérégie',J3M:'Montérégie',J3N:'Montérégie',J3P:'Montérégie',J3R:'Montérégie',J3T:'Montérégie',
  J3V:'Montérégie',J3X:'Montérégie',J3Y:'Montérégie',J3Z:'Montérégie',J4B:'Montérégie',J4G:'Montérégie',J4H:'Montérégie',
  J4J:'Montérégie',J4K:'Montérégie',J4L:'Montérégie',J4M:'Montérégie',J4N:'Montérégie',J4P:'Montérégie',J4R:'Montérégie',
  J4S:'Montérégie',J4T:'Montérégie',J4V:'Montérégie',J4W:'Montérégie',J4X:'Montérégie',J4Y:'Montérégie',J4Z:'Montérégie',
  J5A:'Montérégie',J5B:'Montérégie',J5C:'Montérégie',J5J:'Montérégie',J5K:'Montérégie',J5M:'Montérégie',J5N:'Montérégie',
  // Centre-du-Québec
  J0A:'Centre-du-Québec',J0C:'Centre-du-Québec',J0G:'Centre-du-Québec',J1A:'Centre-du-Québec',
  J2A:'Centre-du-Québec',J2B:'Centre-du-Québec',J2C:'Centre-du-Québec',J2E:'Centre-du-Québec',J2G:'Centre-du-Québec',
  J2H:'Centre-du-Québec',J2K:'Centre-du-Québec',J2L:'Centre-du-Québec',J2M:'Centre-du-Québec',J2N:'Centre-du-Québec',
  J2R:'Centre-du-Québec',J2S:'Centre-du-Québec',J2T:'Centre-du-Québec',G0P:'Centre-du-Québec',G0Z:'Centre-du-Québec',
}

// ─── Fonctions utilitaires ──────────────────────────────────────────────────

export function detecterRegionParFSA(codePostal: string): string | null {
  const fsa = codePostal.replace(/\s/g, '').toUpperCase().slice(0, 3)
  return FSA_TO_REGION[fsa] || null
}

/** Convertit les labels Supabase en IDs pour l'UI */
export function labelsToIds(field: string, labels: string[] | null): number[] {
  if (!labels || labels.length === 0) return []
  const opts = OPTIONS[field]
  if (!opts) return []
  return labels.map(label => {
    const exact = opts.find(o => o.label === label)
    if (exact) return exact.id
    const frPart = label.split(' / ')[0].trim().toLowerCase()
    const partial = opts.find(o => o.label.toLowerCase() === frPart || o.label.toLowerCase().startsWith(frPart))
    return partial ? partial.id : null
  }).filter((id): id is number => id !== null)
}

/** Convertit les IDs UI en labels pour Supabase */
export function idsToLabels(field: string, ids: number[]): string[] {
  if (!ids || ids.length === 0) return []
  const opts = OPTIONS[field]
  if (!opts) return []
  return ids.map(id => {
    const opt = opts.find(o => o.id === id)
    return opt ? opt.label : null
  }).filter((label): label is string => label !== null)
}

/** Formate un numéro de téléphone pour l'affichage */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return phone
}

/** Nettoie un numéro de téléphone pour la sauvegarde (chiffres seulement) */
export function cleanPhoneForSave(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** Valide un numéro de téléphone nord-américain */
export function isValidNorthAmericanPhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return true
  if (digits.length === 11 && digits[0] === '1') return true
  return false
}

/** Vérifie si la personne a 18 ans ou plus */
export function isOlderThan18(dateNaissance: string): boolean {
  if (!dateNaissance) return true
  const birthDate = new Date(dateNaissance)
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= 18
  }
  return age >= 18
}
