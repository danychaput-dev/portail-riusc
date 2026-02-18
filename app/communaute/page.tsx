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
  photo_url?: string;
}

const DISCORD_SERVER_ID = '1473495159248388259';
const DISCORD_INVITE = 'https://discord.gg/2znFx95T';

export default function CommunautePage() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    checkUser();
  }, []);

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
    if (reservisteData) setReserviste(reservisteData);
    setLoading(false);
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const getInitials = () => {
    if (reserviste) return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase();
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  if (loading) {
    return (<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>Chargement...</div>);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Communauté des réservistes</p>
            </div>
          </a>
          {reserviste ? (
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
                  <a href="/disponibilites" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Mes disponibilités
                  </a>
                  <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#dc2626', backgroundColor: 'white', border: 'none', width: '100%', textAlign: 'left', fontSize: '14px', cursor: 'pointer' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/" style={{ padding: '8px 16px', color: '#6b7280', textDecoration: 'none', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px' }}>← Retour</a>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>&larr; Retour &agrave; l&apos;accueil</a>
        </div>

        <h2 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>Communauté RIUSC</h2>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#6b7280', lineHeight: 1.7 }}>
          Échangez avec les autres réservistes, posez vos questions et restez connectés.
        </p>

        {/* Bandeau rejoindre */}
        <div style={{ backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f' }}>Rejoignez le serveur Discord RIUSC</div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>Discussions, entraide et nouvelles entre réservistes</div>
            </div>
          </div>
          <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#5865F2', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '700', transition: 'all 0.2s' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Rejoindre le Discord
          </a>
        </div>

        {/* Widget Discord */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', flex: 1, minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e3a5f' }}>Membres en ligne</span>
          </div>
          <iframe
            src={`https://discord.com/widget?id=${DISCORD_SERVER_ID}&theme=light`}
            width="100%"
            style={{ border: 'none', flex: 1, minHeight: '500px' }}
            allowTransparency={true}
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          />
        </div>

        {/* Info */}
        <div style={{ marginTop: '24px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e3a5f', marginBottom: '8px' }}>Comment ça fonctionne ?</div>
          <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7 }}>
            Le widget ci-dessus montre les membres en ligne sur le serveur Discord RIUSC. Pour participer aux discussions,
            cliquez sur <strong>Rejoindre le Discord</strong> et créez un compte Discord gratuit si vous n&apos;en avez pas déjà un.
            Vous pourrez ensuite échanger avec les autres réservistes directement depuis l&apos;application Discord sur votre ordinateur ou votre téléphone.
          </div>
        </div>
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  );
}
