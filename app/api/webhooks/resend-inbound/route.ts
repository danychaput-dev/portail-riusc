// app/api/webhooks/resend-inbound/route.ts
// Réception des courriels entrants via Resend Inbound (reply+{courriel_id}@reply.aqbrs.ca)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

// Vérification signature Svix (même pattern que le webhook outbound)
async function verifyWebhookSignature(req: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.warn('RESEND_INBOUND_WEBHOOK_SECRET non configuré — webhook accepté sans vérification')
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
    console.error('Webhook inbound signature invalide:', err)
    return false
  }
}

/**
 * Extraire le courriel_id depuis l'adresse Reply-To
 * Format attendu : reply+{courriel_id}@reply.aqbrs.ca
 * Retourne null si le format ne matche pas
 */
function extractCourrielIdFromAddress(toAddresses: string[]): string | null {
  for (const addr of toAddresses) {
    // Extraire l'email entre < > si présent, sinon prendre tel quel
    const emailMatch = addr.match(/<([^>]+)>/) || [null, addr]
    const email = (emailMatch[1] || addr).toLowerCase().trim()

    // Pattern: reply+{uuid}@reply.aqbrs.ca
    const match = email.match(/^reply\+([a-f0-9-]{36})@/)
    if (match) return match[1]
  }
  return null
}

/**
 * Récupérer le contenu complet d'un email INBOUND
 * Stratégie :
 *   1) SDK Resend → resend.emails.receiving.get(id)  — endpoint /emails/receiving/{id}
 *   2) Fallback fetch brut → GET /emails/receiving/{id}
 *   3) Fallback fetch brut → GET /emails/{id}  (certains exemples Resend l'utilisent)
 * Retry avec délai car le contenu peut ne pas être prêt immédiatement
 */
