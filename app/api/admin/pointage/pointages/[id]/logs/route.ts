// app/api/admin/pointage/pointages/[id]/logs/route.ts
// GET — retourne l'historique des modifications d'un pointage (pointage_logs)
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
  if (!res || !['superadmin', 'admin', 'coordonnateur', 'partenaire', 'partenaire_lect'].includes(res.role)) return null
  return res
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id: pointageId } = await ctx.params

  const { data: logs } = await supabaseAdmin
    .from('pointage_logs')
    .select('id, action, valeur_avant, valeur_apres, notes, modifie_par, created_at')
    .eq('pointage_id', pointageId)
    .order('created_at', { ascending: false })

  // Enrichir avec noms des modificateurs
  const bIds = Array.from(new Set((logs || []).map((l: any) => l.modifie_par).filter(Boolean)))
  const { data: resList } = bIds.length > 0
    ? await supabaseAdmin.from('reservistes').select('benevole_id, prenom, nom').in('benevole_id', bIds)
    : { data: [] }
  const resMap: Record<string, string> = {}
  for (const r of (resList || [])) resMap[(r as any).benevole_id] = `${(r as any).prenom} ${(r as any).nom}`

  const enriched = (logs || []).map((l: any) => ({
    ...l,
    modifie_par_nom: resMap[l.modifie_par] || l.modifie_par || 'système',
  }))

  return NextResponse.json({ logs: enriched })
}
