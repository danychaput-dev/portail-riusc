// app/api/admin/reservistes/dispo-veille/route.ts
// PATCH — Mettre à jour le flag dispo_veille et sa note pour un réserviste.
// Utilisé en phase de pré-déploiement quand admin reçoit des réponses email
// informelles de réservistes disant qu'ils seraient disponibles.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  if (!res || !['superadmin', 'admin', 'coordonnateur', 'adjoint'].includes(res.role)) return null
  return { ...res, user_id: user.id, email: user.email }
}

export async function PATCH(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  await setActingUser(supabaseAdmin, user.user_id, user.email)

  const { benevole_id, dispo_veille, dispo_veille_note } = await req.json()

  if (!benevole_id) {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  if (typeof dispo_veille === 'boolean') updates.dispo_veille = dispo_veille
  if (typeof dispo_veille_note === 'string') updates.dispo_veille_note = dispo_veille_note.trim() || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('reservistes')
    .update(updates)
    .eq('benevole_id', benevole_id)
    .select('benevole_id, dispo_veille, dispo_veille_note')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, reserviste: data })
}

// POST — Reset en bulk (utile au lancement d'un nouveau sinistre pour repartir
// à zéro sur les flags de veille).
export async function POST(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  await setActingUser(supabaseAdmin, user.user_id, user.email)

  const { action } = await req.json()

  if (action !== 'reset_all') {
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  }

  const { error, count } = await supabaseAdmin
    .from('reservistes')
    .update({ dispo_veille: false, dispo_veille_note: null })
    .eq('dispo_veille', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, reset_count: count ?? 0 })
}
