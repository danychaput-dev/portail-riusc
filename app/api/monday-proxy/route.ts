// app/api/admin/approuver-formation/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_IDS = ['8738174928', '18239132668']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      benevole_id, monday_item_id, nom_complet, nom_formation,
      date_reussite, date_expiration, certificat_url,
      initiation_sc_completee, admin_benevole_id
    } = body

    // Vérifier que c'est bien un admin
    if (!ADMIN_IDS.includes(admin_benevole_id)) {
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
      etat_validite: 'valide',
      source: 'admin_monday_review',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
