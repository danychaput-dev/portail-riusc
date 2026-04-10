// app/api/admin/courriels/backfill-body/route.ts
// Endpoint pour re-récupérer le body des réponses qui ont un resend_email_id mais pas de body
// À utiliser APRÈS avoir mis à jour la clé API Resend avec les permissions receiving
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

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

    const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
    if (!res || !['superadmin', 'admin'].includes(res.role)) return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

    // Trouver les réponses sans body mais avec un resend_email_id
    const { data: reponses, error } = await supabaseAdmin
      .from('courriel_reponses')
      .select('id, resend_email_id, raw_payload')
      .not('resend_email_id', 'is', null)
      .is('body_html', null)
      .is('body_text', null)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!reponses || reponses.length === 0) {
      return NextResponse.json({ message: 'Aucune réponse sans body à traiter', updated: 0 })
    }

    const results: any[] = []

    for (const rep of reponses) {
      let html: string | null = null
      let text: string | null = null

      // 1) Essayer de récupérer depuis le raw_payload d'abord
      if (rep.raw_payload) {
        const rp = rep.raw_payload
        html = rp.html || rp.body_html || rp.body || rp.content?.html || null
        text = rp.text || rp.body_text || rp.content?.text || rp.plain_text || null
      }

      // 2) Si pas trouvé dans le payload, essayer l'API Resend
      if (!html && !text && rep.resend_email_id) {
        try {
          const { data: emailData, error: sdkError } = await resend.emails.receiving.get(rep.resend_email_id)
          if (!sdkError && emailData) {
            html = (emailData as any).html || null
            text = (emailData as any).text || null
          }
        } catch {}

        // Fallback fetch
        if (!html && !text) {
          try {
            const resp = await fetch(`https://api.resend.com/emails/receiving/${rep.resend_email_id}`, {
              headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
            })
            if (resp.ok) {
              const d = await resp.json()
              html = d.html || null
              text = d.text || null
            }
          } catch {}
        }
      }

      if (html || text) {
        const { error: updError } = await supabaseAdmin
          .from('courriel_reponses')
          .update({ body_html: html, body_text: text })
          .eq('id', rep.id)

        results.push({ id: rep.id, resend_email_id: rep.resend_email_id, updated: !updError, html_length: html?.length || 0, text_length: text?.length || 0 })
      } else {
        results.push({ id: rep.id, resend_email_id: rep.resend_email_id, updated: false, reason: 'no content found' })
      }
    }

    const updated = results.filter(r => r.updated).length
    return NextResponse.json({ total: reponses.length, updated, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
