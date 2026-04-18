'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

const C = '#1e3a5f'
const GREEN = '#16a34a'
const AMBER = '#d97706'
const RED = '#dc2626'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

interface SessionInfo {
  id: string
  actif: boolean
  type_contexte: 'camp' | 'deploiement'
  contexte_nom: string
  contexte_dates: string | null
  contexte_lieu: string | null
  shift: 'jour' | 'nuit' | 'complet' | null
  date_shift: string | null
}

interface PointageInfo {
  id: string
  heure_arrivee: string | null
  heure_depart: string | null
  duree_minutes: number | null
  statut: string
}

interface Reserviste { prenom: string; nom: string }

interface AutreOuvert {
  id: string
  pointage_session_id: string
  heure_arrivee: string
  contexte_nom: string
}

type PunchState = 'aucun' | 'en_cours' | 'complete'

export default function PunchPage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params.token

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [pointage, setPointage] = useState<PointageInfo | null>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [autresOuverts, setAutresOuverts] = useState<AutreOuvert[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showCorrection, setShowCorrection] = useState<null | 'arrivee' | 'depart'>(null)
  const [correctionTime, setCorrectionTime] = useState('')
  const [confirmShort, setConfirmShort] = useState<null | { minutes: number; heureArrivee: string }>(null)

  // Charger l'état
  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/punch?token=${encodeURIComponent(token)}`)
      if (res.status === 401) {
        // Non connecté → redirect login avec retour
        router.push(`/login?redirect=${encodeURIComponent(`/punch/${token}`)}`)
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error || 'Erreur de chargement')
        setLoading(false)
        return
      }
      setSession(json.session)
      setPointage(json.pointage)
      setReserviste(json.reserviste)
      setAutresOuverts(json.autres_ouverts || [])
    } catch (e: any) {
      setErr(e.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (token) load() }, [token])

  const state: PunchState = !pointage
    ? 'aucun'
    : pointage.heure_arrivee && !pointage.heure_depart
      ? 'en_cours'
      : 'complete'

  // Action — extras peut contenir confirm_short:true ou close_others:true
  const action = async (actionType: string, customHeure?: string, extras?: Record<string, any>) => {
    setSubmitting(true)
    setErr(null)
    setSuccessMsg(null)
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: actionType, heure: customHeure, ...extras }),
      })
      const json = await res.json()
      if (!res.ok) {
        // Interception des erreurs spéciales pour afficher des UI adaptées
        if (json.error === 'short_duration') {
          setConfirmShort({ minutes: json.duree_minutes, heureArrivee: json.heure_arrivee })
          setSubmitting(false)
          return
        }
        if (json.error === 'open_elsewhere') {
          // Ce cas est normalement intercepté côté page par le bandeau —
          // mais on le gère aussi ici si l'API retourne cette erreur suite à un clic direct
          setAutresOuverts(json.autres || [])
          setErr(json.message || 'Tu as un pointage en cours sur un autre QR.')
          setSubmitting(false)
          return
        }
        setErr(json.error || 'Erreur')
        setSubmitting(false)
        return
      }
      const labels: Record<string, string> = {
        arrivee: '✓ Arrivée enregistrée',
        depart: '✓ Départ enregistré',
        nouvelle_entree: '✓ Nouvelle entrée créée',
        corriger_arrivee: '✓ Arrivée corrigée',
        corriger_depart: '✓ Départ corrigé',
      }
      setSuccessMsg(labels[actionType] || '✓ Enregistré')
      setShowCorrection(null)
      setCorrectionTime('')
      await load()
    } catch (e: any) {
      setErr(e.message || 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmCorrection = () => {
    if (!correctionTime) return
    // Construire un ISO — on garde la date du pointage existant, juste changer l'heure
    const basePoint = showCorrection === 'arrivee' ? pointage?.heure_arrivee : pointage?.heure_depart
    const baseDate = basePoint ? new Date(basePoint) : new Date()
    const [hh, mm] = correctionTime.split(':')
    baseDate.setHours(parseInt(hh), parseInt(mm), 0, 0)
    const iso = baseDate.toISOString()
    action(showCorrection === 'arrivee' ? 'corriger_arrivee' : 'corriger_depart', iso)
  }

  // ─── Rendu ────────────────────────────────────────────────────────────

  if (loading) {
    return <LoadingView />
  }

  if (err && !session) {
    return <ErrorView err={err} onBack={() => router.push('/')} />
  }

  if (session && !session.actif) {
    return <InactiveView session={session} onBack={() => router.push('/')} />
  }

  if (!session || !reserviste) return null

  return (
    <main style={containerStyle}>
      <div style={cardStyle}>
        <Header reserviste={reserviste} session={session} />

        {successMsg && (
          <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#d1fae5', color: GREEN, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
            {successMsg}
          </div>
        )}

        {err && (
          <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fef2f2', color: RED, marginBottom: 16, fontSize: 13 }}>
            {err}
          </div>
        )}

        {/* État actuel */}
        {state !== 'aucun' && pointage && (
          <CurrentPointageStatus pointage={pointage} state={state} />
        )}

        {/* Bandeau : autre pointage ouvert ailleurs — demande de fermeture */}
        {state === 'aucun' && autresOuverts.length > 0 && !showCorrection && !confirmShort && (
          <div style={{ padding: 14, borderRadius: 10, backgroundColor: '#fffbeb', border: `1px solid #fde68a`, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: AMBER, marginBottom: 6, fontSize: 14 }}>
              ⚠️ Tu as un pointage ouvert ailleurs
            </div>
            {autresOuverts.map(a => (
              <div key={a.id} style={{ fontSize: 13, color: '#78350f', marginBottom: 4 }}>
                • <strong>{a.contexte_nom}</strong> — ouvert à {formatTime(a.heure_arrivee)}
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 8, marginBottom: 10 }}>
              Tu veux fermer l'(les) autre(s) automatiquement avant de commencer ici ?
            </div>
            <button
              disabled={submitting}
              onClick={() => action('arrivee', undefined, { close_others: true })}
              style={{ ...bigBtn, backgroundColor: AMBER }}
            >
              ✓ Fermer les autres et commencer ici
            </button>
          </div>
        )}

        {/* Modal de confirmation : départ dans les 5 min après l'arrivée */}
        {confirmShort && (
          <div style={{ padding: 14, borderRadius: 10, backgroundColor: '#fef2f2', border: `1px solid #fecaca`, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: RED, marginBottom: 6, fontSize: 14 }}>
              ⏱️ Départ très rapide
            </div>
            <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 12 }}>
              Tu as pointé ton arrivée il y a seulement <strong>{confirmShort.minutes} minute(s)</strong>.
              Est-ce une fausse manœuvre ?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmShort(null)}
                style={{ flex: 1, ...bigBtn, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}` }}
              >
                Annuler (pas de départ)
              </button>
              <button
                disabled={submitting}
                onClick={() => { setConfirmShort(null); action('depart', undefined, { confirm_short: true }) }}
                style={{ flex: 1, ...bigBtn, backgroundColor: RED }}
              >
                Oui, terminer quand même
              </button>
            </div>
          </div>
        )}

        {/* Boutons selon l'état (masqués si bandeau autre-ouvert ou confirm-short actif) */}
        {!showCorrection && !confirmShort && !(state === 'aucun' && autresOuverts.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {state === 'aucun' && (
              <button disabled={submitting} onClick={() => action('arrivee')}
                style={{ ...bigBtn, backgroundColor: GREEN }}>
                ▶️ Commencer mon quart
              </button>
            )}
            {state === 'en_cours' && (
              <>
                <button disabled={submitting} onClick={() => action('depart')}
                  style={{ ...bigBtn, backgroundColor: RED }}>
                  ⏹️ Terminer mon quart
                </button>
                <button disabled={submitting} onClick={() => { setShowCorrection('arrivee'); setCorrectionTime(timeFromISO(pointage?.heure_arrivee)) }}
                  style={{ ...bigBtn, backgroundColor: 'white', color: C, border: `2px solid ${BORDER}` }}>
                  ✏️ Corriger l'heure d'arrivée
                </button>
              </>
            )}
            {state === 'complete' && (
              <>
                <button disabled={submitting} onClick={() => action('nouvelle_entree')}
                  style={{ ...bigBtn, backgroundColor: GREEN }}>
                  ➕ Nouvelle entrée (je reviens sur place)
                </button>
                <button disabled={submitting} onClick={() => { setShowCorrection('depart'); setCorrectionTime(timeFromISO(pointage?.heure_depart)) }}
                  style={{ ...bigBtn, backgroundColor: 'white', color: C, border: `2px solid ${BORDER}` }}>
                  ✏️ Corriger l'heure de départ
                </button>
              </>
            )}
          </div>
        )}

        {/* Formulaire de correction */}
        {showCorrection && (
          <div style={{ padding: 16, borderRadius: 10, backgroundColor: '#fffbeb', border: `1px solid #fde68a` }}>
            <div style={{ fontWeight: 700, color: AMBER, marginBottom: 10 }}>
              Corriger l'heure de {showCorrection === 'arrivee' ? "d'arrivée" : 'de départ'}
            </div>
            <input type="time" value={correctionTime}
              onChange={e => setCorrectionTime(e.target.value)}
              style={{ ...inputStyle, fontSize: 18, textAlign: 'center', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowCorrection(null); setCorrectionTime('') }}
                style={{ flex: 1, ...bigBtn, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}` }}>
                Annuler
              </button>
              <button disabled={!correctionTime || submitting} onClick={confirmCorrection}
                style={{ flex: 1, ...bigBtn, backgroundColor: AMBER, opacity: correctionTime ? 1 : 0.5 }}>
                Confirmer
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Retour au portail
          </button>
        </div>
      </div>
    </main>
  )
}

// ─── Sous-composants ────────────────────────────────────────────────────

function LoadingView() {
  return (
    <main style={containerStyle}>
      <div style={{ ...cardStyle, textAlign: 'center', padding: 60 }}>
        <div style={{ color: MUTED, fontSize: 14 }}>Chargement…</div>
      </div>
    </main>
  )
}

function ErrorView({ err, onBack }: { err: string; onBack: () => void }) {
  return (
    <main style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
          <div style={{ fontWeight: 700, color: C, fontSize: 18, marginBottom: 8 }}>QR invalide</div>
          <div style={{ color: MUTED, fontSize: 14, marginBottom: 20 }}>{err}</div>
          <button onClick={onBack} style={{ ...bigBtn, backgroundColor: C }}>
            Retour au portail
          </button>
        </div>
      </div>
    </main>
  )
}

function InactiveView({ session, onBack }: { session: SessionInfo; onBack: () => void }) {
  return (
    <main style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
          <div style={{ fontWeight: 700, color: C, fontSize: 18, marginBottom: 8 }}>QR désactivé</div>
          <div style={{ color: MUTED, fontSize: 14, marginBottom: 6 }}>
            Ce QR n'est plus actif pour « {session.contexte_nom} ».
          </div>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 20 }}>
            Contacte un admin si tu penses que c'est une erreur.
          </div>
          <button onClick={onBack} style={{ ...bigBtn, backgroundColor: C }}>
            Retour au portail
          </button>
        </div>
      </div>
    </main>
  )
}

function Header({ reserviste, session }: { reserviste: Reserviste; session: SessionInfo }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Pointage {session.type_contexte === 'camp' ? 'camp' : 'déploiement'}
      </div>
      <h1 style={{ margin: '4px 0 8px', fontSize: 22, fontWeight: 800, color: C }}>
        {session.contexte_nom}
      </h1>
      <div style={{ fontSize: 13, color: MUTED }}>
        {session.shift && <span>{labelShift(session.shift)}</span>}
        {session.date_shift && <span> · {formatDate(session.date_shift)}</span>}
        {session.contexte_lieu && <span> · 📍 {session.contexte_lieu}</span>}
      </div>
      <div style={{ marginTop: 14, padding: '10px 14px', backgroundColor: '#eff6ff', borderRadius: 8, fontSize: 14 }}>
        Bonjour <strong style={{ color: C }}>{reserviste.prenom} {reserviste.nom}</strong> 👋
      </div>
    </div>
  )
}

function CurrentPointageStatus({ pointage, state }: { pointage: PointageInfo; state: PunchState }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, backgroundColor: state === 'en_cours' ? '#f0fdf4' : '#f8fafc', border: `1px solid ${state === 'en_cours' ? '#bbf7d0' : BORDER}`, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
        {state === 'en_cours' ? '🔵 Pointage en cours' : '✓ Dernier pointage complété'}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
        <div>
          <span style={{ color: MUTED }}>Arrivée:</span>{' '}
          <strong style={{ color: C }}>{pointage.heure_arrivee ? formatTime(pointage.heure_arrivee) : '—'}</strong>
        </div>
        <div>
          <span style={{ color: MUTED }}>Départ:</span>{' '}
          <strong style={{ color: C }}>{pointage.heure_depart ? formatTime(pointage.heure_depart) : '—'}</strong>
        </div>
        {pointage.duree_minutes !== null && (
          <div>
            <span style={{ color: MUTED }}>Durée:</span>{' '}
            <strong style={{ color: C }}>{formatDuree(pointage.duree_minutes)}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

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

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
}

function timeFromISO(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDuree(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.floor(min % 60)
  if (h > 0) return `${h} h ${m.toString().padStart(2, '0')}`
  return `${m} min`
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh', backgroundColor: '#f1f5f9',
  padding: '20px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: 14, padding: '24px',
  width: '100%', maxWidth: 480, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  marginTop: 20,
}

const bigBtn: React.CSSProperties = {
  width: '100%', padding: '16px 20px', fontSize: 16, fontWeight: 700,
  color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: `1px solid ${BORDER}`, borderRadius: 8, outline: 'none',
}
