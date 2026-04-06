// app/api/admin/courriels/envoyer/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    // Auth — admin ou coordonnateur
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
    if (!res || !['admin', 'coordonnateur'].includes(res.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { destinataires, subject, body_html, campagne_nom, attachments, cc } = await req.json()
    const ccList: string[] = Array.isArray(cc) ? cc.filter((e: any) => typeof e === 'string' && e.includes('@')) : []

    if (!destinataires || !Array.isArray(destinataires) || destinataires.length === 0) {
      return NextResponse.json({ error: 'Au moins un destinataire requis' }, { status: 400 })
    }
    if (!subject) return NextResponse.json({ error: 'Objet requis' }, { status: 400 })
    if (!body_html) return NextResponse.json({ error: 'Contenu requis' }, { status: 400 })

    // Récupérer la config email de l'admin
    const { data: config } = await supabaseAdmin
      .from('admin_email_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const fromName = config?.from_name || 'RIUSC'
    const fromEmail = config?.from_email || `noreply@${process.env.RESEND_FROM_DOMAIN || 'aqbrs.ca'}`
    const signature = config?.signature_html || ''
    const replyTo = config?.reply_to || fromEmail

    // Créer une campagne si envoi de masse (> 1 destinataire)
    let campagne_id: string | null = null
    if (destinataires.length > 1) {
      const { data: campagne, error: campErr } = await supabaseAdmin
        .from('courriel_campagnes')
        .insert({
          nom: campagne_nom || subject,
          subject,
          body_html,
          total_envoyes: destinataires.length,
          envoye_par: user.id,
        })
        .select('id')
        .single()
      if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 })
      campagne_id = campagne.id
    }

    // Convertir les URLs texte en liens cliquables <a href> (pour le Click Tracking Resend)
    // Ignore les URLs déjà dans href="..." ou src="..."
    const linkifyUrls = (text: string): string => {
      return text.replace(
        /(href=["']|src=["'])?(https?:\/\/[^\s<>"']+)/g,
        (match, prefix, url) => {
          if (prefix) return match  // Déjà dans un attribut HTML — ne pas toucher
          return `<a href="${url}" target="_blank">${url}</a>`
        }
      )
    }

    // Préparer les courriels avec variables remplacées
    const prepared = destinataires.map((dest: any) => {
      let html = linkifyUrls(body_html)
        .replace(/\{\{\s*prenom\s*\}\}/gi, dest.prenom || '')
        .replace(/\{\{\s*nom\s*\}\}/gi, dest.nom || '')
      if (signature) html += `<br/><br/>--<br/>${signature}`
      return { ...dest, html }
    })

    // Préparer les pièces jointes Resend (base64 → buffer)
    const resendAttachments = (attachments || []).map((a: any) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
    }))

    const attachmentNames = (attachments || []).map((a: any) => a.filename).filter(Boolean)

    // Domaine inbound pour Reply-To dynamique (reply+{courriel_id}@reply.aqbrs.ca)
    const inboundDomain = process.env.RESEND_INBOUND_DOMAIN || 'reply.aqbrs.ca'

    const resultats: { benevole_id: string; ok: boolean; error?: string }[] = []

    // ── Batch API pour envois de masse (lots de 100) ──
    // Note: en batch, on pré-crée les IDs pour le Reply-To dynamique
    if (prepared.length > 1) {
      const BATCH_SIZE = 100
      for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
        const batch = prepared.slice(i, i + BATCH_SIZE)

        // Pré-créer les enregistrements courriels pour obtenir les IDs (pour le Reply-To)
        const preInserts = await Promise.all(
          batch.map(async (dest: any) => {
            const { data: row, error: insertErr } = await supabaseAdmin.from('courriels').insert({
              campagne_id, benevole_id: dest.benevole_id,
              from_email: fromEmail, from_name: fromName, to_email: dest.email,
              subject, body_html: dest.html, statut: 'queued', envoye_par: user.id,
              pieces_jointes: attachmentNames,
            }).select('id').single()
            if (insertErr) console.error('❌ Erreur pré-insert courriel:', insertErr.message, 'pour', dest.email)
            else console.log('✅ Pré-insert OK:', row?.id, '→ Reply-To: reply+' + row?.id + '@' + inboundDomain)
            return { ...dest, courriel_id: row?.id }
          })
        )

        try {
          const { data: batchResult, error: batchError } = await resend.batch.send(
            preInserts.map((dest: any) => ({
              from: `${fromName} <${fromEmail}>`,
              to: [dest.email],
              ...(ccList.length > 0 ? { cc: ccList } : {}),
              subject,
              html: dest.html,
              replyTo: dest.courriel_id ? `reply+${dest.courriel_id}@${inboundDomain}` : replyTo,
              headers: { 'X-Entity-Ref-ID': dest.benevole_id },
              tags: [{ name: 'source', value: 'portail-riusc' }],
              ...(resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
            }))
          )

          if (batchError) {
            // Batch entier échoué — marquer tous comme failed
            for (const dest of preInserts) {
              resultats.push({ benevole_id: dest.benevole_id, ok: false, error: batchError.message })
              if (dest.courriel_id) {
                await supabaseAdmin.from('courriels').update({ statut: 'failed' }).eq('id', dest.courriel_id)
              }
            }
            continue
          }

          // Batch réussi — mettre à jour avec resend_id
          const batchData = batchResult?.data || []
          for (let j = 0; j < preInserts.length; j++) {
            const dest = preInserts[j]
            const resendId = batchData[j]?.id || null
            if (dest.courriel_id) {
              await supabaseAdmin.from('courriels').update({
                resend_id: resendId, statut: 'sent',
              }).eq('id', dest.courriel_id)
            }
            resultats.push({ benevole_id: dest.benevole_id, ok: true })
          }
        } catch (err: any) {
          for (const dest of preInserts) {
            resultats.push({ benevole_id: dest.benevole_id, ok: false, error: err.message })
            if (dest.courriel_id) {
              await supabaseAdmin.from('courriels').update({ statut: 'failed' }).eq('id', dest.courriel_id)
            }
          }
        }
      }
    } else {
      // ── Envoi individuel ──
      const dest = prepared[0]

      // Pré-créer l'enregistrement pour obtenir l'ID (Reply-To dynamique)
      const { data: preRow, error: preInsertErr } = await supabaseAdmin.from('courriels').insert({
        campagne_id, benevole_id: dest.benevole_id,
        from_email: fromEmail, from_name: fromName, to_email: dest.email,
        subject, body_html: dest.html, statut: 'queued', envoye_par: user.id,
        pieces_jointes: attachmentNames,
      }).select('id').single()
      if (preInsertErr) console.error('❌ Erreur pré-insert courriel individuel:', preInsertErr.message)
      const courrielId = preRow?.id

      const dynamicReplyTo = courrielId ? `reply+${courrielId}@${inboundDomain}` : replyTo
      console.log('📧 Reply-To pour', dest.email, ':', dynamicReplyTo, '(courrielId:', courrielId, ', inboundDomain:', inboundDomain, ')')

      try {
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [dest.email],
          ...(ccList.length > 0 ? { cc: ccList } : {}),
          subject,
          html: dest.html,
          replyTo: dynamicReplyTo,
          headers: { 'X-Entity-Ref-ID': dest.benevole_id },
          tags: [{ name: 'source', value: 'portail-riusc' }],
          ...(resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
        })

        if (emailError) {
          resultats.push({ benevole_id: dest.benevole_id, ok: false, error: emailError.message })
          if (courrielId) {
            await supabaseAdmin.from('courriels').update({ statut: 'failed' }).eq('id', courrielId)
          }
        } else {
          if (courrielId) {
            await supabaseAdmin.from('courriels').update({
              resend_id: emailData?.id || null, statut: 'sent',
            }).eq('id', courrielId)
          }
          resultats.push({ benevole_id: dest.benevole_id, ok: true })
        }
      } catch (err: any) {
        resultats.push({ benevole_id: dest.benevole_id, ok: false, error: err.message })
        if (courrielId) {
          await supabaseAdmin.from('courriels').update({ statut: 'failed' }).eq('id', courrielId)
        }
      }
    }

    const envoyes = resultats.filter(r => r.ok).length
    const echoues = resultats.filter(r => !r.ok).length

    return NextResponse.json({ ok: true, envoyes, echoues, resultats, campagne_id })
  } catch (err: any) {
    console.error('❌ Erreur envoi courriel:', err)
    // Vérifier si c'est un problème de parsing JSON du body
    const msg = err.message || 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
