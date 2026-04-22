'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import QRCode from 'qrcode'
import CreateSessionModal from './CreateSessionModal'
import QRDisplayModal from './QRDisplayModal'

const C = '#1e3a5f'
const GREEN = '#16a34a'
const AMBER = '#d97706'
const RED = '#dc2626'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

// ─── Types ────────────────────────────────────────────────────────────────

interface Session {
  pointage_session_id: string
  type_contexte: 'camp' | 'deploiement'
  session_id: string
  contexte_nom: string
  contexte_lieu: string | null
  titre: string | null
  shift: 'jour' | 'nuit' | 'complet' | null
  date_shift: string | null
  actif: boolean
  approuveur_id: string | null
  approuveur_nom: string | null
  archived_at: string | null
  archived_by: string | null
  total_pointages: number
  nb_en_cours: number
  nb_complets: number
  nb_approuves: number
  nb_contestes: number
  duree_moyenne_minutes: number | null
  token: string | null
  url: string | null
  created_at: string | null
}

interface CampOption {
  session_id: string
  camp_nom: string
  camp_dates: string
  camp_lieu: string
}

interface Approuveur {
  benevole_id: string
  prenom: string
  nom: string
  role: string
}

// ─── Page ────────────────────────────────────────────────────────────────

type OngletPointage = 'actives' | 'archives'

