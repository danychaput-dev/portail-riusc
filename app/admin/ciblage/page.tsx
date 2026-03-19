'use client'

import { useEffect, useState, useCallback } from 'react'

// ============================================================
// Types
// ============================================================
interface Sinistre {
  id: string
  nom: string
  statut: string
  type_incident: string
  lieu: string
}

interface Deployment {
  id: string
  identifiant: string
  nom: string
  statut: string
  nb_personnes_par_vague: number
  date_debut: string
  date_fin: string
}

interface Vague {
  id: string
  identifiant: string
  numero: number
  date_debut: string
  date_fin: string
  nb_personnes_requis: number
  statut: string
}

interface Candidat {
  benevole_id: string
  prenom: string
  nom: string
  telephone: string
  region: string
  ville: string
  preference_tache: string
  preference_tache_commentaire: string
  deployable: boolean
  en_deploiement_actif: boolean
  rotations_consecutives: number
  repos_requis_jusqu: string | null
  raison_alerte: string | null
  deja_cible: boolean
}

interface Cible {
  id: string
  benevole_id: string
  niveau: string
  reference_id: string
  statut: string
  ajoute_par_ia: boolean
  reservistes: {
    prenom: string
    nom: string
    telephone: string
    region: string
    ville: string
    preference_tache: string
  }
}

interface AISuggestion {
  benevole_id: string
  raison: string
}

// ============================================================
// Helpers
// ============================================================
const COULEUR_PRIMAIRE = '#1e3a5f'

function badgePreference(pref: string) {
  if (pref === 'terrain')   return { label: 'Terrain',   bg: '#e8f0f8', color: COULEUR_PRIMAIRE }
  if (pref === 'sinistres') return { label: 'Sinistrés', bg: '#f3e8ff', color: '#7c3aed' }
  return { label: 'Générale', bg: '#f1f5f9', color: '#64748b' }
}

function alerteCandidait(c: Candidat): { label: string; color: string } | null {
  if (c.en_deploiement_actif)   return { label: '⚠ Déployé',   color: '#f59e0b' }
  if (c.repos_requis_jusqu)     return { label: '⛔ Repos req.', color: '#ef4444' }
  if (c.rotations_consecutives >= 1) return { label: '2e rotation', color: '#f59e0b' }
  return null
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })
}

