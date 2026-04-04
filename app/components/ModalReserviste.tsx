'use client'

import { useEffect, useState } from 'react'
import HistoriqueCourriels from './HistoriqueCourriels'
import ModalComposeCourriel from './ModalComposeCourriel'

const C = '#1e3a5f'

interface Note {
  id: string
  auteur_id: string
  auteur_nom: string
  contenu: string
  created_at: string
}

interface Reserviste {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  telephone?: string
  groupe?: string
  region?: string
}

interface Props {
  reserviste: Reserviste
  currentUserId?: string
  onClose: () => void
}

type Onglet = 'courriels' | 'notes'

export default function ModalReserviste({ reserviste, currentUserId, onClose }: Props) {
  const [onglet, setOnglet] = useState<Onglet>('courriels')
  const [notes, setNotes] = useState<Note[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showCompose, setShowCompose] = useState(false)

  // Charger les notes quand on ouvre l'onglet
  useEffect(() => {
    if (onglet !== 'notes') return
    setLoadingNotes(true)
    fetch(`/api/admin/notes?benevole_id=${reserviste.benevole_id}`)
      .then(r => r.json())
      .then(json => setNotes(json.notes || []))
      .catch(() => {})
      .finally(() => setLoadingNotes(false))
  }, [onglet, reserviste.benevole_id])

  const ajouterNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id: reserviste.benevole_id, contenu: newNote }),
      })
      const json = await res.json()
      if (json.ok && json.note) {
        setNotes(prev => [json.note, ...prev])
        setNewNote('')
      }
    } catch {}
    setSavingNote(false)
  }

  const supprimerNote = async (noteId: string) => {
    const res = await fetch(`/api/admin/notes?id=${noteId}`, { method: 'DELETE' })
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  const onglets: { key: Onglet; label: string; icon: string }[] = [
    { key: 'courriels', label: 'Courriels', icon: '✉️' },
    { key: 'notes', label: 'Notes', icon: '📝' },
  ]

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '600px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

          {/* En-tête avec info réserviste */}
          <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: C }}>
                  {reserviste.prenom} {reserviste.nom}
                </h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#6b7280' }}>
                  {reserviste.email && <span>{reserviste.email}</span>}
                  {reserviste.telephone && <span>{reserviste.telephone}</span>}
                  {reserviste.region && <span>{reserviste.region}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <a
                  href={`/dossier?bid=${reserviste.benevole_id}`}
                  target="_blank"
                  rel="noopener"
                  style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${C}`, backgroundColor: 'white', color: C, fontSize: '12px', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  Voir le profil
                </a>
                <button
                  onClick={() => setShowCompose(true)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#7c3aed', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  ✉️ Écrire
                </button>
                <button
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: '4px' }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Onglets */}
            <div style={{ display: 'flex', gap: '0' }}>
              {onglets.map(o => (
                <button
                  key={o.key}
                  onClick={() => setOnglet(o.key)}
                  style={{
                    padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: '13px', fontWeight: '600',
                    color: onglet === o.key ? C : '#94a3b8',
                    borderBottom: onglet === o.key ? `2px solid ${C}` : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {o.icon} {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contenu onglet */}
          <div style={{ padding: '16px 24px 20px', overflowY: 'auto', flex: 1 }}>

            {/* Onglet Courriels */}
            {onglet === 'courriels' && (
              <HistoriqueCourriels benevoleId={reserviste.benevole_id} />
            )}

            {/* Onglet Notes */}
            {onglet === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Champ nouvelle note */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Ajouter une note interne..."
                    rows={2}
                    style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ajouterNote() } }}
                  />
                  <button
                    onClick={ajouterNote}
                    disabled={savingNote || !newNote.trim()}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      backgroundColor: C, color: 'white', fontSize: '13px', fontWeight: '600',
                      cursor: (savingNote || !newNote.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (savingNote || !newNote.trim()) ? 0.5 : 1,
                      alignSelf: 'flex-end', whiteSpace: 'nowrap',
                    }}
                  >
                    {savingNote ? '...' : 'Ajouter'}
                  </button>
                </div>

                {/* Liste des notes */}
                {loadingNotes ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>Chargement…</div>
                ) : notes.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>📋</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>Aucune note pour ce réserviste</div>
                  </div>
                ) : (
                  notes.map(n => {
                    const date = new Date(n.created_at)
                    const dateStr = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
                    const timeStr = date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
                    const isOwn = currentUserId && n.auteur_id === currentUserId

                    return (
                      <div key={n.id} style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fafafa' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: C }}>{n.auteur_nom}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{dateStr} à {timeStr}</span>
                            {isOwn && (
                              <button
                                onClick={() => supprimerNote(n.id)}
                                title="Supprimer ma note"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#d1d5db', padding: '0 2px' }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                          {n.contenu}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal composition courriel */}
      {showCompose && (
        <ModalComposeCourriel
          destinataires={[{ benevole_id: reserviste.benevole_id, email: reserviste.email, prenom: reserviste.prenom, nom: reserviste.nom }]}
          onClose={() => setShowCompose(false)}
        />
      )}
    </>
  )
}
