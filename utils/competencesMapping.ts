/**
 * Mapping des compétences des réservistes pour la page /admin/competences.
 *
 * Chaque entrée définit comment détecter une compétence spécifique à partir
 * des colonnes Supabase (qui sont des string[] pour les cases multi-choix).
 *
 * Utilisé côté serveur (API route XLSX) ET côté client (affichage matrice).
 */

export type FamilleCompetence =
  | 'Premiers soins'
  | 'Sécurité'
  | 'Communication'
  | 'Permis'
  | 'Langues'
  | 'Véhicules'
  | 'Cartographie'
  | 'SCI/ICS'
  | 'R&S SARVAC'
  | 'Sauvetage'
  | 'Drone'
  | 'K9'

/** Colonnes Supabase string[] utilisables pour la détection. */
export type SourceColumn =
  | 'certificat_premiers_soins'
  | 'competences_securite'
  | 'communication'
  | 'permis_conduire'
  | 'navire_marin'
  | 'vehicule_tout_terrain'
  | 'cartographie_sig'
  | 'certification_csi'
  | 'competence_rs'
  | 'competences_sauvetage'
  | 'satp_drone'
  | 'equipe_canine'
  | 'langues' // traitée séparément (jointure)

export interface CompetenceDef {
  famille: FamilleCompetence
  label: string
  source: SourceColumn
  /** Regex insensibles à la casse. Match si AU MOINS UNE regex match AU MOINS UN item du tableau. */
  patterns: RegExp[]
}

