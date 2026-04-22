'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import PortailHeader from '@/app/components/PortailHeader';
import ImpersonateBanner from '@/app/components/ImpersonateBanner';
import { logPageVisit } from '@/utils/logEvent';
import { isDemoActive, DEMO_RESERVISTE, DEMO_USER, DEMO_DEPLOIEMENTS, DEMO_DISPONIBILITES } from '@/utils/demoMode';
import type { Reserviste, Disponibilite, DeploiementActif, CiblageReponse } from '@/types';
import { StatusBadge } from '@/app/components/ui';

interface Mobilisation {
  ciblage_id: string;
  deployment_id: string;
  identifiant: string;
  nom: string;
  lieu: string | null;
  date_debut: string | null;
  date_fin: string | null;
  point_rassemblement: string | null;
  statut: string;
  vagues: {
    id: string;
    identifiant: string | null;
    numero: number;
    date_debut: string;
    date_fin: string;
  }[];
}

export default function DisponibilitesPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'mobilisations' ? 'mobilisations' : 'dispos';

  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [deploiementsActifs, setDeploiementsActifs] = useState<DeploiementActif[]>([]);
  const [ciblages, setCiblages] = useState<string[]>([]);
  const [ciblageReponses, setCiblageReponses] = useState<CiblageReponse[]>([]);
  const [mobilisations, setMobilisations] = useState<Mobilisation[]>([]);
  const [tab, setTab] = useState<'dispos' | 'mobilisations'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [demoToast, setDemoToast] = useState<string | null>(null);

  // Sync tab → URL (pour partager les liens et éviter de perdre l'onglet au refresh)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (tab === 'mobilisations') p.set('tab', 'mobilisations');
    else p.delete('tab');
    const qs = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
  }, [tab]);

  const showDemoToast = (msg: string) => {
    setDemoToast(msg);
    setTimeout(() => setDemoToast(null), 3000);
  };

  const refreshData = useCallback(async (benevoleId: string) => {
    setRefreshing(true);
    await fetchDisponibilites(benevoleId);
    await fetchDeploiementsActifs(benevoleId);
    await fetchCiblageReponses(benevoleId);
    await fetchMobilisations(benevoleId);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => { checkUser(); }, []);

  // Auto-refresh toutes les 2 min — pause quand l'onglet est caché (économie Vercel)
  useEffect(() => {
    if (!reserviste) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const doRefresh = () => { if (!document.hidden) refreshData(reserviste.benevole_id); };
    const start = () => { interval = setInterval(doRefresh, 120000); }; // 2 min
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const handleVisibility = () => { if (document.hidden) { stop(); } else { doRefresh(); start(); } };
    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', handleVisibility); };
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
      await fetchMobilisations(reservisteData.benevole_id);
    }
    logPageVisit('/disponibilites/soumettre');
    setLoading(false);
  }

  async function fetchMobilisations(benevoleId: string) {
    const { data: ciblagesData } = await supabase.from('ciblages')
      .select('id, reference_id, statut')
      .eq('benevole_id', benevoleId)
      .eq('niveau', 'deploiement')
      .in('statut', ['mobilise', 'confirme']);
    if (!ciblagesData?.length) { setMobilisations([]); return; }
    const depIds = ciblagesData.map((c: any) => c.reference_id);
    const [{ data: deps }, { data: vagues }] = await Promise.all([
      supabase.from('deployments')
        .select('id, identifiant, nom, lieu, date_debut, date_fin, statut, point_rassemblement')
        .in('id', depIds),
      supabase.from('vagues')
        .select('id, deployment_id, identifiant, numero, date_debut, date_fin')
        .in('deployment_id', depIds)
        .order('numero'),
    ]);
    const vaguesParDep: Record<string, Mobilisation['vagues']> = {};
    for (const v of vagues || []) {
      if (!vaguesParDep[v.deployment_id]) vaguesParDep[v.deployment_id] = [];
      vaguesParDep[v.deployment_id].push({
        id: v.id, identifiant: v.identifiant, numero: v.numero,
        date_debut: v.date_debut, date_fin: v.date_fin,
      });
    }
    const mobs: Mobilisation[] = (deps || []).map((d: any) => {
      const ciblage = ciblagesData.find((c: any) => c.reference_id === d.id);
      return {
        ciblage_id: ciblage?.id || '',
        deployment_id: d.id, identifiant: d.identifiant, nom: d.nom,
        lieu: d.lieu, date_debut: d.date_debut, date_fin: d.date_fin,
        point_rassemblement: d.point_rassemblement, statut: ciblage?.statut || 'mobilise',
        vagues: vaguesParDep[d.id] || [],
      };
    });
    setMobilisations(mobs);
  }

  async function fetchDisponibilites(benevoleId: string) {
    // Lire depuis disponibilites_v2 (nouveau système)
    const { data: v2data } = await supabase.from('disponibilites_v2')
      .select('id, benevole_id, deployment_id, date_jour, disponible, a_confirmer, commentaire')
      .eq('benevole_id', benevoleId).order('date_jour', { ascending: true });
    if (v2data && v2data.length > 0) {
      // Grouper les jours consécutifs en plages par deployment_id
      const grouped: Record<string, typeof v2data> = {};
      for (const d of v2data) {
        const key = d.deployment_id + '_' + (d.a_confirmer ? 'aconfirmer' : d.disponible ? 'dispo' : 'nondispo');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(d);
      }
      const plages: any[] = [];
      for (const rows of Object.values(grouped)) {
        const sorted = rows.sort((a, b) => a.date_jour.localeCompare(b.date_jour));
        let start = sorted[0].date_jour;
        let end = sorted[0].date_jour;
        for (let i = 1; i < sorted.length; i++) {
          const prev = new Date(end); prev.setDate(prev.getDate() + 1);
          const cur = new Date(sorted[i].date_jour);
          if (prev.toISOString().split('T')[0] === sorted[i].date_jour) {
            end = sorted[i].date_jour;
          } else {
            plages.push({ id: sorted[0].id, benevole_id: sorted[0].benevole_id, deploiement_id: sorted[0].deployment_id,
              date_debut: start, date_fin: end, statut: sorted[0].a_confirmer ? 'En attente' : sorted[0].disponible ? 'Disponible' : 'Non disponible',
              commentaire: sorted[0].commentaire, transport: null });
            start = sorted[i].date_jour; end = sorted[i].date_jour;
          }
        }
        plages.push({ id: sorted[0].id, benevole_id: sorted[0].benevole_id, deploiement_id: sorted[0].deployment_id,
          date_debut: start, date_fin: end, statut: sorted[0].a_confirmer ? 'En attente' : sorted[0].disponible ? 'Disponible' : 'Non disponible',
          commentaire: sorted[0].commentaire, transport: null });
      }
      setDisponibilites(plages);
    }
  }

  async function fetchDeploiementsActifs(benevoleId: string) {
    const { data: ciblagesData } = await supabase.from('ciblages').select('reference_id').eq('benevole_id', benevoleId).eq('niveau', 'deploiement').eq('statut', 'notifie');
    if (!ciblagesData || ciblagesData.length === 0) { setDeploiementsActifs([]); setCiblages([]); return; }
    const deployIds = ciblagesData.map((c: any) => c.reference_id);
    setCiblages(deployIds);
    const { data } = await supabase.from('deployments').select('id, identifiant, nom, lieu, date_debut, date_fin, statut').in('id', deployIds);
    if (data) setDeploiementsActifs(data.map((d: any) => ({ id: d.id, deploiement_id: d.id, nom_deploiement: d.nom, lieu: d.lieu, date_debut: d.date_debut, date_fin: d.date_fin, statut: d.statut })) as any);
  }

  async function fetchCiblageReponses(_benevoleId: string) {
    setCiblageReponses([]);
  }

  const handleConfirmer = async (dispo: Disponibilite) => {
    if (!reserviste) return;
    if (isDemoActive()) { showDemoToast('✅ Mode démo — Confirmation simulée'); return; }
    setActionLoading(`confirmer-${dispo.id}`);
    try {
      const response = await fetch('/api/disponibilites/confirmer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id: reserviste.benevole_id, deployment_id: dispo.deploiement_id })
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
      const response = await fetch('/api/disponibilites/annuler', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id: reserviste.benevole_id, deployment_id: dispo.deploiement_id, date_debut: dispo.date_debut, date_fin: dispo.date_fin })
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

        <h2 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '28px', fontWeight: '700' }}>
          {tab === 'mobilisations' ? 'Mes mobilisations' : 'Mes disponibilités'}
        </h2>

        {/* ── Onglets ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
          <button
            onClick={() => setTab('dispos')}
            style={{
              padding: '12px 20px', fontSize: '14px', fontWeight: 600,
              backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === 'dispos' ? '#1e3a5f' : '#9ca3af',
              borderBottom: tab === 'dispos' ? '3px solid #1e3a5f' : '3px solid transparent',
              marginBottom: '-2px',
            }}>
            📋 Disponibilités
            {deploiementsActifs.length > 0 && (
              <span style={{ marginLeft: 8, padding: '2px 7px', borderRadius: 10, backgroundColor: '#1e3a5f', color: 'white', fontSize: 11 }}>
                {deploiementsActifs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('mobilisations')}
            style={{
              padding: '12px 20px', fontSize: '14px', fontWeight: 600,
              backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === 'mobilisations' ? '#065f46' : '#9ca3af',
              borderBottom: tab === 'mobilisations' ? '3px solid #065f46' : '3px solid transparent',
              marginBottom: '-2px',
            }}>
            🚀 Mobilisations
            {mobilisations.length > 0 && (
              <span style={{ marginLeft: 8, padding: '2px 7px', borderRadius: 10, backgroundColor: '#065f46', color: 'white', fontSize: 11 }}>
                {mobilisations.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Onglet Mobilisations ── */}
        {tab === 'mobilisations' && (
          <>
            {mobilisations.length === 0 ? (
              <div style={{ padding: '32px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1e3a5f' }}>Aucune mobilisation active</h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                  Vous n&apos;avez pas de déploiement actif pour le moment.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {mobilisations.map(m => (
                  <div key={m.deployment_id} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '2px solid #059669' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '24px' }}>✅</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '18px', color: '#1e3a5f' }}>{m.nom}</div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>{m.identifiant} · Mobilisation {m.statut === 'confirme' ? 'confirmée par vous' : 'confirmée par l\'admin'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0', fontSize: '14px', color: '#111827' }}>
                      {m.lieu && <div><span style={{ color: '#6b7280' }}>📍</span> <strong style={{ color: '#111827' }}>Lieu:</strong> <span style={{ color: '#111827' }}>{m.lieu}</span></div>}
                      {m.point_rassemblement && <div><span style={{ color: '#6b7280' }}>📌</span> <strong style={{ color: '#111827' }}>Rassemblement:</strong> <span style={{ color: '#111827' }}>{m.point_rassemblement}</span></div>}
                      {m.date_debut && <div><span style={{ color: '#6b7280' }}>📅</span> <strong style={{ color: '#111827' }}>Début:</strong> <span style={{ color: '#111827' }}>{formatDate(m.date_debut)}</span></div>}
                      {m.date_fin && <div><span style={{ color: '#6b7280' }}>📅</span> <strong style={{ color: '#111827' }}>Fin:</strong> <span style={{ color: '#111827' }}>{formatDate(m.date_fin)}</span></div>}
                    </div>
                    {m.vagues.length > 0 && (
                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px', marginTop: '10px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#065f46', marginBottom: '6px' }}>🔄 Rotations planifiées</div>
                        {m.vagues.map(v => (
                          <div key={v.id} style={{ fontSize: '13px', color: '#065f46', padding: '4px 0' }}>
                            <strong>{v.identifiant || `Rotation #${v.numero}`}</strong> : {formatDate(v.date_debut)} → {formatDate(v.date_fin)}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                      <a href={`/deploiement/taches?deployment=${m.deployment_id}`}
                        style={{ padding: '10px 16px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
                        📋 Voir les tâches
                      </a>
                      <a href={`mailto:riusc@aqbrs.ca?subject=Empêchement pour ${m.identifiant}`}
                        style={{ padding: '10px 16px', backgroundColor: 'white', color: '#b91c1c', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, border: '1px solid #fca5a5' }}>
                        ⚠️ Signaler un empêchement
                      </a>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: '16px', padding: '14px 18px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1e40af' }}>
                  <strong>💡 Important:</strong> Si vous êtes dans l&apos;impossibilité de vous présenter, contactez-nous <strong>immédiatement</strong> par courriel à <a href="mailto:riusc@aqbrs.ca" style={{ color: '#1e40af', fontWeight: 600 }}>riusc@aqbrs.ca</a>.
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Onglet Disponibilités ── */}
        {tab === 'dispos' && (<>

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
                                  📅 {dispo.date_debut === dispo.date_fin
                                    ? formatDateCourt(dispo.date_debut)
                                    : `Du ${formatDateCourt(dispo.date_debut)} au ${formatDateCourt(dispo.date_fin)}`}
                                </span>
                              )}
                              <StatusBadge
                                status={dispo.statut === 'Disponible' ? 'success' : dispo.statut === 'En attente' ? 'warning' : 'error'}
                                label={dispo.statut === 'Disponible' ? '✅ Disponible' : dispo.statut === 'En attente' ? '⏳ En attente' : '❌ ' + dispo.statut}
                              />
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



            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
          🔄 Actualisation automatique toutes les 30 secondes
        </div>

        </>)}{/* fin onglet Disponibilités */}
      </main>

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
