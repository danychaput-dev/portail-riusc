// app/api/admin/courriels/supprimer/route.ts
// Supprimer un courriel individuel ou une campagne entière
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
    if (!res || !['admin'].includes(res.role)) {
      return NextResponse.json({ error: 'Accès refusé — admin seulement' }, { status: 403 })
    }

    const { courriel_id, campagne_id } = await req.json()

    if (campagne_id) {
      // Supprimer toutes les réponses liées aux courriels de cette campagne
      const { data: courriels } = await supabaseAdmin
        .from('courriels')
        .select('id')
        .eq('campagne_id', campagne_id)
      const ids = (courriels || []).map(c => c.id)
      if (ids.length > 0) {
        await supabaseAdmin.from('courriel_reponses').delete().in('courriel_id', ids)
      }
      // Supprimer les courriels de la campagne
      const { error } = await supabaseAdmin.from('courriels').delete().eq('campagne_id', campagne_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      // Supprimer la campagne elle-même
      await supabaseAdmin.from('campagnes_courriels').delete().eq('id', campagne_id)
      return NextResponse.json({ ok: true, deleted: ids.length })
    }

    if (courriel_id) {
      // Supprimer les réponses liées
      await supabaseAdmin.from('courriel_reponses').delete().eq('courriel_id', courriel_id)
      // Supprimer le courriel
      const { error } = await supabaseAdmin.from('courriels').delete().eq('id', courriel_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, deleted: 1 })
    }

    return NextResponse.json({ error: 'courriel_id ou campagne_id requis' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
