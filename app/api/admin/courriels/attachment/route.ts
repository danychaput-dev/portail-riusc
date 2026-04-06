// app/api/admin/courriels/attachment/route.ts
// Proxy pour télécharger les pièces jointes des courriels inbound via Resend API
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
    const filename = searchParams.get('filename') || 'fichier'
    const contentType = searchParams.get('content_type') || 'application/octet-stream'

    if (!emailId) {
      return NextResponse.json({ error: 'email_id requis' }, { status: 400 })
    }

    // Récupérer l'email inbound complet via Resend API (inclut les pièces jointes)
    const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error(`Erreur fetch inbound email ${emailId}: HTTP ${response.status}`, errorText)
      return NextResponse.json({ error: `Resend API error: ${response.status}` }, { status: 502 })
    }

    const data = await response.json()

    // Chercher la pièce jointe par nom de fichier
    const attachments = data.attachments || []
    const att = attachments.find((a: any) => a.filename === filename)

    if (!att) {
      // Si pas trouvé par nom exact, prendre la première qui contient le nom
      const attFuzzy = attachments.find((a: any) => a.filename?.includes(filename) || filename.includes(a.filename))
      if (!attFuzzy) {
        return NextResponse.json({
          error: 'Pièce jointe non trouvée',
          available: attachments.map((a: any) => a.filename),
        }, { status: 404 })
      }
      // Utiliser la pièce jointe trouvée en fuzzy
      const content = attFuzzy.content
      if (!content) {
        return NextResponse.json({ error: 'Contenu de la pièce jointe vide' }, { status: 404 })
      }
      const buffer = Buffer.from(content, 'base64')
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': attFuzzy.content_type || contentType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(attFuzzy.filename || filename)}"`,
          'Content-Length': String(buffer.length),
        },
      })
    }

    // Décoder le contenu base64
    const content = att.content
    if (!content) {
      return NextResponse.json({ error: 'Contenu de la pièce jointe vide' }, { status: 404 })
    }

    const buffer = Buffer.from(content, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': att.content_type || contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename || filename)}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err: any) {
    console.error('Erreur téléchargement pièce jointe:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
