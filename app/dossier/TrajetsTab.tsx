'use client'

// app/dossier/TrajetsTab.tsx
//
// Sous-composant pour l'onglet « Mes trajets » de la page /dossier.
// Affiche historique des trajets + cumul heures secondaires.

import { useEffect, useState } from 'react'

const C = '#1e3a5f'
const GREEN = '#16a34a'
const AMBER = '#d97706'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

interface Trajet {
  id: string
  type: 'aller' | 'retour'
  deployment_id: string | null
  camp_session_id: string | null
  heure_debut: string
  heure_fin: string | null
  duree_minutes: number | null
  covoiturage: boolean
  covoiturage_role: string | null
  covoiturage_with: string | null
  notes: string | null
  statut: string
}

export default function TrajetsTab() {
  const [loading, setLoading] = useState(true)
  const [trajets, setTrajets] = useState<Trajet[]>([])
  const [trajetOuvert, setTrajetOuvert] = useState<Trajet | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/trajets/mes-trajets?limit=200', { cache: 'no-store' })
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        setTrajets(data.trajets || [])
        setTrajetOuvert(data.trajet_ouvert || null)
      } catch {
        // ignore
      }
      setLoading(false)
    })()
  }, [])

  const totalMinutesApprouve = trajets
    .filter(t => t.statut === 'approuve' && t.duree_minutes !== null)
    .reduce((sum, t) => sum + (t.duree_minutes || 0), 0)
  const totalMinutesComplete = trajets
    .filter(t => (t.statut === 'complete' || t.statut === 'approuve') && t.duree_minutes !== null)
    .reduce((sum, t) => sum + (t.duree_minutes || 0), 0)

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: MUTED }}>Chargement des trajets…</div>
  }

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: 13, color: MUTED, marginBottom: 20 }}>
        {'Les heures de déplacement comptent comme '}
        <strong>heures secondaires</strong>
        {' pour le crédit d\'impôt QC.'}
      </p>

      {/* Cumul */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Approuvé" value={formatDuree(totalMinutesApprouve)} color={GREEN} bg="#dcfce7" />
        <StatCard label="En attente d'approbation" value={formatDuree(Math.max(0, totalMinutesComplete - totalMinutesApprouve))} color={AMBER} bg="#fef3c7" />
        <StatCard label="Total" value={formatDuree(totalMinutesComplete)} color={C} bg="#eff6ff" />
        <StatCard label="Nombre" value={String(trajets.length)} color="#6366f1" bg="#eef2ff" />
      </div>

      {trajetOuvert && (
        <div style={{ padding: 14, backgroundColor: '#fef3c7', border: `1px solid #fde68a`, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>⏱️ Trajet en cours</div>
          <div style={{ fontSize: 13, color: '#78350f', marginTop: 4 }}>
            Type : {trajetOuvert.type === 'aller' ? '🚗 Aller' : '🏠 Retour'} · Démarré à {new Date(trajetOuvert.heure_debut).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 12, color: '#92400e', marginTop: 6 }}>
            💡 Utilise le bouton dans la barre du haut pour confirmer ton arrivée.
          </div>
        </div>
      )}

      {/* Liste */}
      {trajets.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🚗</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C, marginBottom: 8 }}>
            Aucun trajet jusqu&apos;à maintenant
          </div>
          <div style={{ fontSize: 13, color: MUTED, maxWidth: 480, margin: '0 auto', lineHeight: 1.5 }}>
            Lors de ton prochain déploiement ou camp, tu pourras utiliser le bouton
            {' '}🚗{' '} dans la barre du haut pour <strong>traquer tes temps de déplacement</strong>
            {' '}entre chez toi et le site de bénévolat.
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 10, fontStyle: 'italic' }}>
            Ces heures comptent comme secondaires pour le crédit d&apos;impôt QC.
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Début</th>
                <th style={thStyle}>Fin</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Durée</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Covoit.</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Statut</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {trajets.map(t => (
                <tr key={t.id} style={{ borderTop: `1px solid ${BORDER}`, opacity: t.statut === 'annule' ? 0.5 : 1 }}>
                  <td style={tdStyle}>{t.type === 'aller' ? '🚗 Aller' : '🏠 Retour'}</td>
                  <td style={tdStyle}>{formatDateTime(t.heure_debut)}</td>
                  <td style={tdStyle}>{t.heure_fin ? formatDateTime(t.heure_fin) : <span style={{ color: AMBER, fontWeight: 600 }}>en cours</span>}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {t.duree_minutes !== null ? formatDuree(t.duree_minutes) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {t.covoiturage ? (
                      <span title={`${t.covoiturage_role || ''}${t.covoiturage_with ? ' avec ' + t.covoiturage_with : ''}`}>
                        {t.covoiturage_role === 'conducteur' ? '🚙' : '🧍'}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><StatutBadge statut={t.statut} /></td>
                  <td style={{ ...tdStyle, fontSize: 12, color: MUTED, maxWidth: 300 }}>{t.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────

function StatCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 10, backgroundColor: bg }}>
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    'en_cours': { label: '⏳ En cours', color: '#1d4ed8', bg: '#dbeafe' },
    'complete': { label: '✓ Complété', color: '#065f46', bg: '#d1fae5' },
    'approuve': { label: '👍 Approuvé', color: GREEN, bg: '#dcfce7' },
    'conteste': { label: '⚠ Contesté', color: AMBER, bg: '#fef3c7' },
    'annule':   { label: '✕ Annulé',   color: MUTED, bg: '#f1f5f9' },
  }
  const c = cfg[statut] || { label: statut, color: MUTED, bg: '#f1f5f9' }
  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  )
}

function formatDuree(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}min`
  return `${h}h${r.toString().padStart(2, '0')}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' }) +
         ' ' + d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED,
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em',
}

const tdStyle: React.CSSProperties = { padding: '10px 14px' }
