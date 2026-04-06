'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatPhone } from '@/utils/phone'
import ModalComposeCourriel from '@/app/components/ModalComposeCourriel'
import ModalReserviste from '@/app/components/ModalReserviste'
import SavedViewsBar, { type VueFiltres } from '@/app/components/SavedViewsBar'

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
  certifs_en_attente: number
  certifs_manquants: number
  camp_inscrit: boolean
  org_principale: string
  groupe_aqbrs: string
  groupe_recherche: string | null
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
type SortKey = 'nom' | 'prenom' | 'telephone' | 'email' | 'ville' | 'region' | 'organisme' | 'groupe_recherche' | 'bottes' | 'antecedents' | 'groupe' | 'readiness' | 'certifs'
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
      case 'organisme':   cmp = (a.org_principale || '').localeCompare(b.org_principale || '', 'fr'); break
      case 'groupe_recherche': cmp = (a.groupe_recherche || '').localeCompare(b.groupe_recherche || '', 'fr'); break
      case 'bottes':       cmp = (a.remboursement_bottes_date ? 1 : 0) - (b.remboursement_bottes_date ? 1 : 0); break
      case 'antecedents':  cmp = (a.antecedents_statut || '').localeCompare(b.antecedents_statut || ''); break
      case 'groupe':       cmp = (a.groupe || '').localeCompare(b.groupe || '', 'fr'); break
      case 'readiness':    cmp = readinessCount(a) - readinessCount(b); break
      case 'certifs':      cmp = (a.certifs_manquants + a.certifs_en_attente) - (b.certifs_manquants + b.certifs_en_attente); break
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

  // Filtres avancés depuis URL (dashboard drill-down) — stockés en state pour fiabilité
  const urlGroupes     = searchParams.get('groupes')
  const urlOrganisme   = searchParams.get('organisme')
  const urlRegion      = searchParams.get('region')
  const urlAntecedents = searchParams.get('antecedents')
  const urlBottes      = searchParams.get('bottes')
  const urlInscritDepuis = searchParams.get('inscrit_depuis')
  const urlCampSession = searchParams.get('camp_session')
  const urlCampStatut  = searchParams.get('camp_statut')
  const urlOrgPrincipale = searchParams.get('org_principale')
  const urlStatut      = searchParams.get('statut')
  const urlLabel       = searchParams.get('label')
  const urlFrom        = searchParams.get('from')
  const hasUrlFilters  = !!(urlOrganisme || urlRegion || urlAntecedents || urlBottes || urlInscritDepuis || urlCampSession || urlFrom)

  // Sérialiser les params URL en string stable pour les dépendances du useEffect
  const urlParamsKey = searchParams.toString()

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
  const [filtreOrganisme, setFiltreOrganisme] = useState<string>('')
  const [filtreGroupeRS, setFiltreGroupeRS] = useState<string>('')
  // Filtres readiness 3 états : null (off) → 'has' (ceux qui l'ont) → 'missing' (ceux à qui ça manque) → null
  type FilterState = 'has' | 'missing' | null
  const [filtresReadiness, setFiltresReadiness] = useState<Record<ReadinessKey, FilterState>>({ profil: null, initiation: null, camp: null, antecedents: null })
  const [filtreDeployable, setFiltreDeployable] = useState<FilterState>(null)
  const [filtreCertifsManquants, setFiltreCertifsManquants] = useState(false)
  const [filtreCertifsEnAttente, setFiltreCertifsEnAttente] = useState(false)
  const [modal,          setModal]          = useState<ModalAntecedents | null>(null)
  const [modalDate,      setModalDate]      = useState('')
  const [modalStatut,    setModalStatut]    = useState('verifie')
  const [modalSaving,    setModalSaving]    = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [selectedDestinataires, setSelectedDestinataires] = useState<Map<string, { benevole_id: string; email: string; prenom: string; nom: string }>>(new Map())
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [modalReserviste, setModalReserviste] = useState<Reserviste | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  // Menu contextuel (right-click)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; reserviste: Reserviste } | null>(null)

  // Responsive — ne pas figer la page sur mobile
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Synchroniser groupesFiltres quand les URL params changent (navigation client-side depuis dashboard)
  useEffect(() => {
    setGroupesFiltres(defaultGroupes)
    setRecherche('')
    setFiltreOrganisme('')
    setFiltreGroupeRS('')
    setFiltreBottes(false)
    setFiltresReadiness({ profil: null, initiation: null, camp: null, antecedents: null })
    setFiltreDeployable(null)
    setFiltreCertifsManquants(false)
    setFiltreCertifsEnAttente(false)
  }, [urlParamsKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (urlStatut) params.set('statut', urlStatut)
      const res = await fetch(`/api/admin/reservistes?${params}`)
      const json = await res.json()
      setRawData(json.data || [])
      setTotal(json.total || 0)
      setLoading(false)
    }, recherche ? 350 : 0)
    return () => clearTimeout(timer)
  }, [authorized, recherche, groupesFiltres, urlParamsKey])

  // Cycle 3 états : null → has → missing → null
  const cycleFilter = (current: FilterState): FilterState =>
    current === null ? 'has' : current === 'has' ? 'missing' : null

  const toggleReadinessFilter = (key: ReadinessKey) => {
    const newState = cycleFilter(filtresReadiness[key])
    setFiltresReadiness(prev => ({ ...prev, [key]: newState }))
    // Auto-sélectionner Approuvé seulement quand on active un filtre readiness
    if (newState !== null) {
      setGroupesFiltres(['Approuvé'])
    }
  }

  const hasAnyReadinessFilter = Object.values(filtresReadiness).some(v => v !== null) || filtreDeployable !== null || filtreCertifsManquants || filtreCertifsEnAttente

  // Liste des organismes uniques pour le filtre
  const organismesUniques = useMemo(() => {
    const set = new Set<string>()
    for (const r of rawData) {
      if (r.org_principale) set.add(r.org_principale)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [rawData])

  // Liste des groupes de recherche depuis Supabase
  const [groupesRSTable, setGroupesRSTable] = useState<string[]>([])
  useEffect(() => {
    const supabase = createClient()
    supabase.from('groupes_recherche').select('nom').eq('actif', true).order('nom')
      .then(({ data }) => setGroupesRSTable((data || []).map(g => g.nom)))
  }, [])
  const groupesRSUniques = useMemo(() => {
    const set = new Set<string>()
    for (const g of groupesRSTable) set.add(g)
    for (const r of rawData) {
      if (r.groupe_recherche) set.add(r.groupe_recherche)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [rawData, groupesRSTable])

  // Sorted + filtered data
  const data = useMemo(() => {
    let filtered = rawData
    if (filtreBottes) filtered = filtered.filter(r => r.remboursement_bottes_date)
    if (filtreOrganisme) filtered = filtered.filter(r => (r.org_principale || '').includes(filtreOrganisme))
    if (filtreGroupeRS) filtered = filtered.filter(r => (r.groupe_recherche || '') === filtreGroupeRS)
    // Appliquer tous les filtres readiness actifs (combinés = AND)
    for (const key of Object.keys(filtresReadiness) as ReadinessKey[]) {
      const state = filtresReadiness[key]
      if (state === 'has') filtered = filtered.filter(r => getReadiness(r)[key])
      if (state === 'missing') filtered = filtered.filter(r => !getReadiness(r)[key])
    }
    // Filtre déployable
    if (filtreDeployable === 'has') filtered = filtered.filter(r => isDeployable(r))
    if (filtreDeployable === 'missing') filtered = filtered.filter(r => !isDeployable(r))
    // Filtres certificats
    if (filtreCertifsManquants) filtered = filtered.filter(r => r.certifs_manquants > 0)
    if (filtreCertifsEnAttente) filtered = filtered.filter(r => r.certifs_en_attente > 0)
    return sortData(filtered, sortKey, sortDir)
  }, [rawData, filtreBottes, filtreOrganisme, filtreGroupeRS, filtresReadiness, filtreDeployable, filtreCertifsManquants, filtreCertifsEnAttente, sortKey, sortDir])

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
    // Garder les infos du destinataire pour l'envoi (même après changement de recherche)
    setSelectedDestinataires(prev => {
      const next = new Map(prev)
      if (next.has(id)) { next.delete(id) } else {
        const r = data.find(r => r.benevole_id === id)
        if (r) next.set(id, { benevole_id: r.benevole_id, email: r.email, prenom: r.prenom, nom: r.nom })
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set())
      setSelectedDestinataires(new Map())
    } else {
      setSelectedIds(new Set(data.map(r => r.benevole_id)))
      setSelectedDestinataires(new Map(data.map(r => [r.benevole_id, { benevole_id: r.benevole_id, email: r.email, prenom: r.prenom, nom: r.nom }])))
    }
  }

  // ─── Vues sauvegardées ───
  const getCurrentFilters = (): VueFiltres => ({
    recherche,
    groupes: groupesFiltres,
    sortKey,
    sortDir,
    filtreBottes,
    filtreOrganisme,
    filtreGroupeRS,
    filtresReadiness,
    filtreDeployable,
    filtreCertifsManquants,
    filtreCertifsEnAttente,
  })

  const loadViewFilters = (f: VueFiltres) => {
    if (f.recherche !== undefined) setRecherche(f.recherche || '')
    if (f.groupes) setGroupesFiltres(f.groupes)
    if (f.sortKey) setSortKey(f.sortKey as SortKey)
    if (f.sortDir) setSortDir(f.sortDir as SortDir)
    if (f.filtreBottes !== undefined) setFiltreBottes(f.filtreBottes)
    if (f.filtreOrganisme !== undefined) setFiltreOrganisme(f.filtreOrganisme || '')
    if (f.filtreGroupeRS !== undefined) setFiltreGroupeRS(f.filtreGroupeRS || '')
    if (f.filtresReadiness) setFiltresReadiness(f.filtresReadiness as Record<ReadinessKey, FilterState>)
    if (f.filtreDeployable !== undefined) setFiltreDeployable(f.filtreDeployable as FilterState)
    if (f.filtreCertifsManquants !== undefined) setFiltreCertifsManquants(f.filtreCertifsManquants || false)
    if (f.filtreCertifsEnAttente !== undefined) setFiltreCertifsEnAttente(f.filtreCertifsEnAttente || false)
  }

  const getDestinatairesFromSelection = () =>
    Array.from(selectedDestinataires.values())

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
    if (urlStatut) params.set('statut', urlStatut)
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

  // Fermer le menu contextuel au clic ou scroll
  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true) }
  }, [])

  const emprunterIdentite = async (r: Reserviste) => {
    const res = await fetch('/api/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benevole_id: r.benevole_id }),
    })
    const json = await res.json()
    if (json.success) {
      window.open('/', '_blank')
    } else {
      alert(json.error || 'Erreur lors de l\'emprunt d\'identité')
    }
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

  // Readiness stats — calculé sur rawData (déjà filtré par groupes sélectionnés)
  // Déployable reste sur Approuvés seulement
  const approuves = useMemo(() => rawData.filter(r => r.groupe === 'Approuvé'), [rawData])
  const readinessStats = useMemo(() => {
    const stats = { profil: 0, initiation: 0, camp: 0, antecedents: 0, deployable: 0, certifs_ok: 0, certifs_en_attente: 0, certifs_manquants: 0 }
    for (const r of rawData) {
      const rd = getReadiness(r)
      if (rd.profil) stats.profil++
      if (rd.initiation) stats.initiation++
      if (rd.camp) stats.camp++
      if (rd.antecedents) stats.antecedents++
      // Certificats
      if (r.certifs_manquants > 0) stats.certifs_manquants++
      else if (r.certifs_en_attente > 0) stats.certifs_en_attente++
      // Note: on ne compte pas certifs_ok car un réserviste sans certificat requis n'a rien à montrer
    }
    // Déployable = seulement les Approuvés qui ont tout
    for (const r of approuves) {
      if (isDeployable(r)) stats.deployable++
    }
    return stats
  }, [rawData, approuves])

  const baseTotal = rawData.length

  // Détails pour tooltips — ventilation des manquants par critère
  const readinessDetails = useMemo(() => {
    const total = baseTotal
    // Profil complet — quels champs manquent
    const profilManque = { date_naissance: 0, adresse: 0, ville: 0, region: 0, telephone: 0, contact_urgence_nom: 0, contact_urgence_tel: 0, email: 0, nom: 0, prenom: 0 }
    for (const r of rawData) {
      if (!r.date_naissance) profilManque.date_naissance++
      if (!r.adresse) profilManque.adresse++
      if (!r.ville) profilManque.ville++
      if (!r.region) profilManque.region++
      if (!r.telephone) profilManque.telephone++
      if (!r.contact_urgence_nom) profilManque.contact_urgence_nom++
      if (!r.contact_urgence_telephone) profilManque.contact_urgence_tel++
      if (!r.email) profilManque.email++
    }
    const profilLines = [
      profilManque.date_naissance > 0 && `${profilManque.date_naissance} sans date de naissance`,
      profilManque.contact_urgence_nom > 0 && `${profilManque.contact_urgence_nom} sans contact d'urgence`,
      profilManque.adresse > 0 && `${profilManque.adresse} sans adresse`,
      profilManque.ville > 0 && `${profilManque.ville} sans ville`,
      profilManque.region > 0 && `${profilManque.region} sans région`,
      profilManque.telephone > 0 && `${profilManque.telephone} sans téléphone`,
      profilManque.email > 0 && `${profilManque.email} sans courriel`,
    ].filter(Boolean)
    const antManque = total - readinessStats.antecedents
    return {
      profil: `${readinessStats.profil}/${total} profils complets\n${profilLines.length > 0 ? 'Manquent :\n' + profilLines.join('\n') : 'Tous les profils sont complets'}`,
      initiation: `${readinessStats.initiation}/${total} ont complété l'initiation SC\n${total - readinessStats.initiation} n'ont pas encore complété`,
      camp: `${readinessStats.camp}/${total} ont fait le camp de qualification\n${total - readinessStats.camp} n'ont pas encore fait le camp`,
      antecedents: `${readinessStats.antecedents}/${total} antécédents vérifiés\n${antManque} en attente de vérification`,
    }
  }, [rawData, baseTotal, readinessStats])

  if (!authorized) return null

  // Column header style — 2 lignes : titre en haut, détails en bas
  const thStyle = (clickable = true): React.CSSProperties => ({
    padding: '6px 10px 2px', fontSize: '11px', fontWeight: '700', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.04em', cursor: clickable ? 'pointer' : 'default',
    userSelect: 'none', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
  })
  const thSubStyle: React.CSSProperties = {
    padding: '0 10px 6px', fontSize: '10px', color: '#94a3b8', fontWeight: '600',
    display: 'flex', alignItems: 'center', gap: '3px',
  }

  // Columns: [checkbox] Nom Téléphone Courriel Ville Région Organisme Bottes Groupe Prêt(3) Antécédents
  const gridCols = canEmail
    ? '36px 0.8fr 0.65fr 0.9fr 0.6fr 0.55fr 0.85fr 0.85fr 70px 85px 120px 120px'
    : '0.8fr 0.65fr 0.9fr 0.6fr 0.55fr 0.85fr 0.85fr 70px 85px 120px 120px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...(isMobile ? { minHeight: '100%' } : { height: '100%', overflow: 'hidden' }) }}>
      <main style={{ margin: '0 auto', padding: '0 28px', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, ...(isMobile ? {} : { overflow: 'hidden' }) }}>

      {/* Zone fixe : filtres + readiness (ne défile pas) */}
      <div style={{ flexShrink: 0, paddingTop: '28px' }}>

        {/* Bandeau filtre dashboard */}
        {hasUrlFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px' }}>
            <span style={{ fontSize: '14px' }}>🔍</span>
            <span style={{ fontSize: '14px', color: '#1e40af', fontWeight: '600' }}>
              {urlLabel || 'Filtre actif depuis le dashboard'}
              {urlCampSession && <span style={{ fontWeight: 400, fontSize: '12px', marginLeft: '8px', color: '#3b82f6' }}>(session: {urlCampSession})</span>}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                  if (selectedIds.size === 0) {
                    setSelectedIds(new Set(data.map(r => r.benevole_id)))
                    setSelectedDestinataires(new Map(data.map(r => [r.benevole_id, { benevole_id: r.benevole_id, email: r.email, prenom: r.prenom, nom: r.nom }])))
                  }
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

        {/* Vues sauvegardées — compact dans l'en-tête */}
        <SavedViewsBar currentFilters={getCurrentFilters()} onLoadView={loadViewFilters} />

        {/* Filtres */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px 20px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: '12px', flexWrap: 'nowrap', alignItems: 'center' }}>
          <div style={{ width: '260px', minWidth: '180px', flexShrink: 0, position: 'relative' }}>
            <input
              type="text"
              placeholder="Rechercher…"
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', alignItems: 'center' }}>
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
                  cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' as const
                }}
              >
                {opt.label}
              </button>
            ))}
            <span style={{ width: '80px', flexShrink: 0, display: 'inline-flex' }}>
              {(groupesFiltres.length > 0 || recherche) && (
                <button onClick={() => { setGroupesFiltres([]); setRecherche('') }} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                  Tout effacer
                </button>
              )}
            </span>
          </div>
        </div>

        {/* Readiness filter bar — pastilles 3 états : neutre → vert (a) → rouge (manque) → neutre */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '12px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' as const }}>Déployabilité :</span>
          {/* Pastille Déployable — aussi cliquable 3 états */}
          <button
            onClick={() => {
              const newState = cycleFilter(filtreDeployable)
              setFiltreDeployable(newState)
              if (newState !== null) setGroupesFiltres(['Approuvé'])
            }}
            title={`${readinessStats.deployable}/${approuves.length} déployables\nCliquer pour filtrer : ${filtreDeployable === null ? 'montrer les déployables' : filtreDeployable === 'has' ? 'montrer les non-déployables' : 'retirer le filtre'}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
              border: `1px solid ${filtreDeployable === 'has' ? '#16a34a' : filtreDeployable === 'missing' ? '#ef4444' : '#bbf7d0'}`,
              backgroundColor: filtreDeployable === 'has' ? '#f0fdf4' : filtreDeployable === 'missing' ? '#fef2f2' : '#f0fdf4',
              color: filtreDeployable === 'has' ? '#16a34a' : filtreDeployable === 'missing' ? '#ef4444' : '#16a34a',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {filtreDeployable === 'has' ? '✓' : filtreDeployable === 'missing' ? '✗' : ''} {readinessStats.deployable} / {approuves.length} déployables
          </button>
          <span style={{ color: '#e2e8f0' }}>|</span>
          {READINESS_STEPS.map(step => {
            const count = readinessStats[step.key]
            const missing = baseTotal - count
            const state = filtresReadiness[step.key]
            // Couleurs selon l'état
            const colors = state === 'has'
              ? { border: '#16a34a', bg: '#f0fdf4', text: '#16a34a', badgeBg: '#16a34a', badgeText: 'white', badgeCount: count }
              : state === 'missing'
              ? { border: '#ef4444', bg: '#fef2f2', text: '#ef4444', badgeBg: '#ef4444', badgeText: 'white', badgeCount: missing }
              : { border: '#e2e8f0', bg: 'white', text: '#64748b', badgeBg: '#16a34a', badgeText: 'white', badgeCount: count }
            return (
              <button
                key={step.key}
                onClick={() => toggleReadinessFilter(step.key)}
                title={`${readinessDetails[step.key]}\n\nCliquer pour filtrer : ${state === null ? 'ceux qui l\'ont' : state === 'has' ? 'ceux à qui ça manque' : 'retirer le filtre'}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.bg,
                  color: colors.text,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {state === 'has' && '✓ '}{state === 'missing' && '✗ '}{step.icon} {step.label}
                <span style={{
                  fontSize: '10px', padding: '0 5px', borderRadius: '8px', fontWeight: '700',
                  backgroundColor: colors.badgeBg,
                  color: colors.badgeText,
                }}>
                  {colors.badgeCount}
                </span>
              </button>
            )
          })}
          {/* Indicateur certificats */}
          {(readinessStats.certifs_manquants > 0 || readinessStats.certifs_en_attente > 0) && (
            <>
              <span style={{ color: '#e2e8f0' }}>|</span>
              {readinessStats.certifs_manquants > 0 && (
                <button
                  onClick={() => { setFiltreCertifsManquants(prev => !prev); setFiltreCertifsEnAttente(false); setGroupesFiltres(['Approuvé']) }}
                  title={`${readinessStats.certifs_manquants} réserviste${readinessStats.certifs_manquants > 1 ? 's' : ''} avec certificat(s) manquant(s)\nCliquer pour filtrer`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                    border: `1px solid ${filtreCertifsManquants ? '#ef4444' : '#fecaca'}`,
                    backgroundColor: filtreCertifsManquants ? '#fef2f2' : '#fef2f2', color: filtreCertifsManquants ? '#ef4444' : '#dc2626',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {filtreCertifsManquants && '✓ '}📎 Fichiers manquants
                  <span style={{ fontSize: '10px', padding: '0 5px', borderRadius: '8px', fontWeight: '700', backgroundColor: '#dc2626', color: 'white' }}>
                    {readinessStats.certifs_manquants}
                  </span>
                </button>
              )}
              {readinessStats.certifs_en_attente > 0 && (
                <button
                  onClick={() => { setFiltreCertifsEnAttente(prev => !prev); setFiltreCertifsManquants(false); setGroupesFiltres(['Approuvé']) }}
                  title={`${readinessStats.certifs_en_attente} réserviste${readinessStats.certifs_en_attente > 1 ? 's' : ''} avec certificat(s) en attente d'approbation\nCliquer pour filtrer`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                    border: `1px solid ${filtreCertifsEnAttente ? '#d97706' : '#fde68a'}`,
                    backgroundColor: filtreCertifsEnAttente ? '#fffbeb' : '#fffbeb', color: filtreCertifsEnAttente ? '#d97706' : '#d97706',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {filtreCertifsEnAttente && '✓ '}📄 En attente
                  <span style={{ fontSize: '10px', padding: '0 5px', borderRadius: '8px', fontWeight: '700', backgroundColor: '#d97706', color: 'white' }}>
                    {readinessStats.certifs_en_attente}
                  </span>
                </button>
              )}
            </>
          )}
          {(filtreBottes || filtreOrganisme || filtreGroupeRS || hasAnyReadinessFilter) && (
            <button onClick={() => { setFiltreBottes(false); setFiltreOrganisme(''); setFiltreGroupeRS(''); setFiltresReadiness({ profil: null, initiation: null, camp: null, antecedents: null }); setFiltreDeployable(null); setFiltreCertifsManquants(false); setFiltreCertifsEnAttente(false) }} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '4px' }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>

      </div>{/* Fin zone fixe */}

        {/* Tableau — zone scrollable */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '16px', ...(isMobile ? {} : { overflow: 'hidden' }) }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as const, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ minWidth: '1280px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* En-tête tableau — figé en haut (ne défile pas) */}
          <div style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc', flexShrink: 0 }}>
            {/* Ligne 1 : Titres */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0' }}>
              {canEmail && (
                <div style={{ ...thStyle(true), justifyContent: 'center', padding: '8px 8px 2px' }}>
                  <input type="checkbox" checked={selectedIds.size === data.length && data.length > 0} onChange={toggleSelectAll} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C }} />
                </div>
              )}
              <div style={thStyle()} onClick={() => handleSort('nom')}>Nom{sortArrow('nom')}</div>
              <div style={thStyle()} onClick={() => handleSort('telephone')}>Téléphone{sortArrow('telephone')}</div>
              <div style={thStyle()} onClick={() => handleSort('email')}>Courriel{sortArrow('email')}</div>
              <div style={thStyle()} onClick={() => handleSort('ville')}>Ville{sortArrow('ville')}</div>
              <div style={thStyle()} onClick={() => handleSort('region')}>Région{sortArrow('region')}</div>
              <div style={thStyle()} onClick={() => handleSort('organisme')}>Organisme{sortArrow('organisme')}</div>
              <div style={thStyle()} onClick={() => handleSort('groupe_recherche')}>Groupe RS{sortArrow('groupe_recherche')}</div>
              <div style={thStyle()} onClick={() => handleSort('bottes')}>Bottes{sortArrow('bottes')}</div>
              <div style={thStyle()} onClick={() => handleSort('groupe')}>Groupe{sortArrow('groupe')}</div>
              <div style={{ ...thStyle(), justifyContent: 'center' }} onClick={() => handleSort('readiness')}>Prêt{sortArrow('readiness')}</div>
              <div style={thStyle()} onClick={() => handleSort('antecedents')}>Antécédents{sortArrow('antecedents')}</div>
            </div>
            {/* Ligne 2 : Counts + Checkboxes de filtre */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0' }}>
              {canEmail && <div />}
              <div /> {/* Nom */}
              <div /> {/* Téléphone */}
              <div /> {/* Courriel */}
              <div /> {/* Ville */}
              <div /> {/* Région */}
              {/* Organisme — filtre dropdown */}
              <div style={thSubStyle}>
                <select
                  value={filtreOrganisme}
                  onChange={e => setFiltreOrganisme(e.target.value)}
                  style={{ fontSize: '9px', padding: '1px 2px', borderRadius: '4px', border: `1px solid ${filtreOrganisme ? '#3b82f6' : '#d1d5db'}`, backgroundColor: filtreOrganisme ? '#eff6ff' : 'white', color: filtreOrganisme ? '#1d4ed8' : '#94a3b8', cursor: 'pointer', width: '100%', maxWidth: '100%' }}
                >
                  <option value="">Tous</option>
                  {organismesUniques.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {/* Groupe RS — filtre dropdown */}
              <div style={thSubStyle}>
                <select
                  value={filtreGroupeRS}
                  onChange={e => setFiltreGroupeRS(e.target.value)}
                  style={{ fontSize: '9px', padding: '1px 2px', borderRadius: '4px', border: `1px solid ${filtreGroupeRS ? '#3b82f6' : '#d1d5db'}`, backgroundColor: filtreGroupeRS ? '#eff6ff' : 'white', color: filtreGroupeRS ? '#1d4ed8' : '#94a3b8', cursor: 'pointer', width: '100%', maxWidth: '100%' }}
                >
                  <option value="">Tous</option>
                  {groupesRSUniques.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {/* Bottes — count (adaptatif aux filtres) */}
              <div style={{ ...thSubStyle, justifyContent: 'center' }}>
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: C, color: 'white', fontWeight: '700' }}>
                  {data.filter(r => r.remboursement_bottes_date).length}
                </span>
              </div>
              <div /> {/* Groupe */}
              {/* Prêt — 3 checkboxes filtre */}
              <div style={{ ...thSubStyle, justifyContent: 'center', gap: '2px', padding: '0 4px 6px' }}>
                {PRET_STEPS.map(step => {
                  const state = filtresReadiness[step.key]
                  const isActive = state !== null
                  return (
                    <button
                      key={step.key}
                      onClick={() => toggleReadinessFilter(step.key)}
                      title={`${step.label}\n${state === null ? 'Cliquer → montrer ceux qui l\'ont' : state === 'has' ? 'Cliquer → montrer manquants' : 'Cliquer → retirer filtre'}`}
                      style={{
                        fontSize: '9px', fontWeight: '700', padding: '1px 4px', borderRadius: '4px',
                        border: `1px solid ${state === 'has' ? '#16a34a' : state === 'missing' ? '#ef4444' : '#d1d5db'}`,
                        backgroundColor: state === 'has' ? '#f0fdf4' : state === 'missing' ? '#fef2f2' : 'white',
                        color: state === 'has' ? '#16a34a' : state === 'missing' ? '#ef4444' : '#94a3b8',
                        cursor: 'pointer', lineHeight: '14px', transition: 'all 0.15s',
                      }}
                    >
                      {step.key === 'profil' ? 'P' : step.key === 'initiation' ? 'I' : 'C'}
                    </button>
                  )
                })}
                <button
                  onClick={() => handleSort('certifs')}
                  title={`Trier par certificats manquants`}
                  style={{
                    fontSize: '9px', fontWeight: '700', padding: '1px 4px', borderRadius: '4px',
                    border: `1px solid ${sortKey === 'certifs' ? '#d97706' : '#d1d5db'}`,
                    backgroundColor: sortKey === 'certifs' ? '#fffbeb' : 'white',
                    color: sortKey === 'certifs' ? '#d97706' : '#94a3b8',
                    cursor: 'pointer', lineHeight: '14px', transition: 'all 0.15s',
                  }}
                >
                  📎{sortKey === 'certifs' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </div>
              {/* Antécédents — count (adaptatif aux filtres) + bouton filtre */}
              <div style={{ ...thSubStyle, justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#16a34a', color: 'white', fontWeight: '700' }}>
                  {data.filter(r => r.antecedents_statut === 'verifie').length}
                </span>
                <button
                  onClick={() => toggleReadinessFilter('antecedents')}
                  title={`Antécédents vérifiés\n${filtresReadiness.antecedents === null ? 'Cliquer → montrer vérifiés' : filtresReadiness.antecedents === 'has' ? 'Cliquer → montrer manquants' : 'Cliquer → retirer filtre'}`}
                  style={{
                    fontSize: '9px', fontWeight: '700', padding: '1px 4px', borderRadius: '4px',
                    border: `1px solid ${filtresReadiness.antecedents === 'has' ? '#16a34a' : filtresReadiness.antecedents === 'missing' ? '#ef4444' : '#d1d5db'}`,
                    backgroundColor: filtresReadiness.antecedents === 'has' ? '#f0fdf4' : filtresReadiness.antecedents === 'missing' ? '#fef2f2' : 'white',
                    color: filtresReadiness.antecedents === 'has' ? '#16a34a' : filtresReadiness.antecedents === 'missing' ? '#ef4444' : '#94a3b8',
                    cursor: 'pointer', lineHeight: '14px', transition: 'all 0.15s',
                  }}
                >
                  A
                </button>
              </div>
            </div>
          </div>

          {/* Lignes — zone qui défile */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
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
                    onContextMenu={(e) => {
                      if (!canEmail) return
                      e.preventDefault()
                      e.stopPropagation()
                      setContextMenu({ x: e.clientX, y: e.clientY, reserviste: r })
                    }}
                    style={{ fontWeight: '600', fontSize: '13px', color: canEmail ? C : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: canEmail ? 'pointer' : 'default', textDecoration: canEmail ? 'underline' : 'none', textDecorationColor: canEmail ? '#bfdbfe' : undefined, textUnderlineOffset: '2px' }}
                    title={canEmail ? `Clic: fiche · Clic droit: actions rapides` : undefined}
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
                            setSelectedDestinataires(new Map([[r.benevole_id, { benevole_id: r.benevole_id, email: r.email, prenom: r.prenom, nom: r.nom }]]))
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
                {/* Organisme */}
                <div style={{ padding: '11px 10px', fontSize: '11px', color: '#374151', overflow: 'hidden' }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.org_principale || ''}>
                    {r.org_principale ? (
                      r.org_principale.includes('AQBRS') ? (
                        <span style={{ color: '#374151' }}>{r.groupe_aqbrs || r.org_principale}</span>
                      ) : r.org_principale
                    ) : <span style={{ color: '#d1d5db' }}>—</span>}
                  </div>
                </div>
                {/* Groupe RS */}
                <div style={{ padding: '11px 10px', fontSize: '11px', color: '#374151', overflow: 'hidden' }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.groupe_recherche || ''}>
                    {r.groupe_recherche || <span style={{ color: '#d1d5db' }}>—</span>}
                  </div>
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
                {/* Prêt — 3 étapes (profil, initiation, camp) + indicateur certifs en attente */}
                <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  {PRET_STEPS.map(step => {
                    const ok = rd[step.key]
                    // Détails au survol selon le critère
                    let detail = `${step.label}: ${ok ? 'OK' : 'Manquant'}`
                    if (step.key === 'profil' && !ok) {
                      const manque = []
                      if (!r.date_naissance) manque.push('date de naissance')
                      if (!r.contact_urgence_nom || !r.contact_urgence_telephone) manque.push('contact d\'urgence')
                      if (!r.adresse) manque.push('adresse')
                      if (!r.ville) manque.push('ville')
                      if (!r.region) manque.push('région')
                      if (!r.telephone) manque.push('téléphone')
                      if (!r.email) manque.push('courriel')
                      detail = `Profil incomplet\nManque: ${manque.join(', ')}`
                    }
                    // Camp inscrit mais pas complété → jaune
                    const campInscrit = step.key === 'camp' && !ok && r.camp_inscrit
                    if (campInscrit) {
                      detail = 'Camp non complété — inscrit à un camp à venir'
                    }
                    return (
                      <div
                        key={step.key}
                        title={detail}
                        style={{
                          width: '26px', height: '26px', borderRadius: '6px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px',
                          backgroundColor: ok ? '#f0fdf4' : campInscrit ? '#fffbeb' : '#fef2f2',
                          border: `1px solid ${ok ? '#bbf7d0' : campInscrit ? '#fde68a' : '#fecaca'}`,
                          color: ok ? '#16a34a' : campInscrit ? '#d97706' : '#dc2626',
                          fontWeight: '700',
                        }}
                      >
                        {ok ? '✓' : '✗'}
                      </div>
                    )
                  })}
                  {/* Pastille certificats : vert = tout OK, jaune = en attente d'approbation, rouge = fichier manquant */}
                  {(() => {
                    const manquants = r.certifs_manquants
                    const enAttente = r.certifs_en_attente
                    const total = manquants + enAttente
                    if (total === 0) return null
                    // Rouge si fichiers manquants, jaune si seulement en attente d'approbation
                    const hasManquants = manquants > 0
                    const lines = []
                    if (manquants > 0) lines.push(`${manquants} certificat${manquants > 1 ? 's' : ''} — fichier manquant`)
                    if (enAttente > 0) lines.push(`${enAttente} certificat${enAttente > 1 ? 's' : ''} — en attente d'approbation`)
                    return (
                      <div
                        title={lines.join('\n')}
                        style={{
                          width: '26px', height: '26px', borderRadius: '6px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: '700',
                          backgroundColor: hasManquants ? '#fef2f2' : '#fffbeb',
                          border: `1px solid ${hasManquants ? '#fecaca' : '#fde68a'}`,
                          color: hasManquants ? '#dc2626' : '#d97706',
                        }}
                      >
                        {total}
                      </div>
                    )
                  })()}
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
          </div>{/* Fin lignes scrollables */}
        </div>{/* Fin minWidth */}
        </div>{/* Fin overflowX */}
        </div>{/* Fin carte blanche */}
        </div>{/* Fin zone scrollable */}

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

      {/* Menu contextuel (right-click sur nom) */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999,
            backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '6px 0', minWidth: '200px',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '6px 14px', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {contextMenu.reserviste.prenom} {contextMenu.reserviste.nom}
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', margin: '2px 0' }} />
          <button
            onClick={() => { setModalReserviste(contextMenu.reserviste); setContextMenu(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left' }}
            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{ fontSize: '14px' }}>📋</span> Ouvrir la fiche
          </button>
          <button
            onClick={() => {
              window.open(`/profil?bid=${contextMenu.reserviste.benevole_id}&from=reservistes`, '_blank')
              setContextMenu(null)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left' }}
            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{ fontSize: '14px' }}>👤</span> Voir le profil
          </button>
          <button
            onClick={() => {
              setSelectedIds(new Set([contextMenu.reserviste.benevole_id]))
              setSelectedDestinataires(new Map([[contextMenu.reserviste.benevole_id, { benevole_id: contextMenu.reserviste.benevole_id, email: contextMenu.reserviste.email, prenom: contextMenu.reserviste.prenom, nom: contextMenu.reserviste.nom }]]))
              setShowEmailModal(true)
              setContextMenu(null)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left' }}
            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{ fontSize: '14px' }}>✉️</span> Envoyer un courriel
          </button>
          {isAdmin && (
            <>
              <div style={{ borderTop: '1px solid #f1f5f9', margin: '2px 0' }} />
              <button
                onClick={() => { emprunterIdentite(contextMenu.reserviste); setContextMenu(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#d97706', textAlign: 'left' }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = '#fffbeb')}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '14px' }}>🎭</span> Emprunt d{"'"}identité
              </button>
            </>
          )}
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
          isAdmin={isAdmin}
          onClose={() => setModalReserviste(null)}
        />
      )}
    </div>
  )
}