// ============================================================
// Composant principal
// ============================================================
export default function CiblagePage() {
  // Selector
  const [sinistres,            setSinistres]            = useState<Sinistre[]>([])
  const [selectedSinistreId,   setSelectedSinistreId]   = useState('')
  const [deployments,          setDeployments]          = useState<Deployment[]>([])
  const [selectedDeploymentId, setSelectedDeploymentId] = useState('')
  const [selectedDeployment,   setSelectedDeployment]   = useState<Deployment | null>(null)
  const [niveau,               setNiveau]               = useState<'rotation' | 'deploiement'>('rotation')
  const [vagues,               setVagues]               = useState<Vague[]>([])
  const [selectedVagueId,      setSelectedVagueId]      = useState('')
  const [selectedVague,        setSelectedVague]        = useState<Vague | null>(null)

  // Data
  const [pool,           setPool]           = useState<Candidat[]>([])
  const [cibles,         setCibles]         = useState<Cible[]>([])
  const [aiSuggestions,  setAiSuggestions]  = useState<AISuggestion[]>([])

  // Filtres UI (client-side sur le pool chargé)
  const [filtreRegions,    setFiltreRegions]    = useState<string[]>([])
  const [filtrePreference, setFiltrePreference] = useState<string>('')
  const [recherche,        setRecherche]        = useState('')

  // Loading
  const [loadingSinistres,  setLoadingSinistres]  = useState(true)
  const [loadingDeployments,setLoadingDeployments]= useState(false)
  const [loadingVagues,     setLoadingVagues]     = useState(false)
  const [loadingPool,       setLoadingPool]       = useState(false)
  const [loadingAI,         setLoadingAI]         = useState(false)
  const [loadingNotif,      setLoadingNotif]      = useState(false)
  const [ajoutEnCours,      setAjoutEnCours]      = useState<string[]>([])
  const [notifEnvoyees,     setNotifEnvoyees]     = useState(false)
  const [erreur,            setErreur]            = useState<string | null>(null)

  // ── Computed ──────────────────────────────────────────────
  const referenceId = niveau === 'rotation' ? selectedVagueId : selectedDeploymentId
  const dateDeb = niveau === 'rotation' ? selectedVague?.date_debut : selectedDeployment?.date_debut
  // date_fin optionnelle — fallback sur date_debut si pas encore définie
  const dateFin = niveau === 'rotation'
    ? (selectedVague?.date_fin || selectedVague?.date_debut)
    : (selectedDeployment?.date_fin || selectedDeployment?.date_debut)
  const nbRequis = niveau === 'rotation'
    ? (selectedVague?.nb_personnes_requis    || 0)
    : (selectedDeployment?.nb_personnes_par_vague || 0)
  const ratioMin = nbRequis * 3
  const ratioMax = nbRequis * 4

  // Pool non ciblés
  const poolNonCible = pool.filter(c => !c.deja_cible)

  // Régions distinctes dans le pool
  const regionsPool = [...new Set(poolNonCible.map(c => c.region).filter(Boolean))].sort() as string[]

  // Filtres client-side
  const poolFiltre = poolNonCible.filter(c => {
    if (filtreRegions.length > 0 && !filtreRegions.includes(c.region)) return false
    if (filtrePreference && c.preference_tache !== filtrePreference && c.preference_tache !== 'aucune') return false
    if (recherche) {
      const q = recherche.toLowerCase()
      if (!`${c.prenom} ${c.nom}`.toLowerCase().includes(q) &&
          !c.ville?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const nbDeployables = poolFiltre.filter(c => c.deployable).length

  // Suggestions IA enrichies
  const aiEnrichies = aiSuggestions
    .map(s => ({ ...s, candidat: pool.find(c => c.benevole_id === s.benevole_id) }))
    .filter(s => s.candidat && !s.candidat.deja_cible)

  // Jauge
  const pct = ratioMax > 0 ? Math.min(100, Math.round((cibles.length / ratioMax) * 100)) : 0
  const dansLaFourchette = cibles.length >= ratioMin && cibles.length <= ratioMax
  const couleurJauge = dansLaFourchette ? '#22c55e' : cibles.length < ratioMin ? '#f59e0b' : '#3b82f6'

  // ── Chargements ───────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/ciblage?action=sinistres')
      .then(r => r.json())
      .then(data => { setSinistres(data || []); setLoadingSinistres(false) })
  }, [])

  useEffect(() => {
    if (!selectedSinistreId) return
    setLoadingDeployments(true)
    setSelectedDeploymentId(''); setSelectedDeployment(null)
    setSelectedVagueId('');      setSelectedVague(null)
    setPool([]); setCibles([]); setAiSuggestions([])
    fetch(`/api/admin/ciblage?action=deployments&sinistre_id=${selectedSinistreId}`)
      .then(r => r.json())
      .then(data => { setDeployments(data || []); setLoadingDeployments(false) })
  }, [selectedSinistreId])

  useEffect(() => {
    if (!selectedDeploymentId) return
    setLoadingVagues(true)
    setSelectedVagueId(''); setSelectedVague(null)
    setPool([]); setCibles([]); setAiSuggestions([])
    const dep = deployments.find(d => d.id === selectedDeploymentId) || null
    setSelectedDeployment(dep)
    fetch(`/api/admin/ciblage?action=vagues&deployment_id=${selectedDeploymentId}`)
      .then(r => r.json())
      .then(data => { setVagues(data || []); setLoadingVagues(false) })
  }, [selectedDeploymentId])

  const chargerPool = useCallback(async (refId: string, debut: string, fin: string, niv: string) => {
    setLoadingPool(true)
    setErreur(null)
    setAiSuggestions([])
    try {
      const [poolData, ciblagesData] = await Promise.all([
        fetch(`/api/admin/ciblage?action=pool&niveau=${niv}&reference_id=${refId}&date_debut=${debut}&date_fin=${fin}`)
          .then(r => r.json()),
        fetch(`/api/admin/ciblage?action=ciblages&reference_id=${refId}`)
          .then(r => r.json())
      ])
      if (poolData.error) setErreur(poolData.error)
      else { setPool(poolData || []); setCibles(ciblagesData || []) }
    } catch {
      setErreur('Erreur réseau')
    }
    setLoadingPool(false)
    setNotifEnvoyees(false)
  }, [])

  useEffect(() => {
    if (!referenceId || !dateDeb || !dateFin) return
    chargerPool(referenceId, dateDeb, dateFin, niveau)
  }, [referenceId, niveau])

  // ── Actions ───────────────────────────────────────────────
  const ajouter = async (candidat: Candidat, parIA = false) => {
    if (ajoutEnCours.includes(candidat.benevole_id)) return
    setAjoutEnCours(prev => [...prev, candidat.benevole_id])
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ajouter',
        niveau,
        reference_id: referenceId,
        benevole_id: candidat.benevole_id,
        ajoute_par_ia: parIA
      })
    })
    const data = await res.json()
    if (!data.error) {
      setPool(prev => prev.map(c =>
        c.benevole_id === candidat.benevole_id ? { ...c, deja_cible: true } : c
      ))
      setCibles(prev => [...prev, {
        id: data.id,
        benevole_id: candidat.benevole_id,
        niveau,
        reference_id: referenceId,
        statut: 'cible',
        ajoute_par_ia: parIA,
        reservistes: {
          prenom: candidat.prenom,
          nom: candidat.nom,
          telephone: candidat.telephone,
          region: candidat.region,
          ville: candidat.ville,
          preference_tache: candidat.preference_tache
        }
      }])
      setAiSuggestions(prev => prev.filter(s => s.benevole_id !== candidat.benevole_id))
    }
    setAjoutEnCours(prev => prev.filter(id => id !== candidat.benevole_id))
  }

  const retirer = async (cible: Cible) => {
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retirer', ciblage_id: cible.id })
    })
    const data = await res.json()
    if (!data.error) {
      setCibles(prev => prev.filter(c => c.id !== cible.id))
      setPool(prev => prev.map(c =>
        c.benevole_id === cible.benevole_id ? { ...c, deja_cible: false } : c
      ))
    }
  }

  const demanderAI = async () => {
    if (loadingAI) return
    setLoadingAI(true)
    const contexte = niveau === 'rotation'
      ? `Rotation ${selectedVague?.identifiant} — ${selectedDeployment?.nom} (${formatDate(dateDeb)} au ${formatDate(dateFin)})`
      : `Déploiement ${selectedDeployment?.identifiant} — ${selectedDeployment?.nom}`

    const res = await fetch('/api/admin/ciblage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ai-suggestions',
        pool: poolNonCible.slice(0, 100),
        cibles_actuels: cibles.map(c => c.benevole_id),
        nb_cible: ratioMax,
        context: contexte
      })
    })
    const data = await res.json()
    setAiSuggestions(data.suggestions || [])
    setLoadingAI(false)
  }

  const toutAjouterIA = async () => {
    for (const s of aiEnrichies) {
      if (s.candidat) await ajouter(s.candidat, true)
    }
  }

  const envoyerNotifications = async () => {
    if (cibles.length === 0 || loadingNotif) return
    setLoadingNotif(true)
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'notifier',
        reference_id: referenceId,
        niveau,
        ciblages: cibles
      })
    })
    const data = await res.json()
    setLoadingNotif(false)
    if (!data.error) {
      setNotifEnvoyees(true)
      setCibles(prev => prev.map(c => ({ ...c, statut: 'notifie' })))
    }
  }

  const changerNiveau = (n: 'rotation' | 'deploiement') => {
    setNiveau(n)
    setPool([]); setCibles([]); setAiSuggestions([])
    if (n === 'rotation') { setSelectedVagueId(''); setSelectedVague(null) }
  }

  const estPret = niveau === 'deploiement'
    ? !!selectedDeploymentId && !!selectedDeployment?.date_debut
    : !!selectedVagueId

  // ── Rendu ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9' }}>

      {/* Header */}
      <div style={{
        backgroundColor: COULEUR_PRIMAIRE,
        color: 'white',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
      }}>
        <a href="/admin" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '13px', whiteSpace: 'nowrap' }}>
          ← Admin
        </a>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
          Ciblage des réservistes
        </h1>
      </div>

      {/* Barre de sélection */}
      <div style={{
        backgroundColor: 'white',
        padding: '16px 28px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        alignItems: 'flex-end'
      }}>

        {/* Sinistre */}
        <div>
          <label style={labelStyle}>Sinistre</label>
          <select
            value={selectedSinistreId}
            onChange={e => setSelectedSinistreId(e.target.value)}
            style={{ ...selectStyle, minWidth: '240px' }}
          >
            <option value="">— Sélectionner —</option>
            {sinistres.map(s => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
        </div>

        {/* Déploiement */}
        <div>
          <label style={labelStyle}>Déploiement</label>
          <select
            value={selectedDeploymentId}
            onChange={e => setSelectedDeploymentId(e.target.value)}
            disabled={!selectedSinistreId || loadingDeployments}
            style={{ ...selectStyle, minWidth: '280px', opacity: !selectedSinistreId ? 0.5 : 1 }}
          >
            <option value="">— Sélectionner —</option>
            {deployments.map(d => (
              <option key={d.id} value={d.id}>{d.identifiant} — {d.nom}</option>
            ))}
          </select>
        </div>

        {/* Niveau toggle */}
        {selectedDeploymentId && (
          <div>
            <label style={labelStyle}>Niveau</label>
            <div style={{ display: 'flex', border: `1px solid ${COULEUR_PRIMAIRE}`, borderRadius: '6px', overflow: 'hidden' }}>
              {(['rotation', 'deploiement'] as const).map(n => (
                <button key={n} onClick={() => changerNiveau(n)} style={{
                  padding: '8px 16px', fontSize: '13px', border: 'none', cursor: 'pointer',
                  backgroundColor: niveau === n ? COULEUR_PRIMAIRE : 'white',
                  color: niveau === n ? 'white' : COULEUR_PRIMAIRE,
                  fontWeight: niveau === n ? '600' : '400',
                  transition: 'all 0.15s'
                }}>
                  {n === 'rotation' ? 'Par rotation' : 'Par déploiement'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rotation */}
        {selectedDeploymentId && niveau === 'rotation' && (
          <div>
            <label style={labelStyle}>Rotation</label>
            <select
              value={selectedVagueId}
              onChange={e => {
                const id = e.target.value
                setSelectedVagueId(id)
                setSelectedVague(vagues.find(v => v.id === id) || null)
                setPool([]); setCibles([]); setAiSuggestions([])
              }}
              disabled={loadingVagues}
              style={{ ...selectStyle, minWidth: '260px' }}
            >
              <option value="">— Sélectionner —</option>
              {vagues.map(v => (
                <option key={v.id} value={v.id}>
                  {v.identifiant} · {formatDate(v.date_debut)}→{formatDate(v.date_fin)} · {v.nb_personnes_requis} pers.
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Erreur */}
      {erreur && (
        <div style={{ margin: '16px 28px', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '14px' }}>
          ⚠ {erreur}
        </div>
      )}

      {/* Contenu principal */}
      {estPret ? (
        <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>

          {/* ── PANNEAU GAUCHE : Pool ── */}
          <div style={carteStyle}>

            {/* En-tête pool */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: COULEUR_PRIMAIRE }}>
                  Pool de candidats
                </h2>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {loadingPool
                    ? 'Chargement...'
                    : `${nbDeployables} déployables / ${poolFiltre.length} affichés`}
                </span>
              </div>

              {/* Recherche */}
              <input
                type="text"
                placeholder="Rechercher par nom, ville..."
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                style={{ ...inputStyle, width: '100%', marginBottom: '10px', boxSizing: 'border-box' as const }}
              />

              {/* Filtre préférence */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {[
                  { val: '',          label: 'Tous' },
                  { val: 'terrain',   label: '🏔 Terrain' },
                  { val: 'sinistres', label: '🤝 Sinistrés' }
                ].map(opt => (
                  <button key={opt.val} onClick={() => setFiltrePreference(opt.val)} style={{
                    ...chipStyle,
                    backgroundColor: filtrePreference === opt.val ? COULEUR_PRIMAIRE : 'white',
                    color:           filtrePreference === opt.val ? 'white' : '#374151',
                    borderColor:     filtrePreference === opt.val ? COULEUR_PRIMAIRE : '#d1d5db'
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Filtre régions */}
              {regionsPool.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {regionsPool.map(r => (
                    <button key={r} onClick={() => setFiltreRegions(prev =>
                      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
                    )} style={{
                      ...chipPetitStyle,
                      backgroundColor: filtreRegions.includes(r) ? '#dbeafe' : 'white',
                      color:           filtreRegions.includes(r) ? COULEUR_PRIMAIRE : '#6b7280',
                      borderColor:     filtreRegions.includes(r) ? '#93c5fd' : '#e2e8f0',
                      fontWeight:      filtreRegions.includes(r) ? '600' : '400'
                    }}>
                      {r}
                    </button>
                  ))}
                  {filtreRegions.length > 0 && (
                    <button onClick={() => setFiltreRegions([])} style={{ ...chipPetitStyle, color: '#ef4444', borderColor: '#fca5a5' }}>
                      ✕ Tout effacer
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Liste candidats */}
            <div style={{ maxHeight: '580px', overflowY: 'auto' }}>
              {loadingPool ? (
                <div style={etatVideStyle}>Chargement du pool de réservistes…</div>
              ) : poolFiltre.length === 0 ? (
                <div style={etatVideStyle}>Aucun candidat avec ces filtres</div>
              ) : (
                poolFiltre.map(c => {
                  const alerte = alerteCandidait(c)
                  const pref   = badgePreference(c.preference_tache)
                  const enCours = ajoutEnCours.includes(c.benevole_id)

                  return (
                    <div key={c.benevole_id} style={{
                      display: 'flex', alignItems: 'center', padding: '10px 16px',
                      borderBottom: '1px solid #f1f5f9', gap: '12px',
                      backgroundColor: !c.deployable ? '#fffbeb' : 'white'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                            {c.prenom} {c.nom}
                          </span>
                          {alerte && (
                            <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: `${alerte.color}20`, color: alerte.color, fontWeight: '600' }}>
                              {alerte.label}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '3px' }}>
                          {c.ville}{c.ville && c.region ? ', ' : ''}{c.region}
                          {c.raison_alerte && (
                            <span style={{ color: '#f59e0b', marginLeft: '6px' }}>· {c.raison_alerte}</span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '10px', backgroundColor: pref.bg, color: pref.color }}>
                          {pref.label}
                        </span>
                      </div>

                      {/* Bouton ajouter */}
                      <button
                        onClick={() => ajouter(c)}
                        disabled={enCours}
                        title="Ajouter au ciblage"
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          border: `2px solid ${COULEUR_PRIMAIRE}`,
                          backgroundColor: enCours ? '#e2e8f0' : 'white',
                          color: COULEUR_PRIMAIRE, fontSize: '20px',
                          cursor: enCours ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.1s', lineHeight: '1', paddingBottom: '1px'
                        }}
                      >
                        {enCours ? '…' : '+'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── PANNEAU DROIT : Ciblés ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Carte ciblés */}
            <div style={carteStyle}>

              {/* En-tête avec jauge */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: COULEUR_PRIMAIRE }}>
                    Réservistes ciblés
                  </h2>
                  <span style={{ fontSize: '26px', fontWeight: '700', color: couleurJauge, lineHeight: 1 }}>
                    {cibles.length}
                    <span style={{ fontSize: '14px', fontWeight: '400', color: '#94a3b8' }}> / {ratioMax}</span>
                  </span>
                </div>

                {/* Barre de progression */}
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    backgroundColor: couleurJauge, borderRadius: '4px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Objectif : <strong>{ratioMin}–{ratioMax}</strong> ({nbRequis} requis × 3-4)</span>
                  {dansLaFourchette && <span style={{ color: '#22c55e', fontWeight: '600' }}>✓ Fourchette atteinte</span>}
                  {notifEnvoyees && <span style={{ color: '#3b82f6', fontWeight: '600' }}>✓ Notifiés</span>}
                </div>
              </div>

              {/* Liste des ciblés */}
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {cibles.length === 0 ? (
                  <div style={etatVideStyle}>Aucun réserviste ciblé pour l'instant</div>
                ) : (
                  cibles.map(cible => (
                    <div key={cible.id} style={{
                      display: 'flex', alignItems: 'center', padding: '9px 16px',
                      borderBottom: '1px solid #f1f5f9', gap: '10px',
                      backgroundColor: cible.statut === 'notifie' ? '#f0fdf4' : 'white'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '500', fontSize: '13px', color: '#1e293b' }}>
                            {cible.reservistes.prenom} {cible.reservistes.nom}
                          </span>
                          {cible.ajoute_par_ia && (
                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a', fontWeight: '700' }}>IA</span>
                          )}
                          {cible.statut === 'notifie' && (
                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#dbeafe', color: '#1d4ed8', fontWeight: '700' }}>✓</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {cible.reservistes.ville}{cible.reservistes.ville && cible.reservistes.region ? ', ' : ''}{cible.reservistes.region}
                        </div>
                      </div>
                      {cible.statut !== 'notifie' && (
                        <button
                          onClick={() => retirer(cible)}
                          title="Retirer du ciblage"
                          style={{
                            width: '26px', height: '26px', borderRadius: '50%',
                            border: '1px solid #fca5a5', backgroundColor: 'white',
                            color: '#ef4444', fontSize: '16px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Suggestions IA */}
            {aiEnrichies.length > 0 && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600', fontSize: '13px', color: '#15803d' }}>
                    ✦ Suggestions IA ({aiEnrichies.length})
                  </span>
                  <button onClick={toutAjouterIA} style={{
                    fontSize: '12px', padding: '4px 12px', borderRadius: '6px',
                    border: '1px solid #16a34a', backgroundColor: 'white',
                    color: '#16a34a', cursor: 'pointer', fontWeight: '600'
                  }}>
                    Tout ajouter
                  </button>
                </div>
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {aiEnrichies.map(s => (
                    <div key={s.benevole_id} style={{
                      padding: '9px 16px', borderBottom: '1px solid #dcfce7',
                      display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', fontSize: '13px', color: '#1e293b' }}>
                          {s.candidat?.prenom} {s.candidat?.nom}
                        </div>
                        <div style={{ fontSize: '11px', color: '#16a34a' }}>{s.raison}</div>
                      </div>
                      <button
                        onClick={() => s.candidat && ajouter(s.candidat, true)}
                        style={{
                          fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
                          border: 'none', backgroundColor: '#16a34a',
                          color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' as const
                        }}
                      >
                        + Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Boutons d'action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={demanderAI}
                disabled={loadingAI || loadingPool}
                style={{
                  padding: '12px', borderRadius: '8px',
                  border: `2px solid ${COULEUR_PRIMAIRE}`,
                  backgroundColor: 'white', color: COULEUR_PRIMAIRE,
                  fontSize: '14px', fontWeight: '600',
                  cursor: (loadingAI || loadingPool) ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  opacity: (loadingAI || loadingPool) ? 0.7 : 1,
                  transition: 'all 0.15s'
                }}
              >
                {loadingAI ? '⟳ Analyse en cours…' : '✦ Compléter avec l\'IA'}
              </button>

              <button
                onClick={envoyerNotifications}
                disabled={cibles.length === 0 || loadingNotif || notifEnvoyees}
                style={{
                  padding: '12px', borderRadius: '8px', border: 'none',
                  backgroundColor: (cibles.length === 0 || notifEnvoyees) ? '#e2e8f0' : COULEUR_PRIMAIRE,
                  color: (cibles.length === 0 || notifEnvoyees) ? '#94a3b8' : 'white',
                  fontSize: '14px', fontWeight: '600',
                  cursor: (cibles.length === 0 || loadingNotif || notifEnvoyees) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {loadingNotif
                  ? 'Envoi en cours…'
                  : notifEnvoyees
                  ? `✓ Notifications envoyées (${cibles.length})`
                  : `📨 Envoyer les notifications (${cibles.length})`}
              </button>
            </div>
          </div>

        </div>
      ) : (
        /* État vide — aucune sélection */
        <div style={{ padding: '80px 28px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>🎯</div>
          <p style={{ fontSize: '16px', margin: 0, color: '#64748b' }}>
            Sélectionnez un sinistre, un déploiement et une rotation pour démarrer le ciblage
          </p>
          {!selectedSinistreId && sinistres.length === 0 && !loadingSinistres && (
            <p style={{ fontSize: '14px', color: '#f59e0b', marginTop: '12px' }}>
              Aucun sinistre actif ou en veille trouvé
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Styles partagés ────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '600',
  color: '#64748b',
  marginBottom: '5px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '13px',
  backgroundColor: 'white',
  color: '#1e293b'
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '13px',
  backgroundColor: 'white',
  color: '#1e293b',
  outline: 'none'
}

const chipStyle: React.CSSProperties = {
  padding: '5px 14px',
  borderRadius: '20px',
  border: '1px solid',
  fontSize: '13px',
  cursor: 'pointer',
  transition: 'all 0.15s'
}

const chipPetitStyle: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: '20px',
  border: '1px solid',
  fontSize: '11px',
  cursor: 'pointer',
  transition: 'all 0.15s',
  backgroundColor: 'white'
}

const carteStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '10px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  overflow: 'hidden'
}

const etatVideStyle: React.CSSProperties = {
  padding: '36px',
  textAlign: 'center',
  color: '#94a3b8',
  fontSize: '14px'
}
