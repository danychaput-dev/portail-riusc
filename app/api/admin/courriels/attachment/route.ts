// app/api/admin/courriels/attachment/route.ts
// Proxy pour télécharger les pièces jointes des courriels inbound via Resend API
// Resend retourne un download_url (CDN signé) pour chaque attachment, pas du base64
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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

    // Stratégie 1 : Lister les attachments → récupérer le download_url signé
    console.log(`📎 Liste attachments pour emailId=${emailId}`)
    try {
      const listResp = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      })

      if (listResp.ok) {
        const listData = await listResp.json()
        const attachments = listData.data || listData.attachments || listData || []

        if (Array.isArray(attachments)) {
          // Trouver la pièce jointe par ID ou par nom
          const att = attachments.find((a: any) => a.id === attachmentId)
            || attachments.find((a: any) => a.filename === filename)
            || attachments[0] // fallback: prendre la première si une seule

          if (att) {
            // Option A : download_url existe → proxy le fichier depuis le CDN
            if (att.download_url) {
              console.log(`📎 Proxy CDN download_url pour ${att.filename}`)
              const cdnResp = await fetch(att.download_url)
              if (cdnResp.ok) {
                const buffer = Buffer.from(await cdnResp.arrayBuffer())
                return new NextResponse(buffer, {
                  headers: {
                    'Content-Type': att.content_type || contentType,
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename || filename)}"`,
                    'Content-Length': String(buffer.length),
                  },
                })
              }
              console.error(`❌ CDN download failed: HTTP ${cdnResp.status}`)
            }

            // Option B : content base64 inline (au cas où certains l'auraient)
            if (att.content) {
              const buffer = Buffer.from(att.content, 'base64')
              return new NextResponse(buffer, {
                headers: {
                  'Content-Type': att.content_type || contentType,
                  'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename || filename)}"`,
                  'Content-Length': String(buffer.length),
                },
              })
            }

            // Option C : endpoint individuel pour cet attachment
            if (att.id) {
              console.log(`📎 Fetch individuel attachment id=${att.id}`)
              const attResp = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments/${att.id}`, {
                headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
              })
              if (attResp.ok) {
                const attJson = await attResp.json()
                // Vérifier download_url dans la réponse individuelle aussi
                if (attJson.download_url) {
                  const cdnResp2 = await fetch(attJson.download_url)
                  if (cdnResp2.ok) {
                    const buffer = Buffer.from(await cdnResp2.arrayBuffer())
                    return new NextResponse(buffer, {
                      headers: {
                        'Content-Type': attJson.content_type || contentType,
                        'Content-Disposition': `attachment; filename="${encodeURIComponent(attJson.filename || filename)}"`,
                        'Content-Length': String(buffer.length),
                      },
                    })
                  }
                }
                if (attJson.content) {
                  const buffer = Buffer.from(attJson.content, 'base64')
                  return new NextResponse(buffer, {
                    headers: {
                      'Content-Type': attJson.content_type || contentType,
                      'Content-Disposition': `attachment; filename="${encodeURIComponent(attJson.filename || filename)}"`,
                      'Content-Length': String(buffer.length),
                    },
                  })
                }
              }
            }

            console.error(`📎 Attachment trouvé mais aucune méthode de téléchargement n'a fonctionné:`, JSON.stringify(att).slice(0, 500))
          } else {
            console.error(`📎 Pièce jointe non trouvée parmi ${attachments.length} disponibles`)
          }
        }
      } else {
        const errText = await listResp.text().catch(() => '')
        console.error(`❌ Liste attachments: HTTP ${listResp.status}`, errText.slice(0, 300))
      }
    } catch (err) {
      console.error(`❌ Exception attachments:`, err)
    }

    return NextResponse.json({
      error: 'Impossible de télécharger la pièce jointe. Vérifiez que le courriel est toujours disponible dans Resend.',
    }, { status: 404 })
  } catch (err: any) {
    console.error('Erreur téléchargement pièce jointe:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
