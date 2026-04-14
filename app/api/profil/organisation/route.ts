// app/api/profil/organisation/route.ts
// Cree une organisation et l'associe au benevole courant.
// Remplace un insert client-side silencieusement bloque par RLS.
//
// Acces: l'utilisateur connecte, pour son propre benevole_id
//        OU admin/superadmin/coordonnateur pour n'importe lequel.
//
// Body: { nom: string, benevole_id: string }

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCaller() {
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
    .select('benevole_id, role, user_id')
    .eq('user_id', user.id)
    .single()
  if (!res) return null
  return { user, reserviste: res }
}

export async function POST(request: NextRequest) {
  const caller = await getCaller()
  if (!caller) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const { nom, benevole_id } = await request.json()
  if (!nom || !benevole_id) {
    return NextResponse.json({ error: 'nom et benevole_id requis' }, { status: 400 })
  }
  const nomTrim = String(nom).trim()
  if (nomTrim.length < 2) {
    return NextResponse.json({ error: 'Nom trop court (minimum 2 caracteres)' }, { status: 400 })
  }

  // Autorisation: proprietaire OU admin/superadmin/coordonnateur
  const isAdmin = ['superadmin', 'admin', 'coordonnateur'].includes(caller.reserviste.role)
  const isSelf = caller.reserviste.benevole_id === benevole_id
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
  }

  // 1. Chercher une organisation existante (case-insensitive)
  let orgId: string | null = null
  const { data: existing } = await supabaseAdmin
    .from('organisations')
    .select('id')
    .ilike('nom', nomTrim)
    .maybeSingle()

  if (existing) {
    orgId = existing.id
  } else {
    // 2. Creer l'organisation. Tracer l'auteur pour audit.
    await setActingUser(supabaseAdmin, caller.user.id, caller.user.email)
    const { data: created, error: errCreate } = await supabaseAdmin
      .from('organisations')
      .insert({ nom: nomTrim, created_by: caller.reserviste.benevole_id })
      .select('id')
      .single()

    if (errCreate || !created) {
      return NextResponse.json({
        error: `Creation impossible: ${errCreate?.message || 'erreur inconnue'}`
      }, { status: 500 })
    }
    orgId = created.id
  }

  // 3. Verifier si l'association existe deja (upsert-like)
  const { data: deja } = await supabaseAdmin
    .from('reserviste_organisations')
    .select('benevole_id')
    .eq('benevole_id', benevole_id)
    .eq('organisation_id', orgId)
    .maybeSingle()

  if (!deja) {
    const { error: errLink } = await supabaseAdmin
      .from('reserviste_organisations')
      .insert({ benevole_id, organisation_id: orgId })

    if (errLink) {
      return NextResponse.json({
        error: `Association impossible: ${errLink.message}`,
        organisation_id: orgId,
        organisation_nom: nomTrim,
      }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    organisation_id: orgId,
    organisation_nom: nomTrim,
    deja_associee: !!deja,
  })
}
