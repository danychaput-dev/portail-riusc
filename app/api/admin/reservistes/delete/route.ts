// app/api/admin/reservistes/delete/route.ts
// Suppression cascade d'un reserviste et toutes ses donnees liees
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierAdmin() {
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
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || res.role !== 'admin') return null
  return res
}

// Tables enfants avec colonne benevole_id (ordre: enfants d'abord)
const TABLES_ENFANTS = [
  'reserviste_organisations',
  'reserviste_langues',
  'formations_benevoles',
  'inscriptions_camps',
  'inscriptions_camps_logs',
  'disponibilites_v2',
  'ciblages',
  'assignations',
  'messages',
  'message_reactions',
  'lms_progression',
  'rappels_camps',
  'reserviste_etat',
  'dossier_reserviste',
  'documents_officiels',
  'courriels',
]

export async function DELETE(request: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { benevole_id } = await request.json()
  if (!benevole_id) {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }

  // Empecher de supprimer son propre compte
  if (benevole_id === admin.benevole_id) {
    return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 })
  }

  const erreurs: string[] = []

  // Supprimer les donnees dans chaque table enfant
  for (const table of TABLES_ENFANTS) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq('benevole_id', benevole_id)
    if (error && !error.message.includes('does not exist')) {
      erreurs.push(`${table}: ${error.message}`)
    }
  }

  // Supprimer le reserviste
  const { error: delErr } = await supabaseAdmin
    .from('reservistes')
    .delete()
    .eq('benevole_id', benevole_id)

  if (delErr) {
    return NextResponse.json({
      error: `Erreur suppression reserviste: ${delErr.message}`,
      erreurs_tables: erreurs
    }, { status: 500 })
  }

  return NextResponse.json({ success: true, erreurs_tables: erreurs })
}
