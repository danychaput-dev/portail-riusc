// app/api/admin/courriels/envoyer/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { Resend } from 'resend'

// Vercel Pro: max 300 secondes (5 min) pour les envois de masse avec PJ
export const maxDuration = 300

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

    const { destinataires, subject, body_html, campagne_nom, attachments, cc, reply_to_courriel_id } = await req.json()
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

    // Préparer les pièces jointes Resend AVANT le HTML (pour inserer les liens trackables)
    // L'API batch ne supporte PAS les attachments. Pour les envois avec PJ, on utilise
    // l'API individuelle (POST /emails) avec des URLs signees Supabase (path).
    const resendAttachments: { filename: string; path?: string; content?: Buffer }[] = []
    const attachmentLinks: { filename: string; url: string }[] = []
    for (const a of (attachments || [])) {
      if (a.storage_path) {
        // URL signee valide 1 heure
        const { data: signedData, error: signErr } = await supabaseAdmin.storage
          .from('certificats')
          .createSignedUrl(a.storage_path, 3600)
        if (signErr || !signedData?.signedUrl) {
          console.error('Erreur creation URL signee PJ:', signErr?.message, a.storage_path)
          continue
        }
        console.log('URL signee PJ:', a.filename, '(' + a.storage_path + ')')
        resendAttachments.push({ filename: a.filename, path: signedData.signedUrl })
        attachmentLinks.push({ filename: a.filename, url: signedData.signedUrl })
      } else if (a.content) {
        resendAttachments.push({ filename: a.filename, content: Buffer.from(a.content, 'base64') })
      }
    }
    const hasAttachments = resendAttachments.length > 0

    // Préparer les courriels avec variables remplacées
    const prepared = destinataires.map((dest: any) => {
      let html = linkifyUrls(body_html)
        .replace(/\{\{\s*prenom\s*\}\}/gi, dest.prenom || '')
        .replace(/\{\{\s*nom\s*\}\}/gi, dest.nom || '')
      // Ajouter les liens vers les PJ (trackables par Resend via click tracking)
      if (attachmentLinks.length > 0) {
        html += '<br/><br/><table cellpadding="0" cellspacing="0" border="0">'
        for (const link of attachmentLinks) {
          html += `<tr><td style="padding:4px 0"><a href="${link.url}" target="_blank" style="color:#2563eb;text-decoration:underline">Consulter : ${link.filename}</a></td></tr>`
        }
        html += '</table>'
      }
      if (signature) html += `<br/><br/>${signature}`
      return { ...dest, html }
    })

    const attachmentNames = (attachments || []).map((a: any) => a.filename).filter(Boolean)

    // Domaine inbound pour Reply-To dynamique (reply+{courriel_id}@reply.aqbrs.ca)
    const inboundDomain = process.env.RESEND_INBOUND_DOMAIN || 'reply.aqbrs.ca'

    const resultats: { benevole_id: string; ok: boolean; error?: string }[] = []

    // ── Envois de masse ──
    // IMPORTANT: L'API batch de Resend (POST /emails/batch) ne supporte PAS les attachments.
    // Quand il y a des PJ, on envoie chaque courriel individuellement via POST /emails.
    // Sans PJ, on utilise le batch pour la performance (lots de 100).
    if (prepared.length > 1 && hasAttachments) {
      // ── Mode individuel parallele avec PJ (batch Resend ne supporte pas les attachments) ──
      // On envoie par lots de 10 en parallele pour la performance
      const PARALLEL_SIZE = 10
      console.log(`Envoi individuel parallele avec PJ: ${prepared.length} destinataires, lots de ${PARALLEL_SIZE}, PJ: ${resendAttachments.map(a => a.filename).join(', ')}`)

      for (let i = 0; i < prepared.length; i += PARALLEL_SIZE) {
        const chunk = prepared.slice(i, i + PARALLEL_SIZE)

        const chunkResults = await Promise.all(
          chunk.map(async (dest: any) => {
            // Pre-creer l'enregistrement pour le Reply-To dynamique
            const { data: row, error: insertErr } = await supabaseAdmin.from('courriels').insert({
              campagne_id, benevole_id: dest.benevole_id,
              from_email: fromEmail, from_name: fromName, to_email: dest.email,
              subject, body_html: dest.html, statut: 'queued', envoye_par: user.id,
              pieces_jointes: attachmentNames,
            }).select('id').single()
            if (insertErr) console.error('Erreur pre-insert courriel:', insertErr.message, 'pour', dest.email)
            const courrielId = row?.id

            try {
              const { data: emailData, error: emailError } = await resend.emails.send({
                from: `${fromName} <${fromEmail}>`,
                to: [dest.email],
                subject,
                html: dest.html,
                replyTo: courrielId ? `reply+${courrielId}@${inboundDomain}` : replyTo,
                headers: { 'X-Entity-Ref-ID': dest.benevole_id },
                tags: [{ name: 'source', value: 'portail-riusc' }],
                attachments: resendAttachments,
              })

              if (emailError) {
                if (courrielId) await supabaseAdmin.from('courriels').update({ statut: 'failed' }).eq('id', courrielId)
                return { benevole_id: dest.benevole_id, ok: false, error: emailError.message }
              } else {
                if (courrielId) {
                  await supabaseAdmin.from('courriels').update({
                    resend_id: emailData?.id || null, statut: 'sent',
                  }).eq('id', courrielId)
                }
                return { benevole_id: dest.benevole_id, ok: true }
              }
            } catch (err: any) {
              if (courrielId) await supabaseAdmin.from('courriels').update({ statut: 'failed' }).eq('id', courrielId)
              return { benevole_id: dest.benevole_id, ok: false, error: err.message }
            }
          })
        )

        resultats.push(...chunkResults)

        // Log progression tous les 50 courriels
        const sent = Math.min(i + PARALLEL_SIZE, prepared.length)
        if (sent % 50 < PARALLEL_SIZE) console.log(`Progression: ${sent}/${prepared.length} courriels envoyes`)
      }
    } else if (prepared.length > 1) {
      // ── Mode batch sans PJ (performant, lots de 100) ──
      const BATCH_SIZE = 100
      console.log(`Envoi batch sans PJ: ${prepared.length} destinataires`)
      for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
        const batch = prepared.slice(i, i + BATCH_SIZE)

        const preInserts = await Promise.all(
          batch.map(async (dest: any) => {
            const { data: row, error: insertErr } = await supabaseAdmin.from('courriels').insert({
              campagne_id, benevole_id: dest.benevole_id,
              from_email: fromEmail, from_name: fromName, to_email: dest.email,
              subject, body_html: dest.html, statut: 'queued', envoye_par: user.id,
              pieces_jointes: attachmentNames,
            }).select('id').single()
            if (insertErr) console.error('Erreur pre-insert courriel:', insertErr.message, 'pour', dest.email)
            return { ...dest, courriel_id: row?.id }
          })
        )

        try {
          const { data: batchResult, error: batchError } = await resend.batch.send(
            preInserts.map((dest: any) => ({
              from: `${fromName} <${fromEmail}>`,
              to: [dest.email],
              subject,
              html: dest.html,
              replyTo: dest.courriel_id ? `reply+${dest.courriel_id}@${inboundDomain}` : replyTo,
              headers: { 'X-Entity-Ref-ID': dest.benevole_id },
              tags: [{ name: 'source', value: 'portail-riusc' }],
            }))
          )

          if (batchError) {
            for (const dest of preInserts) {
              resultats.push({ benevole_id: dest.benevole_id, ok: false, error: batchError.message })
              if (dest.courriel_id) {
                await supabaseAdmin.from('courriels').update({ statut: 'failed' }).eq('id', dest.courriel_id)
              }
            }
            continue
          }

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
          ...(ccList.length > 0 && prepared.length === 1 ? { cc: ccList } : {}),
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

    // ── Envoi unique CC pour les envois de masse ──
    // Le CC recoit une seule copie du courriel (sans variables personnalisées)
    if (ccList.length > 0 && prepared.length > 1 && envoyes > 0) {
      try {
        let ccHtml = linkifyUrls(body_html)
          .replace(/\{\{\s*prenom\s*\}\}/gi, '')
          .replace(/\{\{\s*nom\s*\}\}/gi, '')
        if (attachmentLinks.length > 0) {
          ccHtml += '<br/><br/><table cellpadding="0" cellspacing="0" border="0">'
          for (const link of attachmentLinks) {
            ccHtml += `<tr><td style="padding:4px 0"><a href="${link.url}" target="_blank" style="color:#2563eb;text-decoration:underline">Consulter : ${link.filename}</a></td></tr>`
          }
          ccHtml += '</table>'
        }
        if (signature) ccHtml += `<br/><br/>${signature}`

        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: ccList,
          subject,
          html: ccHtml,
          replyTo,
          tags: [{ name: 'source', value: 'portail-riusc' }, { name: 'type', value: 'cc-copie' }],
          ...(resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
        })
        console.log('✅ CC envoyé une seule fois à:', ccList.join(', '))
      } catch (err: any) {
        console.error('❌ Erreur envoi CC:', err.message)
      }
    }

    // ── Enregistrer la reponse sortante dans courriel_reponses si c'est un reply ──
    // Permet d'afficher la reponse admin dans le fil de discussion (campagne et individuel)
    if (reply_to_courriel_id && envoyes > 0) {
      try {
        const dest = prepared[0]
        const finalHtml = dest.html
        await supabaseAdmin.from('courriel_reponses').insert({
          courriel_id: reply_to_courriel_id,
          benevole_id: dest.benevole_id,
          from_email: fromEmail,
          from_name: fromName,
          to_email: dest.email,
          subject,
          body_html: finalHtml,
          body_text: finalHtml.replace(/<[^>]*>/g, ''),
          statut: 'sortant',
        })
        console.log('Reponse sortante enregistree dans courriel_reponses pour courriel_id:', reply_to_courriel_id)
      } catch (err: any) {
        console.error('Erreur insertion reponse sortante:', err.message)
      }
    }

    return NextResponse.json({ ok: true, envoyes, echoues, resultats, campagne_id })
  } catch (err: any) {
    console.error('❌ Erreur envoi courriel:', err)
    // Vérifier si c'est un problème de parsing JSON du body
    const msg = err.message || 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
