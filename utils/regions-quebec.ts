/**
 * Détection de la région administrative du Québec
 * 
 * Stratégie multi-niveaux :
 *   1. Nominatim → state_district (quand présent, c'est la région admin)
 *   2. Nominatim → county → mapping MRC vers région
 *   3. Code postal FSA (3 premiers caractères) → région
 *   4. null → l'UI affiche un sélecteur manuel
 */

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
] as const;

export type RegionQuebec = (typeof REGIONS_QUEBEC)[number];

// ─── 1. Mapping FSA → Région ──────────────────────────────────────────────────
// FSA = 3 premiers caractères du code postal (ex: G7S pour G7S 0H6)
// Source: Canada Post + données Statistics Canada

const FSA_TO_REGION: Record<string, RegionQuebec> = {
  // ── Bas-Saint-Laurent (01) ──
  G4W: 'Bas-Saint-Laurent', // Matane
  G5L: 'Bas-Saint-Laurent', G5M: 'Bas-Saint-Laurent', // Rimouski
  G5N: 'Bas-Saint-Laurent',
  G5R: 'Bas-Saint-Laurent', G5S: 'Bas-Saint-Laurent', // Rivière-du-Loup
  G0J: 'Bas-Saint-Laurent', G0K: 'Bas-Saint-Laurent', G0L: 'Bas-Saint-Laurent',

  // ── Saguenay–Lac-Saint-Jean (02) ──
  G7H: 'Saguenay–Lac-Saint-Jean', G7J: 'Saguenay–Lac-Saint-Jean',
  G7K: 'Saguenay–Lac-Saint-Jean', G7N: 'Saguenay–Lac-Saint-Jean',
  G7P: 'Saguenay–Lac-Saint-Jean', G7S: 'Saguenay–Lac-Saint-Jean', // Jonquière ← le cas problème
  G7T: 'Saguenay–Lac-Saint-Jean', G7X: 'Saguenay–Lac-Saint-Jean',
  G7Y: 'Saguenay–Lac-Saint-Jean', G7Z: 'Saguenay–Lac-Saint-Jean',
  G8A: 'Saguenay–Lac-Saint-Jean', G8B: 'Saguenay–Lac-Saint-Jean', // Alma
  G8C: 'Saguenay–Lac-Saint-Jean', G8E: 'Saguenay–Lac-Saint-Jean',
  G8G: 'Saguenay–Lac-Saint-Jean', G8H: 'Saguenay–Lac-Saint-Jean', // Roberval
  G8J: 'Saguenay–Lac-Saint-Jean', G8K: 'Saguenay–Lac-Saint-Jean',
  G8L: 'Saguenay–Lac-Saint-Jean', G8M: 'Saguenay–Lac-Saint-Jean', // Dolbeau
  G8N: 'Saguenay–Lac-Saint-Jean', G8P: 'Saguenay–Lac-Saint-Jean',
  G0W: 'Saguenay–Lac-Saint-Jean',

  // ── Capitale-Nationale (03) ──
  G1A: 'Capitale-Nationale', G1B: 'Capitale-Nationale', G1C: 'Capitale-Nationale',
  G1E: 'Capitale-Nationale', G1G: 'Capitale-Nationale', G1H: 'Capitale-Nationale',
  G1J: 'Capitale-Nationale', G1K: 'Capitale-Nationale', G1L: 'Capitale-Nationale',
  G1M: 'Capitale-Nationale', G1N: 'Capitale-Nationale', G1P: 'Capitale-Nationale',
  G1R: 'Capitale-Nationale', G1S: 'Capitale-Nationale', G1T: 'Capitale-Nationale',
  G1V: 'Capitale-Nationale', G1W: 'Capitale-Nationale', G1X: 'Capitale-Nationale',
  G1Y: 'Capitale-Nationale',
  G2A: 'Capitale-Nationale', G2B: 'Capitale-Nationale', G2C: 'Capitale-Nationale',
  G2E: 'Capitale-Nationale', G2G: 'Capitale-Nationale', G2J: 'Capitale-Nationale',
  G2K: 'Capitale-Nationale', G2L: 'Capitale-Nationale', G2M: 'Capitale-Nationale',
  G2N: 'Capitale-Nationale',
  G3A: 'Capitale-Nationale', G3B: 'Capitale-Nationale', G3C: 'Capitale-Nationale',
  G3E: 'Capitale-Nationale', G3G: 'Capitale-Nationale', G3H: 'Capitale-Nationale',
  G3J: 'Capitale-Nationale', G3K: 'Capitale-Nationale', G3L: 'Capitale-Nationale',
  G3M: 'Capitale-Nationale', G3N: 'Capitale-Nationale', G3Z: 'Capitale-Nationale',
  G0A: 'Capitale-Nationale', // Portneuf rural
  G0N: 'Capitale-Nationale',

  // ── Mauricie (04) ──
  G8T: 'Mauricie', G8V: 'Mauricie', G8W: 'Mauricie', G8X: 'Mauricie',
  G8Y: 'Mauricie', G8Z: 'Mauricie',
  G9A: 'Mauricie', G9B: 'Mauricie', G9C: 'Mauricie', // Trois-Rivières
  G9N: 'Mauricie', G9P: 'Mauricie', // Shawinigan
  G9T: 'Mauricie', G9X: 'Mauricie', // La Tuque
  G0T: 'Mauricie', G0V: 'Mauricie', G0X: 'Mauricie',

  // ── Estrie (05) ──
  J1H: 'Estrie', J1J: 'Estrie', J1K: 'Estrie', J1L: 'Estrie', // Sherbrooke
  J1M: 'Estrie', J1N: 'Estrie', J1R: 'Estrie', J1S: 'Estrie',
  J1T: 'Estrie', J1X: 'Estrie', J1Z: 'Estrie',
  J0B: 'Estrie',

  // ── Montréal (06) ──
  H1A: 'Montréal', H1B: 'Montréal', H1C: 'Montréal', H1E: 'Montréal',
  H1G: 'Montréal', H1H: 'Montréal', H1J: 'Montréal', H1K: 'Montréal',
  H1L: 'Montréal', H1M: 'Montréal', H1N: 'Montréal', H1P: 'Montréal',
  H1R: 'Montréal', H1S: 'Montréal', H1T: 'Montréal', H1V: 'Montréal',
  H1W: 'Montréal', H1X: 'Montréal', H1Y: 'Montréal', H1Z: 'Montréal',
  H2A: 'Montréal', H2B: 'Montréal', H2C: 'Montréal', H2E: 'Montréal',
  H2G: 'Montréal', H2H: 'Montréal', H2J: 'Montréal', H2K: 'Montréal',
  H2L: 'Montréal', H2M: 'Montréal', H2N: 'Montréal', H2P: 'Montréal',
  H2R: 'Montréal', H2S: 'Montréal', H2T: 'Montréal', H2V: 'Montréal',
  H2W: 'Montréal', H2X: 'Montréal', H2Y: 'Montréal', H2Z: 'Montréal',
  H3A: 'Montréal', H3B: 'Montréal', H3C: 'Montréal', H3E: 'Montréal',
  H3G: 'Montréal', H3H: 'Montréal', H3J: 'Montréal', H3K: 'Montréal',
  H3L: 'Montréal', H3M: 'Montréal', H3N: 'Montréal', H3P: 'Montréal',
  H3R: 'Montréal', H3S: 'Montréal', H3T: 'Montréal', H3V: 'Montréal',
  H3W: 'Montréal', H3X: 'Montréal', H3Y: 'Montréal', H3Z: 'Montréal',
  H4A: 'Montréal', H4B: 'Montréal', H4C: 'Montréal', H4E: 'Montréal',
  H4G: 'Montréal', H4H: 'Montréal', H4J: 'Montréal', H4K: 'Montréal',
  H4L: 'Montréal', H4M: 'Montréal', H4N: 'Montréal', H4P: 'Montréal',
  H4R: 'Montréal', H4S: 'Montréal', H4T: 'Montréal', H4V: 'Montréal',
  H4W: 'Montréal', H4X: 'Montréal', H4Y: 'Montréal', H4Z: 'Montréal',
  H5A: 'Montréal', H5B: 'Montréal',
  H8N: 'Montréal', H8P: 'Montréal', H8R: 'Montréal', H8S: 'Montréal', H8T: 'Montréal',
  H9A: 'Montréal', H9B: 'Montréal', H9C: 'Montréal', H9E: 'Montréal',
  H9G: 'Montréal', H9H: 'Montréal', H9J: 'Montréal', H9K: 'Montréal',
  H9P: 'Montréal', H9R: 'Montréal', H9S: 'Montréal', H9W: 'Montréal', H9X: 'Montréal',

  // ── Outaouais (07) ──
  J8L: 'Outaouais', J8M: 'Outaouais', J8N: 'Outaouais', J8P: 'Outaouais',
  J8R: 'Outaouais', J8T: 'Outaouais', J8V: 'Outaouais', J8X: 'Outaouais',
  J8Y: 'Outaouais', J8Z: 'Outaouais',
  J9A: 'Outaouais', J9H: 'Outaouais', J9J: 'Outaouais', // Gatineau/Hull
  J0V: 'Outaouais', J0X: 'Outaouais',

  // ── Abitibi-Témiscamingue (08) ──
  J9B: 'Abitibi-Témiscamingue', J9E: 'Abitibi-Témiscamingue',
  J9L: 'Abitibi-Témiscamingue', J9T: 'Abitibi-Témiscamingue',
  J9V: 'Abitibi-Témiscamingue', J9X: 'Abitibi-Témiscamingue',
  J9Y: 'Abitibi-Témiscamingue', J9Z: 'Abitibi-Témiscamingue',
  J0Y: 'Abitibi-Témiscamingue', J0Z: 'Abitibi-Témiscamingue',

  // ── Côte-Nord (09) ──
  G4R: 'Côte-Nord', G4S: 'Côte-Nord', G4T: 'Côte-Nord', // Sept-Îles
  G5A: 'Côte-Nord', G5B: 'Côte-Nord', G5C: 'Côte-Nord', // Baie-Comeau
  G0G: 'Côte-Nord', G0H: 'Côte-Nord',

  // ── Nord-du-Québec (10) ──
  // Codes G0W (partiel), J0M, J0Y (partiel) — très peu de codes postaux
  J0M: 'Nord-du-Québec',

  // ── Gaspésie–Îles-de-la-Madeleine (11) ──
  G0C: 'Gaspésie–Îles-de-la-Madeleine', G0E: 'Gaspésie–Îles-de-la-Madeleine',
  G0M: 'Gaspésie–Îles-de-la-Madeleine',
  G4V: 'Gaspésie–Îles-de-la-Madeleine', // Sainte-Anne-des-Monts
  G4X: 'Gaspésie–Îles-de-la-Madeleine', // Gaspé
  G4Y: 'Gaspésie–Îles-de-la-Madeleine', G4Z: 'Gaspésie–Îles-de-la-Madeleine',
  G5H: 'Gaspésie–Îles-de-la-Madeleine',

  // ── Chaudière-Appalaches (12) ──
  G5Y: 'Chaudière-Appalaches', G5Z: 'Chaudière-Appalaches',
  G6A: 'Chaudière-Appalaches', G6B: 'Chaudière-Appalaches', G6C: 'Chaudière-Appalaches',
  G6E: 'Chaudière-Appalaches', G6G: 'Chaudière-Appalaches', // Thetford Mines
  G6H: 'Chaudière-Appalaches', G6J: 'Chaudière-Appalaches', G6K: 'Chaudière-Appalaches',
  G6L: 'Chaudière-Appalaches',
  G6P: 'Chaudière-Appalaches', G6R: 'Chaudière-Appalaches', G6S: 'Chaudière-Appalaches',
  G6T: 'Chaudière-Appalaches', G6V: 'Chaudière-Appalaches', // Lévis
  G6W: 'Chaudière-Appalaches', G6X: 'Chaudière-Appalaches',
  G6Y: 'Chaudière-Appalaches', G6Z: 'Chaudière-Appalaches',
  G7A: 'Chaudière-Appalaches', G7B: 'Chaudière-Appalaches', G7C: 'Chaudière-Appalaches',
  G7E: 'Chaudière-Appalaches', G7G: 'Chaudière-Appalaches',
  G0R: 'Chaudière-Appalaches', G0S: 'Chaudière-Appalaches',

  // ── Laval (13) ──
  H7A: 'Laval', H7B: 'Laval', H7C: 'Laval', H7E: 'Laval', H7G: 'Laval',
  H7H: 'Laval', H7J: 'Laval', H7K: 'Laval', H7L: 'Laval', H7M: 'Laval',
  H7N: 'Laval', H7P: 'Laval', H7R: 'Laval', H7S: 'Laval', H7T: 'Laval',
  H7V: 'Laval', H7W: 'Laval', H7X: 'Laval', H7Y: 'Laval',

  // ── Lanaudière (14) ──
  J0K: 'Lanaudière',
  J5L: 'Lanaudière', J5R: 'Lanaudière', J5T: 'Lanaudière', J5V: 'Lanaudière',
  J5W: 'Lanaudière', J5X: 'Lanaudière', J5Y: 'Lanaudière', J5Z: 'Lanaudière',
  J6E: 'Lanaudière', J6S: 'Lanaudière', J6V: 'Lanaudière',
  J6W: 'Lanaudière', J6X: 'Lanaudière', J6Y: 'Lanaudière', J6Z: 'Lanaudière',

  // ── Laurentides (15) ──
  J0N: 'Laurentides', J0R: 'Laurentides', J0T: 'Laurentides',
  J7A: 'Laurentides', J7B: 'Laurentides', J7C: 'Laurentides', J7E: 'Laurentides',
  J7G: 'Laurentides', J7H: 'Laurentides', J7J: 'Laurentides', J7K: 'Laurentides',
  J7L: 'Laurentides', J7M: 'Laurentides', J7N: 'Laurentides', J7P: 'Laurentides',
  J7R: 'Laurentides', J7S: 'Laurentides', J7T: 'Laurentides', J7V: 'Laurentides',
  J7W: 'Laurentides', J7X: 'Laurentides', J7Y: 'Laurentides', J7Z: 'Laurentides',
  J8A: 'Laurentides', J8B: 'Laurentides', J8C: 'Laurentides', J8E: 'Laurentides',
  J8G: 'Laurentides', J8H: 'Laurentides', J8K: 'Laurentides',

  // ── Montérégie (16) ──
  J0H: 'Montérégie', J0L: 'Montérégie', J0S: 'Montérégie',
  J3A: 'Montérégie', J3B: 'Montérégie', J3E: 'Montérégie', J3G: 'Montérégie',
  J3H: 'Montérégie', J3L: 'Montérégie', J3M: 'Montérégie', J3N: 'Montérégie',
  J3P: 'Montérégie', J3R: 'Montérégie', J3T: 'Montérégie', J3V: 'Montérégie',
  J3X: 'Montérégie', J3Y: 'Montérégie', J3Z: 'Montérégie',
  J4B: 'Montérégie', J4G: 'Montérégie', J4H: 'Montérégie', J4J: 'Montérégie',
  J4K: 'Montérégie', J4L: 'Montérégie', J4M: 'Montérégie', J4N: 'Montérégie',
  J4P: 'Montérégie', J4R: 'Montérégie', J4S: 'Montérégie', J4T: 'Montérégie',
  J4V: 'Montérégie', J4W: 'Montérégie', J4X: 'Montérégie', J4Y: 'Montérégie',
  J4Z: 'Montérégie',
  J5A: 'Montérégie', J5B: 'Montérégie', J5C: 'Montérégie', J5J: 'Montérégie',
  J5K: 'Montérégie', J5M: 'Montérégie', J5N: 'Montérégie',
  H5R: 'Montérégie', H5W: 'Montérégie', // LaSalle/Verdun bordure
  H8N: 'Montréal', // déjà dans Montréal, Lachine

  // ── Centre-du-Québec (17) ──
  J0A: 'Centre-du-Québec', J0C: 'Centre-du-Québec', J0G: 'Centre-du-Québec',
  J1A: 'Centre-du-Québec', // Drummondville area — NOTE: J2A/B/C aussi
  J2A: 'Centre-du-Québec', J2B: 'Centre-du-Québec', J2C: 'Centre-du-Québec',
  J2E: 'Centre-du-Québec', J2G: 'Centre-du-Québec', J2H: 'Centre-du-Québec',
  J2K: 'Centre-du-Québec', J2L: 'Centre-du-Québec', J2M: 'Centre-du-Québec',
  J2N: 'Centre-du-Québec', J2R: 'Centre-du-Québec', J2S: 'Centre-du-Québec',
  J2T: 'Centre-du-Québec',
  G0P: 'Centre-du-Québec', G0Z: 'Centre-du-Québec',
};

