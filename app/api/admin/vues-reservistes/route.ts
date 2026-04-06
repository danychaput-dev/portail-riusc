// app/api/admin/vues-reservistes/route.ts
// CRUD pour les vues sauvegardées de la page réservistes
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUser(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
  if (!res || !['admin', 'coordonnateur', 'adjoint'].includes(res.role)) return null
  return { id: user.id, role: res.role }
}

// GET — Liste des vues (personnelles + partagées)
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: vues, error } = await supabaseAdmin
      .from('vues_reservistes')
      .select('*')
      .or(`user_id.eq.${user.id},partage.eq.true`)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrichir avec un flag "own" pour savoir si c'est la vue de l'utilisateur
    const enriched = (vues || []).map(v => ({
      ...v,
      own: v.user_id === user.id,
    }))

    return NextResponse.json({ vues: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — Créer une nouvelle vue
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { nom, description, filtres, partage, couleur } = await req.json()

    if (!nom || !nom.trim()) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    // Calculer la prochaine position
    const { count } = await supabaseAdmin
      .from('vues_reservistes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { data: vue, error } = await supabaseAdmin
      .from('vues_reservistes')
      .insert({
        user_id: user.id,
        nom: nom.trim(),
        description: description || null,
        filtres: filtres || {},
        partage: partage || false,
        couleur: couleur || null,
        position: (count || 0),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ vue })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — Modifier une vue (nom, filtres, position, partage)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id, nom, description, filtres, partage, couleur, position, positions } = await req.json()

    // Batch position update (pour le drag & drop)
    if (positions && Array.isArray(positions)) {
      for (const p of positions) {
        await supabaseAdmin
          .from('vues_reservistes')
          .update({ position: p.position })
          .eq('id', p.id)
          .eq('user_id', user.id) // sécurité : uniquement ses propres vues
      }
      return NextResponse.json({ ok: true })
    }

    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    // Vérifier que c'est bien sa vue
    const { data: existing } = await supabaseAdmin
      .from('vues_reservistes')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const updates: Record<string, any> = {}
    if (nom !== undefined) updates.nom = nom.trim()
    if (description !== undefined) updates.description = description
    if (filtres !== undefined) updates.filtres = filtres
    if (partage !== undefined) updates.partage = partage
    if (couleur !== undefined) updates.couleur = couleur
    if (position !== undefined) updates.position = position

    const { data: vue, error } = await supabaseAdmin
      .from('vues_reservistes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ vue })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — Supprimer une vue
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    // Vérifier que c'est bien sa vue
    const { data: existing } = await supabaseAdmin
      .from('vues_reservistes')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé — vous ne pouvez supprimer que vos propres vues' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('vues_reservistes')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
