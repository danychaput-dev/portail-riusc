'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MembreBasic {
  benevole_id: string
  prenom: string
  nom: string
  ville: string | null
  groupe: string
  latitude: number
  longitude: number
}

interface MembreAdmin extends MembreBasic {
  email: string | null
  telephone: string | null
  adresse: string | null
  region: string | null
  date_naissance: string | null
  contact_urgence_nom: string | null
  contact_urgence_telephone: string | null
  antecedents_statut: string | null
  antecedents_date_expiration: string | null
  initiation_sc: boolean
  camp_complete: boolean
  // Calculs locaux
  deployable: boolean
  missing: string[]
}

type Membre = MembreBasic | MembreAdmin

type FiltreGroupe = 'Tous' | 'Approuvé' | 'Intérêt'
type FiltreDeploy = 'Tous' | 'Déployables' | 'Non-déployables'

interface PinReference {
  nom: string
  latitude: number
  longitude: number
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const NAVY   = '#1e3a5f'
const AMBER  = '#d97706'
const RED    = '#dc2626'
const GREEN  = '#16a34a'
const MUTED  = '#6b7280'
const BORDER = '#e5e7eb'
const WHITE  = '#ffffff'

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
  const coordMatch = query.match(/^(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)$/)
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1])
    const lng = parseFloat(coordMatch[2])
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { nom: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng }
    }
  }

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

// ─── Déployabilité ──────────────────────────────────────────────────────────

// Critères identiques à /admin/reservistes (isDeployable).
function computeDeployable(m: any): { deployable: boolean; missing: string[] } {
  const missing: string[] = []

  const profilComplet = !!(
    m.prenom && m.nom && m.email && m.telephone &&
    m.date_naissance && m.adresse && m.ville && m.region &&
    m.contact_urgence_nom && m.contact_urgence_telephone
  )
  if (!profilComplet) missing.push('Profil incomplet')

  if (m.initiation_sc !== true) missing.push('Initiation SC')
  if (m.camp_complete !== true) missing.push('Camp de qualification')

  const antExpire = m.antecedents_date_expiration && new Date(m.antecedents_date_expiration) < new Date()
  const antOk = m.antecedents_statut === 'verifie' && !antExpire
  if (!antOk) {
    if (m.antecedents_statut === 'verifie' && antExpire) missing.push('Antécédents expirés')
    else missing.push('Antécédents non vérifiés')
  }

  return { deployable: missing.length === 0, missing }
}

function isAdminMembre(m: Membre): m is MembreAdmin {
  return 'deployable' in m
}

// ─── Composant ──────────────────────────────────────────────────────────────

