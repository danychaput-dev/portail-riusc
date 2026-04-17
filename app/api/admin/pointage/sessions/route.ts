// app/api/admin/pointage/sessions/route.ts
// GET  — liste les pointage_sessions (avec compteurs via la vue pointages_resume)
// POST — crée une nouvelle session QR. Retourne l'URL complète à imprimer/afficher.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = process.env.NEXT_PUBLIC_PORTAIL_URL || 'https://portail.riusc.ca'

async function verifierRole() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return res
}

export async function GET() {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Sessions + compteurs
  const { data: sessions, error } = await supabaseAdmin
    .from('pointages_resume')
    .select('*')
    .order('date_shift', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrichir avec le token (pas dans la vue) et l'approuveur
  const ids = (sessions || []).map((s: any) => s.pointage_session_id)
  const { data: details } = ids.length > 0
    ? await supabaseAdmin.from('pointage_sessions').select('id, token, cree_par, created_at').in('id', ids)
    : { data: [] }
  const detailsMap = Object.fromEntries((details || []).map((d: any) => [d.id, d]))

  const approuveurIds = [...new Set((sessions || []).map((s: any) => s.approuveur_id).filter(Boolean))]
  const { data: approuveurs } = approuveurIds.length > 0
    ? await supabaseAdmin.from('reservistes').select('benevole_id, prenom, nom').in('benevole_id', approuveurIds)
    : { data: [] }
  const approuveurMap = Object.fromEntries((approuveurs || []).map((a: any) => [a.benevole_id, a]))

  const enriched = (sessions || []).map((s: any) => {
    const det = detailsMap[s.pointage_session_id] || {}
    const app = s.approuveur_id ? approuveurMap[s.approuveur_id] : null
    return {
      ...s,
      token: det.token || null,
      url: det.token ? `${BASE_URL}/punch/${det.token}` : null,
      created_at: det.created_at || null,
      approuveur_nom: app ? `${app.prenom} ${app.nom}` : null,
    }
  })

  return NextResponse.json({ sessions: enriched })
}

export async function POST(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const {
    type_contexte,   // 'camp' | 'deploiement'
    session_id,      // inscriptions_camps.session_id (text) ou deployments.id (uuid text)
    contexte_nom,
    contexte_dates,
    contexte_lieu,
    shift,           // 'jour' | 'nuit' | 'complet' | null
    date_shift,      // 'YYYY-MM-DD' | null
    approuveur_id,   // benevole_id text
  } = body

  // Validation minimale
  if (!type_contexte || !['camp', 'deploiement'].includes(type_contexte)) {
    return NextResponse.json({ error: 'type_contexte invalide' }, { status: 400 })
  }
  if (!session_id || !contexte_nom) {
    return NextResponse.json({ error: 'session_id et contexte_nom requis' }, { status: 400 })
  }
  if (shift && !['jour', 'nuit', 'complet'].includes(shift)) {
    return NextResponse.json({ error: 'shift invalide' }, { status: 400 })
  }
  if (!approuveur_id) {
    return NextResponse.json({ error: 'approuveur_id requis' }, { status: 400 })
  }

  // Vérifier que l'approuveur existe
  const { data: approuveur } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, role')
    .eq('benevole_id', approuveur_id)
    .single()
  if (!approuveur) {
    return NextResponse.json({ error: 'Approuveur introuvable' }, { status: 400 })
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('pointage_sessions')
    .insert({
      type_contexte,
      session_id,
      contexte_nom,
      contexte_dates: contexte_dates || null,
      contexte_lieu: contexte_lieu || null,
      shift: shift || null,
      date_shift: date_shift || null,
      approuveur_id,
      cree_par: user.benevole_id,
    })
    .select('id, token, type_contexte, session_id, contexte_nom, contexte_dates, contexte_lieu, shift, date_shift, approuveur_id, actif, created_at')
    .single()

  if (error) {
    // Détecter l'unique constraint (un QR existe déjà pour ce contexte/shift/date)
    if (error.message.includes('duplicate') || error.code === '23505') {
      return NextResponse.json(
        { error: 'Un QR actif existe déjà pour ce contexte, shift et date.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    session: inserted,
    url: `${BASE_URL}/punch/${inserted.token}`,
    approuveur: { benevole_id: approuveur.benevole_id, prenom: approuveur.prenom, nom: approuveur.nom },
  })
}
