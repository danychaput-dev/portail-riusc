'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'
import { formatPhone } from '@/utils/phone'
import ModalComposeCourriel from '@/app/components/ModalComposeCourriel'
import ModalReserviste from '@/app/components/ModalReserviste'

const C = '#1e3a5f'

const GROUPES_OPTIONS = [
  { val: 'Approuvé',           label: 'Approuvé',            couleur: '#22c55e', bg: '#f0fdf4' },
  { val: 'Intérêt',            label: 'Intérêt',             couleur: '#f59e0b', bg: '#fffbeb' },
  { val: 'Formation incomplète', label: 'Formation incomplète', couleur: '#3b82f6', bg: '#eff6ff' },
  { val: 'Responsable',        label: 'Responsable',         couleur: '#7c3aed', bg: '#f5f3ff' },
  { val: 'Retrait temporaire', label: 'Retrait temporaire',  couleur: '#ef4444', bg: '#fef2f2' },
]

function badgeGroupe(groupe: string) {
  const opt = GROUPES_OPTIONS.find(o => o.val === groupe)
  return opt || { couleur: '#94a3b8', bg: '#f1f5f9', label: groupe }
}

interface Reserviste {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  telephone: string
  telephone_secondaire: string
  adresse: string
  ville: string
  region: string
  code_postal: string
  groupe: string
  statut: string
  remboursement_bottes_date: string | null
  antecedents_statut: string | null
  antecedents_date_verification: string | null
  antecedents_date_expiration: string | null
  date_naissance: string | null
  contact_urgence_nom: string | null
  contact_urgence_telephone: string | null
  initiation_sc: boolean
  camp_complete: boolean
}

interface ModalAntecedents {
  benevole_id: string
  nom: string
  prenom: string
  date_actuelle: string | null
  statut_actuel: string | null
}

function moisAnnee(iso: string) {
  const [y, m] = iso.split('-')
  const mois = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
  return `${mois[parseInt(m) - 1]} ${y}`
}

function badgeAntecedents(statut: string | null, dateExpir: string | null) {
  const expire = dateExpir && new Date(dateExpir) < new Date()
  if (statut === 'verifie' && !expire) return { couleur: '#16a34a', bg: '#f0fdf4', label: 'Vérifié' }
  if (statut === 'verifie' && expire)  return { couleur: '#dc2626', bg: '#fef2f2', label: 'Expiré' }
  if (statut === 'refuse')             return { couleur: '#dc2626', bg: '#fef2f2', label: 'Refusé' }
  return { couleur: '#d97706', bg: '#fffbeb', label: 'En attente' }
}

// Readiness helpers — 4 vrais critères de déployabilité
type ReadinessKey = 'profil' | 'initiation' | 'camp' | 'antecedents'
const READINESS_STEPS: { key: ReadinessKey; label: string; short: string; icon: string }[] = [
  { key: 'profil',       label: 'Profil complet',          short: 'Profil', icon: '👤' },
  { key: 'initiation',   label: 'Initiation SC complétée', short: 'Init',   icon: '🎓' },
  { key: 'camp',         label: 'Camp de qualification',    short: 'Camp',   icon: '⛺' },
  { key: 'antecedents',  label: 'Antécédents vérifiés',    short: 'Antéc',  icon: '🔍' },
]

// Colonnes "Prêt" = les 3 premiers (profil, initiation, camp) — antécédents reste en colonne séparée
const PRET_STEPS = READINESS_STEPS.filter(s => s.key !== 'antecedents')

function getReadiness(r: Reserviste): Record<ReadinessKey, boolean> {
  const antExpire = r.antecedents_date_expiration && new Date(r.antecedents_date_expiration) < new Date()
  const isProfilComplet = !!(
    r.prenom && r.nom && r.email && r.telephone &&
    r.date_naissance && r.adresse && r.ville && r.region &&
    r.contact_urgence_nom && r.contact_urgence_telephone
  )
  return {
    profil: isProfilComplet,
    initiation: r.initiation_sc === true,
    camp: r.camp_complete === true,
    antecedents: r.antecedents_statut === 'verifie' && !antExpire,
  }
}

