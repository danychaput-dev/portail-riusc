'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import PortailHeader from '@/app/components/PortailHeader';
import ImpersonateBanner from '@/app/components/ImpersonateBanner';
import { logPageVisit } from '@/utils/logEvent';
import { isDemoActive, DEMO_RESERVISTE, DEMO_USER, DEMO_DEPLOIEMENTS, DEMO_DISPONIBILITES } from '@/utils/demoMode';

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
  transport?: string;
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
  const [demoToast, setDemoToast] = useState<string | null>(null);

  const showDemoToast = (msg: string) => {
    setDemoToast(msg);
    setTimeout(() => setDemoToast(null), 3000);
  };

  const refreshData = useCallback(async (benevoleId: string) => {
    setRefreshing(true);
    await fetchDisponibilites(benevoleId);
    await fetchDeploiementsActifs(benevoleId);
    await fetchCiblageReponses(benevoleId);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => { checkUser(); }, []);

  useEffect(() => {
    if (!reserviste) return;
    const interval = setInterval(() => { refreshData(reserviste.benevole_id); }, 30000);
    return () => clearInterval(interval);
  }, [reserviste, refreshData]);

  async function checkUser() {
    // 🎯 MODE DÉMO
    if (isDemoActive()) {
      setUser(DEMO_USER);
      const demoRes = { ...DEMO_RESERVISTE, groupe: 'Approuvé' };
      setReserviste(demoRes as any);
      setDeploiementsActifs(DEMO_DEPLOIEMENTS as any);
      setCiblages(['demo-dep-1']);
      setDisponibilites(DEMO_DISPONIBILITES as any);
      setCiblageReponses([]);
      logPageVisit('/disponibilites/soumettre');
      setLoading(false);
      return;
    }

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
    logPageVisit('/disponibilites/soumettre');
    setLoading(false);
  }

  async function fetchDisponibilites(benevoleId: string) {
    const { data } = await supabase.from('disponibilites').select('*').eq('benevole_id', benevoleId).eq('statut_version', 'Active').order('date_debut', { ascending: true });
    if (data) setDisponibilites(data);
  }

  async function fetchDeploiementsActifs(benevoleId: string) {
    const { data: ciblagesData } = await supabase.from('ciblages').select('deploiement_id').eq('benevole_id', benevoleId);
    if (!ciblagesData || ciblagesData.length === 0) { setDeploiementsActifs([]); setCiblages([]); return; }
    const deployIds = ciblagesData.map(c => c.deploiement_id);
    setCiblages(deployIds);
    const { data } = await supabase.from('deploiements_actifs').select('*').in('deploiement_id', deployIds).order('date_debut', { ascending: true });
    if (data) setDeploiementsActifs(data);
  }

  async function fetchCiblageReponses(benevoleId: string) {
    const { data } = await supabase.from('ciblages').select('id, benevole_id, deploiement_id, statut_envoi, date_disponible_debut, date_disponible_fin, transport, commentaires').eq('benevole_id', benevoleId).in('statut_envoi', ['Répondu', 'Non disponible', 'En attente']);
    if (data && data.length > 0) {
      const deployIds = data.map(c => c.deploiement_id);
      const { data: deps } = await supabase.from('deploiements_actifs').select('deploiement_id, nom_deploiement, nom_sinistre').in('deploiement_id', deployIds);
      const depMap: Record<string, { nom_deploiement: string; nom_sinistre?: string }> = {};
      if (deps) deps.forEach(d => { depMap[d.deploiement_id] = d; });
      const enriched = data.map(c => ({ ...c, nom_deploiement: depMap[c.deploiement_id]?.nom_deploiement || 'Déploiement', nom_sinistre: depMap[c.deploiement_id]?.nom_sinistre || undefined }));
      setCiblageReponses(enriched);
    } else { setCiblageReponses([]); }
  }

  const handleConfirmer = async (dispo: Disponibilite) => {
    if (!reserviste) return;
    if (isDemoActive()) { showDemoToast('✅ Mode démo — Confirmation simulée'); return; }
    setActionLoading(`confirmer-${dispo.id}`);
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-disponibilite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id: reserviste.benevole_id, deploiement_id: dispo.deploiement_id, prenom: reserviste.prenom, nom: reserviste.nom, email: reserviste.email, telephone: null, date_debut: dispo.date_debut, date_fin: dispo.date_fin, transport: dispo.transport, commentaires: dispo.commentaire || null, statut: 'Disponible' })
      });
      if (response.ok) await refreshData(reserviste.benevole_id);
    } catch (e) { console.error('Erreur confirmation:', e); }
    setActionLoading(null);
  };

  const handleAnnuler = async (dispo: Disponibilite) => {
    if (!reserviste) return;
    if (isDemoActive()) { showDemoToast('❌ Mode démo — Annulation simulée'); return; }
    if (!confirm('Êtes-vous sûr de vouloir annuler cette plage de disponibilité ?')) return;
    setActionLoading(`annuler-${dispo.id}`);
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-disponibilite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id: reserviste.benevole_id, deploiement_id: dispo.deploiement_id, prenom: reserviste.prenom, nom: reserviste.nom, email: reserviste.email, telephone: null, date_debut: null, date_fin: null, transport: null, commentaires: 'Annulé par le réserviste', statut: 'Non disponible' })
      });
      if (response.ok) await refreshData(reserviste.benevole_id);
    } catch (e) { console.error('Erreur annulation:', e); }
    setActionLoading(null);
  };

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatDateCourt(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
  }

  function formatHeure(date: Date): string {
    return date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  }

  function labelTransport(t: string): string {
    return t === 'autonome' ? 'Autonome' : t === 'covoiturage_offre' ? 'Offre covoiturage' : t === 'covoiturage_recherche' ? 'Recherche covoiturage' : t === 'besoin_transport' ? 'Besoin transport' : t;
  }

  // ── Grouper les disponibilités par deploiement_id ────────────────────────
  const disponibilitesParDeploi = disponibilites.reduce((groups: Record<string, Disponibilite[]>, dispo) => {
    const key = dispo.deploiement_id;
    if (!groups[key]) groups[key] = [];
    groups[key].push(dispo);
    return groups;
  }, {});

  // ── Grouper les "Non disponible" par deploiement_id ──────────────────────
  const nonDispoParDeploi = ciblageReponses
    .filter(r => r.statut_envoi === 'Non disponible')
    .reduce((groups: Record<string, CiblageReponse>, r) => {
      // On garde seulement un enregistrement par déploiement (pas de plages)
      if (!groups[r.deploiement_id]) groups[r.deploiement_id] = r;
      return groups;
    }, {});

  const hasReponses = disponibilites.length > 0 || Object.keys(nonDispoParDeploi).length > 0;

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

      {/* ── Header ── */}
      <PortailHeader subtitle="Mes disponibilités" />

      <ImpersonateBanner />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour à l&apos;accueil</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Mis à jour : {formatHeure(lastRefresh)}</span>
            <button onClick={() => reserviste && refreshData(reserviste.benevole_id)} disabled={refreshing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: refreshing ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: refreshing ? 'not-allowed' : 'pointer' }}>
              {refreshing ? '⏳' : '🔄'} {refreshing ? 'Actualisation...' : 'Rafraîchir'}
            </button>
          </div>
        </div>

        <h2 style={{ color: '#1e3a5f', margin: '0 0 32px 0', fontSize: '28px', fontWeight: '700' }}>Mes disponibilités</h2>

        {/* ── Déploiements actifs — groupés par sinistre ── */}
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
                          {deps[0].organisme && <span style={{ padding: '1px 6px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '3px', fontSize: '11px', fontWeight: '500' }}>{deps[0].organisme}</span>}
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
                    <a href={`/disponibilites/soumettre?deploiement=${deps[0].deploiement_id}`}
                      style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
                      Soumettre mes disponibilités
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Mes réponses — groupées par déploiement ── */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>✅ Mes réponses</h3>

          {!hasReponses ? (
            <div style={{ padding: '30px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ color: '#6b7280', fontSize: '15px', margin: 0 }}>Vous n&apos;avez pas encore soumis de disponibilités.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Plages actives, groupées par déploiement */}
              {Object.entries(disponibilitesParDeploi).map(([deploiementId, plages]) => {
                const first = plages[0];
                return (
                  <div key={deploiementId} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#fafafa' }}>

                    {/* En-tête sinistre + déploiement — affiché une seule fois */}
                    <div style={{ padding: '14px 20px', backgroundColor: '#f0f4f8', borderBottom: '1px solid #e5e7eb' }}>
                      {first.nom_sinistre && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🔥 {first.nom_sinistre}
                        </div>
                      )}
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🚨 {first.nom_deploiement}
                      </div>
                    </div>

                    {/* Liste des plages */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {plages.map((dispo, idx) => (
                        <div key={dispo.id} style={{ padding: '14px 20px', borderBottom: idx < plages.length - 1 ? '1px solid #f3f4f6' : 'none' }}>

                          {/* Ligne principale : date | statut | transport | boutons */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>

                            {/* Infos de gauche */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                              {dispo.date_debut && dispo.date_fin && (
                                <span style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                                  📅 Du {formatDateCourt(dispo.date_debut)} au {formatDateCourt(dispo.date_fin)}
                                </span>
                              )}
                              <span style={{
                                display: 'inline-block', padding: '3px 10px',
                                backgroundColor: dispo.statut === 'Disponible' ? '#d1fae5' : dispo.statut === 'En attente' ? '#fef3c7' : '#fee2e2',
                                color: dispo.statut === 'Disponible' ? '#065f46' : dispo.statut === 'En attente' ? '#92400e' : '#991b1b',
                                borderRadius: '6px', fontSize: '12px', fontWeight: '600'
                              }}>
                                {dispo.statut === 'Disponible' ? '✅ Disponible' : dispo.statut === 'En attente' ? '⏳ En attente' : '❌ ' + dispo.statut}
                              </span>
                              {dispo.transport && (
                                <span style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  🚗 {labelTransport(dispo.transport)}
                                </span>
                              )}
                            </div>

                            {/* Boutons d'action */}
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                              {dispo.statut === 'En attente' && (
                                <button onClick={() => handleConfirmer(dispo)} disabled={actionLoading === `confirmer-${dispo.id}`}
                                  style={{ padding: '7px 14px', fontSize: '13px', fontWeight: '600', backgroundColor: actionLoading === `confirmer-${dispo.id}` ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: actionLoading === `confirmer-${dispo.id}` ? 'not-allowed' : 'pointer' }}>
                                  {actionLoading === `confirmer-${dispo.id}` ? '⏳' : '✅ Confirmer'}
                                </button>
                              )}
                              <a href={`/disponibilites/soumettre?deploiement=${dispo.deploiement_id}`}
                                style={{ padding: '7px 14px', fontSize: '13px', fontWeight: '600', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>
                                ✏️ Modifier
                              </a>
                              <button onClick={() => handleAnnuler(dispo)} disabled={actionLoading === `annuler-${dispo.id}`}
                                style={{ padding: '7px 14px', fontSize: '13px', fontWeight: '500', backgroundColor: 'white', color: actionLoading === `annuler-${dispo.id}` ? '#9ca3af' : '#dc2626', border: `1px solid ${actionLoading === `annuler-${dispo.id}` ? '#d1d5db' : '#dc2626'}`, borderRadius: '6px', cursor: actionLoading === `annuler-${dispo.id}` ? 'not-allowed' : 'pointer' }}>
                                {actionLoading === `annuler-${dispo.id}` ? '⏳' : '❌ Annuler'}
                              </button>
                            </div>
                          </div>

                          {/* Commentaire — pleine largeur en dessous */}
                          {dispo.commentaire && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e5e7eb', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                              💬 {dispo.commentaire}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Pied de carte : ajouter une plage */}
                    <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'flex-end' }}>
                      <a href={`/disponibilites/soumettre?deploiement=${deploiementId}`}
                        style={{ fontSize: '13px', fontWeight: '500', color: '#1e3a5f', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', border: '1px solid #1e3a5f', borderRadius: '6px', backgroundColor: 'white' }}>
                        + Ajouter une plage
                      </a>
                    </div>
                  </div>
                );
              })}

              {/* Réponses "Non disponible" (sans plages) */}
              {Object.values(nonDispoParDeploi).map((rep) => (
                <div key={`nd-${rep.id}`} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#fafafa' }}>
                  <div style={{ padding: '14px 20px', backgroundColor: '#f0f4f8', borderBottom: '1px solid #e5e7eb' }}>
                    {rep.nom_sinistre && (
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>🔥 {rep.nom_sinistre}</div>
                    )}
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>🚨 {rep.nom_deploiement}</div>
                  </div>
                  <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                      ❌ Non disponible
                    </span>
                    {rep.commentaires && (
                      <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>💬 {rep.commentaires}</span>
                    )}
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
          🔄 Actualisation automatique toutes les 30 secondes
        </div>
      </main>

      <ImpersonateBanner position="bottom" />

      {demoToast && (
        <div style={{ position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1e3a5f', color: 'white', padding: '14px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '500', zIndex: 10000, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', maxWidth: '500px', textAlign: 'center' }}>
          {demoToast}
        </div>
      )}

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  );
}
