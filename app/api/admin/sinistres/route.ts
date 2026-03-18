// app/api/admin/sinistres/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_TABLES = ['sinistres', 'demandes', 'deployments', 'vagues']

async function verifierAcces(benevole_id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('reservistes').select('role').eq('benevole_id', benevole_id).single()
  return data?.role === 'admin' || data?.role === 'coordonnateur'
}

async function syncDeploiementsActifs(deployment: any, demande: any, sinistre: any) {
  await supabaseAdmin.from('deploiements_actifs').upsert({
    deploiement_id: deployment.id,
    nom_deploiement: deployment.nom,
    nom_sinistre: sinistre?.nom || null,
    nom_demande: demande?.type_mission || null,
    organisme: demande?.organisme || null,
    date_debut: deployment.date_debut || null,
    date_fin: deployment.date_fin || null,
    lieu: deployment.lieu || null,
    statut: deployment.statut,
    tache: demande?.type_mission || null,
    date_limite_reponse: null,
  }, { onConflict: 'deploiement_id' })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, payload, admin_benevole_id, context } = body
    if (!await verifierAcces(admin_benevole_id)) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Table invalide' }, { status: 400 })

    const { data, error } = await supabaseAdmin.from(table).insert(payload).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Sync deploiements_actifs quand on crée un déploiement
    if (table === 'deployments' && context) {
      await syncDeploiementsActifs(data, context.demande, context.sinistre)
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, id, payload, admin_benevole_id, context } = body
    if (!await verifierAcces(admin_benevole_id)) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Table invalide' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from(table).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (table === 'deployments' && context) {
      await syncDeploiementsActifs(data, context.demande, context.sinistre)
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, id, admin_benevole_id } = body
    if (!await verifierAcces(admin_benevole_id)) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Table invalide' }, { status: 400 })

    const { error } = await supabaseAdmin.from(table).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (table === 'deployments') {
      await supabaseAdmin.from('deploiements_actifs').delete().eq('deploiement_id', id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