export const COMPETENCES: CompetenceDef[] = [
  // ─── Premiers soins ────────────────────────────────────────────────────
  { famille: 'Premiers soins', label: 'RCR/DEA',            source: 'certificat_premiers_soins', patterns: [/\ba\)/i, /rcr/i, /cpr/i] },
  { famille: 'Premiers soins', label: 'Standard',           source: 'certificat_premiers_soins', patterns: [/\bb\)/i] },
  { famille: 'Premiers soins', label: 'Milieu travail',     source: 'certificat_premiers_soins', patterns: [/\bc\)/i] },
  { famille: 'Premiers soins', label: 'Milieu éloigné',     source: 'certificat_premiers_soins', patterns: [/\bd\)/i] },
  { famille: 'Premiers soins', label: 'Premier répondant',  source: 'certificat_premiers_soins', patterns: [/\be\)/i] },
  { famille: 'Premiers soins', label: 'Infirmier/ère',      source: 'certificat_premiers_soins', patterns: [/\bf\)/i, /infirm/i] },
  { famille: 'Premiers soins', label: 'Paramédic',          source: 'certificat_premiers_soins', patterns: [/\bg\)/i, /param[eé]dic/i] },

  // ─── Sécurité ──────────────────────────────────────────────────────────
  { famille: 'Sécurité', label: 'Scie à chaîne',            source: 'competences_securite', patterns: [/scie/i, /chain ?saw/i] },
  { famille: 'Sécurité', label: 'Cours CNESST scie',        source: 'competences_securite', patterns: [/cnesst/i, /chain saw safety/i, /s[eé]curit[eé].*scie/i] },
  { famille: 'Sécurité', label: 'Contrôle routier',         source: 'competences_securite', patterns: [/contr[oô]le de la circulation/i, /traffic control/i, /flagging/i] },
  { famille: 'Sécurité', label: 'Formateur CNESST',         source: 'competences_securite', patterns: [/formateur/i] },

  // ─── Communication ─────────────────────────────────────────────────────
  { famille: 'Communication', label: 'Radio amateur',       source: 'communication', patterns: [/radio\s*amateur/i, /amateur\s*radio/i, /radioamateur/i] },
  { famille: 'Communication', label: 'Radio maritime',      source: 'communication', patterns: [/maritime/i] },
  { famille: 'Communication', label: 'Radio aéronautique',  source: 'communication', patterns: [/a[eé]ronautique/i, /aeronautical/i] },
  { famille: 'Communication', label: 'Communication pro',   source: 'communication', patterns: [/professonnel/i, /professionnel/i, /exp[eé]rience/i] },

  // ─── Permis de conduire ────────────────────────────────────────────────
  { famille: 'Permis', label: 'Classe 1',                   source: 'permis_conduire', patterns: [/classe\s*1\b/i] },
  { famille: 'Permis', label: 'Classe 2',                   source: 'permis_conduire', patterns: [/classe\s*2\b/i] },
  { famille: 'Permis', label: 'Classe 3',                   source: 'permis_conduire', patterns: [/classe\s*3\b/i] },
  { famille: 'Permis', label: 'Classe 4a (urgence)',        source: 'permis_conduire', patterns: [/classe\s*4a/i] },
  { famille: 'Permis', label: 'Classe 4b (autobus)',        source: 'permis_conduire', patterns: [/classe\s*4b/i] },
  { famille: 'Permis', label: 'Classe 5',                   source: 'permis_conduire', patterns: [/classe\s*5\b/i] },
  { famille: 'Permis', label: 'Classe 6 (moto)',            source: 'permis_conduire', patterns: [/classe\s*6\b/i] },
  { famille: 'Permis', label: 'Embarcation plaisance',      source: 'navire_marin', patterns: [/embarcation/i] },

  // ─── Langues ───────────────────────────────────────────────────────────
  // Spéciales: viennent d'une jointure séparée (reserviste_langues)
  { famille: 'Langues', label: 'Français',                  source: 'langues', patterns: [/fran[cç]ais/i, /french/i] },
  { famille: 'Langues', label: 'Anglais',                   source: 'langues', patterns: [/anglais/i, /english/i] },
  { famille: 'Langues', label: 'Espagnol',                  source: 'langues', patterns: [/espagnol/i, /spanish/i] },
  { famille: 'Langues', label: 'Autres langues',            source: 'langues', patterns: [/^(?!.*(fran[cç]ais|french|anglais|english|espagnol|spanish)).+$/i] },

  // ─── Véhicules ─────────────────────────────────────────────────────────
  { famille: 'Véhicules', label: 'VTT',                     source: 'vehicule_tout_terrain', patterns: [/\bvtt\b/i, /\batv\b/i] },
  { famille: 'Véhicules', label: 'Motoneige',               source: 'vehicule_tout_terrain', patterns: [/motoneige/i, /snowmobile/i] },
  { famille: 'Véhicules', label: 'Côte à côte',             source: 'vehicule_tout_terrain', patterns: [/c[oô]te\s*[àa]\s*c[oô]te/i, /side\s*by\s*side/i] },
  { famille: 'Véhicules', label: 'Argo',                    source: 'vehicule_tout_terrain', patterns: [/argo/i] },

  // ─── Cartographie / SIG ────────────────────────────────────────────────
  { famille: 'Cartographie', label: 'GPS',                  source: 'cartographie_sig', patterns: [/\bgps\b/i] },
  { famille: 'Cartographie', label: 'Cartes topo',          source: 'cartographie_sig', patterns: [/topograph/i] },
  { famille: 'Cartographie', label: 'Caltopo/Sartopo',      source: 'cartographie_sig', patterns: [/caltopo/i, /sartopo/i] },
  { famille: 'Cartographie', label: 'SIG/ArcGIS',           source: 'cartographie_sig', patterns: [/\bsig\b/i, /arcgis/i] },

  // ─── SCI / ICS ─────────────────────────────────────────────────────────
  { famille: 'SCI/ICS', label: 'SCI 100',                   source: 'certification_csi', patterns: [/\b100\b/i] },
  { famille: 'SCI/ICS', label: 'SCI 200',                   source: 'certification_csi', patterns: [/\b200\b/i] },
  { famille: 'SCI/ICS', label: 'SCI 300',                   source: 'certification_csi', patterns: [/\b300\b/i] },
  { famille: 'SCI/ICS', label: 'SCI 400',                   source: 'certification_csi', patterns: [/\b400\b/i] },

  // ─── R&S SARVAC ────────────────────────────────────────────────────────
  { famille: 'R&S SARVAC', label: 'Niv.1 Équipier',         source: 'competence_rs', patterns: [/niveau\s*1.*[ée]quipier/i] },
  { famille: 'R&S SARVAC', label: 'Niv.1 Chercheur',        source: 'competence_rs', patterns: [/niveau\s*1.*chercheur/i] },
  { famille: 'R&S SARVAC', label: 'Niv.2 Chef d\'équipe',   source: 'competence_rs', patterns: [/niveau\s*2/i] },
  { famille: 'R&S SARVAC', label: 'Niv.3',                  source: 'competence_rs', patterns: [/niveau\s*3/i] },

  // ─── Sauvetage spécialisé ──────────────────────────────────────────────
  { famille: 'Sauvetage', label: 'Corde',                   source: 'competences_sauvetage', patterns: [/corde/i, /\brope\b/i] },
  { famille: 'Sauvetage', label: 'Eau vive',                source: 'competences_sauvetage', patterns: [/eau\s*vive/i, /swift\s*water/i] },
  { famille: 'Sauvetage', label: 'Glace',                   source: 'competences_sauvetage', patterns: [/glace/i, /\bice\b/i] },
  { famille: 'Sauvetage', label: 'Hauteur',                 source: 'competences_sauvetage', patterns: [/hauteur/i, /height/i] },

  // ─── Drone SATP ────────────────────────────────────────────────────────
  { famille: 'Drone', label: 'Licence Transport Canada',    source: 'satp_drone', patterns: [/licence/i] },
  { famille: 'Drone', label: '<250g',                       source: 'satp_drone', patterns: [/250\s*g/i, /moins de 250/i] },
  { famille: 'Drone', label: 'Observateur',                 source: 'satp_drone', patterns: [/observateur/i, /observer/i] },
  { famille: 'Drone', label: 'Opérations',                  source: 'satp_drone', patterns: [/op[eé]rations/i] },

  // ─── K9 ────────────────────────────────────────────────────────────────
  { famille: 'K9', label: 'K9 (tout type)',                 source: 'equipe_canine', patterns: [/.+/] },
]

