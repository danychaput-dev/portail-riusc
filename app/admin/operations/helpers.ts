// Helpers purs pour le wizard Operations
import type { Demande, Deployment } from './types'
import { brandingConfig, type Branding } from '@/utils/branding'
import { formatDateLimite, calculerDateLimite } from '@/utils/formatDateLimite'

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

export interface TplNotifContext {
  sinNom: string
  depNom: string
  dateDebut?: string
  dateFin?: string
  branding?: Branding
  heuresLimite?: number
  modeDates?: 'plage_continue' | 'jours_individuels'
  joursProposes?: string[] | null
  dateEnvoi?: Date
}

/**
 * Template notification dispos (etape 5). Adapte au branding, au delai configure,
 * au mode plage/jours individuels. La date limite est calculee a partir de
 * l'heure d'envoi + heuresLimite et formatee en francais naturel.
 */
export function tplNotif(ctx: TplNotifContext | string, depNomLegacy?: string, dateDebutLegacy?: string): string {
  // Retrocompat: ancienne signature (sinNom, depNom, dateDebut)
  if (typeof ctx === 'string') {
    ctx = { sinNom: ctx, depNom: depNomLegacy || '', dateDebut: dateDebutLegacy }
  }

  const branding = brandingConfig(ctx.branding || 'RIUSC')
  const heures = ctx.heuresLimite ?? 8
  const dateEnvoi = ctx.dateEnvoi ?? new Date()
  const limite = calculerDateLimite(dateEnvoi, heures)
  const limiteStr = formatDateLimite(limite, dateEnvoi)

  // Description du mode dates
  let modePhrase = ''
  if (ctx.modeDates === 'jours_individuels' && ctx.joursProposes?.length) {
    const joursFr = ctx.joursProposes.map(dateFr).join(', ')
    modePhrase = `\nJours proposés : ${joursFr}.`
  } else if (ctx.dateDebut && ctx.dateFin && ctx.dateDebut !== ctx.dateFin) {
    modePhrase = `\nDates du déploiement : du ${dateFr(ctx.dateDebut)} au ${dateFr(ctx.dateFin)}.`
  } else if (ctx.dateDebut) {
    modePhrase = `\nDate du déploiement : ${dateFr(ctx.dateDebut)}.`
  }

  return `Bonjour,

Dans le cadre du sinistre « ${ctx.sinNom} », nous sollicitons votre disponibilité pour le déploiement ${ctx.depNom}.${modePhrase}

Veuillez soumettre vos disponibilités ${limiteStr} via le portail :
https://${branding.urlPortail}/disponibilites

Merci pour votre engagement.
${branding.signatureNotif}`
}

export interface TplMobilContext {
  depNom: string
  vagNom: string
  debut: string
  fin: string
  lieu?: string
  branding?: Branding
}

export function tplMobil(ctx: TplMobilContext | string, vagNomLegacy?: string, debutLegacy?: string, finLegacy?: string, lieuLegacy?: string): string {
  // Retrocompat: ancienne signature (depNom, vagNom, debut, fin, lieu)
  if (typeof ctx === 'string') {
    ctx = {
      depNom: ctx,
      vagNom: vagNomLegacy || '',
      debut: debutLegacy || '',
      fin: finLegacy || '',
      lieu: lieuLegacy,
    }
  }

  const branding = brandingConfig(ctx.branding || 'RIUSC')

  return `Bonjour,

Vous êtes officiellement mobilisé(e) pour la rotation ${ctx.vagNom} du ${dateFr(ctx.debut)} au ${dateFr(ctx.fin)} dans le cadre du déploiement ${ctx.depNom}.

${ctx.lieu ? `Lieu de déploiement : ${ctx.lieu}\n` : ''}Veuillez confirmer votre présence via le ${branding.nomPortail.toLowerCase()} :
https://${branding.urlPortail}/mobilisation

En cas d'empêchement, contactez-nous immédiatement.
${branding.signatureMobil}`
}
