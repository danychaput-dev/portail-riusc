// app/api/admin/courriels/resume-responsables/route.ts
//
// POST — envoie un courriel résumé à chaque responsable de groupe R&S après
// un envoi de masse.
//
// Déclenché par le frontend après que l'envoi principal a réussi (flux pour
// 2+ destinataires). Pour chaque responsable concerné, on envoie UN SEUL
// courriel contenant :
//   - Le sujet et le corps du courriel original
//   - La liste des destinataires de SON groupe qui l'ont reçu
//
// Si un seul destinataire, on ne devrait pas arriver ici — l'UI utilise
// plutôt le CC classique pour 1 destinataire (visibilité immédiate).

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

interface RequestBody {
  destinataire_benevole_ids: string[]   // ids des destinataires du courriel principal
  responsable_benevole_ids?: string[]   // ids responsables à notifier (vient du frontend après décocher manuels)
  subject: string
  body_html: string
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: callerRes } = await supabase
      .from('reservistes').select('role, prenom, nom').eq('user_id', user.id).single()
    if (!callerRes || !['superadmin', 'admin', 'coordonnateur'].includes(callerRes.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body: RequestBody = await req.json()
    const destIds = Array.isArray(body.destinataire_benevole_ids) ? body.destinataire_benevole_ids : []
    const respIdsRestriction = Array.isArray(body.responsable_benevole_ids) ? body.responsable_benevole_ids : null
    const subject = body.subject || ''
    const bodyHtml = body.body_html || ''

    if (destIds.length === 0 || !subject || !bodyHtml) {
      return NextResponse.json({ error: 'destinataire_benevole_ids, subject et body_html requis' }, { status: 400 })
    }

    // 1. Récupérer les destinataires (pour leurs noms et groupes R&S)
    const { data: dests } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, prenom, nom, email, groupe_recherche')
      .in('benevole_id', destIds)

    if (!dests || dests.length === 0) {
      return NextResponse.json({ envoyes: 0, message: 'Aucun destinataire trouvé' })
    }

    // 2. Identifier les groupes R&S représentés
    const { data: groupes } = await supabaseAdmin
      .from('groupes_recherche')
      .select('id, nom, district')
    const allGroupes = (groupes || []) as Array<{ id: string; nom: string; district: number }>
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    // Map groupe_id → destinataires du groupe
    const destsByGroupe = new Map<string, any[]>()
    for (const d of dests as any[]) {
      const txt = (d.groupe_recherche || '').trim()
      if (!txt) continue
      const txtN = norm(txt)
      for (const g of allGroupes) {
        const gN = norm(g.nom)
        if (txtN.includes(gN) || gN.includes(txtN)) {
          if (!destsByGroupe.has(g.id)) destsByGroupe.set(g.id, [])
          destsByGroupe.get(g.id)!.push(d)
        }
      }
    }

    if (destsByGroupe.size === 0) {
      return NextResponse.json({ envoyes: 0, message: 'Aucun groupe R&S représenté' })
    }

    // 3. Trouver les responsables (avec flag recoit_cc_courriels)
    const groupeIds = Array.from(destsByGroupe.keys())
    const { data: liens } = await supabaseAdmin
      .from('groupes_recherche_responsables')
      .select('groupe_id, benevole_id, recoit_cc_courriels')
      .in('groupe_id', groupeIds)
      .eq('recoit_cc_courriels', true)

    if (!liens || liens.length === 0) {
      return NextResponse.json({ envoyes: 0, message: 'Aucun responsable à notifier' })
    }

    // Si restriction (admin a décoché certains), on filtre
    let liensFiltres = liens as any[]
    if (respIdsRestriction !== null) {
      liensFiltres = liensFiltres.filter(l => respIdsRestriction.includes(l.benevole_id))
    }

    // Exclure les responsables qui sont eux-mêmes destinataires (ils ont déjà reçu l'original)
    liensFiltres = liensFiltres.filter(l => !destIds.includes(l.benevole_id))

    if (liensFiltres.length === 0) {
      return NextResponse.json({ envoyes: 0, message: 'Aucun responsable à notifier (après filtres)' })
    }

    // 4. Récupérer infos des responsables
    const respBenevoleIds = Array.from(new Set(liensFiltres.map(l => l.benevole_id)))
    const { data: respData } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, prenom, nom, email')
      .in('benevole_id', respBenevoleIds)
    const respMap = Object.fromEntries((respData || []).map((r: any) => [r.benevole_id, r]))
    const groupeMap = Object.fromEntries(allGroupes.map(g => [g.id, g]))

    // 5. Grouper par responsable : un responsable peut superviser plusieurs groupes
    //    représentés. On envoie UN seul courriel par responsable, agrégeant tous
    //    ses groupes et les destinataires de chacun.
    interface AgregeRow {
      benevole_id: string
      email: string
      prenom: string
      nom: string
      groupes: Array<{ nom: string; district: number; destinataires: any[] }>
    }
    const agrege = new Map<string, AgregeRow>()
    for (const l of liensFiltres) {
      const r = respMap[l.benevole_id]
      if (!r || !r.email) continue
      const g = groupeMap[l.groupe_id]
      if (!g) continue
      const membresDuGroupe = destsByGroupe.get(g.id) || []
      if (membresDuGroupe.length === 0) continue
      if (!agrege.has(r.benevole_id)) {
        agrege.set(r.benevole_id, {
          benevole_id: r.benevole_id,
          email: r.email,
          prenom: r.prenom,
          nom: r.nom,
          groupes: [],
        })
      }
      agrege.get(r.benevole_id)!.groupes.push({
        nom: g.nom,
        district: g.district,
        destinataires: membresDuGroupe,
      })
    }

    // 6. Config d'envoi
    const { data: config } = await supabaseAdmin
      .from('admin_email_config')
      .select('*')
      .eq('user_id', user.id)
      .single()
    const fromName = (config as any)?.from_name || 'RIUSC'
    const fromEmail = (config as any)?.from_email || `noreply@${process.env.RESEND_FROM_DOMAIN || 'aqbrs.ca'}`
    const replyTo = (config as any)?.reply_to || fromEmail
    const from = `${fromName} <${fromEmail}>`

    const expediteurNom = `${callerRes.prenom} ${callerRes.nom}`

    // 7. Envoyer un résumé à chaque responsable
    const escapeHtml = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
    }[c]!))

    let envoyes = 0, echoues = 0
    const erreurs: string[] = []

    for (const resp of agrege.values()) {
      const totalMembres = resp.groupes.reduce((s, g) => s + g.destinataires.length, 0)
      const nbGroupes = resp.groupes.length

      const listeGroupesHtml = resp.groupes.map(g => {
        const membresHtml = g.destinataires.map(d => {
          const nomComplet = escapeHtml(`${d.prenom || ''} ${d.nom || ''}`.trim() || d.email)
          const emailHtml = d.email ? ` <span style="color:#6b7280">&lt;${escapeHtml(d.email)}&gt;</span>` : ''
          return `<li>${nomComplet}${emailHtml}</li>`
        }).join('')
        return `
          <div style="margin:16px 0;">
            <div style="font-weight:600;color:#1e3a5f;margin-bottom:6px;">
              ${escapeHtml(g.nom)} <span style="font-size:12px;color:#6b7280;font-weight:400">(${g.destinataires.length} membre${g.destinataires.length > 1 ? 's' : ''})</span>
            </div>
            <ul style="margin:0;padding-left:22px;font-size:14px;color:#374151;line-height:1.6">
              ${membresHtml}
            </ul>
          </div>
        `
      }).join('')

      const sujetResume = `[Résumé] ${subject}`
      const corpsResume = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;max-width:640px">
          <p>Bonjour ${escapeHtml(resp.prenom)},</p>

          <p>
            En tant que responsable de
            ${nbGroupes > 1 ? `${nbGroupes} groupes` : `ton groupe`}
            de recherche et sauvetage, voici un résumé du courriel envoyé
            par <strong>${escapeHtml(expediteurNom)}</strong> à
            <strong>${totalMembres} membre${totalMembres > 1 ? 's' : ''}</strong>
            de ton/tes groupe${nbGroupes > 1 ? 's' : ''}.
          </p>

          <div style="background:#f8fafc;border-left:3px solid #7c3aed;padding:12px 16px;border-radius:6px;margin:16px 0;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">
              🎖️ Membres de ton groupe qui ont reçu ce courriel
            </div>
            ${listeGroupesHtml}
          </div>

          <p style="margin-top:24px;color:#64748b;font-size:13px">
            Le contenu original du courriel est ci-dessous à titre informatif.
            Tu peux consulter l'état des disponibilités de tes membres en tout
            temps via la page <a href="https://portail.riusc.ca/mon-groupe" style="color:#1e3a5f;font-weight:600">Mon groupe R&amp;S</a> du portail.
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>

          <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">
            Contenu original — objet : ${escapeHtml(subject)}
          </div>
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
            ${bodyHtml}
          </div>

          <p style="margin-top:20px;font-size:11px;color:#94a3b8">
            Ce résumé vous est envoyé automatiquement parce que vous êtes responsable
            d'un groupe R&amp;S dont un ou plusieurs membres ont été contactés.
            Pour ne plus recevoir ces résumés, contactez un administrateur.
          </p>
        </div>
      `

      try {
        await resend.emails.send({
          from,
          to: resp.email,
          replyTo,
          subject: sujetResume,
          html: corpsResume,
        })
        envoyes++
      } catch (e: any) {
        echoues++
        erreurs.push(`${resp.email}: ${e?.message || 'erreur inconnue'}`)
      }
    }

    return NextResponse.json({
      envoyes,
      echoues,
      responsables_notifies: Array.from(agrege.values()).map(r => ({
        prenom: r.prenom, nom: r.nom, email: r.email,
        nb_groupes: r.groupes.length,
      })),
      ...(erreurs.length > 0 ? { erreurs } : {}),
    })
  } catch (err: any) {
    console.error('resume-responsables:', err)
    return NextResponse.json({ error: err?.message || 'Erreur interne' }, { status: 500 })
  }
}
