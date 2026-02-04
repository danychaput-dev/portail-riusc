'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
  photo_url?: string;
}

export default function DisponibilitesPage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [deploiementsActifs, setDeploiementsActifs] = useState<DeploiementActif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // Menu utilisateur
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu utilisateur quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fonction de rafraîchissement des données
  const refreshData = useCallback(async (benevoleId: string) => {
    setRefreshing(true);
    await fetchDisponibilites(benevoleId);
    await fetchDeploiementsActifs();
    setLastRefresh(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    checkUser();
  }, []);

  // Auto-refresh toutes les 30 secondes
  useEffect(() => {
    if (!reserviste) return;
    
    const interval = setInterval(() => {
      refreshData(reserviste.benevole_id);
    }, 30000);

    return () => clearInterval(interval);
  }, [reserviste, refreshData]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    setUser(user);
    
    let reservisteData = null;
    
    // Chercher par email si disponible
    if (user.email) {
      const { data } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom, email, photo_url')
        .ilike('email', user.email)
        .single();
      reservisteData = data;
    }
    
    // Sinon chercher par téléphone
    if (!reservisteData && user.phone) {
      const phoneDigits = user.phone.replace(/\D/g, '');
      const { data } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom, email, photo_url')
        .eq('telephone', phoneDigits)
        .single();
      
      if (!data) {
        const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits;
        const { data: data2 } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, photo_url')
          .eq('telephone', phoneWithout1)
          .single();
        reservisteData = data2;
      } else {
        reservisteData = data;
      }
    }
    
    if (reservisteData) {
      setReserviste(reservisteData);
      await fetchDisponibilites(reservisteData.benevole_id);
      await fetchDeploiementsActifs();
    }
    
    setLoading(false);
  }

  async function fetchDisponibilites(benevoleId: string) {
    const { data } = await supabase
      .from('disponibilites')
      .select('*')
      .eq('benevole_id', benevoleId)
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getInitials = () => {
    if (reserviste) {
      return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  function genererLienJotform(deploiementId: string): string {
    if (!reserviste) return '#';
    return `https://form.jotform.com/253475614808262?BenevoleID=${reserviste.benevole_id}&DeploiementID=${deploiementId}`;
  }

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
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
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric',
      month: 'short'
    };
    return date.toLocaleDateString('fr-CA', options);
  }

  function formatHeure(date: Date): string {
    return date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
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
    );
  }

  if (!reserviste) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h1 style={{ color: '#1e3a5f' }}>Profil non trouvé</h1>
          <p style={{ color: '#6b7280' }}>Votre compte n'est pas encore lié à un profil de réserviste.</p>
          <a href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>Retour à l'accueil</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image
              src="/logo.png"
              alt="Logo RIUSC"
              width={48}
              height={48}
              style={{ borderRadius: '8px' }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>
                Portail RIUSC
              </h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                Réserve d'Intervention d'Urgence
              </p>
            </div>
          </a>
          
          {/* Menu utilisateur */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                  {reserviste.prenom} {reserviste.nom}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Réserviste</div>
              </div>
              {reserviste.photo_url ? (
                <img
                  src={reserviste.photo_url}
                  alt="Photo de profil"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#1e3a5f',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  {getInitials()}
                </div>
              )}
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                border: '1px solid #e5e7eb',
                minWidth: '200px',
                overflow: 'hidden'
              }}>
                <a href="/" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '14px',
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Accueil
                </a>
                <a href="/profil" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '14px',
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Mon profil
                </a>
                <button
                  onClick={handleSignOut}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    color: '#dc2626',
                    backgroundColor: 'white',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Breadcrumb + Refresh */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>
            ← Retour à l'accueil
          </a>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              Mis à jour : {formatHeure(lastRefresh)}
            </span>
            <button
              onClick={() => reserviste && refreshData(reserviste.benevole_id)}
              disabled={refreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: refreshing ? '#9ca3af' : '#1e3a5f',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: refreshing ? 'not-allowed' : 'pointer'
              }}
            >
              {refreshing ? '⏳' : '🔄'} {refreshing ? 'Actualisation...' : 'Rafraîchir'}
            </button>
          </div>
        </div>

        <h2 style={{ 
          color: '#1e3a5f', 
          margin: '0 0 32px 0', 
          fontSize: '28px',
          fontWeight: '700'
        }}>
          Mes disponibilités
        </h2>

        {/* Section Déploiements actifs */}
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
            📋 Déploiements en recherche de réservistes
          </h3>
          
          {deploiementsActifs.length === 0 ? (
            <div style={{
              padding: '30px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#6b7280', fontSize: '15px', margin: 0 }}>
                Aucun déploiement actif pour le moment.
              </p>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px', marginBottom: 0 }}>
                Les nouveaux déploiements apparaîtront ici dès qu'ils seront ouverts.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {deploiementsActifs.map((dep) => (
                <div
                  key={dep.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '20px',
                    backgroundColor: '#fafafa'
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    {dep.nom_sinistre && (
                      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                        <span style={{ marginRight: '6px' }}>🔥</span>
                        <strong>Sinistre :</strong> {dep.nom_sinistre}
                      </div>
                    )}
                    
                    {dep.nom_demande && (
                      <div style={{ fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                  
                  <div style={{ fontSize: '17px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
                    <span style={{ marginRight: '8px' }}>🚨</span>
                    {dep.nom_deploiement}
                  </div>
                  
                  <div style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>
                    {dep.date_debut && (
                      <div style={{ marginBottom: '4px' }}>
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
                      padding: '10px 20px',
                      backgroundColor: '#1e3a5f',
                      color: '#ffffff',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Soumettre ma disponibilité
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section Disponibilités soumises */}
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
            ✅ Mes disponibilités soumises
          </h3>
          
          {disponibilites.length === 0 ? (
            <div style={{
              padding: '30px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#6b7280', fontSize: '15px', margin: 0 }}>
                Vous n'avez pas encore soumis de disponibilités.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {disponibilites.map((dispo) => (
                <div
                  key={dispo.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: '#fafafa'
                  }}
                >
                  {dispo.nom_sinistre && (
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                      <span style={{ marginRight: '6px' }}>🔥</span>
                      <strong>Sinistre :</strong> {dispo.nom_sinistre}
                    </div>
                  )}
                  
                  {dispo.nom_demande && (
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                  
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '10px', marginTop: '6px' }}>
                    <span style={{ marginRight: '6px' }}>🚨</span>
                    {dispo.nom_deploiement}
                  </div>
                  
                  <div style={{ fontSize: '14px', color: '#4b5563', marginBottom: '10px' }}>
                    {dispo.date_debut && dispo.date_fin ? (
                      <>
                        <span style={{ marginRight: '6px' }}>📅</span>
                        Du {formatDateCourt(dispo.date_debut)} au {formatDateCourt(dispo.date_fin)}
                      </>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>Aucune date spécifiée</span>
                    )}
                  </div>
                  
                  <span style={{
                    display: 'inline-block',
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
                  
                  {dispo.commentaire && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px',
                      backgroundColor: '#f3f4f6',
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

        {/* Indicateur auto-refresh */}
        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#9ca3af'
        }}>
          🔄 Actualisation automatique toutes les 30 secondes
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '24px',
        textAlign: 'center',
        marginTop: '60px'
      }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          © 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage
        </p>
      </footer>
    </div>
  );
}
