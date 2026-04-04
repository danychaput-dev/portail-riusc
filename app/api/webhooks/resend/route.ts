// app/api/webhooks/resend/route.ts
// Réception des webhooks Resend (tracking: delivered, opened, clicked, bounced, complained)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vérification signature Svix (utilisée par Resend)
async function verifyWebhookSignature(req: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.warn('RESEND_WEBHOOK_SECRET non configuré — webhook accepté sans vérification')
    return true
  }

  try {
    const { Webhook } = await import('svix')
    const wh = new Webhook(secret)
    const headers = {
      'svix-id': req.headers.get('svix-id') || '',
      'svix-timestamp': req.headers.get('svix-timestamp') || '',
      'svix-signature': req.headers.get('svix-signature') || '',
    }
    wh.verify(body, headers)
    return true
  } catch (err) {
    console.error('Webhook signature invalide:', err)
    return false
  }
}

// Mapping événement Resend → statut courriel (ordre de priorité croissante)
const STATUT_PRIORITY: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  bounced: 5,
  complained: 5,
  failed: 5,
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    // Vérifier la signature
    const valid = await verifyWebhookSignature(req, body)
    if (!valid) {
      return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
    }

    const payload = JSON.parse(body)
    const eventType = payload.type as string // ex: "email.delivered", "email.opened"
    const data = payload.data

    if (!eventType || !data) {
      return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
    }

    // Extraire le type court (delivered, opened, clicked, bounced, complained)
    const shortType = eventType.replace('email.', '')
    const resendId = data.email_id || data.id

    if (!resendId) {
      return NextResponse.json({ ok: true, skipped: 'no email_id' })
    }

    // Trouver le courriel correspondant
    const { data: courriel } = await supabaseAdmin
      .from('courriels')
      .select('id, statut')
      .eq('resend_id', resendId)
      .single()

    if (!courriel) {
      // Courriel pas trouvé — peut-être envoyé hors portail
      return NextResponse.json({ ok: true, skipped: 'courriel not found' })
    }

    // Insérer l'événement dans courriel_events
    await supabaseAdmin.from('courriel_events').insert({
      courriel_id: courriel.id,
      event_type: shortType,
      metadata: data,
    })

    // Mettre à jour le statut du courriel (seulement si priorité supérieure)
    const currentPriority = STATUT_PRIORITY[courriel.statut] ?? 0
    const newPriority = STATUT_PRIORITY[shortType] ?? 0

    if (newPriority > currentPriority) {
      const updates: Record<string, any> = { statut: shortType }

      // Première ouverture → enregistrer la date
      if (shortType === 'opened' && !courriel.statut?.includes('opened')) {
        updates.ouvert_at = new Date().toISOString()
      }

      // Clic → incrémenter le compteur
      if (shortType === 'clicked') {
        // Utiliser RPC ou update direct
        const { data: current } = await supabaseAdmin
          .from('courriels')
          .select('clics_count')
          .eq('id', courriel.id)
          .single()
        updates.clics_count = (current?.clics_count || 0) + 1
      }

      await supabaseAdmin
        .from('courriels')
        .update(updates)
        .eq('id', courriel.id)
    } else if (shortType === 'clicked') {
      // Même si le statut ne change pas (déjà clicked), on incrémente les clics
      const { data: current } = await supabaseAdmin
        .from('courriels')
        .select('clics_count')
        .eq('id', courriel.id)
        .single()
      await supabaseAdmin
        .from('courriels')
        .update({ clics_count: (current?.clics_count || 0) + 1 })
        .eq('id', courriel.id)
    }

    return NextResponse.json({ ok: true, event: shortType, courriel_id: courriel.id })
  } catch (err: any) {
    console.error('Erreur webhook Resend:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
