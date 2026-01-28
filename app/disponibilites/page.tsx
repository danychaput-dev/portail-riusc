'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DisponibilitesPage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<any>(null)
  const [disponibilites, setDisponibilites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)

      // Charger les infos du réserviste
      const { data: reservisteData } = await supabase
        .from('reservistes')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (reservisteData) {
        setReserviste(reservisteData)
      }

      // Charger les disponibilités ACTIVES
      const { data: dispos, error } = await supabase
        .from('disponibilites')
        .select('*')
        .eq('user_id', user.id)
        .eq('statut_version', 'Active')
        .order('date_debut', { ascending: false })

      if (!error && dispos) {
        setDisponibilites(dispos)
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const formatDateRange = (dateDebut: string, dateFin: string) => {
    if (!dateDebut || !dateFin) return 'Dates non disponibles'

    const debut = new Date(dateDebut)
    const fin = new Date(dateFin)

    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

    const jourDebutNom = jours[debut.getDay()]
    const jourFinNom = jours[fin.getDay()]
    const moisNom = mois[debut.getMonth()]
    const annee = debut.getFullYear()

    return `Du ${jourDebutNom} ${debut.getDate()} au ${jourFinNom} ${fin.getDate()} ${moisNom} ${annee}`
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#1e3a5f'
      }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '30px 20px',
        marginBottom: '40px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '32px' }}>📅 Mes Disponibilités</h1>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Gérez vos disponibilités pour les déploiements d'urgence
          </p>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 40px' }}>
        {/* Bouton Nouveau Formulaire */}
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <a 
            href={`https://form.jotform.com/253475614808262${reserviste?.benevole_id ? `?BenevoleID=${reserviste.benevole_id}` : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '15px 30px',
              backgroundColor: '#4a90e2',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#357abd'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4a90e2'}
          >
            ➕ Soumettre une nouvelle disponibilité
          </a>
        </div>

        {/* Liste des disponibilités */}
        {disponibilites.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📭</div>
            <h3 style={{ color: '#1e3a5f', marginBottom: '10px' }}>Aucune disponibilité active</h3>
            <p style={{ color: '#666' }}>
              Cliquez sur le bouton ci-dessus pour soumettre votre première disponibilité
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '20px'
          }}>
            {disponibilites.map((dispo) => (
              <div 
                key={dispo.id}
                style={{
                  backgroundColor: 'white',
                  padding: '25px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  borderLeft: `4px solid ${
                    dispo.statut === 'Disponible' ? '#10b981' : 
                    dispo.statut === 'Peut-être' ? '#f59e0b' : 
                    '#ef4444'
                  }`
                }}
              >
                {/* Hiérarchie complète */}
                <div style={{ marginBottom: '20px' }}>
                  {/* Sinistre */}
                  {dispo.nom_sinistre && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      fontSize: '15px',
                      color: '#666'
                    }}>
                      <span style={{ fontSize: '18px' }}>🔥</span>
                      <strong style={{ color: '#1e3a5f' }}>Sinistre :</strong>
                      <span>{dispo.nom_sinistre}</span>
                    </div>
                  )}

                  {/* Demande */}
                  {dispo.nom_demande && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      fontSize: '15px',
                      color: '#666'
                    }}>
                      <span style={{ fontSize: '18px' }}>📋</span>
                      <strong style={{ color: '#1e3a5f' }}>Demande :</strong>
                      <span>{dispo.nom_demande}</span>
                      {dispo.organisme_demande && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          {dispo.organisme_demande}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Déploiement */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '16px'
                  }}>
                    <span style={{ fontSize: '18px' }}>🚨</span>
                    <strong style={{ color: '#1e3a5f' }}>Déploiement :</strong>
                    <span style={{ color: '#333', fontWeight: '500' }}>
                      {dispo.nom_deploiement || 'Déploiement sans nom'}
                    </span>
                  </div>
                </div>

                {/* Dates */}
                <div style={{ 
                  fontSize: '16px',
                  color: '#4a90e2',
                  fontWeight: '500',
                  marginBottom: '15px',
                  paddingLeft: '26px'
                }}>
                  📅 {formatDateRange(dispo.date_debut, dispo.date_fin)}
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '20px',
                  alignItems: 'start',
                  flexWrap: 'wrap',
                  paddingLeft: '26px'
                }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    {/* Statut badge */}
                    <div style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      backgroundColor: 
                        dispo.statut === 'Disponible' ? '#d1fae5' : 
                        dispo.statut === 'Peut-être' ? '#fef3c7' : 
                        '#fee2e2',
                      color:
                        dispo.statut === 'Disponible' ? '#065f46' : 
                        dispo.statut === 'Peut-être' ? '#92400e' : 
                        '#991b1b',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '15px'
                    }}>
                      {dispo.statut}
                    </div>

                    {/* Commentaire */}
                    {dispo.commentaire && (
                      <div style={{ marginTop: '10px' }}>
                        <strong style={{ color: '#1e3a5f', fontSize: '14px' }}>Commentaire :</strong>
                        <p style={{ 
                          color: '#666', 
                          margin: '5px 0 0 0',
                          padding: '10px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}>
                          {dispo.commentaire}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Date de soumission */}
                  <div style={{ 
                    textAlign: 'right',
                    color: '#999',
                    fontSize: '13px',
                    minWidth: '150px'
                  }}>
                    <div style={{ marginBottom: '5px' }}>
                      <strong>Soumis le :</strong>
                    </div>
                    <div>
                      {dispo.repondu_le ? new Date(dispo.repondu_le).toLocaleDateString('fr-CA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'Date inconnue'}
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '12px' }}>
                      {dispo.repondu_le ? new Date(dispo.repondu_le).toLocaleTimeString('fr-CA', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : ''}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bouton retour */}
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <a 
            href="/"
            style={{
              color: '#4a90e2',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: '500'
            }}
          >
            ← Retour à l'accueil
          </a>
        </div>
      </main>
    </div>
  )
}