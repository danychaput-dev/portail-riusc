// utils/phone.ts

/**
 * Formate un numéro de téléphone en (514) 555-0000
 * Accepte n'importe quel format en entrée
 */
export function formatPhone(value: string): string {
  // Garder seulement les chiffres
  const digits = value.replace(/\D/g, '').slice(0, 10)

  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Retire le formatage pour ne garder que les chiffres
 */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Vérifie si un numéro est complet (10 chiffres)
 */
export function isPhoneComplete(value: string): boolean {
  return value.replace(/\D/g, '').length === 10
}
