// utils/phone.ts
// ─── Source unique pour tout le traitement des numéros de téléphone ──────────
// Convention : on stocke TOUJOURS 10 chiffres en DB (sans le "1" de pays).
// Exemple : 4185551234  (pas 14185551234, pas (418) 555-1234)

/**
 * Normalise un numéro pour la sauvegarde en DB : 10 chiffres, sans le "1".
 * Accepte n'importe quel format en entrée.
 */
export function normalizePhone(value: string | null | undefined): string {
  if (!value) return ''
  // Retirer tous les caractères non-numériques (+, espaces, parenthèses, tirets)
  const digits = value.replace(/\D/g, '')
  // 11 chiffres commençant par 1 (ex: 14185551234 ou +14185551234) → retirer le 1
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1)
  // 10 chiffres → tel quel
  if (digits.length === 10) return digits
  // Autre → retourner les chiffres bruts (sera invalidé par isValidPhone)
  return digits
}

/**
 * Formate un numéro pour l'affichage : (418) 555-1234
 * Accepte n'importe quel format en entrée.
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return ''
  const digits = normalizePhone(value)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Formate pendant la saisie (accepte les entrées incomplètes).
 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Vérifie si un numéro est valide (10 chiffres nord-américain).
 * Un champ vide est considéré valide (champ optionnel).
 */
export function isValidPhone(value: string | null | undefined): boolean {
  if (!value || value.trim() === '') return true
  return normalizePhone(value).length === 10
}

/**
 * Vérifie si un numéro est complet (10 chiffres).
 */
export function isPhoneComplete(value: string): boolean {
  return normalizePhone(value).length === 10
}

// ─── Aliases pour rétrocompatibilité ────────────────────────────────────────
/** @deprecated Utiliser normalizePhone() */
export const cleanPhoneForSave = normalizePhone
/** @deprecated Utiliser formatPhone() */
export const formatPhoneDisplay = formatPhone
/** @deprecated Utiliser isValidPhone() */
export const isValidNorthAmericanPhone = isValidPhone
/** @deprecated Utiliser normalizePhone() */
export const unformatPhone = normalizePhone
