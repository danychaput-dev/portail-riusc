'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
// @ts-expect-error — react-map-gl n'a pas de types inclus pour cette version
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
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
const YELLOW = '#ffd166'

const GROUPE_COLORS: Record<string, string> = {
  'Approuvé': NAVY,
  'Intérêt':  AMBER,
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

// Centre du Québec
const INITIAL_VIEW = {
  longitude: -71.5,
  latitude: 47.0,
  zoom: 5.5,
}

// ─── Composant ──────────────────────────────────────────────────────────────

export default function MapMembres() {
  const [membres, setMembres] = useState<MembrePosition[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<FiltreGroupe>('Tous')
  const [popupInfo, setPopupInfo] = useState<MembrePosition | null>(null)
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

  // Filtrer selon le groupe sélectionné
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
              onClick={() => { setFiltre(f.key); setPopupInfo(null) }}
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
          <Map
            initialViewState={INITIAL_VIEW}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/light-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
            attributionControl={false}
          >
            <NavigationControl position="top-right" showCompass={false} />

            {membresFiltres.map(m => (
              <Marker
                key={m.benevole_id}
                longitude={m.longitude}
                latitude={m.latitude}
                anchor="center"
                onClick={(e: any) => {
                  e.originalEvent.stopPropagation()
                  setPopupInfo(m)
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: GROUPE_COLORS[m.groupe] || MUTED,
                    border: '2px solid white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                  }}
                />
              </Marker>
            ))}

            {popupInfo && (
              <Popup
                longitude={popupInfo.longitude}
                latitude={popupInfo.latitude}
                anchor="bottom"
                onClose={() => setPopupInfo(null)}
                closeOnClick={false}
                offset={8}
              >
                <div style={{ padding: '4px 2px', fontSize: 13, lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 700, color: NAVY }}>
                    {popupInfo.prenom} {popupInfo.nom}
                  </div>
                  {popupInfo.ville && (
                    <div style={{ color: MUTED, fontSize: 12 }}>{popupInfo.ville}</div>
                  )}
                  <div style={{
                    display: 'inline-block', marginTop: 4,
                    padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                    backgroundColor: popupInfo.groupe === 'Approuvé' ? '#dbeafe' : '#fef3c7',
                    color: popupInfo.groupe === 'Approuvé' ? NAVY : AMBER,
                  }}>
                    {popupInfo.groupe === 'Approuvé' ? 'Qualifié' : 'Intérêt'}
                  </div>
                </div>
              </Popup>
            )}
          </Map>
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
