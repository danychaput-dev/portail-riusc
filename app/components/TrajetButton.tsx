'use client'

// app/components/TrajetButton.tsx
//
// Bouton intelligent dans le PortailHeader pour démarrer/clôturer un trajet
// (heures SECONDAIRES pour le crédit d'impôt QC).
//
// États affichés (icône visible dans le header) :
//   - 🚗 (aucun trajet ouvert) → modale « Je démarre un trajet »
//   - 🅿️ (aller en cours)     → modale « Je suis arrivé à destination »
//   - 🏠 (retour en cours)    → modale « Je suis rentré chez moi »
//
// Le bouton est caché s'il n'y a ni déploiement actif ni camp inscrit.

import { useState, useEffect, useCallback } from 'react'

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
  created_at: string
}

interface Deploiement {
  id: string
  nom: string
  lieu: string
  date_debut: string
  date_fin: string | null
}

interface Camp {
  session_id: string
  camp_nom: string | null
  camp_dates: string | null
  camp_lieu: string | null
}

export default function TrajetButton() {
  const [loading, setLoading] = useState(true)
  const [trajetOuvert, setTrajetOuvert] = useState<Trajet | null>(null)
  const [trajets, setTrajets] = useState<Trajet[]>([])
  const [deploiements, setDeploiements] = useState<Deploiement[]>([])
  const [camps, setCamps] = useState<Camp[]>([])
  const [showModal, setShowModal] = useState(false)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/trajets/mes-trajets?limit=20', { cache: 'no-store' })
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setTrajets(data.trajets || [])
      setTrajetOuvert(data.trajet_ouvert || null)
      setDeploiements(data.contextes?.deploiements || [])
      setCamps(data.contextes?.camps || [])
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
    const iv = setInterval(fetchState, 60_000) // poll 60s
    return () => clearInterval(iv)
  }, [fetchState])

  // Masqué si aucun contexte actif ET aucun trajet ouvert
  const hasContexte = deploiements.length > 0 || camps.length > 0
  if (loading) return null
  if (!hasContexte && !trajetOuvert) return null

  // Déterminer l'icône + titre selon l'état
  let icon = '🚗'
  let title = 'Démarrer un trajet'
  if (trajetOuvert?.type === 'aller') {
    icon = '🅿️'
    title = 'Je suis arrivé à destination'
  } else if (trajetOuvert?.type === 'retour') {
    icon = '🏠'
    title = 'Je suis rentré chez moi'
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title={title}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #d1d5db',
          backgroundColor: trajetOuvert ? '#fef3c7' : 'white',
          cursor: 'pointer', fontSize: 18, marginRight: 12,
          transition: 'all 0.15s',
        }}
        onMouseOver={e => e.currentTarget.style.backgroundColor = trajetOuvert ? '#fde68a' : '#f3f4f6'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = trajetOuvert ? '#fef3c7' : 'white'}
      >
        {icon}
      </button>

      {showModal && (
        <TrajetModal
          trajetOuvert={trajetOuvert}
          trajets={trajets}
          deploiements={deploiements}
          camps={camps}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchState() }}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Modale
// ═══════════════════════════════════════════════════════════════════════════

interface TrajetModalProps {
  trajetOuvert: Trajet | null
  trajets: Trajet[]
  deploiements: Deploiement[]
  camps: Camp[]
  onClose: () => void
  onSaved: () => void
}