/** Row minimal nécessaire pour détecter les compétences. */
export interface ReservisteCompetencesRow {
  certificat_premiers_soins: string[] | null
  competences_securite: string[] | null
  communication: string[] | null
  permis_conduire: string[] | null
  navire_marin: string[] | null
  vehicule_tout_terrain: string[] | null
  cartographie_sig: string[] | null
  certification_csi: string[] | null
  competence_rs: string[] | null
  competences_sauvetage: string[] | null
  satp_drone: string[] | null
  equipe_canine: string[] | null
  /** Liste des langues (depuis reserviste_langues joint). */
  langues: string[] | null
}

/**
 * Détecte toutes les compétences d'un réserviste.
 * Retourne un Record<label, boolean>.
 */
export function detectCompetences(row: ReservisteCompetencesRow): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const c of COMPETENCES) {
    const values = row[c.source] as string[] | null
    if (!values || values.length === 0) {
      result[c.label] = false
      continue
    }
    result[c.label] = values.some(v => c.patterns.some(p => p.test(v)))
  }
  return result
}

/** Retourne la liste des labels dans l'ordre du mapping (pour construire les colonnes). */
export function getCompetenceLabels(): string[] {
  return COMPETENCES.map(c => c.label)
}

/** Retourne les "runs" de familles consécutives pour les bannières colorées. */
export function getFamilleRuns(): Array<{ famille: FamilleCompetence; start: number; end: number }> {
  const runs: Array<{ famille: FamilleCompetence; start: number; end: number }> = []
  let current: FamilleCompetence | null = null
  let runStart = 0
  COMPETENCES.forEach((c, i) => {
    if (c.famille !== current) {
      if (current !== null) {
        runs.push({ famille: current, start: runStart, end: i - 1 })
      }
      current = c.famille
      runStart = i
    }
  })
  if (current !== null) {
    runs.push({ famille: current, start: runStart, end: COMPETENCES.length - 1 })
  }
  return runs
}

/** Couleur Tailwind par famille (utilisé dans la page). */
export const FAMILLE_COLORS: Record<FamilleCompetence, string> = {
  'Premiers soins': 'bg-green-100 text-green-900',
  'Sécurité':       'bg-yellow-100 text-yellow-900',
  'Communication':  'bg-orange-100 text-orange-900',
  'Permis':         'bg-purple-100 text-purple-900',
  'Langues':        'bg-sky-100 text-sky-900',
  'Véhicules':      'bg-red-100 text-red-900',
  'Cartographie':   'bg-emerald-100 text-emerald-900',
  'SCI/ICS':        'bg-amber-100 text-amber-900',
  'R&S SARVAC':     'bg-pink-100 text-pink-900',
  'Sauvetage':      'bg-violet-100 text-violet-900',
  'Drone':          'bg-rose-100 text-rose-900',
  'K9':             'bg-slate-200 text-slate-900',
}

/** Couleur hex par famille (pour l'export XLSX). */
export const FAMILLE_HEX: Record<FamilleCompetence, string> = {
  'Premiers soins': 'C6EFCE',
  'Sécurité':       'FFEB9C',
  'Communication':  'FCD5B5',
  'Permis':         'D9D2E9',
  'Langues':        'CCE8F4',
  'Véhicules':      'F4CCCC',
  'Cartographie':   'D9EAD3',
  'SCI/ICS':        'FFF2CC',
  'R&S SARVAC':     'EAD1DC',
  'Sauvetage':      'B4A7D6',
  'Drone':          'F9CB9C',
  'K9':             'E6E6E6',
}
