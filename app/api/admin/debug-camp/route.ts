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

  const action = req.nextUrl.searchParams.get('action') || 'noms'

  if (action === 'noms') {
    // Liste tous les nom_formation distincts qui contiennent "camp"
    const { data: formations } = await supabaseAdmin
      .from('formations_benevoles')
      .select('nom_formation, resultat, source')
      .ilike('nom_formation', '%camp%')

    // Grouper par nom_formation + résultat
    const counts: Record<string, { total: number; sources: Set<string> }> = {}
    for (const f of (formations || [])) {
      const key = `${f.nom_formation} [${f.resultat}]`
      if (!counts[key]) counts[key] = { total: 0, sources: new Set() }
      counts[key].total++
      if (f.source) counts[key].sources.add(f.source)
    }

    const summary = Object.entries(counts)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([key, v]) => ({ nom_resultat: key, total: v.total, sources: [...v.sources] }))

    return NextResponse.json({
      total_formations_avec_camp: formations?.length || 0,
      detail: summary,
    })
  }

  // action=reserviste&nom=Fourier — debug un réserviste spécifique
  const nom = req.nextUrl.searchParams.get('nom') || 'Fourier'
  const { data: reserviste } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom')
    .ilike('nom', `%${nom}%`)
    .limit(5)

  if (!reserviste?.length) return NextResponse.json({ error: 'Non trouvé' })

  const results = []
  for (const r of reserviste) {
    const { data: formations } = await supabaseAdmin
      .from('formations_benevoles')
      .select('*')
      .eq('benevole_id', r.benevole_id)

    const { data: inscriptions } = await supabaseAdmin
      .from('inscriptions_camps')
      .select('*')
      .eq('benevole_id', r.benevole_id)

    results.push({
      reserviste: r,
      formations: formations || [],
      inscriptions_camps: inscriptions || [],
    })
  }

  return NextResponse.json({ results })
}
