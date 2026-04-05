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
    .select('benevole_id, prenom, nom, email, telephone, telephone_secondaire, adresse, ville, region, code_postal, groupe, statut, created_at, remboursement_bottes_date, antecedents_statut, antecedents_date_verification, antecedents_date_expiration, date_naissance, contact_urgence_nom, contact_urgence_telephone, camp_qualif_complete')
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

  // Charger les organismes pour TOUS les réservistes (pour colonne + filtre)
  const { data: orgLinks } = await supabaseAdmin
    .from('reserviste_organisations')
    .select('benevole_id, organisations (nom)')
  const orgMapAll: Record<string, string[]> = {}
  for (const link of (orgLinks || [])) {
    const nom = (link as any).organisations?.nom || ''
    if (!nom) continue
    if (!orgMapAll[link.benevole_id]) orgMapAll[link.benevole_id] = []
    orgMapAll[link.benevole_id].push(nom)
  }

  // Org principale : AQBRS prioritaire, sinon premier organisme
  const getOrgPrincipale = (benevoleId: string): string => {
    const orgs = orgMapAll[benevoleId] || []
    if (orgs.length === 0) return ''
    const hasAQBRS = orgs.some(o => o.includes('AQBRS'))
    return hasAQBRS ? orgs.find(o => o.includes('AQBRS'))! : orgs[0]
  }

  // Groupe AQBRS (sous-groupe de l'organisme AQBRS)
  const getGroupeAQBRS = (benevoleId: string): string => {
    const orgs = orgMapAll[benevoleId] || []
    const aqbrs = orgs.find(o => o.includes('AQBRS'))
    return aqbrs || ''
  }

  // Filtre organisme côté serveur
  const orgPrincipale = searchParams.get('org_principale') === 'true'
  if (organisme) {
    if (organisme === 'AQBRS' || organisme.includes('AQBRS')) {
      reservistes = reservistes.filter(r => {
        const orgs = orgMapAll[r.benevole_id] || []
        return orgs.some(o => o.includes('AQBRS'))
      })
    } else if (organisme === 'sans_org') {
      reservistes = reservistes.filter(r => !orgMapAll[r.benevole_id])
    } else if (orgPrincipale) {
      reservistes = reservistes.filter(r => {
        const principale = getOrgPrincipale(r.benevole_id)
        return principale.includes(organisme)
      })
    } else {
      reservistes = reservistes.filter(r => {
        const orgs = orgMapAll[r.benevole_id] || []
        return orgs.some(o => o.includes(organisme))
      })
    }
  }

  // Enrichir avec données de formation (initiation SC + camp + certificats en attente)
  const benevoleIds = reservistes.map(r => r.benevole_id)
  let formationsMap: Record<string, { initiation_sc: boolean; camp: boolean; certifs_en_attente: number }> = {}
  if (benevoleIds.length > 0) {
    for (let i = 0; i < benevoleIds.length; i += 500) {
      const batch = benevoleIds.slice(i, i + 500)
      const { data: formations } = await supabaseAdmin
        .from('formations_benevoles')
        .select('benevole_id, resultat, source, nom_formation, initiation_sc_completee')
        .in('benevole_id', batch)
      for (const f of (formations || [])) {
        if (!formationsMap[f.benevole_id]) formationsMap[f.benevole_id] = { initiation_sc: false, camp: false, certifs_en_attente: 0 }
        const cat = (f.nom_formation || '').toLowerCase()
        if (f.resultat === 'Réussi') {
          if (f.initiation_sc_completee === true || cat.includes('initier')) formationsMap[f.benevole_id].initiation_sc = true
          if (cat.includes('camp de qualification')) formationsMap[f.benevole_id].camp = true
        } else if (f.resultat === 'En attente' || f.resultat === 'Soumis') {
          formationsMap[f.benevole_id].certifs_en_attente++
        }
      }
    }
  }

  // Inscriptions camps — pour afficher X jaune (inscrit mais pas encore certifié)
  let campInscritSet = new Set<string>()
  if (benevoleIds.length > 0) {
    const { data: inscriptions } = await supabaseAdmin
      .from('inscriptions_camps')
      .select('benevole_id')
      .in('benevole_id', benevoleIds)
    if (inscriptions) {
      campInscritSet = new Set(inscriptions.map(i => i.benevole_id))
    }
  }

  const enriched = reservistes.map(r => {
    const campComplete = (r as any).camp_qualif_complete === true || formationsMap[r.benevole_id]?.camp || false
    return {
      ...r,
      initiation_sc: formationsMap[r.benevole_id]?.initiation_sc || false,
      camp_complete: campComplete,
      certifs_en_attente: formationsMap[r.benevole_id]?.certifs_en_attente || 0,
      camp_inscrit: !campComplete && campInscritSet.has(r.benevole_id),
      org_principale: getOrgPrincipale(r.benevole_id),
      groupe_aqbrs: getGroupeAQBRS(r.benevole_id),
    }
  })

  if (format === 'xlsx') {
    const entetes = ['Prénom', 'Nom', 'Courriel', 'Téléphone', 'Téléphone 2', 'Adresse', 'Ville', 'Région', 'Code postal', 'Organisme', 'Groupe', 'Statut', 'Remb. bottes', 'Antéc. statut', 'Antéc. date vérif.', 'Antéc. date expir.', 'Initiation SC', 'Camp complété']
    const rows = enriched.map(r => [
      r.prenom || '',
      r.nom || '',
      r.email || '',
      r.telephone || '',
      r.telephone_secondaire || '',
      r.adresse || '',
      r.ville || '',
      r.region || '',
      r.code_postal || '',
      r.org_principale || '',
      r.groupe || '',
      r.statut || '',
      r.remboursement_bottes_date || '',
      r.antecedents_statut || '',
      r.antecedents_date_verification || '',
      r.antecedents_date_expiration || '',
      r.initiation_sc ? 'Oui' : 'Non',
      r.camp_complete ? 'Oui' : 'Non',
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

  return NextResponse.json({ data: enriched, total: enriched.length })
}
