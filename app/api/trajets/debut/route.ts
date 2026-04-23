// app/api/trajets/debut/route.ts
//
// Démarrer un trajet (aller ou retour) pour le bénévole connecté.
//
// Body attendu :
// {
//   type: 'aller' | 'retour',
//   deployment_id?: string,    // XOR avec camp_session_id
//   camp_session_id?: string,  // XOR avec deployment_id
//   covoiturage?: boolean,
//   covoiturage_role?: 'conducteur' | 'passager',
//   covoiturage_with?: string,
//   notes?: string
// }
//
// Règles :
// - Un seul trajet ouvert à la fois par bénévole (si un autre est déjà ouvert → erreur)
// - Respect de l'impersonation (cookie `impersonate`)

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Résoudre benevole_id (via impersonation si admin)
    // Le cookie impersonate est un JSON stringifie — voir /api/impersonate/route.ts
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

    const body = await req.json()
    const { type, deployment_id, camp_session_id, covoiturage, covoiturage_role, covoiturage_with, notes } = body

    if (!type || !['aller', 'retour'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide (aller ou retour)' }, { status: 400 })
    }
    if ((!deployment_id && !camp_session_id) || (deployment_id && camp_session_id)) {
      return NextResponse.json({ error: 'Fournir soit deployment_id, soit camp_session_id (exclusif)' }, { status: 400 })
    }

    // Vérif : pas de trajet déjà ouvert
    const { data: ouverts } = await supabaseAdmin
      .from('trajets')
      .select('id, type, heure_debut')
      .eq('benevole_id', benevole_id)
      .is('heure_fin', null)
      .in('statut', ['en_cours'])
      .limit(1)

    if (ouverts && ouverts.length > 0) {
      return NextResponse.json({
        error: 'Un trajet est déjà en cours. Ferme-le avant d\'en démarrer un nouveau.',
        trajet_ouvert: ouverts[0],
      }, { status: 409 })
    }

    const { data: row, error: insErr } = await supabaseAdmin
      .from('trajets')
      .insert({
        benevole_id,
        deployment_id: deployment_id || null,
        camp_session_id: camp_session_id || null,
        type,
        heure_debut: new Date().toISOString(),
        covoiturage: !!covoiturage,
        covoiturage_role: covoiturage ? (covoiturage_role || null) : null,
        covoiturage_with: covoiturage ? (covoiturage_with?.trim() || null) : null,
        notes: notes?.trim() || null,
        statut: 'en_cours',
      })
      .select('*')
      .single()

    if (insErr) {
      console.error('Erreur insertion trajet:', insErr.message)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, trajet: row })
  } catch (err: any) {
    console.error('Erreur /api/trajets/debut:', err)
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
