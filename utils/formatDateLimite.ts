// utils/formatDateLimite.ts
// Formate une date limite de reponse en francais fluide, selon la distance
// temporelle entre l'envoi et l'echeance. Fuseau America/Montreal.
//
// Exemples :
//   envoi 9h00, limite 16h00 meme jour  -> "avant 16h00 aujourd'hui"
//   envoi 22h00, limite 06h00 lendemain -> "avant 06h00 demain matin"
//   envoi 14h00, limite 18h00 lendemain -> "avant 18h00 demain"
//   envoi 2026-04-22, limite 2026-04-24 -> "avant 06h00 le 24 avril"

const TZ = 'America/Montreal'

function toLocalParts(d: Date) {
  // Retourne les composantes locales de la date en America/Montreal
  const fmt = new Intl.DateTimeFormat('fr-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value
    return acc
  }, {})
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === '24' ? '00' : parts.hour,
    minute: parts.minute,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/**
 * Formate la date limite en phrase francaise.
 * @param dateLimite Date limite concrete
 * @param dateEnvoi Reference pour "aujourd'hui" vs "demain". Defaut: now().
 */
export function formatDateLimite(dateLimite: Date, dateEnvoi: Date = new Date()): string {
  const env = toLocalParts(dateEnvoi)
  const lim = toLocalParts(dateLimite)
  const heureFr = `${lim.hour}h${lim.minute}`

  if (env.dateKey === lim.dateKey) {
    return `avant ${heureFr} aujourd'hui`
  }

  const demain = toLocalParts(addDays(dateEnvoi, 1))
  if (demain.dateKey === lim.dateKey) {
    const h = parseInt(lim.hour, 10)
    return h < 12
      ? `avant ${heureFr} demain matin`
      : `avant ${heureFr} demain`
  }

  const moisIdx = parseInt(lim.month, 10) - 1
  const nomMois = MOIS_FR[moisIdx] ?? lim.month
  const jour = parseInt(lim.day, 10)
  return `avant ${heureFr} le ${jour} ${nomMois}`
}

/** Calcule date_limite_reponse = dateEnvoi + heures. */
export function calculerDateLimite(dateEnvoi: Date, heures: number): Date {
  return new Date(dateEnvoi.getTime() + heures * 3600 * 1000)
}
