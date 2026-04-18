'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

const C = '#1e3a5f'
const RED = '#dc2626'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

interface Reserviste {
  benevole_id: string
  prenom: string
  nom: string
}

interface Props {
  sessionId: string
  onClose: () => void
  onCreated: () => void
}

function localInputToISO(local: string): string | null {
  if (!local) return null
  return new Date(local).toISOString()
}

export default function ManualCreateModal({ sessionId, onClose, onCreated }: Props) {
  const supabase = createClient()
  const [reservistes, setReservistes] = useState<Reserviste[]>([])
  const [benevoleId, setBenevoleId] = useState('')
  const [search, setSearch] = useState('')
  const [arrivee, setArrivee] = useState('')
  const [depart, setDepart] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom')
        .eq('statut', 'Actif')
        .order('nom')
      setReservistes((data || []) as Reserviste[])
    })()
  }, [])

  const filtered = reservistes.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.prenom.toLowerCase().includes(q) || r.nom.toLowerCase().includes(q)
  }).slice(0, 50)

  const create = async () => {
    setErr(null)
    if (!benevoleId) { setErr('Sélectionne un réserviste'); return }
    if (!arrivee) { setErr('Heure d\'arrivée requise'); return }
    if (!notes.trim()) { setErr('Une note est obligatoire (raison de la création manuelle)'); return }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/pointage/sessions/${sessionId}/pointages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: benevoleId,
          heure_arrivee: localInputToISO(arrivee),
          heure_depart: localInputToISO(depart),
          notes: notes.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error || 'Erreur'); setSubmitting(false); return }
      onCreated()
    } catch (e: any) {
      setErr(e.message || 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C, marginBottom: 18 }}>
          + Créer un pointage manuellement
        </h2>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Réserviste *</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher nom ou prénom…"
              style={inputStyle}
            />
            <select value={benevoleId} onChange={e => setBenevoleId(e.target.value)}
              style={{ ...inputStyle, marginTop: 6 }}
              size={5}
            >
              <option value="">— Choisir —</option>
              {filtered.map(r => (
                <option key={r.benevole_id} value={r.benevole_id}>
                  {r.prenom} {r.nom}
                </option>
              ))}
            </select>
            {search && filtered.length === 0 && (
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Aucun résultat</div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Arrivée *</label>
              <input type="datetime-local" value={arrivee} onChange={e => setArrivee(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Départ (optionnel)</label>
              <input type="datetime-local" value={depart} onChange={e => setDepart(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Raison * (obligatoire pour l'audit)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Ex: téléphone déchargé, oubli de scanner…"
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
            <button onClick={create} disabled={submitting}
              style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, backgroundColor: submitting ? '#9ca3af' : C, color: 'white', border: 'none', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Création…' : '✓ Créer le pointage'}
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
  width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
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
