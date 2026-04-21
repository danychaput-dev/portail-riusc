'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ModalComposeCourriel from '@/app/components/ModalComposeCourriel'

type CourrielDest = { benevole_id: string; email: string; prenom: string; nom: string }

// ─── Types ────────────────────────────────────────────────────────────────────

interface Camp {
  session_id: string
  camp_nom: string
  camp_dates: string
  camp_lieu: string
  nb_total: number
  nb_confirme: number
  nb_absent: number
  nb_annule: number
  isPast: boolean
}

interface Inscription {
  id: string
  benevole_id: string
  prenom_nom: string
  presence: string
  statut_inscription: string
  courriel: string | null
  telephone: string | null
  camp_nom: string
  camp_dates: string
  camp_lieu: string
  sync_status: string
  monday_item_id: string | null
  created_at: string
  // from reservistes
  region: string | null
  groupe: string | null
  remboursement_bottes_date: string | null
  allergies_alimentaires: string | null
  allergies_autres: string | null
  conditions_medicales: string | null
  prenom: string | null
  nom: string | null
  presence_updated_at: string | null
  cahier_envoye: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRESENCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  confirme:  { label: "J'y serai",           color: '#065f46', bg: '#d1fae5' },
  absent:    { label: "Je n'y serai pas",     color: '#7f1d1d', bg: '#fee2e2' },
  incertain: { label: 'Incertain',            color: '#78350f', bg: '#fef3c7' },
  annule:    { label: 'Annulé',               color: '#374151', bg: '#f3f4f6' },
  Jy_etais:  { label: "J'y étais",            color: '#1e3a5f', bg: '#dbeafe' },
}

function presenceBadge(presence: string) {
  const p = PRESENCE_LABELS[presence] || { label: presence, color: '#374151', bg: '#f3f4f6' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      color: p.color,
      background: p.bg,
      whiteSpace: 'nowrap',
    }}>
      {p.label}
    </span>
  )
}

