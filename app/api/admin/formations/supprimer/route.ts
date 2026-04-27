import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Vérifier que l'utilisateur est admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: adminRes } = await supabaseAdmin
    .from('reservistes')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!adminRes || !['superadmin', 'admin', 'coordonnateur'].includes(adminRes.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  await setActingUser(supabaseAdmin, user.id, user.email)

  const { formation_id, benevole_id } = await req.json()
  if (!formation_id || !benevole_id) {
    return NextResponse.json({ error: 'formation_id et benevole_id requis' }, { status: 400 })
  }

  // 1. Récupérer la formation
  const { data: formation, error: fetchErr } = await supabaseAdmin
    .from('formations_benevoles')
    .select('id, certificat_url, nom_formation, catalogue')
    .eq('id', formation_id)
    .eq('benevole_id', benevole_id)
    .single()

  if (fetchErr || !formation) {
    return NextResponse.json({ error: 'Formation non trouvée' }, { status: 404 })
  }

  // 2. Supprimer le fichier certificat du Storage si existant
  if (formation.certificat_url) {
    const path = formation.certificat_url.startsWith('storage:')
      ? formation.certificat_url.replace('storage:', '')
      : null

    if (path) {
      await supabaseAdmin.storage.from('certificats').remove([path])
    }
  }

  // 3. Chercher et supprimer les fichiers liés dans le storage (pattern: formationId.*)
  try {
    const { data: files } = await supabaseAdmin.storage.from('certificats').list(benevole_id)
    if (files) {
      const toDelete = files.filter(f => f.name.startsWith(formation_id))
      if (toDelete.length > 0) {
        await supabaseAdmin.storage.from('certificats').remove(
          toDelete.map(f => `${benevole_id}/${f.name}`)
        )
      }
    }
  } catch (_) {
    // Pas critique si le nettoyage storage échoue
  }

  // 4. Supprimer la formation de la base de données
  const { error: deleteErr } = await supabaseAdmin
    .from('formations_benevoles')
    .delete()
    .eq('id', formation_id)
    .eq('benevole_id', benevole_id)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, deleted: formation.catalogue || formation.nom_formation })
}
