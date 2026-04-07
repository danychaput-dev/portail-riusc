import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // Compter les courriels par benevole_id
  const { data: courriels } = await supabaseAdmin
    .from('courriels')
    .select('benevole_id')

  // Compter les notes par benevole_id
  const { data: notes } = await supabaseAdmin
    .from('notes_reservistes')
    .select('benevole_id')

  const counts: Record<string, { courriels: number; notes: number }> = {}

  for (const row of courriels || []) {
    const id = row.benevole_id
    if (!id) continue
    if (!counts[id]) counts[id] = { courriels: 0, notes: 0 }
    counts[id].courriels++
  }

  for (const row of notes || []) {
    const id = row.benevole_id
    if (!id) continue
    if (!counts[id]) counts[id] = { courriels: 0, notes: 0 }
    counts[id].notes++
  }

  return NextResponse.json(counts)
}
