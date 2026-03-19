'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Sinistre  { id: string; nom: string; statut: string; lieu: string; date_debut: string }
interface Deployment { id: string; identifiant: string; nom: string; statut: string; nb_personnes_par_vague: number; date_debut: string; date_fin: string; lieu: string }
interface Vague     { id: string; identifiant: string; numero: number; date_debut: string; date_fin: string; nb_personnes_requis: number; statut: string }
interface Langue    { id: string; nom: string }

interface Candidat {
  benevole_id: string; prenom: string; nom: string; telephone: string
  region: string; ville: string; preference_tache: string
  deployable: boolean; en_deploiement_actif: boolean
  rotations_consecutives: number; repos_requis_jusqu: string | null
  raison_alerte: string | null; deja_cible: boolean
  latitude: number | null; longitude: number | null
  competence_rs: string[]; certificat_premiers_soins: string[]
  vehicule_tout_terrain: string[]; navire_marin: string[]
  permis_conduire: string[]; satp_drone: string[]; equipe_canine: string[]
  competences_securite: string[]; competences_sauvetage: string[]
  communication: string[]; cartographie_sig: string[]; operation_urgence: string[]
  langues: string[]
  distance_km?: number
}

interface Cible {
  id: string; benevole_id: string; niveau: string; reference_id: string
  statut: string; ajoute_par_ia: boolean
  reservistes: { prenom: string; nom: string; telephone: string; region: string; ville: string; preference_tache: string }
}

interface AISuggestion { benevole_id: string; raison: string }

// ── Constantes ────────────────────────────────────────────────
const C = '#1e3a5f'

const COMPETENCES = [
  { field: 'competence_rs',          label: 'Recherche & sauvetage' },
  { field: 'certificat_premiers_soins', label: 'Premiers soins' },
  { field: 'vehicule_tout_terrain',  label: 'Véhicule tout-terrain' },
  { field: 'navire_marin',           label: 'Navire / marin' },
  { field: 'permis_conduire',        label: 'Permis conduire' },
  { field: 'satp_drone',             label: 'Drone' },
  { field: 'equipe_canine',          label: 'Équipe canine' },
  { field: 'competences_securite',   label: 'Sécurité' },
  { field: 'competences_sauvetage',  label: 'Sauvetage' },
  { field: 'communication',          label: 'Communication' },
  { field: 'cartographie_sig',       label: 'Cartographie / SIG' },
  { field: 'operation_urgence',      label: 'Opérations urgence' },
]

// ── Haversine ─────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
}

// ── Helpers ───────────────────────────────────────────────────
function formatDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })
}

function badgePref(p: string) {
  if (p === 'terrain')   return { label: 'Terrain',   bg: '#e8f0f8', color: C }
  if (p === 'sinistres') return { label: 'Sinistrés', bg: '#f3e8ff', color: '#7c3aed' }
  return { label: 'Générale', bg: '#f1f5f9', color: '#64748b' }
}

