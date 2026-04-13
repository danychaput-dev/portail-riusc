import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/utils/auth-api'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth

    const { benevole_id, deployment_id, date_debut, date_fin } = await req.json()
    if (!benevole_id || !deployment_id || !date_debut || !date_fin) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    // Un reserviste ne peut annuler que ses propres disponibilites
    if (auth.role === 'reserviste' && auth.benevole_id !== benevole_id) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    const { error } = await supabase
      .from('disponibilites_v2')
      .delete()
      .eq('benevole_id', benevole_id)
      .eq('deployment_id', deployment_id)
      .gte('date_jour', date_debut)
      .lte('date_jour', date_fin)

    if (error) {
      console.error('Erreur annuler:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
