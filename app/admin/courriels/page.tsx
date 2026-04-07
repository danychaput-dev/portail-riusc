'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ModalComposeCourriel from '@/app/components/ModalComposeCourriel'

const C = '#1e3a5f'

// ─── Types ───────────────────────────────────────────────────
interface CampagneStats {
  id: string
  nom: string
  subject: string
  body_html: string
  total_envoyes: number
  created_at: string
  reponses_total?: number
  reponses_non_lues?: number
  stats: {
    total: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    failed: number
    taux_ouverture: number
    taux_clics: number
  }
}

interface ReponseInline {
  id: string
  courriel_id: string | null
  from_email: string
  from_name: string | null
  subject: string | null
  body_text: string | null
  body_html: string | null
  pieces_jointes: any[]
  statut: string
  created_at: string
  resend_email_id?: string
}

interface Destinataire {
  id: string
  benevole_id: string
  to_email: string
  statut: string
  ouvert_at: string | null
  clics_count: number
  created_at: string
  nom_complet: string
  prenom: string
  nom: string
  body_html?: string
  subject?: string
  has_reply?: boolean
  reponses?: ReponseInline[]
}

interface CourrielIndividuel {
  id: string
  benevole_id: string
  subject: string
  from_name: string
  from_email: string
  to_email: string
  statut: string
  ouvert_at: string | null
  clics_count: number
  created_at: string
  body_html: string
  pieces_jointes: string[] | null
  nom_complet: string
  has_reply?: boolean
  reponses?: ReponseInline[]
}

type ActiveTab = 'campagnes' | 'individuels'

// ─── Helpers ─────────────────────────────────────────────────
function statutBadge(statut: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    queued:    { label: 'En file',   color: '#6b7280', bg: '#f3f4f6' },
    sent:      { label: 'Envoyé',    color: '#6b7280', bg: '#f3f4f6' },
    delivered: { label: 'Livré',     color: '#16a34a', bg: '#f0fdf4' },
    opened:    { label: 'Ouvert',    color: '#2563eb', bg: '#eff6ff' },
    clicked:   { label: 'Cliqué',    color: '#1e40af', bg: '#dbeafe' },
    bounced:   { label: 'Rebondi',   color: '#dc2626', bg: '#fef2f2' },
    failed:    { label: 'Échoué',    color: '#dc2626', bg: '#fef2f2' },
  }
  const m = map[statut] || map.sent
  return (
    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', backgroundColor: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

function formatDate(d: string) {
  const date = new Date(d)
  return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDateTime(d: string) {
  const date = new Date(d)
  return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }) + ' à ' + date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
}

