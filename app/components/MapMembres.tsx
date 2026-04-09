'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MembrePosition {
  benevole_id: string
  prenom: string
  nom: string
  ville: string | null
  groupe: string
  latitude: number
  longitude: number
}

type FiltreGroupe = 'Tous' | 'Approuvé' | 'Intérêt'

interface PinReference {
  nom: string
  latitude: number
  longitude: number
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const NAVY  = '#1e3a5f'
const AMBER = '#d97706'
const RED   = '#dc2626'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'
const WHITE = '#ffffff'

const GROUPE_COLORS: Record<string, string> = {
  'Approuvé': NAVY,
  'Intérêt':  AMBER,
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
const MAPBOX_GL_VERSION = '3.4.0'
const MAPBOX_CSS = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`
const MAPBOX_JS = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`

// ─── Loader CDN ─────────────────────────────────────────────────────────────

let mapboxPromise: Promise<any> | null = null

function loadMapboxGL(): Promise<any> {
  if (mapboxPromise) return mapboxPromise

  mapboxPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPBOX_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = MAPBOX_CSS
      document.head.appendChild(link)
    }

    if ((window as any).mapboxgl) {
      resolve((window as any).mapboxgl)
      return
    }

    const script = document.createElement('script')
    script.src = MAPBOX_JS
    script.onload = () => resolve((window as any).mapboxgl)
    script.onerror = () => reject(new Error('Impossible de charger mapbox-gl'))
    document.head.appendChild(script)
  })

  return mapboxPromise
}

// ─── Geocoding ──────────────────────────────────────────────────────────────

