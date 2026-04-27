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
  const [confirmWrongDate, setConfirmWrongDate] = useState<null | { qrDate: string; today: string; actionType: string }>(null)

  // Mode "appareil partagé" ou "prêter son cell":
  //   - needsEmail: afficher le formulaire d'entrée de courriel
  //   - emailInput: ce qui est tapé dans le form
  //   - email: courriel validé utilisé pour toutes les requêtes API suivantes
  //   - needsConfirm: après lookup, afficher l'écran "C'est bien X Y?" avant d'activer le punch
  const [needsEmail, setNeedsEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [email, setEmail] = useState('')
  const [needsConfirm, setNeedsConfirm] = useState(false)
  // Le back nous dit si le rôle de l'utilisateur connecté permet de prêter son cell
  // (seuls admin, superadmin, partenaire peuvent pointer pour un collègue)
  const [peutPreterCell, setPeutPreterCell] = useState(false)

  // Charger l'état
  const load = async (emailParam?: string) => {
    setLoading(true)
    setErr(null)
    try {
      const usedEmail = emailParam !== undefined ? emailParam : email
      const url = usedEmail
        ? `/api/punch?token=${encodeURIComponent(token)}&email=${encodeURIComponent(usedEmail)}`
        : `/api/punch?token=${encodeURIComponent(token)}`
      const res = await fetch(url)
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) {
        // Pas de session → redirect vers login. Le mode email n'est JAMAIS accessible
        // sans session (protection contre l'abus: on ne veut pas que n'importe qui
        // puisse créer des punches pour des collègues via leur courriel).
        router.push(`/login?redirect=${encodeURIComponent(`/punch/${token}`)}`)
        return
      }
      if (res.status === 403 && json.session_required) {
        // Session expirée pendant le mode prêt → retour au form email mais avec warning
        setErr(json.error || 'Session requise pour prêter le cellulaire.')
        setEmail('')
        setLoading(false)
        router.push(`/login?redirect=${encodeURIComponent(`/punch/${token}`)}`)
        return
      }
      if (res.status === 404 && usedEmail) {
        // Email introuvable dans reservistes
        setErr(json.error || 'Ce courriel ne correspond à aucun réserviste. Vérifie l\'orthographe.')
        setEmail('')
        setNeedsEmail(true)
        setLoading(false)
        return
      }
      if (!res.ok) {
        setErr(json.error || 'Erreur de chargement')
        setLoading(false)
        return
      }
      // Si on arrive ici avec un email validé, on le persiste et on demande confirmation visuelle
      if (usedEmail && usedEmail !== email) {
        setEmail(usedEmail)
        setNeedsConfirm(true) // écran "C'est bien X Y?" avant de révéler les boutons punch
      }
      setNeedsEmail(false)
      setSession(json.session)
      setPointage(json.pointage)
      setReserviste(json.reserviste)
      setAutresOuverts(json.autres_ouverts || [])
      setPeutPreterCell(json.peut_preter_cell === true)
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
        body: JSON.stringify({ token, action: actionType, heure: customHeure, email: email || undefined, ...extras }),
      })
      const json = await res.json()
      if (!res.ok) {
        // Interception des erreurs spéciales pour afficher des UI adaptées
        if (json.error === 'short_duration') {
          setConfirmShort({ minutes: json.duree_minutes, heureArrivee: json.heure_arrivee })
          setSubmitting(false)
          return
        }
        if (json.error === 'wrong_date') {
          setConfirmWrongDate({ qrDate: json.qr_date, today: json.today, actionType })
          setSubmitting(false)
          return
        }
        if (json.error === 'open_elsewhere') {
          // Ce cas est normalement intercepté côté page par le bandeau —
          // mais on le gère aussi ici si l'API retourne cette erreur suite à un clic direct
          setAutresOuverts(json.autres || [])
          setErr(json.message || 'Tu as une présence en cours sur un autre QR.')
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

  // Mode appareil partagé : personne pas connectée → demander l'email du réserviste
  // OU mode "prêter son cell" : user connecté mais veut pointer pour quelqu'un d'autre
  if (needsEmail) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const v = emailInput.trim().toLowerCase()
      if (!v || !v.includes('@')) { setErr('Courriel invalide'); return }
      setErr(null)
      load(v)
    }
    const isLendMode = !!reserviste // déjà connecté → mode "prêter mon cell"
    return (
      <main style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>{isLendMode ? '🔄' : '📱'}</div>
            <h1 style={{ margin: 0, color: C, fontSize: 20 }}>
              {isLendMode ? 'Prêter mon cellulaire' : 'Pointage via courriel'}
            </h1>
            <p style={{ margin: '8px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
              {isLendMode
                ? 'Entre le courriel du collègue qui va pointer depuis ton cellulaire.'
                : "Tu n'as pas ton cellulaire? Entre ton courriel pour pointer depuis cet appareil."}
            </p>
          </div>
          {err && (
            <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fef2f2', color: RED, marginBottom: 16, fontSize: 13 }}>
              {err}
            </div>
          )}
          <form onSubmit={submit}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C, marginBottom: 6 }}>
              {isLendMode ? 'Courriel du collègue' : 'Ton courriel'}
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="ton.courriel@exemple.ca"
              autoComplete="email"
              autoFocus
              style={{
                width: '100%', padding: '14px 16px', fontSize: 16,
                border: `2px solid ${BORDER}`, borderRadius: 10, marginBottom: 14,
                boxSizing: 'border-box', color: '#1e293b',
              }}
            />
            <button type="submit" disabled={!emailInput.trim()} style={{
              ...bigBtn, backgroundColor: !emailInput.trim() ? '#cbd5e1' : C,
              cursor: !emailInput.trim() ? 'not-allowed' : 'pointer',
            }}>
              Continuer →
            </button>
          </form>
          <div style={{ marginTop: 20, padding: 12, borderRadius: 8, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
            {isLendMode ? (
              <>💡 <strong>Prêt du cellulaire:</strong> ton compte reste connecté en arrière-plan. Le punch sera enregistré pour le collègue, pas pour toi. Tu pourras revenir à ton propre punch après.</>
            ) : (
              <>💡 <strong>Appareil partagé:</strong> n'importe qui peut utiliser cet appareil pour pointer. Le coordonnateur sur place vérifie visuellement l'identité.</>
            )}
          </div>
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            {isLendMode ? (
              <button
                type="button"
                onClick={() => { setNeedsEmail(false); setEmailInput(''); setErr(null) }}
                style={{ background: 'none', border: 'none', fontSize: 12, color: MUTED, textDecoration: 'underline', cursor: 'pointer' }}>
                Annuler · retourner à mon punch
              </button>
            ) : (
              <a href={`/login?redirect=${encodeURIComponent(`/punch/${token}`)}`} style={{ fontSize: 12, color: MUTED, textDecoration: 'underline' }}>
                Se connecter avec son compte
              </a>
            )}
          </div>
        </div>
      </main>
    )
  }

  if (err && !session) {
    return <ErrorView err={err} onBack={() => router.push('/')} />
  }

  if (session && !session.actif) {
    return <InactiveView session={session} onBack={() => router.push('/')} />
  }

  if (!session || !reserviste) return null

  // Écran de confirmation avant de pointer pour quelqu'un d'autre via email
  if (needsConfirm && email) {
    return (
      <main style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>👋</div>
            <h1 style={{ margin: 0, color: C, fontSize: 22 }}>Confirmation d'identité</h1>
          </div>
          <div style={{ padding: 20, backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#1e40af', marginBottom: 8, fontWeight: 600 }}>Êtes-vous bien:</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C, marginBottom: 4 }}>
              {reserviste.prenom} {reserviste.nom}
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>{email}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                // Non, pas la bonne personne → retour au formulaire email
                setEmail('')
                setEmailInput('')
                setNeedsConfirm(false)
                setReserviste(null)
                setNeedsEmail(true)
              }}
              style={{ flex: 1, ...bigBtn, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}` }}>
              Non, ce n'est pas moi
            </button>
            <button
              onClick={() => {
                // Oui, c'est bien moi → activer le mode punch
                setNeedsConfirm(false)
              }}
              style={{ flex: 2, ...bigBtn, backgroundColor: GREEN }}>
              ✓ Oui, c'est moi
            </button>
          </div>
          <div style={{ marginTop: 16, padding: 10, backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#92400e', textAlign: 'center' }}>
            💡 En confirmant, tu pointeras pour <strong>{reserviste.prenom} {reserviste.nom}</strong>, pas pour le propriétaire de ce cellulaire.
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={containerStyle}>
      <div style={cardStyle}>
        <Header reserviste={reserviste} session={session} />
        {email ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#92400e' }}>
            <span>
              📱 <strong>Mode prêt · </strong> tu pointes pour <strong>{reserviste.prenom} {reserviste.nom}</strong> ({email})
            </span>
            <button
              type="button"
              onClick={() => {
                // Revenir au mode session (mes propres heures). Clear email et recharge.
                setEmail('')
                setEmailInput('')
                load('')
              }}
              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #f59e0b', borderRadius: 6, backgroundColor: 'white', color: '#92400e', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Revenir à moi
            </button>
          </div>
        ) : peutPreterCell ? (
          // Option "prêter le cell" : visible seulement pour admin, superadmin et partenaire.
          // Les simples reservistes ne voient pas ce bouton (évite falsification d'heures
          // entre collègues - seuls les rôles de supervision peuvent prêter).
          <div style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: 8, marginBottom: 14, fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>Quelqu'un sans cell veut pointer? Prête-lui le tien.</span>
            <button
              type="button"
              onClick={() => setNeedsEmail(true)}
              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #94a3b8', borderRadius: 6, backgroundColor: 'white', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔄 Prêter mon cell
            </button>
          </div>
        ) : null}

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

        {/* Bandeau : pointage ouvert ailleurs — TOUJOURS visible si autres_ouverts > 0 */}
        {autresOuverts.length > 0 && !showCorrection && !confirmShort && !confirmWrongDate && (
          <div style={{ padding: 14, borderRadius: 10, backgroundColor: '#fffbeb', border: `1px solid #fde68a`, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: AMBER, marginBottom: 6, fontSize: 14 }}>
              ⚠️ Tu as une présence ouverte ailleurs
            </div>
            {autresOuverts.map(a => (
              <div key={a.id} style={{ fontSize: 13, color: '#78350f', marginBottom: 4 }}>
                • <strong>{a.contexte_nom}</strong> — ouvert à {formatTime(a.heure_arrivee)}
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 8, marginBottom: 10 }}>
              {state === 'aucun'
                ? "Tu veux fermer l'(les) autre(s) automatiquement avant de commencer ici ?"
                : state === 'complete'
                  ? "Tu peux fermer l'(les) autre(s) automatiquement avant de créer une nouvelle entrée ici."
                  : "Ta présence sur ce QR est aussi ouverte. Termine l'une des deux."}
            </div>
            {state === 'aucun' && (
              <button
                disabled={submitting}
                onClick={() => action('arrivee', undefined, { close_others: true })}
                style={{ ...bigBtn, backgroundColor: AMBER }}
              >
                ✓ Fermer les autres et commencer ici
              </button>
            )}
            {state === 'complete' && (
              <button
                disabled={submitting}
                onClick={() => action('nouvelle_entree', undefined, { close_others: true })}
                style={{ ...bigBtn, backgroundColor: AMBER }}
              >
                ✓ Fermer les autres et nouvelle entrée ici
              </button>
            )}
          </div>
        )}

        {/* Modal de confirmation : date du QR ne correspond pas à aujourd'hui */}
        {confirmWrongDate && (
          <div style={{ padding: 14, borderRadius: 10, backgroundColor: '#fef2f2', border: `1px solid #fecaca`, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: RED, marginBottom: 6, fontSize: 14 }}>
              📅 Date incorrecte
            </div>
            <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 12 }}>
              Ce QR est prévu pour le <strong>{formatDate(confirmWrongDate.qrDate)}</strong>, mais aujourd'hui on est le <strong>{formatDate(confirmWrongDate.today)}</strong>.
              <br/>Scanne plutôt le QR de la bonne date, ou continue seulement si c'est intentionnel (ex: quart de nuit qui déborde).
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmWrongDate(null)}
                style={{ flex: 1, ...bigBtn, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}` }}
              >
                Annuler
              </button>
              <button
                disabled={submitting}
                onClick={() => { const t = confirmWrongDate.actionType; setConfirmWrongDate(null); action(t, undefined, { confirm_wrong_date: true }) }}
                style={{ flex: 1, ...bigBtn, backgroundColor: RED }}
              >
                Continuer quand même
              </button>
            </div>
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
              Est-ce une fausse manœuvre, ou as-tu scanné le mauvais QR ?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                disabled={submitting}
                onClick={() => { setConfirmShort(null); action('annuler') }}
                style={{ ...bigBtn, backgroundColor: '#7c3aed' }}
                title="Supprime l'entrée comme si elle n'avait jamais eu lieu"
              >
                🗑️ Retirer cette entrée (mauvais QR scanné)
              </button>
              <button
                disabled={submitting}
                onClick={() => { setConfirmShort(null); action('depart', undefined, { confirm_short: true }) }}
                style={{ ...bigBtn, backgroundColor: RED }}
              >
                ✓ Terminer quand même (c'est intentionnel)
              </button>
              <button
                onClick={() => setConfirmShort(null)}
                style={{ ...bigBtn, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}` }}
              >
                ← Annuler (garder la présence ouverte)
              </button>
            </div>
          </div>
        )}

        {/* Boutons selon l'état (masqués si bandeau autre-ouvert ou confirm-short actif) */}
        {!showCorrection && !confirmShort && !confirmWrongDate && !(state === 'aucun' && autresOuverts.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {state === 'aucun' && (
              <button disabled={submitting} onClick={() => action('arrivee')}
                style={{ ...bigBtn, backgroundColor: GREEN }}>
                {session?.type_contexte === 'camp' ? '▶️ Confirmer mon arrivée' : '▶️ Commencer mon quart'}
              </button>
            )}
            {state === 'en_cours' && (
              <>
                <button disabled={submitting} onClick={() => action('depart')}
                  style={{ ...bigBtn, backgroundColor: RED }}>
                  {session?.type_contexte === 'camp' ? '⏹️ Confirmer mon départ' : '⏹️ Terminer mon quart'}
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
        Présence — {session.type_contexte === 'camp' ? 'camp' : 'déploiement'}
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
        {state === 'en_cours' ? '🔵 Présence en cours' : '✓ Dernière présence complétée'}
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