function reponseStatutBadge(statut: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    recu:    { label: 'Reçu',    color: '#d97706', bg: '#fffbeb' },
    lu:      { label: 'Lu',      color: '#2563eb', bg: '#eff6ff' },
    traite:  { label: 'Traité',  color: '#16a34a', bg: '#f0fdf4' },
    archive: { label: 'Archivé', color: '#6b7280', bg: '#f3f4f6' },
    sortant: { label: 'Envoyé',  color: '#1e3a5f', bg: '#eff6ff' },
  }
  const m = map[statut] || map.recu
  return (
    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', backgroundColor: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

function StatPill({ value, label, color, bg }: { value: number | string; label: string; color: string; bg: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: '10px', backgroundColor: bg, minWidth: '70px' }}>
      <span style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</span>
      <span style={{ fontSize: '10px', fontWeight: '600', color, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
    </div>
  )
}

// ─── Composant filtres ───────────────────────────────────────
function FilterBar({ search, setSearch, dateFrom, setDateFrom, dateTo, setDateTo }: {
  search: string; setSearch: (v: string) => void
  dateFrom: string; setDateFrom: (v: string) => void
  dateTo: string; setDateTo: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
      <input
        type="text"
        placeholder="🔍 Rechercher nom, courriel ou sujet..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', width: '280px', outline: 'none' }}
      />
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <label style={{ fontSize: '12px', color: '#6b7280' }}>Du</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
        <label style={{ fontSize: '12px', color: '#6b7280' }}>au</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
      </div>
      {(search || dateFrom || dateTo) && (
        <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
          ✕ Effacer
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════
export default function CampagnesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('campagnes')

  // ─── Campagnes ───
  const [campagnes, setCampagnes] = useState<CampagneStats[]>([])
  const [selectedCampagne, setSelectedCampagne] = useState<string | null>(null)
  const [campagneDetail, setCampagneDetail] = useState<{ campagne: any; destinataires: Destinataire[] } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [campSearch, setCampSearch] = useState('')
  const [campDateFrom, setCampDateFrom] = useState('')
  const [campDateTo, setCampDateTo] = useState('')

  // ─── Individuels ───
  const [individuels, setIndividuels] = useState<CourrielIndividuel[]>([])
  const [loadingIndiv, setLoadingIndiv] = useState(false)
  const [selectedIndiv, setSelectedIndiv] = useState<string | null>(null)
  const [indivSearch, setIndivSearch] = useState('')
  const [indivDateFrom, setIndivDateFrom] = useState('')
  const [indivDateTo, setIndivDateTo] = useState('')

  // ─── Réponses non lues ───
  const [reponsesNonLues, setReponsesNonLues] = useState(0)
  const [showOnlyWithReplies, setShowOnlyWithReplies] = useState(false)

  // ─── Reply statut management ───
  const [updatingStatut, setUpdatingStatut] = useState<string | null>(null)

  // ─── Filtre envoyeur ───
  const [filterSender, setFilterSender] = useState('')

  // ─── Réponses orphelines (sans courriel_id) ───
  const [reponsesOrphelines, setReponsesOrphelines] = useState<(ReponseInline & { benevole_id?: string; nom_complet?: string })[]>([])

  // ─── Reply modal ───
  const [replyDest, setReplyDest] = useState<{ benevole_id: string; email: string; prenom: string; nom: string }[] | null>(null)
  const [replySubject, setReplySubject] = useState('')

  // ─── Auth ───
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (!res || !['admin', 'coordonnateur'].includes(res.role)) { router.push('/'); return }
      setAuthorized(true)
    }
    init()
  }, [])

  // ─── Load campagnes ───
  useEffect(() => {
    if (!authorized) return
    fetch('/api/admin/courriels/campagnes')
      .then(r => r.json())
      .then(json => setCampagnes(json.campagnes || []))
      .catch(() => {})
      .finally(() => setLoading(false))

    // Compter les réponses non lues et synchroniser le badge sidebar
    fetch('/api/admin/courriels/reponses?statut=recu&limit=200')
      .then(r => r.json())
      .then(json => {
        const count = (json.reponses || []).length
        setReponsesNonLues(count)
        dispatchBadgeUpdate(count)
      })
      .catch(() => {})
  }, [authorized])

  // ─── Load individuels quand on switch d'onglet ───
  useEffect(() => {
    if (!authorized || activeTab !== 'individuels') return
    setLoadingIndiv(true)
    const params = new URLSearchParams()
    if (indivDateFrom) params.set('from', indivDateFrom)
    if (indivDateTo) params.set('to', indivDateTo)
    fetch(`/api/admin/courriels/individuels?${params}`)
      .then(r => r.json())
      .then(json => {
        setIndividuels(json.courriels || [])
        setReponsesOrphelines(json.reponses_orphelines || [])
      })
      .catch(() => {})
      .finally(() => setLoadingIndiv(false))
  }, [authorized, activeTab, indivDateFrom, indivDateTo])

  // ─── Sync sidebar badge via custom event ───
  const dispatchBadgeUpdate = (count: number) => {
    window.dispatchEvent(new CustomEvent('courriels-badge-update', { detail: { count } }))
  }

  // ─── Tout marquer lu ───
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const markAllAsRead = async () => {
    setMarkingAllRead(true)
    try {
      await fetch('/api/admin/courriels/reponses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk_statut_from: 'recu', statut: 'lu' }),
      })
      setReponsesNonLues(0)
      dispatchBadgeUpdate(0)
      // Update inline data
      setCampagneDetail(prev => {
        if (!prev) return prev
        return {
          ...prev,
          destinataires: prev.destinataires.map(d => ({
            ...d,
            reponses: d.reponses?.map(r => r.statut === 'recu' ? { ...r, statut: 'lu' } : r),
          })),
        }
      })
      setIndividuels(prev => prev.map(c => ({
        ...c,
        reponses: c.reponses?.map(r => r.statut === 'recu' ? { ...r, statut: 'lu' } : r),
      })))
      setReponsesOrphelines(prev => prev.map(r => r.statut === 'recu' ? { ...r, statut: 'lu' } : r))
    } catch {}
    setMarkingAllRead(false)
  }

  // ─── Changer statut d'une réponse (inline) ───
  const updateReponseStatut = async (reponseId: string, newStatut: string) => {
    setUpdatingStatut(reponseId)
    try {
      await fetch('/api/admin/courriels/reponses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reponse_id: reponseId, statut: newStatut }),
      })
      // Décrémenter le compteur si on marque une réponse "recu" comme autre chose
      if (newStatut !== 'recu') {
        setReponsesNonLues(c => {
          const newCount = Math.max(0, c - 1)
          dispatchBadgeUpdate(newCount)
          return newCount
        })
      }
      // Mettre à jour le statut dans les données inline (campagnes + individuels)
      setCampagneDetail(prev => {
        if (!prev) return prev
        return {
          ...prev,
          destinataires: prev.destinataires.map(d => ({
            ...d,
            reponses: d.reponses?.map(r => r.id === reponseId ? { ...r, statut: newStatut } : r),
          })),
        }
      })
      setIndividuels(prev => prev.map(c => ({
        ...c,
        reponses: c.reponses?.map(r => r.id === reponseId ? { ...r, statut: newStatut } : r),
      })))
    } catch {}
    setUpdatingStatut(null)
  }

  // ─── Load campagne detail ───
  const openCampagneDetail = async (id: string) => {
    if (selectedCampagne === id) { setSelectedCampagne(null); setCampagneDetail(null); return }
    setSelectedCampagne(id)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/admin/courriels/campagne-detail?campagne_id=${id}`)
      const json = await res.json()
      setCampagneDetail(json)
    } catch { setCampagneDetail(null) }
    setLoadingDetail(false)
  }

  // ─── Filtrage campagnes ───
  const filteredCampagnes = useMemo(() => {
    let list = campagnes
    if (campSearch) {
      const s = campSearch.toLowerCase()
      list = list.filter(c => c.subject.toLowerCase().includes(s) || c.nom?.toLowerCase().includes(s))
    }
    if (campDateFrom) list = list.filter(c => c.created_at >= campDateFrom)
    if (campDateTo) list = list.filter(c => c.created_at.slice(0, 10) <= campDateTo)
    return list
  }, [campagnes, campSearch, campDateFrom, campDateTo])

  // ─── Liste des envoyeurs uniques (from_name ou from_email) pour le filtre ───
  const uniqueSenders = useMemo(() => {
    const senders = new Set<string>()
    individuels.forEach(c => {
      if (c.from_name) senders.add(c.from_name)
      else if (c.from_email) senders.add(c.from_email)
    })
    return Array.from(senders).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [individuels])

  // ─── Regrouper les individuels par conversation (même destinataire + sujet normalisé) ───
  const normalizeSubject = (s: string) => s.replace(/^(Re:\s*|Rép\.\s*:\s*|Fw:\s*|Fwd:\s*)+/gi, '').trim().toLowerCase()

  const threadedIndiv = useMemo(() => {
    // Grouper par clé de conversation
    const threads = new Map<string, CourrielIndividuel[]>()
    for (const c of individuels) {
      const key = `${c.benevole_id}::${normalizeSubject(c.subject)}`
      const list = threads.get(key) || []
      list.push(c)
      threads.set(key, list)
    }
    // Pour chaque thread, le plus ancien est le "parent", les autres deviennent des réponses sortantes
    const result: CourrielIndividuel[] = []
    for (const [, msgs] of threads) {
      const sorted = msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const parent = { ...sorted[0] }
      // Fusionner les réponses entrantes de tous les courriels du thread
      const allInboundReplies = sorted.flatMap(c => c.reponses || [])
      // Les courriels sortants après le premier deviennent aussi des réponses (type sortant)
      const outboundReplies: ReponseInline[] = sorted.slice(1).map(c => ({
        id: c.id,
        courriel_id: parent.id,
        from_email: c.from_email,
        from_name: c.from_name,
        subject: c.subject,
        body_text: null,
        body_html: c.body_html,
        pieces_jointes: c.pieces_jointes || [],
        statut: 'sortant',
        created_at: c.created_at,
      }))
      // Combiner toutes les réponses et trier par date
      const allReplies = [...allInboundReplies, ...outboundReplies].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      parent.reponses = allReplies
      parent.has_reply = allReplies.length > 0
      result.push(parent)
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [individuels])

  // ─── Filtrage individuels ───
  const filteredIndiv = useMemo(() => {
    let list = threadedIndiv
    if (showOnlyWithReplies) {
      list = list.filter(c => c.reponses && c.reponses.length > 0)
    }
    if (filterSender) {
      list = list.filter(c => (c.from_name || c.from_email) === filterSender)
    }
    if (indivSearch) {
      const s = indivSearch.toLowerCase()
      list = list.filter(c =>
        (c.nom_complet || '').toLowerCase().includes(s) ||
        (c.to_email || '').toLowerCase().includes(s) ||
        (c.subject || '').toLowerCase().includes(s)
      )
    }
    return list
  }, [threadedIndiv, indivSearch, showOnlyWithReplies, filterSender])

  // ─── Reply helpers ───
  const handleReply = (dest: { benevole_id: string; email: string; prenom: string; nom: string }, subject: string) => {
    setReplySubject(subject.startsWith('Re: ') ? subject : `Re: ${subject}`)
    setReplyDest([dest])
  }
  const handleReplyAll = (destinataires: Destinataire[], subject: string) => {
    setReplySubject(subject.startsWith('Re: ') ? subject : `Re: ${subject}`)
    setReplyDest(destinataires.map(d => ({
      benevole_id: d.benevole_id,
      email: d.to_email,
      prenom: d.prenom || '',
      nom: d.nom || '',
    })))
  }

  if (!authorized) return null

  const tabBtn = (tab: ActiveTab, label: string) => (
    <button
      onClick={() => { setActiveTab(tab); setSelectedCampagne(null); setCampagneDetail(null); setSelectedIndiv(null) }}
      style={{
        padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '14px', fontWeight: activeTab === tab ? '700' : '400',
        color: activeTab === tab ? C : '#6b7280',
        borderBottom: activeTab === tab ? `2px solid ${C}` : '2px solid transparent',
        marginBottom: '-2px',
      }}
    >
      {label}
    </button>
  )

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: C }}>Courriels</h1>
        </div>
      </div>

        {/* Bandeau réponses non lues */}
        {reponsesNonLues > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
            marginBottom: '16px', borderRadius: '10px',
            backgroundColor: '#fffbeb', border: '1px solid #fbbf24',
          }}>
            <span style={{ fontSize: '16px' }}>📨</span>
            <span style={{ fontSize: '13px', color: '#92400e', fontWeight: '600', flex: 1 }}>
              {reponsesNonLues} réponse{reponsesNonLues > 1 ? 's' : ''} non lue{reponsesNonLues > 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  // Trouver la première campagne avec réponses non lues
                  const campAvecReponses = campagnes.find(c => (c.reponses_non_lues || 0) > 0)
                  if (campAvecReponses) {
                    setActiveTab('campagnes')
                    openCampagneDetail(campAvecReponses.id)
                  } else {
                    // Fallback: réponses individuelles
                    setShowOnlyWithReplies(!showOnlyWithReplies)
                    setActiveTab('individuels')
                  }
                }}
                style={{
                  padding: '5px 14px', fontSize: '12px', fontWeight: '600',
                  borderRadius: '6px', border: '1px solid #f59e0b', cursor: 'pointer',
                  backgroundColor: showOnlyWithReplies ? '#f59e0b' : 'white',
                  color: showOnlyWithReplies ? 'white' : '#92400e',
                }}
              >
                {showOnlyWithReplies ? '✕ Voir tous' : 'Voir les réponses'}
              </button>
              <button
                onClick={markAllAsRead}
                disabled={markingAllRead}
                style={{
                  padding: '5px 14px', fontSize: '12px', fontWeight: '600',
                  borderRadius: '6px', border: '1px solid #16a34a', cursor: markingAllRead ? 'wait' : 'pointer',
                  backgroundColor: '#f0fdf4', color: '#16a34a',
                  opacity: markingAllRead ? 0.6 : 1,
                }}
              >
                {markingAllRead ? '⏳' : '✓'} Tout marquer lu
              </button>
            </div>
          </div>
        )}

        {/* Onglets */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', gap: '4px' }}>
          {tabBtn('campagnes', `📧 Campagnes (${campagnes.length})`)}
          {tabBtn('individuels', `📨 Individuels${individuels.length > 0 ? ` (${individuels.length})` : ''}`)}
        </div>

        {/* ════ ONGLET CAMPAGNES ════ */}
        {activeTab === 'campagnes' && (
          <>
            <FilterBar search={campSearch} setSearch={setCampSearch} dateFrom={campDateFrom} setDateFrom={setCampDateFrom} dateTo={campDateTo} setDateTo={setCampDateTo} />

            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Chargement…</div>
            ) : filteredCampagnes.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontSize: '15px', color: '#6b7280' }}>Aucune campagne {campSearch || campDateFrom || campDateTo ? 'trouvée' : 'envoyée pour le moment'}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredCampagnes.map(c => {
                  const s = c.stats
                  const isOpen = selectedCampagne === c.id

                  return (
                    <div key={c.id} style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid transparent' }}>
                      {/* Ligne résumé — cliquable */}
                      <div
                        onClick={() => openCampagneDetail(c.id)}
                        style={{ padding: '14px 16px', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr auto 130px 40px', gap: '12px', alignItems: 'center', transition: 'background-color 0.1s' }}
                        onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                        onMouseOut={e => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.subject}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                            {s.total} destinataire{s.total > 1 ? 's' : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px', backgroundColor: '#f3f4f6', color: '#374151' }}>{s.total} env.</span>
                          <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a' }}>{s.delivered} liv.</span>
                          <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb' }}>{s.taux_ouverture}% ouv.</span>
                          {s.bounced > 0 && <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#dc2626' }}>{s.bounced} reb.</span>}
                          {(c.reponses_total || 0) > 0 && (
                            <span style={{
                              fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '8px',
                              backgroundColor: (c.reponses_non_lues || 0) > 0 ? '#fef3c7' : '#dbeafe',
                              color: (c.reponses_non_lues || 0) > 0 ? '#92400e' : '#1e40af',
                              animation: (c.reponses_non_lues || 0) > 0 ? 'none' : 'none',
                            }}>
                              💬 {c.reponses_total} rép.{(c.reponses_non_lues || 0) > 0 ? ` (${c.reponses_non_lues} ⬤)` : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{formatDate(c.created_at)}</div>
                        <span style={{ fontSize: '14px', color: '#9ca3af', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', textAlign: 'center' }}>▼</span>
                      </div>

                      {/* ─── Détail destinataires (quand ouvert) ─── */}
                      {isOpen && (
                        <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 20px', backgroundColor: '#f9fafb' }}>
                          {loadingDetail ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Chargement des destinataires…</div>
                          ) : !campagneDetail ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Erreur de chargement</div>
                          ) : (
                            <>
                              {/* Actions campagne */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                                  {campagneDetail.destinataires.length} destinataire{campagneDetail.destinataires.length > 1 ? 's' : ''}
                                </span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => handleReplyAll(campagneDetail.destinataires, c.subject)}
                                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', backgroundColor: C, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                  >
                                    ↩ Répondre à tous
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Supprimer la campagne « ${c.subject} » et tous ses ${s.total} courriels ?\n\nCette action est irréversible.`)) return
                                      const res = await fetch('/api/admin/courriels/supprimer', {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ campagne_id: c.id }),
                                      })
                                      if (res.ok) {
                                        setCampagnes(prev => prev.filter(camp => camp.id !== c.id))
                                        setSelectedCampagne(null)
                                        setCampagneDetail(null)
                                      } else {
                                        alert('Erreur lors de la suppression')
                                      }
                                    }}
                                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', color: '#dc2626', backgroundColor: 'white', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' }}
                                  >
                                    🗑 Supprimer la campagne
                                  </button>
                                </div>
                              </div>

                              {/* Table destinataires + réponses en fil */}
                              <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 140px 70px 80px', gap: '0', backgroundColor: '#f1f5f9', padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                                  <div>Nom</div>
                                  <div>Courriel</div>
                                  <div>Statut</div>
                                  <div>Ouvert le</div>
                                  <div style={{ textAlign: 'center' }}>Clics</div>
                                  <div style={{ textAlign: 'center' }}>Action</div>
                                </div>
                                {campagneDetail.destinataires.map(d => (
                                  <div key={d.id}>
                                    {/* Ligne destinataire */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 140px 70px 80px', gap: '0', padding: '10px 12px', fontSize: '13px', borderTop: '1px solid #f3f4f6', backgroundColor: d.reponses && d.reponses.some((r: ReponseInline) => r.statut === 'recu') ? '#fffdf5' : d.reponses && d.reponses.length > 0 ? '#f0f9ff' : 'white', alignItems: 'center' }}>
                                      <div style={{ fontWeight: '500', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {d.nom_complet}
                                        {d.reponses && d.reponses.length > 0 && (
                                          <span style={{ fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', backgroundColor: '#dbeafe', color: '#1e40af' }}>
                                            💬 {d.reponses.length}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ color: '#6b7280', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.to_email}</div>
                                      <div>{statutBadge(d.statut)}</div>
                                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{d.ouvert_at ? formatDateTime(d.ouvert_at) : '—'}</div>
                                      <div style={{ textAlign: 'center', fontSize: '12px', color: d.clics_count > 0 ? '#1e40af' : '#9ca3af', fontWeight: d.clics_count > 0 ? '700' : '400' }}>
                                        {d.clics_count > 0 ? d.clics_count : '—'}
                                      </div>
                                      <div style={{ textAlign: 'center' }}>
                                        <button
                                          onClick={() => handleReply({ benevole_id: d.benevole_id, email: d.to_email, prenom: d.prenom, nom: d.nom }, c.subject)}
                                          style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', color: C, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                          ↩ Reply
                                        </button>
                                      </div>
                                    </div>
                                    {/* Réponses en fil (retrait) */}
                                    {d.reponses && d.reponses.map(rep => {
                                      const isRepNonLu = rep.statut === 'recu'
                                      return (
                                      <div key={rep.id} style={{ borderTop: `1px solid ${isRepNonLu ? '#fbbf24' : '#f3f4f6'}`, backgroundColor: isRepNonLu ? '#fffdf5' : '#f8fafc', padding: '10px 12px 10px 36px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '2px' }}>↳</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '12px', fontWeight: isRepNonLu ? '700' : '600', color: isRepNonLu ? '#92400e' : '#1e40af' }}>
                                              📨 Réponse de {rep.from_name || rep.from_email}
                                            </span>
                                            {reponseStatutBadge(rep.statut)}
                                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                              {formatDateTime(rep.created_at)}
                                            </span>
                                          </div>
                                          {rep.subject && <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>{rep.subject}</div>}
                                          <div
                                            style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.5', maxHeight: '120px', overflowY: 'auto', whiteSpace: rep.body_html ? undefined : 'pre-wrap' }}
                                            dangerouslySetInnerHTML={rep.body_html ? { __html: rep.body_html } : undefined}
                                          >
                                            {!rep.body_html ? (rep.body_text || '') : undefined}
                                          </div>
                                          {rep.pieces_jointes && rep.pieces_jointes.length > 0 && (
                                            <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                              {rep.pieces_jointes.map((att: any, i: number) => (
                                                <a key={i} href={`/api/admin/courriels/attachment?email_id=${rep.resend_email_id || ''}&attachment_id=${att.id || ''}&filename=${encodeURIComponent(att.filename || 'fichier')}&content_type=${encodeURIComponent(att.content_type || 'application/octet-stream')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#e2e8f0', color: '#1e40af', textDecoration: 'none', cursor: 'pointer' }}>📎 {att.filename || 'fichier'}</a>
                                              ))}
                                            </div>
                                          )}
                                          {/* Actions statut + répondre */}
                                          <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {['recu', 'lu', 'traite', 'archive'].map(s => {
                                              const labels: Record<string, string> = { recu: '📨 Reçu', lu: '👁️ Lu', traite: '✅ Traité', archive: '📁 Archivé' }
                                              const isActive = rep.statut === s
                                              const isHighlight = s === 'lu' && rep.statut === 'recu'
                                              return (
                                                <button key={s} disabled={isActive || updatingStatut === rep.id} onClick={() => updateReponseStatut(rep.id, s)}
                                                  style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', cursor: isActive ? 'default' : 'pointer', border: isHighlight ? '1px solid #16a34a' : isActive ? `1px solid ${C}` : '1px solid #e2e8f0', backgroundColor: isHighlight ? '#f0fdf4' : isActive ? '#eff6ff' : 'white', color: isHighlight ? '#16a34a' : isActive ? C : '#6b7280', fontWeight: isHighlight ? '700' : '400', opacity: updatingStatut === rep.id ? 0.5 : 1 }}
                                                  title={({ recu: 'Reçu', lu: 'Marquer comme lu', traite: 'Marquer comme traité', archive: 'Archiver' } as Record<string, string>)[s]}
                                                >{labels[s]}</button>
                                              )
                                            })}
                                            <button
                                              onClick={() => handleReply({ benevole_id: d.benevole_id, email: d.to_email, prenom: d.prenom, nom: d.nom }, rep.subject || c.subject)}
                                              style={{ marginLeft: '4px', padding: '2px 10px', fontSize: '11px', fontWeight: '600', color: C, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                              ↩ Répondre
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                      )
                                    })}
                                  </div>
                                ))}
                              </div>

                              {/* Aperçu du contenu */}
                              {c.body_html && (
                                <details style={{ marginTop: '12px' }}>
                                  <summary style={{ fontSize: '12px', color: '#6b7280', cursor: 'pointer', fontWeight: '600' }}>📄 Voir le contenu du courriel</summary>
                                  <div style={{ marginTop: '8px', padding: '16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', lineHeight: '1.6', color: '#374151', maxHeight: '300px', overflowY: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: c.body_html }}
                                  />
                                </details>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ════ ONGLET INDIVIDUELS ════ */}
        {activeTab === 'individuels' && (
          <>
            <FilterBar search={indivSearch} setSearch={setIndivSearch} dateFrom={indivDateFrom} setDateFrom={setIndivDateFrom} dateTo={indivDateTo} setDateTo={setIndivDateTo} />
            {/* Filtres supplémentaires : envoyeur + avec réponses */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', marginTop: '-8px' }}>
              {uniqueSenders.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', color: '#6b7280' }}>Envoyeur</label>
                  <select
                    value={filterSender}
                    onChange={e => setFilterSender(e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none', backgroundColor: 'white' }}
                  >
                    <option value="">Tous</option>
                    {uniqueSenders.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {filterSender && (
                <button onClick={() => setFilterSender('')} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                  ✕ Réinitialiser envoyeur
                </button>
              )}
            </div>

            {loadingIndiv ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Chargement…</div>
            ) : filteredIndiv.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontSize: '15px', color: '#6b7280' }}>Aucun courriel individuel {indivSearch || indivDateFrom || indivDateTo ? 'trouvé' : 'envoyé'}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredIndiv.map(c => {
                  const isOpen = selectedIndiv === c.id
                  const hasUnread = c.reponses?.some(r => r.statut === 'recu')
                  return (
                    <div key={c.id} style={{ backgroundColor: hasUnread ? '#fffdf5' : 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', border: hasUnread ? '1px solid #fbbf24' : '1px solid transparent' }}>
                      {/* Ligne résumé — cliquable */}
                      <div
                        onClick={() => setSelectedIndiv(isOpen ? null : c.id)}
                        style={{ padding: '14px 16px', cursor: 'pointer', display: 'grid', gridTemplateColumns: hasUnread ? '1fr 1fr 100px 130px 90px' : '1fr 1fr 100px 130px 70px 40px', gap: '8px', alignItems: 'center', transition: 'background-color 0.1s' }}
                        onMouseOver={e => (e.currentTarget.style.backgroundColor = hasUnread ? '#fffbeb' : '#f9fafb')}
                        onMouseOut={e => (e.currentTarget.style.backgroundColor = hasUnread ? '#fffdf5' : 'white')}
                      >
                        <div>
                          <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '13px' }}>{c.nom_complet}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.to_email}</div>
                        </div>
                        <div style={{ fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {c.subject}
                          {c.reponses && c.reponses.length > 0 && (
                            <span style={{ fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '8px', backgroundColor: hasUnread ? '#fbbf24' : '#dbeafe', color: hasUnread ? 'white' : '#1e40af', flexShrink: 0 }}>
                              💬 {c.reponses.filter(r => r.statut === 'recu').length || c.reponses.length}
                            </span>
                          )}
                        </div>
                        <div>{statutBadge(c.statut)}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{formatDate(c.created_at)}</div>
                        {hasUnread ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const unreadIds = c.reponses?.filter(r => r.statut === 'recu').map(r => r.id) || []
                              if (unreadIds.length === 0) return
                              fetch('/api/admin/courriels/reponses', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reponse_ids: unreadIds, statut: 'lu' }),
                              }).then(() => {
                                setIndividuels(prev => prev.map(item =>
                                  item.id === c.id
                                    ? { ...item, reponses: item.reponses?.map(r => r.statut === 'recu' ? { ...r, statut: 'lu' } : r) }
                                    : item
                                ))
                                setReponsesNonLues(prev => {
                                  const newCount = Math.max(0, prev - unreadIds.length)
                                  dispatchBadgeUpdate(newCount)
                                  return newCount
                                })
                              })
                            }}
                            style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '6px', border: '1px solid #16a34a', backgroundColor: '#f0fdf4', color: '#16a34a', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            ✓ Marquer lu
                          </button>
                        ) : (
                          <>
                            <div style={{ fontSize: '12px', color: c.clics_count > 0 ? '#1e40af' : '#9ca3af', textAlign: 'center', fontWeight: c.clics_count > 0 ? '700' : '400' }}>
                              {c.ouvert_at ? '👁' : ''} {c.clics_count > 0 ? `${c.clics_count} clic${c.clics_count > 1 ? 's' : ''}` : ''}
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '16px', color: '#9ca3af', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▼</div>
                          </>
                        )}
                      </div>

                      {/* Détail (quand ouvert) */}
                      {isOpen && (
                        <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 20px', backgroundColor: '#f9fafb' }}>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '12px', color: '#6b7280' }}>
                            <span>De : <strong>{c.from_name}</strong> ({c.from_email})</span>
                            <span>À : <strong>{c.nom_complet}</strong> ({c.to_email})</span>
                            <span>Envoyé : {formatDateTime(c.created_at)}</span>
                            {c.ouvert_at && <span>Ouvert : {formatDateTime(c.ouvert_at)}</span>}
                            {c.clics_count > 0 && <span>Clics : {c.clics_count}</span>}
                            {c.pieces_jointes && c.pieces_jointes.length > 0 && (
                              <span>📎 {c.pieces_jointes.length} pièce{c.pieces_jointes.length > 1 ? 's' : ''} jointe{c.pieces_jointes.length > 1 ? 's' : ''}</span>
                            )}
                          </div>

                          {/* Contenu */}
                          <div style={{ padding: '16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', lineHeight: '1.6', color: '#374151', maxHeight: '300px', overflowY: 'auto' }}
                            dangerouslySetInnerHTML={{ __html: c.body_html || '<em style="color:#9ca3af">Aucun contenu</em>' }}
                          />

                          {/* Actions */}
                          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleReply({
                                benevole_id: c.benevole_id,
                                email: c.to_email,
                                prenom: c.nom_complet.split(' ')[0] || '',
                                nom: c.nom_complet.split(' ').slice(1).join(' ') || '',
                              }, c.subject)}
                              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: 'white', backgroundColor: C, border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              ↩ Répondre
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Supprimer le courriel « ${c.subject} » et ses réponses ?\n\nCette action est irréversible.`)) return
                                const res = await fetch('/api/admin/courriels/supprimer', {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ courriel_id: c.id }),
                                })
                                if (res.ok) {
                                  setIndividuels(prev => prev.filter(item => item.id !== c.id))
                                  setSelectedIndiv(null)
                                } else {
                                  alert('Erreur lors de la suppression')
                                }
                              }}
                              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#dc2626', backgroundColor: 'white', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              🗑 Supprimer
                            </button>
                          </div>

                          {/* Réponses en fil */}
                          {c.reponses && c.reponses.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.03em' }}>
                                💬 {c.reponses.length} réponse{c.reponses.length > 1 ? 's' : ''}
                              </div>
                              {c.reponses.map((rep: ReponseInline) => {
                                const isNonLu = rep.statut === 'recu'
                                const isSortant = rep.statut === 'sortant'
                                const borderColor = isSortant ? '#93c5fd' : isNonLu ? '#fbbf24' : '#bfdbfe'
                                return (
                                <div key={rep.id} style={{ marginLeft: '16px', borderLeft: `3px solid ${borderColor}`, marginBottom: '10px', backgroundColor: isSortant ? '#f0f7ff' : isNonLu ? '#fffdf5' : 'transparent', borderRadius: (isNonLu || isSortant) ? '0 8px 8px 0' : undefined, padding: (isNonLu || isSortant) ? '10px 14px 10px 14px' : '0 0 0 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '12px', fontWeight: isNonLu ? '700' : '600', color: isSortant ? '#1e3a5f' : isNonLu ? '#92400e' : '#1e40af' }}>
                                      {isSortant ? '📤' : '📨'} {rep.from_name || rep.from_email}
                                    </span>
                                    {reponseStatutBadge(rep.statut)}
                                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{formatDateTime(rep.created_at)}</span>
                                  </div>
                                  {rep.subject && <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px', fontWeight: '500' }}>{rep.subject}</div>}
                                  <div
                                    style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', maxHeight: '200px', overflowY: 'auto', whiteSpace: rep.body_html ? undefined : 'pre-wrap' }}
                                    dangerouslySetInnerHTML={rep.body_html ? { __html: rep.body_html } : undefined}
                                  >
                                    {!rep.body_html ? (rep.body_text || '') : undefined}
                                  </div>
                                  {rep.pieces_jointes && rep.pieces_jointes.length > 0 && (
                                    <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                      {rep.pieces_jointes.map((att: any, i: number) => (
                                        <a key={i} href={`/api/admin/courriels/attachment?email_id=${rep.resend_email_id || ''}&attachment_id=${att.id || ''}&filename=${encodeURIComponent(att.filename || 'fichier')}&content_type=${encodeURIComponent(att.content_type || 'application/octet-stream')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#e2e8f0', color: '#1e40af', textDecoration: 'none', cursor: 'pointer' }}>📎 {att.filename || 'fichier'}</a>
                                      ))}
                                    </div>
                                  )}
                                  {/* Actions statut + répondre */}
                                  <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {!isSortant && ['recu', 'lu', 'traite', 'archive'].map(s => {
                                      const labels: Record<string, string> = { recu: '📨 Reçu', lu: '👁️ Lu', traite: '✅ Traité', archive: '📁 Archivé' }
                                      const isActive = rep.statut === s
                                      const isHighlight = s === 'lu' && rep.statut === 'recu'
                                      return (
                                        <button key={s} disabled={isActive || updatingStatut === rep.id} onClick={() => updateReponseStatut(rep.id, s)}
                                          style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', cursor: isActive ? 'default' : 'pointer', border: isHighlight ? '1px solid #16a34a' : isActive ? `1px solid ${C}` : '1px solid #e2e8f0', backgroundColor: isHighlight ? '#f0fdf4' : isActive ? '#eff6ff' : 'white', color: isHighlight ? '#16a34a' : isActive ? C : '#6b7280', fontWeight: isHighlight ? '700' : '400', opacity: updatingStatut === rep.id ? 0.5 : 1 }}
                                          title={({ recu: 'Reçu', lu: 'Marquer comme lu', traite: 'Marquer comme traité', archive: 'Archiver' } as Record<string, string>)[s]}
                                        >{labels[s]}</button>
                                      )
                                    })}
                                    <button
                                      onClick={() => handleReply({
                                        benevole_id: c.benevole_id,
                                        email: c.to_email,
                                        prenom: c.nom_complet.split(' ')[0] || '',
                                        nom: c.nom_complet.split(' ').slice(1).join(' ') || '',
                                      }, rep.subject || c.subject)}
                                      style={{ marginLeft: '4px', padding: '2px 10px', fontSize: '11px', fontWeight: '600', color: C, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      ↩ Répondre
                                    </button>
                                  </div>
                                </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ════ RÉPONSES ORPHELINES (sans courriel lié) ════ */}
        {activeTab === 'individuels' && reponsesOrphelines.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📨 Réponses reçues (non liées à un courriel)</span>
              <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#fffbeb', color: '#d97706' }}>
                {reponsesOrphelines.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reponsesOrphelines.map((rep: any) => (
                <div key={rep.id} style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '14px 16px', borderLeft: `3px solid ${rep.statut === 'recu' ? '#f59e0b' : '#e5e7eb'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>
                      {rep.nom_complet || rep.from_email}
                    </span>
                    {rep.from_name && <span style={{ fontSize: '12px', color: '#6b7280' }}>({rep.from_email})</span>}
                    {reponseStatutBadge(rep.statut)}
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{formatDateTime(rep.created_at)}</span>
                  </div>
                  {rep.subject && <div style={{ fontSize: '12px', color: '#374151', marginBottom: '6px', fontWeight: '500' }}>{rep.subject}</div>}
                  <div
                    style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto', whiteSpace: rep.body_html ? undefined : 'pre-wrap' }}
                    dangerouslySetInnerHTML={rep.body_html ? { __html: rep.body_html } : undefined}
                  >
                    {!rep.body_html ? (rep.body_text || <em style={{ color: '#9ca3af' }}>Aucun contenu</em>) : undefined}
                  </div>
                  {rep.pieces_jointes && rep.pieces_jointes.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {rep.pieces_jointes.map((att: any, i: number) => (
                        <a key={i} href={`/api/admin/courriels/attachment?email_id=${rep.resend_email_id || ''}&attachment_id=${att.id || ''}&filename=${encodeURIComponent(att.filename || 'fichier')}&content_type=${encodeURIComponent(att.content_type || 'application/octet-stream')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#e2e8f0', color: '#1e40af', textDecoration: 'none', cursor: 'pointer' }}>📎 {att.filename || 'fichier'}</a>
                      ))}
                    </div>
                  )}
                  {/* Actions statut */}
                  <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {['recu', 'lu', 'traite', 'archive'].map(s => {
                      const labels: Record<string, string> = { recu: '📨 Reçu', lu: '👁️ Lu', traite: '✅ Traité', archive: '📁 Archivé' }
                      const isActive = rep.statut === s
                      const isHighlight = s === 'lu' && rep.statut === 'recu'
                      return (
                        <button key={s} disabled={isActive || updatingStatut === rep.id} onClick={() => {
                          updateReponseStatut(rep.id, s)
                          // Aussi mettre à jour localement les orphelines
                          setReponsesOrphelines(prev => prev.map(r => r.id === rep.id ? { ...r, statut: s } : r))
                        }}
                          style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', cursor: isActive ? 'default' : 'pointer', border: isHighlight ? '1px solid #16a34a' : isActive ? `1px solid ${C}` : '1px solid #e2e8f0', backgroundColor: isHighlight ? '#f0fdf4' : isActive ? '#eff6ff' : 'white', color: isHighlight ? '#16a34a' : isActive ? C : '#6b7280', fontWeight: isHighlight ? '700' : '400', opacity: updatingStatut === rep.id ? 0.5 : 1 }}
                        >{labels[s]}</button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* En-tête colonne pour individuels (quand liste non vide et pas en chargement) */}
        {activeTab === 'individuels' && !loadingIndiv && filteredIndiv.length > 0 && (
          <style>{`
            @media (max-width: 768px) {
              [data-grid-indiv] { grid-template-columns: 1fr !important; }
              [data-grid-indiv] > div:nth-child(n+3) { display: none !important; }
            }
          `}</style>
        )}
        {/* ─── Modal Reply ─── */}
        {replyDest && (
          <ModalComposeCourriel
            destinataires={replyDest}
            initialSubject={replySubject}
            onClose={() => setReplyDest(null)}
            onSent={() => {
              setReplyDest(null)
              // Rafraîchir les données
              if (activeTab === 'individuels') {
                const params = new URLSearchParams()
                if (indivDateFrom) params.set('from', indivDateFrom)
                if (indivDateTo) params.set('to', indivDateTo)
                fetch(`/api/admin/courriels/individuels?${params}`)
                  .then(r => r.json())
                  .then(json => setIndividuels(json.courriels || []))
              }
            }}
          />
        )}
      </main>
  )
}
