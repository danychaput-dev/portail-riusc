// app/api/admin/formations/corbeille/route.ts
// Liste les formations/certificats soft-deletes.
// Acces: admin, coordonnateur ou superadmin.

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
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
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!res) return null
  if (!['admin', 'coordonnateur', 'superadmin'].includes(res.role)) return null
  return { ...user, role: res.role }
}

export async function GET() {
  const caller = await verifierAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  // Lit la table brute (pas la vue) pour voir les soft-deleted
  const { data, error } = await supabaseAdmin
    .from('formations_benevoles')
    .select('id, benevole_id, nom_formation, resultat, date_reussite, date_expiration, certificat_url, certificat_url_archive, deleted_at, deleted_reason, deleted_by_user_id')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .range(0, 4999)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrichir avec les infos reserviste
  const benevoleIds = Array.from(new Set((data || []).map(f => f.benevole_id).filter(Boolean)))
  let reservistesMap: Record<string, { prenom: string; nom: string; email: string | null }> = {}
  if (benevoleIds.length > 0) {
    const { data: res } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, prenom, nom, email')
      .in('benevole_id', benevoleIds)
    for (const r of res || []) {
      reservistesMap[r.benevole_id] = { prenom: r.prenom, nom: r.nom, email: r.email }
    }
  }

  // Enrichir avec l'email de l'auteur de la suppression
  const deleterIds = Array.from(new Set((data || []).map(f => f.deleted_by_user_id).filter(Boolean)))
  let deletersMap: Record<string, { prenom: string; nom: string; email: string | null }> = {}
  if (deleterIds.length > 0) {
    const { data: dels } = await supabaseAdmin
      .from('reservistes')
      .select('user_id, prenom, nom, email')
      .in('user_id', deleterIds)
    for (const d of dels || []) {
      if (d.user_id) deletersMap[d.user_id] = { prenom: d.prenom, nom: d.nom, email: d.email }
    }
  }

  const entries = (data || []).map(f => ({
    ...f,
    reserviste: reservistesMap[f.benevole_id] || null,
    deleted_by: f.deleted_by_user_id ? deletersMap[f.deleted_by_user_id] || null : null,
  }))

  return NextResponse.json({ entries })
}
