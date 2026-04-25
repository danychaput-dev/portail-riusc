// app/api/disponibilites/cleanup-chevauchement/route.ts
//
// POST — Supprime toutes les plages existantes qui chevauchent la nouvelle plage
// soumise par un réserviste. À appeler AVANT d'insérer la nouvelle plage.
//
// RÈGLE MÉTIER (articulée par Dany 2026-04-25):
// La nouvelle plage soumise gagne entièrement. Si elle chevauche une plage
// existante (même partiellement), l'ancienne plage est ENTIÈREMENT supprimée
// (pas tronquée).
//
// Exemples:
//   - Existant [1-5], [9-15]. Nouvelle [12-18] → supprime [9-15] (résultat: [1-5], [12-18])
//   - Existant [1-5], [9-15]. Nouvelle [2-12]  → supprime les 2 (résultat: [2-12])
//   - Existant [1-5]. Nouvelle [3-7]            → supprime [1-5] (résultat: [3-7])
//
// Comme disponibilites_v2 stocke 1 ligne par jour, on doit:
//   1. Lire tous les jours existants pour ce reserviste/déploiement
//   2. Reconstituer les "plages" en groupant les jours consécutifs
//   3. Identifier celles qui chevauchent [newDebut, newFin]
//   4. DELETE tous les jours appartenant à ces plages

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/utils/auth-api'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Reconstitue les plages contiguës à partir d'une liste triée d'ISO dates.
// Retourne [{ debut, fin }, ...]
function reconstituerPlages(joursTries: string[]): { debut: string; fin: string }[] {
  if (joursTries.length === 0) return []
  const plages: { debut: string; fin: string }[] = []
  let debut = joursTries[0]
  let fin = joursTries[0]
  for (let i = 1; i < joursTries.length; i++) {
    const prev = new Date(fin); prev.setDate(prev.getDate() + 1)
    const prevISO = prev.toISOString().split('T')[0]
    if (prevISO === joursTries[i]) {
      fin = joursTries[i]
    } else {
      plages.push({ debut, fin })
      debut = joursTries[i]
      fin = joursTries[i]
    }
  }
  plages.push({ debut, fin })
  return plages
}

// Vérifie si deux plages [a1,a2] et [b1,b2] se chevauchent (au moins 1 jour commun)
function chevauchent(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 <= b2 && b1 <= a2
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth

    const { benevole_id, deployment_id, date_debut, date_fin } = await req.json()
    if (!benevole_id || !deployment_id || !date_debut || !date_fin) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    // Sécurité: un réserviste ne peut nettoyer que ses propres dispos
    if (auth.role === 'reserviste' && auth.benevole_id !== benevole_id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // 1. Récupérer tous les jours existants pour ce réserviste sur ce déploiement
    const { data: existing, error: selErr } = await supabase
      .from('disponibilites_v2')
      .select('date_jour')
      .eq('benevole_id', benevole_id)
      .eq('deployment_id', deployment_id)
      .order('date_jour', { ascending: true })

    if (selErr) {
      console.error('cleanup-chevauchement SELECT error:', selErr)
      return NextResponse.json({ error: selErr.message }, { status: 500 })
    }

    if (!existing || existing.length === 0) {
      return NextResponse.json({ ok: true, plages_supprimees: 0, jours_supprimes: 0 })
    }

    // 2. Reconstituer les plages contiguës
    const joursExistants = existing.map(r => r.date_jour as string)
    const plagesExistantes = reconstituerPlages(joursExistants)

    // 3. Filtrer celles qui chevauchent [date_debut, date_fin]
    const plagesChevauchantes = plagesExistantes.filter(p =>
      chevauchent(p.debut, p.fin, date_debut, date_fin)
    )

    if (plagesChevauchantes.length === 0) {
      return NextResponse.json({ ok: true, plages_supprimees: 0, jours_supprimes: 0 })
    }

    // 4. DELETE tous les jours de chaque plage chevauchante (entière, pas tronquée)
    let totalSupprime = 0
    for (const p of plagesChevauchantes) {
      const { error: delErr, count } = await supabase
        .from('disponibilites_v2')
        .delete({ count: 'exact' })
        .eq('benevole_id', benevole_id)
        .eq('deployment_id', deployment_id)
        .gte('date_jour', p.debut)
        .lte('date_jour', p.fin)

      if (delErr) {
        console.error(`cleanup-chevauchement DELETE error pour [${p.debut}, ${p.fin}]:`, delErr)
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }
      totalSupprime += count ?? 0
    }

    return NextResponse.json({
      ok: true,
      plages_supprimees: plagesChevauchantes.length,
      jours_supprimes: totalSupprime,
      plages_details: plagesChevauchantes,
    })
  } catch (e: any) {
    console.error('cleanup-chevauchement erreur:', e)
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}
