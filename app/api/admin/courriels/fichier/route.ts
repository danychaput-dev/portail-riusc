// app/api/admin/courriels/fichier/route.ts
// Route publique qui redirige vers une URL signee Supabase Storage
// Permet d'avoir un lien permanent dans les courriels (jamais d'expiration)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path requis' }, { status: 400 })

  // Generer une URL signee valide 1 heure (suffisant pour le telechargement immediat)
  const { data, error } = await supabaseAdmin.storage
    .from('certificats')
    .createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
  }

  // Rediriger vers l'URL signee
  return NextResponse.redirect(data.signedUrl)
}