function isCampPast(campDates: string): boolean {
  if (!campDates) return false
  const now = new Date()
  const match = campDates.match(/(\d{1,2})[–-](\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (match) {
    const months: Record<string, number> = {
      janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
      juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11
    }
    const month = months[match[3].toLowerCase()]
    const year = parseInt(match[4])
    const endDay = parseInt(match[2])
    if (month !== undefined) {
      const endDate = new Date(year, month, endDay)
      return endDate < now
    }
  }
  return false
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InscriptionsCampsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [isAdmin, setIsAdmin] = useState(false)
  const [isPartenaireLect, setIsPartenaireChef] = useState(false)
  const [roleChecked, setRoleChecked] = useState(false)
  const [retourHref, setRetourHref] = useState('/')
  const [camps, setCamps] = useState<Camp[]>([])
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null)
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingInscrits, setLoadingInscrits] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPresence, setFilterPresence] = useState<string>('tous')

  // Responsive — sidebar cachable sur mobile
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
      else setSidebarOpen(true)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Sidebar réductible sur desktop (persistant dans localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem('inscriptions-camps-sidebar-collapsed')
    if (saved === 'true') setSidebarCollapsed(true)
  }, [])
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('inscriptions-camps-sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  // ── Détecter si admin (avec support impersonation) ─────────────────────────
  useEffect(() => {
    async function checkRole() {
      // Vérifier impersonation d'abord
      let role: string | null = null
      try {
        const impRes = await fetch('/api/check-impersonate', { credentials: 'include' })
        if (impRes.ok) {
          const impData = await impRes.json()
          if (impData.isImpersonating && impData.benevole_id) {
            const { data: res } = await supabase
              .from('reservistes')
              .select('role')
              .eq('benevole_id', impData.benevole_id)
              .single()
            role = res?.role || null
          }
        }
      } catch (_) {}

      // Sinon auth normale
      if (!role) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: res } = await supabase
          .from('reservistes')
          .select('role')
          .eq('user_id', user.id)
          .single()
        role = res?.role || null
      }

      if (['superadmin', 'admin', 'coordonnateur'].includes(role!)) {
        setIsAdmin(true)
        setRetourHref('/admin')
      } else if (role === 'partenaire') {
        // Partenaire: lecture complete incluant noms, courriels, telephones et export
        // Excel. Pas d'acces aux actions d'edition (cahier, presence, suppression).
        setIsPartenaireChef(false)
        setRetourHref('/partenaire')
      } else if (role === 'partenaire_lect') {
        // Loi 25: partenaire_lect voit uniquement les donnees non-nominales
        // (compteurs, presence, district, dates). Aucun nom, courriel, telephone,
        // allergie, condition medicale.
        setIsPartenaireChef(true)
        setRetourHref('/partenaire')
      } else {
        // Reservistes et autres roles: pas d'acces a cette page.
        router.replace('/')
        return
      }
      setRoleChecked(true)
    }
    checkRole()
  }, [router])

  // ── Charger tous les camps (apres verification du role) ───────────────────
  useEffect(() => {
    if (!roleChecked) return
    async function loadCamps() {
      setLoading(true)
      const { data, error } = await supabase
        .from('inscriptions_camps')
        .select('session_id, camp_nom, camp_dates, camp_lieu, presence')
        .range(0, 4999)

      if (error) { console.error(error); setLoading(false); return }

      // Grouper par session_id
      const map = new Map<string, {
        session_id: string
        camp_nom: string
        camp_dates: string
        camp_lieu: string
        presences: string[]
      }>()

      for (const row of (data || [])) {
        if (!map.has(row.session_id)) {
          map.set(row.session_id, {
            session_id: row.session_id,
            camp_nom: row.camp_nom || '',
            camp_dates: row.camp_dates || '',
            camp_lieu: row.camp_lieu || '',
            presences: [],
          })
        }
        map.get(row.session_id)!.presences.push(row.presence)
      }

      const campList: Camp[] = Array.from(map.values()).map(c => ({
        session_id: c.session_id,
        camp_nom: c.camp_nom,
        camp_dates: c.camp_dates,
        camp_lieu: c.camp_lieu,
        nb_total:    c.presences.length,
        nb_confirme: c.presences.filter(p => p === 'confirme').length,
        nb_absent:   c.presences.filter(p => p === 'absent').length,
        nb_annule:   c.presences.filter(p => p === 'annule').length,
        isPast: isCampPast(c.camp_dates),
      }))

      // Extraire le numéro de cohorte pour tri numérique
      const getCohortNum = (campNom: string): number => {
        const m = campNom.match(/Cohorte\s+(\d+)/i)
        return m ? parseInt(m[1]) : 999
      }

      // À venir : ascendant (prochain camp en premier — 9, 10, 11...)
      // Passés  : descendant (plus récent en premier — 8, 7, 6...)
      campList.sort((a, b) => {
        if (a.isPast !== b.isPast) return a.isPast ? 1 : -1
        if (!a.isPast) return getCohortNum(a.camp_nom) - getCohortNum(b.camp_nom)
        return getCohortNum(b.camp_nom) - getCohortNum(a.camp_nom)
      })

      setCamps(campList)
      if (campList.length > 0) setSelectedCampId(campList[0].session_id)
      setLoading(false)
    }
    loadCamps()
  }, [roleChecked])

  // ── Charger les inscrits du camp sélectionné ───────────────────────────────
  useEffect(() => {
    if (!selectedCampId || !roleChecked) return
    async function loadInscrits() {
      setLoadingInscrits(true)
      setSearch('')
      setFilterPresence('tous')
      setSelectedIds(new Set())

      // Étape 1 — inscriptions du camp (Loi 25: partenaire_lect ne voit pas les infos nominales)
      const selectBase = 'id, benevole_id, presence, camp_nom, camp_dates, camp_lieu, created_at, presence_updated_at'
      const selectInscriptions = isPartenaireLect
        ? selectBase + ', sync_status'
        : selectBase + ', prenom_nom, courriel, telephone, sync_status, monday_item_id, cahier_envoye'

      const { data, error } = await supabase
        .from('inscriptions_camps')
        .select(selectInscriptions)
        .eq('session_id', selectedCampId!)
        .order(isPartenaireLect ? 'created_at' : 'prenom_nom')

      if (error) { console.error(error); setLoadingInscrits(false); return }
      if (!data || data.length === 0) { setInscriptions([]); setLoadingInscrits(false); return }

      // Étape 2 — données complémentaires des réservistes (que non-sensibles pour partenaire_lect)
      const benevoleIds = data.map((r: any) => r.benevole_id).filter(Boolean)
      const selectReservistes = isPartenaireLect
        ? 'benevole_id, region, groupe'
        : 'benevole_id, prenom, nom, region, groupe, remboursement_bottes_date, allergies_alimentaires, allergies_autres, conditions_medicales'
      const { data: resData } = await supabase
        .from('reservistes')
        .select(selectReservistes)
        .in('benevole_id', benevoleIds)

      const resMap = new Map((resData || []).map((r: any) => [r.benevole_id, r]))

      const flat: Inscription[] = data.map((row: any) => {
        const res = resMap.get(row.benevole_id)
        return {
          id: row.id,
          benevole_id: row.benevole_id,
          prenom_nom: row.prenom_nom,
          presence: row.presence,
          statut_inscription: 'Inscrit',
          courriel: row.courriel,
          telephone: row.telephone,
          camp_nom: row.camp_nom,
          camp_dates: row.camp_dates,
          camp_lieu: row.camp_lieu,
          sync_status: row.sync_status,
          monday_item_id: row.monday_item_id,
          created_at: row.created_at,
          presence_updated_at: row.presence_updated_at ?? null,
          cahier_envoye: row.cahier_envoye ?? false,
          region: res?.region ?? null,
          groupe: res?.groupe ?? null,
          remboursement_bottes_date: res?.remboursement_bottes_date ?? null,
          allergies_alimentaires: res?.allergies_alimentaires ?? null,
          allergies_autres: res?.allergies_autres ?? null,
          conditions_medicales: res?.conditions_medicales ?? null,
          prenom: res?.prenom ?? null,
          nom: res?.nom ?? null,
        }
      })

      setInscriptions(flat)
      setLoadingInscrits(false)
    }
    loadInscrits()
  }, [selectedCampId, isPartenaireLect, roleChecked])

  // ── Charger les rappels SMS du camp sélectionné (pour afficher le statut
  //    de réponse par inscrit) ──
  // Map indexé par inscription_id, on garde le rappel le plus récent par inscrit.
  const [rappels, setRappels] = useState<Map<string, {
    envoye_at: string | null
    reponse: string | null
    reponse_confirmee: boolean | null
    reponse_at: string | null
  }>>(new Map())
  const refetchRappels = async () => {
    if (!selectedCampId) { setRappels(new Map()); return }
    console.log('[refetchRappels] Fetch rappels pour session_id =', selectedCampId)
    try {
      const { data, error } = await supabase
        .from('rappels_camps')
        .select('inscription_id, envoye_at, reponse, reponse_confirmee, reponse_at')
        .eq('session_id', selectedCampId)
        .order('envoye_at', { ascending: false })
      console.log('[refetchRappels] Supabase a retourné:', { data, error, nbRows: data?.length ?? 0 })
      if (error) {
        console.error('[refetchRappels] ERREUR Supabase:', error.message, error)
      }
      if (!data) { setRappels(new Map()); return }
      // Garder le plus récent par inscription
      const m = new Map<string, any>()
      for (const r of data as any[]) {
        if (!m.has(r.inscription_id)) m.set(r.inscription_id, r)
      }
      console.log('[refetchRappels] Map construite avec', m.size, 'entrées uniques')
      setRappels(m)
    } catch (e) {
      console.error('[refetchRappels] EXCEPTION:', e)
      setRappels(new Map())
    }
  }
  useEffect(() => { refetchRappels() }, [selectedCampId, roleChecked])

  // ── Filtres ─────────────────────────────────────────────────────────────────
  // Filtre sur le statut du rappel SMS (pour repérer ceux à relancer)
  //   null/'tous'         : pas de filtre
  //   'sans_rappel'       : pas de rappel envoyé (aucune entrée rappels_camps)
  //   'envoye_pas_repondu': rappel envoyé mais pas encore de réponse
  //   'a_repondu'         : a répondu OUI/NON
  const [filterRappel, setFilterRappel] = useState<'tous' | 'sans_rappel' | 'envoye_pas_repondu' | 'a_repondu'>('tous')

  const filtered = useMemo(() => {
    return inscriptions.filter(i => {
      const matchSearch = !search
        || (i.prenom_nom || '').toLowerCase().includes(search.toLowerCase())
        || (i.courriel || '').toLowerCase().includes(search.toLowerCase())
        || (i.region || '').toLowerCase().includes(search.toLowerCase())
      const matchPresence = filterPresence === 'tous' || i.presence === filterPresence
      const r = rappels.get(i.id)
      const matchRappel =
        filterRappel === 'tous' ? true
        : filterRappel === 'sans_rappel' ? !r
        : filterRappel === 'envoye_pas_repondu' ? (r && !r.reponse)
        : filterRappel === 'a_repondu' ? (r && r.reponse)
        : true
      return matchSearch && matchPresence && matchRappel
    })
  }, [inscriptions, search, filterPresence, filterRappel, rappels])

  const selectedCamp = camps.find(c => c.session_id === selectedCampId)
  const upcomingCamps = camps.filter(c => !c.isPast)
  const pastCamps = camps.filter(c => c.isPast)

  // ── Multi-sélection (admin only) ─────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [emailDest, setEmailDest] = useState<CourrielDest[] | null>(null)

  function openEmailComposer() {
    if (selectedIds.size === 0) return
    const dests: CourrielDest[] = inscriptions
      .filter(i => selectedIds.has(i.id) && (i.courriel || '').includes('@'))
      .map(i => {
        // Prefer prenom/nom (from reservistes), fallback to split prenom_nom
        let prenom = i.prenom || ''
        let nom = i.nom || ''
        if (!prenom && !nom && i.prenom_nom) {
          const parts = i.prenom_nom.trim().split(/\s+/)
          prenom = parts[0] || ''
          nom = parts.slice(1).join(' ')
        }
        return { benevole_id: i.benevole_id, email: i.courriel as string, prenom, nom }
      })
    if (dests.length === 0) {
      alert('Aucun courriel valide dans la sélection.')
      return
    }
    const ignored = selectedIds.size - dests.length
    if (ignored > 0) {
      if (!confirm(`${ignored} participant(s) sans courriel seront ignorés. Continuer avec ${dests.length} destinataire(s) ?`)) return
    }
    setEmailDest(dests)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)))
    }
  }

  async function bulkUpdatePresence(newPresence: 'confirme' | 'absent' | 'incertain' | 'annule') {
    if (selectedIds.size === 0) return
    const label = PRESENCE_LABELS[newPresence]?.label || newPresence
    if (!confirm(`Changer la présence de ${selectedIds.size} participant(s) à « ${label} » ?`)) return

    setBulkUpdating(true)
    const now = new Date().toISOString()

    // Get admin name for logs
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminRes } = await supabase
      .from('reservistes')
      .select('prenom, nom')
      .eq('user_id', user?.id || '')
      .single()
    const modifiePar = adminRes ? `${adminRes.prenom} ${adminRes.nom}` : 'Admin'

    const ids = Array.from(selectedIds)
    // Batch update (avec .select() pour detecter les blocages RLS silencieux)
    const { data: updated, error } = await supabase
      .from('inscriptions_camps')
      .update({ presence: newPresence, presence_updated_at: now })
      .in('id', ids)
      .select('id')

    if (error) {
      console.error('Erreur bulk update:', error)
      alert('Erreur lors de la mise à jour groupée.')
      setBulkUpdating(false)
      return
    }

    if (!updated || updated.length !== ids.length) {
      console.error('Bulk update RLS issue:', { demandes: ids.length, modifies: updated?.length ?? 0 })
      alert(`Mise à jour bloquée par RLS : ${updated?.length ?? 0}/${ids.length} lignes modifiées. Vérifiez les policies sur inscriptions_camps.`)
      setBulkUpdating(false)
      return
    }

    // Log each change
    const logs = ids.map(id => {
      const ins = inscriptions.find(i => i.id === id)
      return {
        inscription_id: id,
        benevole_id: ins?.benevole_id || '',
        session_id: selectedCampId,
        prenom_nom: ins?.prenom_nom || '',
        presence_avant: ins?.presence || '',
        presence_apres: newPresence,
        modifie_par: modifiePar,
      }
    }).filter(l => l.benevole_id)

    if (logs.length > 0) {
      await supabase.from('inscriptions_camps_logs').insert(logs)
    }

    // Update local state
    setInscriptions(prev =>
      prev.map(i => selectedIds.has(i.id)
        ? { ...i, presence: newPresence, presence_updated_at: now }
        : i
      )
    )
    setSelectedIds(new Set())
    setBulkUpdating(false)
  }

  async function toggleCahier(inscriptionId: string, current: boolean) {
    const newVal = !current
    const { error } = await supabase
      .from('inscriptions_camps')
      .update({ cahier_envoye: newVal })
      .eq('id', inscriptionId)

    if (error) {
      console.error('Erreur cahier:', error)
      return
    }

    setInscriptions(prev =>
      prev.map(i => i.id === inscriptionId ? { ...i, cahier_envoye: newVal } : i)
    )
  }

  async function bulkToggleCahier(value: boolean) {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('inscriptions_camps')
      .update({ cahier_envoye: value })
      .in('id', ids)

    if (error) {
      console.error('Erreur bulk cahier:', error)
      return
    }

    setInscriptions(prev =>
      prev.map(i => selectedIds.has(i.id) ? { ...i, cahier_envoye: value } : i)
    )
  }

  // Transfert de camp
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [campsDisponibles, setCampsDisponibles] = useState<Array<{ session_id: string; nom: string; dates: string; site: string; location: string }>>([])
  const [transferLoading, setTransferLoading] = useState(false)

  async function openTransferModal() {
    if (selectedIds.size === 0) return
    setShowTransferModal(true)
    try {
      const res = await fetch('/api/admin/camp/transfer')
      if (res.ok) {
        const { camps: c } = await res.json()
        setCampsDisponibles(c)
      }
    } catch { /* ignore */ }
  }

  async function doTransfer(targetSessionId: string) {
    const benevoleIds = Array.from(selectedIds).map(id => {
      const ins = inscriptions.find(i => i.id === id)
      return ins?.benevole_id
    }).filter(Boolean) as string[]

    if (benevoleIds.length === 0) return
    setTransferLoading(true)
    try {
      const res = await fetch('/api/admin/camp/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_ids: benevoleIds, target_session_id: targetSessionId }),
      })
      const data = await res.json()
      const ok = data.results?.filter((r: any) => r.ok).length || 0
      const fail = data.results?.filter((r: any) => !r.ok) || []
      let msg = `${ok} participant(s) transféré(s).`
      if (fail.length > 0) msg += `\n${fail.map((f: any) => f.message).join('\n')}`
      alert(msg)
      setShowTransferModal(false)
      setSelectedIds(new Set())
      // Retirer les transférés de la liste locale
      const transferredBids = new Set(benevoleIds)
      setInscriptions(prev => prev.filter(i => !transferredBids.has(i.benevole_id)))
    } catch {
      alert('Erreur réseau')
    } finally {
      setTransferLoading(false)
    }
  }

  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [showSmsModal, setShowSmsModal] = useState(false)
  const [smsMessage, setSmsMessage] = useState('')
  const [sendingSms, setSendingSms] = useState(false)
  const [smsResult, setSmsResult] = useState<{ nb_envoyes: number; nb_sans_telephone: number } | null>(null)

  // ── Mettre à jour la présence ───────────────────────────────────────────────
  async function updatePresence(inscriptionId: string, newPresence: 'confirme' | 'absent' | 'incertain' | 'annule') {
    setUpdatingId(inscriptionId)
    const inscription = inscriptions.find(i => i.id === inscriptionId)
    if (!inscription) { setUpdatingId(null); return }

    const now = new Date().toISOString()

    // Mise à jour de la présence + date de modification
    const { data: updated, error } = await supabase
      .from('inscriptions_camps')
      .update({ presence: newPresence, presence_updated_at: now })
      .eq('id', inscriptionId)
      .select('id')

    if (error) {
      console.error('Erreur mise à jour présence:', error)
      alert('Erreur lors de la mise à jour.')
      setUpdatingId(null)
      return
    }

    if (!updated || updated.length === 0) {
      console.error('Update RLS bloque:', inscriptionId)
      alert('Mise à jour bloquée par RLS. Vérifiez les policies sur inscriptions_camps.')
      setUpdatingId(null)
      return
    }

    // Log du changement
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminRes } = await supabase
      .from('reservistes')
      .select('prenom, nom')
      .eq('user_id', user?.id || '')
      .single()
    const modifiePar = adminRes ? `${adminRes.prenom} ${adminRes.nom}` : 'Admin'

    await supabase.from('inscriptions_camps_logs').insert({
      inscription_id: inscriptionId,
      benevole_id: inscription.benevole_id,
      session_id: selectedCampId,
      prenom_nom: inscription.prenom_nom,
      presence_avant: inscription.presence,
      presence_apres: newPresence,
      modifie_par: modifiePar,
    })

    setInscriptions(prev =>
      prev.map(i => i.id === inscriptionId
        ? { ...i, presence: newPresence, presence_updated_at: now }
        : i
      )
    )
    setUpdatingId(null)
  }
  function ouvrirSmsModal() {
    if (!selectedCamp) return
    setSmsMessage(`RIUSC - {prenom}, rappel: {camp}, {dates} à {lieu}. Présent? Répondez OUI ou NON`)
    setSmsResult(null)
    setShowSmsModal(true)
  }

  async function envoyerRappelSms() {
    if (!selectedCampId || !smsMessage) return
    setSendingSms(true)
    try {
      const res = await fetch('/api/camp/rappel-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: selectedCampId, message: smsMessage }),
      })
      const json = await res.json()
      if (res.ok) {
        setSmsResult({ nb_envoyes: json.nb_envoyes, nb_sans_telephone: json.nb_sans_telephone })
        // Rafraîchir la colonne "Rappel SMS" pour voir les envois immédiatement
        refetchRappels()
      } else {
        alert(json.error || 'Erreur lors de l\'envoi')
      }
    } catch (e) {
      console.error('Erreur envoi SMS:', e)
      alert('Erreur de connexion')
    }
    setSendingSms(false)
  }

  async function exportExcel() {
    try {
      const XLSX = await import('xlsx')
      const rows = filtered.map(i => {
        const digits = (i.telephone || '').replace(/\D/g, '')
        const tel = digits.length === 11 && digits[0] === '1'
          ? `1 ${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`
          : digits.length === 10
          ? `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
          : (i.telephone || '')
        return {
          'Nom complet': i.prenom_nom,
          'Prénom': i.prenom || '',
          'Nom': i.nom || '',
          'Courriel': i.courriel || '',
          'Allergie alimentaire': i.allergies_alimentaires || '',
          'Allergie autre': i.allergies_autres || '',
          'Condition médicale': i.conditions_medicales || '',
        }
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 30 },
        { wch: 24 }, { wch: 20 }, { wch: 24 },
      ]
      const wb = XLSX.utils.book_new()
      const sheetName = (selectedCamp?.camp_nom || 'Camp')
        .replace(' - Camp de qualification', '').trim().slice(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      // Génération Blob — fiable dans tous les contextes browser
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sheetName.replace(/ /g, '_')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export Excel erreur:', err)
      alert('Erreur lors de l\'export. Voir la console pour les détails.')
    }
  }

  return (
    <div style={{ width: '100%', padding: '0' }}>
      <div style={{ display: 'flex', height: '100%', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>

      {/* ── Bouton toggle sidebar sur mobile ── */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'fixed', bottom: 20, left: 20, zIndex: 50,
            width: 48, height: 48, borderRadius: '50%',
            backgroundColor: '#1e3a5f', color: 'white', border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            cursor: 'pointer', fontSize: 20, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
          title="Choisir un camp"
        >
          ☰
        </button>
      )}

      {/* ── Colonne gauche : liste des camps ─────────────────────────────── */}
      {(sidebarOpen || !isMobile) && (
      <>
      {/* Overlay sur mobile */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 40 }}
        />
      )}
      <aside style={{
        width: !isMobile && sidebarCollapsed ? 48 : 220,
        minWidth: !isMobile && sidebarCollapsed ? 48 : 220,
        background: '#fff',
        borderRight: '1px solid #e5e7eb',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        ...(isMobile ? { position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 45, boxShadow: '4px 0 16px rgba(0,0,0,0.15)' } : {}),
      }}>
        {/* Bouton réduire/ouvrir (desktop uniquement) */}
        {!isMobile && (
          <div style={{ padding: '10px 8px', display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-end' }}>
            <button
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: '4px 8px', borderRadius: 6 }}
              onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
              onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {sidebarCollapsed ? '☰' : '◀'}
            </button>
          </div>
        )}
        {!(!isMobile && sidebarCollapsed) && (
        <div style={{ padding: '6px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          {isMobile ? (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: '0 0 10px 0', fontWeight: 500 }}
            >
              ← Fermer
            </button>
          ) : (
            <button
              onClick={() => router.push(retourHref)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: '0 0 10px 0', fontWeight: 500 }}
            >
              ← Retour
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>Camps</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
            {upcomingCamps.length} à venir · {pastCamps.length} passés
          </p>
        </div>
        )}

        {!(!isMobile && sidebarCollapsed) && (loading ? (
          <div style={{ padding: 20, color: '#9ca3af', fontSize: 13 }}>Chargement...</div>
        ) : (
          <>
            {upcomingCamps.length > 0 && (
              <div>
                <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  À venir
                </div>
                {upcomingCamps.map(c => <CampItem key={c.session_id} camp={c} selected={c.session_id === selectedCampId} onClick={() => { setSelectedCampId(c.session_id); if (isMobile) setSidebarOpen(false) }} />)}
              </div>
            )}
            {pastCamps.length > 0 && (
              <div>
                <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8 }}>
                  Passés
                </div>
                {pastCamps.map(c => <CampItem key={c.session_id} camp={c} selected={c.session_id === selectedCampId} onClick={() => { setSelectedCampId(c.session_id); if (isMobile) setSidebarOpen(false) }} />)}
              </div>
            )}
          </>
        ))}
      </aside>
      </>
      )}

      {/* ── Zone principale ───────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* En-tête du camp */}
        {selectedCamp && (
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e3a5f' }}>{selectedCamp.camp_nom}</h1>
                <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>📅 {selectedCamp.camp_dates}</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>📍 {selectedCamp.camp_lieu}</span>
                </div>
              </div>
              {/* Badges résumé — cliquables comme filtres */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge label="Total" value={selectedCamp.nb_total} color="#1e3a5f" bg="#dbeafe"
                  active={filterPresence === 'tous'}
                  onClick={() => setFilterPresence('tous')} />
                <Badge label="Confirmés" value={selectedCamp.nb_confirme} color="#065f46" bg="#d1fae5"
                  active={filterPresence === 'confirme'}
                  onClick={() => setFilterPresence(filterPresence === 'confirme' ? 'tous' : 'confirme')} />
                <Badge label="Absents" value={selectedCamp.nb_absent} color="#7f1d1d" bg="#fee2e2"
                  active={filterPresence === 'absent'}
                  onClick={() => setFilterPresence(filterPresence === 'absent' ? 'tous' : 'absent')} />
                {selectedCamp.nb_annule > 0 && <Badge label="Annulés" value={selectedCamp.nb_annule} color="#374151" bg="#f3f4f6"
                  active={filterPresence === 'annule'}
                  onClick={() => setFilterPresence(filterPresence === 'annule' ? 'tous' : 'annule')} />}
              </div>
            </div>

            {/* Filtres */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Rechercher un participant..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                  fontSize: 13, width: 240, outline: 'none', color: '#111827',
                }}
              />
              <select
                value={filterPresence}
                onChange={e => setFilterPresence(e.target.value)}
                style={{
                  padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db',
                  fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer',
                }}
              >
                <option value="tous">Toutes les présences</option>
                <option value="confirme">J&apos;y serai</option>
                <option value="absent">Je n&apos;y serai pas</option>
                <option value="incertain">Incertain</option>
                <option value="annule">Annulé</option>
                <option value="Jy_etais">J&apos;y étais</option>
              </select>
              {isAdmin && (
                <select
                  value={filterRappel}
                  onChange={e => setFilterRappel(e.target.value as any)}
                  title="Filtrer selon le statut de réponse au rappel SMS"
                  style={{
                    padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db',
                    fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer',
                  }}
                >
                  <option value="tous">📱 Tous — rappel SMS</option>
                  <option value="sans_rappel">📵 Sans rappel envoyé</option>
                  <option value="envoye_pas_repondu">⏳ Envoyé, pas de réponse</option>
                  <option value="a_repondu">✅ A répondu</option>
                </select>
              )}
              {(search || filterPresence !== 'tous' || filterRappel !== 'tous') && (
                <button
                  onClick={() => { setSearch(''); setFilterPresence('tous'); setFilterRappel('tous') }}
                  style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', cursor: 'pointer', color: '#6b7280' }}
                >
                  Effacer filtres
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>
                {filtered.length} participant{filtered.length !== 1 ? 's' : ''}
              </span>
              {isAdmin && rappels.size > 0 && (
                <button
                  onClick={refetchRappels}
                  title="Rafraîchir les réponses SMS"
                  style={{
                    padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
                    fontSize: 13, background: 'white', color: '#6b7280', cursor: 'pointer',
                    fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  🔄 Réponses
                </button>
              )}
              {isAdmin && !selectedCamp?.isPast && (
                <button
                  onClick={ouvrirSmsModal}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: '1px solid #0d9488',
                    fontSize: 13, background: '#0d9488', color: '#fff', cursor: 'pointer',
                    fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  📱 Envoyer rappel SMS
                </button>
              )}
              {!isPartenaireLect && (
                <button
                  onClick={exportExcel}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: '1px solid #1e3a5f',
                    fontSize: 13, background: '#1e3a5f', color: '#fff', cursor: 'pointer',
                    fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  ↓ Exporter Excel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Barre d'actions groupées */}
        {isAdmin && selectedIds.size > 0 && (
          <div style={{
            padding: '10px 24px',
            background: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 600, color: '#1e3a5f' }}>
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </span>
            <span style={{ color: '#94a3b8' }}>|</span>
            <span style={{ color: '#374151', fontWeight: 500 }}>Présence :</span>
            {Object.entries(PRESENCE_LABELS).map(([key, val]) => (
              <button
                key={key}
                disabled={bulkUpdating}
                onClick={() => bulkUpdatePresence(key as 'confirme' | 'absent' | 'incertain' | 'annule')}
                style={{
                  padding: '4px 12px', borderRadius: 16, border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: bulkUpdating ? 'wait' : 'pointer',
                  color: val.color, background: val.bg,
                  opacity: bulkUpdating ? 0.6 : 1,
                }}
              >
                {val.label}
              </button>
            ))}
            <span style={{ color: '#94a3b8' }}>|</span>
            <button
              onClick={() => bulkToggleCahier(true)}
              disabled={bulkUpdating}
              style={{
                padding: '4px 12px', borderRadius: 16, border: '1px solid #d1d5db',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                color: '#065f46', background: '#d1fae5',
              }}
            >
              ✓ Cahier envoyé
            </button>
            <button
              onClick={() => bulkToggleCahier(false)}
              disabled={bulkUpdating}
              style={{
                padding: '4px 12px', borderRadius: 16, border: '1px solid #d1d5db',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                color: '#6b7280', background: '#f3f4f6',
              }}
            >
              ✗ Cahier non envoyé
            </button>
            <span style={{ color: '#94a3b8' }}>|</span>
            <button
              onClick={openEmailComposer}
              disabled={bulkUpdating}
              title={selectedIds.size === 1 ? 'Envoyer un courriel individuel' : `Envoyer une campagne à ${selectedIds.size} destinataires`}
              style={{
                padding: '4px 12px', borderRadius: 16, border: '1px solid #bfdbfe',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                color: '#1e3a5f', background: '#dbeafe',
              }}
            >
              ✉️ {selectedIds.size > 1 ? `Envoyer courriel (${selectedIds.size})` : 'Envoyer courriel'}
            </button>
            <span style={{ color: '#94a3b8' }}>|</span>
            <button
              onClick={openTransferModal}
              disabled={bulkUpdating}
              style={{
                padding: '4px 12px', borderRadius: 16, border: '1px solid #7c3aed',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                color: '#7c3aed', background: '#ede9fe',
              }}
            >
              ⛺ Changer de camp
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                marginLeft: 'auto', padding: '4px 12px', borderRadius: 16,
                border: '1px solid #d1d5db', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', color: '#6b7280', background: '#fff',
              }}
            >
              Désélectionner
            </button>
          </div>
        )}

        {/* Tableau */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 0 16px' }}>
          {loadingInscrits ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Chargement des participants...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Aucun participant trouvé</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb', position: 'sticky', top: 0, zIndex: 1 }}>
                  {isAdmin && (
                    <th style={{ padding: '8px 6px', borderBottom: '1px solid #e5e7eb', width: 32, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer', accentColor: '#1e3a5f' }}
                        title="Tout sélectionner"
                      />
                    </th>
                  )}
                  {[...(isPartenaireLect ? [] : ['Nom']), 'Présence', ...(isAdmin ? ['Rappel SMS'] : []), ...(isAdmin ? ['Cahier'] : []), 'Inscrit le', ...(isPartenaireLect ? [] : ['Courriel']), 'District', ...(isPartenaireLect ? [] : ['Bottes', 'All. alimentaire', 'All. autre', 'Condition méd.']), ...(isAdmin ? [''] : [])].map((h, i) => (
                    <th key={i} style={{
                      padding: '8px 10px', textAlign: h === 'Cahier' || h === 'Rappel SMS' ? 'center' : 'left', fontSize: 10,
                      fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                      letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ins, idx) => (
                  <tr
                    key={ins.id}
                    style={{
                      background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    {isAdmin && (
                      <td style={{ padding: '8px 6px', textAlign: 'center', width: 32 }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ins.id)}
                          onChange={() => toggleSelect(ins.id)}
                          style={{ cursor: 'pointer', accentColor: '#1e3a5f' }}
                        />
                      </td>
                    )}
                    {!isPartenaireLect && (() => {
                      // Signaler visuellement les inscrits sans téléphone (confirme/incertain)
                      // → ils ne recevront pas le rappel SMS. Rouge + tooltip.
                      const eligibleSms = ['confirme', 'incertain'].includes(ins.presence)
                      const phoneManquant = eligibleSms && !ins.telephone?.trim()
                      return (
                        <td
                          style={{
                            padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap',
                            color: phoneManquant ? '#dc2626' : '#111827',
                          }}
                          title={phoneManquant ? '⚠️ Téléphone manquant — ne recevra pas le rappel SMS' : undefined}
                        >
                          {phoneManquant && <span style={{ marginRight: 4 }}>⚠️</span>}
                          {ins.prenom_nom}
                        </td>
                      )
                    })()}
                    <td style={{ padding: '8px 10px' }}>
                      {isAdmin ? (
                        <div>
                          <select
                            value={ins.presence}
                            disabled={updatingId === ins.id}
                            onChange={e => updatePresence(ins.id, e.target.value as 'confirme' | 'absent' | 'incertain' | 'annule')}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 20,
                              border: 'none',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: updatingId === ins.id ? 'wait' : 'pointer',
                              color: PRESENCE_LABELS[ins.presence]?.color || '#374151',
                              background: PRESENCE_LABELS[ins.presence]?.bg || '#f3f4f6',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              paddingRight: 20,
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 6px center',
                            }}
                          >
                            <option value="confirme">J&apos;y serai</option>
                            <option value="absent">Je n&apos;y serai pas</option>
                            <option value="incertain">Incertain</option>
                            <option value="annule">Annulé</option>
                            <option value="Jy_etais">J&apos;y étais</option>
                          </select>
                          {ins.presence_updated_at && (
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                              Modifié {new Date(ins.presence_updated_at).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      ) : presenceBadge(ins.presence)}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const r = rappels.get(ins.id)
                          if (!r) {
                            return <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
                          }
                          const envoye = r.envoye_at ? new Date(r.envoye_at) : null
                          const reponse = r.reponse_at ? new Date(r.reponse_at) : null
                          const fmt = (d: Date) => d.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          // Interprétation
                          if (r.reponse_confirmee === true) {
                            return (
                              <div title={`Répondu OUI ("${r.reponse}") le ${reponse ? fmt(reponse) : '—'}`}>
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, backgroundColor: '#dcfce7', color: '#065f46', fontWeight: 700 }}>✅ OUI</span>
                                {reponse && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{fmt(reponse)}</div>}
                              </div>
                            )
                          }
                          if (r.reponse_confirmee === false) {
                            return (
                              <div title={`Répondu NON ("${r.reponse}") le ${reponse ? fmt(reponse) : '—'}`}>
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>❌ NON</span>
                                {reponse && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{fmt(reponse)}</div>}
                              </div>
                            )
                          }
                          if (r.reponse) {
                            // Réponse non-standard, demande lecture humaine
                            return (
                              <div title={`Texte reçu : « ${r.reponse} »\nEnvoyé le ${envoye ? fmt(envoye) : '—'}`}>
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700 }}>❓ Autre</span>
                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  &quot;{r.reponse}&quot;
                                </div>
                              </div>
                            )
                          }
                          // Envoyé mais pas de réponse
                          return (
                            <div title={`SMS envoyé le ${envoye ? fmt(envoye) : '—'}\nPas encore de réponse.`}>
                              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, backgroundColor: '#e0f2fe', color: '#075985', fontWeight: 700 }}>📤 Envoyé</span>
                              {envoye && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{fmt(envoye)}</div>}
                            </div>
                          )
                        })()}
                      </td>
                    )}
                    {isAdmin && (
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={ins.cahier_envoye}
                          onChange={() => toggleCahier(ins.id, ins.cahier_envoye)}
                          style={{ cursor: 'pointer', accentColor: '#1e3a5f', width: 15, height: 15 }}
                          title={ins.cahier_envoye ? 'Cahier envoyé' : 'Cahier non envoyé'}
                        />
                      </td>
                    )}
                    <td style={{ padding: '8px 10px', color: '#6b7280', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {ins.created_at
                        ? new Date(ins.created_at).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    {!isPartenaireLect && (
                      <td style={{ padding: '8px 10px', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ins.courriel ? (
                          <a href={`mailto:${ins.courriel}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{ins.courriel}</a>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                    )}
                    <td style={{ padding: '8px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {ins.region || <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    {!isPartenaireLect && (
                      <>
                        <td style={{ padding: '8px 10px', color: '#6b7280', textAlign: 'center' }}>
                          {ins.remboursement_bottes_date
                            ? <span style={{ color: '#065f46', fontWeight: 600 }}>✓</span>
                            : <span style={{ color: '#d1d5db' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '8px 10px', color: ins.allergies_alimentaires && ins.allergies_alimentaires !== 'Aucun' ? '#92400e' : '#d1d5db', fontSize: 12 }}>
                          {ins.allergies_alimentaires && ins.allergies_alimentaires !== 'Aucun' ? ins.allergies_alimentaires : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: ins.allergies_autres && ins.allergies_autres !== 'Aucun' ? '#92400e' : '#d1d5db', fontSize: 12 }}>
                          {ins.allergies_autres && ins.allergies_autres !== 'Aucun' ? ins.allergies_autres : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: ins.conditions_medicales && ins.conditions_medicales !== 'Aucun' ? '#7f1d1d' : '#d1d5db', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ins.conditions_medicales && ins.conditions_medicales !== 'Aucun'
                            ? <span title={ins.conditions_medicales}>{ins.conditions_medicales}</span>
                            : '—'}
                        </td>
                      </>
                    )}
                    {isAdmin && (
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button
                          onClick={() => router.push(`/admin/reservistes?benevole_id=${ins.benevole_id}`)}
                          title="Voir le profil"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#6b7280', fontSize: 16, padding: '2px 6px',
                            borderRadius: 4, transition: 'color 0.15s',
                          }}
                          onMouseOver={e => (e.currentTarget.style.color = '#1e3a5f')}
                          onMouseOut={e => (e.currentTarget.style.color = '#6b7280')}
                        >
                          →
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── Modal Transfert de camp ──────────────────────────────────── */}
      {showTransferModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => !transferLoading && setShowTransferModal(false)}
        >
          <div
            style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, minWidth: 380, maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>
              Transférer vers un autre camp
            </h3>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#374151', fontWeight: 600 }}>
              {selectedIds.size} participant{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>
              Camp actuel : {selectedCamp?.camp_nom || '—'}
            </p>
            {campsDisponibles.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>Chargement des camps...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {campsDisponibles.filter(c => c.session_id !== selectedCampId).map(camp => (
                  <button
                    key={camp.session_id}
                    disabled={transferLoading}
                    onClick={() => {
                      if (confirm(`Transférer ${selectedIds.size} participant(s) vers ${camp.nom} ?`)) {
                        doTransfer(camp.session_id)
                      }
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                      padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 8,
                      background: 'white', cursor: transferLoading ? 'wait' : 'pointer', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.backgroundColor = '#f5f3ff' }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.backgroundColor = 'white' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>⛺ {camp.nom}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{camp.dates} - {camp.site}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowTransferModal(false)}
              disabled={transferLoading}
              style={{ marginTop: 16, padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 13, color: '#64748b' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── Modal SMS ─────────────────────────────────────────────────── */}
      {showSmsModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget && !sendingSms) setShowSmsModal(false) }}
        >
          <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 28, width: 520, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>
              📱 Envoyer un rappel SMS
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              {selectedCamp?.camp_nom} — {selectedCamp?.camp_dates}
            </p>

            {smsResult ? (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#065f46', marginBottom: 8 }}>
                  {smsResult.nb_envoyes} SMS envoyé{smsResult.nb_envoyes !== 1 ? 's' : ''}
                </div>
                {smsResult.nb_sans_telephone > 0 && (
                  <div style={{ fontSize: 13, color: '#d97706' }}>
                    {smsResult.nb_sans_telephone} participant{smsResult.nb_sans_telephone !== 1 ? 's' : ''} sans téléphone (non contactés)
                  </div>
                )}
                <button
                  onClick={() => setShowSmsModal(false)}
                  style={{ marginTop: 20, padding: '9px 24px', borderRadius: 8, border: 'none', backgroundColor: '#1e3a5f', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                {/* Alerte préventive : liste des inscrits sans téléphone qui NE recevront PAS le SMS */}
                {(() => {
                  const sansTel = inscriptions.filter(i =>
                    ['confirme', 'incertain'].includes(i.presence) && !i.telephone?.trim()
                  )
                  if (sansTel.length === 0) return null
                  return (
                    <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        ⚠️ {sansTel.length} personne{sansTel.length > 1 ? 's' : ''} ne recevra{sansTel.length > 1 ? 'ont' : ''} pas le SMS (téléphone manquant) :
                      </div>
                      <div>
                        {sansTel.map(i => i.prenom_nom).join(', ')}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#7f1d1d', fontStyle: 'italic' }}>
                        Pense à les rejoindre par un autre moyen (courriel, téléphone du contact d&apos;urgence, etc.)
                      </div>
                    </div>
                  )
                })()}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Message
                    <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                      Variables: {'{prenom}'} {'{camp}'} {'{dates}'} {'{lieu}'}
                    </span>
                  </label>
                  <textarea
                    value={smsMessage}
                    onChange={e => setSmsMessage(e.target.value)}
                    rows={4}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                  <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
                    {smsMessage.length} caractères · ~{Math.ceil(smsMessage.length / 160)} SMS par destinataire
                  </div>
                </div>

                <div style={{ padding: '10px 14px', backgroundColor: '#fffbeb', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                  <strong>Aperçu :</strong> {smsMessage
                    .replace('{prenom}', 'Charles')
                    .replace('{camp}', selectedCamp?.camp_nom || '')
                    .replace('{dates}', selectedCamp?.camp_dates || '')
                    .replace('{lieu}', selectedCamp?.camp_lieu || '')}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowSmsModal(false)}
                    disabled={sendingSms}
                    style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      const eligibles = inscriptions.filter(i => ['confirme', 'incertain'].includes(i.presence))
                      const sansTel = eligibles.filter(i => !i.telephone?.trim())
                      const avecTel = eligibles.length - sansTel.length
                      let msg = `⚠️ Vous êtes sur le point d'envoyer un SMS à ${avecTel} personne${avecTel > 1 ? 's' : ''} pour le camp:\n\n${selectedCamp?.camp_nom}\n${selectedCamp?.camp_dates}`
                      if (sansTel.length > 0) {
                        msg += `\n\n⚠️ ${sansTel.length} personne${sansTel.length > 1 ? 's' : ''} SANS téléphone (ne recevra${sansTel.length > 1 ? 'ont' : ''} pas le SMS):\n• ${sansTel.map(i => i.prenom_nom).join('\n• ')}`
                      }
                      msg += `\n\nCette action est irréversible. Continuer?`
                      if (confirm(msg)) {
                        envoyerRappelSms()
                      }
                    }}
                    disabled={sendingSms || !smsMessage.trim()}
                    style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: '#0d9488', color: 'white', fontSize: 13, fontWeight: 600, cursor: sendingSms ? 'not-allowed' : 'pointer', opacity: sendingSms ? 0.7 : 1 }}
                  >
                    {sendingSms
                      ? '⟳ Envoi en cours…'
                      : `📱 Envoyer aux ${inscriptions.filter(i => ['confirme', 'incertain'].includes(i.presence) && i.telephone?.trim()).length} inscrits`
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>

      {/* ─── Modal Compose Courriel ─── */}
      {emailDest && (
        <ModalComposeCourriel
          destinataires={emailDest}
          initialSubject={selectedCamp ? `${selectedCamp.camp_nom} — ` : ''}
          onClose={() => setEmailDest(null)}
          onSent={() => setEmailDest(null)}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CampItem({ camp, selected, onClick }: { camp: Camp; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '8px 10px', border: 'none', cursor: 'pointer',
        background: selected ? '#eff6ff' : 'transparent',
        borderLeft: selected ? '3px solid #1e3a5f' : '3px solid transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? '#1e3a5f' : '#374151', lineHeight: 1.3 }}>
        {camp.camp_nom.replace(' - Camp de qualification', '').trim()}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{camp.camp_dates}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>{camp.nb_total} inscrits</span>
        {camp.nb_confirme > 0 && <span style={{ fontSize: 11, color: '#065f46' }}>· {camp.nb_confirme} ✓</span>}
        {camp.nb_absent > 0 && <span style={{ fontSize: 11, color: '#dc2626' }}>· {camp.nb_absent} ✗</span>}
      </div>
    </button>
  )
}

function Badge({ label, value, color, bg, active, onClick }: { label: string; value: number; color: string; bg: string; active?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg, borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 60,
        cursor: onClick ? 'pointer' : 'default',
        outline: active ? `2px solid ${color}` : '2px solid transparent',
        outlineOffset: 1,
        transition: 'outline 0.15s, transform 0.15s',
        transform: active ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color, opacity: 0.8 }}>{label}</div>
    </div>
  )
}
