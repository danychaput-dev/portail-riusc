// app/api/webhooks/twilio-fallback/route.ts
//
// Endpoint de SECOURS pour les SMS entrants Twilio.
// Configure dans Twilio Messaging Service -> Integration -> Fallback URL.
//
// Objectifs :
// 1. Capturer le payload brut dans webhook_fallback_log (jamais perdre un SMS)
// 2. Tenter la meme logique que le primary (UPDATE rappels_camps) avec guard
// 3. Envoyer une alerte courriel aux admins pour investigation
// 4. Toujours retourner 200 TwiML (Twilio ne doit pas retenter eternellement)
//
// Cette route ne doit JAMAIS throw. Chaque etape est dans son propre try/catch.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALERTE_DESTINATAIRES = ['dany.chaput@aqbrs.ca']
const ALERTE_FROM = 'RIUSC Alertes <portail@aqbrs.ca>'

function interpreterReponse(body: string): boolean | null {
  const texte = body.trim().toLowerCase()
  if (['oui', 'yes', 'o', 'ok', '1', 'confirme', 'confirmed'].includes(texte)) return true
  if (['non', 'no', 'n', '0', 'annule', 'cancel'].includes(texte)) return false
  return null
}

function twimlResponse(message: string) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 10)
  console.log(`[twilio-fallback ${reqId}] ===== POST entry =====`)

  // ─── Etape 0 : parser le payload (toujours reussir si possible) ──────────
  let from = ''
  let to = ''
  let body = ''
  let messageSid = ''
  const rawPayload: Record<string, string> = {}

  try {
    const formData = await req.formData()
    for (const [k, v] of formData.entries()) {
      rawPayload[k] = typeof v === 'string' ? v : '[non-string]'
    }
    from = (formData.get('From') as string) || ''
    to = (formData.get('To') as string) || ''
    body = (formData.get('Body') as string) || ''
    messageSid = (formData.get('MessageSid') as string) || ''
  } catch (e) {
    console.error(`[twilio-fallback ${reqId}] Erreur parsing formData:`, e)
  }

  console.log(`[twilio-fallback ${reqId}] from=${from} body=${JSON.stringify(body)} sid=${messageSid}`)

  // ─── Etape 1 : logger le payload brut (priorite absolue) ─────────────────
  let fallbackLogId: string | null = null
  try {
    const { data, error } = await supabaseAdmin
      .from('webhook_fallback_log')
      .insert({
        webhook_path: '/api/webhooks/twilio-fallback',
        from_phone: from || null,
        to_phone: to || null,
        body: body || null,
        message_sid: messageSid || null,
        raw_payload: rawPayload,
      })
      .select('id')
      .single()

    if (error) {
      console.error(`[twilio-fallback ${reqId}] INSERT webhook_fallback_log ECHEC:`, error)
    } else {
      fallbackLogId = data?.id ?? null
      console.log(`[twilio-fallback ${reqId}] webhook_fallback_log insert id=${fallbackLogId}`)
    }
  } catch (e) {
    console.error(`[twilio-fallback ${reqId}] Exception INSERT fallback_log:`, e)
  }

  // ─── Etape 2 : tenter la logique primary (UPDATE rappels_camps) ──────────
  let primaryRetryOk: boolean | null = null
  let primaryRetryError: string | null = null
  const confirmation = body ? interpreterReponse(body) : null

  if (from && body) {
    try {
      // Chercher le rappel le plus recent avec reponse IS NULL
      const { data: rappel } = await supabaseAdmin
        .from('rappels_camps')
        .select('id, session_id, benevole_id, inscription_id')
        .eq('telephone', from)
        .is('reponse', null)
        .order('envoye_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (rappel) {
        const { error: errUpd } = await supabaseAdmin
          .from('rappels_camps')
          .update({
            reponse: body.trim(),
            reponse_confirmee: confirmation,
            reponse_at: new Date().toISOString(),
          })
          .eq('id', rappel.id)
          .is('reponse', null) // double-guard

        if (errUpd) {
          primaryRetryOk = false
          primaryRetryError = errUpd.message
          console.error(`[twilio-fallback ${reqId}] UPDATE rappels_camps ECHEC:`, errUpd)
        } else {
          primaryRetryOk = true
          console.log(`[twilio-fallback ${reqId}] UPDATE rappels_camps OK id=${rappel.id}`)

          // Mettre a jour aussi inscriptions_camps.presence si reponse claire
          if (confirmation === true || confirmation === false) {
            const nouvellePresence = confirmation ? 'confirme' : 'annule'
            const { error: errPres } = await supabaseAdmin
              .from('inscriptions_camps')
              .update({ presence: nouvellePresence, presence_updated_at: new Date().toISOString() })
              .eq('id', rappel.inscription_id)
            if (errPres) {
              console.error(`[twilio-fallback ${reqId}] UPDATE presence ECHEC:`, errPres)
            }
          }
        }
      } else {
        primaryRetryOk = false
        primaryRetryError = 'aucun rappel NULL trouve'
        console.warn(`[twilio-fallback ${reqId}] AUCUN rappel NULL pour ${from}`)
      }
    } catch (e: any) {
      primaryRetryOk = false
      primaryRetryError = e?.message || String(e)
      console.error(`[twilio-fallback ${reqId}] Exception retry primary:`, e)
    }
  }

  // ─── Etape 3 : mettre a jour le log avec le resultat du retry ────────────
  if (fallbackLogId) {
    try {
      await supabaseAdmin
        .from('webhook_fallback_log')
        .update({
          primary_retry_ok: primaryRetryOk,
          primary_retry_error: primaryRetryError,
        })
        .eq('id', fallbackLogId)
    } catch (e) {
      console.error(`[twilio-fallback ${reqId}] Exception UPDATE fallback_log resultat:`, e)
    }
  }

  // ─── Etape 4 : envoyer courriel d'alerte (non bloquant) ──────────────────
  let emailSent = false
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const subject = `[Fallback Twilio] SMS recu de ${from || 'inconnu'}`
    const html = `
      <p><strong>Le fallback webhook Twilio a ete declenche</strong>, ce qui signifie que le endpoint primary a echoue ou n'a pas repondu a temps.</p>
      <table style="border-collapse:collapse;margin-top:12px">
        <tr><td style="padding:4px 12px;border:1px solid #ddd"><strong>Request id</strong></td><td style="padding:4px 12px;border:1px solid #ddd">${reqId}</td></tr>
        <tr><td style="padding:4px 12px;border:1px solid #ddd"><strong>From</strong></td><td style="padding:4px 12px;border:1px solid #ddd">${from || '(vide)'}</td></tr>
        <tr><td style="padding:4px 12px;border:1px solid #ddd"><strong>Body</strong></td><td style="padding:4px 12px;border:1px solid #ddd">${body || '(vide)'}</td></tr>
        <tr><td style="padding:4px 12px;border:1px solid #ddd"><strong>MessageSid</strong></td><td style="padding:4px 12px;border:1px solid #ddd">${messageSid || '(vide)'}</td></tr>
        <tr><td style="padding:4px 12px;border:1px solid #ddd"><strong>Retry primary OK</strong></td><td style="padding:4px 12px;border:1px solid #ddd">${primaryRetryOk === null ? 'n/a' : primaryRetryOk}</td></tr>
        <tr><td style="padding:4px 12px;border:1px solid #ddd"><strong>Retry error</strong></td><td style="padding:4px 12px;border:1px solid #ddd">${primaryRetryError || '(aucune)'}</td></tr>
        <tr><td style="padding:4px 12px;border:1px solid #ddd"><strong>Log id</strong></td><td style="padding:4px 12px;border:1px solid #ddd">${fallbackLogId || '(non persiste)'}</td></tr>
      </table>
      <p style="margin-top:16px">Consulter la vue <code>v_webhook_fallback_pending</code> pour reconcilier.</p>
    `

    const { error } = await resend.emails.send({
      from: ALERTE_FROM,
      to: ALERTE_DESTINATAIRES,
      subject,
      html,
    })

    if (error) {
      console.error(`[twilio-fallback ${reqId}] Resend echec:`, error)
    } else {
      emailSent = true
      console.log(`[twilio-fallback ${reqId}] Email alerte envoye`)
    }
  } catch (e) {
    console.error(`[twilio-fallback ${reqId}] Exception Resend:`, e)
  }

  // Marquer email_alert_sent sur le log
  if (fallbackLogId && emailSent) {
    try {
      await supabaseAdmin
        .from('webhook_fallback_log')
        .update({ email_alert_sent: true })
        .eq('id', fallbackLogId)
    } catch (e) {
      console.error(`[twilio-fallback ${reqId}] Exception UPDATE email_alert_sent:`, e)
    }
  }

  // ─── Etape 5 : toujours repondre TwiML (Twilio ne doit pas retenter) ─────
  let replyMessage: string
  if (primaryRetryOk === true && confirmation === true) {
    replyMessage = 'Merci! Votre présence est confirmée. Au plaisir de vous voir!'
  } else if (primaryRetryOk === true && confirmation === false) {
    replyMessage = 'Nous avons pris note de votre absence. Merci de nous avoir avisé.'
  } else {
    replyMessage = 'Merci pour votre message. Nous avons bien reçu votre réponse et vous recontacterons au besoin.'
  }

  console.log(`[twilio-fallback ${reqId}] ===== POST exit (reply=${replyMessage.slice(0, 40)}) =====`)
  return twimlResponse(replyMessage)
}

// GET pour smoke-test
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    route: '/api/webhooks/twilio-fallback',
    role: 'Fallback pour Twilio Messaging Service Inbound',
    heure: new Date().toISOString(),
  })
}
