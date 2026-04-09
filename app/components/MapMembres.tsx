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

// ─── Constantes ─────────────────────────────────────────────────────────────

const NAVY  = '#1e3a5f'
const AMBER = '#d97706'
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
    // CSS
    if (!document.querySelector(`link[href="${MAPBOX_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = MAPBOX_CSS
      document.head.appendChild(link)
    }

    // JS — si deja charge
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

// ─── Composant ──────────────────────────────────────────────────────────────

export default function MapMembres() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const popupRef = useRef<any>(null)

  const [membres, setMembres] = useState<MembrePosition[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<FiltreGroupe>('Tous')
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(false)

  // Charger les positions des membres
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('reservistes')
      .select('benevole_id, prenom, nom, ville, groupe, latitude, longitude')
      .in('groupe', ['Approuvé', 'Intérêt'])
      .eq('statut', 'Actif')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .then(({ data, error }) => {
        if (error) {
          console.error('Erreur chargement positions:', error)
          setMapError(true)
        } else {
          setMembres((data || []) as MembrePosition[])
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

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

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

    // Supprimer les anciens markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl) return

    membresFiltres.forEach(m => {
      // Creer le dot
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

        // Fermer le popup precedent
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

  const filtres: { key: FiltreGroupe; label: string; count: number; color: string }[] = [
    { key: 'Tous',     label: 'Tous',      count: counts.total,     color: MUTED },
    { key: 'Approuvé', label: 'Qualifiés',  count: counts.approuves, color: NAVY },
    { key: 'Intérêt',  label: 'Intérêt',    count: counts.interet,   color: AMBER },
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
      {/* Barre de filtres */}
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

        {loading && (
          <span style={{ fontSize: 12, color: MUTED, marginLeft: 8 }}>Chargement...</span>
        )}
      </div>

      {/* Carte */}
      <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}`, height: 420 }}>
        {mapError ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>
            Erreur lors du chargement de la carte.
          </div>
        ) : (
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        )}
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: MUTED }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: NAVY }} />
          Qualifiés
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: AMBER }} />
          Intérêt
        </div>
        <span style={{ marginLeft: 'auto' }}>
          {membresFiltres.length} membre{membresFiltres.length > 1 ? 's' : ''} géolocalisé{membresFiltres.length > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
