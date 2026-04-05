// app/api/admin/debug-camp/route.ts — TEMPORAIRE pour débugger la détection camp
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // Vérifier admin
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non auth' }, { status: 403 })

  const nom = req.nextUrl.searchParams.get('nom') || 'Fourier'

  // Trouver le réserviste
  const { data: reserviste } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom')
    .ilike('nom', `%${nom}%`)
    .limit(5)

  if (!reserviste?.length) return NextResponse.json({ error: 'Non trouvé' })

  const results = []
  for (const r of reserviste) {
    // Toutes ses formations
    const { data: formations } = await supabaseAdmin
      .from('formations_benevoles')
      .select('*')
      .eq('benevole_id', r.benevole_id)

    // Toutes ses inscriptions camps
    const { data: inscriptions } = await supabaseAdmin
      .from('inscriptions_camps')
      .select('*')
      .eq('benevole_id', r.benevole_id)

    results.push({
      reserviste: r,
      formations: formations || [],
      inscriptions_camps: inscriptions || [],
      detection: {
        camp_via_nom: formations?.some(f => (f.nom_formation || '').toLowerCase().includes('camp') && f.resultat === 'Réussi'),
        camp_via_presence: inscriptions?.some(i => i.presence === 'confirme'),
        initiation_via_nom: formations?.some(f => (f.nom_formation || '').toLowerCase().includes('initier') && f.resultat === 'Réussi'),
        initiation_via_flag: formations?.some(f => f.initiation_sc_completee === true),
      }
    })
  }

  return NextResponse.json({ results })
}
