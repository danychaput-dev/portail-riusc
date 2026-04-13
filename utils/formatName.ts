/**
 * Normalisation de noms/prenoms en francais.
 * Gere: majuscule initiale, traits d'union, apostrophes, particules nobiliaires.
 *
 * Exemples:
 *   "DANNY MICHAUD"  -> "Danny Michaud"
 *   "jean-pierre"     -> "Jean-Pierre"
 *   "D'AMOUR"         -> "D'Amour"
 *   "DE LA FONTAINE"  -> "De la Fontaine" (si isolé) / "de la Fontaine" (milieu)
 *   "O'BRIEN"         -> "O'Brien"
 */

const PARTICULES = new Set([
  'de', 'du', 'des', 'la', 'le', 'les',
  'van', 'von', 'der', 'den', 'el', 'al', 'y',
  'da', 'do', 'dos', 'das',
])

function capitalizeWord(word: string): string {
  if (!word) return word
  // Gere les apostrophes: D'Amour, O'Brien
  if (word.includes("'")) {
    return word
      .split("'")
      .map((part, idx) => idx === 0 ? capitalizeSimple(part) : capitalizeSimple(part))
      .join("'")
  }
  // Gere les traits d'union: Jean-Pierre, Marie-Claire
  if (word.includes('-')) {
    return word.split('-').map(capitalizeSimple).join('-')
  }
  return capitalizeSimple(word)
}

function capitalizeSimple(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Normalise un nom ou prenom.
 * Les particules (de, du, la...) en milieu de chaine restent en minuscule.
 * Retire les espaces superflus.
 */
export function formatName(input: string | null | undefined): string {
  if (!input) return ''
  const trimmed = input.trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''

  const words = trimmed.split(' ')
  return words
    .map((word, idx) => {
      const lower = word.toLowerCase()
      // Particule en milieu de chaine -> minuscule
      // Premier mot -> toujours capitaliser
      if (idx > 0 && PARTICULES.has(lower)) {
        return lower
      }
      return capitalizeWord(word)
    })
    .join(' ')
}

export function formatEmail(input: string | null | undefined): string {
  if (!input) return ''
  return input.trim().toLowerCase()
}
