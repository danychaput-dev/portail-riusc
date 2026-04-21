// app/_data/camps-sessions.ts
//
// Liste statique des camps de qualification disponibles, partagée entre :
//   - /inscription (page publique, création de compte + inscription camp)
//   - / (landing des réservistes connectés)
//   - /formulaires et /formation (pages avec inscription camp secondaire)
//
// Historiquement, la liste venait d'un workflow n8n /webhook/sessions-camps
// (backed par Monday.com), mais c'est fragile : si n8n est down ou que le
// workflow est désactivé, les utilisateurs voient « Aucun camp disponible ».
//
// À migrer plus tard vers une table Supabase `camps` avec RLS en lecture
// publique, mais en attendant cette liste est la source unique de vérité.
//
// Pour ajouter/retirer un camp : édite CAMPS_SESSIONS, puis git push.

import type { SessionCamp } from '@/types'

export interface CampSessionWithFin extends SessionCamp {
  /** Utilisé en interne pour filtrer les camps passés — pas dans SessionCamp public */
  date_fin?: Date
}

export const CAMPS_SESSIONS: CampSessionWithFin[] = [
  {
    session_id: 'CAMP_STE_CATHERINE_MAR26',
    nom: 'Cohorte 8 - Camp de qualification - Sainte-Catherine',
    dates: '14 et 15 mars 2026',
    date_fin: new Date('2026-03-15'),
    site: "Centre Municipal Aimé-Guérin",
    location: '5365 Boul Saint-Laurent, Sainte-Catherine, QC, Canada',
  },
  {
    session_id: 'CAMP_CHICOUTIMI_AVR26',
    nom: 'Cohorte 9 - Camp de qualification - Chicoutimi',
    dates: '25-26 avril 2026',
    date_fin: new Date('2026-04-26'),
    site: 'Hôtel Chicoutimi',
    location: '460 Rue Racine Est, Chicoutimi, Québec G7H 1T7, Canada',
  },
  {
    session_id: 'CAMP_QUEBEC_MAI26',
    nom: 'Cohorte 10 - Camp de qualification - Québec',
    dates: '23-24 mai 2026',
    date_fin: new Date('2026-05-24'),
    site: 'Résidences Campus Notre-Dame-De-Foy',
    location: 'Québec, QC',
  },
  {
    session_id: 'CAMP_RIMOUSKI_SEP26',
    nom: 'Cohorte 11 - Camp de qualification - Rimouski',
    dates: '26-27 septembre 2026',
    date_fin: new Date('2026-09-27'),
    site: 'À définir',
    location: 'Rimouski, QC',
  },
  {
    session_id: 'CAMP_SHERBROOKE_OCT26',
    nom: 'Cohorte 12 - Camp de qualification - Sherbrooke',
    dates: '17-18 octobre 2026',
    date_fin: new Date('2026-10-18'),
    site: 'À définir',
    location: 'Sherbrooke, QC',
  },
  {
    session_id: 'CAMP_GATINEAU_NOV26',
    nom: 'Cohorte 13 - Camp de qualification - Gatineau',
    dates: '14-15 novembre 2026',
    date_fin: new Date('2026-11-15'),
    site: 'À définir',
    location: 'Gatineau, QC',
  },
]

/**
 * Retourne la liste des camps dont la date de fin est ≥ aujourd'hui,
 * sans le champ interne `date_fin` (reste compatible avec le type SessionCamp).
 */
export function getCampsSessionsActifs(): SessionCamp[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return CAMPS_SESSIONS
    .filter(c => !c.date_fin || c.date_fin >= today)
    .map(({ date_fin, ...rest }) => rest)
}
