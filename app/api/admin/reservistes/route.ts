// app/api/admin/reservistes/route.ts
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
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['admin', 'coordonnateur', 'adjoint'].includes(res.role)) return null
  return res
}

export async function GET(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const groupes   = searchParams.get('groupes')
  const recherche = searchParams.get('recherche') || ''
  const format    = searchParams.get('format')

  let query = supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, email, telephone, telephone_secondaire, adresse, ville, region, code_postal, groupe, statut, created_at, remboursement_bottes_date, antecedents_statut, antecedents_date_verification, antecedents_date_expiration')
    .not('nom', 'is', null)
    .neq('nom', '')
    .order('nom')

  if (groupes) {
    const liste = groupes.split(',').map(g => g.trim()).filter(Boolean)
    if (liste.length > 0) query = query.in('groupe', liste)
  }

  if (recherche) {
    query = query.or(`nom.ilike.%${recherche}%,prenom.ilike.%${recherche}%,email.ilike.%${recherche}%,ville.ilike.%${recherche}%,telephone.ilike.%${recherche}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reservistes = data || []

  if (format === 'csv') {
    const headers = ['Prénom', 'Nom', 'Courriel', 'Téléphone', 'Téléphone 2', 'Adresse', 'Ville', 'Région', 'Code postal', 'Groupe', 'Statut', 'Remb. bottes', 'Antéc. statut', 'Antéc. date vérif.', 'Antéc. date expir.']
    const rows = reservistes.map(r => [
      r.prenom || '',
      r.nom || '',
      r.email || '',
      r.telephone || '',
      r.telephone_secondaire || '',
      r.adresse || '',
      r.ville || '',
      r.region || '',
      r.code_postal || '',
      r.groupe || '',
      r.statut || '',
      r.remboursement_bottes_date || '',
      r.antecedents_statut || '',
      r.antecedents_date_verification || '',
      r.antecedents_date_expiration || ''
    ])
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const bom = '\uFEFF'
    return new NextResponse(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reservistes-${new Date().toISOString().slice(0,10)}.csv"`
      }
    })
  }

  return NextResponse.json({ data: reservistes, total: reservistes.length })
}
