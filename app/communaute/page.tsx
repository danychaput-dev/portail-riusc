'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import PortailHeader from '@/app/components/PortailHeader';

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  photo_url?: string;
}

interface Message {
  id: string;
  user_id: string;
  benevole_id: string;
  auteur_nom: string;
  auteur_photo: string | null;
  contenu: string;
  canal: string;
  created_at: string;
}

const CANAUX = [
  { id: 'general',      label: 'Général',      emoji: '💬', description: 'Discussions générales entre réservistes' },
  { id: 'questions',    label: 'Questions',     emoji: '❓', description: 'Posez vos questions sur les formations, déploiements, etc.' },
  { id: 'entraide',     label: 'Entraide',      emoji: '🤝', description: "Conseils, partage d'expérience et soutien entre pairs" },
  { id: 'deploiement',  label: 'Déploiement',   emoji: '🚨', description: 'Discussions relatives aux déploiements en cours et à venir' },
];

export default function CommunautePage() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [canal, setCanal] = useState('general');
  const [sending, setSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { checkUser(); }, []);

  useEffect(() => {
    if (!user) return;
    loadMessages();
    const channel = supabase
      .channel(`messages-${canal}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `canal=eq.${canal}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, canal]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    await supabase.from('community_last_seen').upsert({ user_id: user.id, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setLoading(false);
  }

  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*').eq('canal', canal).order('created_at', { ascending: true }).limit(200);
    if (data) setMessages(data);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !reserviste || sending) return;
    setSending(true);
    await supabase.from('messages').insert({
      user_id: user.id, benevole_id: reserviste.benevole_id,
      auteur_nom: `${reserviste.prenom} ${reserviste.nom}`,
      auteur_photo: reserviste.photo_url || null,
      contenu: newMessage.trim(), canal,
    });
    setNewMessage('');
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const getInitials = (name?: string) => {
    if (name) return name.split(' ').map(p => p.charAt(0)).join('').toUpperCase().slice(0, 2);
    if (reserviste) return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase();
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const time = d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Aujourd'hui à ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `Hier à ${time}`;
    return `${d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })} à ${time}`;
  }

  function shouldShowHeader(msg: Message, idx: number) {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    if (prev.benevole_id !== msg.benevole_id) return true;
    return new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
  }

  const currentCanal = CANAUX.find(c => c.id === canal);

  if (loading) {
    return (<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>Chargement...</div>);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f7fa' }}>

      {/* ── Header ── */}
      <PortailHeader subtitle="Communauté" />

      {/* Canaux horizontaux (mobile) */}
      {isMobile && (
        <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '8px 12px', display: 'flex', gap: '8px', overflowX: 'auto', flexShrink: 0 }}>
          <a href="/" style={{ padding: '8px 12px', fontSize: '13px', color: '#6b7280', textDecoration: 'none', flexShrink: 0 }}>{'← Accueil'}</a>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb', flexShrink: 0 }} />
          {CANAUX.map((c) => (
            <button key={c.id} onClick={() => setCanal(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: canal === c.id ? '700' : '500', flexShrink: 0,
              backgroundColor: canal === c.id ? '#1e3a5f' : '#f3f4f6',
              color: canal === c.id ? 'white' : '#374151',
              transition: 'all 0.15s',
            }}>
              <span>{c.emoji}</span>{c.label}
            </button>
          ))}
        </div>
      )}

      {/* Contenu */}
      <div style={{ flex: 1, display: 'flex', maxWidth: '1200px', margin: '0 auto', width: '100%', padding: isMobile ? '0' : '16px 24px', gap: '16px', minHeight: 0 }}>

        {/* Sidebar desktop */}
        {!isMobile && (
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', padding: '8px 16px' }}>{"← Retour à l'accueil"}</a>
            <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Canaux</div>
            {CANAUX.map((c) => (
              <button key={c.id} onClick={() => setCanal(c.id)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: canal === c.id ? '700' : '500', textAlign: 'left', width: '100%',
                backgroundColor: canal === c.id ? '#1e3a5f' : 'transparent',
                color: canal === c.id ? 'white' : '#374151',
                transition: 'all 0.15s',
              }}>
                <span>{c.emoji}</span>{c.label}
              </button>
            ))}
            <div style={{ marginTop: 'auto', padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '4px' }}>{'💡 Astuce'}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>Appuyez sur Entrée pour envoyer.</div>
            </div>
          </div>
        )}

        {/* Zone de chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: isMobile ? '0' : '12px', border: isMobile ? 'none' : '1px solid #e5e7eb', boxShadow: isMobile ? 'none' : '0 1px 3px rgba(0,0,0,0.1)', minHeight: 0, overflow: 'hidden' }}>

          {/* Titre canal (desktop) */}
          {!isMobile && currentCanal && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{currentCanal.emoji}</span>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f' }}>{currentCanal.label}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{currentCanal.description}</div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: '8px' }}>
                <span style={{ fontSize: '40px' }}>{currentCanal?.emoji}</span>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280' }}>Aucun message pour l&apos;instant</div>
                <div style={{ fontSize: '14px' }}>Soyez le premier à écrire dans #{currentCanal?.label} !</div>
              </div>
            )}
            {messages.map((msg, idx) => {
              const showHeader = shouldShowHeader(msg, idx);
              const isMe = reserviste?.benevole_id === msg.benevole_id;
              return (
                <div key={msg.id}
                  style={{ padding: showHeader ? (isMobile ? '10px 4px 2px 4px' : '12px 8px 2px 8px') : (isMobile ? '1px 4px' : '1px 8px'), borderRadius: '8px', display: 'flex', gap: isMobile ? '8px' : '12px', alignItems: 'flex-start', transition: 'background 0.15s' }}
                  onMouseOver={(e) => { if (!isMobile) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                  onMouseOut={(e) => { if (!isMobile) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                  <div style={{ width: isMobile ? '30px' : '36px', flexShrink: 0 }}>
                    {showHeader && (
                      msg.auteur_photo ? (
                        <img src={msg.auteur_photo} alt="" style={{ width: isMobile ? '30px' : '36px', height: isMobile ? '30px' : '36px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: isMobile ? '30px' : '36px', height: isMobile ? '30px' : '36px', borderRadius: '50%', backgroundColor: isMe ? '#1e3a5f' : '#6b7280', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: isMobile ? '10px' : '12px' }}>{getInitials(msg.auteur_nom)}</div>
                      )
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {showHeader && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '700', color: isMe ? '#1e3a5f' : '#111827' }}>{msg.auteur_nom}</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{formatTime(msg.created_at)}</span>
                      </div>
                    )}
                    <div style={{ fontSize: isMobile ? '13px' : '14px', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.contenu}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Zone de saisie */}
          <div style={{ padding: isMobile ? '10px 12px' : '16px 20px', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
            {reserviste ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <textarea
                  value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder={`Écrire dans #${currentCanal?.label}...`} rows={1}
                  style={{ flex: 1, padding: isMobile ? '10px 12px' : '12px 16px', borderRadius: '12px', border: '1px solid #d1d5db', fontSize: '14px', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none', transition: 'border-color 0.2s', minHeight: '44px', maxHeight: '120px' }}
                  onFocus={(e) => e.target.style.borderColor = '#1e3a5f'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <button onClick={sendMessage} disabled={!newMessage.trim() || sending} style={{
                  padding: isMobile ? '10px 14px' : '12px 20px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '700',
                  cursor: newMessage.trim() && !sending ? 'pointer' : 'default',
                  backgroundColor: newMessage.trim() && !sending ? '#1e3a5f' : '#e5e7eb',
                  color: newMessage.trim() && !sending ? 'white' : '#9ca3af',
                  transition: 'all 0.2s', flexShrink: 0,
                }}>
                  {sending ? '...' : (isMobile ? '→' : 'Envoyer')}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px', color: '#6b7280', fontSize: '14px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                Votre profil doit être complété pour participer aux discussions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