function TrajetModal({ trajetOuvert, trajets, deploiements, camps, onClose, onSaved }: TrajetModalProps) {
  const mode: 'start' | 'close' = trajetOuvert ? 'close' : 'start'

  // Pour mode start : choix du contexte + type
  const contextes = [
    ...deploiements.map(d => ({
      key: `dep:${d.id}`, label: `🚨 ${d.nom}${d.lieu ? ' — ' + d.lieu : ''}`,
      deployment_id: d.id, camp_session_id: null as string | null,
    })),
    ...camps.map(c => ({
      key: `camp:${c.session_id}`, label: `🏕️ ${c.camp_nom || c.session_id}${c.camp_lieu ? ' — ' + c.camp_lieu : ''}`,
      deployment_id: null as string | null, camp_session_id: c.session_id,
    })),
  ]
  const [selectedContexteKey, setSelectedContexteKey] = useState<string>(contextes[0]?.key || '')

  // Déterminer le type par défaut : si trajets existent déjà pour ce contexte,
  // et qu'il y a un aller sans retour aujourd'hui → default = 'retour'
  // sinon → default = 'aller'
  const computeDefaultType = (ctxKey: string): 'aller' | 'retour' => {
    const ctx = contextes.find(c => c.key === ctxKey)
    if (!ctx) return 'aller'
    const trajetsCtx = trajets.filter(t =>
      (t.deployment_id && t.deployment_id === ctx.deployment_id) ||
      (t.camp_session_id && t.camp_session_id === ctx.camp_session_id)
    )
    const dernierAllerFini = trajetsCtx
      .filter(t => t.type === 'aller' && t.heure_fin)
      .sort((a, b) => new Date(b.heure_fin!).getTime() - new Date(a.heure_fin!).getTime())[0]
    if (!dernierAllerFini) return 'aller'
    const retourApres = trajetsCtx.find(t =>
      t.type === 'retour' && new Date(t.heure_debut).getTime() > new Date(dernierAllerFini.heure_fin!).getTime()
    )
    return retourApres ? 'aller' : 'retour'
  }
  const [type, setType] = useState<'aller' | 'retour'>(computeDefaultType(selectedContexteKey))

  // Quand le contexte change, recalculer le type par défaut
  useEffect(() => {
    setType(computeDefaultType(selectedContexteKey))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContexteKey])

  const [notes, setNotes] = useState('')
  const [covoit, setCovoit] = useState(false)
  const [covoitRole, setCovoitRole] = useState<'conducteur' | 'passager'>('passager')
  const [covoitWith, setCovoitWith] = useState('')
  // En mode close, permettre optionnellement d'éditer le covoit (exceptionnel, caché par défaut)
  const [editCovoitInClose, setEditCovoitInClose] = useState(false)

  // En mode close : pré-remplir avec les valeurs actuelles du trajet (utilisé seulement
  // si l'utilisateur ouvre l'édition de correction covoit)
  useEffect(() => {
    if (trajetOuvert) {
      setCovoit(trajetOuvert.covoiturage)
      setCovoitRole((trajetOuvert.covoiturage_role as any) || 'passager')
      setCovoitWith(trajetOuvert.covoiturage_with || '')
      setNotes('') // On ne pré-remplit PAS les notes — c'est une note d'arrivée additionnelle
    }
  }, [trajetOuvert])

  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Après clôture réussie, on affiche un récap avec la durée finale avant de fermer
  const [closedTrajet, setClosedTrajet] = useState<Trajet | null>(null)

  const submit = async () => {
    setErr(null)
    setSubmitting(true)
    try {
      if (mode === 'start') {
        const ctx = contextes.find(c => c.key === selectedContexteKey)
        if (!ctx) { setErr('Sélectionne un contexte'); setSubmitting(false); return }
        const body: any = {
          type,
          covoiturage: covoit,
          covoiturage_role: covoit ? covoitRole : null,
          covoiturage_with: covoit ? covoitWith.trim() : null,
          notes: notes.trim() || null,
        }
        if (ctx.deployment_id) body.deployment_id = ctx.deployment_id
        else body.camp_session_id = ctx.camp_session_id
        const res = await fetch('/api/trajets/debut', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) { setErr(json.error || 'Erreur'); setSubmitting(false); return }
      } else {
        // Fermer le trajet ouvert
        if (!trajetOuvert) return
        // Notes d'arrivée : on concatène avec les notes de départ si présentes
        let notesFinal: string | undefined
        const notesArrivee = notes.trim()
        if (notesArrivee) {
          notesFinal = trajetOuvert.notes
            ? `${trajetOuvert.notes}\n— Arrivée : ${notesArrivee}`
            : `Arrivée : ${notesArrivee}`
        }
        const body: any = {}
        if (notesFinal) body.notes = notesFinal
        // Envoyer le covoit SEULEMENT si l'utilisateur a ouvert l'édition de correction
        if (editCovoitInClose) {
          body.covoiturage = covoit
          body.covoiturage_role = covoit ? covoitRole : null
          body.covoiturage_with = covoit ? covoitWith.trim() : null
        }
        const res = await fetch(`/api/trajets/${trajetOuvert.id}/fin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) { setErr(json.error || 'Erreur'); setSubmitting(false); return }
        // Afficher l'écran de succès avec la durée avant de fermer
        if (json.trajet) {
          setClosedTrajet(json.trajet)
          setSubmitting(false)
          return
        }
      }
      onSaved()
    } catch (e: any) {
      setErr(e.message || 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  // Texte du bouton principal
  const primaryBtnText = (() => {
    if (mode === 'close') {
      return trajetOuvert?.type === 'aller' ? '🅿️ Confirmer mon arrivée' : '🏠 Confirmer mon retour'
    }
    return type === 'aller' ? '🚗 Je quitte pour le site' : '🚗 Je quitte le site'
  })()

  // Écran de succès après clôture
  if (closedTrajet) {
    const mins = closedTrajet.duree_minutes || 0
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>
              {closedTrajet.type === 'aller' ? '🅿️' : '🏠'}
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#16a34a', marginBottom: 8 }}>
              Trajet enregistré !
            </h2>
            <div style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>
              {closedTrajet.type === 'aller' ? 'Tu es arrivé à destination.' : 'Bon retour à la maison.'}
            </div>
            <div style={{ padding: 16, backgroundColor: '#f0fdf4', borderRadius: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⏱️ Durée du trajet
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                {formatDuree(mins)}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                Ajouté à tes heures secondaires (crédit d'impôt QC)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <a href="/profil?tab=trajets"
                style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, backgroundColor: 'white', color: '#1e3a5f', border: '1px solid #e5e7eb', borderRadius: 8, textDecoration: 'none', display: 'inline-block' }}>
                📋 Voir mes trajets
              </a>
              <button onClick={onSaved}
                style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>
          {mode === 'start' ? '🚗 Démarrer un trajet' : (trajetOuvert?.type === 'aller' ? '🅿️ Arrivée à destination' : '🏠 Retour chez moi')}
        </h2>

        {/* Sous-titre indicatif */}
        {mode === 'close' && trajetOuvert && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
            Trajet démarré à {new Date(trajetOuvert.heure_debut).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
            {' · '} Durée : {formatDuree((Date.now() - new Date(trajetOuvert.heure_debut).getTime()) / 60000)}
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Sélecteur de contexte (mode start uniquement, s'il y a plusieurs options) */}
          {mode === 'start' && contextes.length > 1 && (
            <div>
              <label style={labelStyle}>Contexte *</label>
              <select value={selectedContexteKey} onChange={e => setSelectedContexteKey(e.target.value)} style={inputStyle}>
                {contextes.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
          {mode === 'start' && contextes.length === 1 && (
            <div style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#374151' }}>
              Pour : <strong>{contextes[0].label}</strong>
            </div>
          )}

          {/* Type aller / retour (mode start uniquement) */}
          {mode === 'start' && (
            <div>
              <label style={labelStyle}>Type de trajet *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ ...radioCardStyle(type === 'aller') }}>
                  <input type="radio" name="type" value="aller" checked={type === 'aller'} onChange={() => setType('aller')} style={{ marginRight: 8 }} />
                  🚗 Aller (vers le site)
                </label>
                <label style={{ ...radioCardStyle(type === 'retour') }}>
                  <input type="radio" name="type" value="retour" checked={type === 'retour'} onChange={() => setType('retour')} style={{ marginRight: 8 }} />
                  🏠 Retour (vers la maison)
                </label>
              </div>
            </div>
          )}

          {/* Covoiturage — mode START : édition complète */}
          {mode === 'start' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={covoit} onChange={e => setCovoit(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>🧑‍🤝‍🧑 Covoiturage</span>
              </label>
              {covoit && (
                <div style={{ display: 'grid', gap: 8, marginTop: 10, marginLeft: 24 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ ...radioCardStyle(covoitRole === 'conducteur'), flex: 1 }}>
                      <input type="radio" name="covoit_role" checked={covoitRole === 'conducteur'} onChange={() => setCovoitRole('conducteur')} style={{ marginRight: 6 }} />
                      🚙 Conducteur
                    </label>
                    <label style={{ ...radioCardStyle(covoitRole === 'passager'), flex: 1 }}>
                      <input type="radio" name="covoit_role" checked={covoitRole === 'passager'} onChange={() => setCovoitRole('passager')} style={{ marginRight: 6 }} />
                      🧍 Passager
                    </label>
                  </div>
                  <input type="text" value={covoitWith} onChange={e => setCovoitWith(e.target.value)}
                    placeholder="Avec qui ? (ex: Marc Tremblay, Julie B.)"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          )}

          {/* Covoiturage — mode CLOSE : résumé en lecture seule + option d'édition */}
          {mode === 'close' && trajetOuvert && !editCovoitInClose && (
            <div style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span>
                {trajetOuvert.covoiturage
                  ? <>🧑‍🤝‍🧑 <strong>Covoiturage</strong> — {trajetOuvert.covoiturage_role === 'conducteur' ? '🚙 Conducteur' : '🧍 Passager'}{trajetOuvert.covoiturage_with ? ` avec ${trajetOuvert.covoiturage_with}` : ''}</>
                  : <>🧍 Pas de covoiturage</>
                }
              </span>
              <button onClick={() => setEditCovoitInClose(true)} style={{ padding: '4px 10px', fontSize: 11, backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}>
                ✏️ Corriger
              </button>
            </div>
          )}
          {mode === 'close' && editCovoitInClose && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={covoit} onChange={e => setCovoit(e.target.checked)} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>🧑‍🤝‍🧑 Covoiturage (correction)</span>
                </label>
                <button onClick={() => setEditCovoitInClose(false)} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Annuler correction</button>
              </div>
              {covoit && (
                <div style={{ display: 'grid', gap: 8, marginTop: 4, marginLeft: 24 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ ...radioCardStyle(covoitRole === 'conducteur'), flex: 1 }}>
                      <input type="radio" name="covoit_role" checked={covoitRole === 'conducteur'} onChange={() => setCovoitRole('conducteur')} style={{ marginRight: 6 }} />
                      🚙 Conducteur
                    </label>
                    <label style={{ ...radioCardStyle(covoitRole === 'passager'), flex: 1 }}>
                      <input type="radio" name="covoit_role" checked={covoitRole === 'passager'} onChange={() => setCovoitRole('passager')} style={{ marginRight: 6 }} />
                      🧍 Passager
                    </label>
                  </div>
                  <input type="text" value={covoitWith} onChange={e => setCovoitWith(e.target.value)}
                    placeholder="Avec qui ?"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          )}

          {/* Notes — le label change selon le contexte */}
          <div>
            <label style={labelStyle}>
              {mode === 'start' ? 'Notes (optionnel)' : 'Note d\'arrivée (optionnel)'}
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder={mode === 'start'
                ? 'Ex: Trafic important, pause souper en route…'
                : 'Ex: Arrivé 20min en retard, détour par la pharmacie…'}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            {mode === 'close' && trajetOuvert?.notes && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                💡 Note de départ : « {trajetOuvert.notes} »
              </div>
            )}
          </div>

          {err && (
            <div style={{ padding: 10, borderRadius: 6, backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 13 }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} disabled={submitting}
              style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              Annuler
            </button>
            <button onClick={submit} disabled={submitting}
              style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, backgroundColor: submitting ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Enregistrement…' : primaryBtnText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDuree(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h > 0 ? `${h}h${r.toString().padStart(2, '0')}` : `${r}min`
}

// ─── Styles ──────────────────────────────────────────────────────────

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
  display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 8,
  outline: 'none', color: '#1e293b', backgroundColor: 'white',
}

const radioCardStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, display: 'flex', alignItems: 'center', padding: '10px 14px',
  borderRadius: 8, fontSize: 13, fontWeight: 600,
  border: active ? '2px solid #1e3a5f' : '1px solid #e5e7eb',
  backgroundColor: active ? '#f0f4f8' : 'white',
  color: active ? '#1e3a5f' : '#374151',
  cursor: 'pointer', transition: 'all 0.15s',
})
