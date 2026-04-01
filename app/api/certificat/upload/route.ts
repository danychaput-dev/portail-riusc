import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Service role — nécessaire pour Storage privé + insert formations_benevoles
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { benevole_id, file_name, file_base64, nom_complet } = body

    if (!benevole_id || !file_name || !file_base64) {
      return NextResponse.json(
        { success: false, error: 'benevole_id, file_name et file_base64 sont requis' },
        { status: 400 }
      )
    }

    // ── Détecter le type MIME ──────────────────────────────────────────────
    const ext = file_name.toLowerCase().split('.').pop() || 'pdf'
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    // ── Upload vers Supabase Storage ──────────────────────────────────────
    const uuid = crypto.randomUUID()
    const storagePath = `${benevole_id}/${uuid}.${ext}`
    const buffer = Buffer.from(file_base64, 'base64')

    const { error: uploadError } = await supabaseAdmin.storage
      .from('certificats')
      .upload(storagePath, buffer, { contentType, upsert: false })

    if (uploadError) {
      console.error('Erreur Storage upload:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de l\'upload du fichier' },
        { status: 500 }
      )
    }

    // ── Récupérer nom_complet si non fourni ───────────────────────────────
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

    // ── Vérifier si S'initier existe déjà ────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('formations_benevoles')
      .select('id')
      .eq('benevole_id', benevole_id)
      .eq('nom_formation', "S'initier à la sécurité civile")
      .maybeSingle()

    if (existing) {
      // Mettre à jour l'URL du certificat
      await supabaseAdmin
        .from('formations_benevoles')
        .update({
          certificat_url: storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      // Créer l'entrée S'initier
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
          certificat_url: storagePath,
        })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur upload certificat:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
