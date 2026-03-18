// app/api/admin/approuver-formation/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierAdmin(benevole_id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('reservistes')
    .select('role')
    .eq('benevole_id', benevole_id)
    .single()
  return data?.role === 'admin'
}

async function moveToApprouve(itemId: string) {
  const query = `
    mutation {
      move_item_to_group(item_id: ${itemId}, group_id: "new_group") {
        id
      }
    }
  `
  await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.MONDAY_API_KEY!,
    },
    body: JSON.stringify({ query }),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      benevole_id, monday_item_id, nom_complet, nom_formation,
      date_reussite, date_expiration, certificat_url,
      initiation_sc_completee, admin_benevole_id
    } = body

    if (!await verifierAdmin(admin_benevole_id)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from('formations_benevoles').insert({
      benevole_id,
      monday_item_id,
      nom_complet,
      nom_formation,
      date_reussite,
      date_expiration: date_expiration || null,
      certificat_url,
      initiation_sc_completee,
      resultat: 'Réussi',
      etat_validite: 'À jour',
      source: 'admin_monday_review',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (monday_item_id) {
      moveToApprouve(monday_item_id).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, date_reussite, date_expiration, admin_benevole_id } = body

    if (!await verifierAdmin(admin_benevole_id)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    if (!id || !date_reussite) {
      return NextResponse.json({ error: 'id et date_reussite requis' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('formations_benevoles')
      .update({
        resultat: 'Réussi',
        etat_validite: 'À jour',
        date_reussite,
        date_expiration: date_expiration || null,
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
