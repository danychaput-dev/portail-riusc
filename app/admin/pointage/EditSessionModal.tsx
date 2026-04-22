'use client'

// EditSessionModal — modifier titre / shift / date_shift d'un QR existant.
// Conditions d'usage : uniquement ouvert si la session n'a AUCUN pointage
// (bouton masque sur la page /admin/pointage des que total_pointages > 0).
// L'API /api/admin/pointage/sessions/[id] PATCH revalide cette regle cote
// serveur (409 si pointages existent).

import { useState } from 'react'

const C = '#1e3a5f'
const RED = '#dc2626'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

interface SessionLite {
  pointage_session_id: string
  contexte_nom: string
  titre: string | null
  shift: 'jour' | 'nuit' | 'complet' | null
  date_shift: string | null
}

interface Props {
  session: SessionLite
  onClose: () => void
  onSaved: () => void
}

export default function EditSessionModal({ session, onClose, onSaved }: Props) {
  const [titre, setTitre]       = useState<string>(session.titre || '')
  const [shift, setShift]       = useState<'' | 'jour' | 'nuit' | 'complet'>(session.shift || '')
  const [dateShift, setDateShift] = useState<string>(session.date_shift || '')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/pointage/sessions/${session.pointage_session_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: titre.trim() || null,
          shift: shift || null,
          date_shift: dateShift || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error || 'Erreur modification')
        setSubmitting(false)
        return
      }
      onSaved()
    } catch (e: any) {
      setErr(e.message || 'Erreur reseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C }}>✏️ Modifier le QR</h2>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
          {session.contexte_nom}
        </div>

        <div style={{ padding: 10, borderRadius: 6, backgroundColor: '#fffbeb', color: '#92400e', fontSize: 12, marginBottom: 14, border: '1px solid #fcd34d' }}>
          Modification possible tant qu'aucun pointage n'a ete enregistre. Le contexte (camp/deploiement) ne peut pas etre change.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Titre du QR</label>
              <input
                type="text"
                value={titre}
                onChange={e => setTitre(e.target.value)}
                style={inputStyle}
                placeholder="Ex: Equipe Alpha, Chef Marc, Zone Nord…"
                maxLength={80}
              />
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                Vide pour QR sans titre (unique pour ce contexte/shift/date).
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Shift</label>
                <select
                  value={shift}
                  onChange={e => setShift(e.target.value as any)}
                  style={inputStyle}
                >
                  <option value="">Aucun (QR unique pour le camp)</option>
                  <option value="jour">☀️ Jour</option>
                  <option value="nuit">🌙 Nuit</option>
                  <option value="complet">🕐 Complet (24h)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={dateShift}
                  onChange={e => setDateShift(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Vide = valide pour toute la duree.</div>
              </div>
            </div>

            {err && (
              <div style={{ padding: 10, borderRadius: 6, backgroundColor: '#fef2f2', color: RED, fontSize: 13 }}>
                {err}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={onClose}
                style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="submit" disabled={submitting}
                style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, backgroundColor: submitting ? '#9ca3af' : C, color: 'white', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Enregistrement…' : '✓ Enregistrer'}
              </button>
            </div>
          </div>
        </form>
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
  width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
}

const closeBtn: React.CSSProperties = {
  marginLeft: 'auto', background: 'none', border: 'none',
  fontSize: 28, cursor: 'pointer', color: MUTED, lineHeight: 1,
  padding: 0, width: 32, height: 32,
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: MUTED,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: `1px solid ${BORDER}`, borderRadius: 8,
  outline: 'none', color: '#1e293b', backgroundColor: 'white',
}
