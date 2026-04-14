
'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import HistoriqueCourriels from './HistoriqueCourriels'
import ModalComposeCourriel from './ModalComposeCourriel'

const C = '#1e3a5f'

interface NoteFichier {
  id: string
  nom_fichier: string
  storage_path: string
  taille?: number
  type_mime?: string
}

interface Note {
  id: string
  auteur_id: string
  auteur_nom: string
  contenu: string
  created_at: string
  fichiers?: NoteFichier[]
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
  isAdmin?: boolean
  onClose: () => void
}

type Onglet = 'courriels' | 'notes' | 'retraits' | 'historique'

interface RetraitEntry {
  id: string
  action: 'retrait' | 'reactivation'
  raison: string
  effectue_le: string
  effectue_par_email: string | null
  groupe_au_moment: string | null
}

interface AuditEntry {
  id: string
  action: 'insert' | 'update' | 'delete' | 'restore'
  field_name: string | null
  old_value: unknown
  new_value: unknown
  full_snapshot: Record<string, unknown> | null
  changed_by_email: string | null
  changed_at: string
}

// Libelles humains pour les champs techniques de la table reservistes
const CHAMP_LABELS: Record<string, string> = {
  groupe: 'Groupe',
  statut: 'Statut',
  prenom: 'Prénom',
  nom: 'Nom',
  email: 'Courriel',
  telephone: 'Téléphone',
  region: 'Région',
  role: 'Rôle',
  antecedents_judiciaires: 'Antécédents judiciaires',
  date_remboursement_bottes: 'Remboursement bottes',
  org_principale: 'Organisation principale',
  notes: 'Notes',
  adresse: 'Adresse',
  ville: 'Ville',
  code_postal: 'Code postal',
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return '∅ (vide)'
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function ModalReserviste({ reserviste, currentUserId, isAdmin, onClose }: Props) {
  const [onglet, setOnglet] = useState<Onglet>('courriels')
  const [notes, setNotes] = useState<Note[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [replySubject, setReplySubject] = useState<string | undefined>(undefined)
  const [isForwardMode, setIsForwardMode] = useState(false)
  const [forwardBody, setForwardBody] = useState('')
  const [historiqueRefreshKey, setHistoriqueRefreshKey] = useState(0)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [impersonating, setImpersonating] = useState(false)
  const [retraits, setRetraits] = useState<RetraitEntry[]>([])
  const [loadingRetraits, setLoadingRetraits] = useState(false)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const emprunterIdentite = async () => {
    if (!confirm(`Emprunter l'identité de ${reserviste.prenom} ${reserviste.nom} ?\n\nVous serez redirigé vers le portail en tant que cette personne.`)) return
    setImpersonating(true)
    try {
      const res = await fetch('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id: reserviste.benevole_id }),
      })
      const json = await res.json()
      if (json.success) {
        window.open('/', '_blank')
      } else {
        alert(json.error || 'Erreur lors de l\'emprunt d\'identité')
      }
    } catch {
      alert('Erreur réseau')
    }
    setImpersonating(false)
  }

  // Charger les notes quand on ouvre l'onglet + marquer comme lues
  useEffect(() => {
    if (onglet !== 'notes') return
    setLoadingNotes(true)
    fetch(`/api/admin/notes?benevole_id=${reserviste.benevole_id}`)
      .then(r => r.json())
      .then(json => {
        setNotes(json.notes || [])
        // Marquer les notes de ce réserviste comme lues
        fetch('/api/admin/notes/non-lues', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ benevole_id: reserviste.benevole_id }),
        })
          .then(r => r.json())
          .then(json => {
            if (typeof json.count === 'number') {
              window.dispatchEvent(new CustomEvent('notes-badge-update', { detail: { count: json.count } }))
            }
          })
          .catch(() => {})
      })
      .catch(() => {})
      .finally(() => setLoadingNotes(false))
  }, [onglet, reserviste.benevole_id])

  const ajouterNote = async () => {
    if (!newNote.trim() && pendingFiles.length === 0) return
    setSavingNote(true)
    try {
      // 1. Créer la note (texte)
      const contenu = newNote.trim() || `📎 ${pendingFiles.map(f => f.name).join(', ')}`
      const res = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id: reserviste.benevole_id, contenu }),
      })
      const json = await res.json()
      if (json.ok && json.note) {
        // 2. Upload des fichiers directement
        const fichiers: NoteFichier[] = []
        for (const file of pendingFiles) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('note_id', json.note.id)
          formData.append('nom_fichier', file.name)
          try {
            const fRes = await fetch('/api/admin/notes/fichiers/upload', {
              method: 'POST',
              body: formData,
            })
            const fJson = await fRes.json()
            if (fJson.ok && fJson.fichier) fichiers.push(fJson.fichier)
          } catch {}
        }

        setNotes(prev => [{ ...json.note, fichiers }, ...prev])
        setNewNote('')
        setPendingFiles([])
      }
    } catch {}
    setSavingNote(false)
  }

  const supprimerNote = async (noteId: string) => {
    if (!confirm('Supprimer cette note ?\n\nCette action est irréversible.')) return
    const res = await fetch(`/api/admin/notes?id=${noteId}`, { method: 'DELETE' })
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setPendingFiles(prev => [...prev, ...files])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / 1048576).toFixed(1)} Mo`
  }

  const onglets: { key: Onglet; label: string; icon: string }[] = [
    { key: 'courriels', label: 'Courriels', icon: '✉️' },
    { key: 'notes', label: 'Notes', icon: '📝' },
    ...(isAdmin ? [{ key: 'retraits' as const, label: 'Retraits', icon: '⏸️' }] : []),
    ...(isAdmin ? [{ key: 'historique' as const, label: 'Historique', icon: '🕓' }] : []),
  ]

  // Charger l'historique des retraits quand on ouvre l'onglet
  useEffect(() => {
    if (onglet !== 'retraits') return
    setLoadingRetraits(true)
    fetch(`/api/admin/reservistes/historique-retraits?benevole_id=${encodeURIComponent(reserviste.benevole_id)}`)
      .then(r => r.json())
      .then(json => setRetraits(json.entries || []))
      .catch(() => setRetraits([]))
      .finally(() => setLoadingRetraits(false))
  }, [onglet, reserviste.benevole_id])

  // Charger l'historique complet (audit_log) quand on ouvre l'onglet
  const chargerAudit = () => {
    setLoadingAudit(true)
    fetch(`/api/admin/reservistes/historique?benevole_id=${encodeURIComponent(reserviste.benevole_id)}`)
      .then(r => r.json())
      .then(json => setAudit(json.entries || []))
      .catch(() => setAudit([]))
      .finally(() => setLoadingAudit(false))
  }
  useEffect(() => {
    if (onglet !== 'historique') return
    chargerAudit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, reserviste.benevole_id])

  const [revertEnCours, setRevertEnCours] = useState<string | null>(null)

  // Pour chaque entree update, retrouver une entree plus recente sur le meme champ
  // dont le new_value correspond a l'old_value de celle-ci. Cela signifie qu'elle
  // a ete "annulee" (par revert OU par une modif manuelle qui remet l'ancienne valeur).
  const annulePar = useMemo(() => {
    const map: Record<string, { at: string; email: string | null }> = {}
    const eq = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
    // audit est trie du plus recent au plus ancien
    for (let i = audit.length - 1; i >= 0; i--) {
      const E = audit[i]
      if (E.action !== 'update' || !E.field_name) continue
      // Chercher une entree plus recente (index < i) sur le meme champ qui remet E.old_value
      for (let j = i - 1; j >= 0; j--) {
        const F = audit[j]
        if (F.action !== 'update' || F.field_name !== E.field_name) continue
        if (eq(F.new_value, E.old_value)) {
          map[E.id] = { at: F.changed_at, email: F.changed_by_email }
          break
        }
      }
    }
    return map
  }, [audit])
  const revert = async (auditId: string, fieldLabel: string, oldVal: unknown) => {
    if (!confirm(`Annuler cette modification ?\n\nLe champ "${fieldLabel}" va reprendre sa valeur precedente :\n${formatValue(oldVal)}`)) return
    setRevertEnCours(auditId)
    try {
      const res = await fetch('/api/admin/reservistes/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: auditId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      chargerAudit()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur')
    }
    setRevertEnCours(null)
  }

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .modal-res-header { flex-direction: column !important; align-items: flex-start !important; }
          .modal-res-actions { flex-wrap: wrap !important; width: 100% !important; margin-top: 8px !important; }
          .modal-res-info span { font-size: 12px !important; }
          .modal-res-close { position: absolute !important; top: 12px !important; right: 12px !important; }
          .modal-res-container { padding: 16px 16px 0 !important; position: relative !important; }
        }
      `}</style>
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '900px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

          {/* En-tête avec info réserviste */}
          <div className="modal-res-container" style={{ padding: '20px 24px 0', borderBottom: '1px solid #e2e8f0' }}>
            <div className="modal-res-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: C }}>
                  {reserviste.prenom} {reserviste.nom}
                </h2>
                <div className="modal-res-info" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#6b7280' }}>
                  {reserviste.email && <span>{reserviste.email}</span>}
                  {reserviste.telephone && <span>{reserviste.telephone}</span>}
                  {reserviste.region && <span>{reserviste.region}</span>}
                </div>
              </div>
              <div className="modal-res-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <a
                  href={`/profil?bid=${reserviste.benevole_id}&from=reservistes`}
                  target="_blank"
                  rel="noopener"
                  style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${C}`, backgroundColor: 'white', color: C, fontSize: '12px', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  Voir le profil
                </a>
                {isAdmin && (
                  <button
                    onClick={emprunterIdentite}
                    disabled={impersonating}
                    title={`Voir le portail en tant que ${reserviste.prenom} ${reserviste.nom}`}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d97706', backgroundColor: '#fffbeb', color: '#d97706', fontSize: '12px', fontWeight: '600', cursor: impersonating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: impersonating ? 0.6 : 1 }}
                  >
                    {impersonating ? '⏳' : '🎭'} Emprunt
                  </button>
                )}
                <button
                  onClick={() => setShowCompose(true)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#7c3aed', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  ✉️ Écrire
                </button>
                <button
                  onClick={() => setHistoriqueRefreshKey(k => k + 1)}
                  title="Rafraîchir l'historique"
                  style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b', fontSize: '14px', cursor: 'pointer', lineHeight: 1 }}
                >
                  🔄
                </button>
                <button
                  className="modal-res-close"
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
              <HistoriqueCourriels benevoleId={reserviste.benevole_id} refreshKey={historiqueRefreshKey} onReply={(subject) => { setReplySubject(subject.startsWith('Re: ') ? subject : `Re: ${subject}`); setIsForwardMode(false); setForwardBody(''); setShowCompose(true) }} onForward={(subject, bodyHtml) => { setReplySubject(subject.startsWith('Fwd: ') ? subject : `Fwd: ${subject}`); setIsForwardMode(true); setForwardBody(bodyHtml); setShowCompose(true) }} />
            )}

            {/* Onglet Notes */}
            {onglet === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Champ nouvelle note */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <textarea
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Ajouter une note interne..."
                      rows={2}
                      style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ajouterNote() } }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'flex-end' }}>
                      <button
                        onClick={ajouterNote}
                        disabled={savingNote || (!newNote.trim() && pendingFiles.length === 0)}
                        style={{
                          padding: '8px 16px', borderRadius: '8px', border: 'none',
                          backgroundColor: C, color: 'white', fontSize: '13px', fontWeight: '600',
                          cursor: (savingNote || (!newNote.trim() && pendingFiles.length === 0)) ? 'not-allowed' : 'pointer',
                          opacity: (savingNote || (!newNote.trim() && pendingFiles.length === 0)) ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {savingNote ? '...' : 'Ajouter'}
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db',
                          backgroundColor: 'white', color: '#64748b', fontSize: '12px',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                        title="Joindre un fichier"
                      >
                        📎 Fichier
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>

                  {/* Fichiers en attente */}
                  {pendingFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {pendingFiles.map((f, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '4px 10px', borderRadius: '8px',
                          backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
                          fontSize: '12px', color: '#475569',
                        }}>
                          📎 {f.name}
                          <span style={{ color: '#94a3b8' }}>({formatFileSize(f.size)})</span>
                          <button
                            onClick={() => removePendingFile(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                        {/* Fichiers attachés */}
                        {n.fichiers && n.fichiers.length > 0 && (
                          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {n.fichiers.map(f => (
                              <a
                                key={f.id}
                                href={`/api/admin/notes/fichiers/download?id=${f.id}`}
                                target="_blank"
                                rel="noopener"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  padding: '4px 10px', borderRadius: '8px',
                                  backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
                                  fontSize: '12px', color: '#1e40af', textDecoration: 'none',
                                }}
                              >
                                📎 {f.nom_fichier}
                                {f.taille && <span style={{ color: '#94a3b8' }}>({formatFileSize(f.taille)})</span>}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Onglet Retraits temporaires (admin/superadmin uniquement) */}
            {onglet === 'retraits' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {loadingRetraits ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '20px' }}>
                    Chargement…
                  </div>
                ) : retraits.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '20px' }}>
                    Aucun retrait temporaire enregistré pour ce réserviste.
                  </div>
                ) : (
                  retraits.map(e => {
                    const isRetrait = e.action === 'retrait'
                    const couleur = isRetrait ? '#d97706' : '#16a34a'
                    const bg = isRetrait ? '#fffbeb' : '#f0fdf4'
                    const icone = isRetrait ? '⏸️' : '▶️'
                    const label = isRetrait ? 'Mis en retrait temporaire' : 'Réactivé'
                    return (
                      <div key={e.id} style={{ backgroundColor: bg, borderLeft: `3px solid ${couleur}`, borderRadius: '6px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: couleur }}>
                            {icone} {label}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {new Date(e.effectue_le).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                          <strong>Raison :</strong> {e.raison}
                        </div>
                        {e.effectue_par_email && (
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            Par {e.effectue_par_email}
                            {e.groupe_au_moment && <> · groupe avant : {e.groupe_au_moment}</>}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Onglet Historique complet (audit_log, admin/superadmin uniquement) */}
            {onglet === 'historique' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Toutes les modifications de la fiche (rétention 6 mois). Les champs techniques sont masqués.
                </div>
                {loadingAudit ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '20px' }}>
                    Chargement…
                  </div>
                ) : audit.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '20px' }}>
                    Aucune modification enregistrée pour ce réserviste.
                  </div>
                ) : (
                  audit.map(e => {
                    const annule = annulePar[e.id]
                    let label: string
                    let couleur = '#1e3a5f'
                    let bg = '#f8fafc'
                    let icone = '✏️'
                    if (e.action === 'insert') {
                      label = 'Création de la fiche'
                      couleur = '#16a34a'; bg = '#f0fdf4'; icone = '➕'
                    } else if (e.action === 'delete') {
                      label = 'Suppression de la fiche'
                      couleur = '#dc2626'; bg = '#fef2f2'; icone = '🗑️'
                    } else if (e.action === 'restore') {
                      label = 'Restauration de la fiche'
                      couleur = '#2563eb'; bg = '#eff6ff'; icone = '↩️'
                    } else {
                      const champ = e.field_name ? (CHAMP_LABELS[e.field_name] || e.field_name) : 'champ'
                      label = `Modification : ${champ}`
                    }
                    return (
                      <div key={e.id} style={{ backgroundColor: annule ? '#f3f4f6' : bg, borderLeft: `3px solid ${annule ? '#9ca3af' : couleur}`, borderRadius: '6px', padding: '8px 12px', opacity: annule ? 0.75 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: annule ? '#6b7280' : couleur, textDecoration: annule ? 'line-through' : 'none' }}>
                            {icone} {label}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {new Date(e.changed_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        {e.action === 'update' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '12px', color: '#374151', fontFamily: 'monospace', flex: 1, minWidth: '0', wordBreak: 'break-word' }}>
                              <span style={{ color: '#dc2626' }}>{formatValue(e.old_value)}</span>
                              <span style={{ color: '#6b7280' }}> → </span>
                              <span style={{ color: '#16a34a' }}>{formatValue(e.new_value)}</span>
                            </div>
                            {annule ? (
                              <span
                                title={`Modification annulee le ${new Date(annule.at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}${annule.email ? ` par ${annule.email}` : ''}`}
                                style={{ padding: '3px 10px', backgroundColor: '#e5e7eb', color: '#6b7280', borderRadius: '4px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}
                              >
                                ✓ Annulée le {new Date(annule.at).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' })}
                              </span>
                            ) : e.field_name && !['benevole_id','user_id','created_at','updated_at','deleted_at','deleted_reason','deleted_by_user_id'].includes(e.field_name) && (
                              <button
                                onClick={() => revert(e.id, (e.field_name && CHAMP_LABELS[e.field_name]) || e.field_name || 'champ', e.old_value)}
                                disabled={revertEnCours === e.id}
                                title="Revenir a l'ancienne valeur"
                                style={{ padding: '3px 10px', backgroundColor: 'white', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', opacity: revertEnCours === e.id ? 0.5 : 1 }}
                              >
                                {revertEnCours === e.id ? '...' : '↶ Annuler'}
                              </button>
                            )}
                          </div>
                        )}
                        {e.changed_by_email && (
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            Par {e.changed_by_email}
                          </div>
                        )}
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
          destinataires={isForwardMode ? [] : [{ benevole_id: reserviste.benevole_id, email: reserviste.email, prenom: reserviste.prenom, nom: reserviste.nom }]}
          initialSubject={replySubject}
          isForward={isForwardMode}
          forwardBody={isForwardMode ? forwardBody : undefined}
          onClose={() => { setShowCompose(false); setReplySubject(undefined); setIsForwardMode(false); setForwardBody(''); setHistoriqueRefreshKey(k => k + 1) }}
        />
      )}
    </>
  )
}