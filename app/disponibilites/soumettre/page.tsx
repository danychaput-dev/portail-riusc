'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Image from 'next/image'

interface DeploiementInfo {
  deploiement_id: string;
  nom_deploiement: string;
  nom_sinistre?: string;
  type_incident?: string;
  lieu?: string;
  date_debut: string;
  date_fin?: string;
  organisme?: string;
}

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
}

function SoumettreContent() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [deploiement, setDeploiement] = useState<DeploiementInfo | null>(null)

  // Form fields
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [transport, setTransport] = useState('')
  const [commentaires, setCommentaires] = useState('')
  const [engagementAccepte, setEngagementAccepte] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const deploiementId = searchParams.get('deploiement')

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      if (!deploiementId) {
        setError('Aucun déploiement spécifié.')
        setLoading(false)
        return
      }

      // Charger le réserviste
      if (user.email) {
        const { data: res } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, telephone')
          .ilike('email', user.email)
          .single()
        if (res) setReserviste(res)
      }

      // Charger le déploiement
      const { data: dep } = await supabase
        .from('deploiements_actifs')
        .select('deploiement_id, nom_deploiement, nom_sinistre, type_incident, lieu, date_debut, date_fin, organisme')
        .eq('deploiement_id', deploiementId)
        .single()

      if (dep) {
        setDeploiement(dep)
        if (dep.date_debut) setDateDebut(dep.date_debut)
        if (dep.date_fin) setDateFin(dep.date_fin)
      } else {
        setError('Déploiement introuvable.')
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handleSubmit = async () => {
    if (!reserviste || !deploiement) return

    if (!dateDebut || !dateFin) {
      setError('Veuillez indiquer vos dates de disponibilité.')
      return
    }

    // Validation minimum 4 jours
    const debut = new Date(dateDebut)
    const fin = new Date(dateFin)
    const diffJours = Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24))
    if (diffJours < 4) {
      setError('La durée minimale de disponibilité est de 4 jours.')
      return
    }

    if (!transport) {
      setError('Veuillez indiquer votre situation de transport.')
      return
    }

    if (!engagementAccepte) {
      setError('Veuillez confirmer votre engagement de disponibilité.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-disponibilite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          deploiement_id: deploiement.deploiement_id,
          prenom: reserviste.prenom,
          nom: reserviste.nom,
          email: reserviste.email,
          telephone: reserviste.telephone || null,
          date_debut: dateDebut,
          date_fin: dateFin,
          transport: transport,
          commentaires: commentaires || null
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

  if (submitted) {
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
            <div style={{ width: '80px', height: '80px', backgroundColor: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg width="40" height="40" fill="none" stroke="#059669" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 style={{ color: '#065f46', margin: '0 0 12px 0', fontSize: '24px' }}>Disponibilité soumise</h2>
            <p style={{ color: '#4b5563', margin: '0 0 8px 0', fontSize: '16px' }}>
              Merci, {reserviste?.prenom} ! Votre disponibilité a été enregistrée.
            </p>
            <p style={{ color: '#6b7280', margin: '0 0 32px 0', fontSize: '14px' }}>
              Si vous êtes assigné à ce déploiement, vous en serez informé par {reserviste?.telephone ? 'SMS' : 'courriel'}.
            </p>
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px', marginBottom: '32px' }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '14px', fontWeight: '500' }}>
                Rappel : Les dates que vous avez soumises constituent un engagement ferme. Aucune confirmation supplémentaire ne vous sera demandée avant l&apos;assignation.
              </p>
            </div>
            <a href="/" style={{ display: 'inline-block', padding: '12px 32px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
              Retour au portail
            </a>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Soumission de disponibilité</p>
            </div>
          </div>
          <a href="/" style={{ padding: '8px 16px', color: '#6b7280', textDecoration: 'none', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px' }}>
            ← Retour
          </a>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>

        {/* Info déploiement */}
        {deploiement && (
          <div style={{ backgroundColor: '#1e3a5f', padding: '24px 28px', borderRadius: '12px', marginBottom: '24px', color: 'white' }}>
            {deploiement.nom_sinistre && (
              <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, marginBottom: '6px' }}>
                {deploiement.nom_sinistre}
              </div>
            )}
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>
              {deploiement.nom_deploiement}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', opacity: 0.9 }}>
              {deploiement.type_incident && <div>🔥 {deploiement.type_incident}</div>}
              {deploiement.lieu && <div>📍 {deploiement.lieu}</div>}
              {deploiement.organisme && <div>🏢 {deploiement.organisme}</div>}
              {deploiement.date_debut && (
                <div>📅 {formatDate(deploiement.date_debut)}{deploiement.date_fin ? ` — ${formatDate(deploiement.date_fin)}` : ''}</div>
              )}
            </div>
          </div>
        )}

        {/* Avertissement engagement */}
        <div style={{ backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ fontSize: '24px', flexShrink: 0 }}>⚠️</span>
            <div>
              <p style={{ margin: '0 0 8px 0', fontWeight: '700', color: '#92400e', fontSize: '15px' }}>
                Engagement ferme de disponibilité
              </p>
              <p style={{ margin: 0, color: '#78350f', fontSize: '14px', lineHeight: '1.7' }}>
                Les dates que vous inscrivez dans ce formulaire représentent un <strong>engagement ferme</strong>.
                Lors de la planification, si vous êtes assigné, <strong>aucune validation supplémentaire</strong> ne 
                sera faite avec vous. Nous nous attendons à ce que vous soyez disponible aux dates indiquées, 
                sans modification. <strong>Inscrivez uniquement les dates où vous êtes certain d&apos;être disponible.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

          {/* Vos informations */}
          {reserviste && (
            <div style={{ backgroundColor: '#f9fafb', padding: '16px 20px', borderRadius: '8px', marginBottom: '28px', borderLeft: '4px solid #1e3a5f' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Réserviste</p>
              <p style={{ margin: '4px 0', color: '#374151', fontSize: '15px', fontWeight: '500' }}>{reserviste.prenom} {reserviste.nom}</p>
              <p style={{ margin: '2px 0', color: '#6b7280', fontSize: '14px' }}>{reserviste.email}</p>
              {reserviste.telephone && <p style={{ margin: '2px 0', color: '#6b7280', fontSize: '14px' }}>{reserviste.telephone}</p>}
            </div>
          )}

          {error && (
            <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {/* Dates de disponibilité */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
              Dates de disponibilité
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Date de début *
                </label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', fontSize: '15px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', color: '#111827' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Date de fin *
                </label>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  min={dateDebut}
                  style={{ width: '100%', padding: '12px 14px', fontSize: '15px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', color: '#111827' }}
                />
              </div>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
              Durée minimale de disponibilité : 4 jours
            </p>
          </div>
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
              Transport *
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { value: 'autonome', label: 'Je suis autonome (véhicule personnel)' },
                { value: 'covoiturage_offre', label: 'Je peux offrir du covoiturage à d\'autres réservistes' },
                { value: 'covoiturage_recherche', label: 'Je recherche du covoiturage' },
                { value: 'besoin_transport', label: 'J\'ai besoin d\'un transport (pas de véhicule)' },
              ].map((option) => (
                <label key={option.value} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  border: transport === option.value ? '2px solid #1e3a5f' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: transport === option.value ? '#f0f4f8' : 'white',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="transport"
                    value={option.value}
                    checked={transport === option.value}
                    onChange={(e) => setTransport(e.target.value)}
                    style={{ accentColor: '#1e3a5f', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151', fontWeight: transport === option.value ? '500' : '400' }}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Commentaires */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
              Commentaires
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>
              Informations supplémentaires pertinentes (allergies, limitations, compétences particulières, etc.)
            </p>
            <textarea
              value={commentaires}
              onChange={(e) => setCommentaires(e.target.value)}
              placeholder="Optionnel"
              rows={3}
              style={{ width: '100%', padding: '12px 14px', fontSize: '14px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical', color: '#111827', fontFamily: 'inherit' }}
            />
          </div>

          {/* Checkbox engagement */}
          <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '28px', border: '1px solid #e5e7eb' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={engagementAccepte}
                onChange={(e) => setEngagementAccepte(e.target.checked)}
                style={{ accentColor: '#1e3a5f', width: '20px', height: '20px', marginTop: '2px', flexShrink: 0 }}
              />
              <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                Je confirme que les dates indiquées ci-dessus représentent un <strong>engagement ferme</strong>. 
                Je comprends qu&apos;aucune validation ne sera faite avant l&apos;assignation et que je dois être 
                disponible sans modification aux dates soumises.
              </span>
            </label>
          </div>

          {/* Bouton soumettre */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !engagementAccepte || !dateDebut || !dateFin || !transport}
            style={{
              width: '100%',
              padding: '16px 24px',
              backgroundColor: (submitting || !engagementAccepte || !dateDebut || !dateFin || !transport) ? '#9ca3af' : '#1e3a5f',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: (submitting || !engagementAccepte) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {submitting ? 'Soumission en cours...' : 'Confirmer ma disponibilité'}
          </button>
        </div>
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
