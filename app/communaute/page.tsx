'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import PortailHeader from '@/app/components/PortailHeader';

/* ──────────────────── Types ──────────────────── */

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
  reply_to_id?: string | null;
  image_url?: string | null;
  file_name?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  benevole_id: string;
  emoji: string;
  created_at: string;
}

interface ReactionGroup {
  emoji: string;
  count: number;
  users: string[];
  reactionIds: string[];
  iMine: boolean;
}

/* ──────────────────── Constantes ──────────────────── */

const ADMIN_EMAILS = ['dany.chaput@aqbrs.ca', 'est.lapointe@gmail.com'];

const CANAUX = [
  { id: 'general', label: 'Général', emoji: '💬', description: 'Discussions générales entre réservistes' },
  { id: 'questions', label: 'Questions', emoji: '❓', description: 'Posez vos questions sur les formations, déploiements, etc.' },
  { id: 'entraide', label: 'Entraide', emoji: '🤝', description: "Conseils, partage d'expérience et soutien entre pairs" },
  { id: 'deploiement', label: 'Déploiement', emoji: '🚨', description: 'Discussions relatives aux déploiements en cours et à venir' },
];

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🔥'];

const EMOJI_CATEGORIES = [
  {
    label: 'Visages', emojis: [
      '😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😌',
      '😍','🥰','😘','😗','😋','😛','😜','🤪','😎','🤩','🥳','😏',
      '😢','😭','😤','😡','🤯','😱','😰','🤔','🤫','🤗','🫡','🫠',
    ],
  },
  {
    label: 'Gestes', emojis: [
      '👍','👎','👏','🙌','🤝','💪','✌️','🤞','🫶','👋','🖐️','✋',
      '👆','👇','👉','👈','🫵','☝️','🙏','🤙',
    ],
  },
  {
    label: 'Cœurs', emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','💕','💖',
      '💗','💘','💝','♥️',
    ],
  },
  {
    label: 'Objets', emojis: [
      '🎉','🎊','🏆','🥇','⭐','🌟','✨','🔥','💯','✅','❌','⚠️',
      '📌','📎','📋','📄','📁','💡','🔔','🚨','🏕️','🚒','🚑','⛑️',
      '🌊','🌧️','❄️','🌪️','☀️','🗺️',
    ],
  },
];

/* ──────────────────── Helpers ──────────────────── */

function fileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  return '📎';
}

function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

/* ──────────────────── Composant principal ──────────────────── */

