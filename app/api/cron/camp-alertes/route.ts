// app/api/cron/camp-alertes/route.ts
//
// Cron Vercel : alerte courriel 48h avant camp sur changements de presence.
//
// Remplace le workflow n8n "RIUSC - Alerte changements camp 48h" (2026-04-22).
// Motivation : Cloudflare Managed Challenge bloque systematiquement les appels
// de n8n (IPv6 OVH) vers les endpoints /api/admin/*. Au lieu de se battre avec
// les regles Cloudflare, on heberge directement le cron dans Vercel et on
// envoie les courriels via Resend SDK.
//
// Flux :
//   1. Vercel Cron (toutes les 5 min) -> GET /api/cron/camp-alertes
//   2. Auth : Bearer CRON_SECRET (injecte auto par Vercel) OU X-Api-Key
//      (ALERTE_CAMP_API_KEY pour tests manuels)
//   3. Query v_camp_changements_en_attente (changements non alertes dans
//      la fenetre -1j / +2j par rapport a camp_date_debut)
//   4. Pour chaque changement : envoi courriel HTML via Resend a
//      3 destinataires (SOPFEU, Esther, Dany)
//   5. UPDATE inscriptions_camps_logs.alerte_envoyee_at pour les log_ids
//      dont l'envoi a reussi.
//
// Configuration requise (env Vercel) :
//   - CRON_SECRET            : secret pour auth cron (genere auto par Vercel)
//   - RESEND_API_KEY         : clef API Resend (Full Access)
//   - RESEND_FROM_DOMAIN     : domaine expediteur (default aqbrs.ca)
//   - ALERTE_CAMP_API_KEY    : clef pour tests manuels (optionnel)
//
// Tests manuels :
//   curl -H "X-Api-Key: $ALERTE_CAMP_API_KEY" https://portail.riusc.ca/api/cron/camp-alertes
//
// Destinataires : hardcodes pour l'instant (correspondant a l'ancien workflow
// n8n). A migrer dans une table de config si besoin d'ajuster par camp.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

// Destinataires des alertes (prioritaires SOPFEU/AQBRS organisation camps)
const DESTINATAIRES_ALERTE = [
  'lgoulet@sopfeu.qc.ca',
  'esther.lapointe@aqbrs.ca',
  'dany.chaput@aqbrs.ca',
]

interface Changement {
  log_id: string
  inscription_id: string
  session_id: string
  benevole_id: string
  prenom_nom: string | null
  presence_avant: string | null
  presence_apres: string | null
  modifie_par: string | null
  changement_at: string
  reserviste_courriel: string | null
  camp_nom: string | null
  camp_dates_texte: string | null
  camp_date_debut: string | null
  camp_lieu: string | null
  heures_avant_camp: number | null
}

