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

const REPONSE_STATUT: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  recu:    { icon: '📨', label: 'Reçu',    color: '#d97706', bg: '#fffbeb' },
  lu:      { icon: '👁️', label: 'Lu',      color: '#2563eb', bg: '#eff6ff' },
  traite:  { icon: '✅', label: 'Traité',   color: '#16a34a', bg: '#f0fdf4' },
  archive: { icon: '📁', label: 'Archivé', color: '#6b7280', bg: '#f3f4f6' },
}

interface CourrielReponse {
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
}

interface Props {
  benevoleId: string
  refreshKey?: number
}

export default function HistoriqueCourriels({ benevoleId, refreshKey }: Props) {
  const [courriels, setCourriels] = useState<Courriel[]>([])
  const [reponses, setReponses] = useState<CourrielReponse[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!benevoleId) return
    setLoading(true)

    // Charger courriels envoyés ET réponses reçues en parallèle
    Promise.all([
      fetch(`/api/admin/courriels/historique?benevole_id=${benevoleId}`).then(r => r.json()),
      fetch(`/api/admin/courriels/reponses?benevole_id=${benevoleId}`).then(r => r.json()),
    ])
      .then(([courrielsJson, reponsesJson]) => {
        setCourriels(courrielsJson.courriels || [])
        setReponses(reponsesJson.reponses || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [benevoleId, refreshKey])

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>Chargement des courriels…</div>
  }

  if (courriels.length === 0 && reponses.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>Aucun courriel envoyé à ce réserviste</div>
      </div>
    )
  }

  // Fusionner courriels et réponses dans une timeline unifiée
  type TimelineItem =
    | { type: 'envoi'; data: Courriel; date: Date }
    | { type: 'reponse'; data: CourrielReponse; date: Date }

  const timeline: TimelineItem[] = [
    ...courriels.map(c => ({ type: 'envoi' as const, data: c, date: new Date(c.created_at) })),
    ...reponses.map(r => ({ type: 'reponse' as const, data: r, date: new Date(r.created_at) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  // Compter les réponses non lues
  const nonLues = reponses.filter(r => r.statut === 'recu').length

  return (
    <div>
      {/* Indicateur réponses non lues */}
      {nonLues > 0 && (
        <div style={{
          padding: '8px 14px', marginBottom: '10px', borderRadius: '8px',
          backgroundColor: '#fffbeb', border: '1px solid #fbbf24',
          fontSize: '13px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          📨 <strong>{nonLues}</strong> réponse{nonLues > 1 ? 's' : ''} non lue{nonLues > 1 ? 's' : ''}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {timeline.map(item => {
          if (item.type === 'envoi') {
            return <CourrielEnvoyeCard key={`e-${item.data.id}`} c={item.data} expandedId={expandedId} setExpandedId={setExpandedId} />
          } else {
            return <ReponseRecueCard key={`r-${item.data.id}`} r={item.data} expandedId={expandedId} setExpandedId={setExpandedId} />
          }
        })}
      </div>
    </div>
  )
}

// ── Carte courriel envoyé (existant, refactorisé en composant) ──
function CourrielEnvoyeCard({ c, expandedId, setExpandedId }: {
  c: Courriel; expandedId: string | null; setExpandedId: (id: string | null) => void
}) {
  const cfg = STATUT_CONFIG[c.statut] || STATUT_CONFIG.sent
  const date = new Date(c.created_at)
  const dateStr = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
  const isExpanded = expandedId === c.id
  const statutOrder = ['queued', 'sent', 'delivered', 'opened', 'clicked']
  const statutIdx = statutOrder.indexOf(c.statut)
  const isBad = c.statut === 'bounced' || c.statut === 'failed'

  return (
    <div
      style={{
        borderRadius: '10px',
        border: `1px solid ${isExpanded ? '#bfdbfe' : '#e2e8f0'}`,
        backgroundColor: isExpanded ? '#fafbff' : 'white',
        overflow: 'hidden',
        transition: 'all 0.15s',
      }}
    >
      <div
        onClick={() => setExpandedId(isExpanded ? null : c.id)}
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          cursor: 'pointer',
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
              backgroundColor: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {cfg.label}
            </span>
            {(c as any).campagne_id && (
              <span style={{
                fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                backgroundColor: '#f0fdf4', color: '#16a34a', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                📧 Campagne
              </span>
            )}
            {(c as any).has_reply && (
              <span style={{
                fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                backgroundColor: '#dbeafe', color: '#1e40af', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                💬 Répondu
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            <span>➡️ Envoyé — {c.from_name} — {dateStr} à {timeStr}</span>
            {c.ouvert_at && (
              <span style={{ color: '#2563eb' }}>
                👁️ Ouvert le {new Date(c.ouvert_at).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })} à {new Date(c.ouvert_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {c.clics_count > 0 && (
              <span style={{ color: '#1e40af' }}>
                🔗 {c.clics_count} clic{c.clics_count > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {!isBad && (
            <div style={{ display: 'flex', gap: '3px', marginTop: '6px' }}>
              {statutOrder.map((s, i) => (
                <div key={s} style={{
                  height: '3px', flex: 1, borderRadius: '2px',
                  backgroundColor: i <= statutIdx ? cfg.color : '#e2e8f0',
                  transition: 'background-color 0.2s',
                }} title={STATUT_CONFIG[s]?.label} />
              ))}
            </div>
          )}
        </div>
        <span style={{ fontSize: '14px', color: '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 14px 14px 42px' }}>
          {(c as any).pieces_jointes && (c as any).pieces_jointes.length > 0 && (
            <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(c as any).pieces_jointes.map((nom: string, i: number) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                  📎 {nom}
                </span>
              ))}
            </div>
          )}
          {c.body_html && (
            <>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Contenu du courriel
              </div>
              <div
                style={{
                  fontSize: '13px', color: '#374151', lineHeight: '1.6',
                  padding: '12px', backgroundColor: 'white', borderRadius: '8px',
                  border: '1px solid #e2e8f0', maxHeight: '300px', overflowY: 'auto',
                }}
                dangerouslySetInnerHTML={{ __html: c.body_html }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Carte réponse reçue (NOUVEAU) ──
function ReponseRecueCard({ r, expandedId, setExpandedId }: {
  r: CourrielReponse; expandedId: string | null; setExpandedId: (id: string | null) => void
}) {
  const cfg = REPONSE_STATUT[r.statut] || REPONSE_STATUT.recu
  const date = new Date(r.created_at)
  const dateStr = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
  const isExpanded = expandedId === `r-${r.id}`
  const isNonLu = r.statut === 'recu'

  return (
    <div
      style={{
        borderRadius: '10px',
        border: `1px solid ${isNonLu ? '#fbbf24' : isExpanded ? '#bfdbfe' : '#e2e8f0'}`,
        backgroundColor: isNonLu ? '#fffdf5' : isExpanded ? '#fafbff' : 'white',
        overflow: 'hidden',
        transition: 'all 0.15s',
      }}
    >
      <div
        onClick={() => setExpandedId(isExpanded ? null : `r-${r.id}`)}
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: '16px', lineHeight: 1, marginTop: '2px' }}>📨</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: isNonLu ? '700' : '600', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.subject || '(sans objet)'}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
              backgroundColor: '#dbeafe', color: '#1e40af', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              Réponse
            </span>
            <span style={{
              fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
              backgroundColor: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {cfg.label}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            ⬅️ Réponse de {r.from_name || r.from_email} — {dateStr} à {timeStr}
          </div>
        </div>
        <span style={{ fontSize: '14px', color: '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 14px 14px 42px' }}>
          {/* Pièces jointes */}
          {r.pieces_jointes && r.pieces_jointes.length > 0 && (
            <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {r.pieces_jointes.map((att: any, i: number) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                  📎 {att.filename || 'pièce jointe'}
                </span>
              ))}
            </div>
          )}

          {/* Contenu */}
          {(r.body_html || r.body_text) && (
            <>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Réponse du réserviste
              </div>
              <div
                style={{
                  fontSize: '13px', color: '#374151', lineHeight: '1.6',
                  padding: '12px', backgroundColor: 'white', borderRadius: '8px',
                  border: '1px solid #e2e8f0', maxHeight: '300px', overflowY: 'auto',
                  whiteSpace: r.body_html ? undefined : 'pre-wrap',
                }}
                dangerouslySetInnerHTML={r.body_html ? { __html: r.body_html } : undefined}
              >
                {!r.body_html ? r.body_text : undefined}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