// ─── 2. Mapping noms MRC (county Nominatim) → Région ─────────────────────────
// Couvre les cas où state_district est absent mais county = nom de la MRC

const MRC_TO_REGION: Record<string, RegionQuebec> = {
  // Saguenay–Lac-Saint-Jean
  'Le Fjord-du-Saguenay': 'Saguenay–Lac-Saint-Jean',
  'Chicoutimi': 'Saguenay–Lac-Saint-Jean',
  'Jonquière': 'Saguenay–Lac-Saint-Jean',
  'Lac-Saint-Jean-Est': 'Saguenay–Lac-Saint-Jean',
  'Le Domaine-du-Roy': 'Saguenay–Lac-Saint-Jean',
  'Maria-Chapdelaine': 'Saguenay–Lac-Saint-Jean',
  'Saguenay': 'Saguenay–Lac-Saint-Jean',
  'Alma': 'Saguenay–Lac-Saint-Jean',

  // Capitale-Nationale
  'Québec': 'Capitale-Nationale',
  'La Jacques-Cartier': 'Capitale-Nationale',
  'Portneuf': 'Capitale-Nationale',
  'Charlevoix': 'Capitale-Nationale',
  'Charlevoix-Est': 'Capitale-Nationale',
  'L\'Île-d\'Orléans': 'Capitale-Nationale',
  'La Côte-de-Beaupré': 'Capitale-Nationale',

  // Mauricie
  'Trois-Rivières': 'Mauricie',
  'Shawinigan': 'Mauricie',
  'Francheville': 'Mauricie',
  'Mékinac': 'Mauricie',
  'La Tuque': 'Mauricie',
  'Le Haut-Saint-Maurice': 'Mauricie',
  'Maskinongé': 'Mauricie',

  // Estrie
  'Sherbrooke': 'Estrie',
  'Coaticook': 'Estrie',
  'Memphrémagog': 'Estrie',
  'Le Granit': 'Estrie',
  'Le Val-Saint-François': 'Estrie',
  'Les Sources': 'Estrie',

  // Outaouais
  'Gatineau': 'Outaouais',
  'Les Collines-de-l\'Outaouais': 'Outaouais',
  'Pontiac': 'Outaouais',
  'La Vallée-de-la-Gatineau': 'Outaouais',
  'Papineau': 'Outaouais',

  // Abitibi-Témiscamingue
  'Rouyn-Noranda': 'Abitibi-Témiscamingue',
  'Abitibi': 'Abitibi-Témiscamingue',
  'Abitibi-Ouest': 'Abitibi-Témiscamingue',
  'La Vallée-de-l\'Or': 'Abitibi-Témiscamingue',
  'Témiscamingue': 'Abitibi-Témiscamingue',

  // Côte-Nord
  'Sept-Rivières': 'Côte-Nord',
  'Manicouagan': 'Côte-Nord',
  'Minganie': 'Côte-Nord',
  'Haute-Côte-Nord': 'Côte-Nord',
  'Caniapiscau': 'Côte-Nord',

  // Gaspésie–Îles-de-la-Madeleine
  'La Haute-Gaspésie': 'Gaspésie–Îles-de-la-Madeleine',
  'La Côte-de-Gaspé': 'Gaspésie–Îles-de-la-Madeleine',
  'Rocher-Percé': 'Gaspésie–Îles-de-la-Madeleine',
  'Avignon': 'Gaspésie–Îles-de-la-Madeleine',
  'Bonaventure': 'Gaspésie–Îles-de-la-Madeleine',
  'Les Îles-de-la-Madeleine': 'Gaspésie–Îles-de-la-Madeleine',

  // Chaudière-Appalaches
  'Lévis': 'Chaudière-Appalaches',
  'Beauce-Sartigan': 'Chaudière-Appalaches',
  'La Nouvelle-Beauce': 'Chaudière-Appalaches',
  'Robert-Cliche': 'Chaudière-Appalaches',
  'Les Etchemins': 'Chaudière-Appalaches',
  'Bellechasse': 'Chaudière-Appalaches',
  'Montmagny': 'Chaudière-Appalaches',
  'L\'Islet': 'Chaudière-Appalaches',
  'Appalaches': 'Chaudière-Appalaches',

  // Laval
  'Laval': 'Laval',

  // Lanaudière
  'L\'Assomption': 'Lanaudière',
  'Joliette': 'Lanaudière',
  'D\'Autray': 'Lanaudière',
  'Matawinie': 'Lanaudière',
  'Montcalm': 'Lanaudière',
  'Les Moulins': 'Lanaudière',

  // Laurentides
  'Deux-Montagnes': 'Laurentides',
  'Thérèse-De Blainville': 'Laurentides',
  'La Rivière-du-Nord': 'Laurentides',
  'Pays-d\'en-Haut': 'Laurentides',
  'Les Laurentides': 'Laurentides',
  'Antoine-Labelle': 'Laurentides',
  'Argenteuil': 'Laurentides',
  'Mirabel': 'Laurentides',

  // Montérégie
  'Longueuil': 'Montérégie',
  'La Vallée-du-Richelieu': 'Montérégie',
  'Vaudreuil-Soulanges': 'Montérégie',
  'Haut-Richelieu': 'Montérégie',
  'Roussillon': 'Montérégie',
  'Rouville': 'Montérégie',
  'Le Haut-Saint-Laurent': 'Montérégie',
  'Brome-Missisquoi': 'Montérégie',
  'Acton': 'Montérégie',
  'Lajemmerais': 'Montérégie',
  'Les Maskoutains': 'Montérégie',

  // Centre-du-Québec
  'Drummond': 'Centre-du-Québec',
  'Arthabaska': 'Centre-du-Québec',
  'Bécancour': 'Centre-du-Québec',
  'L\'Érable': 'Centre-du-Québec',
  'Nicolet-Yamaska': 'Centre-du-Québec',
};

