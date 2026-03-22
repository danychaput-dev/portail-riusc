// app/api/admin/sinistres/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_TABLES = ['sinistres', 'demandes', 'deployments', 'vagues']

async function geocoderLieu(lieu: string): Promise<{ lat: number; lon: number } | null> {
  if (!lieu?.trim()) return null
  try {
    const q = encodeURIComponent(`${lieu}, Québec, Canada`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'User-Agent': 'portail.riusc.ca (contact@aqbrs.ca)', 'Accept-Language': 'fr' } }
    )
    const data = await res.json()
    if (data?.[0]) {
      const lat = parseFloat(data[0].lat)
      const lon = parseFloat(data[0].lon)
      if (!isNaN(lat) && !isNaN(lon) && lat > 44 && lat < 64 && lon > -80 && lon < -57) {
        return { lat, lon }
      }
    }
  } catch {}
  return null
}

async function verifierAcces(benevole_id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('reservistes').select('role').eq('benevole_id', benevole_id).single()
  return data?.role === 'admin' || data?.role === 'coordonnateur'
}

async function nextVal(seq: string): Promise<number> {
  const { data } = await supabaseAdmin.rpc('nextval_seq', { seq_name: seq })
  if (data) return data
  // Fallback si la RPC n'existe pas — utiliser SQL direct
  const { data: d2 } = await supabaseAdmin
    .from('_sequences_dummy').select('*').limit(0) // ne retourne rien, juste pour avoir le client
  const res = await supabaseAdmin.rpc('execute_sql', { query: `SELECT nextval('${seq}')` }).single()
  return 1
}

async function nextValDirect(seq: string): Promise<number> {
  const { data, error } = await (supabaseAdmin as any)
    .from('vagues').select('id').limit(0) // trigger connection
  // Use raw SQL via Supabase
  const result = await supabaseAdmin
    .rpc('get_next_seq', { sequence_name: seq })
  return result.data || 1
}

// Générer identifiant via séquence SQL directe
async function getNextSeq(seqName: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('reservistes')
    .select(`id`)
    .limit(1)
  // On utilise une requête brute via postgrest
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_nextval`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({ seq_name: seqName }),
    }
  )
  if (res.ok) {
    const n = await res.json()
    return typeof n === 'number' ? n : 1
  }
  return Date.now() % 1000
}

// Abréviations organisme
function orgAbbr(organisme: string): string {
  if (organisme.includes('SOPFEU')) return 'SP'
  if (organisme.includes('Croix-Rouge')) return 'CR'
  if (organisme.includes('Municipalité')) return 'MUN'
  return 'AUT'
}

// Format date court : "17 mar"
function dateCourtFr(dateStr?: string): string {
  if (!dateStr) return ''
  const mois = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${mois[d.getMonth()]}`
}

// Tronquer et nettoyer pour identifiant
function slug(s: string, max = 15): string {
  return (s || '').replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, '').trim().slice(0, max).trim()
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

async function syncDemandesJonction(deploymentId: string, demandesIds: string[]) {
  await supabaseAdmin.from('deployments_demandes').delete().eq('deployment_id', deploymentId)
  if (demandesIds.length > 0) {
    await supabaseAdmin.from('deployments_demandes').insert(
      demandesIds.map(did => ({ deployment_id: deploymentId, demande_id: did }))
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, payload, admin_benevole_id, context } = body
    if (!await verifierAcces(admin_benevole_id)) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Table invalide' }, { status: 400 })

    let finalPayload = { ...payload }

    // Auto-générer les identifiants
    if (table === 'demandes' && !payload.identifiant) {
      const n = await getNextSeq('seq_dem')
      const num = String(n).padStart(3, '0')
      const org = orgAbbr(payload.organisme || '')
      const date = dateCourtFr(payload.date_debut)
      const mission = slug(payload.type_mission || '', 12)
      finalPayload.identifiant = `DEM-${num}-${org}${date ? `-${date}` : ''}${mission ? `-${mission}` : ''}`
    }

    if (table === 'deployments' && !payload.identifiant) {
      const n = await getNextSeq('seq_dep')
      const num = String(n).padStart(3, '0')
      const org = context?.demande ? orgAbbr(context.demande.organisme || '') : ''
      const mission = slug(context?.demande?.type_mission || '', 10)
      const lieu = slug(payload.lieu || '', 20)
      finalPayload.identifiant = `DEP-${num}${org ? ` - ${org}` : ''}${mission ? ` ${mission}` : ''}${lieu ? ` - ${lieu}` : ''}`
        .replace(/\s+/g, ' ').trim()
    }

    if (table === 'vagues' && !payload.identifiant) {
      const n = await getNextSeq('seq_vag')
      const num = String(n).padStart(3, '0')
      const dep = context?.deployment
      const org = dep?.context_org || ''
      const mission = dep?.context_mission || ''
      const date = dateCourtFr(payload.date_debut)
      const nb = payload.nb_personnes_requis ? `${payload.nb_personnes_requis} pers` : ''
      finalPayload.identifiant = `VAG-${num}${org ? ` - ${org}` : ''}${mission ? `-${mission}` : ''}${date ? ` - ${date}` : ''}${nb ? ` (${nb})` : ''}`
        .replace(/\s+/g, ' ').trim()
    }

    if (table === 'deployments' && finalPayload.lieu) {
      const coords = await geocoderLieu(finalPayload.lieu)
      if (coords) {
        finalPayload.latitude = coords.lat
        finalPayload.longitude = coords.lon
      }
    }

    const { data, error } = await supabaseAdmin.from(table).insert(finalPayload).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

    if (table === 'deployments_demandes_sync') {
      await syncDemandesJonction(id, payload.demandes_ids || [])
      return NextResponse.json({ success: true })
    }

    if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Table invalide' }, { status: 400 })

    let updatePayload = { ...payload, updated_at: new Date().toISOString() }

    if (table === 'deployments' && payload.lieu) {
      const coords = await geocoderLieu(payload.lieu)
      if (coords) {
        updatePayload.latitude = coords.lat
        updatePayload.longitude = coords.lon
      }
    }

    const { data, error } = await supabaseAdmin
      .from(table).update(updatePayload).eq('id', id).select().single()
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
