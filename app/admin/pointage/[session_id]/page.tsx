'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import EditPointageModal from './EditPointageModal'
import LogsModal from './LogsModal'
import ManualCreateModal from './ManualCreateModal'

const C = '#1e3a5f'
const GREEN = '#16a34a'
const AMBER = '#d97706'
const RED = '#dc2626'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

export interface SessionMeta {
  id: string
  type_contexte: 'camp' | 'deploiement'
  contexte_nom: string
  contexte_dates: string | null
  contexte_lieu: string | null
  shift: string | null
  date_shift: string | null
  actif: boolean
  approuveur_id: string | null
}

export interface PointageRow {
  id: string
  benevole_id: string
  reserviste_nom: string
  heure_arrivee: string | null
  heure_depart: string | null
  duree_minutes: number | null
  statut: string
  source: string
  notes: string | null
  approuve_par: string | null
  approuve_par_nom: string | null
  approuve_at: string | null
}

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams<{ session_id: string }>()
  const sessionId = params.session_id

  const [session, setSession] = useState<SessionMeta | null>(null)
  const [approuveur, setApprouveur] = useState<{ benevole_id: string; nom: string } | null>(null)
  const [pointages, setPointages] = useState<PointageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [editTarget, setEditTarget] = useState<PointageRow | null>(null)
  const [logsTarget, setLogsTarget] = useState<PointageRow | null>(null)
  const [showManualCreate, setShowManualCreate] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Sélection multi avec support Shift+clic
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/pointage/sessions/${sessionId}/pointages`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) { setErr(json.error || 'Erreur'); setLoading(false); return }
      setSession(json.session)
      setApprouveur(json.approuveur)
      setPointages(json.pointages || [])
      setLastRefresh(new Date())
      setErr(null)
      setLoading(false)
    } catch (e: any) {
      setErr(e.message || 'Erreur réseau')
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { load() }, [load])

  // Auto-refresh toutes les 30 secondes
  useEffect(() => {
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [load])

  const doAction = async (id: string, action: string, extras?: Record<string, any>) => {
    const res = await fetch(`/api/admin/pointage/pointages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extras }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert('Erreur : ' + (json.error || `statut ${res.status}`))
      return
    }
    await load()
  }

  const handleExport = (includeAnnule: boolean) => {
    window.location.href = `/api/admin/pointage/sessions/${sessionId}/export?include_annule=${includeAnnule}`
  }

  // Indices des lignes sélectionnables (exclut les annulés)
  const selectableRows = useMemo(
    () => pointages.filter(p => p.statut !== 'annule'),
    [pointages]
  )

  // Ligne(s) complétée(s) sélectionnée(s) → approuvables en batch
  const approvablesSelected = useMemo(
    () => Array.from(selectedIds).filter(id =>
      pointages.find(p => p.id === id)?.statut === 'complete'
    ),
    [selectedIds, pointages]
  )

  const toggleRow = (idx: number, shiftKey: boolean) => {
    const row = selectableRows[idx]
    if (!row) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      const isSelecting = !next.has(row.id)
      if (shiftKey && lastCheckedIndex !== null && lastCheckedIndex !== idx) {
        const [from, to] = [Math.min(lastCheckedIndex, idx), Math.max(lastCheckedIndex, idx)]
        for (let i = from; i <= to; i++) {
          const r = selectableRows[i]
          if (r) {
            if (isSelecting) next.add(r.id)
            else next.delete(r.id)
          }
        }
      } else {
        if (isSelecting) next.add(row.id)
        else next.delete(row.id)
      }
      return next
    })
    setLastCheckedIndex(idx)
  }

  const toggleSelectAllCompletes = () => {
    const completes = pointages.filter(p => p.statut === 'complete').map(p => p.id)
    const allSelected = completes.length > 0 && completes.every(id => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(completes))
    setLastCheckedIndex(null)
  }

  const clearSelection = () => { setSelectedIds(new Set()); setLastCheckedIndex(null) }

  const bulkApprove = async () => {
    if (approvablesSelected.length === 0) return
    if (!confirm(`Approuver ${approvablesSelected.length} pointage(s) ?`)) return
    setBulkLoading(true)
    const results = await Promise.allSettled(
      approvablesSelected.map(id =>
        fetch(`/api/admin/pointage/pointages/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approuver' }),
        })
      )
    )
    const errors = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))
    if (errors.length > 0) {
      alert(`${errors.length} erreur(s) sur ${approvablesSelected.length}. Les autres ont été approuvés.`)
    }
    clearSelection()
    await load()
    setBulkLoading(false)
  }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: MUTED }}>Chargement…</div>
  }
  if (err) {
    return <div style={{ padding: 20, color: RED }}>Erreur : {err}</div>
  }
  if (!session) return null

  const stats = {
    total: pointages.length,
    en_cours: pointages.filter(p => p.statut === 'en_cours').length,
    complete: pointages.filter(p => p.statut === 'complete').length,
    approuve: pointages.filter(p => p.statut === 'approuve').length,
    conteste: pointages.filter(p => p.statut === 'conteste').length,
    annule: pointages.filter(p => p.statut === 'annule').length,
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px 60px' }}>
      <button onClick={() => router.push('/admin/pointage')}
        style={{ background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
        ← Retour aux QR
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C }}>
            📋 {session.contexte_nom}
          </h1>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, backgroundColor: session.type_contexte === 'camp' ? '#dbeafe' : '#fef3c7', color: session.type_contexte === 'camp' ? C : AMBER, marginRight: 8 }}>
              {session.type_contexte === 'camp' ? '🏕️ Camp' : '🚨 Déploiement'}
            </span>
            {session.shift && <span style={{ marginRight: 8 }}>{labelShift(session.shift)}</span>}
            {session.date_shift && <span style={{ marginRight: 8 }}>· {formatDate(session.date_shift)}</span>}
            {session.contexte_lieu && <span>· 📍 {session.contexte_lieu}</span>}
          </div>
          {approuveur && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
              Approuveur : <strong style={{ color: C }}>{approuveur.nom}</strong>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowManualCreate(true)}
            style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, backgroundColor: 'white', color: C, border: `1px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer' }}>
            + Ajouter manuellement
          </button>
          <button onClick={() => handleExport(false)}
            style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, backgroundColor: C, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            📊 Exporter Excel
          </button>
          <button onClick={load} title="Rafraîchir maintenant"
            style={{ padding: '8px 10px', fontSize: 12, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer' }}>
            🔄
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatBadge label="Total" value={stats.total} color={C} bg="#eff6ff" />
        <StatBadge label="En cours" value={stats.en_cours} color="#1d4ed8" bg="#dbeafe" />
        <StatBadge label="Complétés" value={stats.complete} color="#065f46" bg="#d1fae5" />
        <StatBadge label="Approuvés" value={stats.approuve} color={GREEN} bg="#dcfce7" />
        {stats.conteste > 0 && <StatBadge label="Contestés" value={stats.conteste} color={RED} bg="#fef2f2" />}
        {stats.annule > 0 && <StatBadge label="Annulés" value={stats.annule} color={MUTED} bg="#f1f5f9" />}
      </div>

      {lastRefresh && (
        <div style={{ fontSize: 10, color: MUTED, marginBottom: 10 }}>
          Dernière mise à jour : {lastRefresh.toLocaleTimeString('fr-CA')} · auto-refresh 30s
        </div>
      )}

      {/* Barre d'actions groupées */}
      {selectedIds.size > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 10, backgroundColor: '#eff6ff', border: `1px solid #bfdbfe`, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, color: C, fontWeight: 600 }}>
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </div>
          <button onClick={bulkApprove} disabled={bulkLoading || approvablesSelected.length === 0}
            title={approvablesSelected.length === 0 ? 'Aucun pointage complété dans la sélection' : `Approuver les ${approvablesSelected.length} pointage(s) complété(s) sélectionné(s)`}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, backgroundColor: (bulkLoading || approvablesSelected.length === 0) ? '#9ca3af' : GREEN, color: 'white', border: 'none', borderRadius: 6, cursor: (bulkLoading || approvablesSelected.length === 0) ? 'not-allowed' : 'pointer' }}>
            {bulkLoading ? 'Approbation…' : `✓ Approuver (${approvablesSelected.length})`}
          </button>
          <button onClick={clearSelection} disabled={bulkLoading}
            style={{ padding: '6px 12px', fontSize: 12, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer' }}>
            Effacer la sélection
          </button>
          <div style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>
            💡 <strong>Shift+clic</strong> pour sélectionner une plage
          </div>
        </div>
      )}

      {/* Tableau */}
      {pointages.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: MUTED, backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}` }}>
          Aucune entrée de présence pour cette session.
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ ...thStyle, width: 34, textAlign: 'center' }}>
                  <input type="checkbox"
                    title="Tout sélectionner (seulement les complétés)"
                    checked={(() => {
                      const completes = pointages.filter(p => p.statut === 'complete')
                      return completes.length > 0 && completes.every(p => selectedIds.has(p.id))
                    })()}
                    ref={el => {
                      if (el) {
                        const completes = pointages.filter(p => p.statut === 'complete')
                        const selCompletes = completes.filter(p => selectedIds.has(p.id)).length
                        el.indeterminate = selCompletes > 0 && selCompletes < completes.length
                      }
                    }}
                    onChange={toggleSelectAllCompletes}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={thStyle}>Réserviste</th>
                <th style={thStyle}>Arrivée</th>
                <th style={thStyle}>Départ</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Durée</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Statut</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Source</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pointages.map(p => {
                const selectableIdx = selectableRows.findIndex(r => r.id === p.id)
                const isSelectable = selectableIdx !== -1
                const isSelected = selectedIds.has(p.id)
                return (
                <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}`, opacity: p.statut === 'annule' ? 0.5 : 1, backgroundColor: isSelected ? '#eff6ff' : undefined }}>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {isSelectable && (
                      <input type="checkbox" checked={isSelected}
                        onClick={(e) => { e.stopPropagation(); toggleRow(selectableIdx, (e as any).shiftKey) }}
                        onChange={() => {}} // empêche React de râler sur le checked sans onChange
                        style={{ cursor: 'pointer' }}
                      />
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: C }}>{p.reserviste_nom}</div>
                    {p.notes && <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontStyle: 'italic' }}>💬 {p.notes}</div>}
                    {p.approuve_par_nom && <div style={{ fontSize: 11, color: GREEN, marginTop: 2 }}>✓ Approuvé par {p.approuve_par_nom}</div>}
                  </td>
                  <td style={tdStyle}>{p.heure_arrivee ? formatDateTime(p.heure_arrivee) : '—'}</td>
                  <td style={tdStyle}>{p.heure_depart ? formatDateTime(p.heure_depart) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {p.duree_minutes !== null ? formatDuree(p.duree_minutes) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <StatutBadge statut={p.statut} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontSize: 11, color: MUTED }}>
                    {p.source === 'qr_scan' ? '📱 QR' : '✍️ Manuel'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditTarget(p)} title="Corriger heures / notes" style={btnIcon}>✏️</button>
                    <button onClick={() => setLogsTarget(p)} title="Voir l'historique" style={btnIcon}>📜</button>
                    {p.statut === 'en_cours' && (
                      <button
                        onClick={() => setEditTarget({ ...p, heure_depart: new Date().toISOString(), notes: p.notes || '' })}
                        title="Terminer ce pointage (heure actuelle préremplie)"
                        style={{ ...btnIcon, color: RED }}>⏹️</button>
                    )}
                    {p.statut === 'complete' && (
                      <button onClick={() => doAction(p.id, 'approuver')} title="Approuver"
                        style={{ ...btnIcon, color: GREEN }}>✓</button>
                    )}
                    {(p.statut === 'complete' || p.statut === 'approuve') && (
                      <button onClick={() => { const n = prompt('Raison de la contestation ?'); if (n) doAction(p.id, 'contester', { notes: n }) }}
                        title="Contester" style={{ ...btnIcon, color: AMBER }}>⚠</button>
                    )}
                    {p.statut !== 'annule' && (
                      <button onClick={() => { if (confirm('Annuler ce pointage ?')) doAction(p.id, 'annuler') }}
                        title="Annuler" style={{ ...btnIcon, color: RED }}>✕</button>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <EditPointageModal pointage={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load() }}
        />
      )}
      {logsTarget && (
        <LogsModal pointage={logsTarget} onClose={() => setLogsTarget(null)} />
      )}
      {showManualCreate && session && (
        <ManualCreateModal
          sessionId={sessionId}
          onClose={() => setShowManualCreate(false)}
          onCreated={() => { setShowManualCreate(false); load() }}
        />
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

function StatBadge({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ padding: '6px 12px', borderRadius: 10, backgroundColor: bg, textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    'en_cours': { label: '🔵 En cours', color: '#1d4ed8', bg: '#dbeafe' },
    'complete': { label: '✓ Complété', color: '#065f46', bg: '#d1fae5' },
    'approuve': { label: '👍 Approuvé', color: GREEN, bg: '#dcfce7' },
    'conteste': { label: '⚠ Contesté', color: AMBER, bg: '#fef3c7' },
    'annule':   { label: '✕ Annulé',   color: MUTED, bg: '#f1f5f9' },
  }
  const c = cfg[statut] || { label: statut, color: MUTED, bg: '#f1f5f9' }
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

// ─── Styles & Helpers ───────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: MUTED,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: `2px solid ${BORDER}`,
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px', verticalAlign: 'top',
}

const btnIcon: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 15, padding: '2px 6px', marginLeft: 2,
}

function labelShift(shift: string): string {
  if (shift === 'jour') return '☀️ Jour'
  if (shift === 'nuit') return '🌙 Nuit'
  if (shift === 'complet') return '🕐 Complet'
  return shift
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuree(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.floor(min % 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}`
  return `${m} min`
}