async function fetchEmailContent(emailId: string, attempt = 1): Promise<{ html: string | null; text: string | null }> {
  const MAX_ATTEMPTS = 3
  const DELAY_MS = 2500

  console.log(`📥 Fetch inbound email content: ${emailId} (tentative ${attempt}/${MAX_ATTEMPTS})`)

  // === Méthode 1 : SDK Resend ===
  try {
    console.log(`📥 [SDK] resend.emails.receiving.get('${emailId}')`)
    const { data: emailData, error: sdkError } = await resend.emails.receiving.get(emailId)

    if (sdkError) {
      console.error(`❌ [SDK] Erreur:`, JSON.stringify(sdkError))
    } else if (emailData) {
      const keys = Object.keys(emailData)
      console.log(`📧 [SDK] Réponse keys=[${keys.join(',')}]`)
      const html = (emailData as any).html || null
      const text = (emailData as any).text || null
      console.log(`📧 [SDK] html=${typeof html} (${html?.length || 0} chars), text=${typeof text} (${text?.length || 0} chars)`)

      if (html || text) {
        console.log(`✅ [SDK] Contenu récupéré pour ${emailId}`)
        return { html, text }
      }
      console.log(`⚠️ [SDK] Réponse OK mais html et text vides`)
    }
  } catch (sdkErr) {
    console.error(`❌ [SDK] Exception:`, sdkErr)
  }

  // === Méthode 2 : Fetch brut /emails/receiving/{id} ===
  try {
    console.log(`📥 [FETCH] GET /emails/receiving/${emailId}`)
    const resp1 = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })
    const text1 = await resp1.text()
    console.log(`📧 [FETCH /receiving] HTTP ${resp1.status}, body length=${text1.length}`)

    if (resp1.ok) {
      const d1 = JSON.parse(text1)
      const keys = Object.keys(d1)
      console.log(`📧 [FETCH /receiving] keys=[${keys.join(',')}]`)
      if (d1.html || d1.text) {
        console.log(`✅ [FETCH /receiving] html=${!!d1.html} (${d1.html?.length || 0}), text=${!!d1.text} (${d1.text?.length || 0})`)
        return { html: d1.html || null, text: d1.text || null }
      }
    } else {
      console.error(`❌ [FETCH /receiving] HTTP ${resp1.status}: ${text1.slice(0, 300)}`)
    }
  } catch (err2) {
    console.error(`❌ [FETCH /receiving] Exception:`, err2)
  }

  // === Méthode 3 : Fetch brut /emails/{id} (fallback) ===
  try {
    console.log(`📥 [FETCH] GET /emails/${emailId}`)
    const resp2 = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })
    const text2 = await resp2.text()
    console.log(`📧 [FETCH /emails] HTTP ${resp2.status}, body length=${text2.length}`)

    if (resp2.ok) {
      const d2 = JSON.parse(text2)
      const keys = Object.keys(d2)
      console.log(`📧 [FETCH /emails] keys=[${keys.join(',')}]`)
      if (d2.html || d2.text) {
        console.log(`✅ [FETCH /emails] html=${!!d2.html} (${d2.html?.length || 0}), text=${!!d2.text} (${d2.text?.length || 0})`)
        return { html: d2.html || null, text: d2.text || null }
      }
    } else {
      console.error(`❌ [FETCH /emails] HTTP ${resp2.status}: ${text2.slice(0, 300)}`)
    }
  } catch (err3) {
    console.error(`❌ [FETCH /emails] Exception:`, err3)
  }

  // === Retry si échec ===
  if (attempt < MAX_ATTEMPTS) {
    console.log(`⏳ Aucune méthode n'a retourné de contenu. Retry dans ${DELAY_MS}ms... (tentative ${attempt}/${MAX_ATTEMPTS})`)
    await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    return fetchEmailContent(emailId, attempt + 1)
  }

  console.error(`❌ ÉCHEC FINAL: impossible de récupérer le contenu de ${emailId} après ${MAX_ATTEMPTS} tentatives`)
  return { html: null, text: null }
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
    const eventType = payload.type as string

    // On ne traite que les emails reçus
    if (eventType !== 'email.received') {
      return NextResponse.json({ ok: true, skipped: `event type: ${eventType}` })
    }

    const data = payload.data
    if (!data) {
      return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
    }

    // 🔍 Debug logging — afficher toute la structure du payload
    const payloadKeys = Object.keys(data)
    console.log(`📩 Webhook inbound payload keys: [${payloadKeys.join(', ')}]`)
    console.log(`📩 data.email_id=${data.email_id}, data.id=${data.id}`)
    console.log(`📩 data.html type=${typeof data.html}, data.text type=${typeof data.text}`)
    if (data.html) console.log(`📩 data.html (${data.html.length} chars): ${data.html.slice(0, 200)}...`)
    if (data.text) console.log(`📩 data.text (${data.text.length} chars): ${data.text.slice(0, 200)}...`)

    const resendEmailId = data.email_id || data.id
    const from = data.from || ''
    const toAddresses: string[] = Array.isArray(data.to) ? data.to : [data.to].filter(Boolean)
    const subject = data.subject || '(sans objet)'
    const attachments = data.attachments || []

    // Extraire le from_email et from_name
    const fromMatch = from.match(/^(.+?)\s*<([^>]+)>$/)
    const fromName = fromMatch ? fromMatch[1].trim() : null
    const fromEmail = fromMatch ? fromMatch[2].trim() : from.trim()

    // Identifier le courriel original via l'adresse reply+{id}@
    const courrielId = extractCourrielIdFromAddress(toAddresses)

    // Récupérer le contenu de l'email :
    // 1) D'abord depuis le payload webhook (Resend inbound inclut html/text)
    // 2) Fallback vers l'API Resend si absent du payload
    let content = { html: data.html || null, text: data.text || null }
    if (!content.html && !content.text && resendEmailId) {
      content = await fetchEmailContent(resendEmailId)
    }

    // Résoudre le benevole_id depuis le courriel original ou depuis l'adresse from
    let benevoleId: string | null = null

    if (courrielId) {
      // Chercher le benevole_id du courriel original
      const { data: courrielOriginal } = await supabaseAdmin
        .from('courriels')
        .select('benevole_id')
        .eq('id', courrielId)
        .single()
      benevoleId = courrielOriginal?.benevole_id || null
    }

    if (!benevoleId) {
      // Fallback : chercher par adresse email
      const { data: reserviste } = await supabaseAdmin
        .from('reservistes')
        .select('benevole_id')
        .eq('email', fromEmail.toLowerCase())
        .single()
      benevoleId = reserviste?.benevole_id || null
    }

    // Préparer les métadonnées des pièces jointes
    const piecesJointes = attachments.map((att: any) => ({
      id: att.id,
      filename: att.filename,
      content_type: att.content_type,
    }))

    // Log final avant insert
    console.log(`📝 Insert courriel_reponses: html=${!!content.html} (${content.html?.length || 0} chars), text=${!!content.text} (${content.text?.length || 0} chars), courriel_id=${courrielId}, email_id=${resendEmailId}`)

    // Insérer la réponse dans la base de données
    const { data: reponse, error: insertError } = await supabaseAdmin
      .from('courriel_reponses')
      .insert({
        courriel_id: courrielId,
        resend_email_id: resendEmailId,
        benevole_id: benevoleId,
        from_email: fromEmail,
        from_name: fromName,
        to_email: toAddresses[0] || null,
        subject,
        body_text: content.text,
        body_html: content.html,
        pieces_jointes: piecesJointes,
        statut: 'recu',
        raw_payload: data,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Erreur insertion courriel_reponses:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Mettre à jour le statut du courriel original → 'replied'
    if (courrielId) {
      await supabaseAdmin
        .from('courriels')
        .update({ has_reply: true })
        .eq('id', courrielId)
    }

    console.log(`📨 Réponse inbound reçue: ${reponse?.id} de ${fromEmail} (réserviste: ${benevoleId || 'inconnu'})`)

    return NextResponse.json({
      ok: true,
      reponse_id: reponse?.id,
      courriel_id: courrielId,
      benevole_id: benevoleId,
    })
  } catch (err: any) {
    console.error('Erreur webhook inbound:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
