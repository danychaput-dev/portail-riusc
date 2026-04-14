// Helpers purs pour le wizard Operations
import type { Demande, Deployment } from './types'

export function dateFr(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function orgAbbr(o: string): string {
  const map: Record<string, string> = {
    'Croix-Rouge': 'CR',
    'Municipalité': 'MUN',
    'SOPFEU': 'SPF',
    'Gouvernement du Québec': 'GQC',
  }
  return map[o] || o.slice(0, 3).toUpperCase()
}

export function genDemandeId(existing: Demande[], organisme: string, date: string): string {
  const n = (existing.length + 1).toString().padStart(3, '0')
  const d = date ? date.replace(/-/g, '').slice(2) : 'XXXXXX'
  return `DEM-${n}-${orgAbbr(organisme)}-${d}`
}

export function genDeployId(existing: Deployment[]): string {
  return `DEP-${(existing.length + 1).toString().padStart(3, '0')}`
}

export function tplNotif(sinNom: string, depNom: string, dateDebut?: string): string {
  return `Bonjour,

Dans le cadre du sinistre « ${sinNom} », nous sollicitons votre disponibilité pour le déploiement ${depNom}${dateDebut ? ` prévu à partir du ${dateFr(dateDebut)}` : ''}.

Veuillez soumettre vos disponibilités via le portail RIUSC dans les 4 prochains jours :
https://portail.riusc.ca/disponibilites

Merci pour votre engagement.
L'équipe RIUSC / AQBRS`
}

export function tplMobil(depNom: string, vagNom: string, debut: string, fin: string, lieu?: string): string {
  return `Bonjour,

Vous êtes officiellement mobilisé(e) pour la rotation ${vagNom} du ${dateFr(debut)} au ${dateFr(fin)} dans le cadre du déploiement ${depNom}.

${lieu ? `Lieu de déploiement : ${lieu}\n` : ''}Veuillez confirmer votre présence via le portail RIUSC :
https://portail.riusc.ca/mobilisation

En cas d'empêchement, contactez-nous immédiatement.
L'équipe RIUSC / AQBRS`
}
