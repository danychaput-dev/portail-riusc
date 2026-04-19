'use client'

/**
 * ─────────────────────────────────────────────────────────────────
 * VERSION TEMPORAIRE (2026-04-18) — Sélection par jour (checkboxes)
 * Dates fixes : 19, 20, 21 avril 2026 (déploiement Laval digue)
 * L'ancienne version avec plage continue est dans page-plage-old.tsx
 * À remplacer par une page dynamique lisant les dates du déploiement
 * ─────────────────────────────────────────────────────────────────
 */

import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'
import Image from 'next/image'
import { logPageVisit } from '@/utils/logEvent'
import { isDemoActive, DEMO_RESERVISTE, DEMO_DEPLOIEMENTS } from '@/utils/demoMode'
import { n8nUrl } from '@/utils/n8n'

interface DeploiementInfo {
  deploiement_id: string;
  nom_deploiement: string;
  nom_sinistre?: string | null;
  type_incident?: string | null;
  lieu?: string | null;
  date_debut: string;
  date_fin?: string | null;
  organisme?: string | null;
  date_limite_reponse?: string | null;
}

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string | null;
}

type ReponseType = 'disponible' | 'non_disponible' | 'a_confirmer';

// Dates hardcodées pour cette version temporaire
const DATES_FIXES = [
  { iso: '2026-04-19', label: 'Dimanche 19 avril 2026' },
  { iso: '2026-04-20', label: 'Lundi 20 avril 2026' },
  { iso: '2026-04-21', label: 'Mardi 21 avril 2026' },
]