export default function PointagePage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [qrModal, setQrModal] = useState<{ url: string; dataUrl: string; session: Session } | null>(null)
  const [onglet, setOnglet] = useState<OngletPointage>('actives')

  // Chargement initial
  const loadSessions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/pointage/sessions')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
      setSessions(json.sessions || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSessions() }, [])

  // Filtrer par onglet + trier
  const { actives, archivees, sorted } = useMemo(() => {
    const actives = sessions.filter(s => !s.archived_at)
    const archivees = sessions.filter(s => !!s.archived_at)
    const cible = onglet === 'archives' ? archivees : actives
    const sorted = [...cible].sort((a, b) => {
      if (a.actif !== b.actif) return a.actif ? -1 : 1
      const da = a.date_shift || a.created_at || ''
      const db = b.date_shift || b.created_at || ''
      return db.localeCompare(da)
    })
    return { actives, archivees, sorted }
  }, [sessions, onglet])

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleCreated = async (url: string, session: Session) => {
    // Générer le PNG du QR
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: 'M' })
      setQrModal({ url, dataUrl, session })
    } catch (e) {
      console.error('QR generation failed:', e)
      setQrModal({ url, dataUrl: '', session })
    }
    setModalOpen(false)
    await loadSessions()
  }

  const viewQR = async (s: Session) => {
    if (!s.url || !s.token) return
    try {
      const dataUrl = await QRCode.toDataURL(s.url, { width: 512, margin: 2, errorCorrectionLevel: 'M' })
      setQrModal({ url: s.url, dataUrl, session: s })
    } catch (e) {
      console.error('QR display failed:', e)
    }
  }

  const toggleActif = async (s: Session) => {
    const res = await fetch(`/api/admin/pointage/sessions/${s.pointage_session_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !s.actif }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert('Erreur : ' + (json.error || 'statut ' + res.status))
      return
    }
    await loadSessions()
  }

  const toggleArchive = async (s: Session) => {
    const archiver = !s.archived_at
    if (archiver && s.total_pointages > 0) {
      const ok = confirm(`Archiver "${s.contexte_nom}" ? (${s.total_pointages} pointage${s.total_pointages > 1 ? 's' : ''} conserve${s.total_pointages > 1 ? 's' : ''}. Reversible.)`)
      if (!ok) return
    }
    const res = await fetch(`/api/admin/pointage/sessions/${s.pointage_session_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: archiver }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert('Erreur : ' + (json.error || 'statut ' + res.status))
      return
    }
    await loadSessions()
  }

  const deleteSession = async (s: Session) => {
    const msg = s.total_pointages > 0
      ? `SUPPRIMER DEFINITIVEMENT "${s.contexte_nom}" et ses ${s.total_pointages} pointage(s) ?\n\nCette action est IRREVERSIBLE. Les logs d'audit seront aussi supprimes.\n\nAstuce: "Archiver" permet de cacher sans supprimer.`
      : `Supprimer definitivement "${s.contexte_nom}" ?\n\n(Aucun pointage associe, suppression simple.)`
    if (!confirm(msg)) return
    const res = await fetch(`/api/admin/pointage/sessions/${s.pointage_session_id}`, {
      method: 'DELETE',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert('Erreur : ' + (json.error || 'statut ' + res.status))
      return
    }
    const d = json.deleted
    if (d) alert(`Supprime : session + ${d.nb_pointages} pointage(s) + ${d.nb_logs} log(s).`)
    await loadSessions()
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C }}>📋 Présences</h1>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
            Générer et suivre les QR codes de capture des présences par camp (et déploiement bientôt).
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            marginLeft: 'auto',
            padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            backgroundColor: C, color: 'white', border: 'none', cursor: 'pointer',
          }}
        >
          + Nouveau QR
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fef2f2', color: RED, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: `2px solid ${BORDER}` }}>
        {([
          { key: 'actives',  label: `Actives (${actives.length})` },
          { key: 'archives', label: `🗄️ Archives (${archivees.length})` },
        ] as const).map(o => (
          <button key={o.key} onClick={() => setOnglet(o.key)}
            style={{
              padding: '10px 18px', fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
              backgroundColor: onglet === o.key ? 'white' : 'transparent',
              color: onglet === o.key ? C : '#94a3b8',
              borderBottom: onglet === o.key ? `2px solid ${C}` : '2px solid transparent',
              marginBottom: '-2px',
            }}>
            {o.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: MUTED, fontSize: 14 }}>Chargement…</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: MUTED, fontSize: 14, backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}` }}>
          {onglet === 'archives'
            ? 'Aucune session archivee.'
            : 'Aucun QR de présence créé. Clique sur « + Nouveau QR » pour en créer un.'}
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={thStyle}>Contexte</th>
                <th style={thStyle}>Shift / Date</th>
                <th style={thStyle}>Approuveur</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Pointages</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Statut</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.pointage_session_id} style={{ borderTop: `1px solid ${BORDER}`, opacity: s.actif ? 1 : 0.55 }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: C }}>{s.contexte_nom}</div>
                    {s.titre && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginTop: 2 }}>
                        🏷️ {s.titre}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        backgroundColor: s.type_contexte === 'camp' ? '#dbeafe' : '#fef3c7',
                        color: s.type_contexte === 'camp' ? C : AMBER,
                      }}>
                        {s.type_contexte === 'camp' ? '🏕️ Camp' : '🚨 Déploiement'}
                      </span>
                      {s.contexte_lieu && <span style={{ marginLeft: 6 }}>📍 {s.contexte_lieu}</span>}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {s.shift ? <span style={{ fontWeight: 600 }}>{labelShift(s.shift)}</span> : <span style={{ color: MUTED }}>—</span>}
                    {s.date_shift && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{formatDate(s.date_shift)}</div>}
                  </td>
                  <td style={tdStyle}>
                    {s.approuveur_nom || <span style={{ color: MUTED }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C }}>{s.total_pointages}</div>
                    {s.total_pointages > 0 && (
                      <div style={{ fontSize: 10, color: MUTED }}>
                        {s.nb_en_cours}🔵 {s.nb_complets}✓ {s.nb_approuves}👍 {s.nb_contestes > 0 ? `${s.nb_contestes}⚠` : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      backgroundColor: s.actif ? '#d1fae5' : '#f1f5f9',
                      color: s.actif ? GREEN : MUTED,
                    }}>
                      {s.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <a href={`/admin/pointage/${s.pointage_session_id}`}
                      title="Voir les pointages + actions"
                      style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-block' }}>
                      📋 Détails
                    </a>
                    <button onClick={() => viewQR(s)} title="Voir le QR"
                      style={{ ...btnSecondary, marginLeft: 6 }}>
                      Voir QR
                    </button>
                    {!s.archived_at && (
                      <button onClick={() => toggleActif(s)} title={s.actif ? 'Désactiver' : 'Réactiver'}
                        style={{ ...btnSecondary, marginLeft: 6, color: s.actif ? RED : GREEN, borderColor: s.actif ? RED : GREEN }}>
                        {s.actif ? 'Désactiver' : 'Réactiver'}
                      </button>
                    )}
                    <button onClick={() => toggleArchive(s)} title={s.archived_at ? 'Desarchiver' : 'Archiver (reversible)'}
                      style={{ ...btnSecondary, marginLeft: 6 }}>
                      {s.archived_at ? '↩ Désarchiver' : '🗄️ Archiver'}
                    </button>
                    <button onClick={() => deleteSession(s)} title="Supprimer definitivement (admin/superadmin uniquement)"
                      style={{ ...btnSecondary, marginLeft: 6, color: RED, borderColor: RED }}>
                      🗑️ Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <CreateSessionModal
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {qrModal && (
        <QRDisplayModal
          url={qrModal.url}
          dataUrl={qrModal.dataUrl}
          session={qrModal.session}
          onClose={() => setQrModal(null)}
        />
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: MUTED,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: `2px solid ${BORDER}`,
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px', verticalAlign: 'top',
}

const btnSecondary: React.CSSProperties = {
  padding: '4px 10px', fontSize: 11, fontWeight: 600,
  backgroundColor: 'white', color: C, border: `1px solid ${BORDER}`,
  borderRadius: 6, cursor: 'pointer',
}

function labelShift(shift: string): string {
  if (shift === 'jour') return '☀️ Jour'
  if (shift === 'nuit') return '🌙 Nuit'
  if (shift === 'complet') return '🕐 Complet'
  return shift
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}