function readinessCount(r: Reserviste): number {
  const rd = getReadiness(r)
  return Object.values(rd).filter(Boolean).length
}

function isDeployable(r: Reserviste): boolean {
  const rd = getReadiness(r)
  return rd.profil && rd.initiation && rd.camp && rd.antecedents
}

// Sorting
type SortKey = 'nom' | 'prenom' | 'telephone' | 'email' | 'ville' | 'region' | 'bottes' | 'antecedents' | 'groupe' | 'readiness'
type SortDir = 'asc' | 'desc'

function sortData(data: Reserviste[], key: SortKey, dir: SortDir): Reserviste[] {
  return [...data].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'nom':          cmp = (a.nom || '').localeCompare(b.nom || '', 'fr'); break
      case 'prenom':       cmp = (a.prenom || '').localeCompare(b.prenom || '', 'fr'); break
      case 'telephone':    cmp = (a.telephone || '').localeCompare(b.telephone || ''); break
      case 'email':        cmp = (a.email || '').localeCompare(b.email || ''); break
      case 'ville':        cmp = (a.ville || '').localeCompare(b.ville || '', 'fr'); break
      case 'region':       cmp = (a.region || '').localeCompare(b.region || '', 'fr'); break
      case 'bottes':       cmp = (a.remboursement_bottes_date ? 1 : 0) - (b.remboursement_bottes_date ? 1 : 0); break
      case 'antecedents':  cmp = (a.antecedents_statut || '').localeCompare(b.antecedents_statut || ''); break
      case 'groupe':       cmp = (a.groupe || '').localeCompare(b.groupe || '', 'fr'); break
      case 'readiness':    cmp = readinessCount(a) - readinessCount(b); break
    }
    return dir === 'desc' ? -cmp : cmp
  })
}

export default function ReservistesPageWrapper() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280' }}>Chargement...</div>}>
      <ReservistesPage />
    </Suspense>
  )
}

