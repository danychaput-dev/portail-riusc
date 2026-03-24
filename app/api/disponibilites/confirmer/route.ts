import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { benevole_id, deployment_id } = await req.json()
    if (!benevole_id || !deployment_id) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const { error } = await supabase
      .from('disponibilites_v2')
      .update({ disponible: true, a_confirmer: false })
      .eq('benevole_id', benevole_id)
      .eq('deployment_id', deployment_id)
      .eq('a_confirmer', true)

    if (error) {
      console.error('Erreur confirmer:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
