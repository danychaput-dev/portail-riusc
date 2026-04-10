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
    if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { destinataires, subject, body_html, campagne_nom, attachments, cc, reply_to_courriel_id } = body
    // Support envoi chunke: le client peut envoyer un campagne_id existant + total_destinataires
    const clientCampagneId: string | null = body.campagne_id || null
    const totalDestinataires: number = body.total_destinataires || destinataires?.length || 0
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

    // Créer une campagne ou réutiliser celle du client (envoi chunke)
    let campagne_id: string | null = clientCampagneId
    if (!campagne_id && destinataires.length > 1) {
      const { data: campagne, error: campErr } = await supabaseAdmin
        .from('courriel_campagnes')
        .insert({
          nom: campagne_nom || subject,
          subject,
          body_html,
          total_envoyes: totalDestinataires,
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
    // l'API individuelle (POST /emails) avec le contenu en Buffer (pas d'URL).
    // IMPORTANT: On telecharge chaque fichier UNE SEULE FOIS en memoire, puis on envoie
    // le Buffer a Resend pour chaque courriel. Cela evite que Resend telecharge le fichier
    // depuis Supabase pour chacun des N courriels (cause de timeout sur les envois de masse).
    const resendAttachments: { filename: string; content: Buffer }[] = []
    const attachmentLinks: { filename: string; url: string }[] = []
    for (const a of (attachments || [])) {
      if (a.storage_path) {
        // Telecharger le fichier UNE SEULE FOIS en memoire
        const { data: fileData, error: dlErr } = await supabaseAdmin.storage
          .from('certificats')
          .download(a.storage_path)
        if (dlErr || !fileData) {
          console.error('Erreur telechargement PJ:', dlErr?.message, a.storage_path)
          continue
        }
        const buffer = Buffer.from(await fileData.arrayBuffer())
        console.log('PJ telechargee en memoire:', a.filename, '(' + a.storage_path + ')', buffer.length, 'octets')
        resendAttachments.push({ filename: a.filename, content: buffer })
        // Lien permanent via route API (ne meurt jamais, genere l'URL signee au moment du clic)
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://portail.riusc.ca')
        attachmentLinks.push({ filename: a.filename, url: `${baseUrl}/api/admin/courriels/fichier?path=${encodeURIComponent(a.storage_path)}` })
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
      // ── Mode n8n: envoi de masse avec PJ deleguee a n8n (pas de timeout) ──
      // 1. Pre-inserer tous les courriels en statut queued
      // 2. Declencher n8n via webhook (n8n boucle et envoie via Resend a son rythme)
      // 3. Retourner immediatement au client avec le statut "delegue"
      console.log(`Delegation n8n: ${prepared.length} destinataires avec PJ`)

      const insertResults = await Promise.all(
        prepared.map(async (dest: any) => {
          const { data: row, error: insertErr } = await supabaseAdmin.from('courriels').insert({
            campagne_id, benevole_id: dest.benevole_id,
            from_email: fromEmail, from_name: fromName, to_email: dest.email,
            subject, body_html: dest.html, statut: 'queued', envoye_par: user.id,
            pieces_jointes: attachmentNames,
          }).select('id').single()
          if (insertErr) console.error('Erreur pre-insert courriel:', insertErr.message, 'pour', dest.email)
          return { benevole_id: dest.benevole_id, ok: !insertErr, courriel_id: row?.id }
        })
      )

      const inserted = insertResults.filter(r => r.ok).length
      console.log(`${inserted}/${prepared.length} courriels pre-inseres en queued`)

      // Declencher n8n (fire-and-forget, n8n repond 200 immediatement)
      const n8nBaseUrl = process.env.NEXT_PUBLIC_N8N_BASE_URL || 'https://n8n.aqbrs.ca'
      try {
        await fetch(`${n8nBaseUrl}/webhook/riusc-envoi-campagne`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campagne_id,
            attachments: (attachments || []).filter((a: any) => a.storage_path).map((a: any) => ({
              filename: a.filename,
              storage_path: a.storage_path,
            })),
            from_name: fromName,
            from_email: fromEmail,
            reply_to: replyTo,
            signature_html: signature,
            inbound_domain: inboundDomain,
            cc: ccList.length > 0 ? ccList : undefined,
            // Passer les cles a n8n (pas de $env dispo en plan community)
            resend_api_key: process.env.RESEND_API_KEY,
            supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
          }),
        })
        console.log('Webhook n8n declenche pour campagne:', campagne_id)
      } catch (err: any) {
        console.error('Erreur declenchement n8n:', err.message)
        // Pas fatal: les courriels sont en queued, on peut relancer n8n manuellement
      }

      // Retourner au client: tous les courriels sont queued, n8n prend la releve
      return NextResponse.json({
        ok: true,
        envoyes: inserted,
        echoues: prepared.length - inserted,
        campagne_id,
        delegue_n8n: true,
        resultats: insertResults.map(r => ({ benevole_id: r.benevole_id, ok: r.ok })),
      })
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
          const isFirstBatch = i === 0
          const { data: batchResult, error: batchError } = await resend.batch.send(
            preInserts.map((dest: any, idx: number) => ({
              from: `${fromName} <${fromEmail}>`,
              to: [dest.email],
              ...(isFirstBatch && idx === 0 && ccList.length > 0 ? { cc: ccList } : {}),
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

    // Mettre a jour le total reel de la campagne
    // En mode chunke (clientCampagneId fourni), on additionne au total existant
    // En mode normal, on ecrase avec le total du lot
    if (campagne_id) {
      if (clientCampagneId) {
        // Mode chunke: incrementer le total existant
        const { data: current } = await supabaseAdmin.from('courriel_campagnes').select('total_envoyes').eq('id', campagne_id).single()
        const currentTotal = current?.total_envoyes || 0
        await supabaseAdmin.from('courriel_campagnes').update({
          total_envoyes: currentTotal + envoyes,
        }).eq('id', campagne_id)
      } else {
        await supabaseAdmin.from('courriel_campagnes').update({
          total_envoyes: envoyes,
        }).eq('id', campagne_id)
      }
      if (echoues > 0) console.log(`Campagne ${campagne_id}: ${envoyes} envoyes, ${echoues} echoues sur ${destinataires.length} destinataires (lot)`)
    }

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