// ── Composant principal ───────────────────────────────────────
export default function CiblagePage() {
  // Sélection
  const [sinistres,            setSinistres]            = useState<Sinistre[]>([])
  const [selectedSinistreId,   setSelectedSinistreId]   = useState('')
  const [deployments,          setDeployments]          = useState<Deployment[]>([])
  const [selectedDeploymentId, setSelectedDeploymentId] = useState('')
  const [selectedDeployment,   setSelectedDeployment]   = useState<Deployment | null>(null)
  const [niveau,               setNiveau]               = useState<'rotation'|'deploiement'>('deploiement')
  const [vagues,               setVagues]               = useState<Vague[]>([])
  const [selectedVagueId,      setSelectedVagueId]      = useState('')
  const [selectedVague,        setSelectedVague]        = useState<Vague | null>(null)

  // Data
  const [pool,          setPool]          = useState<Candidat[]>([])
  const [cibles,        setCibles]        = useState<Cible[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [langues,       setLangues]       = useState<Langue[]>([])

  // Géolocalisation déploiement
  const [depCoords,       setDepCoords]       = useState<{ lat: number; lon: number } | null>(null)
  const [geocoding,       setGeocoding]       = useState(false)
  const [trierDistance,   setTrierDistance]   = useState(false)

  // Filtres
  const [filtrePreference,  setFiltrePreference]  = useState('')
  const [filtreCompetences, setFiltreCompetences] = useState<string[]>([])
  const [filtreLangues,     setFiltreLangues]     = useState<string[]>([])
  const [recherche,         setRecherche]         = useState('')

  // Loading
  const [loadingSinistres,   setLoadingSinistres]   = useState(true)
  const [loadingDeployments, setLoadingDeployments] = useState(false)
  const [loadingVagues,      setLoadingVagues]      = useState(false)
  const [loadingPool,        setLoadingPool]        = useState(false)
  const [loadingAI,          setLoadingAI]          = useState(false)
  const [loadingNotif,       setLoadingNotif]       = useState(false)
  const [ajoutEnCours,       setAjoutEnCours]       = useState<string[]>([])
  const [notifEnvoyees,      setNotifEnvoyees]      = useState(false)
  const [erreur,             setErreur]             = useState<string | null>(null)

  // ── Computed ──────────────────────────────────────────────
  const referenceId = niveau === 'rotation' ? selectedVagueId : selectedDeploymentId
  const dateDeb = niveau === 'rotation' ? selectedVague?.date_debut : selectedDeployment?.date_debut
  const dateFinDeployment = selectedDeployment?.date_fin || (() => {
    if (!selectedDeployment?.date_debut) return undefined
    const d = new Date(selectedDeployment.date_debut + 'T00:00:00')
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })()
  const dateFin = niveau === 'rotation'
    ? (selectedVague?.date_fin || selectedVague?.date_debut)
    : dateFinDeployment

  const nbRequis    = niveau === 'rotation' ? (selectedVague?.nb_personnes_requis || 0) : (selectedDeployment?.nb_personnes_par_vague || 0)
  const ratioMin    = nbRequis * 3
  const ratioMax    = nbRequis * 4
  const pct         = ratioMax > 0 ? Math.min(100, Math.round((cibles.length / ratioMax) * 100)) : 0
  const dansLaFourchette = cibles.length >= ratioMin && cibles.length <= ratioMax
  const couleurJauge = dansLaFourchette ? '#22c55e' : cibles.length < ratioMin ? '#f59e0b' : '#3b82f6'
  const estPret = niveau === 'deploiement'
    ? !!selectedDeploymentId && !!selectedDeployment?.date_debut
    : !!selectedVagueId && !!selectedVague?.date_debut

  // Pool avec distance calculée
  const poolAvecDistance = pool.map(c => ({
    ...c,
    distance_km: (trierDistance && depCoords && c.latitude && c.longitude)
      ? haversine(depCoords.lat, depCoords.lon, c.latitude, c.longitude)
      : undefined
  }))

  // Pool non ciblé
  const poolNonCible = poolAvecDistance.filter(c => !c.deja_cible)

  // Filtres client-side
  const poolFiltre = poolNonCible.filter(c => {
    if (filtrePreference && c.preference_tache !== filtrePreference && c.preference_tache !== 'aucune') return false
    if (filtreCompetences.length > 0) {
      const hasAll = filtreCompetences.every(f => (c as any)[f]?.length > 0)
      if (!hasAll) return false
    }
    if (filtreLangues.length > 0) {
      const hasAll = filtreLangues.every(l => c.langues.includes(l))
      if (!hasAll) return false
    }
    if (recherche) {
      const q = recherche.toLowerCase()
      if (!`${c.prenom} ${c.nom}`.toLowerCase().includes(q) &&
          !c.ville?.toLowerCase().includes(q) &&
          !c.region?.toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    if (trierDistance && a.distance_km !== undefined && b.distance_km !== undefined) {
      return a.distance_km - b.distance_km
    }
    if (a.deployable !== b.deployable) return a.deployable ? -1 : 1
    return `${a.nom}${a.prenom}`.localeCompare(`${b.nom}${b.prenom}`)
  })

  const aiEnrichies = aiSuggestions
    .map(s => ({ ...s, candidat: poolAvecDistance.find(c => c.benevole_id === s.benevole_id) }))
    .filter(s => s.candidat && !s.candidat.deja_cible)

  // ── Géocodage Nominatim ───────────────────────────────────
  const geocoderLieu = useCallback(async (lieu: string) => {
    if (!lieu) return
    setGeocoding(true)
    try {
      const q = encodeURIComponent(`${lieu}, Québec, Canada`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'fr' }
      })
      const data = await res.json()
      if (data?.[0]) {
        setDepCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
      }
    } catch { /* silencieux */ }
    setGeocoding(false)
  }, [])

  // ── Chargements ───────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/ciblage?action=sinistres').then(r => r.json()).then(d => { setSinistres(d || []); setLoadingSinistres(false) })
    fetch('/api/admin/ciblage?action=langues').then(r => r.json()).then(d => setLangues(d || []))
  }, [])

  useEffect(() => {
    if (!selectedSinistreId) return
    setLoadingDeployments(true)
    setSelectedDeploymentId(''); setSelectedDeployment(null)
    setSelectedVagueId(''); setSelectedVague(null)
    setPool([]); setCibles([]); setAiSuggestions([]); setDepCoords(null)
    fetch(`/api/admin/ciblage?action=deployments&sinistre_id=${selectedSinistreId}`)
      .then(r => r.json()).then(d => { setDeployments(d || []); setLoadingDeployments(false) })
  }, [selectedSinistreId])

  useEffect(() => {
    if (!selectedDeploymentId) return
    setLoadingVagues(true)
    setSelectedVagueId(''); setSelectedVague(null)
    setPool([]); setCibles([]); setAiSuggestions([])
    const dep = deployments.find(d => d.id === selectedDeploymentId) || null
    setSelectedDeployment(dep)
    if (dep?.lieu) geocoderLieu(dep.lieu)
    fetch(`/api/admin/ciblage?action=vagues&deployment_id=${selectedDeploymentId}`)
      .then(r => r.json()).then(d => { setVagues(d || []); setLoadingVagues(false) })
  }, [selectedDeploymentId])

  const chargerPool = useCallback(async (refId: string, debut: string, fin: string, niv: string) => {
    setLoadingPool(true); setErreur(null); setAiSuggestions([])
    try {
      const [poolData, ciblagesData] = await Promise.all([
        fetch(`/api/admin/ciblage?action=pool&niveau=${niv}&reference_id=${refId}&date_debut=${debut}&date_fin=${fin}`).then(r => r.json()),
        fetch(`/api/admin/ciblage?action=ciblages&reference_id=${refId}`).then(r => r.json())
      ])
      if (poolData.error) setErreur(poolData.error)
      else { setPool(poolData || []); setCibles(ciblagesData || []) }
    } catch { setErreur('Erreur réseau') }
    setLoadingPool(false); setNotifEnvoyees(false)
  }, [])

  useEffect(() => {
    if (!referenceId || !dateDeb || !dateFin) return
    chargerPool(referenceId, dateDeb, dateFin, niveau)
  }, [referenceId, niveau])

  // ── Actions ───────────────────────────────────────────────
  const ajouter = async (candidat: Candidat, parIA = false) => {
    if (ajoutEnCours.includes(candidat.benevole_id)) return
    setAjoutEnCours(p => [...p, candidat.benevole_id])
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ajouter', niveau, reference_id: referenceId, benevole_id: candidat.benevole_id, ajoute_par_ia: parIA })
    })
    const data = await res.json()
    if (!data.error) {
      setPool(p => p.map(c => c.benevole_id === candidat.benevole_id ? { ...c, deja_cible: true } : c))
      setCibles(p => [...p, {
        id: data.id, benevole_id: candidat.benevole_id, niveau, reference_id: referenceId,
        statut: 'cible', ajoute_par_ia: parIA,
        reservistes: { prenom: candidat.prenom, nom: candidat.nom, telephone: candidat.telephone, region: candidat.region, ville: candidat.ville, preference_tache: candidat.preference_tache }
      }])
      setAiSuggestions(p => p.filter(s => s.benevole_id !== candidat.benevole_id))
    }
    setAjoutEnCours(p => p.filter(id => id !== candidat.benevole_id))
  }

  const retirer = async (cible: Cible) => {
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retirer', ciblage_id: cible.id })
    })
    const data = await res.json()
    if (!data.error) {
      setCibles(p => p.filter(c => c.id !== cible.id))
      setPool(p => p.map(c => c.benevole_id === cible.benevole_id ? { ...c, deja_cible: false } : c))
    }
  }

  const demanderAI = async () => {
    if (loadingAI) return
    setLoadingAI(true)
    const contexte = niveau === 'rotation'
      ? `Rotation ${selectedVague?.identifiant} — ${selectedDeployment?.nom} (${formatDate(dateDeb)} au ${formatDate(dateFin)})`
      : `Déploiement ${selectedDeployment?.identifiant} — ${selectedDeployment?.nom} — À partir du ${formatDate(dateDeb)}`
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ai-suggestions', pool: poolNonCible.slice(0, 100), cibles_actuels: cibles.map(c => c.benevole_id), nb_cible: ratioMax, context: contexte })
    })
    const data = await res.json()
    setAiSuggestions(data.suggestions || [])
    setLoadingAI(false)
  }

  const toutAjouterIA = async () => {
    for (const s of aiEnrichies) { if (s.candidat) await ajouter(s.candidat, true) }
  }

  const envoyerNotifications = async () => {
    if (cibles.length === 0 || loadingNotif) return
    setLoadingNotif(true)
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'notifier', reference_id: referenceId, niveau, ciblages: cibles })
    })
    const data = await res.json()
    setLoadingNotif(false)
    if (!data.error) { setNotifEnvoyees(true); setCibles(p => p.map(c => ({ ...c, statut: 'notifie' }))) }
  }

  const toggleComp = (f: string) => setFiltreCompetences(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f])
  const toggleLang = (n: string) => setFiltreLangues(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n])

  // ── Rendu ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ backgroundColor: C, color: 'white', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', flexShrink: 0 }}>
        <a href="/admin" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '13px' }}>← Admin</a>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '600' }}>Ciblage des réservistes</h1>
      </div>

      {/* Barre de sélection */}
      <div style={{ backgroundColor: 'white', padding: '12px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', flexShrink: 0 }}>
        <div>
          <label style={LS}>Sinistre</label>
          <select value={selectedSinistreId} onChange={e => setSelectedSinistreId(e.target.value)} style={{ ...SS, minWidth: '220px' }}>
            <option value="">— Sélectionner —</option>
            {sinistres.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Déploiement</label>
          <select value={selectedDeploymentId} onChange={e => setSelectedDeploymentId(e.target.value)} disabled={!selectedSinistreId} style={{ ...SS, minWidth: '260px', opacity: !selectedSinistreId ? 0.5 : 1 }}>
            <option value="">— Sélectionner —</option>
            {deployments.map(d => <option key={d.id} value={d.id}>{d.identifiant} — {d.nom}</option>)}
          </select>
        </div>
        {selectedDeploymentId && (
          <div>
            <label style={LS}>Niveau</label>
            <div style={{ display: 'flex', border: `1px solid ${C}`, borderRadius: '6px', overflow: 'hidden' }}>
              {(['deploiement', 'rotation'] as const).map(n => (
                <button key={n} onClick={() => { setNiveau(n); setPool([]); setCibles([]); setAiSuggestions([]) }} style={{
                  padding: '7px 14px', fontSize: '13px', border: 'none', cursor: 'pointer',
                  backgroundColor: niveau === n ? C : 'white', color: niveau === n ? 'white' : C,
                  fontWeight: niveau === n ? '600' : '400'
                }}>
                  {n === 'deploiement' ? 'Par déploiement' : 'Par rotation'}
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedDeploymentId && niveau === 'rotation' && (
          <div>
            <label style={LS}>Rotation</label>
            <select value={selectedVagueId} onChange={e => { const id = e.target.value; setSelectedVagueId(id); setSelectedVague(vagues.find(v => v.id === id) || null); setPool([]); setCibles([]); setAiSuggestions([]) }} disabled={loadingVagues} style={{ ...SS, minWidth: '240px' }}>
              <option value="">— Sélectionner —</option>
              {vagues.map(v => <option key={v.id} value={v.id}>{v.identifiant} · {formatDate(v.date_debut)}→{formatDate(v.date_fin)} · {v.nb_personnes_requis} pers.</option>)}
            </select>
          </div>
        )}
      </div>

      {erreur && <div style={{ margin: '12px 24px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>⚠ {erreur}</div>}

      {estPret ? (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 360px', gap: '16px', padding: '16px 24px', flex: 1, minHeight: 0 }}>

          {/* ── COLONNE GAUCHE : Filtres ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>

            {/* Recherche */}
            <div style={carteStyle}>
              <input type="text" placeholder="Rechercher..." value={recherche} onChange={e => setRecherche(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' as const }} />
            </div>

            {/* Proximité */}
            <div style={carteStyle}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px', letterSpacing: '0.05em' }}>PROXIMITÉ</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input type="checkbox" checked={trierDistance} onChange={e => setTrierDistance(e.target.checked)} />
                Trier par distance
              </label>
              {trierDistance && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: geocoding ? '#f59e0b' : depCoords ? '#22c55e' : '#94a3b8' }}>
                  {geocoding ? '⟳ Géolocalisation...' : depCoords ? `✓ Lieu géolocalisé` : '⚠ Lieu non trouvé'}
                  {depCoords && <span style={{ display: 'block', color: '#94a3b8', marginTop: '2px' }}>Vol d'oiseau — tenir compte des traversées</span>}
                </div>
              )}
            </div>

            {/* Préférence */}
            <div style={carteStyle}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px', letterSpacing: '0.05em' }}>PRÉFÉRENCE</div>
              {[{ val: '', label: 'Tous' }, { val: 'terrain', label: '🏔 Terrain' }, { val: 'sinistres', label: '🤝 Sinistrés' }].map(o => (
                <label key={o.val} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '4px' }}>
                  <input type="radio" name="pref" checked={filtrePreference === o.val} onChange={() => setFiltrePreference(o.val)} />
                  {o.label}
                </label>
              ))}
            </div>

            {/* Compétences */}
            <div style={carteStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.05em' }}>COMPÉTENCES</div>
                {filtreCompetences.length > 0 && <button onClick={() => setFiltreCompetences([])} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Effacer</button>}
              </div>
              {COMPETENCES.map(c => (
                <label key={c.field} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '4px',
                  color: filtreCompetences.includes(c.field) ? C : '#374151', fontWeight: filtreCompetences.includes(c.field) ? '600' : '400' }}>
                  <input type="checkbox" checked={filtreCompetences.includes(c.field)} onChange={() => toggleComp(c.field)} />
                  {c.label}
                </label>
              ))}
            </div>

            {/* Langues */}
            {langues.length > 0 && (
              <div style={carteStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.05em' }}>LANGUES</div>
                  {filtreLangues.length > 0 && <button onClick={() => setFiltreLangues([])} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Effacer</button>}
                </div>
                {langues.map(l => (
                  <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '4px',
                    color: filtreLangues.includes(l.nom) ? C : '#374151', fontWeight: filtreLangues.includes(l.nom) ? '600' : '400' }}>
                    <input type="checkbox" checked={filtreLangues.includes(l.nom)} onChange={() => toggleLang(l.nom)} />
                    {l.nom}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── COLONNE CENTRE : Pool ── */}
          <div style={{ ...carteStyle, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: C }}>Pool de candidats</h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {loadingPool ? 'Chargement...' : `${poolFiltre.filter(c => c.deployable).length} déployables / ${poolFiltre.length} affichés`}
                </span>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingPool ? (
                <div style={videStyle}>Chargement du pool…</div>
              ) : poolFiltre.length === 0 ? (
                <div style={videStyle}>Aucun candidat avec ces filtres</div>
              ) : poolFiltre.map(c => {
                const pref  = badgePref(c.preference_tache)
                const enCours = ajoutEnCours.includes(c.benevole_id)
                return (
                  <div key={c.benevole_id} style={{
                    display: 'flex', alignItems: 'center', padding: '9px 14px',
                    borderBottom: '1px solid #f1f5f9', gap: '10px',
                    backgroundColor: !c.deployable ? '#fffbeb' : 'white'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        <span style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{c.prenom} {c.nom}</span>
                        {c.en_deploiement_actif  && <span style={badge('#f59e0b')}>⚠ Déployé</span>}
                        {c.repos_requis_jusqu    && <span style={badge('#ef4444')}>⛔ Repos</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{c.ville}{c.ville && c.region ? ', ' : ''}{c.region}</span>
                        {c.distance_km !== undefined && (
                          <span style={{ color: c.distance_km < 50 ? '#22c55e' : c.distance_km < 150 ? '#f59e0b' : '#94a3b8', fontWeight: '600' }}>
                            📍 {c.distance_km} km
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', backgroundColor: pref.bg, color: pref.color }}>{pref.label}</span>
                        {filtreCompetences.map(f => (c as any)[f]?.length > 0 && (
                          <span key={f} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', backgroundColor: '#dbeafe', color: C }}>
                            {COMPETENCES.find(x => x.field === f)?.label}
                          </span>
                        ))}
                        {filtreLangues.filter(l => c.langues.includes(l)).map(l => (
                          <span key={l} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', backgroundColor: '#f3e8ff', color: '#7c3aed' }}>{l}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => ajouter(c)} disabled={enCours} style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      border: `2px solid ${C}`, backgroundColor: enCours ? '#e2e8f0' : 'white',
                      color: C, fontSize: '20px', cursor: enCours ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, paddingBottom: '1px'
                    }}>
                      {enCours ? '…' : '+'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── COLONNE DROITE : IA + Ciblés ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>

            {/* Bouton IA en haut */}
            <button onClick={demanderAI} disabled={loadingAI || loadingPool} style={{
              padding: '11px', borderRadius: '8px', border: `2px solid ${C}`,
              backgroundColor: 'white', color: C, fontSize: '14px', fontWeight: '600',
              cursor: (loadingAI || loadingPool) ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              opacity: (loadingAI || loadingPool) ? 0.7 : 1
            }}>
              {loadingAI ? '⟳ Analyse en cours…' : '✦ Compléter avec l\'IA'}
            </button>

            {/* Suggestions IA */}
            {aiEnrichies.length > 0 && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '9px 14px', borderBottom: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600', fontSize: '13px', color: '#15803d' }}>✦ Suggestions IA ({aiEnrichies.length})</span>
                  <button onClick={toutAjouterIA} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '6px', border: '1px solid #16a34a', backgroundColor: 'white', color: '#16a34a', cursor: 'pointer', fontWeight: '600' }}>Tout ajouter</button>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {aiEnrichies.map(s => (
                    <div key={s.benevole_id} style={{ padding: '8px 14px', borderBottom: '1px solid #dcfce7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', fontSize: '13px' }}>{s.candidat?.prenom} {s.candidat?.nom}</div>
                        <div style={{ fontSize: '11px', color: '#16a34a' }}>{s.raison}</div>
                      </div>
                      <button onClick={() => s.candidat && ajouter(s.candidat, true)} style={{ fontSize: '12px', padding: '3px 9px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>+ Ajouter</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Carte ciblés */}
            <div style={{ ...carteStyle, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: C }}>Réservistes ciblés</h2>
                  <span style={{ fontSize: '24px', fontWeight: '700', color: couleurJauge, lineHeight: 1 }}>
                    {cibles.length}<span style={{ fontSize: '13px', fontWeight: '400', color: '#94a3b8' }}> / {ratioMax}</span>
                  </span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '5px' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: couleurJauge, borderRadius: '3px', transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Objectif {ratioMin}–{ratioMax} ({nbRequis} × 3-4)</span>
                  {dansLaFourchette && <span style={{ color: '#22c55e', fontWeight: '600' }}>✓ OK</span>}
                  {notifEnvoyees && <span style={{ color: '#3b82f6', fontWeight: '600' }}>✓ Notifiés</span>}
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {cibles.length === 0 ? (
                  <div style={videStyle}>Aucun réserviste ciblé</div>
                ) : cibles.map(cible => (
                  <div key={cible.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f1f5f9', gap: '8px', backgroundColor: cible.statut === 'notifie' ? '#f0fdf4' : 'white' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontWeight: '500', fontSize: '13px' }}>{cible.reservistes.prenom} {cible.reservistes.nom}</span>
                        {cible.ajoute_par_ia && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a', fontWeight: '700' }}>IA</span>}
                        {cible.statut === 'notifie' && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#dbeafe', color: '#1d4ed8', fontWeight: '700' }}>✓</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{cible.reservistes.ville}{cible.reservistes.ville && cible.reservistes.region ? ', ' : ''}{cible.reservistes.region}</div>
                    </div>
                    {cible.statut !== 'notifie' && (
                      <button onClick={() => retirer(cible)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #fca5a5', backgroundColor: 'white', color: '#ef4444', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bouton notifications */}
            <button onClick={envoyerNotifications} disabled={cibles.length === 0 || loadingNotif || notifEnvoyees} style={{
              padding: '11px', borderRadius: '8px', border: 'none',
              backgroundColor: (cibles.length === 0 || notifEnvoyees) ? '#e2e8f0' : C,
              color: (cibles.length === 0 || notifEnvoyees) ? '#94a3b8' : 'white',
              fontSize: '14px', fontWeight: '600',
              cursor: (cibles.length === 0 || loadingNotif || notifEnvoyees) ? 'not-allowed' : 'pointer'
            }}>
              {loadingNotif ? 'Envoi…' : notifEnvoyees ? `✓ Notifiés (${cibles.length})` : `📨 Envoyer notifications (${cibles.length})`}
            </button>
          </div>

        </div>
      ) : (
        <div style={{ padding: '80px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '48px', marginBottom: '14px' }}>🎯</div>
          <p style={{ fontSize: '15px', margin: 0, color: '#64748b' }}>
            Sélectionnez un sinistre et un déploiement pour démarrer le ciblage
          </p>
          {!selectedSinistreId && sinistres.length === 0 && !loadingSinistres && (
            <p style={{ fontSize: '13px', color: '#f59e0b', marginTop: '10px' }}>Aucun sinistre actif trouvé</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Styles partagés ────────────────────────────────────────
const LS: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const SS: React.CSSProperties = { padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: 'white', color: '#1e293b' }
const carteStyle: React.CSSProperties = { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }
const videStyle: React.CSSProperties = { padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }
const badge = (color: string): React.CSSProperties => ({ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: `${color}20`, color, fontWeight: '600' })
