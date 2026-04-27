// app/api/admin/demandes/importer-sopfeu/parse/route.ts
// Parse le XLSX de mobilisation SOPFEU (onglet 1) et retourne un objet JSON
// structuré prêt à être prévisualisé puis converti en sinistre + demande.
//
// Le template SOPFEU a une mise en page rigide (labels en col A ou C, valeurs
// dans la cellule fusionnée à droite). Si SOPFEU modifie le gabarit, mettre
// à jour le CELL_MAP ci-dessous. Gabarit de référence:
// docs/formulaires-partenaires/sopfeu-mobilisation-reservistes_2026-04.xlsx
//
// N'écrit RIEN en DB — c'est juste un parseur. L'écriture se fait dans
// /api/admin/demandes/importer-sopfeu/creer après validation par l'admin.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'
import type { ParsedSopfeu, EffectifParsed } from '@/types/sopfeu-import'

const SHEET_NAME = 'Formulaire de mobilisation'

// Mapping cellule → champ logique. La valeur est lue à la cellule indiquée.
// Quand plusieurs cellules contiennent des fragments (ex: contact CPO), on
// les recompose dans parseSheet().
const CELL_MAP = {
  // En-tête
  numero_intervention: 'E2',   // après "Numéro d'intervention SOPFEU :" en C2
  lieu_intervention:   'E3',   // après "Lieu de l'intervention :" en C3
  nature_demande:      'E4',   // après "Nature de la demande :" en C4

  // Contact CPO (SOPFEU) — ligne 5 labels / ligne 6 téléphones+courriel
  contact_cpo_prenom:   'F5',
  contact_cpo_nom:      'H5',
  contact_cpo_fonction: 'J5',
  contact_cpo_tel_1:    'F6',
  contact_cpo_tel_2:    'H6',
  contact_cpo_courriel: 'J6',

  // 1. Mandat opérationnel
  description_evenement:    'C8',
  evolution_attendue:       'C9',
  au_profit_de:             'C10',
  principales_taches:       'C11',
  mandat_autres_precisions: 'C12',

  // 2. Conditions opérationnelles
  meteo:                    'C14',
  amplitudes_horaires:      'C15',
  enjeux_sst:               'C16',
  charge_mentale:           'C17',
  conditions_autres:        'C18',

  // 3. Effectifs requis — tableau 4 rôles. Structure par ligne:
  // col A = label, col C = nombre, D:E = capacité 1, F:G = capacité 2,
  // H:I = capacité 3, col J = autres précisions.
  // Ligne 21 = Réserviste, 22 = Spéc. abattage, 23 = Spéc. manœuvre force,
  // 24 = Chef d'équipe, 25 = autres précisions globales.
  effectifs_autres_precisions: 'C25',

  // 4. Date, heure et lieu de rendez-vous
  duree_min_dispo:           'C27',
  rdv_date:                  'C28',
  rdv_heure:                 'E28',
  rdv_lieu:                  'G28',
  stationnement:             'C29',
  contact_site_prenom:       'C30',
  contact_site_nom:          'F30',
  contact_site_fonction:     'I30',
  contact_site_tel_1:        'C31',
  contact_site_tel_2:        'F31',
  contact_site_courriel:     'I31',
  rdv_autres_precisions:     'C32',

  // 5. Services et installations
  hebergement:              'C34',
  alimentation:             'C35',
  installations:            'C36',
  connectivite:             'C37',
  services_autres:          'C38',
} as const

type FieldKey = keyof typeof CELL_MAP

// Lignes des effectifs — parsées séparément car format tableau
const EFFECTIFS_ROWS = [
  { role: 'reserviste',                   label: 'Réserviste / Réserviste avancé', row: 21 },
  { role: 'specialiste_abattage',         label: 'Spécialiste abattage',           row: 22 },
  { role: 'specialiste_manoeuvre_force',  label: 'Spécialiste Manœuvre de force',  row: 23 },
  { role: 'chef_equipe',                  label: "Chef d'équipe",                  row: 24 },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readCell(ws: XLSX.WorkSheet, coord: string): string {
  const cell = ws[coord]
  if (!cell) return ''
  const v = cell.v
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function readCellNumber(ws: XLSX.WorkSheet, coord: string): number | null {
  const cell = ws[coord]
  if (!cell) return null
  if (typeof cell.v === 'number') return cell.v
  const parsed = parseInt(String(cell.v).replace(/\D/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

// Excel stocke les dates en numéro de série (jours depuis 1899-12-30).
// Quand `cellDates: true`, xlsx renvoie un Date JS directement.
function readCellDate(ws: XLSX.WorkSheet, coord: string): string {
  const cell = ws[coord]
  if (!cell) return ''
  if (cell.v instanceof Date) {
    // ISO date-only (pas de fuseau)
    const d = cell.v
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  // Fallback: essai de parse depuis texte (DD/MM/YYYY ou YYYY-MM-DD)
  const s = String(cell.v).trim()
  const ddmmyyyy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  return s
}

function readCellTime(ws: XLSX.WorkSheet, coord: string): string {
  const cell = ws[coord]
  if (!cell) return ''
  if (cell.v instanceof Date) {
    const d = cell.v
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return String(cell.v).trim()
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuthAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabase
    .from('reservistes')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return user
}

// ─── Parser ──────────────────────────────────────────────────────────────────

function parseSheet(ws: XLSX.WorkSheet): ParsedSopfeu {
  const warnings: string[] = []
  const out: any = { warnings, effectifs: [] as EffectifParsed[] }

  // Lecture générique: chaque champ du CELL_MAP → string
  for (const [key, coord] of Object.entries(CELL_MAP) as [FieldKey, string][]) {
    // Champs typés spécifiquement
    if (key === 'rdv_date') {
      out[key] = readCellDate(ws, coord)
    } else if (key === 'rdv_heure') {
      out[key] = readCellTime(ws, coord)
    } else {
      out[key] = readCell(ws, coord)
    }
  }

  // Effectifs: parser les 4 lignes
  for (const { role, label, row } of EFFECTIFS_ROWS) {
    const nombre = readCellNumber(ws, `C${row}`)
    const capacites = [
      readCell(ws, `D${row}`),
      readCell(ws, `F${row}`),
      readCell(ws, `H${row}`),
    ].filter(Boolean)
    const autres_precisions = readCell(ws, `J${row}`)
    if (nombre !== null || capacites.length > 0 || autres_precisions) {
      out.effectifs.push({ role, label, nombre, capacites, autres_precisions })
    }
  }

  // Validations / warnings
  if (!out.lieu_intervention) warnings.push("Lieu de l'intervention absent — requis pour créer le sinistre.")
  if (!out.description_evenement) warnings.push('Description de l\'événement absente — requise.')
  if (!out.rdv_date) warnings.push('Date de rendez-vous absente — requise pour le déploiement.')
  if (out.effectifs.length === 0) warnings.push('Aucun effectif renseigné — le nombre de personnes requis sera 0.')

  return out as ParsedSopfeu
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    const ws = wb.Sheets[SHEET_NAME]
    if (!ws) {
      return NextResponse.json({
        error: `Onglet introuvable: "${SHEET_NAME}". Vérifier que le fichier est bien le gabarit SOPFEU.`,
        onglets_disponibles: wb.SheetNames,
      }, { status: 400 })
    }

    const parsed = parseSheet(ws)
    return NextResponse.json({ ok: true, data: parsed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erreur de parsing' }, { status: 500 })
  }
}