// ─── 3. Normalisation des noms de régions (variantes Nominatim) ───────────────
const REGION_NAME_VARIANTS: Record<string, RegionQuebec> = {
  // Nominatim peut retourner des variantes sans accents ou avec tirets différents
  'Saguenay-Lac-Saint-Jean': 'Saguenay–Lac-Saint-Jean',
  'Saguenay–Lac-Saint-Jean': 'Saguenay–Lac-Saint-Jean',
  'Gaspésie-Îles-de-la-Madeleine': 'Gaspésie–Îles-de-la-Madeleine',
  'Gaspésie–Îles-de-la-Madeleine': 'Gaspésie–Îles-de-la-Madeleine',
  'Bas-Saint-Laurent': 'Bas-Saint-Laurent',
  'Capitale-Nationale': 'Capitale-Nationale',
  'Mauricie': 'Mauricie',
  'Estrie': 'Estrie',
  'Montréal': 'Montréal',
  'Montreal': 'Montréal',
  'Outaouais': 'Outaouais',
  'Abitibi-Témiscamingue': 'Abitibi-Témiscamingue',
  'Abitibi-Temiscamingue': 'Abitibi-Témiscamingue',
  'Côte-Nord': 'Côte-Nord',
  'Cote-Nord': 'Côte-Nord',
  'Nord-du-Québec': 'Nord-du-Québec',
  'Nord-du-Quebec': 'Nord-du-Québec',
  'Chaudière-Appalaches': 'Chaudière-Appalaches',
  'Chaudiere-Appalaches': 'Chaudière-Appalaches',
  'Laval': 'Laval',
  'Lanaudière': 'Lanaudière',
  'Lanaudiere': 'Lanaudière',
  'Laurentides': 'Laurentides',
  'Montérégie': 'Montérégie',
  'Monteregie': 'Montérégie',
  'Centre-du-Québec': 'Centre-du-Québec',
  'Centre-du-Quebec': 'Centre-du-Québec',
};

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Détecte la région administrative du Québec à partir d'une réponse Nominatim.
 *
 * Stratégie (ordre de priorité) :
 *   1. state_district → normalisation directe
 *   2. county → mapping MRC vers région
 *   3. code_postal FSA (3 chars) → lookup table
 *   4. null → l'UI affiche un sélecteur manuel
 */
