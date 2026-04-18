'use client'

import { useState } from 'react'
import type { PointageRow } from './page'

const C = '#1e3a5f'
const RED = '#dc2626'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

interface Props {
  pointage: PointageRow
  onClose: () => void
  onSaved: () => void
}

// Conversion ISO UTC → "YYYY-MM-DDTHH:MM" local pour input[type=datetime-local]
function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Conversion local datetime-local → ISO UTC
function localInputToISO(local: string): string | null {
  if (!local) return null
  return new Date(local).toISOString()
}

export default function EditPointageModal({ pointage, onClose, onSaved }: Props) {
  const [arrivee, setArrivee] = useState(isoToLocalInput(pointage.heure_arrivee))
  const [depart, setDepart] = useState(isoToLocalInput(pointage.heure_depart))
  const [notes, setNotes] = useState(pointage.notes || '')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setSubmitting(true)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/pointage/pointages/${pointage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          heure_arrivee: localInputToISO(arrivee),
          heure_depart: localInputToISO(depart),
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error || 'Erreur'); setSubmitting(false); return }
      onSaved()
    } catch (e: any) {
      setErr(e.message || 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C, marginBottom: 4 }}>
          Modifier la présence
        </h2>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 18 }}>
          {pointage.reserviste_nom}
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Heure d'arrivée</label>
            <input type="datetime-local" value={arrivee} onChange={e => setArrivee(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Heure de départ</label>
            <input type="datetime-local" value={depart} onChange={e => setDepart(e.target.value)} style={inputStyle} />
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
              Vide = présence toujours en cours.
            </div>
          </div>
          <div>
            <label style={labelStyle}>Note</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Raison de la correction (ex: téléphone déchargé, oubli de scanner)"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {err && (
            <div style={{ padding: 10, borderRadius: 6, backgroundColor: '#fef2f2', color: RED, fontSize: 13 }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose}
              style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={save} disabled={submitting}
              style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, backgroundColor: submitting ? '#9ca3af' : C, color: 'white', border: 'none', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Enregistrement…' : '✓ Enregistrer'}
            </button>
          </div>
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
  width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
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
