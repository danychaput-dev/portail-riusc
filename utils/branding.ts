// utils/branding.ts
// Configuration du branding RIUSC vs AQBRS pour une operation.
// Utilise par les templates SMS/courriel et par la page soumettre.

export type Branding = 'RIUSC' | 'AQBRS'

export interface BrandingConfig {
  /** Valeur de la colonne deployments.branding */
  cle: Branding
  /** Nom court affiche dans les textes */
  nomCourt: string
  /** Nom du portail dans les textes ("Portail RIUSC" ou "AQBRS") */
  nomPortail: string
  /** Signature pour tplNotif (etape 5) */
  signatureNotif: string
  /** Signature pour tplMobil (etape 8) */
  signatureMobil: string
  /** Chemin vers le logo dans /public */
  logoPath: string
  /** URL du portail (identique pour les 2 brandings pour le moment) */
  urlPortail: string
}

const CONFIGS: Record<Branding, BrandingConfig> = {
  RIUSC: {
    cle: 'RIUSC',
    nomCourt: 'RIUSC',
    nomPortail: 'Portail RIUSC',
    signatureNotif: "L'équipe RIUSC",
    signatureMobil: "L'équipe RIUSC / AQBRS",
    logoPath: '/logo-riusc.png',
    urlPortail: 'portail.riusc.ca',
  },
  AQBRS: {
    cle: 'AQBRS',
    nomCourt: 'AQBRS',
    nomPortail: 'AQBRS',
    signatureNotif: "L'équipe AQBRS",
    signatureMobil: "L'équipe AQBRS",
    logoPath: '/logo-aqbrs.png',
    urlPortail: 'portail.riusc.ca',
  },
}

export function brandingConfig(b: Branding | string | null | undefined): BrandingConfig {
  if (b === 'AQBRS') return CONFIGS.AQBRS
  return CONFIGS.RIUSC
}

export function isValidBranding(b: unknown): b is Branding {
  return b === 'RIUSC' || b === 'AQBRS'
}
