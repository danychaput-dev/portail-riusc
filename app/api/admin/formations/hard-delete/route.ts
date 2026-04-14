// app/api/admin/formations/hard-delete/route.ts
// PURGE DEFINITIVE d'un certificat/formation deja en corbeille (loi 25 / RGPD).
// Supprime reellement: la ligne formations_benevoles + l'audit_log associe.
// NE supprime PAS le fichier du Storage (protection anti-perte supplementaire).
// IRREVERSIBLE. Acces: superadmin uniquement.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!res || res.role !== 'superadmin') return null
  return { user_id: user.id, email: user.email ?? null }
}

export async function POST(request: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { formation_id, raison_purge, confirmation_nom_formation } = await request.json()

  if (!formation_id) {
    return NextResponse.json({ error: 'formation_id requis' }, { status: 400 })
  }
  if (!raison_purge || String(raison_purge).trim().length < 10) {
    return NextResponse.json(
      { error: 'Raison de purge obligatoire (minimum 10 caracteres)' },
      { status: 400 }
    )
  }

  // Verifier que la cible est bien en corbeille
  const { data: cible, error: errGet } = await supabaseAdmin
    .from('formations_benevoles')
    .select('id, nom_formation, deleted_at')
    .eq('id', formation_id)
    .single()

  if (errGet || !cible) {
    return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
  }
  if (!cible.deleted_at) {
    return NextResponse.json(
      { error: 'La formation doit etre dans la corbeille avant la purge definitive' },
      { status: 400 }
    )
  }

  // Confirmation du nom de la formation (anti-clic accidentel)
  const nomAttendu = (cible.nom_formation || '').trim().toLowerCase()
  const nomFourni = String(confirmation_nom_formation || '').trim().toLowerCase()
  if (nomAttendu !== nomFourni) {
    return NextResponse.json(
      { error: 'La confirmation du nom de la formation ne correspond pas' },
      { status: 400 }
    )
  }

  // RPC qui supprime definitivement + purge l'audit_log
  // (On ne peut pas tracer la purge dans audit_log puisqu'il est efface en meme temps.
  // La raison_purge reste dans les logs serveur de Vercel via la requete.)
  const { data: auditPurged, error: purgeErr } = await supabaseAdmin.rpc(
    'formations_hard_delete',
    { p_formation_id: formation_id }
  )

  if (purgeErr) {
    return NextResponse.json(
      { error: `Echec purge definitive: ${purgeErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    hard_delete: true,
    formation_id,
    audit_entries_purged: auditPurged ?? 0,
  })
}
