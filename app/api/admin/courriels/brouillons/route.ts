// app/api/admin/courriels/brouillons/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'brouillons-fichiers'

async function getAuthAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
  if (!res || !['admin', 'coordonnateur'].includes(res.role)) return null
  return user
}

interface AttachmentMeta {
  filename: string
  storage_path: string
  size: number
}

// GET — Lister mes brouillons
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    // Check if requesting a single brouillon with attachments
    const brouillonId = req.nextUrl.searchParams.get('id')

    if (brouillonId) {
      // Charger un brouillon spécifique avec ses fichiers en base64
      const { data: brouillon, error } = await supabaseAdmin
        .from('brouillons_courriels')
        .select('id, subject, body_html, destinataires, pieces_jointes, updated_at')
        .eq('id', brouillonId)
        .eq('user_id', admin.id)
        .single()
      if (error || !brouillon) return NextResponse.json({ error: 'Brouillon non trouvé' }, { status: 404 })

      // Télécharger les fichiers depuis Storage
      const pj: AttachmentMeta[] = brouillon.pieces_jointes || []
      const fichiers = []
      for (const att of pj) {
        const { data: fileData } = await supabaseAdmin.storage.from(BUCKET).download(att.storage_path)
        if (fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer())
          fichiers.push({
            filename: att.filename,
            base64: buffer.toString('base64'),
            size: att.size,
          })
        }
      }
      return NextResponse.json({ brouillon, fichiers })
    }

    // Liste de tous les brouillons (sans télécharger les fichiers)
    const { data, error } = await supabaseAdmin
      .from('brouillons_courriels')
      .select('id, subject, body_html, destinataires, pieces_jointes, updated_at')
      .eq('user_id', admin.id)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ brouillons: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — Sauvegarder un brouillon (upsert) avec fichiers
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { id, subject, body_html, destinataires, attachments } = await req.json()
    // attachments: [{ filename, base64, size }] ou undefined

    // Upload fichiers vers Storage
    const pjMeta: AttachmentMeta[] = []
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const path = `${admin.id}/${Date.now()}-${att.filename}`
        const buffer = Buffer.from(att.base64, 'base64')
        const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
          contentType: 'application/octet-stream',
          upsert: false,
        })
        if (!upErr) {
          pjMeta.push({ filename: att.filename, storage_path: path, size: att.size || buffer.length })
        }
      }
    }

    if (id) {
      // Supprimer les anciens fichiers du Storage si on met à jour
      const { data: existing } = await supabaseAdmin
        .from('brouillons_courriels')
        .select('pieces_jointes')
        .eq('id', id)
        .eq('user_id', admin.id)
        .single()
      if (existing?.pieces_jointes) {
        const oldPaths = (existing.pieces_jointes as AttachmentMeta[]).map(p => p.storage_path)
        if (oldPaths.length > 0) await supabaseAdmin.storage.from(BUCKET).remove(oldPaths)
      }

      const { data, error } = await supabaseAdmin
        .from('brouillons_courriels')
        .update({ subject, body_html, destinataires, pieces_jointes: pjMeta, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', admin.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, brouillon: data })
    } else {
      const { data, error } = await supabaseAdmin
        .from('brouillons_courriels')
        .insert({ user_id: admin.id, subject, body_html, destinataires, pieces_jointes: pjMeta })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, brouillon: data })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — Supprimer un brouillon + ses fichiers Storage
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    // Supprimer les fichiers du Storage
    const { data: brouillon } = await supabaseAdmin
      .from('brouillons_courriels')
      .select('pieces_jointes')
      .eq('id', id)
      .eq('user_id', admin.id)
      .single()
    if (brouillon?.pieces_jointes) {
      const paths = (brouillon.pieces_jointes as AttachmentMeta[]).map(p => p.storage_path)
      if (paths.length > 0) await supabaseAdmin.storage.from(BUCKET).remove(paths)
    }

    const { error } = await supabaseAdmin
      .from('brouillons_courriels')
      .delete()
      .eq('id', id)
      .eq('user_id', admin.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