function ReservistesPage() {
  const supabase = createClient()
  const router   = useRouter()
  const searchParams = useSearchParams()

  // Filtres avancés depuis URL (dashboard drill-down)
  const urlGroupes     = searchParams.get('groupes')
  const urlOrganisme   = searchParams.get('organisme')
  const urlRegion      = searchParams.get('region')
  const urlAntecedents = searchParams.get('antecedents')
  const urlBottes      = searchParams.get('bottes')
  const urlInscritDepuis = searchParams.get('inscrit_depuis')
  const urlCampSession = searchParams.get('camp_session')
  const urlCampStatut  = searchParams.get('camp_statut')
  const urlOrgPrincipale = searchParams.get('org_principale')
  const urlLabel       = searchParams.get('label')
  const urlFrom        = searchParams.get('from')
  const hasUrlFilters  = !!(urlOrganisme || urlRegion || urlAntecedents || urlBottes || urlInscritDepuis || urlCampSession || urlFrom)

  const defaultGroupes = urlGroupes
    ? urlGroupes.split(',').map(g => g.trim()).filter(Boolean)
    : (urlCampSession || urlCampStatut) ? [] : ['Approuvé', 'Intérêt']

  const [loading,        setLoading]        = useState(true)
  const [rawData,        setRawData]        = useState<Reserviste[]>([])
  const [total,          setTotal]          = useState(0)
  const [recherche,      setRecherche]      = useState('')
  const [groupesFiltres, setGroupesFiltres] = useState<string[]>(defaultGroupes)
  const [exporting,      setExporting]      = useState(false)
  const [sortKey,        setSortKey]        = useState<SortKey>('nom')
  const [sortDir,        setSortDir]        = useState<SortDir>('asc')
  const [authorized,     setAuthorized]     = useState(false)
  const [userRole,       setUserRole]       = useState<string>('')
  const [filtreBottes,   setFiltreBottes]   = useState(false)
  const [filtreReadiness, setFiltreReadiness] = useState<ReadinessKey | null>(null)
  const [modal,          setModal]          = useState<ModalAntecedents | null>(null)
  const [modalDate,      setModalDate]      = useState('')
  const [modalStatut,    setModalStatut]    = useState('verifie')
  const [modalSaving,    setModalSaving]    = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [modalReserviste, setModalReserviste] = useState<Reserviste | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Auth
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (!res || !['admin', 'coordonnateur', 'adjoint'].includes(res.role)) { router.push('/'); return }
      setUserRole(res.role)
      setCurrentUserId(user.id)
      setAuthorized(true)
    }
    init()
  }, [])

  // Charger à chaque changement de recherche ou groupes
  useEffect(() => {
    if (!authorized) return
    const timer = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (recherche) params.set('recherche', recherche)
      if (groupesFiltres.length > 0) params.set('groupes', groupesFiltres.join(','))
      if (urlOrganisme) params.set('organisme', urlOrganisme)
      if (urlRegion) params.set('region', urlRegion)
      if (urlAntecedents) params.set('antecedents', urlAntecedents)
      if (urlBottes) params.set('bottes', urlBottes)
      if (urlInscritDepuis) params.set('inscrit_depuis', urlInscritDepuis)
      if (urlCampSession) params.set('camp_session', urlCampSession)
      if (urlCampStatut) params.set('camp_statut', urlCampStatut)
      if (urlOrgPrincipale) params.set('org_principale', urlOrgPrincipale)
      const res = await fetch(`/api/admin/reservistes?${params}`)
      const json = await res.json()
      setRawData(json.data || [])
      setTotal(json.total || 0)
      setLoading(false)
    }, recherche ? 350 : 0)
    return () => clearTimeout(timer)
  }, [authorized, recherche, groupesFiltres])

  // Sorted + filtered data
  const data = useMemo(() => {
    let filtered = rawData
    if (filtreBottes) filtered = filtered.filter(r => r.remboursement_bottes_date)
    if (filtreReadiness) {
      filtered = filtered.filter(r => {
        const rd = getReadiness(r)
        return !rd[filtreReadiness] // Show those MISSING this step
      })
    }
    return sortData(filtered, sortKey, sortDir)
  }, [rawData, filtreBottes, filtreReadiness, sortKey, sortDir])

  const handleRecherche = (val: string) => setRecherche(val)

  const toggleGroupe = (g: string) => {
    setGroupesFiltres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(data.map(r => r.benevole_id)))
  }

  const getDestinatairesFromSelection = () =>
    data.filter(r => selectedIds.has(r.benevole_id)).map(r => ({
      benevole_id: r.benevole_id, email: r.email, prenom: r.prenom, nom: r.nom,
    }))

  const exporter = async () => {
    setExporting(true)
    const params = new URLSearchParams({ format: 'xlsx' })
    if (recherche) params.set('recherche', recherche)
    if (groupesFiltres.length > 0) params.set('groupes', groupesFiltres.join(','))
    if (urlOrganisme) params.set('organisme', urlOrganisme)
    if (urlRegion) params.set('region', urlRegion)
    if (urlAntecedents) params.set('antecedents', urlAntecedents)
    if (urlBottes) params.set('bottes', urlBottes)
    if (urlInscritDepuis) params.set('inscrit_depuis', urlInscritDepuis)
    if (urlCampSession) params.set('camp_session', urlCampSession)
    if (urlCampStatut) params.set('camp_statut', urlCampStatut)
    if (urlOrgPrincipale) params.set('org_principale', urlOrgPrincipale)
    const res  = await fetch(`/api/admin/reservistes?${params}`)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `reservistes-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  const toggleBottes = async (benevole_id: string, currentDate: string | null) => {
    const newDate = currentDate ? null : new Date().toISOString().split('T')[0]
    const res = await fetch('/api/admin/reservistes/bottes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benevole_id, date: newDate }),
    })
    if (res.ok) {
      setRawData(prev => prev.map(r =>
        r.benevole_id === benevole_id ? { ...r, remboursement_bottes_date: newDate } : r
      ))
    }
  }

  const ouvrirModalAntecedents = (r: Reserviste) => {
    setModal({ benevole_id: r.benevole_id, nom: r.nom, prenom: r.prenom, date_actuelle: r.antecedents_date_verification, statut_actuel: r.antecedents_statut })
    setModalDate(r.antecedents_date_verification || '')
    setModalStatut(r.antecedents_statut === 'refuse' ? 'refuse' : 'verifie')
  }

  const sauvegarderAntecedents = async () => {
    if (!modal) return
    setModalSaving(true)
    const res = await fetch('/api/admin/reservistes/antecedents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benevole_id: modal.benevole_id, date_verification: modalDate || null, statut: modalStatut }),
    })
    if (res.ok) {
      const json = await res.json()
      setRawData(prev => prev.map(r =>
        r.benevole_id === modal.benevole_id
          ? { ...r, antecedents_statut: json.statut, antecedents_date_verification: json.date_verification, antecedents_date_expiration: json.date_expiration }
          : r
      ))
      setModal(null)
    }
    setModalSaving(false)
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span style={{ color: '#d1d5db', marginLeft: '3px' }}>↕</span>
    return <span style={{ color: C, marginLeft: '3px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const isAdmin = userRole === 'admin'
  const canEmail = ['admin', 'coordonnateur'].includes(userRole)

  // Readiness stats
  const readinessStats = useMemo(() => {
    const stats = { profil: 0, initiation: 0, camp: 0, antecedents: 0, deployable: 0 }
    for (const r of rawData) {
      const rd = getReadiness(r)
      if (rd.profil) stats.profil++
      if (rd.initiation) stats.initiation++
      if (rd.camp) stats.camp++
      if (rd.antecedents) stats.antecedents++
      if (isDeployable(r)) stats.deployable++
    }
    return stats
  }, [rawData])

  if (!authorized) return null

  // Column header style
  const thStyle = (clickable = true): React.CSSProperties => ({
    padding: '10px 10px', fontSize: '11px', fontWeight: '700', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.04em', cursor: clickable ? 'pointer' : 'default',
    userSelect: 'none', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
  })

  // Columns: [checkbox] Nom Téléphone Courriel Ville Région Bottes Groupe Prêt(3) Antécédents
  const gridCols = canEmail
    ? '36px 1.3fr 0.9fr 1.4fr 0.9fr 1fr 70px 90px 120px 110px'
    : '1.3fr 0.9fr 1.4fr 0.9fr 1fr 70px 90px 120px 110px'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader />
      <main style={{ margin: '0 auto', padding: '28px 28px' }}>

        {/* Bandeau filtre dashboard */}
        {hasUrlFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px' }}>
            <span style={{ fontSize: '14px' }}>🔍</span>
            <span style={{ fontSize: '14px', color: '#1e40af', fontWeight: '600' }}>
              {urlLabel || 'Filtre actif depuis le dashboard'}
            </span>
            <button
              onClick={() => router.push(urlFrom === 'dashboard' ? '/dashboard' : '/admin')}
              style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '8px', border: '1px solid #93c5fd', backgroundColor: 'white', color: '#1e40af', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              ← Retour au {urlFrom === 'dashboard' ? 'dashboard' : 'panneau admin'}
            </button>
          </div>
        )}

        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push(hasUrlFilters && urlFrom === 'dashboard' ? '/dashboard' : '/admin')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>← {hasUrlFilters && urlFrom === 'dashboard' ? 'Dashboard' : 'Admin'}</button>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: C }}>Annuaire des réservistes</h1>
            <span style={{ fontSize: '13px', color: '#6b7280', backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '20px' }}>
              {loading ? '…' : `${data.length}${data.length !== total ? ` / ${total}` : ''} résultat${total !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => exporter()}
              disabled={exporting || data.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px', border: `1px solid ${C}`,
                backgroundColor: 'white', color: C, fontSize: '13px', fontWeight: '600',
                cursor: (exporting || data.length === 0) ? 'not-allowed' : 'pointer',
                opacity: data.length === 0 ? 0.5 : 1
              }}
            >
              {exporting ? '⟳ Export…' : '⬇ Exporter Excel'}
            </button>
            {canEmail && (
              <button
                onClick={() => {
                  if (selectedIds.size === 0) setSelectedIds(new Set(data.map(r => r.benevole_id)))
                  setShowEmailModal(true)
                }}
                disabled={data.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px', border: '1px solid #7c3aed',
                  backgroundColor: 'white', color: '#7c3aed', fontSize: '13px', fontWeight: '600',
                  cursor: data.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: data.length === 0 ? 0.5 : 1
                }}
              >
                ✉️ Envoyer {selectedIds.size > 1 ? `des courriels (${selectedIds.size})` : `un courriel${selectedIds.size === 1 ? ' (1)' : ''}`}
              </button>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px 20px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Rechercher par nom, courriel, ville, téléphone…"
              value={recherche}
              onChange={e => handleRecherche(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', paddingRight: '32px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, outline: 'none' }}
            />
            {recherche && (
              <button
                onClick={() => handleRecherche('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#9ca3af', lineHeight: 1, padding: '4px' }}
                title="Effacer la recherche"
              >
                ×
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' as const }}>Groupe :</span>
            {GROUPES_OPTIONS.map(opt => (
              <button
                key={opt.val}
                onClick={() => toggleGroupe(opt.val)}
                style={{
                  padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                  border: `1px solid ${groupesFiltres.includes(opt.val) ? opt.couleur : '#e2e8f0'}`,
                  backgroundColor: groupesFiltres.includes(opt.val) ? opt.bg : 'white',
                  color: groupesFiltres.includes(opt.val) ? opt.couleur : '#94a3b8',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                {opt.label}
              </button>
            ))}
            {groupesFiltres.length > 0 && (
              <button onClick={() => setGroupesFiltres([])} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                Tout effacer
              </button>
            )}
          </div>
        </div>

        {/* Readiness filter bar */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '12px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' as const }}>Déployabilité :</span>
          <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', backgroundColor: '#f0fdf4', color: '#16a34a', fontWeight: '700' }}>
            {readinessStats.deployable} / {rawData.length} déployables
          </span>
          <span style={{ color: '#e2e8f0' }}>|</span>
          {READINESS_STEPS.map(step => {
            const count = readinessStats[step.key]
            const missing = rawData.length - count
            const active = filtreReadiness === step.key
            return (
              <button
                key={step.key}
                onClick={() => setFiltreReadiness(active ? null : step.key)}
                title={active ? 'Retirer le filtre' : `Afficher les ${missing} sans ${step.label.toLowerCase()}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                  border: `1px solid ${active ? '#ef4444' : '#e2e8f0'}`,
                  backgroundColor: active ? '#fef2f2' : 'white',
                  color: active ? '#ef4444' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {step.icon} {step.label}
                <span style={{
                  fontSize: '10px', padding: '0 5px', borderRadius: '8px', fontWeight: '700',
                  backgroundColor: active ? '#ef4444' : '#e2e8f0',
                  color: active ? 'white' : '#64748b',
                }}>
                  {missing}
                </span>
              </button>
            )
          })}
          {(filtreBottes || filtreReadiness) && (
            <button onClick={() => { setFiltreBottes(false); setFiltreReadiness(null) }} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '4px' }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>

        {/* Tableau */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as const }}>
        <div style={{ minWidth: '1100px' }}>
          {/* En-tête tableau */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            {canEmail && (
              <div style={{ ...thStyle(true), justifyContent: 'center', padding: '10px 8px' }}>
                <input type="checkbox" checked={selectedIds.size === data.length && data.length > 0} onChange={toggleSelectAll} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C }} />
              </div>
            )}
            <div style={thStyle()} onClick={() => handleSort('nom')}>Nom{sortArrow('nom')}</div>
            <div style={thStyle()} onClick={() => handleSort('telephone')}>Téléphone{sortArrow('telephone')}</div>
            <div style={thStyle()} onClick={() => handleSort('email')}>Courriel{sortArrow('email')}</div>
            <div style={thStyle()} onClick={() => handleSort('ville')}>Ville{sortArrow('ville')}</div>
            <div style={thStyle()} onClick={() => handleSort('region')}>Région{sortArrow('region')}</div>
            <div style={thStyle()} onClick={() => handleSort('bottes')}>
              Bottes{sortArrow('bottes')}
              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '10px', backgroundColor: C, color: 'white', fontWeight: '700', marginLeft: '4px' }}>
                {rawData.filter(r => r.remboursement_bottes_date).length}
              </span>
            </div>
            <div style={thStyle()} onClick={() => handleSort('groupe')}>Groupe{sortArrow('groupe')}</div>
            <div style={{ ...thStyle(), justifyContent: 'center' }} onClick={() => handleSort('readiness')}>
              Prêt{sortArrow('readiness')}
            </div>
            <div style={thStyle()} onClick={() => handleSort('antecedents')}>
              Antéc.{sortArrow('antecedents')}
              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '10px', backgroundColor: '#16a34a', color: 'white', fontWeight: '700', marginLeft: '4px' }}>
                {rawData.filter(r => r.antecedents_statut === 'verifie').length}
              </span>
            </div>
          </div>

          {/* Lignes */}
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Chargement…</div>
          ) : data.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Aucun réserviste trouvé</div>
          ) : data.map((r, i) => {
            const badge    = badgeGroupe(r.groupe)
            const badgeAnt = badgeAntecedents(r.antecedents_statut, r.antecedents_date_expiration)
            const rd       = getReadiness(r)
            const rdCount  = Object.values(rd).filter(Boolean).length
            return (
              <div
                key={r.benevole_id}
                style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0', borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa', transition: 'background-color 0.1s' }}
                onMouseOver={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f5ff'}
                onMouseOut={e => (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? 'white' : '#fafafa'}
              >
                {/* Checkbox sélection */}
                {canEmail && (
                  <div style={{ padding: '11px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input type="checkbox" checked={selectedIds.has(r.benevole_id)} onChange={() => toggleSelect(r.benevole_id)} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C }} />
                  </div>
                )}
                {/* Nom */}
                <div style={{ padding: '11px 10px', overflow: 'hidden' }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); if (canEmail) setModalReserviste(r) }}
                    style={{ fontWeight: '600', fontSize: '13px', color: canEmail ? C : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: canEmail ? 'pointer' : 'default', textDecoration: canEmail ? 'underline' : 'none', textDecorationColor: canEmail ? '#bfdbfe' : undefined, textUnderlineOffset: '2px' }}
                    title={canEmail ? `Ouvrir le dossier de ${r.prenom} ${r.nom}` : undefined}
                  >{r.nom} {r.prenom}</div>
                  {r.telephone_secondaire && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px', whiteSpace: 'nowrap' }}>Alt: {formatPhone(r.telephone_secondaire)}</div>
                  )}
                </div>
                {/* Téléphone */}
                <div style={{ padding: '11px 10px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                  {r.telephone ? formatPhone(r.telephone) : <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                {/* Courriel */}
                <div style={{ padding: '11px 10px', fontSize: '12px', color: '#374151', overflow: 'hidden' }}>
                  {r.email
                    ? <span
                        onClick={(e) => {
                          e.stopPropagation()
                          if (canEmail) {
                            setSelectedIds(new Set([r.benevole_id]))
                            setShowEmailModal(true)
                          } else {
                            window.location.href = `mailto:${r.email}`
                          }
                        }}
                        style={{ color: C, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', cursor: 'pointer' }}
                        title={canEmail ? `Envoyer un courriel à ${r.prenom} ${r.nom}` : r.email}
                      >{r.email}</span>
                    : <span style={{ color: '#d1d5db' }}>—</span>
                  }
                </div>
                {/* Ville */}
                <div style={{ padding: '11px 10px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.ville || <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                {/* Région */}
                <div style={{ padding: '11px 10px', fontSize: '12px', color: '#374151', overflow: 'hidden' }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.region || <span style={{ color: '#d1d5db' }}>—</span>}</div>
                  {r.code_postal && <div style={{ color: '#94a3b8', marginTop: '1px', whiteSpace: 'nowrap', fontSize: '10px' }}>{r.code_postal}</div>}
                </div>
                {/* Bottes */}
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                  <input
                    type="checkbox"
                    checked={!!r.remboursement_bottes_date}
                    onChange={() => toggleBottes(r.benevole_id, r.remboursement_bottes_date)}
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1e3a5f' }}
                  />
                  {r.remboursement_bottes_date && (
                    <span style={{ fontSize: '9px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {moisAnnee(r.remboursement_bottes_date)}
                    </span>
                  )}
                </div>
                {/* Groupe */}
                <div style={{ padding: '11px 10px' }}>
                  <span style={{
                    fontSize: '10px', padding: '2px 7px', borderRadius: '20px',
                    backgroundColor: badge.bg, color: badge.couleur, fontWeight: '600', whiteSpace: 'nowrap' as const
                  }}>
                    {badge.label}
                  </span>
                </div>
                {/* Prêt — 3 étapes (profil, initiation, camp) */}
                <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  {PRET_STEPS.map(step => {
                    const ok = rd[step.key]
                    return (
                      <div
                        key={step.key}
                        title={`${step.label}: ${ok ? 'OK' : 'Manquant'}`}
                        style={{
                          width: '26px', height: '26px', borderRadius: '6px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px',
                          backgroundColor: ok ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
                          color: ok ? '#16a34a' : '#dc2626',
                          fontWeight: '700',
                        }}
                      >
                        {ok ? '✓' : '✗'}
                      </div>
                    )
                  })}
                  {isDeployable(r) && (
                    <span style={{ fontSize: '11px', marginLeft: '2px' }} title="Déployable">🟢</span>
                  )}
                </div>
                {/* Antécédents */}
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '20px', backgroundColor: badgeAnt.bg, color: badgeAnt.couleur, fontWeight: '600', whiteSpace: 'nowrap' as const }}>
                      {badgeAnt.label}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => ouvrirModalAntecedents(r)}
                        title="Modifier"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: '#94a3b8', fontSize: '12px', lineHeight: 1 }}
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                  {r.antecedents_date_verification && (
                    <span style={{ fontSize: '9px', color: '#64748b', whiteSpace: 'nowrap' as const }}>
                      {moisAnnee(r.antecedents_date_verification)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </div>
        </div>

        {/* Footer info */}
        {!loading && data.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
            <span>
              Légende Prêt : {PRET_STEPS.map(s => `${s.icon} ${s.short}`).join(' · ')}
            </span>
            <span>{total} réserviste{total !== 1 ? 's' : ''} · Données en temps réel</span>
          </div>
        )}

      </main>

      {/* Modal antécédents */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: C }}>
              Antécédents judiciaires
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
              {modal.prenom} {modal.nom}
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Statut
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['verifie', 'en_attente', 'refuse'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setModalStatut(s)}
                    style={{
                      flex: 1, padding: '7px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                      border: `2px solid ${modalStatut === s ? C : '#e2e8f0'}`,
                      backgroundColor: modalStatut === s ? '#eef2ff' : 'white',
                      color: modalStatut === s ? C : '#94a3b8',
                    }}
                  >
                    {s === 'verifie' ? 'Vérifié' : s === 'en_attente' ? 'En attente' : 'Refusé'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Date de vérification
                <span style={{ fontWeight: '400', color: '#94a3b8', marginLeft: '6px' }}>(expiration calculée automatiquement + 3 ans)</span>
              </label>
              <input
                type="date"
                value={modalDate}
                onChange={e => setModalDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
              />
              {modalDate && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                  Expire le : {new Date(new Date(modalDate).setFullYear(new Date(modalDate).getFullYear() + 3)).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModal(null)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={sauvegarderAntecedents}
                disabled={modalSaving}
                style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: C, color: 'white', fontSize: '13px', fontWeight: '600', cursor: modalSaving ? 'not-allowed' : 'pointer', opacity: modalSaving ? 0.7 : 1 }}
              >
                {modalSaving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal composition courriel */}
      {showEmailModal && (
        <ModalComposeCourriel
          destinataires={getDestinatairesFromSelection()}
          onClose={() => setShowEmailModal(false)}
          onSent={() => setSelectedIds(new Set())}
        />
      )}

      {/* Modal fiche réserviste (courriels + notes) */}
      {modalReserviste && (
        <ModalReserviste
          reserviste={modalReserviste}
          currentUserId={currentUserId}
          onClose={() => setModalReserviste(null)}
        />
      )}
    </div>
  )
}
