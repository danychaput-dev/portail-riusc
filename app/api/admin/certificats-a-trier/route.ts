// app/api/admin/certificats-a-trier/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierAdmin(admin_benevole_id: string): Promise<{ ok: boolean; user_id?: string; email?: string }> {
  const { data } = await supabaseAdmin
    .from('reservistes')
    .select('role, user_id, email')
    .eq('benevole_id', admin_benevole_id)
    .single()
  if (!data || !['superadmin', 'admin', 'coordonnateur'].includes(data.role)) {
    return { ok: false }
  }
  return { ok: true, user_id: data.user_id, email: data.email }
}

// GET : Liste des certificats à trier (statut=pending par défaut)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut') || 'pending'
    const admin_benevole_id = searchParams.get('admin_benevole_id') || ''

    const auth = await verifierAdmin(admin_benevole_id)
    if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { data, error } = await supabaseAdmin
      .from('certificats_a_trier')
      .select('*')
      .eq('statut_tri', statut)
      .order('benevole_id', { ascending: true, nullsFirst: false })
      .order('date_courriel', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrichir avec noms réservistes
    const bIds = [...new Set((data || []).map((r: any) => r.benevole_id).filter(Boolean))]
    const { data: reservistes } = bIds.length
      ? await supabaseAdmin
          .from('reservistes')
          .select('benevole_id, prenom, nom, email')
          .in('benevole_id', bIds)
      : { data: [] }
    const resMap = new Map((reservistes || []).map((r: any) => [r.benevole_id, r]))

    // Enrichir avec formations existantes du réserviste
    const { data: formations } = bIds.length
      ? await supabaseAdmin
          .from('formations_benevoles')
          .select('id, benevole_id, nom_formation, date_reussite, certificat_url')
          .in('benevole_id', bIds)
      : { data: [] }

    const formationsByB = new Map<string, any[]>()
    ;(formations || []).forEach((f: any) => {
      const arr = formationsByB.get(f.benevole_id) || []
      arr.push(f)
      formationsByB.set(f.benevole_id, arr)
    })

    const enrichis = (data || []).map((r: any) => ({
      ...r,
      reserviste: r.benevole_id ? resMap.get(r.benevole_id) : null,
      formations_existantes: r.benevole_id ? (formationsByB.get(r.benevole_id) || []) : [],
    }))

    return NextResponse.json({ items: enrichis })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST : Assigner à une formation (nouvelle ou existante)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id, // id du certificat_a_trier
      admin_benevole_id,
      mode, // 'nouvelle' | 'attacher' | 'reassigner'
      benevole_id_cible, // pour reassigner (NO_MATCH)
      nom_formation,
      date_reussite,
      date_expiration,
      formation_benevole_id, // si mode=attacher
    } = body

    const auth = await verifierAdmin(admin_benevole_id)
    if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    // Récupérer la ligne queue
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from('certificats_a_trier')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr || !item) return NextResponse.json({ error: 'Certificat introuvable' }, { status: 404 })

    const benevole_id_final = benevole_id_cible || item.benevole_id
    if (!benevole_id_final) return NextResponse.json({ error: 'benevole_id manquant' }, { status: 400 })

    const certificat_url = `storage:${item.storage_path}`
    let formation_id: number | null = null

    if (mode === 'attacher' && formation_benevole_id) {
      // Attacher le fichier à une formation existante
      const { data: updated, error } = await supabaseAdmin
        .from('formations_benevoles')
        .update({
          certificat_url,
          date_reussite: date_reussite || undefined,
          date_expiration: date_expiration || undefined,
          resultat: 'Réussi',
          etat_validite: 'À jour',
        })
        .eq('id', formation_benevole_id)
        .select('id')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      formation_id = updated?.id || null
    } else {
      // Créer une nouvelle formation
      if (!nom_formation || !date_reussite) {
        return NextResponse.json({ error: 'nom_formation et date_reussite requis' }, { status: 400 })
      }
      // Récupérer nom_complet du réserviste
      const { data: r } = await supabaseAdmin
        .from('reservistes')
        .select('prenom, nom')
        .eq('benevole_id', benevole_id_final)
        .single()
      const nom_complet = r ? `${r.prenom} ${r.nom}` : null

      const { data: inserted, error } = await supabaseAdmin
        .from('formations_benevoles')
        .insert({
          benevole_id: benevole_id_final,
          nom_complet,
          nom_formation,
          date_reussite,
          date_expiration: date_expiration || null,
          certificat_url,
          resultat: 'Réussi',
          etat_validite: 'À jour',
          source: 'gmail_extract_2026-04',
        })
        .select('id')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      formation_id = inserted?.id || null
    }

    // Marquer la ligne queue comme assignée
    const { error: updErr } = await supabaseAdmin
      .from('certificats_a_trier')
      .update({
        statut_tri: 'assigned',
        formation_benevole_id: formation_id,
        assigne_par: auth.user_id,
        assigne_at: new Date().toISOString(),
        benevole_id: benevole_id_final,
      })
      .eq('id', id)
    if (updErr) {
      // Rollback : si on venait de CRÉER une nouvelle formation, on la supprime
      // pour éviter un orphelin. Pour 'attacher', on ne peut pas rollback l'update
      // (on a perdu les anciennes valeurs), mais l'erreur est moins probable ici.
      if (mode !== 'attacher' && formation_id) {
        await supabaseAdmin.from('formations_benevoles').delete().eq('id', formation_id)
      }
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, formation_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE : Marquer comme doublon/à supprimer (soft delete de la ligne queue)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const admin_benevole_id = searchParams.get('admin_benevole_id') || ''
    const note = searchParams.get('note') || ''

    const auth = await verifierAdmin(admin_benevole_id)
    if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    if (!note.trim()) return NextResponse.json({ error: 'note requise' }, { status: 400 })

    // Récupérer storage_path pour supprimer le fichier
    const { data: item } = await supabaseAdmin
      .from('certificats_a_trier')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (item?.storage_path) {
      await supabaseAdmin.storage.from('certificats-a-trier').remove([item.storage_path])
    }

    const { error } = await supabaseAdmin
      .from('certificats_a_trier')
      .update({
        statut_tri: 'deleted',
        note_admin: note,
        assigne_par: auth.user_id,
        assigne_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
