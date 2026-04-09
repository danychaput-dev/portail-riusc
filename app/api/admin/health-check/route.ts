// app/api/admin/health-check/route.ts
//
// Verification de coherence des donnees du portail.
// Compare les decomptes entre les differentes sources (dashboard, reservistes, stats)
// pour detecter les regressions AVANT que quelqu'un les remarque.
//
// Usage :
//   GET /api/admin/health-check           → resultat JSON
//   GET /api/admin/health-check?secret=X  → acces sans session (pour monitoring externe)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Secret optionnel pour acces externe (monitoring, n8n, etc.)
const HEALTH_SECRET = process.env.HEALTH_CHECK_SECRET || ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  // Auth : soit session admin, soit secret
  if (secret && HEALTH_SECRET && secret === HEALTH_SECRET) {
    // OK - acces par secret
  } else {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    const { data: res } = await supabaseAdmin
      .from('reservistes')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (!res || res.role !== 'admin') {
      return NextResponse.json({ error: 'Admin requis' }, { status: 403 })
    }
  }

  const checks: {
    name: string
    status: 'pass' | 'fail' | 'warn'
    expected?: number
    actual?: number
    detail: string
  }[] = []

  try {
    // ─── CHECK 1 : Decompte total reservistes (la source de verite) ───
    // C'est le COUNT SQL exact, pas affecte par la limite de 1000 lignes
    const baseCount = (groupe: string) =>
      supabaseAdmin.from('reservistes')
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'Actif')
        .not('nom', 'is', null)
        .neq('nom', '')
        .eq('groupe', groupe)

    const [cntApprouves, cntInteret, cntRetrait, cntPartenaires, cntFormInc] = await Promise.all([
      baseCount('Approuvé'),
      baseCount('Intérêt'),
      baseCount('Retrait temporaire'),
      baseCount('Partenaires'),
      baseCount('Formation incomplète'),
    ])

    const exactApprouves = cntApprouves.count || 0
    const exactInteret = cntInteret.count || 0
    const exactRetrait = cntRetrait.count || 0
    const exactPartenaires = cntPartenaires.count || 0
    const exactFormInc = cntFormInc.count || 0
    const exactTotal = exactApprouves + exactInteret  // Le chiffre du dashboard
    const exactTotalAdmin = exactApprouves + exactInteret + exactRetrait + exactFormInc  // Le chiffre de la page admin

    checks.push({
      name: 'Decompte SQL exact',
      status: 'pass',
      detail: `Approuves: ${exactApprouves}, Interet: ${exactInteret}, Retrait: ${exactRetrait}, Partenaires: ${exactPartenaires}, Form.Inc: ${exactFormInc}`,
    })

    // ─── CHECK 2 : API Dashboard (/api/dashboard/stats) ──────────────
    // Simule ce que le dashboard appelle
    const dashQuery = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, groupe')
      .eq('statut', 'Actif')
      .in('groupe', ['Approuvé', 'Intérêt', 'Partenaires'])
      .not('nom', 'is', null)
      .neq('nom', '')

    const dashData = dashQuery.data || []
    const dashApprouves = dashData.filter(r => r.groupe === 'Approuvé').length
    const dashInteret = dashData.filter(r => r.groupe === 'Intérêt').length
    const dashTotal = dashApprouves + dashInteret

    if (dashTotal !== exactTotal) {
      checks.push({
        name: 'Dashboard vs SQL exact',
        status: 'fail',
        expected: exactTotal,
        actual: dashTotal,
        detail: `Dashboard query retourne ${dashTotal} mais le COUNT exact donne ${exactTotal}. Probablement un probleme de limite 1000 lignes.`,
      })
    } else {
      checks.push({
        name: 'Dashboard vs SQL exact',
        status: 'pass',
        expected: exactTotal,
        actual: dashTotal,
        detail: `OK - les deux donnent ${exactTotal}`,
      })
    }

    // ─── CHECK 3 : API Admin Reservistes ─────────────────────────────
    // Simule ce que la page admin/reservistes charge par defaut
    // Inclut TOUS les groupes que l'API retourne : Approuve, Interet, Retrait temporaire, Formation incomplete
    const adminQuery = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, groupe')
      .in('groupe', ['Approuvé', 'Intérêt', 'Retrait temporaire', 'Formation incomplète'])
      .not('nom', 'is', null)
      .neq('nom', '')

    const adminData = adminQuery.data || []
    const adminExpected = exactApprouves + exactInteret + exactRetrait + exactFormInc

    if (adminData.length !== adminExpected) {
      checks.push({
        name: 'Admin reservistes vs SQL exact',
        status: adminData.length > 1000 ? 'fail' : 'warn',
        expected: adminExpected,
        actual: adminData.length,
        detail: adminData.length === 1000
          ? `ALERTE: La query retourne exactement 1000 lignes - limite Supabase atteinte!`
          : `Admin retourne ${adminData.length}, attendu ${adminExpected}`,
      })
    } else {
      checks.push({
        name: 'Admin reservistes vs SQL exact',
        status: 'pass',
        expected: adminExpected,
        actual: adminData.length,
        detail: `OK - ${adminData.length} reservistes`,
      })
    }

    // ─── CHECK 4 : Le total dashboard et le click-through sont coherents ──
    // Quand on clique sur "Total reservistes" dans le dashboard, on arrive
    // sur /admin/reservistes avec groupes=Approuvé,Intérêt
    // Ce nombre DOIT etre = au total affiche dans le dashboard
    const clickQuery = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id', { count: 'exact', head: true })
      .in('groupe', ['Approuvé', 'Intérêt'])
      .eq('statut', 'Actif')
      .not('nom', 'is', null)
      .neq('nom', '')

    const clickCount = clickQuery.count || 0

    if (clickCount !== exactTotal) {
      checks.push({
        name: 'Dashboard click-through coherence',
        status: 'fail',
        expected: exactTotal,
        actual: clickCount,
        detail: `Le dashboard affiche ${exactTotal} mais le click mene a ${clickCount} reservistes. Le filtre statut='Actif' est peut-etre manquant sur la page destination.`,
      })
    } else {
      checks.push({
        name: 'Dashboard click-through coherence',
        status: 'pass',
        expected: exactTotal,
        actual: clickCount,
        detail: `OK - dashboard et click-through donnent ${exactTotal}`,
      })
    }

    // ─── CHECK 5 : Pas de reservistes fantomes (nom vide) ────────────
    const { count: phantomCount } = await supabaseAdmin
      .from('reservistes')
      .select('id', { count: 'exact', head: true })
      .or('nom.is.null,nom.eq.')
      .eq('statut', 'Actif')

    if ((phantomCount || 0) > 0) {
      checks.push({
        name: 'Reservistes sans nom',
        status: 'warn',
        actual: phantomCount || 0,
        detail: `${phantomCount} reservistes actifs ont un nom vide ou null. Ils peuvent fausser les decomptes si un filtre manque.`,
      })
    } else {
      checks.push({
        name: 'Reservistes sans nom',
        status: 'pass',
        detail: 'OK - aucun reserviste actif sans nom',
      })
    }

    // ─── CHECK 6 : Limite 1000 lignes ────────────────────────────────
    // Verifie si un total depasse 1000 (risque de troncature)
    const totals = [
      { label: 'Approuves + Interet', count: exactTotal },
      { label: 'Tous groupes admin', count: exactTotalAdmin },
      { label: 'Avec Partenaires', count: exactTotal + exactPartenaires },
    ]

    for (const t of totals) {
      if (t.count >= 950) {
        checks.push({
          name: `Seuil 1000 lignes (${t.label})`,
          status: t.count >= 1000 ? 'fail' : 'warn',
          actual: t.count,
          detail: t.count >= 1000
            ? `CRITIQUE: ${t.label} = ${t.count}. Toute requete client sans pagination va tronquer!`
            : `ATTENTION: ${t.label} = ${t.count}, proche du seuil de 1000. Verifier que la pagination est en place.`,
        })
      }
    }

    // ─── CHECK 7 : Formations orphelines ─────────────────────────────
    // Des formations liees a des benevole_id qui n'existent plus
    const { data: allBenIds } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id')
    const benIdSet = new Set((allBenIds || []).map(r => r.benevole_id))

    const { data: formBenIds } = await supabaseAdmin
      .from('formations_benevoles')
      .select('benevole_id')
    const orphanFormations = (formBenIds || []).filter(f => !benIdSet.has(f.benevole_id))

    if (orphanFormations.length > 0) {
      checks.push({
        name: 'Formations orphelines',
        status: 'warn',
        actual: orphanFormations.length,
        detail: `${orphanFormations.length} formations liees a des reservistes supprimes. Pas critique mais a nettoyer.`,
      })
    } else {
      checks.push({
        name: 'Formations orphelines',
        status: 'pass',
        detail: 'OK - aucune formation orpheline',
      })
    }

    // ─── Resultat global ─────────────────────────────────────────────
    const hasFail = checks.some(c => c.status === 'fail')
    const hasWarn = checks.some(c => c.status === 'warn')

    return NextResponse.json({
      status: hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'OK',
      timestamp: new Date().toISOString(),
      summary: {
        approuves: exactApprouves,
        interet: exactInteret,
        retrait: exactRetrait,
        partenaires: exactPartenaires,
        formationIncomplete: exactFormInc,
        totalDashboard: exactTotal,
        totalAdmin: exactTotalAdmin,
      },
      checks,
    })
  } catch (err: any) {
    return NextResponse.json({
      status: 'ERROR',
      error: err.message,
      checks,
    }, { status: 500 })
  }
}
