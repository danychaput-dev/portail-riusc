// app/api/admin/competences/route.ts
//
// GET /api/admin/competences           → JSON { reservistes, totaux }
// GET /api/admin/competences?format=xlsx → XLSX téléchargement
//
// Accessible aux roles: superadmin, admin, coordonnateur, adjoint (lecture seule).

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'
import {
  COMPETENCES,
  detectCompetences,
  getCompetenceLabels,
  ReservisteCompetencesRow,
} from '@/utils/competencesMapping'

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
  if (!res || !['superadmin', 'admin', 'coordonnateur', 'adjoint'].includes(res.role)) return null
  return res
}

export async function GET(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format')

  // ─── Fetch réservistes actifs avec colonnes compétences ──────────────────
  // Pagination par batchs de 1000 (limite PostgREST). On exclut les partenaires
  // (pas pertinents pour une analyse de compétences de déploiement) et on
  // inclut Approuvé + Intérêt.
  const SELECT_COLS = `
    benevole_id, prenom, nom, email, groupe, groupe_recherche, statut, profession,
    niveau_ressource, antecedents_statut, camp_qualif_complete,
    certificat_premiers_soins, competences_securite, communication,
    permis_conduire, navire_marin, vehicule_tout_terrain, cartographie_sig,
    certification_csi, competence_rs, competences_sauvetage, satp_drone,
    equipe_canine
  `
  const BATCH = 1000
  let reservistes: any[] = []
  for (let offset = 0; offset < 10000; offset += BATCH) {
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from('reservistes_actifs')
      .select(SELECT_COLS)
      .in('groupe', ['Approuvé', 'Intérêt'])
      .not('nom', 'is', null)
      .neq('nom', '')
      .order('nom')
      .range(offset, offset + BATCH - 1)
    if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 })
    if (!batch || batch.length === 0) break
    reservistes = reservistes.concat(batch)
    if (batch.length < BATCH) break
  }
  if (reservistes.length === 0) return NextResponse.json({ error: 'Aucune donnée' }, { status: 500 })

  // ─── Jointure langues via reserviste_langues ──────────────────────────────
  const benevoleIds = reservistes.map(r => r.benevole_id)
  const languesByBid: Record<string, string[]> = {}

  if (benevoleIds.length > 0) {
    // Batch par 500 pour éviter les gros payloads
    for (let i = 0; i < benevoleIds.length; i += 500) {
      const batch = benevoleIds.slice(i, i + 500)
      const { data: langLinks } = await supabaseAdmin
        .from('reserviste_langues')
        .select('benevole_id, langues (nom)')
        .in('benevole_id', batch)
      if (langLinks) {
        for (const link of langLinks as any[]) {
          const bid = link.benevole_id
          const nom = link.langues?.nom
          if (!nom) continue
          if (!languesByBid[bid]) languesByBid[bid] = []
          languesByBid[bid].push(nom)
        }
      }
    }
  }

  // ─── Calcul des compétences ──────────────────────────────────────────────
  const labels = getCompetenceLabels()
  const rows = reservistes.map((r: any) => {
    const detected = detectCompetences({
      certificat_premiers_soins: r.certificat_premiers_soins,
      competences_securite:      r.competences_securite,
      communication:             r.communication,
      permis_conduire:           r.permis_conduire,
      navire_marin:              r.navire_marin,
      vehicule_tout_terrain:     r.vehicule_tout_terrain,
      cartographie_sig:          r.cartographie_sig,
      certification_csi:         r.certification_csi,
      competence_rs:             r.competence_rs,
      competences_sauvetage:     r.competences_sauvetage,
      satp_drone:                r.satp_drone,
      equipe_canine:             r.equipe_canine,
      langues:                   languesByBid[r.benevole_id] || [],
    } as ReservisteCompetencesRow)
    return {
      benevole_id: r.benevole_id,
      prenom: r.prenom || '',
      nom: r.nom || '',
      email: r.email || '',
      groupe: r.groupe || '',
      groupe_recherche: r.groupe_recherche || '',
      statut: r.statut || '',
      profession: r.profession || '',
      niveau_ressource: r.niveau_ressource || 0,
      antecedents_statut: r.antecedents_statut || '',
      camp_qualif_complete: !!r.camp_qualif_complete,
      competences: detected,
    }
  })

  // ─── Totaux par compétence ────────────────────────────────────────────────
  const totaux: Record<string, number> = {}
  for (const label of labels) {
    totaux[label] = rows.filter(r => r.competences[label]).length
  }

  // ─── Format XLSX ─────────────────────────────────────────────────────────
  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new()

    // Onglet Compétences détaillées
    const detailData: any[] = []
    // Ligne famille (row 1): on insère des marqueurs qu'on merge après
    const identityHeaders = ['Bénévole', 'Prénom', 'Nom', 'Courriel', 'Statut', 'Profession', 'Groupe R&S', 'Niveau', 'Antécédents', 'Camp']
    // Row 1: familles (une cellule par colonne, qui sera mergée par runs)
    const row1: any[] = identityHeaders.map(() => '')
    for (const c of COMPETENCES) row1.push(c.famille)
    detailData.push(row1)
    // Row 2: en-têtes
    const row2 = [...identityHeaders, ...labels]
    detailData.push(row2)
    // Rows 3+: données
    for (const r of rows) {
      const base = [
        r.benevole_id, r.prenom, r.nom, r.email,
        r.groupe, r.profession, r.groupe_recherche,
        r.niveau_ressource || '',
        r.antecedents_statut,
        r.camp_qualif_complete ? 'Oui' : 'Non',
      ]
      const comps = labels.map(l => (r.competences[l] ? 'X' : ''))
      detailData.push([...base, ...comps])
    }

    const wsDetail = XLSX.utils.aoa_to_sheet(detailData)
    // Merges pour les bannières de famille sur la row 1
    wsDetail['!merges'] = wsDetail['!merges'] || []
    let runStart = identityHeaders.length
    let currentFamille = COMPETENCES[0]?.famille
    for (let i = 0; i < COMPETENCES.length; i++) {
      const isLast = i === COMPETENCES.length - 1
      const nextFamille = !isLast ? COMPETENCES[i + 1].famille : null
      if (nextFamille !== currentFamille) {
        const endCol = identityHeaders.length + i
        if (endCol > runStart) {
          wsDetail['!merges'].push({
            s: { r: 0, c: runStart },
            e: { r: 0, c: endCol },
          })
        }
        runStart = endCol + 1
        currentFamille = nextFamille || currentFamille
      }
    }
    // Largeurs (Bénévole, Prénom, Nom, Courriel, Statut, Profession, Groupe R&S, Niveau, Antécédents, Camp, ...compétences)
    const detailCols = [
      { wch: 13 }, { wch: 14 }, { wch: 18 }, { wch: 26 },
      { wch: 10 }, { wch: 22 }, { wch: 28 },
      { wch: 8 }, { wch: 12 }, { wch: 6 },
      ...labels.map(() => ({ wch: 10 })),
    ]
    wsDetail['!cols'] = detailCols
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Compétences détaillées')

    // Onglet Synthèse
    const synthData: any[] = [
      [`Synthèse des compétences — ${rows.length} réservistes actifs`],
      [],
      ['Famille', 'Compétence', 'Nombre', '% du bassin'],
    ]
    for (const c of COMPETENCES) {
      const count = totaux[c.label] || 0
      const pct = rows.length > 0 ? count / rows.length : 0
      synthData.push([c.famille, c.label, count, pct])
    }
    const wsSynth = XLSX.utils.aoa_to_sheet(synthData)
    wsSynth['!cols'] = [{ wch: 20 }, { wch: 32 }, { wch: 12 }, { wch: 14 }]
    // Format % colonne D
    for (let r = 4; r <= 3 + COMPETENCES.length; r++) {
      const cellRef = XLSX.utils.encode_cell({ r: r - 1, c: 3 })
      if (wsSynth[cellRef]) wsSynth[cellRef].z = '0.0%'
    }
    XLSX.utils.book_append_sheet(wb, wsSynth, 'Synthèse compétences')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `competences-reservistes-${new Date().toISOString().slice(0, 10)}.xlsx`
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // ─── Format JSON (pour l'affichage web) ──────────────────────────────────
  return NextResponse.json({
    reservistes: rows,
    totaux,
    total_actifs: rows.length,
  })
}
