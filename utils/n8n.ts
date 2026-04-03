const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_BASE_URL || 'https://n8n.aqbrs.ca'

/** Construit l'URL complète d'un webhook n8n. Ex: n8nUrl('/webhook/riusc-inscription') */
export function n8nUrl(path: string): string {
  return `${N8N_BASE_URL}${path}`
}
