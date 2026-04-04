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

    const { destinataires, subject, body_html, campagne_nom } = await req.json()

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

    // Envoyer à chaque destinataire
    const resultats: { benevole_id: string; ok: boolean; error?: string }[] = []

    for (const dest of destinataires) {
      try {
        // Remplacer les variables
        let html = body_html
          .replace(/\{\{\s*prenom\s*\}\}/gi, dest.prenom || '')
          .replace(/\{\{\s*nom\s*\}\}/gi, dest.nom || '')

        // Ajouter la signature
        if (signature) {
          html += `<br/><br/>--<br/>${signature}`
        }

        // Envoyer via Resend
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [dest.email],
          subject,
          html,
          replyTo: config?.reply_to || fromEmail,
        })

        if (emailError) {
          resultats.push({ benevole_id: dest.benevole_id, ok: false, error: emailError.message })
          // Insérer quand même dans la table avec statut failed
          await supabaseAdmin.from('courriels').insert({
            campagne_id,
            benevole_id: dest.benevole_id,
            from_email: fromEmail,
            from_name: fromName,
            to_email: dest.email,
            subject,
            body_html: html,
            statut: 'failed',
            envoye_par: user.id,
          })
          continue
        }

        // Succès — insérer dans la table
        await supabaseAdmin.from('courriels').insert({
          campagne_id,
          benevole_id: dest.benevole_id,
          from_email: fromEmail,
          from_name: fromName,
          to_email: dest.email,
          subject,
          body_html: html,
          resend_id: emailData?.id || null,
          statut: 'sent',
          envoye_par: user.id,
        })

        resultats.push({ benevole_id: dest.benevole_id, ok: true })
      } catch (err: any) {
        resultats.push({ benevole_id: dest.benevole_id, ok: false, error: err.message })
      }
    }

    const envoyes = resultats.filter(r => r.ok).length
    const echoues = resultats.filter(r => !r.ok).length

    return NextResponse.json({ ok: true, envoyes, echoues, resultats, campagne_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
