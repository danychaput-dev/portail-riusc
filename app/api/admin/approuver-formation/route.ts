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
  return ['superadmin', 'admin'].includes(data?.role)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      benevole_id, nom_complet, nom_formation,
      date_reussite, date_expiration, certificat_url,
      initiation_sc_completee, admin_benevole_id
    } = body

    if (!await verifierAdmin(admin_benevole_id)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from('formations_benevoles').insert({
      benevole_id,
      nom_complet,
      nom_formation,
      date_reussite,
      date_expiration: date_expiration || null,
      certificat_url,
      initiation_sc_completee,
      resultat: 'Réussi',
      etat_validite: 'À jour',
      source: 'admin_review',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH : Refuser un certificat
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, admin_benevole_id, motif } = body

    if (!await verifierAdmin(admin_benevole_id)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('formations_benevoles')
      .update({
        resultat: 'Refusé',
        etat_validite: null,
        date_reussite: null,
        date_expiration: null,
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE : Supprimer le fichier certificat (mauvais type) et remettre en attente
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const admin_benevole_id = searchParams.get('admin_benevole_id')

    if (!admin_benevole_id || !await verifierAdmin(admin_benevole_id)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    // Recuperer le certificat_url pour supprimer le fichier du storage
    const { data: formation } = await supabaseAdmin
      .from('formations_benevoles')
      .select('certificat_url')
      .eq('id', id)
      .single()

    if (formation?.certificat_url?.startsWith('storage:')) {
      const storagePath = formation.certificat_url.replace('storage:', '')
      await supabaseAdmin.storage.from('certificats').remove([storagePath])
    }

    // Remettre la formation en attente sans fichier
    const { error } = await supabaseAdmin
      .from('formations_benevoles')
      .update({
        certificat_url: null,
        resultat: 'En attente',
        etat_validite: null,
        date_reussite: null,
        date_expiration: null,
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT : Approuver un certificat existant
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