export default function CommunautePage() {
  const supabase = createClient();
  const router = useRouter();

  /* ── State de base ── */
  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [canal, setCanal] = useState('general');
  const [sending, setSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  /* ── State fonctionnalités ── */
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [actionMenuMsg, setActionMenuMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<{ file: File; previewUrl: string | null } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  /* ── State réactions ── */
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [reactionPickerCategory, setReactionPickerCategory] = useState(0);

  /* ── Refs ── */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);

  /* ──────────────────── Responsiveness ──────────────────── */

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* ──────────────────── Fermer popups au clic extérieur ──────────────────── */

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuMsg(null);
      }
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setReactionPickerMsgId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ──────────────────── Auth ──────────────────── */

  useEffect(() => { checkUser(); }, []);

  async function checkUser() {
    const debugMode = typeof window !== 'undefined' && localStorage.getItem('debug_mode') === 'true';
    if (debugMode) {
      const raw = localStorage.getItem('debug_user');
      if (raw) {
        const debugUser = JSON.parse(raw);
        setUser({ id: 'debug', email: debugUser.email });
        setReserviste(debugUser);
        const debugEmail = debugUser.email?.toLowerCase() || '';
        setIsAdmin(ADMIN_EMAILS.includes(debugEmail));
        setLoading(false);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);

    const userEmail = user.email?.toLowerCase() || '';
    setIsAdmin(ADMIN_EMAILS.includes(userEmail));

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

    await supabase.from('community_last_seen').upsert(
      { user_id: user.id, last_seen_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    setLoading(false);
  }

  /* ──────────────────── Messages + Réactions : chargement + Realtime ──────────────────── */

  useEffect(() => {
    if (!user) return;
    loadMessages();

    const msgChannel = supabase
      .channel(`messages-${canal}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages', filter: `canal=eq.${canal}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages', filter: `canal=eq.${canal}`,
      }, (payload) => {
        setMessages((prev) => prev.map((m) => m.id === (payload.new as Message).id ? (payload.new as Message) : m));
      })
      .subscribe();

    const reactChannel = supabase
      .channel(`reactions-${canal}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'message_reactions',
      }, (payload) => {
        const newR = payload.new as Reaction;
        setReactions((prev) => {
          if (prev.some((r) => r.id === newR.id)) return prev;
          return [...prev, newR];
        });
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'message_reactions',
      }, (payload) => {
        const oldR = payload.old as { id: string };
        setReactions((prev) => prev.filter((r) => r.id !== oldR.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(reactChannel);
    };
  }, [user, canal]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('canal', canal)
      .order('created_at', { ascending: true })
      .limit(200);
    if (data) {
      setMessages(data);
      // Charger les réactions pour ces messages
      const msgIds = data.map((m) => m.id);
      if (msgIds.length > 0) {
        const { data: rData } = await supabase
          .from('message_reactions')
          .select('*')
          .in('message_id', msgIds);
        if (rData) setReactions(rData);
        else setReactions([]);
      } else {
        setReactions([]);
      }
    }
  }

  /* ──────────────────── Réactions : grouper par message + emoji ──────────────────── */

  function getReactionGroups(messageId: string): ReactionGroup[] {
    const msgReactions = reactions.filter((r) => r.message_id === messageId);
    const groups: Record<string, ReactionGroup> = {};

    for (const r of msgReactions) {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { emoji: r.emoji, count: 0, users: [], reactionIds: [], iMine: false };
      }
      groups[r.emoji].count++;
      groups[r.emoji].users.push(r.benevole_id);
      groups[r.emoji].reactionIds.push(r.id);
      if (r.user_id === user?.id) groups[r.emoji].iMine = true;
    }

    return Object.values(groups).sort((a, b) => b.count - a.count);
  }

  /* ──────────────────── Réactions : toggle ──────────────────── */

  async function toggleReaction(messageId: string, emoji: string) {
    if (!reserviste || !user) return;

    const existing = reactions.find(
      (r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji
    );

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        benevole_id: reserviste.benevole_id,
        emoji,
      }).select().single();

      if (data && !error) {
        setReactions((prev) => {
          if (prev.some((r) => r.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    }

    setReactionPickerMsgId(null);
  }

  /* ──────────────────── Envoyer un message ──────────────────── */

  async function sendMessage() {
    if ((!newMessage.trim() && !filePreview) || !reserviste || sending) return;
    setSending(true);

    let imageUrl: string | null = null;
    let fileName: string | null = null;

    if (filePreview) {
      const result = await uploadFile(filePreview.file);
      if (result) {
        imageUrl = result.url;
        fileName = result.name;
      }
      setFilePreview(null);
    }

    await supabase.from('messages').insert({
      user_id: user.id,
      benevole_id: reserviste.benevole_id,
      auteur_nom: `${reserviste.prenom} ${reserviste.nom}`,
      auteur_photo: reserviste.photo_url || null,
      contenu: newMessage.trim(),
      canal,
      reply_to_id: replyTo?.id || null,
      image_url: imageUrl,
      file_name: fileName,
    });

    setNewMessage('');
    setReplyTo(null);
    setSending(false);
    textareaRef.current?.focus();
  }

  /* ──────────────────── Upload fichier ──────────────────── */

  async function uploadFile(file: File): Promise<{ url: string; name: string } | null> {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `${canal}/${safeName}`;

      const { error } = await supabase.storage.from('community-files').upload(path, file);
      if (error) {
        console.error('Upload error:', error);
        alert('Erreur lors de l\'envoi du fichier. Vérifiez que le type est supporté (images, PDF, Word, Excel) et que la taille est < 10 Mo.');
        return null;
      }

      const { data: { publicUrl } } = supabase.storage.from('community-files').getPublicUrl(path);
      return { url: publicUrl, name: file.name };
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Le fichier dépasse la limite de 10 Mo.');
      return;
    }
    let previewUrl: string | null = null;
    if (file.type.startsWith('image/')) previewUrl = URL.createObjectURL(file);
    setFilePreview({ file, previewUrl });
    e.target.value = '';
    textareaRef.current?.focus();
  }

  function cancelFilePreview() {
    if (filePreview?.previewUrl) URL.revokeObjectURL(filePreview.previewUrl);
    setFilePreview(null);
  }

  /* ──────────────────── Édition ──────────────────── */

  function startEdit(msg: Message) {
    setEditingMessage(msg);
    setEditText(msg.contenu);
    setActionMenuMsg(null);
  }

  function cancelEdit() {
    setEditingMessage(null);
    setEditText('');
  }

  async function saveEdit() {
    if (!editingMessage || !editText.trim()) return;
    await supabase
      .from('messages')
      .update({ contenu: editText.trim(), edited_at: new Date().toISOString() })
      .eq('id', editingMessage.id);
    setEditingMessage(null);
    setEditText('');
  }

  /* ──────────────────── Suppression ──────────────────── */

  async function deleteMessage(msg: Message) {
    if (!confirm('Supprimer ce message ?')) return;
    await supabase
      .from('messages')
      .update({ is_deleted: true, contenu: '', image_url: null, file_name: null })
      .eq('id', msg.id);
    setActionMenuMsg(null);
  }

  /* ──────────────────── Helpers ──────────────────── */

  function canModify(msg: Message): boolean {
    if (msg.is_deleted) return false;
    if (isAdmin) return true;
    return msg.user_id === user?.id;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) saveEdit();
      else sendMessage();
    }
    if (e.key === 'Escape') {
      if (editingMessage) cancelEdit();
      if (replyTo) setReplyTo(null);
      if (filePreview) cancelFilePreview();
      if (reactionPickerMsgId) setReactionPickerMsgId(null);
    }
  }

  function handleEmojiSelect(emoji: string) {
    if (editingMessage) {
      setEditText((prev) => prev + emoji);
    } else {
      setNewMessage((prev) => prev + emoji);
      textareaRef.current?.focus();
    }
    setShowEmojiPicker(false);
  }

  const getInitials = (name?: string) => {
    if (name) return name.split(' ').map((p) => p.charAt(0)).join('').toUpperCase().slice(0, 2);
    if (reserviste) return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase();
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
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

  function getReplyParent(msg: Message): Message | undefined {
    if (!msg.reply_to_id) return undefined;
    return messages.find((m) => m.id === msg.reply_to_id);
  }

  const currentCanal = CANAUX.find((c) => c.id === canal);

  /* ──────────────────── Loading ──────────────────── */

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>
        Chargement...
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f7fa' }}>

      <PortailHeader subtitle="Communauté" />

      {/* Canaux horizontaux (mobile) */}
      {isMobile && (
        <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '8px 12px', display: 'flex', gap: '8px', overflowX: 'auto', flexShrink: 0 }}>
          <a href="/" style={{ padding: '8px 12px', fontSize: '13px', color: '#6b7280', textDecoration: 'none', flexShrink: 0 }}>{'← Accueil'}</a>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb', flexShrink: 0 }} />
          {CANAUX.map((c) => (
            <button key={c.id} onClick={() => { setCanal(c.id); setReplyTo(null); setEditingMessage(null); setReactionPickerMsgId(null); }} style={{
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

      <div style={{ flex: 1, display: 'flex', maxWidth: '1200px', margin: '0 auto', width: '100%', padding: isMobile ? '0' : '16px 24px', gap: '16px', minHeight: 0 }}>

        {/* Sidebar desktop */}
        {!isMobile && (
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', padding: '8px 16px' }}>{"← Retour à l'accueil"}</a>
            <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Canaux</div>
            {CANAUX.map((c) => (
              <button key={c.id} onClick={() => { setCanal(c.id); setReplyTo(null); setEditingMessage(null); setReactionPickerMsgId(null); }} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: canal === c.id ? '700' : '500', textAlign: 'left', width: '100%',
                backgroundColor: canal === c.id ? '#1e3a5f' : 'transparent',
                color: canal === c.id ? 'white' : '#374151',
                transition: 'all 0.15s',
              }}>
                <span>{c.emoji}</span>{c.label}
              </button>
            ))}
            <div style={{ marginTop: 'auto', padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '4px' }}>{'💡 Astuces'}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.7 }}>
                <b>Entrée</b> — envoyer<br />
                <b>Shift+Entrée</b> — saut de ligne<br />
                <b>Échap</b> — annuler
              </div>
            </div>
          </div>
        )}

        {/* ══════════ Zone de chat ══════════ */}
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

          {/* ══════════ Messages ══════════ */}
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
              const replyParent = getReplyParent(msg);
              const isHovered = hoveredMsg === msg.id;
              const showActions = actionMenuMsg === msg.id;
              const deleted = msg.is_deleted;
              const msgReactionGroups = getReactionGroups(msg.id);
              const hasReactions = msgReactionGroups.length > 0;

              return (
                <div
                  key={msg.id}
                  style={{
                    padding: showHeader
                      ? (isMobile ? '10px 4px 2px 4px' : '12px 8px 2px 8px')
                      : (isMobile ? '1px 4px' : '1px 8px'),
                    borderRadius: '8px', display: 'flex',
                    gap: isMobile ? '8px' : '12px', alignItems: 'flex-start',
                    transition: 'background 0.15s',
                    backgroundColor: isHovered && !isMobile ? '#f9fafb' : 'transparent',
                    position: 'relative',
                  }}
                  onMouseEnter={() => { if (!isMobile) setHoveredMsg(msg.id); }}
                  onMouseLeave={() => { if (!isMobile) { setHoveredMsg(null); if (showActions) setActionMenuMsg(null); } }}
                >
                  {/* Avatar */}
                  <div style={{ width: isMobile ? '30px' : '36px', flexShrink: 0 }}>
                    {showHeader && (
                      msg.auteur_photo ? (
                        <img src={msg.auteur_photo} alt="" style={{ width: isMobile ? '30px' : '36px', height: isMobile ? '30px' : '36px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: isMobile ? '30px' : '36px', height: isMobile ? '30px' : '36px', borderRadius: '50%', backgroundColor: deleted ? '#d1d5db' : (isMe ? '#1e3a5f' : '#6b7280'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: isMobile ? '10px' : '12px' }}>
                          {deleted ? '🗑️' : getInitials(msg.auteur_nom)}
                        </div>
                      )
                    )}
                  </div>

                  {/* Contenu */}
                  <div style={{ flex: 1, minWidth: 0 }}>

                    {showHeader && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '700', color: deleted ? '#9ca3af' : (isMe ? '#1e3a5f' : '#111827') }}>{msg.auteur_nom}</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{formatTime(msg.created_at)}</span>
                        {msg.edited_at && !deleted && (
                          <span style={{ fontSize: '11px', color: '#b0b8c4', fontStyle: 'italic' }}>(modifié)</span>
                        )}
                      </div>
                    )}

                    {/* Réponse citée */}
                    {replyParent && !deleted && (
                      <div style={{
                        borderLeft: '3px solid #1e3a5f', marginBottom: '4px',
                        backgroundColor: '#f0f4f8', borderRadius: '0 6px 6px 0', padding: '6px 10px',
                        fontSize: '12px', color: '#6b7280', maxHeight: '60px', overflow: 'hidden',
                      }}>
                        <span style={{ fontWeight: '600', color: '#1e3a5f', marginRight: '6px' }}>{replyParent.auteur_nom}</span>
                        {replyParent.is_deleted
                          ? <span style={{ fontStyle: 'italic' }}>Message supprimé</span>
                          : (replyParent.contenu || (replyParent.file_name ? `📎 ${replyParent.file_name}` : ''))
                        }
                      </div>
                    )}

                    {deleted ? (
                      <div style={{ fontSize: isMobile ? '13px' : '14px', color: '#b0b8c4', fontStyle: 'italic', lineHeight: 1.6 }}>
                        Ce message a été supprimé.
                      </div>
                    ) : (
                      <>
                        {/* Édition inline */}
                        {editingMessage?.id === msg.id ? (
                          <div style={{ marginTop: '4px' }}>
                            <textarea
                              value={editText}
                              onChange={(e) => {
                                setEditText(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                              }}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              ref={(el) => {
                                if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                              }}
                              style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px',
                                border: '2px solid #1e3a5f', fontSize: '14px', resize: 'none',
                                fontFamily: 'inherit', lineHeight: 1.6, outline: 'none',
                                minHeight: '60px', maxHeight: '400px', boxSizing: 'border-box', overflow: 'auto',
                              }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '12px' }}>
                              <button onClick={saveEdit} style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#1e3a5f', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Sauvegarder</button>
                              <button onClick={cancelEdit} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#6b7280', cursor: 'pointer' }}>Annuler</button>
                              <span style={{ color: '#9ca3af', alignSelf: 'center' }}>Échap pour annuler • Entrée pour sauvegarder</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.contenu && (
                              <div style={{ fontSize: isMobile ? '13px' : '14px', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.contenu}</div>
                            )}

                            {msg.image_url && msg.file_name && isImageFile(msg.file_name) && (
                              <div style={{ marginTop: '6px' }}>
                                <img src={msg.image_url} alt={msg.file_name} onClick={() => setLightboxUrl(msg.image_url!)} style={{ maxWidth: isMobile ? '220px' : '360px', maxHeight: '280px', borderRadius: '10px', cursor: 'pointer', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                              </div>
                            )}

                            {msg.image_url && msg.file_name && !isImageFile(msg.file_name) && (
                              <a href={msg.image_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '6px', padding: '8px 14px', borderRadius: '8px', backgroundColor: '#f0f4f8', border: '1px solid #d1d5db', color: '#1e3a5f', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
                                <span style={{ fontSize: '18px' }}>{fileIcon(msg.file_name)}</span>
                                <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.file_name}</span>
                                <span style={{ fontSize: '16px' }}>↓</span>
                              </a>
                            )}

                            {!showHeader && msg.edited_at && (
                              <span style={{ fontSize: '11px', color: '#b0b8c4', fontStyle: 'italic' }}>(modifié)</span>
                            )}
                          </>
                        )}

                        {/* ══════ Réactions sous le message ══════ */}
                        {(hasReactions || false) && editingMessage?.id !== msg.id && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                            {msgReactionGroups.map((group) => (
                              <button
                                key={group.emoji}
                                onClick={() => toggleReaction(msg.id, group.emoji)}
                                title={`${group.count} réaction${group.count > 1 ? 's' : ''}`}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '2px 8px', borderRadius: '12px',
                                  border: group.iMine ? '2px solid #1e3a5f' : '1px solid #e5e7eb',
                                  backgroundColor: group.iMine ? '#eef2f7' : '#f9fafb',
                                  cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s',
                                }}
                              >
                                <span style={{ fontSize: '15px' }}>{group.emoji}</span>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: group.iMine ? '#1e3a5f' : '#6b7280' }}>{group.count}</span>
                              </button>
                            ))}
                            <button
                              onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                              title="Ajouter une réaction"
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '28px', height: '28px', borderRadius: '12px',
                                border: '1px dashed #d1d5db', backgroundColor: 'transparent',
                                cursor: 'pointer', fontSize: '14px', color: '#9ca3af', transition: 'all 0.15s',
                              }}
                            >+</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Actions hover (desktop) ── */}
                  {!deleted && isHovered && !isMobile && editingMessage?.id !== msg.id && (
                    <div style={{
                      position: 'absolute', top: showHeader ? '6px' : '-8px', right: '8px',
                      display: 'flex', gap: '1px', backgroundColor: 'white',
                      border: '1px solid #e5e7eb', borderRadius: '8px', padding: '2px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10,
                    }}>
                      {QUICK_REACTIONS.map((em) => (
                        <button key={em} onClick={() => toggleReaction(msg.id, em)} title={em}
                          style={{ ...actionBtnStyle, fontSize: '16px', width: '28px', height: '28px' }}
                          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f0f4f8'; e.currentTarget.style.transform = 'scale(1.2)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >{em}</button>
                      ))}
                      <div style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '4px 2px' }} />
                      <button onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)} title="Plus de réactions"
                        style={{ ...actionBtnStyle, fontSize: '12px', width: '28px', height: '28px' }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f4f8')}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >😊</button>
                      <div style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '4px 2px' }} />
                      <button onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }} title="Répondre"
                        style={{ ...actionBtnStyle, width: '28px', height: '28px' }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f4f8')}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >↩️</button>
                      {canModify(msg) && (
                        <button onClick={() => setActionMenuMsg(actionMenuMsg === msg.id ? null : msg.id)} title="Plus d'options"
                          style={{ ...actionBtnStyle, width: '28px', height: '28px' }}
                          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f4f8')}
                          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >⋯</button>
                      )}
                    </div>
                  )}

                  {/* Actions (mobile) */}
                  {isMobile && !deleted && editingMessage?.id !== msg.id && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0, paddingTop: showHeader ? '4px' : '0' }}>
                      <button onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)} style={actionBtnStyleMobile} title="Réaction">😊</button>
                      <button onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }} style={actionBtnStyleMobile}>↩️</button>
                      {canModify(msg) && (
                        <button onClick={() => setActionMenuMsg(actionMenuMsg === msg.id ? null : msg.id)} style={actionBtnStyleMobile}>⋯</button>
                      )}
                    </div>
                  )}

                  {/* ── Reaction picker (par message) ── */}
                  {reactionPickerMsgId === msg.id && (
                    <div ref={reactionPickerRef} style={{
                      position: 'absolute',
                      top: isMobile ? 'auto' : (showHeader ? '36px' : '24px'),
                      bottom: isMobile ? '100%' : 'auto',
                      right: '8px',
                      width: isMobile ? '280px' : '320px', backgroundColor: 'white',
                      border: '1px solid #e5e7eb', borderRadius: '14px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.18)', zIndex: 50, overflow: 'hidden',
                    }}>
                      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '4px' }}>
                        {EMOJI_CATEGORIES.map((cat, i) => (
                          <button key={cat.label} onClick={() => setReactionPickerCategory(i)} style={{
                            flex: 1, padding: '5px 2px', border: 'none', cursor: 'pointer',
                            fontSize: '11px', fontWeight: reactionPickerCategory === i ? '700' : '400',
                            color: reactionPickerCategory === i ? '#1e3a5f' : '#9ca3af',
                            backgroundColor: reactionPickerCategory === i ? '#f0f4f8' : 'transparent',
                            borderRadius: '6px', transition: 'all 0.15s',
                          }}>{cat.label}</button>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 7 : 8}, 1fr)`, gap: '2px', padding: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                        {EMOJI_CATEGORIES[reactionPickerCategory].emojis.map((em) => (
                          <button key={em} onClick={() => toggleReaction(msg.id, em)} style={{
                            width: '100%', aspectRatio: '1', border: 'none',
                            backgroundColor: 'transparent', cursor: 'pointer',
                            fontSize: isMobile ? '20px' : '22px', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s',
                          }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f0f4f8'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                          >{em}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Menu contextuel (éditer / supprimer) */}
                  {showActions && canModify(msg) && (
                    <div ref={actionMenuRef} style={{
                      position: 'absolute', top: showHeader ? '36px' : '24px', right: '8px',
                      backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '160px', overflow: 'hidden',
                    }}>
                      {(msg.user_id === user?.id || isAdmin) && (
                        <button onClick={() => startEdit(msg)} style={menuItemStyle}
                          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        ><span>✏️</span> Modifier</button>
                      )}
                      <button onClick={() => deleteMessage(msg)} style={{ ...menuItemStyle, color: '#dc2626' }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      ><span>🗑️</span> Supprimer</button>
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* ══════════ Zone de saisie ══════════ */}
          <div style={{ borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>

            {replyTo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 20px', backgroundColor: '#f0f4f8', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ borderLeft: '3px solid #1e3a5f', paddingLeft: '10px', flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e3a5f' }}>Répondre à {replyTo.auteur_nom}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {replyTo.contenu || (replyTo.file_name ? `📎 ${replyTo.file_name}` : '')}
                  </div>
                </div>
                <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af', padding: '4px' }}>✕</button>
              </div>
            )}

            {filePreview && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 20px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {filePreview.previewUrl ? (
                  <img src={filePreview.previewUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '8px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{fileIcon(filePreview.file.name)}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePreview.file.name}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>{(filePreview.file.size / 1024).toFixed(0)} Ko</div>
                </div>
                <button onClick={cancelFilePreview} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af', padding: '4px' }}>✕</button>
              </div>
            )}

            <div style={{ padding: isMobile ? '10px 12px' : '12px 20px' }}>
              {reserviste ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Joindre un fichier"
                    style={{ width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: uploading ? 'wait' : 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s', color: '#6b7280' }}
                  >{uploading ? '⏳' : '📎'}</button>
                  <input ref={fileInputRef} type="file" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} />

                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji"
                      style={{ width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #d1d5db', backgroundColor: showEmojiPicker ? '#f0f4f8' : 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                    >😊</button>

                    {showEmojiPicker && (
                      <div ref={emojiPickerRef} style={{ position: 'absolute', bottom: '48px', left: isMobile ? '-60px' : '0', width: isMobile ? '280px' : '340px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 100, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '4px' }}>
                          {EMOJI_CATEGORIES.map((cat, i) => (
                            <button key={cat.label} onClick={() => setActiveEmojiCategory(i)} style={{
                              flex: 1, padding: '6px 4px', border: 'none', cursor: 'pointer', fontSize: '11px',
                              fontWeight: activeEmojiCategory === i ? '700' : '400',
                              color: activeEmojiCategory === i ? '#1e3a5f' : '#9ca3af',
                              backgroundColor: activeEmojiCategory === i ? '#f0f4f8' : 'transparent',
                              borderRadius: '6px', transition: 'all 0.15s',
                            }}>{cat.label}</button>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 7 : 8}, 1fr)`, gap: '2px', padding: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                          {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((em) => (
                            <button key={em} onClick={() => handleEmojiSelect(em)} style={{
                              width: '100%', aspectRatio: '1', border: 'none', backgroundColor: 'transparent',
                              cursor: 'pointer', fontSize: isMobile ? '20px' : '22px', borderRadius: '8px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s',
                            }}
                              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f4f8')}
                              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >{em}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <textarea ref={textareaRef} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={replyTo ? `Répondre à ${replyTo.auteur_nom}...` : `Écrire dans #${currentCanal?.label}...`} rows={1}
                    style={{ flex: 1, padding: isMobile ? '10px 12px' : '10px 16px', borderRadius: '12px', border: '1px solid #d1d5db', fontSize: '14px', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none', transition: 'border-color 0.2s', minHeight: '40px', maxHeight: '120px', boxSizing: 'border-box' }}
                    onFocus={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />

                  <button onClick={sendMessage} disabled={(!newMessage.trim() && !filePreview) || sending || uploading}
                    style={{
                      padding: isMobile ? '10px 14px' : '10px 20px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '700', flexShrink: 0,
                      cursor: (newMessage.trim() || filePreview) && !sending && !uploading ? 'pointer' : 'default',
                      backgroundColor: (newMessage.trim() || filePreview) && !sending && !uploading ? '#1e3a5f' : '#e5e7eb',
                      color: (newMessage.trim() || filePreview) && !sending && !uploading ? 'white' : '#9ca3af',
                      transition: 'all 0.2s', minHeight: '40px',
                    }}
                  >{sending || uploading ? '⏳' : (isMobile ? '→' : 'Envoyer')}</button>
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

      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer', padding: '20px' }}>
          <img src={lightboxUrl} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: '20px', right: '20px', width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────── Styles ──────────────────── */

const actionBtnStyle: React.CSSProperties = {
  width: '30px', height: '30px', borderRadius: '6px', border: 'none',
  backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.1s',
};

const actionBtnStyleMobile: React.CSSProperties = {
  width: '26px', height: '26px', borderRadius: '6px', border: 'none',
  backgroundColor: 'transparent', cursor: 'pointer', fontSize: '12px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  width: '100%', padding: '10px 16px', border: 'none',
  backgroundColor: 'transparent', cursor: 'pointer',
  fontSize: '14px', color: '#374151', textAlign: 'left',
  transition: 'background 0.1s',
};
