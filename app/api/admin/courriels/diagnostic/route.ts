// app/api/admin/courriels/diagnostic/route.ts
// Endpoint de diagnostic pour tester l'API Resend Receiving
// Appeler dans le navigateur : /api/admin/courriels/diagnostic
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

export async function GET(req: NextRequest) {
  try {
    // Auth — admin seulement
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
    if (!res || res.role !== 'admin') return NextResponse.json({ error: 'Admin requis' }, { status: 403 })

    const results: Record<string, any> = {}

    // 1) Lister les dernières réponses en DB
    const { data: reponses, error: dbErr } = await supabaseAdmin
      .from('courriel_reponses')
      .select('id, courriel_id, resend_email_id, from_email, subject, body_html, body_text, pieces_jointes, statut, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    results.db_reponses = reponses?.map(r => ({
      id: r.id,
      resend_email_id: r.resend_email_id,
      from_email: r.from_email,
      subject: r.subject,
      has_body_html: !!r.body_html,
      body_html_length: r.body_html?.length || 0,
      has_body_text: !!r.body_text,
      body_text_length: r.body_text?.length || 0,
      body_text_preview: r.body_text?.slice(0, 100) || null,
      body_html_preview: r.body_html?.slice(0, 100) || null,
      pieces_jointes_count: r.pieces_jointes?.length || 0,
      pieces_jointes: r.pieces_jointes,
      statut: r.statut,
      created_at: r.created_at,
    }))
    results.db_error = dbErr?.message || null

    // 2) Pour la réponse la plus récente avec un resend_email_id, tester l'API Resend
    const testReponse = reponses?.find(r => r.resend_email_id)
    if (testReponse?.resend_email_id) {
      const emailId = testReponse.resend_email_id

      // Test SDK receiving.get
      try {
        const { data: sdkData, error: sdkErr } = await resend.emails.receiving.get(emailId)
        if (sdkErr) {
          results.sdk_receiving_get = { error: sdkErr }
        } else {
          const d = sdkData as any
          results.sdk_receiving_get = {
            keys: d ? Object.keys(d) : null,
            has_html: !!d?.html,
            html_length: d?.html?.length || 0,
            html_preview: d?.html?.slice(0, 200) || null,
            has_text: !!d?.text,
            text_length: d?.text?.length || 0,
            text_preview: d?.text?.slice(0, 200) || null,
            attachments_count: d?.attachments?.length || 0,
            attachments: d?.attachments?.map((a: any) => ({ id: a.id, filename: a.filename, content_type: a.content_type, has_content: !!a.content })),
          }
        }
      } catch (e: any) {
        results.sdk_receiving_get = { exception: e.message }
      }

      // Test fetch brut /emails/receiving/{id}
      try {
        const resp = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        })
        const body = await resp.text()
        if (resp.ok) {
          const d = JSON.parse(body)
          results.fetch_receiving = {
            status: resp.status,
            keys: Object.keys(d),
            has_html: !!d.html,
            html_length: d.html?.length || 0,
            html_preview: d.html?.slice(0, 200) || null,
            has_text: !!d.text,
            text_length: d.text?.length || 0,
            text_preview: d.text?.slice(0, 200) || null,
            attachments_count: d.attachments?.length || 0,
            attachments: d.attachments?.map((a: any) => ({ id: a.id, filename: a.filename, content_type: a.content_type, has_content: !!a.content })),
          }
        } else {
          results.fetch_receiving = { status: resp.status, error: body.slice(0, 500) }
        }
      } catch (e: any) {
        results.fetch_receiving = { exception: e.message }
      }

      // Test fetch brut /emails/{id}
      try {
        const resp = await fetch(`https://api.resend.com/emails/${emailId}`, {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        })
        const body = await resp.text()
        if (resp.ok) {
          const d = JSON.parse(body)
          results.fetch_emails = {
            status: resp.status,
            keys: Object.keys(d),
            has_html: !!d.html,
            html_length: d.html?.length || 0,
            has_text: !!d.text,
          }
        } else {
          results.fetch_emails = { status: resp.status, error: body.slice(0, 500) }
        }
      } catch (e: any) {
        results.fetch_emails = { exception: e.message }
      }

      // Test attachments list
      if (testReponse.pieces_jointes?.length > 0) {
        try {
          const resp = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments`, {
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          })
          const body = await resp.text()
          results.fetch_attachments_list = {
            status: resp.status,
            body_preview: body.slice(0, 500),
          }

          // Si la liste fonctionne, essayer de fetch un attachment individuel
          if (resp.ok) {
            const list = JSON.parse(body)
            const items = list.data || list.attachments || list || []
            if (Array.isArray(items) && items.length > 0 && items[0].id) {
              const attResp = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments/${items[0].id}`, {
                headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
              })
              const attBody = await attResp.text()
              results.fetch_attachment_single = {
                status: attResp.status,
                body_length: attBody.length,
                body_preview: attBody.slice(0, 200),
                has_content: attBody.includes('"content"'),
              }
            }
          }
        } catch (e: any) {
          results.fetch_attachments_list = { exception: e.message }
        }
      }

      results.tested_email_id = emailId
    } else {
      results.note = 'Aucune réponse avec resend_email_id trouvée en DB'
    }

    // 3) Vérifier la config
    results.config = {
      has_resend_api_key: !!process.env.RESEND_API_KEY,
      resend_api_key_prefix: process.env.RESEND_API_KEY?.slice(0, 10) + '...',
    }

    return NextResponse.json(results, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