function SoumettreContent() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [deploiement, setDeploiement] = useState<DeploiementInfo | null>(null)
  const [showAide, setShowAide] = useState(false)

  const [reponse, setReponse] = useState<ReponseType | null>(null)
  const [datesCochees, setDatesCochees] = useState<Set<string>>(new Set())
  const [transport, setTransport] = useState('')
  const [commentaires, setCommentaires] = useState('')
  const [engagementAccepte, setEngagementAccepte] = useState(false)
  const [aptitudeAcceptee, setAptitudeAcceptee] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const deploiementId = searchParams.get('deploiement') ?? ''

  // Ref vers la section formulaire (qui apparaît après choix d'une option)
  // Permet de scroller automatiquement la page vers la suite du formulaire
  // quand le réserviste clique sur "Je suis dispo", "À confirmer" ou "Non disponible".
  const formSectionRef = useRef<HTMLDivElement>(null)

  // Auto-scroll vers le formulaire dès que l'utilisateur sélectionne une option.
  // On attend la prochaine frame pour que le DOM ait le temps de monter la section.
  useEffect(() => {
    if (!reponse) return
    const id = requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(id)
  }, [reponse])

  function formatDate(dateString: string): string {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const toggleDate = (iso: string) => {
    setDatesCochees(prev => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
    setError('')
  }

  useEffect(() => {
    const loadData = async () => {
      // Mode démo
      if (isDemoActive()) {
        setReserviste({ benevole_id: DEMO_RESERVISTE.benevole_id, prenom: DEMO_RESERVISTE.prenom, nom: DEMO_RESERVISTE.nom, email: DEMO_RESERVISTE.email, telephone: DEMO_RESERVISTE.telephone })
        const demoDep = DEMO_DEPLOIEMENTS.find(d => d.deploiement_id === deploiementId) || DEMO_DEPLOIEMENTS[0]
        setDeploiement(demoDep as any)
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Préserver l'URL courante (avec ?deploiement=...) pour revenir ici après OTP
        const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/disponibilites'
        router.push(`/login?redirect=${encodeURIComponent(returnTo)}`)
        return
      }
      if (!deploiementId) { setError('Aucun déploiement spécifié.'); setLoading(false); return }

      if (user.email) {
        const { data: res } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, telephone')
          .ilike('email', user.email)
          .single()
        if (res) setReserviste(res)
      }

      const { data: depRaw } = await supabase
        .from('deployments')
        .select('id, identifiant, nom, lieu, date_debut, date_fin, statut, notes_logistique')
        .eq('id', deploiementId)
        .single()

      const dep = depRaw ? {
        deploiement_id: depRaw.id,
        nom_deploiement: depRaw.nom,
        nom_sinistre: undefined,
        type_incident: undefined,
        lieu: depRaw.lieu,
        date_debut: depRaw.date_debut,
        date_fin: depRaw.date_fin,
        organisme: undefined,
        date_limite_reponse: undefined,
      } : null

      if (dep) {
        setDeploiement(dep)
      } else {
        setError('Déploiement introuvable.')
      }
      logPageVisit('/disponibilites/soumettre')
      setLoading(false)
    }
    loadData()
  }, [])

  const handleSubmit = async () => {
    // Validation
    if (!reserviste) { setError('Profil de réserviste non chargé. Reconnectez-vous et réessayez.'); return }
    if (!deploiement) { setError('Aucun déploiement sélectionné. Retournez à la liste.'); return }
    if (!reponse) { setError('Sélectionnez d\'abord une des 3 options : Disponible, À confirmer ou Non disponible.'); return }

    if (reponse !== 'non_disponible') {
      if (datesCochees.size === 0) { setError('Cochez au moins une date où vous êtes disponible.'); return }
      if (!transport) { setError('Veuillez indiquer votre situation de transport.'); return }
      if (reponse === 'disponible' && !engagementAccepte) { setError('Veuillez cocher la case d\'engagement de disponibilité.'); return }
      if (reponse === 'disponible' && !aptitudeAcceptee) { setError('Veuillez cocher la case d\'aptitude physique et mentale.'); return }
    }

    setSubmitting(true)
    setError('')

    // Mode démo
    if (isDemoActive()) {
      setTimeout(() => { setSubmitting(false); setSubmitted(true) }, 1000)
      return
    }

    try {
      // Cas NON DISPONIBLE : un seul appel sans dates
      if (reponse === 'non_disponible') {
        const response = await fetch(n8nUrl('/webhook/riusc-disponibilite'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benevole_id: reserviste.benevole_id,
            deployment_id: deploiement.deploiement_id,
            date_debut: null,
            date_fin: null,
            transport: null,
            commentaire: commentaires || null,
            disponible: false,
            a_confirmer: false,
          })
        })
        if (response.ok) {
          setSubmitted(true)
        } else {
          const data = await response.json().catch(() => ({}))
          setError(data.error || 'Erreur lors de la soumission. Veuillez réessayer.')
        }
        setSubmitting(false)
        return
      }

      // Cas DISPONIBLE / À CONFIRMER : un appel par date cochée
      const datesTriees = Array.from(datesCochees).sort()
      const erreurs: string[] = []
      for (const date of datesTriees) {
        const response = await fetch(n8nUrl('/webhook/riusc-disponibilite'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benevole_id: reserviste.benevole_id,
            deployment_id: deploiement.deploiement_id,
            date_debut: date,
            date_fin: date,
            transport,
            commentaire: commentaires || null,
            disponible: reponse === 'disponible',
            a_confirmer: reponse === 'a_confirmer',
          })
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          erreurs.push(`${date}: ${data.error || response.status}`)
        }
      }

      if (erreurs.length === 0) {
        setSubmitted(true)
      } else if (erreurs.length < datesTriees.length) {
        setError(`Certaines dates ont échoué : ${erreurs.join(', ')}. Les autres sont bien enregistrées.`)
      } else {
        setError(`Erreur lors de la soumission : ${erreurs.join(', ')}`)
      }
    } catch (err) {
      console.error('Erreur soumission:', err)
      setError('Erreur de connexion. Veuillez réessayer.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>
        Chargement...
      </div>
    )
  }

  // ── Écran de confirmation ─────────────────────────────────────────────────
  if (submitted && reponse) {
    type MsgConfig = { titre: string; icon: string; bg: string; texte: string; note: string }
    const prenom = reserviste?.prenom ?? ''
    const contact = reserviste?.telephone ? 'SMS' : 'courriel'

    const datesChoisies = Array.from(datesCochees).sort()
      .map(d => DATES_FIXES.find(x => x.iso === d)?.label || d)
      .join(', ')

    const messages: Record<ReponseType, MsgConfig> = {
      disponible: {
        titre: 'Disponibilité enregistrée',
        icon: '✅',
        bg: '#d1fae5',
        texte: `Merci, ${prenom} ! Vos dates ont bien été reçues : ${datesChoisies}.`,
        note: `La planification débute rapidement après la fermeture des disponibilités. Si vous êtes sélectionné pour ce déploiement, vous en serez informé par ${contact}.`,
      },
      non_disponible: {
        titre: 'Réponse enregistrée',
        icon: '📋',
        bg: '#fee2e2',
        texte: `Merci, ${prenom}. Votre indisponibilité a été enregistrée.`,
        note: 'Nous espérons pouvoir compter sur vous lors d\'un prochain déploiement.',
      },
      a_confirmer: {
        titre: 'Dates soumises',
        icon: '⏳',
        bg: '#fef3c7',
        texte: `Merci, ${prenom} ! Vos dates ont été reçues sous réserve de confirmation : ${datesChoisies}.`,
        note: 'Un suivi sera fait dans les 48 prochaines heures pour confirmer votre disponibilité.',
      },
    }

    const msg = messages[reponse]

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
        <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Soumission de disponibilité</p>
            </div>
          </div>
        </header>
        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
          <div style={{ backgroundColor: 'white', padding: '48px 32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', backgroundColor: msg.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px' }}>
              {msg.icon}
            </div>
            <h2 style={{ color: '#1e3a5f', margin: '0 0 12px 0', fontSize: '24px' }}>{msg.titre}</h2>
            <p style={{ color: '#4b5563', margin: '0 0 12px 0', fontSize: '16px' }}>{msg.texte}</p>
            <p style={{ color: '#6b7280', margin: '0 0 32px 0', fontSize: '14px', lineHeight: '1.6', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
              {msg.note}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <a
                href="/disponibilites"
                style={{ display: 'inline-block', padding: '12px 32px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}
              >
                Voir mes disponibilités
              </a>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Formulaire principal ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Soumission de disponibilité</p>
            </div>
          </a>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/disponibilites" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour aux disponibilités</a>
        </div>

        {/* Carte déploiement */}
        {deploiement && (
          <div style={{ backgroundColor: '#1e3a5f', padding: '24px 28px', borderRadius: '12px', marginBottom: '24px', color: 'white' }}>
            {deploiement.nom_sinistre && (
              <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, marginBottom: '6px' }}>
                {deploiement.nom_sinistre}
              </div>
            )}
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>{deploiement.nom_deploiement}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', opacity: 0.9 }}>
              {deploiement.type_incident && <div>🔥 {deploiement.type_incident}</div>}
              {deploiement.lieu && <div>📍 {deploiement.lieu}</div>}
              {deploiement.organisme && <div>🏢 {deploiement.organisme}</div>}
              {deploiement.date_debut && (
                <div>📅 {formatDate(deploiement.date_debut)}{deploiement.date_fin ? ` au ${formatDate(deploiement.date_fin)}` : ''}</div>
              )}
              {deploiement.date_limite_reponse && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
                  🕐 Répondre avant le {formatDate(deploiement.date_limite_reponse)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bloc d'aide accordéon */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', overflow: 'hidden', border: '1px solid #e0e7ef' }}>
          <button
            onClick={() => setShowAide(!showAide)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>💡</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a5f' }}>Comment fonctionne la soumission de disponibilité ?</span>
            </div>
            <svg width="16" height="16" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transform: showAide ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAide && (
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '20px 24px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>✅</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Cochez les jours où vous êtes disponible</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      Vous pouvez cocher <strong>un, deux ou trois jours</strong>. Par exemple : disponible dimanche et mardi, pas disponible lundi.
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb' }} />

                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>⚡</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Planification rapide</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      La planification débute peu après la fermeture des disponibilités. Indiquez des dates où vous seriez <strong>réellement disponible</strong>.
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb' }} />

                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>📣</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Vous serez informé dans tous les cas</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      Que vous soyez sélectionné pour ce déploiement ou non, vous recevrez une réponse.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Choix de réponse */}
        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Quelle est votre disponibilité ?</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <button onClick={() => { setReponse('disponible'); setError(''); setEngagementAccepte(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', border: reponse === 'disponible' ? '2px solid #059669' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: reponse === 'disponible' ? '#ecfdf5' : 'white', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>✅</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#065f46' }}>Je suis disponible</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Cochez les jours où vous pouvez vous déplacer</div>
              </div>
            </button>

            <button onClick={() => { setReponse('a_confirmer'); setError(''); setEngagementAccepte(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', border: reponse === 'a_confirmer' ? '2px solid #d97706' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: reponse === 'a_confirmer' ? '#fffbeb' : 'white', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>⏳</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#92400e' }}>Je dois confirmer avec mon employeur</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Cochez les jours souhaités, un suivi sera fait dans les 48h</div>
              </div>
            </button>

            <button onClick={() => { setReponse('non_disponible'); setError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', border: reponse === 'non_disponible' ? '2px solid #dc2626' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: reponse === 'non_disponible' ? '#fef2f2' : 'white', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>❌</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#991b1b' }}>Je ne suis pas disponible</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Vous pourrez ajouter un commentaire si vous le souhaitez</div>
              </div>
            </button>
          </div>
        </div>

        {/* Formulaire disponible / à confirmer */}
        {reponse && reponse !== 'non_disponible' && (
          <div ref={formSectionRef} style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', scrollMarginTop: '24px' }}>

            {reponse === 'disponible' && (
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>💡</span>
                  <p style={{ margin: 0, color: '#0369a1', fontSize: '14px', lineHeight: '1.7' }}>
                    Cochez les jours où vous êtes réellement disponible. Si vous êtes sélectionné, nous vous contacterons.
                  </p>
                </div>
              </div>
            )}

            {reponse === 'a_confirmer' && (
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>⏳</span>
                  <p style={{ margin: 0, color: '#78350f', fontSize: '14px', lineHeight: '1.7' }}>
                    Cochez les jours souhaités. Un suivi sera fait dans les <strong>48 heures</strong> pour confirmer ou ajuster votre disponibilité.
                  </p>
                </div>
              </div>
            )}

            {/* Checkboxes dates */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                Êtes-vous disponible ces journées ?
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {DATES_FIXES.map(({ iso, label }) => {
                  const checked = datesCochees.has(iso)
                  return (
                    <label key={iso} style={{
                      display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px',
                      border: checked ? '2px solid #059669' : '1px solid #e5e7eb',
                      borderRadius: '10px', cursor: 'pointer',
                      backgroundColor: checked ? '#ecfdf5' : 'white',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDate(iso)}
                        style={{ accentColor: '#059669', width: '22px', height: '22px', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '15px', color: '#111827', fontWeight: checked ? '600' : '500' }}>
                        {label}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6b7280' }}>Cochez au moins une date.</p>
            </div>

            {/* Transport */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Transport *</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { value: 'autonome', label: 'Je suis autonome (véhicule personnel)' },
                  { value: 'covoiturage_offre', label: "Je peux offrir du covoiturage à d'autres réservistes" },
                  { value: 'covoiturage_recherche', label: 'Je recherche du covoiturage' },
                  { value: 'besoin_transport', label: "J'ai besoin d'un transport (pas de véhicule)" },
                ].map((option) => (
                  <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: transport === option.value ? '2px solid #1e3a5f' : '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', backgroundColor: transport === option.value ? '#f0f4f8' : 'white', transition: 'all 0.2s' }}>
                    <input type="radio" name="transport" value={option.value} checked={transport === option.value} onChange={(e) => setTransport(e.target.value)}
                      style={{ accentColor: '#1e3a5f', width: '18px', height: '18px' }} />
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: transport === option.value ? '500' : '400' }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Commentaires */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Commentaires</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>Informations supplémentaires pertinentes (limitations, compétences particulières, etc.)</p>
              <textarea value={commentaires} onChange={(e) => setCommentaires(e.target.value)} placeholder="Optionnel" rows={3}
                style={{ width: '100%', padding: '12px 14px', fontSize: '14px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical', color: '#111827', fontFamily: 'inherit' }} />
            </div>

            {/* Engagement */}
            {reponse === 'disponible' && (
              <div style={{ backgroundColor: '#f9fafb', padding: '16px 20px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e5e7eb' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={engagementAccepte} onChange={(e) => setEngagementAccepte(e.target.checked)}
                    style={{ accentColor: '#1e3a5f', width: '20px', height: '20px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                    Je confirme que les dates cochées reflètent ma <strong>disponibilité réelle</strong> au moment de la soumission.
                  </span>
                </label>
              </div>
            )}

            {/* Aptitude */}
            {reponse === 'disponible' && (
              <div style={{ backgroundColor: '#f9fafb', padding: '16px 20px', borderRadius: '8px', marginBottom: '28px', border: '1px solid #e5e7eb' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aptitudeAcceptee} onChange={(e) => setAptitudeAcceptee(e.target.checked)}
                    style={{ accentColor: '#1e3a5f', width: '20px', height: '20px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                    Je confirme être apte, tant physiquement que mentalement, à participer à un déploiement de la RIUSC et à effectuer les tâches pouvant inclure du travail physique en conditions opérationnelles. Je m&apos;engage à signaler toute condition pouvant limiter ma capacité à accomplir ces tâches en toute sécurité.
                  </span>
                </label>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || datesCochees.size === 0 || !transport || (reponse === 'disponible' && (!engagementAccepte || !aptitudeAcceptee))}
              style={{
                width: '100%', padding: '16px 24px',
                backgroundColor: (submitting || datesCochees.size === 0 || !transport || (reponse === 'disponible' && (!engagementAccepte || !aptitudeAcceptee)))
                  ? '#9ca3af' : reponse === 'disponible' ? '#059669' : '#d97706',
                color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600',
                cursor: (submitting || datesCochees.size === 0 || !transport || (reponse === 'disponible' && (!engagementAccepte || !aptitudeAcceptee))) ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}>
              {submitting ? 'Soumission en cours...' : reponse === 'disponible' ? `Envoyer mes disponibilités (${datesCochees.size} jour${datesCochees.size > 1 ? 's' : ''})` : `Soumettre mes dates à confirmer (${datesCochees.size} jour${datesCochees.size > 1 ? 's' : ''})`}
            </button>
          </div>
        )}

        {/* Formulaire non disponible */}
        {reponse === 'non_disponible' && (
          <div ref={formSectionRef} style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', scrollMarginTop: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Commentaire (optionnel)</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>Vous pouvez indiquer la raison de votre indisponibilité si vous le souhaitez.</p>
              <textarea value={commentaires} onChange={(e) => setCommentaires(e.target.value)} placeholder="Optionnel" rows={3}
                style={{ width: '100%', padding: '12px 14px', fontSize: '14px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical', color: '#111827', fontFamily: 'inherit' }} />
            </div>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ width: '100%', padding: '16px 24px', backgroundColor: submitting ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}>
              {submitting ? 'Enregistrement...' : 'Confirmer mon indisponibilité'}
            </button>
          </div>
        )}
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}

export default function SoumettrePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Chargement...</div>}>
      <SoumettreContent />
    </Suspense>
  )
}
