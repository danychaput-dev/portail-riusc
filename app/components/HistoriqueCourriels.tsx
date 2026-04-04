'use client'

import { useEffect, useState } from 'react'
import type { Courriel } from '@/types'

const C = '#1e3a5f'

const STATUT_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  queued:    { icon: '⏳', label: 'En file',   color: '#d97706', bg: '#fffbeb' },
  sent:      { icon: '✉️', label: 'Envoyé',    color: '#6b7280', bg: '#f3f4f6' },
  delivered: { icon: '✅', label: 'Livré',      color: '#16a34a', bg: '#f0fdf4' },
  opened:    { icon: '👁️', label: 'Ouvert',    color: '#2563eb', bg: '#eff6ff' },
  clicked:   { icon: '🔗', label: 'Cliqué',    color: '#1e40af', bg: '#dbeafe' },
  bounced:   { icon: '⚠️', label: 'Rebondi',   color: '#dc2626', bg: '#fef2f2' },
  failed:    { icon: '❌', label: 'Échoué',    color: '#dc2626', bg: '#fef2f2' },
}

interface Props {
  benevoleId: string
}

export default function HistoriqueCourriels({ benevoleId }: Props) {
  const [courriels, setCourriels] = useState<Courriel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!benevoleId) return
    setLoading(true)
    fetch(`/api/admin/courriels/historique?benevole_id=${benevoleId}`)
      .then(r => r.json())
      .then(json => setCourriels(json.courriels || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [benevoleId])

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>Chargement des courriels…</div>
  }

  if (courriels.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>Aucun courriel envoyé à ce réserviste</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {courriels.map(c => {
        const cfg = STATUT_CONFIG[c.statut] || STATUT_CONFIG.sent
        const date = new Date(c.created_at)
        const dateStr = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
        const timeStr = date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })

        return (
          <div
            key={c.id}
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '16px', lineHeight: 1, marginTop: '2px' }}>{cfg.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.subject}
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                  backgroundColor: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
                }}>
                  {cfg.label}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {c.from_name} — {dateStr} à {timeStr}
                {c.ouvert_at && (
                  <span style={{ marginLeft: '8px', color: '#2563eb' }}>
                    Ouvert le {new Date(c.ouvert_at).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                {c.clics_count > 0 && (
                  <span style={{ marginLeft: '8px', color: '#1e40af' }}>
                    {c.clics_count} clic{c.clics_count > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
