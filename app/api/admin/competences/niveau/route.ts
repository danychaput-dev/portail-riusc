// app/api/admin/competences/niveau/route.ts
//
// POST /api/admin/competences/niveau
// Body: { benevole_id: string, niveau: number | null }
// Met à jour reservistes.niveau_ressource (0 = non classé).
// Rôles autorisés: superadmin, admin, coordonnateur (adjoint = lecture seule).

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierRoleEditeur() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, role, email')
    .eq('user_id', user.id)
    .single()
  // Adjoint est volontairement exclu (lecture seule sur cette fonctionnalité)
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return { user, reserviste: res }
}

export async function POST(req: NextRequest) {
  const auth = await verifierRoleEditeur()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const { benevole_id, niveau } = body
  if (!benevole_id || typeof benevole_id !== 'string') {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }
  // niveau: null ou 0 = non classé; 1-4 = niveau valide
  const niveauNum = niveau === null || niveau === 0 ? 0 : Number(niveau)
  if (!Number.isInteger(niveauNum) || niveauNum < 0 || niveauNum > 4) {
    return NextResponse.json({ error: 'niveau doit être 0, 1, 2, 3 ou 4' }, { status: 400 })
  }

  // Trace l'auteur dans audit_log
  try {
    await setActingUser(supabaseAdmin, auth.user.id, auth.reserviste.email)
  } catch {
    // non bloquant
  }

  const { data, error } = await supabaseAdmin
    .from('reservistes')
    .update({ niveau_ressource: niveauNum })
    .eq('benevole_id', benevole_id)
    .select('benevole_id, niveau_ressource')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Réserviste introuvable ou RLS refuse' }, { status: 404 })

  return NextResponse.json({ benevole_id: data.benevole_id, niveau_ressource: data.niveau_ressource })
}
