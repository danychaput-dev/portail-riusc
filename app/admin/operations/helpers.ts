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
  /** Nom du sinistre — gardé pour compat ascendante mais plus utilisé dans le template (redondant avec depNom). */
  sinNom: string
  /** Nom du déploiement (admin-controlled, ex: "Soutien op. terrain - Inondation Chicoutimi"). Affiché en évidence. */
  depNom: string
  /** Date de début du déploiement (ISO YYYY-MM-DD). */
  dateDebut?: string
  /** Date de fin du déploiement (ISO YYYY-MM-DD). NULL = ops ouverte. */
  dateFin?: string
  /**
   * Lieu d'intervention — DÉLIBÉRÉMENT NON UTILISÉ par tplNotif() depuis 2026-04-25.
   * Risque opérationnel: un réserviste motivé verrait l'adresse précise et pourrait
   * s'y rendre avant d'être officiellement mobilisé (étape 8). Le lieu est révélé
   * uniquement à la mobilisation via tplMobil(). Voir tâche #17 pour la séparation
   * propre region (étape 5) vs lieu précis (étape 8).
   * Le champ reste sur l'interface pour préserver la signature, et l'admin peut
   * toujours ajouter une indication régionale en éditant manuellement le textarea.
   */
  lieu?: string
  branding?: Branding
  heuresLimite?: number
  modeDates?: 'plage_continue' | 'jours_individuels'
  joursProposes?: string[] | null
  dateEnvoi?: Date
}

/**
 * Template notification dispos (etape 5).
 *
 * DESIGN (refonte 2026-04-25 inspirée du courriel propre du 14 mars + retour terrain Dany):
 * - Pas de redondance "déploiement X" suivi du nom (qui peut commencer par "Déploiement")
 * - Pas de mention « sinistre » lourde au début (info redondante avec nom_deploiement
 *   qui contient déjà "Soutien op. terrain - Inondation Chicoutimi" par exemple)
 * - "plages de disponibilités" au pluriel (le réserviste soumet PLUSIEURS plages, pas une seule date)
 * - PAS de lieu dans ce template (sécurité opérationnelle: éviter qu'un réserviste
 *   se déplace avant la mobilisation officielle). Le lieu apparaît dans tplMobil() seulement.
 * - Aucune mention SOPFEU/Croix-Rouge — admin contrôle via depNom
 *
 * Compat ascendante: ancienne signature tplNotif(sinNom, depNom, dateDebut) supportée.
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

  // Description du mode dates (sur sa propre ligne)
  let datesLigne = ''
  if (ctx.modeDates === 'jours_individuels' && ctx.joursProposes?.length) {
    const joursFr = ctx.joursProposes.map(dateFr).join(', ')
    datesLigne = `\nJours proposés : ${joursFr}.`
  } else if (ctx.dateDebut && ctx.dateFin && ctx.dateDebut !== ctx.dateFin) {
    datesLigne = `\nDu ${dateFr(ctx.dateDebut)} au ${dateFr(ctx.dateFin)}.`
  } else if (ctx.dateDebut) {
    datesLigne = `\nÀ partir du ${dateFr(ctx.dateDebut)}.`
  }

  return `Bonjour,

Vous êtes sollicité(e) pour un déploiement.

${ctx.depNom}${datesLigne}

Veuillez soumettre vos plages de disponibilités ${limiteStr} via le portail :
https://${branding.urlPortail}/disponibilites

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
