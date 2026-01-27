'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DisponibilitesPage() {
  const [user, setUser] = useState<any>(null)
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

      // Charger les disponibilités de l'utilisateur
      const { data: dispos, error } = await supabase
        .from('disponibilites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && dispos) {
        setDisponibilites(dispos)
      }

      setLoading(false)
    }

    loadData()
  }, [])

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
      {/* Header Simple */}
      <div style={{
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '30px 20px',
        marginBottom: '40px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '32px' }}>📅 Mes Disponibilités</h1>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Historique de vos confirmations de déploiement
          </p>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 40px' }}>
        {/* Bouton Nouveau Formulaire */}
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <a 
            href="https://form.jotform.com/253475614808262"
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
            ➕ Confirmer une disponibilité
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
            <h3 style={{ color: '#1e3a5f', marginBottom: '10px' }}>Aucune disponibilité enregistrée</h3>
            <p style={{ color: '#666' }}>
              Cliquez sur le bouton ci-dessus pour confirmer votre première disponibilité
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
                    dispo.statut === 'Confirmé' ? '#10b981' : 
                    dispo.statut === 'En attente' ? '#f59e0b' : 
                    '#ef4444'
                  }`
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  flexWrap: 'wrap',
                  gap: '15px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      backgroundColor: 
                        dispo.statut === 'Confirmé' ? '#d1fae5' : 
                        dispo.statut === 'En attente' ? '#fef3c7' : 
                        '#fee2e2',
                      color:
                        dispo.statut === 'Confirmé' ? '#065f46' : 
                        dispo.statut === 'En attente' ? '#92400e' : 
                        '#991b1b',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '15px'
                    }}>
                      {dispo.statut}
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <strong style={{ color: '#1e3a5f' }}>Déploiement ID :</strong>{' '}
                      <span style={{ color: '#666' }}>{dispo.deploiement_id}</span>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <strong style={{ color: '#1e3a5f' }}>Bénévole ID :</strong>{' '}
                      <span style={{ color: '#666' }}>{dispo.benevole_id}</span>
                    </div>

                    {dispo.commentaire && (
                      <div style={{ marginTop: '15px' }}>
                        <strong style={{ color: '#1e3a5f' }}>Commentaire :</strong>
                        <p style={{ 
                          color: '#666', 
                          margin: '5px 0 0 0',
                          padding: '10px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '6px'
                        }}>
                          {dispo.commentaire}
                        </p>
                      </div>
                    )}
                  </div>

                  <div style={{ 
                    textAlign: 'right',
                    color: '#999',
                    fontSize: '14px'
                  }}>
                    <div>{new Date(dispo.created_at).toLocaleDateString('fr-CA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</div>
                    <div style={{ marginTop: '5px' }}>
                      {new Date(dispo.created_at).toLocaleTimeString('fr-CA', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
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
              fontSize: '16px'
            }}
          >
            ← Retour à l'accueil
          </a>
        </div>
      </main>
    </div>
  )
}