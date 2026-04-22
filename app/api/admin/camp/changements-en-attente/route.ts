// app/api/admin/camp/changements-en-attente/route.ts
//
// Endpoint utilise par le cron n8n "RIUSC - Alerte changements camp 48h".
//
// GET : retourne les changements de presence non-encore alertes, pour les camps
//       dont la date_debut est dans les 48h (fenetre elargie pour couvrir les
//       changements survenus la veille du camp ou pendant le camp).
//
// POST : marque les logs comme alertes apres l'envoi du courriel.
//        Body: { log_ids: uuid[] }
//
// Securite: auth par header 'X-Api-Key' = ALERTE_CAMP_API_KEY (env var).
// Pas de login admin car c'est appele depuis un workflow n8n.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifierApiKey(req: NextRequest): boolean {
  const apiKey = req.headers.get('x-api-key')
  const expected = process.env.ALERTE_CAMP_API_KEY
  if (!expected) return false
  return apiKey === expected
}

export async function GET(req: NextRequest) {
  if (!verifierApiKey(req)) {
    return NextResponse.json({ error: 'X-Api-Key manquante ou invalide' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('v_camp_changements_en_attente')
    .select('*')

  if (error) {
    console.error('Erreur fetch changements:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    count: (data || []).length,
    changements: data || [],
  })
}

export async function POST(req: NextRequest) {
  if (!verifierApiKey(req)) {
    return NextResponse.json({ error: 'X-Api-Key manquante ou invalide' }, { status: 401 })
  }

  const body = await req.json()
  const { log_ids } = body

  if (!Array.isArray(log_ids) || !log_ids.length) {
    return NextResponse.json({ error: 'log_ids requis (array non vide)' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('inscriptions_camps_logs')
    .update({ alerte_envoyee_at: new Date().toISOString() })
    .in('id', log_ids)
    .is('alerte_envoyee_at', null) // ne pas re-marquer un deja traite
    .select('id')

  if (error) {
    console.error('Erreur marquer alerte:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    marked: (data || []).length,
  })
}
