import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole, isAuthError } from '@/utils/auth-api'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchAll<T>(table: string, selectCols: string): Promise<T[]> {
  let all: T[] = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data } = await supabaseAdmin
      .from(table)
      .select(selectCols)
      .range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all = all.concat(data as T[])
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

export async function GET() {
  const auth = await requireRole('superadmin', 'admin', 'coordonnateur', 'adjoint')
  if (isAuthError(auth)) return auth

  // Charger courriels, notes et reponses en parallele
  const [courriels, notes, reponses] = await Promise.all([
    fetchAll<{ benevole_id: string }>('courriels', 'benevole_id'),
    fetchAll<{ benevole_id: string }>('notes_reservistes', 'benevole_id'),
    fetchAll<{ benevole_id: string | null; statut: string }>('courriel_reponses', 'benevole_id, statut'),
  ])

  const counts: Record<string, { courriels: number; notes: number; non_lus: number }> = {}

  for (const row of courriels) {
    const id = row.benevole_id
    if (!id) continue
    if (!counts[id]) counts[id] = { courriels: 0, notes: 0, non_lus: 0 }
    counts[id].courriels++
  }

  for (const row of notes) {
    const id = row.benevole_id
    if (!id) continue
    if (!counts[id]) counts[id] = { courriels: 0, notes: 0, non_lus: 0 }
    counts[id].notes++
  }

  // Reponses entrantes non lues (statut = 'recu')
  for (const row of reponses) {
    const id = row.benevole_id
    if (!id) continue
    if (!counts[id]) counts[id] = { courriels: 0, notes: 0, non_lus: 0 }
    // Compter les reponses comme courriels aussi (elles font partie de l'historique)
    counts[id].courriels++
    if (row.statut === 'recu') {
      counts[id].non_lus++
    }
  }

  return NextResponse.json(counts)
}
