import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/utils/auth-api'

// ─── Route POST /api/operations/rotation-ia ───────────────────────────────────
//
// Appelle l'API Anthropic pour suggérer des rotations optimales basées sur
// les disponibilités soumises par les réservistes.
//
// Body attendu :
//   deployment       : { nom, lieu, date_debut, date_fin, nb_personnes_par_vague }
//   sinistre         : { nom, type_incident, lieu }
//   dispos           : DispoV2[] (date_jour, disponible, benevole_id, reservistes)
//   nb_cibles_notifies : number

export async function POST(req: NextRequest) {
  const auth = await requireRole('superadmin', 'admin', 'coordonnateur')
  if (isAuthError(auth)) return auth
  try {
    const { deployment, sinistre, dispos, nb_cibles_notifies } = await req.json()

    // ── Construire le contexte pour Claude ──────────────────────────────────

    // Résumé des disponibilités par jour
    const disponDates: Record<string, { dispo: string[]; indispo: string[] }> = {}
    for (const d of (dispos || [])) {
      if (!disponDates[d.date_jour]) disponDates[d.date_jour] = { dispo: [], indispo: [] }
      const nom = d.reservistes ? `${d.reservistes.prenom} ${d.reservistes.nom}` : d.benevole_id
      if (d.disponible) {
        disponDates[d.date_jour].dispo.push(nom)
      } else {
        disponDates[d.date_jour].indispo.push(nom)
      }
    }

    const dispoResume = Object.entries(disponDates)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { dispo, indispo }]) =>
        `${date}: ${dispo.length} disponibles (${dispo.slice(0, 5).join(', ')}${dispo.length > 5 ? '...' : ''})` +
        (indispo.length > 0 ? ` | ${indispo.length} indisponibles` : '')
      ).join('\n')

    const nbPersonnesRequis = deployment?.nb_personnes_par_vague || 5
    const totalReponses = dispos?.length || 0

    const prompt = `Tu es un assistant en gestion opérationnelle pour l'AQBRS (Association québécoise des bénévoles en recherche et sauvetage).

Contexte de l'opération :
- Sinistre : ${sinistre?.nom || 'N/A'} (${sinistre?.type_incident || ''}) — ${sinistre?.lieu || ''}
- Déploiement : ${deployment?.nom || 'N/A'}
- Lieu : ${deployment?.lieu || 'Non précisé'}
- Période prévue : ${deployment?.date_debut || '?'} → ${deployment?.date_fin || '?'}
- Réservistes par rotation : ${nbPersonnesRequis}
- Réservistes notifiés : ${nb_cibles_notifies || 0}
- Réponses reçues : ${totalReponses}

Disponibilités par jour :
${dispoResume || 'Aucune disponibilité reçue encore.'}

Tâche : Propose 1 à 3 rotations optimales (chacune sur une plage de 3 à 7 jours) qui :
1. Maximisent le nombre de réservistes disponibles par rotation
2. Couvrent la période de déploiement sans trop de chevauchements
3. Respectent le besoin de ${nbPersonnesRequis} personnes par rotation

Format de ta réponse — sois concis et structuré :
ROTATION 1 : [date_debut] → [date_fin] | ~[nb] personnes disponibles
→ Justification courte (1-2 lignes)

ROTATION 2 : [date_debut] → [date_fin] | ~[nb] personnes disponibles  
→ Justification courte (1-2 lignes)

[etc.]

Note finale : recommandation générale en 1-2 phrases.`

    // ── Appel Anthropic API ─────────────────────────────────────────────────

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return NextResponse.json(
        { error: 'Erreur API Anthropic', details: err },
        { status: 500 }
      )
    }

    const data = await response.json()
    const suggestion = data.content?.[0]?.text || 'Aucune suggestion générée.'

    // Tenter d'extraire dates/nb de la première rotation pour pré-remplir le formulaire
    const match = suggestion.match(/ROTATION 1\s*:\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})\s*\|\s*~?(\d+)/)
    const date_debut = match?.[1] || null
    const date_fin = match?.[2] || null
    const nb_personnes = match?.[3] ? parseInt(match[3]) : null

    return NextResponse.json({ suggestion, date_debut, date_fin, nb_personnes })

  } catch (err: any) {
    console.error('rotation-ia error:', err)
    return NextResponse.json({ error: err.message || 'Erreur interne' }, { status: 500 })
  }
}