export function detecterRegionAdministrative(
  nominatimAddress: Record<string, string>,
  codePostal?: string
): RegionQuebec | null {
  // Stratégie 1 : state_district (Nominatim le retourne quand il a les données OSM complètes)
  const stateDistrict = nominatimAddress?.state_district;
  if (stateDistrict) {
    const normalized = REGION_NAME_VARIANTS[stateDistrict] || REGION_NAME_VARIANTS[stateDistrict.trim()];
    if (normalized) return normalized;
    // Vérification directe dans la liste
    if (REGIONS_QUEBEC.includes(stateDistrict as RegionQuebec)) {
      return stateDistrict as RegionQuebec;
    }
  }

  // Stratégie 2 : county → MRC lookup
  const county = nominatimAddress?.county;
  if (county) {
    const region = MRC_TO_REGION[county] || MRC_TO_REGION[county.trim()];
    if (region) return region;
  }

  // Stratégie 3 : code postal FSA
  const postalSource = codePostal || nominatimAddress?.postcode;
  if (postalSource) {
    const fsa = postalSource.replace(/\s/g, '').toUpperCase().slice(0, 3);
    const region = FSA_TO_REGION[fsa];
    if (region) return region;
  }

  // Aucune détection possible → fallback UI
  return null;
}

/**
 * Geocode une adresse via Nominatim et retourne lat, lng + région détectée.
 * À utiliser côté serveur (API route Next.js).
 *
 * @returns { lat, lng, region, regionSource } — region=null si non détectée
 */
export async function geocoderAdresse(adresse: string, codePostal?: string) {
  const query = encodeURIComponent(adresse);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1&countrycodes=ca`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'RIUSC-Portal/2.0 (portail.riusc.ca)' },
  });

  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

  const data = await res.json();
  if (!data || data.length === 0) return null;

  const result = data[0];
  const addr = result.address || {};

  // Rejeter les coordonnées par défaut de geocoder.ca (Alberta)
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);
  if (
    Math.abs(lat - 49.00041490) < 0.001 &&
    Math.abs(lng - (-112.78802660)) < 0.001
  ) {
    return null; // coordonnées invalides Alberta
  }

  const region = detecterRegionAdministrative(addr, codePostal);
  const regionSource = region
    ? addr.state_district
      ? 'nominatim_state_district'
      : addr.county && MRC_TO_REGION[addr.county]
        ? 'mrc_mapping'
        : 'fsa_postal'
    : 'manual_required';

  return { lat, lng, region, regionSource, displayName: result.display_name };
}
