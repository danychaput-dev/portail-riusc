// app/api/admin/reservistes/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'

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
  const groupes      = searchParams.get('groupes')
  const recherche    = searchParams.get('recherche') || ''
  const format       = searchParams.get('format')
  const region       = searchParams.get('region')
  const antecedents  = searchParams.get('antecedents')
  const bottes       = searchParams.get('bottes')
  const inscritDepuis = searchParams.get('inscrit_depuis')
  const campSession  = searchParams.get('camp_session')
  const campStatut   = searchParams.get('camp_statut')

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

  if (region) {
    query = query.ilike('region', region)
  }

  if (antecedents) {
    if (antecedents === 'en_attente') {
      query = query.or('antecedents_statut.is.null,antecedents_statut.eq.en_attente')
    } else {
      query = query.eq('antecedents_statut', antecedents)
    }
  }

  if (bottes === 'oui') {
    query = query.not('remboursement_bottes_date', 'is', null)
  } else if (bottes === 'non') {
    query = query.is('remboursement_bottes_date', null)
  }

  // Filtre par période d'inscription (24h, 7j, 30j)
  if (inscritDepuis) {
    const now = new Date()
    const jours = parseInt(inscritDepuis)
    if (!isNaN(jours)) {
      const depuis = new Date(now.getTime() - jours * 86400000).toISOString()
      query = query.or(`monday_created_at.gte.${depuis},created_at.gte.${depuis}`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filtre par camp (nécessite jointure avec inscriptions_camps)
  let reservistes = data || []
  const organisme = searchParams.get('organisme')

  if (campSession) {
    const { data: inscriptions } = await supabaseAdmin
      .from('inscriptions_camps')
      .select('benevole_id, statut_inscription')
      .eq('session_id', campSession)

    if (inscriptions) {
      const benevoleIds = new Set(
        campStatut
          ? inscriptions.filter(i => i.statut_inscription === campStatut).map(i => i.benevole_id)
          : inscriptions.map(i => i.benevole_id)
      )
      reservistes = reservistes.filter(r => benevoleIds.has(r.benevole_id))
    }
  }

  // Filtre organisme côté serveur (nécessite jointure)
  if (organisme) {
    const { data: orgLinks } = await supabaseAdmin
      .from('reserviste_organisations')
      .select('benevole_id, organisations (nom)')
    const orgMap: Record<string, string[]> = {}
    for (const link of (orgLinks || [])) {
      const nom = (link as any).organisations?.nom || ''
      if (!nom) continue
      if (!orgMap[link.benevole_id]) orgMap[link.benevole_id] = []
      orgMap[link.benevole_id].push(nom)
    }

    if (organisme === 'AQBRS' || organisme.includes('AQBRS')) {
      reservistes = reservistes.filter(r => {
        const orgs = orgMap[r.benevole_id] || []
        return orgs.some(o => o.includes('AQBRS'))
      })
    } else if (organisme === 'sans_org') {
      reservistes = reservistes.filter(r => !orgMap[r.benevole_id])
    } else {
      reservistes = reservistes.filter(r => {
        const orgs = orgMap[r.benevole_id] || []
        return orgs.some(o => o.includes(organisme))
      })
    }
  }

  if (format === 'xlsx') {
    const entetes = ['Prénom', 'Nom', 'Courriel', 'Téléphone', 'Téléphone 2', 'Adresse', 'Ville', 'Région', 'Code postal', 'Groupe', 'Statut', 'Remb. bottes', 'Antéc. statut', 'Antéc. date vérif.', 'Antéc. date expir.']
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
    const ws = XLSX.utils.aoa_to_sheet([entetes, ...rows])
    ws['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
      { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 18 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }
    ]
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: entetes.length - 1 } }) }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Réservistes')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reservistes-${new Date().toISOString().slice(0,10)}.xlsx"`
      }
    })
  }

  return NextResponse.json({ data: reservistes, total: reservistes.length })
}
