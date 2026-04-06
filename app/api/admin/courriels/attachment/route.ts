// app/api/admin/courriels/attachment/route.ts
// Proxy pour télécharger les pièces jointes des courriels inbound via Resend API
// Utilise GET /emails/receiving/{emailId}/attachments pour lister puis télécharger
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const emailId = searchParams.get('email_id')
    const attachmentId = searchParams.get('attachment_id')
    const filename = searchParams.get('filename') || 'fichier'
    const contentType = searchParams.get('content_type') || 'application/octet-stream'

    if (!emailId) {
      return NextResponse.json({ error: 'email_id requis' }, { status: 400 })
    }

    // Stratégie 1 : si on a l'attachment_id, télécharger directement via SDK
    if (attachmentId) {
      console.log(`📎 Téléchargement direct: emailId=${emailId}, attachmentId=${attachmentId}`)
      try {
        const { data: attData, error: attError } = await resend.emails.receiving.attachments.get({
          emailId,
          id: attachmentId,
        })

        if (attError) {
          console.error(`❌ SDK attachments.get error:`, attError)
        } else if (attData) {
          const content = (attData as any).content
          if (content) {
            const buffer = Buffer.from(content, 'base64')
            return new NextResponse(buffer, {
              headers: {
                'Content-Type': (attData as any).content_type || contentType,
                'Content-Disposition': `attachment; filename="${encodeURIComponent((attData as any).filename || filename)}"`,
                'Content-Length': String(buffer.length),
              },
            })
          }
        }
      } catch (err) {
        console.error(`❌ SDK attachments.get exception:`, err)
      }
    }

    // Stratégie 2 : lister les pièces jointes et trouver par filename
    console.log(`📎 Liste attachments pour emailId=${emailId}`)
    try {
      // Essayer via l'API brute (le SDK pourrait ne pas retourner le contenu dans list)
      const listResp = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      })

      if (listResp.ok) {
        const listData = await listResp.json()
        const attachments = listData.data || listData.attachments || listData || []
        console.log(`📎 ${Array.isArray(attachments) ? attachments.length : 'non-array'} attachments trouvés`)

        // Trouver la pièce jointe par nom ou par ID
        const att = Array.isArray(attachments)
          ? attachments.find((a: any) => a.filename === filename || a.id === attachmentId)
            || attachments.find((a: any) => a.filename?.includes(filename) || filename.includes(a.filename))
          : null

        if (att && att.id) {
          // Télécharger le contenu via l'endpoint individuel
          console.log(`📎 Téléchargement attachment id=${att.id}`)
          const attResp = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments/${att.id}`, {
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          })

          if (attResp.ok) {
            const attJson = await attResp.json()
            const content = attJson.content
            if (content) {
              const buffer = Buffer.from(content, 'base64')
              return new NextResponse(buffer, {
                headers: {
                  'Content-Type': attJson.content_type || att.content_type || contentType,
                  'Content-Disposition': `attachment; filename="${encodeURIComponent(attJson.filename || att.filename || filename)}"`,
                  'Content-Length': String(buffer.length),
                },
              })
            }
            console.error(`📎 Attachment trouvé mais contenu vide`, JSON.stringify(attJson).slice(0, 300))
          } else {
            console.error(`❌ Fetch attachment ${att.id}: HTTP ${attResp.status}`)
          }
        } else {
          console.error(`📎 Pièce jointe non trouvée. Disponibles:`, JSON.stringify(attachments).slice(0, 500))
        }
      } else {
        console.error(`❌ Liste attachments: HTTP ${listResp.status}`, await listResp.text().catch(() => ''))
      }
    } catch (err) {
      console.error(`❌ Exception liste/download attachments:`, err)
    }

    // Stratégie 3 fallback : récupérer l'email complet (le content pourrait être inline)
    console.log(`📎 Fallback: récupérer email complet pour trouver attachment`)
    try {
      const { data: emailData } = await resend.emails.receiving.get(emailId)
      if (emailData) {
        const attachments = (emailData as any).attachments || []
        const att = attachments.find((a: any) => a.filename === filename || a.id === attachmentId)
        if (att?.content) {
          const buffer = Buffer.from(att.content, 'base64')
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': att.content_type || contentType,
              'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename || filename)}"`,
              'Content-Length': String(buffer.length),
            },
          })
        }
      }
    } catch {}

    return NextResponse.json({
      error: 'Impossible de télécharger la pièce jointe. Vérifiez que le courriel est toujours disponible dans Resend.',
    }, { status: 404 })
  } catch (err: any) {
    console.error('Erreur téléchargement pièce jointe:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
