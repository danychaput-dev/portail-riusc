import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// Service role pour Storage privé + write formations_benevoles
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Auth : vérifier que l'utilisateur est connecté
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })

    // Vérifier que le benevole_id appartient bien à l'utilisateur connecté (ou admin)
    const { data: currentRes } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, role')
      .eq('user_id', user.id)
      .single()

    const body = await req.json()
    const { benevole_id, file_name, file_base64, nom_complet, formation_id, storage_path } = body

    // Sécurité : le réserviste ne peut uploader que pour lui-même (sauf admin)
    const isAdmin = currentRes && ['admin', 'coordonnateur'].includes(currentRes.role)
    if (!isAdmin && currentRes?.benevole_id !== benevole_id) {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
    }

    // --- Mode 1 : fichier déjà uploadé en Storage, juste mettre à jour la DB ---
    if (storage_path) {
      const certPath = 'storage:' + storage_path

      if (formation_id) {
        // Update la formation existante
        const { error: updateErr } = await supabaseAdmin
          .from('formations_benevoles')
          .update({
            certificat_url: certPath,
            updated_at: new Date().toISOString(),
          })
          .eq('id', formation_id)
          .eq('benevole_id', benevole_id)

        if (updateErr) {
          console.error('Erreur update formation:', updateErr)
          return NextResponse.json(
            { success: false, error: 'Erreur lors de la mise à jour du certificat' },
            { status: 500 }
          )
        }
      } else {
        // Flow "S'initier" (legacy)
        let nomComplet = nom_complet
        if (!nomComplet) {
          const { data: res } = await supabaseAdmin
            .from('reservistes')
            .select('prenom, nom')
            .eq('benevole_id', benevole_id)
            .maybeSingle()
          if (res) nomComplet = `${res.prenom} ${res.nom}`.trim()
        }

        const today = new Date().toISOString().split('T')[0]

        const { data: existing } = await supabaseAdmin
          .from('formations_benevoles')
          .select('id')
          .eq('benevole_id', benevole_id)
          .eq('nom_formation', "S'initier à la sécurité civile")
          .maybeSingle()

        if (existing) {
          await supabaseAdmin
            .from('formations_benevoles')
            .update({
              certificat_url: certPath,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await supabaseAdmin
            .from('formations_benevoles')
            .insert({
              benevole_id,
              nom_complet: nomComplet || '',
              nom_formation: "S'initier à la sécurité civile",
              date_reussite: today,
              resultat: 'Réussi',
              role: 'Participant',
              source: 'portail',
              certificat_url: certPath,
            })
        }
      }

      return NextResponse.json({ success: true, certificat_url: certPath, storage_path })
    }

    // --- Mode 2 : legacy base64 (rétrocompatibilité) ---
    if (!benevole_id || !file_name || !file_base64) {
      return NextResponse.json(
        { success: false, error: 'benevole_id, file_name et file_base64 sont requis' },
        { status: 400 }
      )
    }

    // Détecter le type MIME
    const ext = file_name.toLowerCase().split('.').pop() || 'pdf'
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    // Upload vers Supabase Storage
    const uuid = crypto.randomUUID()
    const storagePath = `${benevole_id}/${uuid}.${ext}`
    const buffer = Buffer.from(file_base64, 'base64')

    const { error: uploadError } = await supabaseAdmin.storage
      .from('certificats')
      .upload(storagePath, buffer, { contentType, upsert: false })

    if (uploadError) {
      console.error('Erreur Storage upload:', uploadError)
      return NextResponse.json(
        { success: false, error: "Erreur lors de l'upload du fichier" },
        { status: 500 }
      )
    }

    const certPath = 'storage:' + storagePath

    if (formation_id) {
      const { error: updateErr } = await supabaseAdmin
        .from('formations_benevoles')
        .update({
          certificat_url: certPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', formation_id)
        .eq('benevole_id', benevole_id)

      if (updateErr) {
        console.error('Erreur update formation:', updateErr)
        return NextResponse.json(
          { success: false, error: 'Erreur lors de la mise à jour du certificat' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, certificat_url: certPath, storage_path: storagePath })
    }

    // Flow "S'initier" (legacy base64)
    let nomComplet = nom_complet
    if (!nomComplet) {
      const { data: res } = await supabaseAdmin
        .from('reservistes')
        .select('prenom, nom')
        .eq('benevole_id', benevole_id)
        .maybeSingle()
      if (res) nomComplet = `${res.prenom} ${res.nom}`.trim()
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: existing } = await supabaseAdmin
      .from('formations_benevoles')
      .select('id')
      .eq('benevole_id', benevole_id)
      .eq('nom_formation', "S'initier à la sécurité civile")
      .maybeSingle()

    if (existing) {
      await supabaseAdmin
        .from('formations_benevoles')
        .update({
          certificat_url: certPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabaseAdmin
        .from('formations_benevoles')
        .insert({
          benevole_id,
          nom_complet: nomComplet || '',
          nom_formation: "S'initier à la sécurité civile",
          date_reussite: today,
          resultat: 'Réussi',
          role: 'Participant',
          source: 'portail',
          certificat_url: certPath,
        })
    }

    return NextResponse.json({ success: true, certificat_url: certPath, storage_path: storagePath })
  } catch (error: any) {
    console.error('Erreur upload certificat:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
