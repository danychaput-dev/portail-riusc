'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Image from 'next/image'
import { logPageVisit } from '@/utils/logEvent'
import { isDemoActive, DEMO_RESERVISTE, DEMO_DEPLOIEMENTS } from '@/utils/demoMode'

interface DeploiementInfo {
  deploiement_id: string;
  nom_deploiement: string;
  nom_sinistre?: string;
  type_incident?: string;
  lieu?: string;
  date_debut: string;
  date_fin?: string;
  organisme?: string;
  date_limite_reponse?: string;
}

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
}

type ReponseType = 'disponible' | 'non_disponible' | 'a_confirmer';

function SoumettreContent() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [deploiement, setDeploiement] = useState<DeploiementInfo | null>(null)
  const [showAide, setShowAide] = useState(false)

  const [reponse, setReponse] = useState<ReponseType | null>(null)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [transport, setTransport] = useState('')
  const [commentaires, setCommentaires] = useState('')
  const [engagementAccepte, setEngagementAccepte] = useState(false)
  const [aptitudeAcceptee, setAptitudeAcceptee] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const deploiementId = searchParams.get('deploiement') ?? ''

  const demain = new Date()
  demain.setDate(demain.getDate() + 1)
  const minDate = demain.toISOString().split('T')[0]

  function formatDate(dateString: string): string {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const [demoToast, setDemoToast] = useState('')

  useEffect(() => {
    const loadData = async () => {
      // 🎯 MODE DÉMO
      if (isDemoActive()) {
        setReserviste({ benevole_id: DEMO_RESERVISTE.benevole_id, prenom: DEMO_RESERVISTE.prenom, nom: DEMO_RESERVISTE.nom, email: DEMO_RESERVISTE.email, telephone: DEMO_RESERVISTE.telephone })
        const demoDep = DEMO_DEPLOIEMENTS.find(d => d.deploiement_id === deploiementId) || DEMO_DEPLOIEMENTS[0]
        setDeploiement(demoDep as any)
        if (demoDep.date_debut) setDateDebut(demoDep.date_debut)
        if (demoDep.date_fin) setDateFin(demoDep.date_fin)
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
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
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]
        if (dep.date_debut && dep.date_debut >= tomorrowStr) setDateDebut(dep.date_debut)
        if (dep.date_fin && dep.date_fin >= tomorrowStr) setDateFin(dep.date_fin)
      } else {
        setError('Déploiement introuvable.')
      }
      logPageVisit('/disponibilites/soumettre')
      setLoading(false)
    }
    loadData()
  }, [])

  const handleSubmit = async () => {
    if (!reserviste || !deploiement || !reponse) return

    if (reponse !== 'non_disponible') {
      if (!dateDebut || !dateFin) { setError('Veuillez indiquer vos dates de disponibilité. '); return }
      if (dateDebut < minDate) { setError('La date de début doit être au plus tôt demain.'); return }
      const debut = new Date(dateDebut)
      const fin = new Date(dateFin)
      const diffJours = Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24))
      if (diffJours < 4) { setError('La durée minimale de disponibilité est de 4 jours.'); return }
      if (!transport) { setError('Veuillez indiquer votre situation de transport.'); return }
      if (reponse === 'disponible' && !engagementAccepte) { setError('Veuillez confirmer votre disponibilité.'); return }
      if (reponse === 'disponible' && !aptitudeAcceptee) { setError('Veuillez confirmer votre aptitude physique et mentale au déploiement.'); return }
    }

    setSubmitting(true)
    setError('')

    // 🎯 MODE DÉMO
    if (isDemoActive()) {
      setTimeout(() => { setSubmitting(false); setSubmitted(true) }, 1000)
      return
    }

    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-disponibilite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          deployment_id: deploiement.deploiement_id,
          date_debut: reponse !== 'non_disponible' ? dateDebut : null,
          date_fin: reponse !== 'non_disponible' ? dateFin : null,
          transport: reponse !== 'non_disponible' ? transport : null,
          commentaire: commentaires || null,
          disponible: reponse !== 'non_disponible',
        })
      })

      if (response.ok) {
        setSubmitted(true)
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.error || 'Erreur lors de la soumission. Veuillez réessayer.')
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

  // ── Écran de confirmation post-soumission ─────────────────────────────────
  if (submitted && reponse) {
    type MsgConfig = { titre: string; icon: string; bg: string; texte: string; note: string }
    const prenom = reserviste?.prenom ?? ''
    const contact = reserviste?.telephone ? 'SMS' : 'courriel'

    const messages: Record<ReponseType, MsgConfig> = {
      disponible: {
        titre: 'Disponibilité enregistrée',
        icon: '✅',
        bg: '#d1fae5',
        texte: `Merci, ${prenom} ! Vos dates ont bien été reçues.`,
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
        texte: `Merci, ${prenom} ! Vos dates ont été reçues sous réserve de confirmation.`,
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
              {reponse !== 'non_disponible' && deploiementId && (
                <a
                  href={`/disponibilites/soumettre?deploiement=${deploiementId}`}
                  style={{ display: 'inline-block', padding: '12px 28px', backgroundColor: '#f0f4f8', color: '#1e3a5f', border: '1px solid #1e3a5f', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}
                >
                  + Ajouter une autre plage de disponibilité
                </a>
              )}
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

        {/* ── Carte déploiement ── */}
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
                <div>📅 {formatDate(deploiement.date_debut)}{deploiement.date_fin ? ` — ${formatDate(deploiement.date_fin)}` : ''}</div>
              )}
              {deploiement.date_limite_reponse && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
                  🕐 Répondre avant le {formatDate(deploiement.date_limite_reponse)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bloc d'aide accordéon ── */}
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
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>📅</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Plusieurs plages possibles</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      Vous pouvez soumettre <strong>plusieurs plages de dates distinctes</strong> pour un même déploiement — par exemple, du <em>1 au 7 mars</em> puis du <em>20 au 26 mars</em>. Après votre première soumission, un bouton <strong>« Ajouter une autre plage »</strong> vous sera proposé.
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb' }} />

                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>⚡</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Planification rapide</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      La planification débute peu après la fermeture des disponibilités. Indiquez des dates où vous seriez <strong>réellement disponible</strong> — ça nous permet de vous inclure rapidement, sans allers-retours supplémentaires.
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb' }} />

                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>✏️</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Modifier une plage</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      Vous pouvez modifier vos dates depuis la page <em>Mes disponibilités</em>, tant que la date limite de réponse n&apos;est pas dépassée. Après ce délai, les disponibilités sont verrouillées pour permettre la planification.
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb' }} />

                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>📣</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Vous serez informé dans tous les cas</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      Que vous soyez sélectionné pour ce déploiement ou non, vous recevrez une réponse. Si vous n&apos;êtes pas retenu pour cette vague, nous reviendrons vers vous pour la suivante afin de valider vos disponibilités.
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

        {/* ── Choix de réponse ── */}
        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Quelle est votre disponibilité ?</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <button onClick={() => { setReponse('disponible'); setError(''); setEngagementAccepte(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', border: reponse === 'disponible' ? '2px solid #059669' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: reponse === 'disponible' ? '#ecfdf5' : 'white', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>✅</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#065f46' }}>Je suis disponible</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Indiquez vos dates — nous planifions rapidement à partir de votre réponse</div>
              </div>
            </button>

            <button onClick={() => { setReponse('a_confirmer'); setError(''); setEngagementAccepte(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', border: reponse === 'a_confirmer' ? '2px solid #d97706' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: reponse === 'a_confirmer' ? '#fffbeb' : 'white', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>⏳</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#92400e' }}>Je dois confirmer avec mon employeur</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Soumettez vos dates souhaitées — un suivi sera fait dans les 48h</div>
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

        {/* ── Formulaire disponible / à confirmer ── */}
        {reponse && reponse !== 'non_disponible' && (
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>

            {reponse === 'disponible' && (
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>💡</span>
                  <p style={{ margin: 0, color: '#0369a1', fontSize: '14px', lineHeight: '1.7' }}>
                    La planification débute rapidement après la fermeture des disponibilités. Indiquez des dates où vous seriez <strong>réellement disponible</strong> — ça nous permet de vous inclure sans délai supplémentaire. Si vous êtes sélectionné, nous vous contacterons.
                  </p>
                </div>
              </div>
            )}

            {reponse === 'a_confirmer' && (
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>⏳</span>
                  <p style={{ margin: 0, color: '#78350f', fontSize: '14px', lineHeight: '1.7' }}>
                    Indiquez les dates souhaitées. Un suivi sera fait dans les <strong>48 heures</strong> pour confirmer ou ajuster votre disponibilité.
                  </p>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                {reponse === 'disponible' ? 'Vos dates de disponibilité' : 'Dates souhaitées'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Date de début *</label>
                  <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} min={minDate}
                    style={{ width: '100%', padding: '12px 14px', fontSize: '15px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', color: '#111827' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Date de fin *</label>
                  <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} min={dateDebut || minDate}
                    style={{ width: '100%', padding: '12px 14px', fontSize: '15px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', color: '#111827' }} />
                </div>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6b7280' }}>Durée minimale : 4 jours</p>
            </div>

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

            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Commentaires</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>Informations supplémentaires pertinentes (limitations, compétences particulières, etc.)</p>
              <textarea value={commentaires} onChange={(e) => setCommentaires(e.target.value)} placeholder="Optionnel" rows={3}
                style={{ width: '100%', padding: '12px 14px', fontSize: '14px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical', color: '#111827', fontFamily: 'inherit' }} />
            </div>

            {reponse === 'disponible' && (
              <div style={{ backgroundColor: '#f9fafb', padding: '16px 20px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e5e7eb' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={engagementAccepte} onChange={(e) => setEngagementAccepte(e.target.checked)}
                    style={{ accentColor: '#1e3a5f', width: '20px', height: '20px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                    Je confirme que les dates indiquées reflètent ma <strong>disponibilité réelle</strong> au moment de la soumission.
                  </span>
                </label>
              </div>
            )}

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
              disabled={submitting || (reponse === 'disponible' && !engagementAccepte) || (reponse === 'disponible' && !aptitudeAcceptee) || !dateDebut || !dateFin || !transport}
              style={{
                width: '100%', padding: '16px 24px',
                backgroundColor: (submitting || (reponse === 'disponible' && !engagementAccepte) || (reponse === 'disponible' && !aptitudeAcceptee) || !dateDebut || !dateFin || !transport)
                  ? '#9ca3af' : reponse === 'disponible' ? '#059669' : '#d97706',
                color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600',
                cursor: (submitting || (reponse === 'disponible' && !engagementAccepte) || (reponse === 'disponible' && !aptitudeAcceptee)) ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}>
              {submitting ? 'Soumission en cours...' : reponse === 'disponible' ? 'Envoyer mes disponibilités' : 'Soumettre mes dates (à confirmer)'}
            </button>
          </div>
        )}

        {/* ── Formulaire non disponible ── */}
        {reponse === 'non_disponible' && (
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
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
