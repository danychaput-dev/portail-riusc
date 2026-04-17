// app/api/admin/pointage/sessions/[id]/route.ts
// PATCH — Mettre à jour un champ modifiable d'une pointage_session (actif, approuveur, notes).
// Utilisé par la page /admin/pointage pour activer/désactiver un QR sans le supprimer.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return res
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const body = await req.json()
  const updates: Record<string, any> = {}
  if (typeof body.actif === 'boolean') updates.actif = body.actif
  if (typeof body.approuveur_id === 'string') updates.approuveur_id = body.approuveur_id

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('pointage_sessions')
    .update(updates)
    .eq('id', id)
    .select('id, actif, approuveur_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, session: data })
}
