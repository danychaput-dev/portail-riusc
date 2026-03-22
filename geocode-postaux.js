// geocode-postaux.js v2 — stratégie FSA + ville en fallback
// Usage: node geocode-postaux.js

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Manque SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
}

const DELAI = 1200 // 1.2s entre chaque requête Nominatim

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function extraireCodePostal(cp) {
  if (!cp) return { fsa: null, complet: null }
  const clean = cp.replace(/\s+/g, '').toUpperCase()
  if (clean.length < 3) return { fsa: null, complet: null }
  const fsa = clean.slice(0, 3)
  const complet = clean.length >= 6 ? `${clean.slice(0,3)} ${clean.slice(3,6)}` : null
  return { fsa, complet }
}

// Valider coordonnées QC/Ontario est
function coordsValides(lat, lon) {
  if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return false
  if (Math.abs(lat - 49.00041490) < 0.001 && Math.abs(lon - (-112.78802660)) < 0.001) return false
  if (lat < 44.5 || lat > 63.5) return false
  if (lon < -80.5 || lon > -52.0) return false
  return true
}

async function nominatim(query) {
  try {
    const q = encodeURIComponent(query)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ca`,
      { headers: { 'User-Agent': 'portail.riusc.ca (contact@aqbrs.ca)', 'Accept-Language': 'fr' } }
    )
    const data = await res.json()
    if (data?.[0]) {
      const lat = parseFloat(data[0].lat)
      const lon = parseFloat(data[0].lon)
      if (coordsValides(lat, lon)) return { lat, lon }
    }
  } catch {}
  return null
}

async function geocoder(r) {
  const { fsa, complet } = extraireCodePostal(r.code_postal)

  // Essai 1 — code postal complet
  if (complet) {
    const res = await nominatim(`${complet}, Quebec, Canada`)
    await sleep(DELAI)
    if (res) return { ...res, source: `code complet ${complet}` }
  }

  // Essai 2 — FSA seulement
  if (fsa) {
    const res = await nominatim(`${fsa}, Quebec, Canada`)
    await sleep(DELAI)
    if (res) return { ...res, source: `FSA ${fsa}` }
  }

  // Essai 3 — ville + province
  if (r.ville && r.ville.trim()) {
    const ville = r.ville.trim()
    const res = await nominatim(`${ville}, Quebec, Canada`)
    await sleep(DELAI)
    if (res) return { ...res, source: `ville ${ville}` }
  }

  // Essai 4 — ville sans province (pour Hors Québec)
  if (r.ville && r.ville.trim()) {
    const res = await nominatim(`${r.ville.trim()}, Canada`)
    await sleep(DELAI)
    if (res) return { ...res, source: `ville Canada ${r.ville}` }
  }

  return null
}

async function main() {
  console.log('Chargement des réservistes sans coordonnées...')

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reservistes?select=benevole_id,prenom,nom,code_postal,ville,region&role=eq.reserviste&latitude=is.null`,
    { headers }
  )
  const reservistes = await res.json()
  console.log(`${reservistes.length} réservistes à géocoder\n`)

  let succes = 0, echecs = 0

  for (let i = 0; i < reservistes.length; i++) {
    const r = reservistes[i]
    process.stdout.write(`[${i+1}/${reservistes.length}] ${r.prenom} ${r.nom} (${r.code_postal || 'N/A'}) → `)

    const coords = await geocoder(r)

    if (coords) {
      const upd = await fetch(
        `${SUPABASE_URL}/rest/v1/reservistes?benevole_id=eq.${r.benevole_id}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ latitude: coords.lat, longitude: coords.lon })
        }
      )
      if (upd.ok) {
        console.log(`✓ ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)} [${coords.source}]`)
        succes++
      } else {
        console.log(`✗ Erreur DB`)
        echecs++
      }
    } else {
      console.log(`✗ Non trouvé`)
      echecs++
    }

    if ((i + 1) % 50 === 0) {
      console.log(`\n--- Pause 5s (${i+1} traités, ${succes} succès) ---\n`)
      await sleep(5000)
    }
  }

  console.log(`\n=== Terminé ===`)
  console.log(`✓ Succès : ${succes}`)
  console.log(`✗ Échecs : ${echecs}`)
}

main().catch(console.error)
