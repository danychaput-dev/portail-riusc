import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('inscriptions_camps')
    .select('session_id')
    .in('presence', ['confirme', 'incertain'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  for (const row of data || []) {
    counts[row.session_id] = (counts[row.session_id] || 0) + 1
  }

  return NextResponse.json(counts, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }
  })
}
