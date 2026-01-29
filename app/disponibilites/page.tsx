'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface Disponibilite {
  id: string;
  monday_item_id: string;
  benevole_id: string;
  deploiement_id: string;
  nom_deploiement: string;
  nom_sinistre?: string;
  nom_demande?: string;
  organisme_demande?: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  statut_version: string;
  commentaire?: string;
  envoye_le: string;
  repondu_le: string;
  user_id: string;
}

interface DeploiementActif {
  id: string;
  deploiement_id: string;
  nom_deploiement: string;
  nom_sinistre?: string;
  nom_demande?: string;
  organisme?: string;
  date_debut: string;
  date_fin: string;
  lieu?: string;
  statut: string;
}

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
}

export default function DisponibilitesPage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [deploiementsActifs, setDeploiementsActifs] = useState<DeploiementActif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    setUser(user);
    
    const { data: reservisteData } = await supabase
      .from('reservistes')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (reservisteData) {
      setReserviste(reservisteData);
      await fetchDisponibilites(user.id);
      await fetchDeploiementsActifs();
    }
    
    setLoading(false);
  }

  async function fetchDisponibilites(userId: string) {
    const { data, error } = await supabase
      .from('disponibilites')
      .select('*')
      .eq('user_id', userId)
      .eq('statut_version', 'Active')
      .order('date_debut', { ascending: false });
    
    if (data) {
      setDisponibilites(data);
    }
  }

  async function fetchDeploiementsActifs() {
    const { data, error } = await supabase
      .from('deploiements_actifs')
      .select('*')
      .order('date_debut', { ascending: true });
    
    if (error) {
      console.error('Erreur fetch déploiements:', error);
    }
    
    if (data) {
      setDeploiementsActifs(data);
    }
  }

  function genererLienJotform(deploiementId: string): string {
    if (!reserviste) return '#';
    
    return `https://form.jotform.com/253475614808262?BenevoleID=${reserviste.benevole_id}&DeploiementID=${deploiementId}`;
  }

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    return date.toLocaleDateString('fr-CA', options);
  }

  function formatDateCourt(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric',
      month: 'short'
    };
    
    return date.toLocaleDateString('fr-CA', options);
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Chargement...</p>
      </div>
    );
  }

  if (!reserviste) {
    return (
      <div style={{ padding: '40px' }}>
        <h1>Profil non trouvé</h1>
        <p>Votre compte n'est pas encore lié à un profil de réserviste.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '30px' }}>
        Mes Disponibilités
      </h1>

      <div style={{ marginBottom: '50px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '20px' }}>
          📋 Déploiements en recherche de réservistes
        </h2>
        
        {deploiementsActifs.length === 0 ? (
          <div style={{
            padding: '30px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280', fontSize: '15px' }}>
              Aucun déploiement actif pour le moment.
            </p>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '10px' }}>
              Les nouveaux déploiements apparaîtront ici dès qu'ils seront ouverts.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {deploiementsActifs.map((dep) => (
              <div
                key={dep.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '24px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                <div style={{ marginBottom: '16px' }}>
                  {dep.nom_sinistre && (
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '6px'
                    }}>
                      <span style={{ marginRight: '6px' }}>🔥</span>
                      <strong>Sinistre :</strong> {dep.nom_sinistre}
                    </div>
                  )}
                  
                  {dep.nom_demande && (
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>📋</span>
                      <strong>Demande :</strong>
                      <span>{dep.nom_demande}</span>
                      {dep.organisme && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {dep.organisme}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '16px'
                }}>
                  <span style={{ marginRight: '8px' }}>🚨</span>
                  {dep.nom_deploiement}
                </div>
                
                <div style={{
                  fontSize: '14px',
                  color: '#4b5563',
                  marginBottom: '20px'
                }}>
                  {dep.date_debut && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ marginRight: '8px' }}>📅</span>
                      {dep.date_fin ? (
                        <>Du {formatDate(dep.date_debut)} au {formatDate(dep.date_fin)}</>
                      ) : (
                        <>À partir du {formatDate(dep.date_debut)}</>
                      )}
                    </div>
                  )}
                  {dep.lieu && (
                    <div>
                      <span style={{ marginRight: '8px' }}>📍</span>
                      {dep.lieu}
                    </div>
                  )}
                </div>
                
                <a
                  href={genererLienJotform(dep.deploiement_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '15px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                >
                  Soumettre ma disponibilité
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '20px' }}>
          ✅ Mes disponibilités soumises
        </h2>
        
        {disponibilites.length === 0 ? (
          <div style={{
            padding: '30px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280', fontSize: '15px' }}>
              Vous n'avez pas encore soumis de disponibilités.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {disponibilites.map((dispo) => (
              <div
                key={dispo.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: '#ffffff'
                }}
              >
                {dispo.nom_sinistre && (
                  <div style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    marginBottom: '4px'
                  }}>
                    <span style={{ marginRight: '6px' }}>🔥</span>
                    <strong>Sinistre :</strong> {dispo.nom_sinistre}
                  </div>
                )}
                
                {dispo.nom_demande && (
                  <div style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>📋</span>
                    <strong>Demande :</strong>
                    <span>{dispo.nom_demande}</span>
                    {dispo.organisme_demande && (
                      <span style={{
                        padding: '1px 6px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        {dispo.organisme_demande}
                      </span>
                    )}
                  </div>
                )}
                
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '12px',
                  marginTop: '8px'
                }}>
                  <span style={{ marginRight: '6px' }}>🚨</span>
                  {dispo.nom_deploiement}
                </div>
                
                {/* BLOC DEBUG - DATES */}
                <div style={{
                  fontSize: '13px',
                  backgroundColor: '#fff3cd',
                  border: '3px solid #ff0000',
                  padding: '12px',
                  marginBottom: '12px',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#000' }}>
                    🔍 DEBUG - INFORMATIONS BRUTES
                  </div>
                  <div style={{ color: '#000', marginBottom: '4px' }}>
                    <strong>ID Supabase:</strong> {dispo.id}
                  </div>
                  <div style={{ color: '#000', marginBottom: '4px' }}>
                    <strong>Monday Item ID:</strong> {dispo.monday_item_id}
                  </div>
                  <div style={{ color: '#000', marginBottom: '4px' }}>
                    <strong>Benevole ID:</strong> {dispo.benevole_id}
                  </div>
                  <div style={{ color: '#000', marginBottom: '4px' }}>
                    <strong>User ID:</strong> {dispo.user_id}
                  </div>
                  <div style={{ color: '#d32f2f', fontWeight: 'bold', marginTop: '8px', marginBottom: '4px' }}>
                    DATES BRUTES (de Supabase):
                  </div>
                  <div style={{ color: '#000', marginBottom: '4px' }}>
                    <strong>date_debut:</strong> {dispo.date_debut}
                  </div>
                  <div style={{ color: '#000', marginBottom: '4px' }}>
                    <strong>date_fin:</strong> {dispo.date_fin}
                  </div>
                  <div style={{ color: '#1976d2', fontWeight: 'bold', marginTop: '8px', marginBottom: '4px' }}>
                    DATES FORMATÉES (affichées):
                  </div>
                  <div style={{ color: '#000' }}>
                    Du {formatDateCourt(dispo.date_debut)} au {formatDateCourt(dispo.date_fin)}
                  </div>
                </div>
                {/* FIN BLOC DEBUG */}
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 12px',
                    backgroundColor: dispo.statut === 'Disponible' ? '#d1fae5' : 
                                   dispo.statut === 'Peut-être' ? '#fef3c7' : '#fee2e2',
                    color: dispo.statut === 'Disponible' ? '#065f46' : 
                           dispo.statut === 'Peut-être' ? '#92400e' : '#991b1b',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {dispo.statut === 'Disponible' ? '✅' : 
                     dispo.statut === 'Peut-être' ? '⚠️' : '❌'} {dispo.statut}
                  </span>
                </div>
                
                {dispo.commentaire && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#4b5563'
                  }}>
                    <strong>Commentaire :</strong> {dispo.commentaire}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}