// app/api/trajets/[id]/fin/route.ts
//
// Clôturer un trajet ouvert (pose heure_fin = now, statut = 'complete').
//
// Body attendu (tout optionnel) :
// { notes?: string, covoiturage?, covoiturage_role?, covoiturage_with? }
// → permet de compléter/ajuster les infos au moment de la fermeture.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Cookie impersonate est un JSON stringifie — voir /api/impersonate/route.ts
    const impersonateRaw = cookieStore.get('impersonate')?.value
    let impersonatedBenevoleId: string | null = null
    if (impersonateRaw) {
      try {
        const parsed = JSON.parse(impersonateRaw)
        impersonatedBenevoleId = parsed.benevole_id || null
      } catch {
        impersonatedBenevoleId = impersonateRaw
      }
    }
    let benevole_id: string | null = null
    if (impersonatedBenevoleId) {
      const { data: acteur } = await supabaseAdmin
        .from('reservistes').select('role').eq('user_id', user.id).single()
      if (acteur && ['superadmin', 'admin', 'coordonnateur'].includes(acteur.role)) {
        benevole_id = impersonatedBenevoleId
      }
    }
    if (!benevole_id) {
      const { data: me } = await supabaseAdmin
        .from('reservistes').select('benevole_id').eq('user_id', user.id).single()
      benevole_id = me?.benevole_id || null
    }
    if (!benevole_id) return NextResponse.json({ error: 'Bénévole non trouvé' }, { status: 404 })

    // Vérifier que le trajet appartient au bénévole et qu'il est ouvert
    const { data: trajet } = await supabaseAdmin
      .from('trajets')
      .select('id, benevole_id, heure_fin, statut')
      .eq('id', id)
      .single()

    if (!trajet) return NextResponse.json({ error: 'Trajet introuvable' }, { status: 404 })
    if (trajet.benevole_id !== benevole_id) {
      return NextResponse.json({ error: 'Ce trajet ne t\'appartient pas' }, { status: 403 })
    }
    if (trajet.heure_fin) {
      return NextResponse.json({ error: 'Trajet déjà fermé' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { notes, covoiturage, covoiturage_role, covoiturage_with } = body

    const updates: Record<string, any> = {
      heure_fin: new Date().toISOString(),
      statut: 'complete',
    }
    // Permettre d'ajuster les infos au moment de la clôture
    if (typeof notes === 'string' && notes.trim()) updates.notes = notes.trim()
    if (typeof covoiturage === 'boolean') {
      updates.covoiturage = covoiturage
      updates.covoiturage_role = covoiturage ? (covoiturage_role || null) : null
      updates.covoiturage_with = covoiturage ? (covoiturage_with?.trim() || null) : null
    }

    const { data: row, error: updErr } = await supabaseAdmin
      .from('trajets')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (updErr) {
      console.error('Erreur clôture trajet:', updErr.message)
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, trajet: row })
  } catch (err: any) {
    console.error('Erreur /api/trajets/[id]/fin:', err)
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
