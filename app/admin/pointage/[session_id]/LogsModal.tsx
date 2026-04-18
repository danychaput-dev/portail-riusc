'use client'

import { useEffect, useState } from 'react'
import type { PointageRow } from './page'

const C = '#1e3a5f'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

interface LogEntry {
  id: string
  action: string
  valeur_avant: string | null
  valeur_apres: string | null
  notes: string | null
  modifie_par: string | null
  modifie_par_nom: string
  created_at: string
}

interface Props {
  pointage: PointageRow
  onClose: () => void
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  arrivee:            { label: '▶️ Arrivée',            color: '#16a34a' },
  depart:             { label: '⏹️ Départ',             color: '#dc2626' },
  correction_arrivee: { label: '✏️ Correction arrivée', color: '#d97706' },
  correction_depart:  { label: '✏️ Correction départ',  color: '#d97706' },
  approuve:           { label: '👍 Approuvé',           color: '#16a34a' },
  conteste:           { label: '⚠ Contesté',           color: '#d97706' },
  annule:             { label: '✕ Annulé',             color: '#6b7280' },
  creation_manuelle:  { label: '✍️ Création manuelle',   color: '#7c3aed' },
  nouvelle_entree:    { label: '➕ Nouvelle entrée',    color: '#16a34a' },
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatValue(v: string | null): string {
  if (!v) return '—'
  // Si ça ressemble à un ISO date, format lisible
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleString('fr-CA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
  }
  return v
}

export default function LogsModal({ pointage, onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/pointage/pointages/${pointage.id}/logs`, { cache: 'no-store' })
        const json = await res.json()
        setLogs(json.logs || [])
      } finally { setLoading(false) }
    })()
  }, [pointage.id])

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C, marginBottom: 4 }}>
          📜 Historique du pointage
        </h2>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 18 }}>
          {pointage.reserviste_nom}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Chargement…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: MUTED, fontSize: 13 }}>
            Aucune entrée de log.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {logs.map(l => {
              const cfg = ACTION_LABELS[l.action] || { label: l.action, color: MUTED }
              return (
                <div key={l.id} style={{ padding: 10, borderRadius: 8, backgroundColor: '#f8fafc', borderLeft: `3px solid ${cfg.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{formatDateTime(l.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#1e293b' }}>
                    Par <strong>{l.modifie_par_nom}</strong>
                  </div>
                  {(l.valeur_avant || l.valeur_apres) && (
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                      {l.valeur_avant && <span>Avant : <code style={{ color: '#dc2626' }}>{formatValue(l.valeur_avant)}</code></span>}
                      {l.valeur_avant && l.valeur_apres && <span> → </span>}
                      {l.valeur_apres && <span>Après : <code style={{ color: '#16a34a' }}>{formatValue(l.valeur_apres)}</code></span>}
                    </div>
                  )}
                  {l.notes && (
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
                      💬 {l.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose}
            style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, backgroundColor: C, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
}

const modalStyle: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: 12, padding: 24,
  width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
}