function verifierAuth(req: NextRequest): boolean {
  // 1. Auth Vercel Cron (Bearer CRON_SECRET)
  const authHeader = req.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true

  // 2. Auth manuelle / backward-compat (X-Api-Key)
  const apiKey = req.headers.get('x-api-key') || ''
  const alerteKey = process.env.ALERTE_CAMP_API_KEY
  if (alerteKey && apiKey === alerteKey) return true

  return false
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

// presence_avant = NULL signifie une nouvelle inscription (INSERT, pas UPDATE)
function isNouvelleInscription(c: Changement): boolean {
  return c.presence_avant === null || c.presence_avant === undefined
}

function buildSubject(c: Changement): string {
  const nom = c.prenom_nom || 'Reserviste'
  const camp = c.camp_nom || 'Camp'
  if (isNouvelleInscription(c)) {
    return `[RIUSC] Nouvelle inscription: ${nom} (${c.presence_apres || 'confirme'}) · ${camp}`
  }
  const av = c.presence_avant || '(vide)'
  const ap = c.presence_apres || '(vide)'
  return `[RIUSC] ${nom} : ${av} -> ${ap} · ${camp}`
}

function buildHtml(c: Changement): string {
  const heuresAvant = typeof c.heures_avant_camp === 'number'
    ? Math.round(c.heures_avant_camp)
    : null
  const nouvelle = isNouvelleInscription(c)
  const titre = nouvelle ? 'Nouvelle inscription au camp' : 'Changement d\'inscription camp'
  const bandeauSousTitre = heuresAvant !== null
    ? `A ${heuresAvant}h du debut du camp`
    : (nouvelle ? 'Nouveau participant' : 'Changement d\'inscription')

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,${nouvelle ? '#065f46 0%,#047857' : '#92400e 0%,#b45309'} 100%);padding:24px 32px;">
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${escapeHtml(titre)}</h1>
<p style="margin:4px 0 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${escapeHtml(bandeauSousTitre)}</p>
</td></tr>
<tr><td style="padding:24px 32px;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong style="color:#374151;">Reserviste :</strong> <span style="color:#111827;">${escapeHtml(c.prenom_nom)}</span></td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong style="color:#374151;">Courriel :</strong> ${c.reserviste_courriel ? `<a href="mailto:${escapeHtml(c.reserviste_courriel)}" style="color:#2563eb;">${escapeHtml(c.reserviste_courriel)}</a>` : '<em style="color:#9ca3af">non renseigne</em>'}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong style="color:#374151;">${nouvelle ? 'Statut initial' : 'Changement'} :</strong> ${nouvelle ? '' : `<code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;">${escapeHtml(c.presence_avant!)}</code> -> `}<code style="background:${nouvelle ? '#dcfce7' : '#fef3c7'};padding:2px 8px;border-radius:4px;">${escapeHtml(c.presence_apres || '(vide)')}</code></td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong style="color:#374151;">Camp :</strong> <span style="color:#111827;">${escapeHtml(c.camp_nom || 'Non specifie')}</span></td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong style="color:#374151;">Date debut :</strong> <span style="color:#111827;">${escapeHtml(c.camp_date_debut)}</span></td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong style="color:#374151;">Lieu :</strong> <span style="color:#111827;">${escapeHtml(c.camp_lieu) || '·'}</span></td></tr>
<tr><td style="padding:8px 0;"><strong style="color:#374151;">Heure du changement :</strong> <span style="color:#111827;">${escapeHtml(c.changement_at)}</span></td></tr>
</table>
<p style="margin:20px 0 0 0;color:#6b7280;font-size:13px;line-height:1.6;">Utiliser cette info pour ajuster les equipes et le nombre de repas. Voir la liste complete via le portail : <a href="https://portail.riusc.ca/admin/inscriptions-camps" style="color:#2563eb;">portail.riusc.ca/admin/inscriptions-camps</a></p>
</td></tr>
<tr><td style="background-color:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#9ca3af;font-size:11px;">Alerte automatique · fenetre 48h avant le camp · RIUSC</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export async function GET(req: NextRequest) {
  const started = Date.now()

  if (!verifierAuth(req)) {
    return NextResponse.json(
      { error: 'Non autorise (CRON_SECRET ou X-Api-Key requis)' },
      { status: 401 }
    )
  }

  // 1. Charger les changements en attente
  const { data: changements, error: fetchErr } = await supabaseAdmin
    .from('v_camp_changements_en_attente')
    .select('*')

  if (fetchErr) {
    console.error('[cron/camp-alertes] Erreur fetch vue:', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const items = (changements || []) as Changement[]
  if (items.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      envoyes: 0,
      echoues: 0,
      marked: 0,
      duree_ms: Date.now() - started,
    })
  }

  // 2. Config expediteur
  const fromDomain = process.env.RESEND_FROM_DOMAIN || 'aqbrs.ca'
  const from = `RIUSC Alerte camp <alerte@${fromDomain}>`
  const replyTo = `riusc@${fromDomain}`

  // 3. Envoyer un courriel par changement (parallelise par 5)
  const logIdsEnvoyes: string[] = []
  const erreurs: Array<{ log_id: string; error: string }> = []

  const CONCURRENCY = 5
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(batch.map(async c => {
      const subject = buildSubject(c)
      const html = buildHtml(c)
      const r = await resend.emails.send({
        from,
        to: DESTINATAIRES_ALERTE,
        replyTo,
        subject,
        html,
      })
      if (r.error) {
        throw new Error(r.error.message || r.error.name || 'Resend error')
      }
      return c.log_id
    }))
    results.forEach((r, idx) => {
      const c = batch[idx]
      if (r.status === 'fulfilled') {
        logIdsEnvoyes.push(c.log_id)
      } else {
        erreurs.push({
          log_id: c.log_id,
          error: r.reason?.message || String(r.reason || 'erreur inconnue'),
        })
      }
    })
  }

  // 4. Marquer les logs envoyes avec succes
  let marked = 0
  if (logIdsEnvoyes.length > 0) {
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('inscriptions_camps_logs')
      .update({ alerte_envoyee_at: new Date().toISOString() })
      .in('id', logIdsEnvoyes)
      .is('alerte_envoyee_at', null)
      .select('id')
    if (updErr) {
      console.error('[cron/camp-alertes] Erreur update logs:', updErr)
    } else {
      marked = (updated || []).length
    }
  }

  return NextResponse.json({
    success: true,
    count: items.length,
    envoyes: logIdsEnvoyes.length,
    echoues: erreurs.length,
    marked,
    duree_ms: Date.now() - started,
    ...(erreurs.length > 0 ? { erreurs } : {}),
  })
}
