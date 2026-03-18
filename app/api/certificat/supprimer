// app/api/certificat/supprimer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { formation_id, benevole_id, storage_path } = body

    if (!formation_id || !benevole_id) {
      return NextResponse.json({ error: 'formation_id et benevole_id requis' }, { status: 400 })
    }

    // Vérifier que la formation appartient bien à ce réserviste
    const { data: formation, error: fetchError } = await supabaseAdmin
      .from('formations_benevoles')
      .select('id, benevole_id, certificat_url')
      .eq('id', formation_id)
      .eq('benevole_id', benevole_id)
      .single()

    if (fetchError || !formation) {
      return NextResponse.json({ error: 'Formation introuvable ou non autorisée' }, { status: 403 })
    }

    // Supprimer du Storage si chemin fourni
    if (storage_path) {
      await supabaseAdmin.storage.from('certificats').remove([storage_path])
    }

    // Mettre certificat_url à null
    const { error: updateError } = await supabaseAdmin
      .from('formations_benevoles')
      .update({ certificat_url: null })
      .eq('id', formation_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
