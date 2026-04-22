// app/api/webhooks/twilio-reponse/route.ts
// Webhook appelé par Twilio quand un participant répond au SMS de rappel
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { n8nUrl } from '@/utils/n8n'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function interpreterReponse(body: string): boolean | null {
  const texte = body.trim().toLowerCase()
  if (['oui', 'yes', 'o', 'ok', '1', 'confirme', 'confirmed'].includes(texte)) return true
  if (['non', 'no', 'n', '0', 'annule', 'cancel'].includes(texte)) return false
  return null
}

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 10)
  console.log(`[twilio-reponse ${reqId}] ===== POST entry =====`)

  // Twilio envoie les données en application/x-www-form-urlencoded
  const formData = await req.formData()
  const from = formData.get('From') as string        // +15145550000
  const body = formData.get('Body') as string         // OUI / NON
  const messageSid = formData.get('MessageSid') as string

  console.log(`[twilio-reponse ${reqId}] from=${from} body=${JSON.stringify(body)} sid=${messageSid}`)

  if (!from || !body) {
    console.warn(`[twilio-reponse ${reqId}] missing from or body, returning empty TwiML`)
    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Trouver le rappel le plus récent envoyé à ce numéro
  const { data: rappel, error: errSelect } = await supabaseAdmin
    .from('rappels_camps')
    .select('id, session_id, benevole_id, inscription_id')
    .eq('telephone', from)
    .is('reponse', null)
    .order('envoye_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errSelect) {
    console.error(`[twilio-reponse ${reqId}] ERREUR SELECT rappels_camps:`, errSelect)
  }
  console.log(`[twilio-reponse ${reqId}] rappel trouve: ${rappel ? rappel.id : 'AUCUN'}`)

  const confirmation = interpreterReponse(body)
  let replyMessage: string

  if (rappel) {
    // Enregistrer la réponse
    const { error: errUpdRappel, data: updRappel } = await supabaseAdmin
      .from('rappels_camps')
      .update({
        reponse: body.trim(),
        reponse_confirmee: confirmation,
        reponse_at: new Date().toISOString(),
      })
      .eq('id', rappel.id)
      .select('id')

    if (errUpdRappel) {
      console.error(`[twilio-reponse ${reqId}] ERREUR UPDATE rappels_camps:`, errUpdRappel)
    } else {
      console.log(`[twilio-reponse ${reqId}] UPDATE rappels_camps OK rows=${updRappel?.length ?? 0}`)
    }

    // Mettre à jour la présence dans inscriptions_camps si réponse claire
    if (confirmation === true) {
      const { error: errPres } = await supabaseAdmin
        .from('inscriptions_camps')
        .update({ presence: 'confirme', presence_updated_at: new Date().toISOString() })
        .eq('id', rappel.inscription_id)
      if (errPres) console.error(`[twilio-reponse ${reqId}] ERREUR UPDATE presence confirme:`, errPres)
      replyMessage = 'Merci! Votre présence est confirmée. Au plaisir de vous voir!'
    } else if (confirmation === false) {
      const { error: errPres } = await supabaseAdmin
        .from('inscriptions_camps')
        .update({ presence: 'annule', presence_updated_at: new Date().toISOString() })
        .eq('id', rappel.inscription_id)
      if (errPres) console.error(`[twilio-reponse ${reqId}] ERREUR UPDATE presence annule:`, errPres)
      replyMessage = 'Nous avons pris note de votre absence. Merci de nous avoir avisé.'
    } else {
      replyMessage = 'Merci pour votre message. Veuillez répondre OUI pour confirmer ou NON pour annuler.'

      // Notifier les admins qu'un participant a envoyé une réponse non standard
      const { data: inscription } = await supabaseAdmin
        .from('inscriptions_camps')
        .select('prenom_nom, camp_nom, camp_dates')
        .eq('id', rappel.inscription_id)
        .single()

      try {
        await fetch(n8nUrl('/webhook/riusc-alerte-reponse-sms'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telephone: from,
            message_recu: body.trim(),
            prenom_nom: inscription?.prenom_nom || 'Inconnu',
            camp_nom: inscription?.camp_nom || '',
            camp_dates: inscription?.camp_dates || '',
            date_reponse: new Date().toISOString(),
          }),
        })
      } catch (e) {
        console.error('n8n alerte reponse SMS:', e)
      }
    }
  } else {
    console.warn(`[twilio-reponse ${reqId}] AUCUN rappel NULL pour ${from}, reponse generique`)
    replyMessage = 'Merci pour votre message. Si vous avez des questions, contactez-nous à info@aqbrs.ca.'
  }

  console.log(`[twilio-reponse ${reqId}] reply: ${replyMessage.slice(0, 60)}`)

  // Répondre en TwiML
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyMessage}</Message>
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

// GET pour smoke-test rapide depuis navigateur ou Twilio health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    route: '/api/webhooks/twilio-reponse',
    method_attendu: 'POST avec formData (From, Body, MessageSid)',
    heure: new Date().toISOString(),
  })
}
