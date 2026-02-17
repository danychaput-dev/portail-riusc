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

interface CiblageReponse {
  id: string;
  benevole_id: string;
  deploiement_id: string;
  statut_envoi: string;
  date_disponible_debut?: string;
  date_disponible_fin?: string;
  transport?: string;
  commentaires?: string;
  nom_deploiement?: string;
  nom_sinistre?: string;
}

export default function DisponibilitesPage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [deploiementsActifs, setDeploiementsActifs] = useState<DeploiementActif[]>([]);
  const [ciblages, setCiblages] = useState<string[]>([]);
  const [ciblageReponses, setCiblageReponses] = useState<CiblageReponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshData = useCallback(async (benevoleId: string) => {
    setRefreshing(true);
    await fetchDisponibilites(benevoleId);
    await fetchDeploiementsActifs(benevoleId);
    await fetchCiblageReponses(benevoleId);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (!reserviste) return;
    const interval = setInterval(() => {
      refreshData(reserviste.benevole_id);
    }, 30000);
    return () => clearInterval(interval);
  }, [reserviste, refreshData]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    
    let reservisteData = null;
    if (user.email) {
      const { data } = await supabase.from('reservistes').select('benevole_id, prenom, nom, email, photo_url').ilike('email', user.email).single();
      reservisteData = data;
    }
    if (!reservisteData && user.phone) {
      const phoneDigits = user.phone.replace(/\D/g, '');
      const { data } = await supabase.from('reservistes').select('benevole_id, prenom, nom, email, photo_url').eq('telephone', phoneDigits).single();
      if (!data) {
        const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits;
        const { data: data2 } = await supabase.from('reservistes').select('benevole_id, prenom, nom, email, photo_url').eq('telephone', phoneWithout1).single();
        reservisteData = data2;
      } else { reservisteData = data; }
    }
    if (reservisteData) {
      setReserviste(reservisteData);
      await fetchDisponibilites(reservisteData.benevole_id);
      await fetchDeploiementsActifs(reservisteData.benevole_id);
      await fetchCiblageReponses(reservisteData.benevole_id);
    }
    setLoading(false);
  }

  async function fetchDisponibilites(benevoleId: string) {
    const { data } = await supabase.from('disponibilites').select('*').eq('benevole_id', benevoleId).eq('statut_version', 'Active').order('date_debut', { ascending: false });
    if (data) setDisponibilites(data);
  }

  async function fetchDeploiementsActifs(benevoleId: string) {
    const { data: ciblagesData } = await supabase.from('ciblages').select('deploiement_id').eq('benevole_id', benevoleId);
    if (!ciblagesData || ciblagesData.length === 0) { setDeploiementsActifs([]); setCiblages([]); return; }
    const deployIds = ciblagesData.map(c => c.deploiement_id);
    setCiblages(deployIds);
    const { data, error } = await supabase.from('deploiements_actifs').select('*').in('deploiement_id', deployIds).order('date_debut', { ascending: true });
    if (error) console.error('Erreur fetch déploiements:', error);
    if (data) setDeploiementsActifs(data);
  }

  async function fetchCiblageReponses(benevoleId: string) {
    const { data } = await supabase
      .from('ciblages')
      .select('id, benevole_id, deploiement_id, statut_envoi, date_disponible_debut, date_disponible_fin, transport, commentaires')
      .eq('benevole_id', benevoleId)
      .in('statut_envoi', ['Répondu', 'Non disponible', 'En attente']);
    
    if (data && data.length > 0) {
      // Enrichir avec les noms des déploiements
      const deployIds = data.map(c => c.deploiement_id);
      const { data: deps } = await supabase
        .from('deploiements_actifs')
        .select('deploiement_id, nom_deploiement, nom_sinistre')
        .in('deploiement_id', deployIds);
      
      const depMap: Record<string, { nom_deploiement: string; nom_sinistre?: string }> = {};
      if (deps) deps.forEach(d => { depMap[d.deploiement_id] = d; });

      const enriched = data.map(c => ({
        ...c,
        nom_deploiement: depMap[c.deploiement_id]?.nom_deploiement || 'Déploiement',
        nom_sinistre: depMap[c.deploiement_id]?.nom_sinistre || undefined
      }));
      setCiblageReponses(enriched);
    } else {
      setCiblageReponses([]);
    }
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/login'); };

  // Confirmer une dispo "En attente" → "Répondu"
  const handleConfirmer = async (rep: CiblageReponse) => {
    if (!reserviste) return;
    setActionLoading(`confirmer-${rep.id}`);
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-disponibilite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          deploiement_id: rep.deploiement_id,
          prenom: reserviste.prenom,
          nom: reserviste.nom,
          email: reserviste.email,
          telephone: null,
          date_debut: rep.date_disponible_debut,
          date_fin: rep.date_disponible_fin,
          transport: rep.transport,
          commentaires: rep.commentaires || null,
          statut: 'Disponible'
        })
      });
      if (response.ok) {
        await refreshData(reserviste.benevole_id);
      }
    } catch (e) {
      console.error('Erreur confirmation:', e);
    }
    setActionLoading(null);
  };

  // Annuler une dispo → "Non disponible"
  const handleAnnuler = async (rep: CiblageReponse) => {
    if (!reserviste) return;
    if (!confirm('Êtes-vous sûr de vouloir annuler votre disponibilité ?')) return;
    setActionLoading(`annuler-${rep.id}`);
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-disponibilite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          deploiement_id: rep.deploiement_id,
          prenom: reserviste.prenom,
          nom: reserviste.nom,
          email: reserviste.email,
          telephone: null,
          date_debut: null,
          date_fin: null,
          transport: null,
          commentaires: 'Annulé par le réserviste',
          statut: 'Non disponible'
        })
      });
      if (response.ok) {
        await refreshData(reserviste.benevole_id);
      }
    } catch (e) {
      console.error('Erreur annulation:', e);
    }
    setActionLoading(null);
  };

  const getInitials = () => {
    if (reserviste) return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase();
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  function genererLienDisponibilite(deploiementId: string): string {
    if (!reserviste) return '#';
    return `/disponibilites/soumettre?deploiement=${deploiementId}`;
  }

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatDateCourt(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
  }

  function formatHeure(date: Date): string {
    return date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  }

  if (loading) {
    return (<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>Chargement...</div>);
  }

  if (!reserviste) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h1 style={{ color: '#1e3a5f' }}>Profil non trouvé</h1>
          <p style={{ color: '#6b7280' }}>Votre compte n&apos;est pas encore lié à un profil de réserviste.</p>
          <a href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>Retour à l&apos;accueil</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Réserve d&apos;Intervention d&apos;Urgence</p>
            </div>
          </a>
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowUserMenu(!showUserMenu)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{reserviste.prenom} {reserviste.nom}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Réserviste</div>
              </div>
              {reserviste.photo_url ? (
                <img src={reserviste.photo_url} alt="Photo de profil" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px' }}>{getInitials()}</div>
              )}
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', minWidth: '200px', overflow: 'hidden' }}>
                <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  Accueil
                </a>
                <a href="/profil" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Mon profil
                </a>
                <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#dc2626', backgroundColor: 'white', border: 'none', width: '100%', textAlign: 'left', fontSize: '14px', cursor: 'pointer' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour à l&apos;accueil</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Mis à jour : {formatHeure(lastRefresh)}</span>
            <button onClick={() => reserviste && refreshData(reserviste.benevole_id)} disabled={refreshing} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: refreshing ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: refreshing ? 'not-allowed' : 'pointer' }}>
              {refreshing ? '⏳' : '🔄'} {refreshing ? 'Actualisation...' : 'Rafraîchir'}
            </button>
          </div>
        </div>

        <h2 style={{ color: '#1e3a5f', margin: '0 0 32px 0', fontSize: '28px', fontWeight: '700' }}>Mes disponibilités</h2>

        {/* Section Déploiements actifs — groupés par sinistre */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
            {deploiementsActifs.length > 0 ? '📋 Appel à participation – Déploiement possible' : '📋 Déploiements'}
          </h3>
          
          {deploiementsActifs.length === 0 ? (
            <div style={{ padding: '30px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
              <p style={{ color: '#374151', fontSize: '15px', margin: '0 0 8px 0', fontWeight: '500' }}>Aucun appel en cours pour le moment</p>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>Lorsqu&apos;un déploiement nécessitera votre profil, vous en serez informé ici.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(
                deploiementsActifs.reduce((groups: Record<string, DeploiementActif[]>, dep) => {
                  const key = dep.nom_sinistre || dep.nom_deploiement;
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(dep);
                  return groups;
                }, {})
              ).map(([sinistre, deps]) => (
                <div key={sinistre} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#fafafa' }}>
                  <div style={{ padding: '16px 20px', backgroundColor: '#f0f4f8', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>🔥</span>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a5f' }}>{sinistre}</div>
                      {deps[0].nom_demande && (
                        <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          📋 {deps[0].nom_demande}
                          {deps[0].organisme && (
                            <span style={{ padding: '1px 6px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '3px', fontSize: '11px', fontWeight: '500' }}>{deps[0].organisme}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {deps[0].date_debut && (
                    <div style={{ padding: '10px 20px', fontSize: '13px', color: '#6b7280', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span>📅 {formatDate(deps[0].date_debut)}{deps[0].date_fin && ` — ${formatDate(deps[0].date_fin)}`}</span>
                      {deps[0].lieu && <span>📍 {deps[0].lieu}</span>}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {deps.map((dep, idx) => (
                      <div key={dep.id} style={{ padding: '14px 20px', borderBottom: idx < deps.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>🚨 {dep.nom_deploiement}</div>
                          {dep.lieu && deps[0].lieu !== dep.lieu && <div style={{ fontSize: '13px', color: '#6b7280' }}>📍 {dep.lieu}</div>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', textAlign: 'center' }}>
                    <a href={genererLienDisponibilite(deps[0].deploiement_id)} style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600', transition: 'background-color 0.2s' }}>
                      Soumettre mes disponibilités
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section Disponibilités soumises */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>✅ Mes réponses</h3>
          
          {disponibilites.length === 0 && ciblageReponses.length === 0 ? (
            <div style={{ padding: '30px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ color: '#6b7280', fontSize: '15px', margin: 0 }}>Vous n&apos;avez pas encore soumis de disponibilités.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Réponses via nouveau formulaire (ciblages) */}
              {ciblageReponses.map((rep) => (
                <div key={rep.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: '#fafafa' }}>
                  {rep.nom_sinistre && (
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                      <span style={{ marginRight: '6px' }}>🔥</span><strong>Sinistre :</strong> {rep.nom_sinistre}
                    </div>
                  )}
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '10px', marginTop: '6px' }}>
                    <span style={{ marginRight: '6px' }}>🚨</span>{rep.nom_deploiement}
                  </div>
                  {rep.date_disponible_debut && rep.date_disponible_fin && (
                    <div style={{ fontSize: '14px', color: '#4b5563', marginBottom: '10px' }}>
                      <span style={{ marginRight: '6px' }}>📅</span>Du {formatDateCourt(rep.date_disponible_debut)} au {formatDateCourt(rep.date_disponible_fin)}
                    </div>
                  )}
                  {rep.transport && (
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>
                      🚗 {rep.transport === 'autonome' ? 'Autonome' : rep.transport === 'covoiturage_offre' ? 'Offre covoiturage' : rep.transport === 'covoiturage_recherche' ? 'Recherche covoiturage' : 'Besoin transport'}
                    </div>
                  )}
                  <span style={{
                    display: 'inline-block', padding: '4px 12px',
                    backgroundColor: rep.statut_envoi === 'Répondu' ? '#d1fae5' : rep.statut_envoi === 'En attente' ? '#fef3c7' : '#fee2e2',
                    color: rep.statut_envoi === 'Répondu' ? '#065f46' : rep.statut_envoi === 'En attente' ? '#92400e' : '#991b1b',
                    borderRadius: '6px', fontSize: '13px', fontWeight: '500'
                  }}>
                    {rep.statut_envoi === 'Répondu' ? '✅ Disponible' : rep.statut_envoi === 'En attente' ? '⏳ En attente de confirmation' : '❌ Non disponible'}
                  </span>
                  {rep.commentaires && (
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '13px', color: '#4b5563' }}>
                      <strong>Commentaire :</strong> {rep.commentaires}
                    </div>
                  )}

                  {/* Boutons d'action */}
                  {rep.statut_envoi !== 'Non disponible' && (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {/* En attente → Confirmer */}
                      {rep.statut_envoi === 'En attente' && (
                        <button
                          onClick={() => handleConfirmer(rep)}
                          disabled={actionLoading === `confirmer-${rep.id}`}
                          style={{
                            padding: '8px 16px', fontSize: '13px', fontWeight: '600',
                            backgroundColor: actionLoading === `confirmer-${rep.id}` ? '#9ca3af' : '#059669',
                            color: 'white', border: 'none', borderRadius: '6px',
                            cursor: actionLoading === `confirmer-${rep.id}` ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {actionLoading === `confirmer-${rep.id}` ? '⏳ Confirmation...' : '✅ Confirmer ma disponibilité'}
                        </button>
                      )}

                      {/* Répondu → Modifier */}
                      {rep.statut_envoi === 'Répondu' && (
                        <a
                          href={`/disponibilites/soumettre?deploiement=${rep.deploiement_id}`}
                          style={{
                            padding: '8px 16px', fontSize: '13px', fontWeight: '600',
                            backgroundColor: '#1e3a5f', color: 'white',
                            border: 'none', borderRadius: '6px', textDecoration: 'none',
                            display: 'inline-block'
                          }}
                        >
                          ✏️ Modifier
                        </a>
                      )}

                      {/* Annuler (pour Répondu et En attente) */}
                      <button
                        onClick={() => handleAnnuler(rep)}
                        disabled={actionLoading === `annuler-${rep.id}`}
                        style={{
                          padding: '8px 16px', fontSize: '13px', fontWeight: '500',
                          backgroundColor: 'white',
                          color: actionLoading === `annuler-${rep.id}` ? '#9ca3af' : '#dc2626',
                          border: `1px solid ${actionLoading === `annuler-${rep.id}` ? '#d1d5db' : '#dc2626'}`,
                          borderRadius: '6px',
                          cursor: actionLoading === `annuler-${rep.id}` ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {actionLoading === `annuler-${rep.id}` ? '⏳ Annulation...' : '❌ Annuler'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Anciennes disponibilités (JotForm) */}
              {disponibilites.map((dispo) => (
                <div key={dispo.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: '#fafafa' }}>
                  {dispo.nom_sinistre && (
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                      <span style={{ marginRight: '6px' }}>🔥</span><strong>Sinistre :</strong> {dispo.nom_sinistre}
                    </div>
                  )}
                  {dispo.nom_demande && (
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>📋</span><strong>Demande :</strong><span>{dispo.nom_demande}</span>
                      {dispo.organisme_demande && (
                        <span style={{ padding: '1px 6px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '3px', fontSize: '11px', fontWeight: '500' }}>{dispo.organisme_demande}</span>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '10px', marginTop: '6px' }}>
                    <span style={{ marginRight: '6px' }}>🚨</span>{dispo.nom_deploiement}
                  </div>
                  <div style={{ fontSize: '14px', color: '#4b5563', marginBottom: '10px' }}>
                    {dispo.date_debut && dispo.date_fin ? (
                      <><span style={{ marginRight: '6px' }}>📅</span>Du {formatDateCourt(dispo.date_debut)} au {formatDateCourt(dispo.date_fin)}</>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>Aucune date spécifiée</span>
                    )}
                  </div>
                  <span style={{
                    display: 'inline-block', padding: '4px 12px',
                    backgroundColor: dispo.statut === 'Disponible' ? '#d1fae5' : dispo.statut === 'Peut-être' ? '#fef3c7' : '#fee2e2',
                    color: dispo.statut === 'Disponible' ? '#065f46' : dispo.statut === 'Peut-être' ? '#92400e' : '#991b1b',
                    borderRadius: '6px', fontSize: '13px', fontWeight: '500'
                  }}>
                    {dispo.statut === 'Disponible' ? '✅' : dispo.statut === 'Peut-être' ? '⚠️' : '❌'} {dispo.statut}
                  </span>
                  {dispo.commentaire && (
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '13px', color: '#4b5563' }}>
                      <strong>Commentaire :</strong> {dispo.commentaire}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
          🔄 Actualisation automatique toutes les 30 secondes
        </div>
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  );
}