export default function MapMembres() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const pinMarkerRef = useRef<any>(null)
  const pinPopupRef = useRef<any>(null)
  const popupRef = useRef<any>(null)
  const hoverPopupRef = useRef<any>(null)

  // Rôle — seulement admin/superadmin ont accès au filtre déployabilité
  const [role, setRole] = useState<string | null>(null)
  const isAdminFull = role === 'admin' || role === 'superadmin'

  const [membres, setMembres] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<FiltreGroupe>('Tous')
  const [filtreDeploy, setFiltreDeploy] = useState<FiltreDeploy>('Tous')
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [pin, setPin] = useState<PinReference | null>(null)

  const [totaux, setTotaux] = useState({ total: 0, approuves: 0, interet: 0, deployables: 0, nonDeployables: 0 })

  // Charger le rôle
  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (data?.role) setRole(data.role)
    })()
  }, [])

  // Charger les positions — mode admin plein (admin/superadmin) = fetch enrichi,
  // sinon fallback direct Supabase (data de base uniquement).
  useEffect(() => {
    if (role === null) return  // Attendre la détection du rôle
    setLoading(true)

    if (isAdminFull) {
      // Mode enrichi via l'API admin (initiation_sc + camp_complete déjà calculés)
      fetch('/api/admin/reservistes?groupes=' + encodeURIComponent('Approuvé,Intérêt'))
        .then(r => r.json())
        .then(json => {
          const enriched: MembreAdmin[] = (json.data || []).map((r: any) => {
            const { deployable, missing } = computeDeployable(r)
            return {
              benevole_id: r.benevole_id,
              prenom: r.prenom || '',
              nom: r.nom || '',
              ville: r.ville || null,
              groupe: r.groupe || '',
              latitude: r.latitude || 0,
              longitude: r.longitude || 0,
              email: r.email || null,
              telephone: r.telephone || null,
              adresse: r.adresse || null,
              region: r.region || null,
              date_naissance: r.date_naissance || null,
              contact_urgence_nom: r.contact_urgence_nom || null,
              contact_urgence_telephone: r.contact_urgence_telephone || null,
              antecedents_statut: r.antecedents_statut || null,
              antecedents_date_expiration: r.antecedents_date_expiration || null,
              initiation_sc: !!r.initiation_sc,
              camp_complete: !!r.camp_complete,
              deployable,
              missing,
            }
          })
          const withCoords = enriched.filter(m => m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0)
          setTotaux({
            total: enriched.length,
            approuves: enriched.filter(m => m.groupe === 'Approuvé').length,
            interet: enriched.filter(m => m.groupe === 'Intérêt').length,
            deployables: enriched.filter(m => m.deployable).length,
            nonDeployables: enriched.filter(m => !m.deployable).length,
          })
          setMembres(withCoords)
          setLoading(false)
        })
        .catch(err => {
          console.error('Erreur chargement carte admin:', err)
          setMapError(true)
          setLoading(false)
        })
    } else {
      // Mode basic (coord/adjoint/autres) — direct Supabase, pas de déployabilité
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
            const all = (data || []) as MembreBasic[]
            setTotaux({
              total: all.length,
              approuves: all.filter(m => m.groupe === 'Approuvé').length,
              interet: all.filter(m => m.groupe === 'Intérêt').length,
              deployables: 0,
              nonDeployables: 0,
            })
            setMembres(all.filter(m => m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0))
          }
          setLoading(false)
        })
    }
  }, [role, isAdminFull])

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

  // Filtrer selon groupe ET déployabilité
  const membresFiltres = useMemo(() => {
    let result = membres
    if (filtre !== 'Tous') {
      result = result.filter(m => m.groupe === filtre)
    }
    if (isAdminFull && filtreDeploy !== 'Tous') {
      result = result.filter(m => {
        if (!isAdminMembre(m)) return false
        return filtreDeploy === 'Déployables' ? m.deployable : !m.deployable
      })
    }
    return result
  }, [membres, filtre, filtreDeploy, isAdminFull])

  // Mettre a jour les markers quand le filtre ou les donnees changent
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }
    if (hoverPopupRef.current) {
      hoverPopupRef.current.remove()
      hoverPopupRef.current = null
    }

    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl) return

    membresFiltres.forEach(m => {
      const groupeColor = GROUPE_COLORS[m.groupe] || MUTED
      const admin = isAdminMembre(m)

      const el = document.createElement('div')
      el.style.width = '12px'
      el.style.height = '12px'
      el.style.borderRadius = '50%'
      el.style.backgroundColor = groupeColor
      // En mode admin, un liseré coloré indique la déployabilité
      el.style.border = admin
        ? `2px solid ${m.deployable ? GREEN : RED}`
        : '2px solid white'
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'
      el.style.cursor = 'pointer'

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([m.longitude, m.latitude])
        .addTo(mapRef.current)

      // Hover popup (admin uniquement — montre la déployabilité)
      if (admin) {
        el.addEventListener('mouseenter', () => {
          if (hoverPopupRef.current) hoverPopupRef.current.remove()
          const statusHTML = m.deployable
            ? `<div style="color:${GREEN};font-weight:700">✓ Déployable</div>`
            : `<div style="color:${RED};font-weight:700;margin-bottom:3px">⚠ Non déployable</div>
               <div style="font-size:11px;color:${MUTED}">Manque :</div>
               <ul style="margin:2px 0 0 14px;padding:0;font-size:11px;color:${RED}">
                 ${m.missing.map(x => `<li>${x}</li>`).join('')}
               </ul>`
          const popup = new mapboxgl.Popup({ offset: 12, closeButton: false, closeOnClick: false, maxWidth: '240px' })
            .setLngLat([m.longitude, m.latitude])
            .setHTML(`
              <div style="padding:4px 2px;font-size:12px;line-height:1.4;font-family:system-ui,-apple-system,sans-serif">
                <div style="font-weight:700;color:${NAVY};margin-bottom:2px">${m.prenom} ${m.nom}</div>
                ${m.ville ? `<div style="color:${MUTED};font-size:11px;margin-bottom:4px">${m.ville}</div>` : ''}
                ${statusHTML}
              </div>
            `)
            .addTo(mapRef.current)
          hoverPopupRef.current = popup
        })

        el.addEventListener('mouseleave', () => {
          if (hoverPopupRef.current) {
            hoverPopupRef.current.remove()
            hoverPopupRef.current = null
          }
        })
      }

      // Click popup (détail complet)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (popupRef.current) popupRef.current.remove()
        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove()
          hoverPopupRef.current = null
        }

        const groupeBadge = `
          <div style="display:inline-block;margin-top:4px;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${m.groupe === 'Approuvé' ? '#dbeafe' : '#fef3c7'};color:${m.groupe === 'Approuvé' ? NAVY : AMBER}">
            ${m.groupe === 'Approuvé' ? 'Qualifié' : 'Intérêt'}
          </div>`

        const deployBadge = admin
          ? (m.deployable
              ? `<div style="display:inline-block;margin:4px 0 0 6px;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#dcfce7;color:${GREEN}">✓ Déployable</div>`
              : `<div style="margin-top:6px;padding:6px 8px;border-radius:6px;background:#fef2f2;color:${RED};font-size:11px">
                   <div style="font-weight:700;margin-bottom:2px">Non déployable — manque :</div>
                   <ul style="margin:0;padding-left:16px">${m.missing.map(x => `<li>${x}</li>`).join('')}</ul>
                 </div>`)
          : ''

        const popup = new mapboxgl.Popup({ offset: 8, closeOnClick: false, maxWidth: '260px' })
          .setLngLat([m.longitude, m.latitude])
          .setHTML(`
            <div style="padding:4px 2px;font-size:13px;line-height:1.4;font-family:system-ui,-apple-system,sans-serif">
              <div style="font-weight:700;color:${NAVY}">${m.prenom} ${m.nom}</div>
              ${m.ville ? `<div style="color:${MUTED};font-size:12px">${m.ville}</div>` : ''}
              ${groupeBadge}${deployBadge}
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

    if (pinMarkerRef.current) {
      pinMarkerRef.current.remove()
      pinMarkerRef.current = null
    }
    if (pinPopupRef.current) {
      pinPopupRef.current.remove()
      pinPopupRef.current = null
    }

    if (!pin) return

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

    const pinPopup = new mapboxgl.Popup({ offset: [0, -42], closeButton: false, closeOnClick: false, className: 'pin-ref-popup' })
      .setLngLat([pin.longitude, pin.latitude])
      .setHTML(`<div style="padding:3px 8px;font-size:12px;font-weight:700;color:${RED};font-family:system-ui,-apple-system,sans-serif;white-space:nowrap">${pin.nom}</div>`)
      .addTo(mapRef.current)
    pinPopupRef.current = pinPopup

    pinMarkerRef.current = pinMarker

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
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [-71.5, 47.0], zoom: 5.5, duration: 800 })
    }
  }

  const filtres: { key: FiltreGroupe; label: string; count: number; color: string }[] = [
    { key: 'Tous',     label: 'Tous',      count: totaux.total,     color: MUTED },
    { key: 'Approuvé', label: 'Qualifiés',  count: totaux.approuves, color: NAVY },
    { key: 'Intérêt',  label: 'Intérêt',    count: totaux.interet,   color: AMBER },
  ]

  const filtresDeploy: { key: FiltreDeploy; label: string; count: number; color: string }[] = [
    { key: 'Tous',            label: 'Tous',             count: totaux.total,          color: MUTED },
    { key: 'Déployables',     label: 'Déployables',      count: totaux.deployables,    color: GREEN },
    { key: 'Non-déployables', label: 'Non-déployables',  count: totaux.nonDeployables, color: RED },
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

      {/* Barre de filtres déployabilité — admin/superadmin uniquement */}
      {isAdminFull && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Déployabilité :
          </span>
          {filtresDeploy.map(f => {
            const active = filtreDeploy === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFiltreDeploy(f.key)}
                title={f.key === 'Déployables' ? 'Profil complet + Initiation SC + Camp + Antécédents vérifiés' : undefined}
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
        </div>
      )}

      {/* Carte */}
      <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}`, height: 420, position: 'relative' }}>
        {mapError ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>
            Erreur lors du chargement de la carte.
          </div>
        ) : (
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        )}
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
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: MUTED, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: NAVY }} />
          Qualifiés
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: AMBER }} />
          Intérêt
        </div>
        {isAdminFull && (
          <>
            <div style={{ width: 1, height: 14, backgroundColor: BORDER }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: NAVY, border: `2px solid ${GREEN}`, boxSizing: 'border-box' }} />
              Déployable
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: NAVY, border: `2px solid ${RED}`, boxSizing: 'border-box' }} />
              Non déployable
            </div>
          </>
        )}
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
            const manquants = totalFiltre - membres.filter(m => filtre === 'Tous' || m.groupe === filtre).length
            return manquants > 0 ? ` (${manquants} sans coordonnées)` : ''
          })()}
        </span>
      </div>
    </div>
  )
}
