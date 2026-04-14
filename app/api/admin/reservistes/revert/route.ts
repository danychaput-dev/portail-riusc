// app/api/admin/reservistes/revert/route.ts
// Phase 3: annule une modification en restaurant l'ancienne valeur d'un champ.
// Lit l'entree audit_log et applique old_value sur le champ field_name du reserviste.
// Le trigger audit capturera automatiquement cette nouvelle modification, ce qui
// cree une trace complete: modif originale + revert.
//
// Acces: admin, superadmin, coordonnateur
// Body: { audit_id: uuid }

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Champs qu'on interdit de revert (integrite / securite)
const CHAMPS_INTERDITS = new Set([
  'benevole_id',
  'user_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'deleted_reason',
  'deleted_by_user_id',
])

async function verifierCaller() {
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
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return user
}

export async function POST(request: NextRequest) {
  const caller = await verifierCaller()
  if (!caller) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { audit_id } = await request.json()
  if (!audit_id) {
    return NextResponse.json({ error: 'audit_id requis' }, { status: 400 })
  }

  // 1. Lire l'entree audit
  const { data: entry, error: errGet } = await supabaseAdmin
    .from('audit_log')
    .select('id, table_name, record_id, action, field_name, old_value, new_value')
    .eq('id', audit_id)
    .single()

  if (errGet || !entry) {
    return NextResponse.json({ error: 'Entree d\'audit introuvable' }, { status: 404 })
  }

  // 2. Validations
  if (entry.table_name !== 'reservistes') {
    return NextResponse.json({ error: 'Revert supporte uniquement la table reservistes' }, { status: 400 })
  }
  if (entry.action !== 'update') {
    return NextResponse.json({ error: 'Seules les modifications de type update peuvent etre annulees' }, { status: 400 })
  }
  if (!entry.field_name) {
    return NextResponse.json({ error: 'Champ introuvable dans l\'entree d\'audit' }, { status: 400 })
  }
  if (CHAMPS_INTERDITS.has(entry.field_name)) {
    return NextResponse.json({ error: `Revert interdit sur le champ ${entry.field_name}` }, { status: 400 })
  }

  // 3. Verifier que le reserviste existe (et pas en corbeille)
  const { data: reserviste, error: errRes } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, deleted_at')
    .eq('benevole_id', entry.record_id)
    .single()

  if (errRes || !reserviste) {
    return NextResponse.json({ error: 'Reserviste introuvable' }, { status: 404 })
  }
  if (reserviste.deleted_at) {
    return NextResponse.json({ error: 'Reserviste en corbeille. Restaurer d\'abord.' }, { status: 400 })
  }

  // 4. Decoder old_value depuis jsonb. jsonb null -> SQL NULL ; chaine jsonb -> string, etc.
  //    supabase-js renvoie deja le type JS natif (string, number, boolean, null, object).
  const valeurARestaurer = entry.old_value

  // 5. Tracer l'auteur du revert
  await setActingUser(supabaseAdmin, caller.id, caller.email)

  // 6. Appliquer l'update
  const payload: Record<string, unknown> = { [entry.field_name]: valeurARestaurer }
  const { error: errUpd } = await supabaseAdmin
    .from('reservistes')
    .update(payload)
    .eq('benevole_id', entry.record_id)
    .select()

  if (errUpd) {
    return NextResponse.json({ error: errUpd.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    benevole_id: entry.record_id,
    field_name: entry.field_name,
    restored_value: valeurARestaurer,
  })
}