async function geocodeVille(query: string): Promise<{ nom: string; lat: number; lng: number } | null> {
  // Si l'utilisateur entre des coordonnees (ex: "47.5, -72.8")
  const coordMatch = query.match(/^(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)$/)
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1])
    const lng = parseFloat(coordMatch[2])
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { nom: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng }
    }
  }

  // Sinon, geocoder via Mapbox
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=ca&limit=1&language=fr`
    const res = await fetch(url)
    const data = await res.json()
    if (data.features?.length > 0) {
      const f = data.features[0]
      return {
        nom: f.place_name_fr || f.place_name || query,
        lat: f.center[1],
        lng: f.center[0],
      }
    }
  } catch (err) {
    console.error('Erreur geocodage:', err)
  }
  return null
}

// ─── Composant ──────────────────────────────────────────────────────────────

export default function MapMembres() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const pinMarkerRef = useRef<any>(null)
  const pinPopupRef = useRef<any>(null)
  const popupRef = useRef<any>(null)

  const [membres, setMembres] = useState<MembrePosition[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<FiltreGroupe>('Tous')
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(false)

  // Pin de reference
  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [pin, setPin] = useState<PinReference | null>(null)

  // Charger les positions des membres (tous actifs, puis filtrer ceux avec coordonnees)
  const [totaux, setTotaux] = useState({ total: 0, approuves: 0, interet: 0 })
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('reservistes')
      .select('benevole_id, prenom, nom, ville, groupe, latitude, longitude')
      .in('groupe', ['Approuvé', 'Intérêt'])
      .eq('statut', 'Actif')
      .then(({ data, error }) => {
        if (error) {
          console.error('Erreur chargement positions:', error)
          setMapError(true)
        } else {
          const all = (data || []) as MembrePosition[]
          setTotaux({
            total: all.length,
            approuves: all.filter(m => m.groupe === 'Approuvé').length,
            interet: all.filter(m => m.groupe === 'Intérêt').length,
          })
          // Ne garder que ceux avec des coordonnees valides pour la carte
          setMembres(all.filter(m => m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0))
        }
        setLoading(false)
      })
  }, [])

  // Initialiser la carte via CDN
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current) return

    let cancelled = false

    loadMapboxGL().then(mapboxgl => {
      if (cancelled || !mapContainerRef.current) return

      mapboxgl.accessToken = MAPBOX_TOKEN

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-71.5, 47.0],
        zoom: 5.5,
        attributionControl: false,
      })

      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')

      map.on('load', () => {
        if (!cancelled) {
          mapRef.current = map
          setMapReady(true)
        }
      })
    }).catch(() => {
      if (!cancelled) setMapError(true)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Filtrer selon le groupe selectionne
  const membresFiltres = useMemo(() => {
    if (filtre === 'Tous') return membres
    return membres.filter(m => m.groupe === filtre)
  }, [membres, filtre])

  // Compteurs
  const counts = useMemo(() => ({
    total: membres.length,
    approuves: membres.filter(m => m.groupe === 'Approuvé').length,
    interet: membres.filter(m => m.groupe === 'Intérêt').length,
  }), [membres])

  // Mettre a jour les markers quand le filtre ou les donnees changent
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    // Supprimer les anciens markers membres (pas le pin)
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl) return

    membresFiltres.forEach(m => {
      const el = document.createElement('div')
      el.style.width = '12px'
      el.style.height = '12px'
      el.style.borderRadius = '50%'
      el.style.backgroundColor = GROUPE_COLORS[m.groupe] || MUTED
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'
      el.style.cursor = 'pointer'

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([m.longitude, m.latitude])
        .addTo(mapRef.current)

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (popupRef.current) popupRef.current.remove()

        const popup = new mapboxgl.Popup({ offset: 8, closeOnClick: false, maxWidth: '220px' })
          .setLngLat([m.longitude, m.latitude])
          .setHTML(`
            <div style="padding:4px 2px;font-size:13px;line-height:1.4;font-family:system-ui,-apple-system,sans-serif">
              <div style="font-weight:700;color:${NAVY}">${m.prenom} ${m.nom}</div>
              ${m.ville ? `<div style="color:${MUTED};font-size:12px">${m.ville}</div>` : ''}
              <div style="display:inline-block;margin-top:4px;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${m.groupe === 'Approuvé' ? '#dbeafe' : '#fef3c7'};color:${m.groupe === 'Approuvé' ? NAVY : AMBER}">
                ${m.groupe === 'Approuvé' ? 'Qualifié' : 'Intérêt'}
              </div>
            </div>
          `)
          .addTo(mapRef.current)

        popupRef.current = popup
      })

      markersRef.current.push(marker)
    })
  }, [membresFiltres, mapReady])

  // Placer/retirer le pin de reference
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl) return

    // Supprimer l'ancien pin et son popup
    if (pinMarkerRef.current) {
      pinMarkerRef.current.remove()
      pinMarkerRef.current = null
    }
    if (pinPopupRef.current) {
      pinPopupRef.current.remove()
      pinPopupRef.current = null
    }

    if (!pin) return

    // Creer le pin rouge distinctif (SVG drop pin)
    const el = document.createElement('div')
    el.innerHTML = `
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));cursor:pointer">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="${RED}"/>
        <circle cx="16" cy="15" r="7" fill="white"/>
        <circle cx="16" cy="15" r="3.5" fill="${RED}"/>
      </svg>
    `
    el.style.cursor = 'pointer'

    const pinMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([pin.longitude, pin.latitude])
      .addTo(mapRef.current)

    // Popup permanent sur le pin
    const pinPopup = new mapboxgl.Popup({ offset: [0, -42], closeButton: false, closeOnClick: false, className: 'pin-ref-popup' })
      .setLngLat([pin.longitude, pin.latitude])
      .setHTML(`<div style="padding:3px 8px;font-size:12px;font-weight:700;color:${RED};font-family:system-ui,-apple-system,sans-serif;white-space:nowrap">${pin.nom}</div>`)
      .addTo(mapRef.current)
    pinPopupRef.current = pinPopup

    pinMarkerRef.current = pinMarker

    // Centrer la carte sur le pin avec un zoom raisonnable
    mapRef.current.flyTo({ center: [pin.longitude, pin.latitude], zoom: 7, duration: 1200 })
  }, [pin, mapReady])

  // Recherche
  const handleSearch = async () => {
    const q = searchInput.trim()
    if (!q) return

    setSearching(true)
    const result = await geocodeVille(q)
    setSearching(false)

    if (result) {
      setPin({ nom: result.nom, latitude: result.lat, longitude: result.lng })
    } else {
      alert(`Lieu introuvable : "${q}"`)
    }
  }

  const handleClearPin = () => {
    setPin(null)
    setSearchInput('')
    // Retirer le popup du pin aussi
    if (mapRef.current) {
      // Les popups permanents sont des enfants du container, on les laisse se nettoyer avec le marker
    }
    // Recentrer
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [-71.5, 47.0], zoom: 5.5, duration: 800 })
    }
  }

  const filtres: { key: FiltreGroupe; label: string; count: number; color: string }[] = [
    { key: 'Tous',     label: 'Tous',      count: totaux.total,     color: MUTED },
    { key: 'Approuvé', label: 'Qualifiés',  count: totaux.approuves, color: NAVY },
    { key: 'Intérêt',  label: 'Intérêt',    count: totaux.interet,   color: AMBER },
  ]

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 13 }}>
        Token Mapbox non configuré.
      </div>
    )
  }

  return (
    <div>
      {/* Barre de filtres + recherche */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {filtres.map(f => {
          const active = filtre === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFiltre(f.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${active ? f.color : BORDER}`,
                backgroundColor: active ? (f.color === MUTED ? '#f3f4f6' : f.color + '14') : WHITE,
                color: active ? f.color : MUTED,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {f.label}
              <span style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 700,
                backgroundColor: active ? f.color : '#f3f4f6',
                color: active ? WHITE : MUTED,
              }}>
                {f.count}
              </span>
            </button>
          )
        })}

        {/* Separateur */}
        <div style={{ width: 1, height: 24, backgroundColor: BORDER, margin: '0 4px' }} />

        {/* Recherche lieu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Placer un repere (ville ou lat, lng)"
            style={{
              padding: '5px 10px', borderRadius: 8, fontSize: 12,
              border: `1.5px solid ${pin ? RED : BORDER}`,
              outline: 'none', width: 220, color: '#374151',
              backgroundColor: pin ? '#fef2f2' : WHITE,
            }}
          />
          {!pin ? (
            <button
              onClick={handleSearch}
              disabled={searching || !searchInput.trim()}
              style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                border: `1.5px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY,
                cursor: searching || !searchInput.trim() ? 'default' : 'pointer',
                opacity: searching || !searchInput.trim() ? 0.5 : 1,
              }}
            >
              {searching ? '...' : 'Placer'}
            </button>
          ) : (
            <button
              onClick={handleClearPin}
              style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                border: `1.5px solid ${RED}`, backgroundColor: '#fef2f2', color: RED,
                cursor: 'pointer',
              }}
            >
              Retirer
            </button>
          )}
        </div>

        {loading && (
          <span style={{ fontSize: 12, color: MUTED, marginLeft: 8 }}>Chargement...</span>
        )}
      </div>

      {/* Carte */}
      <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}`, height: 420, position: 'relative' }}>
        {mapError ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>
            Erreur lors du chargement de la carte.
          </div>
        ) : (
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        )}
        {/* Bouton recentrer (toujours visible) */}
        {mapReady && (
          <button
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.flyTo({ center: [-71.5, 47.0], zoom: 5.5, bearing: 0, pitch: 0, duration: 800 })
              }
            }}
            title="Recentrer la carte (nord en haut)"
            style={{
              position: 'absolute', top: 10, right: 50,
              width: 30, height: 30, borderRadius: 4,
              backgroundColor: WHITE, border: `1px solid ${BORDER}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3,11 12,2 21,11" fill="#dc2626" stroke="#dc2626" />
              <polygon points="3,13 12,22 21,13" fill={WHITE} stroke={NAVY} />
              <circle cx="12" cy="12" r="2" fill={NAVY} stroke={NAVY} />
            </svg>
          </button>
        )}
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: MUTED, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: NAVY }} />
          Qualifiés
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: AMBER }} />
          Intérêt
        </div>
        {pin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: RED, fontWeight: 600 }}>
            <svg width="10" height="14" viewBox="0 0 32 42" fill={RED}><path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z"/></svg>
            {pin.nom}
          </div>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {membresFiltres.length} sur la carte
          {(() => {
            const totalFiltre = filtre === 'Tous' ? totaux.total : filtre === 'Approuvé' ? totaux.approuves : totaux.interet
            const manquants = totalFiltre - membresFiltres.length
            return manquants > 0 ? ` (${manquants} sans coordonnées)` : ''
          })()}
        </span>
      </div>
    </div>
  )
}
