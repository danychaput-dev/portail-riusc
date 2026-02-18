'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  photo_url?: string;
  groupe?: string;
  date_naissance?: string;
  adresse?: string;
  ville?: string;
  region?: string;
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
}

interface CampInfo {
  nom: string;
  dates: string;
  site: string;
  location: string;
}

interface CampStatus {
  is_certified: boolean;
  has_inscription: boolean;
  session_id: string | null;
  camp: CampInfo | null;
  lien_inscription: string | null;
}

interface SessionCamp {
  session_id: string;
  nom: string;
  dates: string;
  site: string;
  location: string;
}

interface CertificatFile {
  id: string;
  name: string;
  url?: string;
}

export default function FormationPage() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [loading, setLoading] = useState(true);

  const [certificats, setCertificats] = useState<CertificatFile[]>([]);
  const [loadingCertificats, setLoadingCertificats] = useState(true);
  const [uploadingCertificat, setUploadingCertificat] = useState(false);
  const [certificatMessage, setCertificatMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const certificatInputRef = useRef<HTMLInputElement>(null);

  const [campStatus, setCampStatus] = useState<CampStatus | null>(null);
  const [loadingCamp, setLoadingCamp] = useState(true);

  const [showCampModal, setShowCampModal] = useState(false);
  const [sessionsDisponibles, setSessionsDisponibles] = useState<SessionCamp[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [inscriptionLoading, setInscriptionLoading] = useState(false);
  const [inscriptionError, setInscriptionError] = useState<string | null>(null);
  const [inscriptionSuccess, setInscriptionSuccess] = useState(false);
  const [cancellingInscription, setCancellingInscription] = useState(false);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isApproved = reserviste?.groupe === 'Approuvé';

  const selectFields = 'benevole_id, prenom, nom, email, telephone, photo_url, groupe, date_naissance, adresse, ville, region, contact_urgence_nom, contact_urgence_telephone';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);

    let reservisteData = null;
    if (user.email) {
      const { data } = await supabase.from('reservistes').select(selectFields).ilike('email', user.email).single();
      reservisteData = data;
    }
    if (!reservisteData && user.phone) {
      const phoneDigits = user.phone.replace(/\D/g, '');
      const { data } = await supabase.from('reservistes').select(selectFields).eq('telephone', phoneDigits).single();
      if (!data) {
        const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits;
        const { data: data2 } = await supabase.from('reservistes').select(selectFields).eq('telephone', phoneWithout1).single();
        reservisteData = data2;
      } else { reservisteData = data; }
    }

    if (reservisteData) {
      setReserviste(reservisteData);

      if (reservisteData.benevole_id) {
        // Certificats
        try {
          const response = await fetch(`https://n8n.aqbrs.ca/webhook/riusc-get-certificats?benevole_id=${reservisteData.benevole_id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.files) setCertificats(data.files);
          }
        } catch (e) { console.error('Erreur certificats:', e); }
        setLoadingCertificats(false);

        // Camp status
        try {
          const response = await fetch(`https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${reservisteData.benevole_id}`);
          if (response.ok) {
            const data = await response.json();
            setCampStatus(data);
          }
        } catch (e) { console.error('Erreur camp:', e); }
        setLoadingCamp(false);
      } else {
        setLoadingCertificats(false);
        setLoadingCamp(false);
      }
    } else {
      setLoadingCertificats(false);
      setLoadingCamp(false);
    }

    setLoading(false);
  }

  const handleCertificatUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !reserviste) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) { setCertificatMessage({ type: 'error', text: 'Format accepté : PDF, JPG ou PNG' }); return; }
    if (file.size > 10 * 1024 * 1024) { setCertificatMessage({ type: 'error', text: 'Le fichier ne doit pas dépasser 10 Mo' }); return; }

    setUploadingCertificat(true);
    setCertificatMessage(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-upload-certificat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id: reserviste.benevole_id, file_name: file.name, file_base64: base64 })
      });
      const data = await response.json();
      if (data.success) {
        setCertificatMessage({ type: 'success', text: 'Certificat ajouté avec succès !' });
        const res2 = await fetch(`https://n8n.aqbrs.ca/webhook/riusc-get-certificats?benevole_id=${reserviste.benevole_id}`);
        if (res2.ok) { const d2 = await res2.json(); if (d2.success && d2.files) setCertificats(d2.files); }
      } else { setCertificatMessage({ type: 'error', text: data.error || "Erreur lors de l'envoi" }); }
    } catch (e) { setCertificatMessage({ type: 'error', text: "Erreur lors de l'envoi" }); }
    setUploadingCertificat(false);
    if (certificatInputRef.current) certificatInputRef.current.value = '';
  };

  const openCampModal = async () => {
    setShowCampModal(true); setLoadingSessions(true); setInscriptionError(null); setInscriptionSuccess(false); setSelectedSessionId('');
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/sessions-camps');
      if (response.ok) { const data = await response.json(); if (data.success && data.sessions) setSessionsDisponibles(data.sessions); }
    } catch (e) { setInscriptionError('Impossible de charger les camps disponibles'); }
    setLoadingSessions(false);
  };
  const closeCampModal = () => { setShowCampModal(false); setSelectedSessionId(''); setInscriptionError(null); setInscriptionSuccess(false); };

  const handleSubmitInscription = async () => {
    if (!reserviste || !selectedSessionId) { setInscriptionError('Veuillez sélectionner un camp'); return; }
    setInscriptionLoading(true); setInscriptionError(null);
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/inscription-camp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id: reserviste.benevole_id, session_id: selectedSessionId, presence: 'confirme', courriel: reserviste.email, telephone: reserviste.telephone || null, prenom_nom: `${reserviste.prenom} ${reserviste.nom}` })
      });
      const data = await response.json();
      if (response.ok && data.success) { setInscriptionSuccess(true); setTimeout(() => { closeCampModal(); window.location.reload(); }, 2000); }
      else { setInscriptionError(data.error || "Erreur lors de l'inscription"); }
    } catch (e) { setInscriptionError('Erreur de connexion. Veuillez réessayer.'); }
    setInscriptionLoading(false);
  };

  const handleCancelInscription = async () => {
    if (!reserviste || !confirm('Êtes-vous sûr de vouloir annuler votre inscription au camp ?')) return;
    setCancellingInscription(true);
    try {
      const response = await fetch(`https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${reserviste.benevole_id}&action=cancel`, { method: 'POST' });
      if (response.ok) window.location.reload();
      else alert("Erreur lors de l'annulation. Veuillez réessayer.");
    } catch (e) { alert("Erreur lors de l'annulation. Veuillez réessayer."); }
    setCancellingInscription(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/login'); };

  function getInitials(): string {
    if (reserviste) return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase();
    return user?.email?.charAt(0).toUpperCase() || 'U';
  }

  const isProfilComplet = !!(
    reserviste &&
    reserviste.prenom &&
    reserviste.nom &&
    reserviste.email &&
    reserviste.telephone &&
    reserviste.date_naissance &&
    reserviste.adresse &&
    reserviste.ville &&
    reserviste.region &&
    reserviste.contact_urgence_nom &&
    reserviste.contact_urgence_telephone
  );

  const steps = [
    { id: 'profil', label: 'Compléter mon profil', done: isProfilComplet, href: '/profil', emoji: '👤', description: 'Vérifiez et complétez vos informations personnelles' },
    { id: 'formation', label: 'Formation en ligne', done: certificats.length > 0, href: null, emoji: '🎓', description: 'Suivre « S\'initier à la sécurité civile » et soumettre le certificat' },
    { id: 'camp', label: 'Camp de qualification', done: campStatus?.is_certified || false, href: null, emoji: '🏕️', description: campStatus?.has_inscription ? 'Inscrit — en attente du camp' : 'S\'inscrire à un camp pratique de 2 jours' },
  ];
  const completedCount = steps.filter(s => s.done).length;
  const progressPercent = Math.round((completedCount / 3) * 100);

  if (loading) {
    return (<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>Chargement...</div>);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Camp Modal */}
      {showCampModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {inscriptionSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '64px', height: '64px', backgroundColor: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="32" height="32" fill="none" stroke="#059669" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 style={{ color: '#065f46', margin: '0 0 10px 0', fontSize: '20px' }}>{campStatus?.has_inscription ? 'Modification confirmée' : 'Inscription confirmée'}</h3>
                <p style={{ color: '#4b5563', margin: 0 }}>Vous recevrez une confirmation par {reserviste?.telephone ? 'SMS' : 'courriel'}.</p>
              </div>
            ) : (
              <>
                <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '22px', fontWeight: '600' }}>{campStatus?.has_inscription ? 'Modifier mon inscription' : 'Inscription au camp de qualification'}</h3>
                <p style={{ color: '#6b7280', margin: '0 0 24px 0', fontSize: '14px' }}>{campStatus?.has_inscription ? 'Sélectionnez un autre camp si vous souhaitez modifier votre inscription.' : 'Sélectionnez le camp auquel vous souhaitez participer.'}</p>
                <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #1e3a5f' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vos informations</p>
                  <p style={{ margin: '4px 0', color: '#374151', fontSize: '14px' }}>{reserviste?.prenom} {reserviste?.nom}</p>
                  <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '14px' }}>{reserviste?.email}</p>
                  {reserviste?.telephone && <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '14px' }}>{reserviste.telephone}</p>}
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Sélectionnez un camp de qualification</label>
                  {loadingSessions ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', backgroundColor: '#f9fafb', borderRadius: '8px' }}>Chargement des camps disponibles...</div>
                  ) : sessionsDisponibles.filter(s => s.session_id !== campStatus?.session_id).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#92400e', backgroundColor: '#fef3c7', borderRadius: '8px' }}>Aucun autre camp disponible pour le moment.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sessionsDisponibles.filter(s => s.session_id !== campStatus?.session_id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr-CA', { numeric: true })).map((session) => (
                        <label key={session.session_id} style={{ display: 'block', padding: '16px', border: selectedSessionId === session.session_id ? '2px solid #1e3a5f' : '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', backgroundColor: selectedSessionId === session.session_id ? '#f0f4f8' : 'white', transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <input type="radio" name="session" value={session.session_id} checked={selectedSessionId === session.session_id} onChange={(e) => setSelectedSessionId(e.target.value)} style={{ marginTop: '4px' }} />
                            <div>
                              <div style={{ fontWeight: '600', color: '#111827', marginBottom: '6px' }}>{session.nom}</div>
                              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                                {session.dates && <div>{session.dates}</div>}
                                {session.site && <div>{session.site}</div>}
                                {session.location && <div style={{ color: '#9ca3af' }}>{session.location}</div>}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {inscriptionError && <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{inscriptionError}</div>}
                <p style={{ color: '#92400e', fontSize: '13px', margin: '0 0 24px 0', backgroundColor: '#fffbeb', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>En confirmant, vous vous engagez à être présent aux deux journées complètes du camp.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button onClick={closeCampModal} disabled={inscriptionLoading} style={{ padding: '12px 24px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: inscriptionLoading ? 'not-allowed' : 'pointer', fontWeight: '500' }}>Annuler</button>
                  <button onClick={handleSubmitInscription} disabled={inscriptionLoading || !selectedSessionId || loadingSessions} style={{ padding: '12px 24px', backgroundColor: (inscriptionLoading || !selectedSessionId) ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: (inscriptionLoading || !selectedSessionId) ? 'not-allowed' : 'pointer' }}>
                    {inscriptionLoading ? 'Traitement...' : campStatus?.has_inscription ? 'Confirmer la modification' : 'Confirmer mon inscription'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Formation et parcours du réserviste</p>
            </div>
          </a>
          {reserviste && (
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{reserviste.prenom} {reserviste.nom}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Réserviste</div>
                </div>
                {reserviste.photo_url ? (
                  <img src={reserviste.photo_url} alt="Photo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px' }}>{getInitials()}</div>
                )}
              </button>
              {showUserMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', minWidth: '200px', overflow: 'hidden', zIndex: 200 }}>
                  <a href="/" style={{ display: 'block', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>Accueil</a>
                  <a href="/profil" style={{ display: 'block', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>Mon profil</a>
                  <button onClick={handleSignOut} style={{ display: 'block', padding: '12px 16px', color: '#dc2626', backgroundColor: 'white', border: 'none', width: '100%', textAlign: 'left', fontSize: '14px', cursor: 'pointer' }}>Déconnexion</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>{'← Retour à l\'accueil'}</a>

        <h2 style={{ color: '#1e3a5f', margin: '20px 0 8px 0', fontSize: '26px', fontWeight: '700' }}>Parcours du réserviste</h2>
        <p style={{ color: '#6b7280', margin: '0 0 28px 0', fontSize: '15px' }}>Suivez ces étapes pour compléter votre intégration à la RIUSC.</p>

        {/* Barre de progression */}
        <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '28px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a5f' }}>Progression des étapes obligatoires</span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: progressPercent === 100 ? '#059669' : '#1e3a5f' }}>{progressPercent}%</span>
          </div>
          <div style={{ height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? '#059669' : '#1e3a5f', borderRadius: '4px', transition: 'width 0.5s ease' }} />
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#9ca3af' }}>{completedCount}/3 étapes obligatoires complétées</p>
        </div>

        {/* ÉTAPE 1 : Profil */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px', border: isProfilComplet ? '1px solid #10b981' : '2px solid #f59e0b', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: isProfilComplet ? '#d1fae5' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              {isProfilComplet ? '✅' : '1'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a5f' }}>Compléter mon profil</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                {isProfilComplet ? 'Profil complété' : 'Vérifiez et complétez vos informations personnelles'}
              </div>
            </div>
            <a href="/profil" style={{ padding: '8px 16px', backgroundColor: isProfilComplet ? 'white' : '#1e3a5f', color: isProfilComplet ? '#1e3a5f' : 'white', border: isProfilComplet ? '1px solid #1e3a5f' : 'none', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500', flexShrink: 0 }}>
              {isProfilComplet ? 'Voir' : 'Compléter'}
            </a>
          </div>
        </div>

        {/* ÉTAPE 2 : Formation en ligne + certificat */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px', border: certificats.length > 0 ? '1px solid #10b981' : '2px solid #f59e0b', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: certificats.length > 0 ? '#d1fae5' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              {certificats.length > 0 ? '✅' : '2'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a5f' }}>Formation en ligne</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                {certificats.length > 0 ? `${certificats.length} certificat${certificats.length > 1 ? 's' : ''} soumis` : 'Suivre la formation et soumettre votre certificat'}
              </div>
            </div>
          </div>

          <div style={{ padding: '0 24px 20px 24px' }}>
            {!loadingCertificats && certificats.length === 0 && (
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#92400e', fontSize: '15px' }}>Formation obligatoire requise</p>
                <p style={{ margin: '0 0 16px 0', color: '#78350f', fontSize: '14px', lineHeight: '1.6' }}>
                  Pour compléter votre inscription à la RIUSC, vous devez suivre la formation
                  <strong> « S&apos;initier à la sécurité civile »</strong> sur la plateforme du Centre RISC,
                  puis nous soumettre votre certificat de réussite.
                </p>
                <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}><strong>Durée :</strong> environ 1 h 45</p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}><strong>Contenu :</strong> 5 modules à suivre à votre rythme</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}><strong>Délai :</strong> 30 jours après votre inscription</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <a href="https://formation.centrerisc.com/go/formation/cours/AKA1E0D36C322A9E75AAKA/inscription" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                    🎓 Accéder à la formation
                  </a>
                  <a href="https://rsestrie-my.sharepoint.com/:v:/g/personal/dany_chaput_rsestrie_org/EcWyUX-i-DNPnQI7RmYgdiIBkORhzpF_1NimfhVb5kQyHw" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                    📺 Tutoriel vidéo
                  </a>
                </div>
              </div>
            )}

            {!loadingCertificats && certificats.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                {certificats.map((cert) => (
                  <div key={cert.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>📄</span>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{cert.name}</span>
                    </div>
                    {cert.url && (
                      <a href={cert.url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>Télécharger</a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {loadingCertificats && <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>Chargement des certificats...</div>}

            {certificatMessage && (
              <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', backgroundColor: certificatMessage.type === 'success' ? '#d1fae5' : '#fef2f2', color: certificatMessage.type === 'success' ? '#065f46' : '#dc2626', fontSize: '14px' }}>
                {certificatMessage.text}
              </div>
            )}

            <input ref={certificatInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleCertificatUpload} style={{ display: 'none' }} />
            <button onClick={() => certificatInputRef.current?.click()} disabled={uploadingCertificat} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: certificats.length === 0 ? '#059669' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: uploadingCertificat ? 'not-allowed' : 'pointer', opacity: uploadingCertificat ? 0.7 : 1 }}>
              {uploadingCertificat ? '⏳ Envoi en cours...' : certificats.length === 0 ? '📤 Soumettre mon certificat' : '➕ Ajouter un certificat'}
            </button>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>Formats acceptés : PDF, JPG, PNG (max 10 Mo)</p>
          </div>
        </div>

        {/* ÉTAPE 3 : Camp de qualification */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px', border: campStatus?.is_certified ? '1px solid #10b981' : campStatus?.has_inscription ? '1px solid #10b981' : '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: campStatus?.is_certified ? '#d1fae5' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              {campStatus?.is_certified ? '✅' : '3'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a5f' }}>Camp de qualification</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                {campStatus?.is_certified ? 'Certifié !' : campStatus?.has_inscription ? 'Inscrit — en attente du camp' : 'S\'inscrire à un camp pratique de 2 jours'}
              </div>
            </div>
            {campStatus?.has_inscription && <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>Inscrit</span>}
          </div>

          {!loadingCamp && campStatus && !campStatus.is_certified && (
            <div style={{ padding: '0 24px 20px 24px' }}>
              {campStatus.has_inscription && campStatus.camp ? (
                <div>
                  <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>{campStatus.camp.nom}</div>
                    <div style={{ display: 'grid', gap: '6px', fontSize: '14px', color: '#4b5563' }}>
                      {campStatus.camp.dates && <div><strong>Dates :</strong> {campStatus.camp.dates}</div>}
                      {campStatus.camp.site && <div><strong>Site :</strong> {campStatus.camp.site}</div>}
                      {campStatus.camp.location && <div style={{ color: '#6b7280' }}>{campStatus.camp.location}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={openCampModal} style={{ padding: '10px 20px', backgroundColor: 'white', color: '#1e3a5f', border: '1px solid #1e3a5f', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Modifier mon inscription</button>
                    <button onClick={handleCancelInscription} disabled={cancellingInscription} style={{ padding: '10px 20px', backgroundColor: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: cancellingInscription ? 'not-allowed' : 'pointer', opacity: cancellingInscription ? 0.7 : 1 }}>
                      {cancellingInscription ? 'Annulation...' : 'Je ne suis plus disponible'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '14px' }}>Pour devenir réserviste certifié, vous devez compléter un camp de qualification pratique.</p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={openCampModal} style={{ padding: '12px 24px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                      S&apos;inscrire à un camp de qualification
                    </button>
                    <a href="/tournee-camps" style={{ padding: '12px 24px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                      🏕️ Voir la tournée des camps
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Séparateur */}
        <div style={{ margin: '32px 0 24px 0', borderTop: '1px solid #e5e7eb', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#f5f7fa', padding: '0 16px', fontSize: '13px', color: '#9ca3af', fontWeight: '600' }}>RESSOURCES</span>
        </div>

        {/* Liens rapides */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {isApproved && (
            <a href="/dossier" style={{ textDecoration: 'none' }}>
              <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#1e3a5f'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                <span style={{ fontSize: '28px' }}>📋</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Mon dossier réserviste</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>Compétences et certifications</div>
                </div>
              </div>
            </a>
          )}
          <a href="/informations" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#1e3a5f'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
              <span style={{ fontSize: '28px' }}>📚</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Informations pratiques</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Documents, ressources et références</div>
              </div>
            </div>
          </a>
          <a href="/communaute" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#1e3a5f'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
              <span style={{ fontSize: '28px' }}>💬</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Communauté</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Échangez avec les réservistes</div>
              </div>
            </div>
          </a>
        </div>
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  );
}
