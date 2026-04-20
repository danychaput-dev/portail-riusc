// app/api/mon-groupe/courriels/route.ts
//
// GET — liste les courriels envoyés aux membres des groupes R&S dont
// l'utilisateur connecté est responsable.
//
// Regroupe par (campagne_id OU par sujet + date si pas de campagne) et
// renvoie pour chaque courriel un résumé + la liste des destinataires
// de SON groupe avec leur statut individuel (envoyé, ouvert, rebondi…).
//
// Les courriels envoyés uniquement à des membres hors des groupes du
// responsable sont exclus.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  // Fenêtre temporelle : par défaut 90 jours
  const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '90', 10) || 90))

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: self } = await supabaseAdmin
    .from('reservistes').select('benevole_id').eq('user_id', user.id).single()
  if (!self) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  // 1. Trouver les groupes dont l'user est responsable
  const { data: mesResp } = await supabaseAdmin
    .from('groupes_recherche_responsables')
    .select('groupe_id')
    .eq('benevole_id', self.benevole_id)

  if (!mesResp || mesResp.length === 0) {
    return NextResponse.json({ is_responsable: false, groupes: [], courriels: [] })
  }

  const groupeIds = mesResp.map((r: any) => r.groupe_id)
  const { data: groupes } = await supabaseAdmin
    .from('groupes_recherche')
    .select('id, nom, district')
    .in('id', groupeIds)

  if (!groupes || groupes.length === 0) {
    return NextResponse.json({ is_responsable: true, groupes: [], courriels: [] })
  }

  // 2. Récupérer les membres de ces groupes (via groupe_recherche TEXT — match substring)
  const orFilter = groupes
    .map((g: any) => `groupe_recherche.ilike.%${g.nom}%`)
    .join(',')

  const { data: membres } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, email, groupe_recherche')
    .or(orFilter)

  const membresList = (membres || []) as Array<{
    benevole_id: string; prenom: string; nom: string; email: string; groupe_recherche: string | null
  }>
  const membreIds = membresList.map(m => m.benevole_id)
  if (membreIds.length === 0) {
    return NextResponse.json({ is_responsable: true, groupes, courriels: [] })
  }

  // 3. Récupérer les courriels envoyés à ces membres dans la fenêtre
  const depuis = new Date(Date.now() - days * 86400_000).toISOString()
  const { data: courriels } = await supabaseAdmin
    .from('courriels')
    .select('id, subject, body_html, campagne_id, benevole_id, to_email, statut, ouvert_at, clics_count, has_reply, created_at, from_name, from_email')
    .in('benevole_id', membreIds)
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })

  const courrielsList = (courriels || []) as Array<any>
  if (courrielsList.length === 0) {
    return NextResponse.json({ is_responsable: true, groupes, courriels: [] })
  }

  // 4. Regrouper par (campagne_id || subject). Un courriel sans campagne_id
  //    correspond à un envoi individuel — on le garde séparé par id dans ce cas.
  const membreMap = Object.fromEntries(membresList.map(m => [m.benevole_id, m]))
  type Group = {
    key: string               // clé de regroupement (campagne_id ou id)
    campagne_id: string | null
    subject: string
    body_html: string
    from_name: string
    from_email: string
    created_at: string        // date du plus ancien envoi du lot
    destinataires: Array<{
      courriel_id: string
      benevole_id: string
      prenom: string
      nom: string
      email: string
      statut: string
      ouvert_at: string | null
      clics_count: number
      has_reply: boolean | null
    }>
  }
  const grouped = new Map<string, Group>()

  for (const c of courrielsList) {
    const key = c.campagne_id ? `camp:${c.campagne_id}` : `solo:${c.id}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        campagne_id: c.campagne_id,
        subject: c.subject,
        body_html: c.body_html,
        from_name: c.from_name,
        from_email: c.from_email,
        created_at: c.created_at,
        destinataires: [],
      })
    }
    const g = grouped.get(key)!
    // Garder la date la plus ancienne comme référence
    if (c.created_at < g.created_at) g.created_at = c.created_at
    const membre = membreMap[c.benevole_id]
    if (!membre) continue
    g.destinataires.push({
      courriel_id: c.id,
      benevole_id: c.benevole_id,
      prenom: membre.prenom,
      nom: membre.nom,
      email: membre.email || c.to_email,
      statut: c.statut,
      ouvert_at: c.ouvert_at,
      clics_count: c.clics_count || 0,
      has_reply: c.has_reply,
    })
  }

  // 5. Trier : les plus récents en premier
  const result = Array.from(grouped.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )

  return NextResponse.json({
    is_responsable: true,
    groupes,
    courriels: result,
    fenetre_jours: days,
  })
}
