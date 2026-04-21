'use client'

import { Suspense, useEffect, useLayoutEffect, useState, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatPhone } from '@/utils/phone'
import ModalComposeCourriel from '@/app/components/ModalComposeCourriel'
import ModalReserviste from '@/app/components/ModalReserviste'
import ModalSuppressionReserviste from '@/app/components/ModalSuppressionReserviste'
import ModalRetraitTemporaire from '@/app/components/ModalRetraitTemporaire'
import SavedViewsBar, { type VueFiltres } from '@/app/components/SavedViewsBar'

const C = '#1e3a5f'

const GROUPES_OPTIONS = [
  { val: 'Approuvé',             label: 'Approuvé',             couleur: '#22c55e', bg: '#f0fdf4' },
  { val: 'Intérêt',              label: 'Intérêt',              couleur: '#f59e0b', bg: '#fffbeb' },
  { val: 'Partenaires',          label: 'Partenaires',          couleur: '#4a7b65', bg: '#f0fdf4' },
  { val: 'Partenaires RS',       label: 'Partenaires RS',       couleur: '#7c3aed', bg: '#f5f3ff' },
  { val: 'Retrait temporaire',   label: 'Retrait temporaire',   couleur: '#ef4444', bg: '#fef2f2' },
  { val: 'Formation incomplète', label: 'Formation incomplète', couleur: '#0891b2', bg: '#ecfeff' },
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
  responsable_groupe: boolean
  dispo_veille?: boolean | null
  dispo_veille_note?: string | null
  created_at?: string
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

// Readiness helpers — 5 critères de déployabilité
type ReadinessKey = 'profil' | 'initiation' | 'camp' | 'bottes' | 'antecedents'
const READINESS_STEPS: { key: ReadinessKey; label: string; short: string; icon: string }[] = [
  { key: 'profil',       label: 'Profil complet',          short: 'Profil', icon: '👤' },
  { key: 'initiation',   label: 'Initiation SC complétée', short: 'Init',   icon: '🎓' },
  { key: 'camp',         label: 'Camp de qualification',    short: 'Camp',   icon: '⛺' },
  { key: 'bottes',       label: 'Bottes remboursées',       short: 'Bottes', icon: '🥾' },
  { key: 'antecedents',  label: 'Antécédents vérifiés',    short: 'Antéc',  icon: '🔍' },
]

// Colonnes "Prêt" = profil, initiation, camp — bottes et antécédents ont leur propre colonne
const PRET_STEPS = READINESS_STEPS.filter(s => s.key !== 'antecedents' && s.key !== 'bottes')

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
    bottes: !!r.remboursement_bottes_date,
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
  const [allData,        setAllData]        = useState<Reserviste[]>([])  // Cache complet (tous groupes)
  const [recherche,      setRecherche]      = useState('')
  const [groupesFiltres, setGroupesFiltres] = useState<string[]>(defaultGroupes)
  const [viewResetKey, setViewResetKey] = useState(0)
  const dataLoaded = useRef(false)
  const [exporting,      setExporting]      = useState(false)
  const [sortKey,        setSortKey]        = useState<SortKey>('nom')
  const [sortDir,        setSortDir]        = useState<SortDir>('asc')
  const [authorized,     setAuthorized]     = useState(false)
  const [userRole,       setUserRole]       = useState<string>('')
  const [filtreOrganisme, setFiltreOrganisme] = useState<string>('')
  const [filtreGroupeRS, setFiltreGroupeRS] = useState<string>('')
  // Filtres readiness 3 états : null (off) → 'has' (ceux qui l'ont) → 'missing' (ceux à qui ça manque) → null
  type FilterState = 'has' | 'missing' | null
  const [filtresReadiness, setFiltresReadiness] = useState<Record<ReadinessKey, FilterState>>({ profil: null, initiation: null, camp: null, bottes: null, antecedents: null })
  const [filtreDispoVeille, setFiltreDispoVeille] = useState(false)
  const [filtreDeployable, setFiltreDeployable] = useState<FilterState>(null)
  const [filtreCertifsManquants, setFiltreCertifsManquants] = useState(false)
  const [commsCount,     setCommsCount]     = useState<Record<string, { courriels: number; notes: number; non_lus?: number }>>({})
  const [modal,          setModal]          = useState<ModalAntecedents | null>(null)
  const [modalDate,      setModalDate]      = useState('')
  const [modalStatut,    setModalStatut]    = useState('verifie')
  const [modalSaving,    setModalSaving]    = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [selectedDestinataires, setSelectedDestinataires] = useState<Map<string, { benevole_id: string; email: string; prenom: string; nom: string }>>(new Map())
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [modalReserviste, setModalReserviste] = useState<Reserviste | null>(null)
  const [suppressionCible, setSuppressionCible] = useState<Reserviste | null>(null)
  const [retraitCible, setRetraitCible] = useState<{ reserviste: Reserviste; mode: 'retrait' | 'reactivation'; groupeReactivation?: string } | null>(null)
  // Cache des derniers retraits par benevole_id pour tooltip sur badge
  const [retraitsInfo, setRetraitsInfo] = useState<Record<string, { raison: string; effectue_le: string; effectue_par_email: string | null } | null>>({})
  const [currentUserId, setCurrentUserId] = useState<string>('')
  // Menu contextuel (right-click desktop uniquement)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; reserviste: Reserviste } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  // Click-to-copy feedback (adjoint)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  // Transfert de camp
  const [transferCible, setTransferCible] = useState<Reserviste | null>(null)
  const [transferCampActuel, setTransferCampActuel] = useState<string | null>(null)
  const [campsDisponibles, setCampsDisponibles] = useState<Array<{ session_id: string; nom: string; dates: string; site: string; location: string }>>([])
  const [transferLoading, setTransferLoading] = useState(false)

  // Notes non lues
  const [notesNonLuesIds, setNotesNonLuesIds] = useState<Set<string>>(new Set())
  const [notesNonLuesCount, setNotesNonLuesCount] = useState(0)
  const [filtreNotesNonLues, setFiltreNotesNonLues] = useState(false)

  // Responsive — ne pas figer la page sur mobile
  const [isMobile, setIsMobile] = useState(false)
  const [filtresOuverts, setFiltresOuverts] = useState(true)
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (mobile) setFiltresOuverts(false)
    }
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
    setFiltresReadiness({ profil: null, initiation: null, camp: null, bottes: null, antecedents: null })
    setFiltreDeployable(null)
    setFiltreCertifsManquants(false)
  }, [urlParamsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auth
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 1. Chercher par user_id (le plus fiable)
      let res = (await supabase.from('reservistes').select('role, benevole_id').eq('user_id', user.id).single()).data

      // 2. Fallback par email si user_id pas lié
      if (!res && user.email) {
        const { data: byEmail } = await supabase.from('reservistes').select('role, benevole_id').ilike('email', user.email).single()
        if (byEmail && byEmail.benevole_id) {
          // Lier le user_id pour la prochaine fois
          await supabase.from('reservistes').update({ user_id: user.id }).eq('benevole_id', byEmail.benevole_id)
          res = byEmail
        }
      }

      if (!res || !res.role || !['superadmin', 'admin', 'coordonnateur', 'adjoint'].includes(res.role)) { router.push('/'); return }
      setUserRole(res.role)
      setCurrentUserId(user.id)
      setAuthorized(true)
    }
    init()
  }, [])

  // Charger TOUS les réservistes une seule fois (cache complet côté client)
  useEffect(() => {
    if (!authorized || dataLoaded.current) return
    const load = async () => {
      setLoading(true)
      const params = new URLSearchParams()
      // Quand on vient du dashboard, respecter les groupes du URL ; sinon charger tous les groupes
      const groupesACharger = urlFrom === 'dashboard' && urlGroupes
        ? urlGroupes
        : 'Approuvé,Intérêt,Partenaires,Partenaires RS,Retrait temporaire,Formation incomplète'
      params.set('groupes', groupesACharger)
      // Passer les URL params spéciaux (camp, etc.) qui nécessitent un filtre serveur
      if (urlCampSession) params.set('camp_session', urlCampSession)
      if (urlCampStatut) params.set('camp_statut', urlCampStatut)
      if (urlOrgPrincipale) params.set('org_principale', urlOrgPrincipale)
      if (urlStatut) params.set('statut', urlStatut)
      if (urlRegion) params.set('region', urlRegion)
      const res = await fetch(`/api/admin/reservistes?${params}`)
      const json = await res.json()
      setAllData(json.data || [])
      dataLoaded.current = true
      setLoading(false)
    }
    load()
  }, [authorized])

  // Charger les compteurs courriels/notes
  useEffect(() => {
    if (!authorized) return
    fetch('/api/admin/reservistes/comms-count')
      .then(r => r.json())
      .then(data => setCommsCount(data))
      .catch(() => {})
  }, [authorized])

  // Auto-refresh silencieux toutes les 5 min — pause quand l'onglet est caché (économie Vercel)
  useEffect(() => {
    if (!authorized || !dataLoaded.current) return
    let interval: ReturnType<typeof setInterval> | null = null

    const doRefresh = async () => {
      if (document.hidden) return // Ne pas recharger si l'onglet est en arrière-plan
      try {
        const params = new URLSearchParams()
        params.set('groupes', 'Approuvé,Intérêt,Partenaires,Partenaires RS,Retrait temporaire,Formation incomplète')
        if (urlCampSession) params.set('camp_session', urlCampSession)
        if (urlCampStatut) params.set('camp_statut', urlCampStatut)
        if (urlOrgPrincipale) params.set('org_principale', urlOrgPrincipale)
        if (urlStatut) params.set('statut', urlStatut)
        const res = await fetch(`/api/admin/reservistes?${params}`)
        const json = await res.json()
        if (json.data) setAllData(json.data)
      } catch { /* silencieux */ }
    }

    const startInterval = () => { interval = setInterval(doRefresh, 300000) } // 5 min
    const stopInterval = () => { if (interval) { clearInterval(interval); interval = null } }

    // Rafraîchir immédiatement quand l'onglet redevient visible, puis relancer le timer
    const handleVisibility = () => {
      if (document.hidden) {
        stopInterval()
      } else {
        doRefresh()
        startInterval()
      }
    }

    startInterval()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => { stopInterval(); document.removeEventListener('visibilitychange', handleVisibility) }
  }, [authorized])

  // Charger les notes non lues (benevole_ids)
  const fetchNotesNonLues = async () => {
    try {
      const res = await fetch('/api/admin/notes/non-lues?detail=1')
      const json = await res.json()
      setNotesNonLuesIds(new Set(json.benevole_ids || []))
      setNotesNonLuesCount(json.count || 0)
    } catch {}
  }
  useEffect(() => {
    if (!authorized) return
    fetchNotesNonLues()
    // Écouter les mises à jour (quand on marque des notes comme lues dans le modal)
    const handler = () => fetchNotesNonLues()
    window.addEventListener('notes-badge-update', handler)
    return () => window.removeEventListener('notes-badge-update', handler)
  }, [authorized])

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

  const hasAnyReadinessFilter = Object.values(filtresReadiness).some(v => v !== null) || filtreDeployable !== null || filtreCertifsManquants

  // Liste des organismes uniques pour le filtre (depuis allData pour avoir la liste complète)
  const organismesUniques = useMemo(() => {
    const set = new Set<string>()
    for (const r of allData) {
      if (r.org_principale) set.add(r.org_principale)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allData])

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
    for (const r of allData) {
      if (r.groupe_recherche) set.add(r.groupe_recherche)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allData, groupesRSTable])

  // rawData = allData filtré par groupes + recherche (pour compatibilité avec le reste du code)
  const rawData = useMemo(() => {
    let filtered = allData
    // Filtre par groupe
    if (groupesFiltres.length > 0) filtered = filtered.filter(r => groupesFiltres.includes(r.groupe))
    // Filtre par recherche texte (insensible casse + accents, mots indépendants)
    if (recherche) {
      const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const mots = normalize(recherche).split(/\s+/).filter(Boolean)
      filtered = filtered.filter(r => {
        const champs = normalize(`${r.prenom} ${r.nom} ${r.email} ${r.ville} ${r.region} ${r.telephone} ${r.org_principale}`)
        return mots.every(mot => champs.includes(mot))
      })
    }
    // URL params spéciaux (filtrés côté client maintenant)
    if (urlOrganisme) {
      if (urlOrganisme === 'AQBRS' || urlOrganisme.includes('AQBRS')) {
        filtered = filtered.filter(r => (r.org_principale || '').includes('AQBRS'))
      } else if (urlOrganisme === 'sans_org') {
        filtered = filtered.filter(r => !r.org_principale)
      } else if (urlOrganisme === 'autres_org') {
        filtered = filtered.filter(r => {
          const org = r.org_principale || ''
          return org.length > 0 && !org.includes('AQBRS')
        })
      } else {
        filtered = filtered.filter(r => (r.org_principale || '').includes(urlOrganisme))
      }
    }
    if (urlRegion) filtered = filtered.filter(r => (r.region || '').toLowerCase().trim() === urlRegion.toLowerCase().trim())
    if (urlAntecedents) {
      if (urlAntecedents === 'en_attente') filtered = filtered.filter(r => !r.antecedents_statut || r.antecedents_statut === 'en_attente')
      else filtered = filtered.filter(r => r.antecedents_statut === urlAntecedents)
    }
    if (urlBottes === 'oui') filtered = filtered.filter(r => !!r.remboursement_bottes_date)
    else if (urlBottes === 'non') filtered = filtered.filter(r => !r.remboursement_bottes_date)
    if (urlInscritDepuis) {
      const jours = parseInt(urlInscritDepuis)
      if (!isNaN(jours)) {
        const depuis = new Date(Date.now() - jours * 86400000).toISOString()
        filtered = filtered.filter(r => (r.created_at && r.created_at >= depuis))
      }
    }
    return filtered
  }, [allData, groupesFiltres, recherche, urlOrganisme, urlRegion, urlAntecedents, urlBottes, urlInscritDepuis])

  const total = rawData.length

  // Sorted + filtered data (filtres avancés côté client)
  const data = useMemo(() => {
    let filtered = rawData
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
    // Filtre notes non lues
    if (filtreNotesNonLues) filtered = filtered.filter(r => notesNonLuesIds.has(r.benevole_id))
    // Filtre dispo veille
    if (filtreDispoVeille) filtered = filtered.filter(r => r.dispo_veille === true)
    return sortData(filtered, sortKey, sortDir)
  }, [rawData, filtreOrganisme, filtreGroupeRS, filtresReadiness, filtreDeployable, filtreCertifsManquants, filtreNotesNonLues, filtreDispoVeille, notesNonLuesIds, sortKey, sortDir])

  const handleRecherche = (val: string) => setRecherche(val)

  const toggleGroupe = (g: string, shiftKey = false) => {
    setViewResetKey(k => k + 1)
    if (shiftKey) {
      // Shift+clic = multi-sélection (ajouter/retirer)
      setGroupesFiltres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
    } else {
      // Clic simple = sélection exclusive (ou déselection si déjà seul)
      setGroupesFiltres(prev => {
        if (prev.length === 1 && prev[0] === g) return [] // Déjà seul sélectionné → tout déselectionner
        return [g]
      })
    }
  }

  const lastSelectedIdx = useRef<number | null>(null)

  const toggleSelect = (id: string, index?: number, shiftKey?: boolean) => {
    // Shift+Click = sélection de plage
    if (shiftKey && index !== undefined && lastSelectedIdx.current !== null && lastSelectedIdx.current !== index) {
      const start = Math.min(lastSelectedIdx.current, index)
      const end = Math.max(lastSelectedIdx.current, index)
      const rangeIds = data.slice(start, end + 1).map(r => r.benevole_id)
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (const rid of rangeIds) next.add(rid)
        return next
      })
      setSelectedDestinataires(prev => {
        const next = new Map(prev)
        for (const rid of rangeIds) {
          if (!next.has(rid)) {
            const r = data.find(r => r.benevole_id === rid)
            if (r) next.set(rid, { benevole_id: r.benevole_id, email: r.email, prenom: r.prenom, nom: r.nom })
          }
        }
        return next
      })
      return
    }

    // Clic normal
    if (index !== undefined) lastSelectedIdx.current = index
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
    filtreOrganisme,
    filtreGroupeRS,
    filtresReadiness,
    filtreDeployable,
    filtreCertifsManquants,
  })

  const loadViewFilters = (f: VueFiltres) => {
    if (f.recherche !== undefined) setRecherche(f.recherche || '')
    if (f.groupes) setGroupesFiltres(f.groupes)
    if (f.sortKey) setSortKey(f.sortKey as SortKey)
    if (f.sortDir) setSortDir(f.sortDir as SortDir)
    // Rétro-compat : ancien filtreBottes boolean → nouveau filtre readiness
    if (f.filtreBottes) setFiltresReadiness(prev => ({ ...prev, bottes: 'has' }))
    if (f.filtreOrganisme !== undefined) setFiltreOrganisme(f.filtreOrganisme || '')
    if (f.filtreGroupeRS !== undefined) setFiltreGroupeRS(f.filtreGroupeRS || '')
    if (f.filtresReadiness) setFiltresReadiness(f.filtresReadiness as Record<ReadinessKey, FilterState>)
    if (f.filtreDeployable !== undefined) setFiltreDeployable(f.filtreDeployable as FilterState)
    if (f.filtreCertifsManquants !== undefined) setFiltreCertifsManquants(f.filtreCertifsManquants || false)
  }

  const getDestinatairesFromSelection = () =>
    Array.from(selectedDestinataires.values())

  const exporter = async () => {
    setExporting(true)
    const params = new URLSearchParams({ format: 'xlsx' })
    // Si des réservistes sont sélectionnés, exporter seulement la sélection
    if (selectedIds.size > 0) {
      params.set('ids', [...selectedIds].join(','))
    } else {
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
    }
    const res  = await fetch(`/api/admin/reservistes?${params}`)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `reservistes-${selectedIds.size > 0 ? `selection-${selectedIds.size}` : new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  // Ajuster la position du menu contextuel pour qu'il reste dans la fenêtre visible
  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return
    const el = contextMenuRef.current
    const rect = el.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    let { x, y } = contextMenu
    let changed = false
    if (rect.right > vw - margin) {
      x = Math.max(margin, vw - rect.width - margin)
      changed = true
    }
    if (rect.bottom > vh - margin) {
      y = Math.max(margin, vh - rect.height - margin)
      changed = true
    }
    if (changed) {
      setContextMenu(prev => prev ? { ...prev, x, y } : prev)
    }
  }, [contextMenu?.x, contextMenu?.y, contextMenu?.reserviste?.benevole_id])

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
      setAllData(prev => prev.map(r =>
        r.benevole_id === benevole_id ? { ...r, remboursement_bottes_date: newDate } : r
      ))
    }
  }

  const toggleDispoVeille = async (benevole_id: string, currentValue: boolean | null | undefined) => {
    const newValue = !currentValue
    const res = await fetch('/api/admin/reservistes/dispo-veille', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benevole_id, dispo_veille: newValue }),
    })
    if (res.ok) {
      setAllData(prev => prev.map(r =>
        r.benevole_id === benevole_id ? { ...r, dispo_veille: newValue } : r
      ))
    }
  }

  const saveDispoVeilleNote = async (benevole_id: string, note: string) => {
    const res = await fetch('/api/admin/reservistes/dispo-veille', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benevole_id, dispo_veille_note: note }),
    })
    if (res.ok) {
      setAllData(prev => prev.map(r =>
        r.benevole_id === benevole_id ? { ...r, dispo_veille_note: note.trim() || null } : r
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
      setAllData(prev => prev.map(r =>
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

  const isSuperAdmin = userRole === 'superadmin'
  const isAdmin = userRole === 'superadmin' || userRole === 'admin'
  const isAdjoint = userRole === 'adjoint'
  const canEmail = ['superadmin', 'admin', 'coordonnateur'].includes(userRole)

  // Readiness stats — calculé sur rawData (déjà filtré par groupes sélectionnés)
  // Déployable reste sur Approuvés seulement
  const approuves = useMemo(() => rawData.filter(r => r.groupe === 'Approuvé'), [rawData])

  // Stats readiness : calculées sur rawData filtré par organisme/groupe RS SEULEMENT
  // (exclut les filtres readiness eux-mêmes pour que les compteurs restent stables lors du cyclage)
  const hasAdvancedFilters = filtreOrganisme || filtreGroupeRS || Object.values(filtresReadiness).some(v => v !== null) || filtreDeployable !== null || filtreCertifsManquants || filtreNotesNonLues
  const statsSource = useMemo(() => {
    let source = rawData
    if (filtreOrganisme) source = source.filter(r => (r.org_principale || '').includes(filtreOrganisme))
    if (filtreGroupeRS) source = source.filter(r => (r.groupe_recherche || '') === filtreGroupeRS)
    if (filtreNotesNonLues) source = source.filter(r => notesNonLuesIds.has(r.benevole_id))
    return source
  }, [rawData, filtreOrganisme, filtreGroupeRS, filtreNotesNonLues, notesNonLuesIds])

  const readinessStats = useMemo(() => {
    const stats = { profil: 0, initiation: 0, camp: 0, bottes: 0, antecedents: 0, deployable: 0, certifs_ok: 0, certifs_en_attente: 0, certifs_manquants: 0, certifs_manquants_total: 0 }
    for (const r of statsSource) {
      const rd = getReadiness(r)
      if (rd.profil) stats.profil++
      if (rd.initiation) stats.initiation++
      if (rd.camp) stats.camp++
      if (rd.bottes) stats.bottes++
      if (rd.antecedents) stats.antecedents++
      // Certificats — compter indépendamment (un réserviste peut avoir les deux)
      if (r.certifs_manquants > 0) { stats.certifs_manquants++; stats.certifs_manquants_total += r.certifs_manquants }
      if (r.certifs_en_attente > 0) stats.certifs_en_attente++
    }
    // Déployable = seulement les Approuvés dans la source
    const approuvesSource = hasAdvancedFilters ? statsSource.filter(r => r.groupe === 'Approuvé') : approuves
    for (const r of approuvesSource) {
      if (isDeployable(r)) stats.deployable++
    }
    return stats
  }, [statsSource, approuves, hasAdvancedFilters])

  const baseTotal = statsSource.length

  // Détails pour tooltips — ventilation des manquants par critère
  const readinessDetails = useMemo(() => {
    const total = baseTotal
    // Profil complet — quels champs manquent
    const profilManque = { date_naissance: 0, adresse: 0, ville: 0, region: 0, telephone: 0, contact_urgence_nom: 0, contact_urgence_tel: 0, email: 0, nom: 0, prenom: 0 }
    for (const r of statsSource) {
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
      bottes: `${readinessStats.bottes}/${total} ont leurs bottes remboursées\n${total - readinessStats.bottes} sans bottes`,
      antecedents: `${readinessStats.antecedents}/${total} antécédents vérifiés\n${antManque} en attente de vérification`,
    }
  }, [statsSource, baseTotal, readinessStats])

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

  // Columns: [checkbox] Nom [comms] Téléphone Courriel Ville Région Organisme Bottes Groupe Prêt(3) Antécédents Dispo
  // Adjoint: Nom Téléphone Courriel Adresse Ville Région Bottes Groupe Dispo
  const gridCols = isAdjoint
    ? '0.8fr 0.65fr 0.9fr 1.2fr 0.55fr 0.55fr 70px 85px 70px'
    : canEmail
      ? '36px 0.8fr 38px 0.65fr 0.9fr 0.6fr 0.55fr 0.85fr 0.85fr 70px 85px 120px 120px 70px'
      : '0.8fr 38px 0.65fr 0.9fr 0.6fr 0.55fr 0.85fr 0.85fr 70px 85px 120px 120px 70px'

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 1500)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...(isMobile ? { minHeight: '100%' } : { height: '100%', overflow: 'hidden' }) }}>
      <main style={{ margin: '0 auto', padding: isMobile ? '0 10px' : '0 28px', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, ...(isMobile ? {} : { overflow: 'hidden' }) }}>

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
              onClick={() => router.push(urlFrom === 'dashboard' ? '/admin/dashboard' : '/admin')}
              style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '8px', border: '1px solid #93c5fd', backgroundColor: 'white', color: '#1e40af', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              ← Retour au {urlFrom === 'dashboard' ? 'dashboard' : 'panneau admin'}
            </button>
          </div>
        )}

        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '16px' : '20px', fontWeight: '700', color: C }}>Réservistes</h1>
            <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '20px' }}>
              {loading ? '…' : `${data.length}${data.length !== total ? ` / ${total}` : ''}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', ...( isMobile && !filtresOuverts ? { display: 'none' } : {}) }}>
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
              {exporting ? '⟳ Export…' : selectedIds.size > 0 ? `⬇ Exporter sélection (${selectedIds.size})` : '⬇ Exporter Excel'}
            </button>
            {notesNonLuesIds.size > 0 && (
              <button
                onClick={() => {
                  if (filtreNotesNonLues) {
                    // Désactiver le filtre
                    setFiltreNotesNonLues(false)
                  } else {
                    // Activer le filtre — montrer tous les groupes pour pas manquer des notes
                    setFiltreNotesNonLues(true)
                    setGroupesFiltres(['Approuvé', 'Intérêt', 'Partenaires', 'Partenaires RS', 'Retrait temporaire', 'Formation incomplète'])
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px',
                  border: filtreNotesNonLues ? '2px solid #d946ef' : '1px solid #d946ef',
                  backgroundColor: filtreNotesNonLues ? '#fdf4ff' : 'white',
                  color: '#d946ef', fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {filtreNotesNonLues ? `✕ Notes non lues (${notesNonLuesCount})` : `📝 Notes non lues (${notesNonLuesCount})`}
              </button>
            )}
            {filtreNotesNonLues && (
              <button
                onClick={async () => {
                  await fetch('/api/admin/notes/non-lues', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tout: true }),
                  })
                  setNotesNonLuesIds(new Set())
                  setNotesNonLuesCount(0)
                  setFiltreNotesNonLues(false)
                  window.dispatchEvent(new CustomEvent('notes-badge-update', { detail: { count: 0 } }))
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px',
                  border: '1px solid #d946ef',
                  backgroundColor: '#d946ef', color: 'white', fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                ✓ Tout marquer lu
              </button>
            )}
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
            {/* Suppression en lot desactivee: loi 25 exige une suppression unitaire avec raison.
                Utiliser le menu contextuel (clic droit) sur un reserviste pour le supprimer. */}
          </div>
        </div>

        {/* Vues sauvegardées — compact dans l'en-tête (masquer sur mobile si filtres fermés) */}
        {(!isMobile || filtresOuverts) && (
          <SavedViewsBar currentFilters={getCurrentFilters()} onLoadView={loadViewFilters} resetKey={viewResetKey} />
        )}

        {/* Bouton toggle filtres (mobile) + barre recherche toujours visible */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: isMobile ? '10px 14px' : '16px 20px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: isMobile ? '120px' : '180px', maxWidth: isMobile ? '100%' : '260px', position: 'relative' }}>
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
            {isMobile && (
              <button
                onClick={() => setFiltresOuverts(f => !f)}
                style={{
                  padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                  border: '1px solid #d1d5db', backgroundColor: filtresOuverts ? '#f1f5f9' : 'white',
                  color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {filtresOuverts ? '▲ Filtres' : '▼ Filtres'}
                {hasAdvancedFilters && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />}
              </button>
            )}
            {(!isMobile || filtresOuverts) && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', ...(isMobile ? { width: '100%', marginTop: '8px' } : {}) }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' as const }}>Groupe :</span>
                {GROUPES_OPTIONS.map(opt => (
                  <button
                    key={opt.val}
                    onClick={e => toggleGroupe(opt.val, e.shiftKey)}
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
                {(groupesFiltres.length > 0 || recherche) && (
                  <button onClick={() => { setGroupesFiltres(['Approuvé', 'Intérêt']); setRecherche(''); setFiltreOrganisme(''); setFiltreGroupeRS(''); setFiltresReadiness({ profil: null, initiation: null, camp: null, bottes: null, antecedents: null }); setFiltreDeployable(null); setFiltreCertifsManquants(false); setFiltreNotesNonLues(false); setViewResetKey(k => k + 1) }} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                    Tout effacer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Readiness filter bar — pastilles 3 états : neutre → vert (a) → rouge (manque) → neutre */}
        {!isAdjoint && (!isMobile || filtresOuverts) && (
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
            {filtreDeployable === 'has' ? '✓' : filtreDeployable === 'missing' ? '✗' : ''} {filtreDeployable === 'missing' ? (approuves.length - readinessStats.deployable) : readinessStats.deployable} / {approuves.length} déployables
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
          {readinessStats.certifs_manquants > 0 && (
            <>
              <span style={{ color: '#e2e8f0' }}>|</span>
              {readinessStats.certifs_manquants > 0 && (
                <button
                  onClick={() => { setFiltreCertifsManquants(prev => !prev); setGroupesFiltres(['Approuvé']) }}
                  title={`${readinessStats.certifs_manquants} réserviste${readinessStats.certifs_manquants > 1 ? 's' : ''} · ${readinessStats.certifs_manquants_total} fichier${readinessStats.certifs_manquants_total > 1 ? 's' : ''} manquant${readinessStats.certifs_manquants_total > 1 ? 's' : ''}\nCliquer pour filtrer`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                    border: `1px solid ${filtreCertifsManquants ? '#64748b' : '#cbd5e1'}`,
                    backgroundColor: filtreCertifsManquants ? '#f1f5f9' : '#f8fafc', color: filtreCertifsManquants ? '#334155' : '#475569',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {filtreCertifsManquants && '✓ '}📎 Fichiers manquants
                  <span style={{ fontSize: '10px', padding: '0 5px', borderRadius: '8px', fontWeight: '700', backgroundColor: '#475569', color: 'white' }}>
                    {readinessStats.certifs_manquants} pers. · {readinessStats.certifs_manquants_total} fich.
                  </span>
                </button>
              )}
            </>
          )}
          {(filtreOrganisme || filtreGroupeRS || hasAnyReadinessFilter) && (
            <button onClick={() => { setFiltreOrganisme(''); setFiltreGroupeRS(''); setFiltresReadiness({ profil: null, initiation: null, camp: null, bottes: null, antecedents: null }); setFiltreDeployable(null); setFiltreCertifsManquants(false) }} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '4px' }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>
        )}

      </div>{/* Fin zone fixe */}

        {/* Tableau — zone scrollable */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '16px', minHeight: 0, ...(isMobile ? {} : { overflow: 'hidden' }) }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as const, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ minWidth: '1280px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* En-tête tableau — figé en haut (ne défile pas) */}
          <div style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc', flexShrink: 0 }}>
            {/* Ligne 1 : Titres */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0' }}>
              {!isAdjoint && canEmail && (
                <div style={{ ...thStyle(true), justifyContent: 'center', padding: '8px 8px 2px' }}>
                  <input type="checkbox" checked={selectedIds.size === data.length && data.length > 0} onChange={toggleSelectAll} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C }} />
                </div>
              )}
              <div style={thStyle()} onClick={() => handleSort('nom')}>Nom{sortArrow('nom')}</div>
              {!isAdjoint && <div style={{ ...thStyle(), justifyContent: 'center', padding: '8px 2px' }} title="Courriels / Notes">✉️</div>}
              <div style={thStyle()} onClick={() => handleSort('telephone')}>Téléphone{sortArrow('telephone')}</div>
              <div style={thStyle()} onClick={() => handleSort('email')}>Courriel{sortArrow('email')}</div>
              {isAdjoint && <div style={thStyle()}>Adresse</div>}
              <div style={thStyle()} onClick={() => handleSort('ville')}>Ville{sortArrow('ville')}</div>
              <div style={thStyle()} onClick={() => handleSort('region')}>Région{sortArrow('region')}</div>
              {!isAdjoint && <div style={thStyle()} onClick={() => handleSort('organisme')}>Organisme{sortArrow('organisme')}</div>}
              {!isAdjoint && <div style={thStyle()} onClick={() => handleSort('groupe_recherche')}>Groupe RS{sortArrow('groupe_recherche')}</div>}
              <div style={thStyle()} onClick={() => handleSort('bottes')}>Bottes{sortArrow('bottes')}</div>
              <div style={thStyle()} onClick={() => handleSort('groupe')}>Groupe{sortArrow('groupe')}</div>
              {!isAdjoint && <div style={{ ...thStyle(), justifyContent: 'center' }} onClick={() => handleSort('readiness')}>Prêt{sortArrow('readiness')}</div>}
              {!isAdjoint && <div style={thStyle()} onClick={() => handleSort('antecedents')}>Antécédents{sortArrow('antecedents')}</div>}
              <div style={{ ...thStyle(), justifyContent: 'center' }} title="Disponibilité indicative en phase de veille (pré-déploiement)">Dispo</div>
            </div>
            {/* Ligne 2 : Counts + Checkboxes de filtre */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0' }}>
              {!isAdjoint && canEmail && <div />}
              <div /> {/* Nom */}
              {!isAdjoint && <div /> /* Comms */}
              <div /> {/* Téléphone */}
              <div /> {/* Courriel */}
              {isAdjoint && <div /> /* Adresse */}
              <div /> {/* Ville */}
              <div /> {/* Région */}
              {/* Organisme — filtre dropdown */}
              {!isAdjoint && (
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
              )}
              {/* Groupe RS — filtre dropdown */}
              {!isAdjoint && (
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
              )}
              {/* Bottes — count (adaptatif aux filtres) */}
              <div style={{ ...thSubStyle, justifyContent: 'center' }}>
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: C, color: 'white', fontWeight: '700' }}>
                  {data.filter(r => r.remboursement_bottes_date).length}
                </span>
              </div>
              <div /> {/* Groupe */}
              {/* Prêt — 3 checkboxes filtre + bouton certif (alignés avec les boxes 26px du body) */}
              {!isAdjoint && (
              <div style={{ ...thSubStyle, justifyContent: 'center', gap: '4px', padding: '0 6px 6px' }}>
                {PRET_STEPS.map(step => {
                  const state = filtresReadiness[step.key]
                  return (
                    <button
                      key={step.key}
                      onClick={() => toggleReadinessFilter(step.key)}
                      title={`${step.label}\n${state === null ? 'Cliquer → montrer ceux qui l\'ont' : state === 'has' ? 'Cliquer → montrer manquants' : 'Cliquer → retirer filtre'}`}
                      style={{
                        width: '26px', height: '22px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: '700', padding: 0, borderRadius: '4px',
                        border: `1px solid ${state === 'has' ? '#16a34a' : state === 'missing' ? '#ef4444' : '#d1d5db'}`,
                        backgroundColor: state === 'has' ? '#f0fdf4' : state === 'missing' ? '#fef2f2' : 'white',
                        color: state === 'has' ? '#16a34a' : state === 'missing' ? '#ef4444' : '#94a3b8',
                        cursor: 'pointer', transition: 'all 0.15s',
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
                    width: '26px', height: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: '700', padding: 0, borderRadius: '4px',
                    border: `1px solid ${sortKey === 'certifs' ? '#d97706' : '#d1d5db'}`,
                    backgroundColor: sortKey === 'certifs' ? '#fffbeb' : 'white',
                    color: sortKey === 'certifs' ? '#d97706' : '#94a3b8',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  📎{sortKey === 'certifs' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </div>
              )}
              {/* Antécédents — count (adaptatif aux filtres) + bouton filtre */}
              {!isAdjoint && (
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
              )}
              {/* Dispo veille — count + bouton filtre */}
              <div style={{ ...thSubStyle, justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#ea580c', color: 'white', fontWeight: '700' }}>
                  {data.filter(r => r.dispo_veille).length}
                </span>
                <button
                  onClick={() => setFiltreDispoVeille(prev => !prev)}
                  title={filtreDispoVeille ? 'Montrer tous' : 'Filtrer: dispo veille seulement'}
                  style={{
                    fontSize: '9px', fontWeight: '700', padding: '1px 4px', borderRadius: '4px',
                    border: `1px solid ${filtreDispoVeille ? '#ea580c' : '#d1d5db'}`,
                    backgroundColor: filtreDispoVeille ? '#fff7ed' : 'white',
                    color: filtreDispoVeille ? '#ea580c' : '#94a3b8',
                    cursor: 'pointer', lineHeight: '14px', transition: 'all 0.15s',
                  }}
                >
                  ⏱
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
                {!isAdjoint && canEmail && (
                  <div style={{ padding: '11px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input type="checkbox" checked={selectedIds.has(r.benevole_id)} onClick={(e) => { e.stopPropagation(); toggleSelect(r.benevole_id, i, e.shiftKey) }} readOnly style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C }} />
                  </div>
                )}
                {/* Nom */}
                <div style={{ padding: '11px 10px', overflow: 'hidden' }}>
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      if (canEmail) setModalReserviste(r)
                    }}
                    onContextMenu={(e) => {
                      if (!canEmail) return
                      e.preventDefault()
                      e.stopPropagation()
                      setContextMenu({ x: e.clientX, y: e.clientY, reserviste: r })
                    }}
                    style={{ fontWeight: '600', fontSize: '13px', color: canEmail ? C : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: canEmail ? 'pointer' : 'default', textDecoration: canEmail ? 'underline' : 'none', textDecorationColor: canEmail ? '#bfdbfe' : undefined, textUnderlineOffset: '2px' }}
                    title={canEmail ? `Clic: fiche · Clic droit: actions rapides` : undefined}
                  >{r.nom} {r.prenom}{r.responsable_groupe && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '700', color: '#7c3aed', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', padding: '1px 5px', borderRadius: '4px', verticalAlign: 'middle' }}>RG</span>}</div>
                  {r.telephone_secondaire && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px', whiteSpace: 'nowrap' }}>Alt: {formatPhone(r.telephone_secondaire)}</div>
                  )}
                </div>
                {/* Comms icon */}
                {!isAdjoint && (
                <div
                  onClick={(e) => { e.stopPropagation(); setModalReserviste(r) }}
                  style={{ padding: '8px 2px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  title={(() => { const cc = commsCount[r.benevole_id]; if (!cc) return 'Aucun historique'; let t = `${cc.courriels} courriel${cc.courriels !== 1 ? 's' : ''}, ${cc.notes} note${cc.notes !== 1 ? 's' : ''}`; if (cc.non_lus) t += `\n${cc.non_lus} reponse${cc.non_lus > 1 ? 's' : ''} non lue${cc.non_lus > 1 ? 's' : ''}`; return t })()}
                >
                  {(() => {
                    const cc = commsCount[r.benevole_id]
                    const total = cc ? cc.courriels + cc.notes : 0
                    const nonLus = cc?.non_lus || 0
                    const hasNonLus = nonLus > 0
                    const strokeColor = hasNonLus ? '#059669' : total > 0 ? '#0369a1' : '#94a3b8'
                    const fillColor = hasNonLus ? '#d1fae5' : total > 0 ? '#e0f2fe' : '#f8fafc'
                    const badgeColor = hasNonLus ? '#059669' : '#0369a1'
                    return (
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ opacity: total > 0 ? 1 : 0.3 }}>
                          <rect x="2" y="4" width="16" height="12" rx="2" stroke={strokeColor} strokeWidth="1.5" fill={fillColor} />
                          <path d="M2 6l8 5 8-5" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                        {total > 0 && (
                          <span style={{ position: 'absolute', top: '-4px', right: '-6px', fontSize: '9px', fontWeight: '700', color: 'white', backgroundColor: badgeColor, borderRadius: '6px', padding: '0 3px', minWidth: '14px', textAlign: 'center', lineHeight: '14px' }}>
                            {total}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
                )}
                {/* Téléphone */}
                <div
                  onClick={isAdjoint && r.telephone ? () => copyToClipboard(formatPhone(r.telephone), `tel-${r.benevole_id}`) : undefined}
                  style={{ padding: '11px 10px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap', cursor: isAdjoint && r.telephone ? 'pointer' : 'default' }}
                  title={isAdjoint && r.telephone ? 'Cliquer pour copier' : undefined}
                >
                  {r.telephone ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {copiedField === `tel-${r.benevole_id}` ? <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: '600' }}>Copié !</span> : formatPhone(r.telephone)}
                    </span>
                  ) : <span style={{ color: '#d1d5db' }}>—</span>}
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
                {/* Adresse complète — adjoint seulement */}
                {isAdjoint && (
                <div
                  onClick={() => {
                    const full = [r.adresse, r.ville, r.code_postal].filter(Boolean).join(', ')
                    if (full) copyToClipboard(full, `addr-${r.benevole_id}`)
                  }}
                  style={{ padding: '11px 10px', fontSize: '12px', color: '#374151', overflow: 'hidden', cursor: r.adresse ? 'pointer' : 'default' }}
                  title={r.adresse ? 'Cliquer pour copier l\'adresse complète' : undefined}
                >
                  {copiedField === `addr-${r.benevole_id}` ? (
                    <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: '600' }}>Copié !</span>
                  ) : r.adresse ? (
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={[r.adresse, r.ville, r.code_postal].filter(Boolean).join(', ')}>
                      {r.adresse}
                      {r.code_postal && <div style={{ color: '#94a3b8', marginTop: '1px', fontSize: '10px' }}>{r.code_postal}</div>}
                    </div>
                  ) : <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                )}
                {/* Ville */}
                <div style={{ padding: '11px 10px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.ville || <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                {/* Région */}
                <div style={{ padding: '11px 10px', fontSize: '12px', color: '#374151', overflow: 'hidden' }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.region || <span style={{ color: '#d1d5db' }}>—</span>}</div>
                  {!isAdjoint && r.code_postal && <div style={{ color: '#94a3b8', marginTop: '1px', whiteSpace: 'nowrap', fontSize: '10px' }}>{r.code_postal}</div>}
                </div>
                {/* Organisme */}
                {!isAdjoint && (
                <div style={{ padding: '11px 10px', fontSize: '11px', color: '#374151', overflow: 'hidden' }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.org_principale || ''}>
                    {r.org_principale ? (
                      r.org_principale.includes('AQBRS') ? (
                        <span style={{ color: '#374151' }}>{r.groupe_aqbrs || r.org_principale}</span>
                      ) : r.org_principale
                    ) : <span style={{ color: '#d1d5db' }}>—</span>}
                  </div>
                </div>
                )}
                {/* Groupe RS */}
                {!isAdjoint && (
                <div style={{ padding: '11px 10px', fontSize: '11px', color: '#374151', overflow: 'hidden' }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.groupe_recherche || ''}>
                    {r.groupe_recherche || <span style={{ color: '#d1d5db' }}>—</span>}
                  </div>
                </div>
                )}
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
                <div style={{ padding: '11px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span
                    style={{
                      fontSize: '10px', padding: '2px 7px', borderRadius: '20px',
                      backgroundColor: badge.bg, color: badge.couleur, fontWeight: '600', whiteSpace: 'nowrap' as const,
                      cursor: r.groupe === 'Retrait temporaire' && (isAdmin || userRole === 'coordonnateur') ? 'help' : 'default',
                    }}
                    title={
                      r.groupe === 'Retrait temporaire' && retraitsInfo[r.benevole_id]
                        ? `Retiré le ${new Date(retraitsInfo[r.benevole_id]!.effectue_le).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })}`
                          + (retraitsInfo[r.benevole_id]!.effectue_par_email ? ` par ${retraitsInfo[r.benevole_id]!.effectue_par_email}` : '')
                          + `\nRaison : ${retraitsInfo[r.benevole_id]!.raison}`
                        : (r.groupe === 'Retrait temporaire' && (isAdmin || userRole === 'coordonnateur') ? 'Survolez pour charger le détail…' : undefined)
                    }
                    onMouseEnter={async () => {
                      if (r.groupe !== 'Retrait temporaire') return
                      if (!(isAdmin || userRole === 'coordonnateur')) return
                      if (r.benevole_id in retraitsInfo) return // deja charge (succes ou null)
                      try {
                        const resH = await fetch(`/api/admin/reservistes/historique-retraits?benevole_id=${encodeURIComponent(r.benevole_id)}`)
                        const json = await resH.json()
                        const dernierRetrait = (json.entries || []).find((e: any) => e.action === 'retrait')
                        setRetraitsInfo(prev => ({
                          ...prev,
                          [r.benevole_id]: dernierRetrait
                            ? { raison: dernierRetrait.raison, effectue_le: dernierRetrait.effectue_le, effectue_par_email: dernierRetrait.effectue_par_email }
                            : null,
                        }))
                      } catch {
                        setRetraitsInfo(prev => ({ ...prev, [r.benevole_id]: null }))
                      }
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                {/* Prêt — 3 étapes (profil, initiation, camp) + indicateur certifs en attente */}
                {!isAdjoint && (
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
                          backgroundColor: ok ? '#f0fdf4' : campInscrit ? '#fffbeb' : 'white',
                          border: `1px solid ${ok ? '#bbf7d0' : campInscrit ? '#fde68a' : '#fca5a5'}`,
                          color: ok ? '#16a34a' : campInscrit ? '#d97706' : '#f87171',
                          fontWeight: '700',
                        }}
                      >
                        {ok ? '✓' : '✗'}
                      </div>
                    )
                  })}
                  {/* Pastille certificats : toujours occupe l'espace (26px) pour que
                      l'icône ✏️ de la colonne suivante reste alignée entre les lignes.
                      Vide (invisible) quand aucun certif manquant ou en attente. */}
                  {(() => {
                    const manquants = r.certifs_manquants
                    const enAttente = r.certifs_en_attente
                    const total = manquants + enAttente
                    const hasManquants = manquants > 0
                    const lines = []
                    if (manquants > 0) lines.push(`${manquants} certificat${manquants > 1 ? 's' : ''} — fichier manquant`)
                    if (enAttente > 0) lines.push(`${enAttente} certificat${enAttente > 1 ? 's' : ''} — en attente d'approbation`)
                    if (total === 0) {
                      return <div style={{ width: '26px', height: '26px' }} aria-hidden="true" />
                    }
                    return (
                      <div
                        title={lines.join('\n')}
                        style={{
                          width: '26px', height: '26px', borderRadius: '6px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: '700',
                          backgroundColor: hasManquants ? '#f1f5f9' : '#fffbeb',
                          border: `1px solid ${hasManquants ? '#94a3b8' : '#fde68a'}`,
                          color: hasManquants ? '#475569' : '#d97706',
                        }}
                      >
                        {total}
                      </div>
                    )
                  })()}
                </div>
                )}
                {/* Antécédents : 2 zones — badge+date à gauche, crayon toujours à droite
                    (même position pour toutes les lignes, peu importe la longueur du contenu). */}
                {!isAdjoint && (
                <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '20px', backgroundColor: badgeAnt.bg, color: badgeAnt.couleur, fontWeight: '600', whiteSpace: 'nowrap' as const }}>
                      {badgeAnt.label}
                    </span>
                    {r.antecedents_date_verification && (
                      <span style={{ fontSize: '9px', color: '#64748b', whiteSpace: 'nowrap' as const }}>
                        {moisAnnee(r.antecedents_date_verification)}
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => ouvrirModalAntecedents(r)}
                      title="Modifier"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: '#94a3b8', fontSize: '12px', lineHeight: 1, flexShrink: 0 }}
                    >
                      ✏️
                    </button>
                  )}
                </div>
                )}
                {/* Dispo veille — checkbox + note tooltip */}
                <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={!!r.dispo_veille}
                    onChange={() => toggleDispoVeille(r.benevole_id, r.dispo_veille)}
                    title={r.dispo_veille_note ? `Dispo veille\nNote: ${r.dispo_veille_note}` : 'Cocher si le réserviste a signalé être disponible (veille)'}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#ea580c' }}
                  />
                  {r.dispo_veille && (
                    <button
                      onClick={() => {
                        const note = prompt(`Note pour ${r.prenom} ${r.nom}:`, r.dispo_veille_note || '')
                        if (note !== null) saveDispoVeilleNote(r.benevole_id, note)
                      }}
                      title={r.dispo_veille_note || 'Ajouter une note'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', lineHeight: 1, padding: 0, color: r.dispo_veille_note ? '#ea580c' : '#cbd5e1' }}
                    >
                      {r.dispo_veille_note ? '📝' : '✏️'}
                    </button>
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
          ref={contextMenuRef}
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
              window.open(`/formation?bid=${contextMenu.reserviste.benevole_id}&from=reservistes`, '_blank')
              setContextMenu(null)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left' }}
            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{ fontSize: '14px' }}>🎓</span> Formation et parcours
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
                disabled={!contextMenu.reserviste.camp_inscrit}
                onClick={async () => {
                  const r = contextMenu.reserviste
                  if (!r.camp_inscrit) return
                  setTransferCible(r)
                  setTransferCampActuel(null)
                  setContextMenu(null)
                  // Charger les camps disponibles + camp actuel
                  try {
                    const [campsRes, inscRes] = await Promise.all([
                      fetch('/api/admin/camp/transfer'),
                      createClient().from('inscriptions_camps')
                        .select('camp_nom, session_id')
                        .eq('benevole_id', r.benevole_id)
                        .neq('presence', 'annule')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single()
                    ])
                    if (campsRes.ok) {
                      const { camps } = await campsRes.json()
                      setCampsDisponibles(camps)
                    }
                    if (inscRes.data?.camp_nom) {
                      setTransferCampActuel(inscRes.data.camp_nom)
                    } else {
                      setTransferCampActuel('Aucun camp')
                    }
                  } catch { /* ignore */ }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none',
                  cursor: contextMenu.reserviste.camp_inscrit ? 'pointer' : 'default',
                  fontSize: '13px',
                  color: contextMenu.reserviste.camp_inscrit ? '#374151' : '#cbd5e1',
                  textAlign: 'left',
                }}
                onMouseOver={e => { if (contextMenu.reserviste.camp_inscrit) e.currentTarget.style.backgroundColor = '#f1f5f9' }}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '14px' }}>⛺</span> Changer de camp{!contextMenu.reserviste.camp_inscrit ? ' (non inscrit)' : ''}
              </button>
              <button
                onClick={() => { emprunterIdentite(contextMenu.reserviste); setContextMenu(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#d97706', textAlign: 'left' }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = '#fffbeb')}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '14px' }}>🎭</span> Emprunt d{"'"}identité
              </button>
              <div style={{ borderTop: '1px solid #f1f5f9', margin: '2px 0' }} />
              {contextMenu.reserviste.groupe !== 'Approuvé' && (
                <button
                  onClick={async () => {
                    const r = contextMenu.reserviste
                    // Sortie du Retrait temporaire = passe par la modale (raison + journal)
                    if (r.groupe === 'Retrait temporaire') {
                      setRetraitCible({ reserviste: r, mode: 'reactivation', groupeReactivation: 'Approuvé' })
                      setContextMenu(null)
                      return
                    }
                    const res = await fetch('/api/admin/reservistes/groupe', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ benevole_id: r.benevole_id, groupe: 'Approuvé' }),
                    })
                    if (res.ok) {
                      setAllData(prev => prev.map(x => x.benevole_id === r.benevole_id ? { ...x, groupe: 'Approuvé' } : x))
                    } else {
                      const err = await res.json().catch(() => ({}))
                      alert(`Erreur : ${err.error ?? res.statusText}`)
                    }
                    setContextMenu(null)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#16a34a', textAlign: 'left' }}
                  onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
                  onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ fontSize: '14px' }}>✅</span> Approuver
                </button>
              )}
              {contextMenu.reserviste.groupe !== 'Intérêt' && (
                <button
                  onClick={async () => {
                    const r = contextMenu.reserviste
                    // Sortie du Retrait temporaire = passe par la modale (raison + journal)
                    if (r.groupe === 'Retrait temporaire') {
                      setRetraitCible({ reserviste: r, mode: 'reactivation', groupeReactivation: 'Intérêt' })
                      setContextMenu(null)
                      return
                    }
                    const res = await fetch('/api/admin/reservistes/groupe', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ benevole_id: r.benevole_id, groupe: 'Intérêt' }),
                    })
                    if (res.ok) {
                      setAllData(prev => prev.map(x => x.benevole_id === r.benevole_id ? { ...x, groupe: 'Intérêt' } : x))
                    } else {
                      const err = await res.json().catch(() => ({}))
                      alert(`Erreur : ${err.error ?? res.statusText}`)
                    }
                    setContextMenu(null)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#f59e0b', textAlign: 'left' }}
                  onMouseOver={e => (e.currentTarget.style.backgroundColor = '#fffbeb')}
                  onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ fontSize: '14px' }}>⏳</span> Remettre en Intérêt
                </button>
              )}
              {contextMenu.reserviste.groupe !== 'Retrait temporaire' && (
                <button
                  onClick={() => {
                    // Mise en Retrait temporaire = passe par la modale (raison + journal)
                    setRetraitCible({ reserviste: contextMenu.reserviste, mode: 'retrait' })
                    setContextMenu(null)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#d97706', textAlign: 'left' }}
                  onMouseOver={e => (e.currentTarget.style.backgroundColor = '#fffbeb')}
                  onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ fontSize: '14px' }}>⏸️</span> Retrait temporaire
                </button>
              )}
              {isSuperAdmin && (
              <>
              <div style={{ borderTop: '1px solid #f1f5f9', margin: '2px 0' }} />
              <button
                onClick={() => {
                  setSuppressionCible(contextMenu.reserviste)
                  setContextMenu(null)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#dc2626', textAlign: 'left' }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '14px' }}>🗑️</span> Supprimer le compte...
              </button>
              </>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal transfert de camp */}
      {transferCible && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setTransferCible(null)}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', minWidth: '380px', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: C }}>
              Changer de camp
            </h3>
            <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#374151', fontWeight: 600 }}>
              {transferCible.prenom} {transferCible.nom}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>
              Camp actuel : {transferCampActuel === null ? '...' : transferCampActuel}
            </p>
            {campsDisponibles.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>Chargement des camps...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {campsDisponibles.map(camp => (
                  <button
                    key={camp.session_id}
                    disabled={transferLoading}
                    onClick={async () => {
                      setTransferLoading(true)
                      try {
                        const res = await fetch('/api/admin/camp/transfer', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ benevole_ids: [transferCible.benevole_id], target_session_id: camp.session_id }),
                        })
                        const data = await res.json()
                        const r = data.results?.[0]
                        if (r?.ok) {
                          alert(`${r.message}`)
                          setTransferCible(null)
                        } else {
                          alert(`Erreur : ${r?.message || 'Erreur inconnue'}`)
                        }
                      } catch {
                        alert('Erreur réseau')
                      } finally {
                        setTransferLoading(false)
                      }
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                      padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '8px',
                      background: 'white', cursor: transferLoading ? 'wait' : 'pointer', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = '#f0f7ff' }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.backgroundColor = 'white' }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>⛺ {camp.nom}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{camp.dates} — {camp.site}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setTransferCible(null)}
              style={{ marginTop: '16px', padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}
            >
              Annuler
            </button>
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
          isAdmin={isAdmin}
          onClose={() => { setModalReserviste(null); fetchNotesNonLues() }}
        />
      )}

      {/* Modal suppression unitaire (loi 25: raison obligatoire + journal) */}
      {suppressionCible && (
        <ModalSuppressionReserviste
          prenom={suppressionCible.prenom}
          nom={suppressionCible.nom}
          benevole_id={suppressionCible.benevole_id}
          onClose={() => setSuppressionCible(null)}
          onDeleted={() => {
            setAllData(prev => prev.filter(x => x.benevole_id !== suppressionCible.benevole_id))
            setSuppressionCible(null)
          }}
        />
      )}

      {/* Modal retrait temporaire / réactivation (raison obligatoire + journal) */}
      {retraitCible && (
        <ModalRetraitTemporaire
          mode={retraitCible.mode}
          prenom={retraitCible.reserviste.prenom}
          nom={retraitCible.reserviste.nom}
          benevole_id={retraitCible.reserviste.benevole_id}
          groupeReactivation={retraitCible.groupeReactivation}
          onClose={() => setRetraitCible(null)}
          onConfirmed={(nouveauGroupe) => {
            setAllData(prev => prev.map(x => x.benevole_id === retraitCible.reserviste.benevole_id ? { ...x, groupe: nouveauGroupe } : x))
            // Invalider le cache du tooltip pour ce reserviste
            setRetraitsInfo(prev => {
              const next = { ...prev }
              delete next[retraitCible.reserviste.benevole_id]
              return next
            })
            setRetraitCible(null)
          }}
        />
      )}
    </div>
  )
}
