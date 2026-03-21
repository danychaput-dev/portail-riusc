// geocode-postaux.js
// Géocode les réservistes avec code_postal mais sans latitude/longitude
// Usage: node geocode-postaux.js
//
// Variables d'environnement requises:
//   SUPABASE_URL=https://jtzwkmcfarxptpcoaxxl.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=votre_cle

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

// Délai entre les requêtes (ms) — respecter les limites des APIs
const DELAI_GEOCODERCA = 300
const DELAI_NOMINATIM = 1100

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Nettoyer le code postal — garder seulement les 3 premiers caractères (FSA)
// ou le code complet formaté A1A 1A1
function nettoyerCodePostal(cp) {
  if (!cp) return null
  const clean = cp.replace(/\s+/g, '').toUpperCase()
  if (clean.length < 3) return null
  // Format: A1A1A1 → A1A 1A1
  if (clean.length === 6) return `${clean.slice(0,3)} ${clean.slice(3)}`
  if (clean.length === 7 && clean[3] === ' ') return clean
  // FSA seulement (3 chars)
  if (clean.length >= 3) return clean.slice(0, 3)
  return null
}

// Géocodage via geocoder.ca
async function geocoderCA(codePostal) {
  try {
    const cp = encodeURIComponent(codePostal)
    const res = await fetch(`https://geocoder.ca/${cp}?json=1`, {
      headers: { 'User-Agent': 'portail.riusc.ca (contact@aqbrs.ca)' }
    })
    const data = await res.json()
    if (data?.latt && data?.longt) {
      const lat = parseFloat(data.latt)
      const lon = parseFloat(data.longt)
      if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
        return { lat, lon, source: 'geocoder.ca' }
      }
    }
  } catch {}
  return null
}

// Géocodage via Nominatim (fallback)
async function nominatim(codePostal) {
  try {
    const q = encodeURIComponent(`${codePostal}, Canada`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ca`,
      {
        headers: {
          'User-Agent': 'portail.riusc.ca (contact@aqbrs.ca)',
          'Accept-Language': 'fr'
        }
      }
    )
    const data = await res.json()
    if (data?.[0]?.lat && data?.[0]?.lon) {
      const lat = parseFloat(data[0].lat)
      const lon = parseFloat(data[0].lon)
      if (!isNaN(lat) && !isNaN(lon)) {
        return { lat, lon, source: 'nominatim' }
      }
    }
  } catch {}
  return null
}

async function main() {
  console.log('Chargement des réservistes sans coordonnées...')

  // Récupérer tous les réservistes avec code postal mais sans coords
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reservistes?select=benevole_id,prenom,nom,code_postal&role=eq.reserviste&latitude=is.null&code_postal=not.is.null&code_postal=neq.`,
    { headers }
  )
  const reservistes = await res.json()

  console.log(`${reservistes.length} réservistes à géocoder`)

  let succes = 0
  let echecs = 0
  let dejaFait = 0

  for (let i = 0; i < reservistes.length; i++) {
    const r = reservistes[i]
    const cp = nettoyerCodePostal(r.code_postal)

    if (!cp) {
      echecs++
      continue
    }

    process.stdout.write(`[${i+1}/${reservistes.length}] ${r.prenom} ${r.nom} (${cp}) → `)

    // Essai 1: geocoder.ca
    let coords = await geocoderCA(cp)
    await sleep(DELAI_GEOCODERCA)

    // Essai 2: Nominatim si geocoder.ca échoue
    if (!coords) {
      coords = await nominatim(cp)
      await sleep(DELAI_NOMINATIM)
    }

    if (coords) {
      // Mettre à jour Supabase
      const upd = await fetch(
        `${SUPABASE_URL}/rest/v1/reservistes?benevole_id=eq.${r.benevole_id}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ latitude: coords.lat, longitude: coords.lon })
        }
      )
      if (upd.ok) {
        console.log(`✓ ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)} (${coords.source})`)
        succes++
      } else {
        console.log(`✗ Erreur DB`)
        echecs++
      }
    } else {
      console.log(`✗ Non trouvé`)
      echecs++
    }

    // Pause toutes les 50 requêtes
    if ((i + 1) % 50 === 0) {
      console.log(`\n--- Pause 5s (${i+1} traités) ---\n`)
      await sleep(5000)
    }
  }

  console.log(`\n=== Terminé ===`)
  console.log(`✓ Succès : ${succes}`)
  console.log(`✗ Échecs : ${echecs}`)
  console.log(`- Déjà fait : ${dejaFait}`)
}

main().catch(console.error)
