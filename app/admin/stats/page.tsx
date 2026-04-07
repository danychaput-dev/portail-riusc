'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────
interface LogRow {
  id: number;
  user_id: string | null;
  email: string | null;
  telephone: string | null;
  event_type: string;
  auth_method: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string;
  created_at: string;
  page_visited: string | null;
}

interface AuditPageRow {
  id: string;
  user_id: string | null;
  benevole_id: string | null;
  page: string;
  visite_a: string;
}

interface Reserviste {
  id: number;
  benevole_id: string | null;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  groupe: string | null;
  region: string | null;
  statut: string | null;
  created_at: string | null;
  monday_created_at: string | null;
  user_id: string | null;
}

type Period = 'today' | '7d' | '30d' | 'custom';

// ─── Helpers ──────────────────────────────────────────────────────────
const PRIMARY = '#1e3a5f';
const PRIMARY_LIGHT = '#2a5080';
const GREEN = '#16a34a';
const RED = '#dc2626';
const ORANGE = '#f59e0b';
const BLUE = '#3b82f6';
const PURPLE = '#8b5cf6';
const GREY_BG = '#f3f4f6';
const GREY_BORDER = '#e5e7eb';

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function parseUA(ua: string | null): string {
  if (!ua) return 'Inconnu';
  if (ua.includes('FBAN') || ua.includes('FB_IAB') || ua.includes('FBAV')) return 'Facebook';
  if (ua.includes('Instagram')) return 'Instagram';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'Safari iOS';
  if (ua.includes('Android')) return 'Chrome Android';
  if (ua.includes('Chrome')) return 'Chrome Desktop';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Autre';
}

function parseDevice(ua: string | null): string {
  if (!ua) return 'Inconnu';
  if (ua.includes('iPhone') || (ua.includes('Android') && ua.includes('Mobile'))) return 'Mobile';
  if (ua.includes('iPad') || ua.includes('Tablet')) return 'Tablette';
  return 'Desktop';
}

function getPageLabel(page: string | null): string {
  if (!page) return '—';
  const map: Record<string, string> = {
    '/': 'Accueil',
    '/login': 'Connexion',
    '/inscription': 'Inscription',
    '/profil': 'Profil',
    '/formation': 'Formation',
    '/dossier': 'Dossier',
    '/disponibilites': 'Disponibilités',
    '/disponibilites/soumettre': 'Soumettre dispo',
    '/communaute': 'Communauté',
    '/informations': 'Informations',
    '/tournee-camps': 'Tournée camps',
    '/fiches-taches': 'Fiches tâches',
  };
  return map[page] || page;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `il y a ${days}j`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

// ─── Components ───────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: string }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '20px 24px',
      border: `1px solid ${GREY_BORDER}`,
      flex: '1 1 200px',
      minWidth: 170,
    }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>{icon ? `${icon} ` : ''}{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: color || PRIMARY, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 16px', flex: '1 1 100px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || PRIMARY }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <div style={{ width: 140, fontSize: 13, color: '#374151', fontWeight: 500, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: GREY_BG, borderRadius: 6, height: 22, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(pct, 2)}%`,
          height: '100%',
          background: color || PRIMARY,
          borderRadius: 6,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ width: 45, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{value}</div>
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="print-section" style={{
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${GREY_BORDER}`,
      borderTop: accent ? `3px solid ${accent}` : undefined,
      padding: 24,
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: PRIMARY }}>{title}</h3>
      {children}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      margin: '32px 0 20px 0',
    }}>
      <div style={{ height: 2, flex: 1, background: GREY_BORDER }} />
      <span style={{ fontSize: 15, fontWeight: 700, color: PRIMARY, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</span>
      <div style={{ height: 2, flex: 1, background: GREY_BORDER }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function StatsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [auditPages, setAuditPages] = useState<AuditPageRow[]>([]);
  const [auditPagesAll, setAuditPagesAll] = useState<{ benevole_id: string | null; user_id: string | null }[]>([]);
  const [reservistes, setReservistes] = useState<Reserviste[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [excludeMe, setExcludeMe] = useState(true);

  // Period (for logs)
  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState(formatDate(new Date()));
  const [customTo, setCustomTo] = useState(formatDate(new Date()));

  // Print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-print-stats', 'true');
    style.textContent = `
      @media print {
        @page { size: A4 landscape; margin: 10mm; }
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-size: 11px !important; }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        header { position: relative !important; }
        div[style*="box-shadow"] { box-shadow: none !important; }

        /* Empêcher les coupures dans les sections */
        .print-section { break-inside: avoid !important; page-break-inside: avoid !important; }

        /* Forcer les grilles en 2 colonnes fixes */
        .print-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 12px !important; }

        /* Les cartes KPI en ligne */
        .print-cards { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; }
        .print-cards > div { flex: 1 1 22% !important; min-width: 0 !important; padding: 12px 16px !important; }
        .print-cards > div > div:nth-child(2) { font-size: 24px !important; }

        /* Tables */
        table { font-size: 11px !important; }
        th, td { padding: 5px 8px !important; }

        /* Réduire les marges */
        .print-content { padding: 12px 8px !important; }
        .print-content h3 { font-size: 14px !important; margin-bottom: 8px !important; }

        /* Barres : réduire hauteur */
        .print-bar-row { padding: 3px 0 !important; }

        /* Sparkline & histogram plus petits */
        .print-chart { height: 60px !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Init user
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  // Date range
  const { from, to } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (period) {
      case 'today':
        return { from: todayStart.toISOString(), to: now.toISOString() };
      case '7d': {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - 6);
        return { from: d.toISOString(), to: now.toISOString() };
      }
      case '30d': {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - 29);
        return { from: d.toISOString(), to: now.toISOString() };
      }
      case 'custom': {
        const f = new Date(customFrom + 'T00:00:00');
        const t = new Date(customTo + 'T23:59:59');
        return { from: f.toISOString(), to: t.toISOString() };
      }
    }
  }, [period, customFrom, customTo]);

  // Fetch logs + reservistes
  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      setLoading(true);

      const [logsRes, resRes, auditRes] = await Promise.all([
        supabase.from('auth_logs').select('*').gte('created_at', from).lte('created_at', to).order('created_at', { ascending: false }),
        supabase.from('reservistes').select('id, benevole_id, prenom, nom, email, telephone, groupe, region, statut, created_at, monday_created_at, user_id').neq('groupe', 'Partenaires'),
        fetch(`/api/audit/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then(r => r.json()),
      ]);

      if (logsRes.data) setLogs(logsRes.data as LogRow[]);
      if (resRes.data) setReservistes(resRes.data as Reserviste[]);
      if (auditRes.pages) setAuditPages(auditRes.pages as AuditPageRow[]);
      if (auditRes.all) setAuditPagesAll(auditRes.all as { benevole_id: string | null; user_id: string | null }[]);
      setLoading(false);
    })();
  }, [currentUserId, from, to]);

  // ─── Stats réservistes ────────────────────────────────────────────
  const resStats = useMemo(() => {
    const total = reservistes.length;
    const now = Date.now();
    const DAY = 86400000;

    // Groupes
    const groupCounts: Record<string, number> = {};
    reservistes.forEach(r => {
      const g = r.groupe || 'Non défini';
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    });
    const groupRanking = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
    const approuves = groupCounts['Approuvé'] || 0;
    const interets = groupCounts['Intérêt'] || 0;

    // Inscriptions récentes — utilise monday_created_at (vraie date Monday), fallback sur created_at
    const getInscDate = (r: Reserviste): number | null => {
      const d = r.monday_created_at || r.created_at;
      return d ? new Date(d).getTime() : null;
    };
    const last24h = reservistes.filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= DAY; }).length;
    const last7d = reservistes.filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= 7 * DAY; }).length;
    const last30d = reservistes.filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= 30 * DAY; }).length;

    // Régions
    const regionCounts: Record<string, number> = {};
    reservistes.forEach(r => {
      const reg = r.region || 'Non définie';
      regionCounts[reg] = (regionCounts[reg] || 0) + 1;
    });
    const regionRanking = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);

    // Comptes liés
    const linked = reservistes.filter(r => r.user_id).length;

    // 10 derniers inscrits
    const recentInscriptions = [...reservistes]
      .filter(r => r.monday_created_at || r.created_at)
      .sort((a, b) => {
        const da = new Date(a.monday_created_at || a.created_at!).getTime();
        const db = new Date(b.monday_created_at || b.created_at!).getTime();
        return db - da;
      })
      .slice(0, 10);

    // Sparkline 30 jours
    const dailyCounts: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      dailyCounts[formatDate(d)] = 0;
    }
    reservistes.forEach(r => {
      const d = r.monday_created_at || r.created_at;
      if (!d) return;
      const day = formatDate(new Date(d));
      if (day in dailyCounts) dailyCounts[day]++;
    });
    const dailyData = Object.entries(dailyCounts);

    return { total, approuves, interets, last24h, last7d, last30d, groupRanking, regionRanking, linked, recentInscriptions, dailyData };
  }, [reservistes]);

  const filteredLogs = useMemo(() => {
    if (!excludeMe || !currentUserId) return logs;
    return logs.filter(l => l.user_id !== currentUserId);
  }, [logs, excludeMe, currentUserId]);

  // ─── Stats logs ───────────────────────────────────────────────────
  const logStats = useMemo(() => {
    const logs = filteredLogs;
    const pageVisits = logs.filter(l => l.event_type === 'page_visit');
    const authEvents = logs.filter(l => l.event_type !== 'page_visit');
    const logins = logs.filter(l => l.event_type === 'login_sms' || l.event_type === 'login_email');
    const failed = logs.filter(l => l.event_type === 'login_failed');
    const anonymous = pageVisits.filter(l => !l.user_id);
    const authenticated = pageVisits.filter(l => !!l.user_id);
    const uniqueUsers = new Set(logs.filter(l => l.user_id).map(l => l.user_id));

    const pageCounts: Record<string, number> = {};
    pageVisits.forEach(l => { const p = l.page_visited || 'unknown'; pageCounts[p] = (pageCounts[p] || 0) + 1; });
    const pageRanking = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]);

    const sourceCounts: Record<string, number> = {};
    anonymous.forEach(l => { const s = parseUA(l.user_agent); sourceCounts[s] = (sourceCounts[s] || 0) + 1; });
    const sourceRanking = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

    const deviceCounts: Record<string, number> = {};
    pageVisits.forEach(l => { const d = parseDevice(l.user_agent); deviceCounts[d] = (deviceCounts[d] || 0) + 1; });
    const deviceRanking = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]);

    const failedDetails = failed.map(l => ({
      email: l.email || l.telephone || '?',
      time: new Date(l.created_at).toLocaleString('fr-CA', { timeZone: 'America/Montreal' }),
      method: l.auth_method || '—',
    }));

    // Personnes uniques qui ont échoué, et combien ont réussi ensuite
    // Normaliser un identifiant (email, téléphone, user_id) → clé comparable
    const normalize = (v: string): string => {
      const s = v.toLowerCase().trim();
      // Si c'est un téléphone, ne garder que les chiffres
      const digits = s.replace(/\D/g, '');
      if (digits.length >= 10) return digits.slice(-10); // Garder les 10 derniers chiffres
      return s;
    };

    // Construire un lookup : n'importe quel identifiant normalisé → Set de toutes les clés normalisées du même réserviste
    const identityGroups = new Map<string, Set<string>>();
    reservistes.forEach(r => {
      const keys = new Set<string>();
      if (r.email) keys.add(normalize(r.email));
      if (r.telephone) keys.add(normalize(r.telephone));
      if (r.user_id) keys.add(r.user_id.toLowerCase());
      // Chaque clé pointe vers le même groupe
      keys.forEach(k => { identityGroups.set(k, keys); });
    });

    // Résoudre une identité vers toutes ses variantes connues
    const resolveAll = (raw: string): Set<string> => {
      const n = normalize(raw);
      const group = identityGroups.get(n);
      return group || new Set([n]);
    };

    // Identités uniques qui ont échoué
    const failedPeople = new Map<string, Set<string>>(); // canonical → all keys
    failed.forEach(l => {
      const raw = l.email || l.telephone || l.user_id || '';
      if (!raw) return;
      const allKeys = resolveAll(raw);
      const canonical = Array.from(allKeys).sort().join('|');
      if (!failedPeople.has(canonical)) failedPeople.set(canonical, allKeys);
    });
    const failedUniqueUsers = failedPeople.size;

    // Toutes les identités normalisées qui ont réussi à se connecter
    const succeededNormalized = new Set<string>();
    // 1. auth_logs logins réussis
    logins.forEach(l => {
      if (l.email) succeededNormalized.add(normalize(l.email));
      if (l.telephone) succeededNormalized.add(normalize(l.telephone));
      if (l.user_id) succeededNormalized.add(l.user_id.toLowerCase());
    });
    // 2. audit_pages — tout user_id qui a visité une page = connecté
    auditPages.filter(p => p.user_id).forEach(p => {
      succeededNormalized.add(p.user_id!.toLowerCase());
      // Aussi résoudre vers email/telephone
      const group = identityGroups.get(p.user_id!.toLowerCase());
      if (group) group.forEach(k => succeededNormalized.add(k));
    });
    // 3. page_visit authentifiées dans auth_logs
    authenticated.forEach(l => {
      if (l.email) succeededNormalized.add(normalize(l.email));
      if (l.telephone) succeededNormalized.add(normalize(l.telephone));
      if (l.user_id) succeededNormalized.add(l.user_id.toLowerCase());
    });

    // Compter combien de personnes échouées ont au moins une clé dans succeededNormalized
    let failedThenSucceeded = 0;
    failedPeople.forEach(keys => {
      const found = Array.from(keys).some(k => succeededNormalized.has(k));
      if (found) failedThenSucceeded++;
    });

    // Build user_id → name lookup from reservistes
    const userNameMap: Record<string, string> = {};
    reservistes.forEach(r => {
      if (r.prenom && r.nom) {
        const fullName = `${r.prenom} ${r.nom}`;
        if (r.user_id) userNameMap[r.user_id] = fullName;
      }
    });
    // Also build phone → name and email → name for fallback
    const phoneNameMap: Record<string, string> = {};
    const emailNameMap: Record<string, string> = {};
    reservistes.forEach(r => {
      if (!r.prenom || !r.nom) return;
      const fullName = `${r.prenom} ${r.nom}`;
      if (r.telephone) {
        phoneNameMap[r.telephone] = fullName;
        // Also store with leading 1 stripped and with leading 1 added
        if (r.telephone.startsWith('1')) phoneNameMap[r.telephone.slice(1)] = fullName;
        else phoneNameMap['1' + r.telephone] = fullName;
      }
      if (r.email) emailNameMap[r.email.toLowerCase()] = fullName;
    });

    const resolveName = (l: LogRow): string => {
      if (l.user_id && userNameMap[l.user_id]) return userNameMap[l.user_id];
      if (l.telephone && phoneNameMap[l.telephone]) return phoneNameMap[l.telephone];
      if (l.email && emailNameMap[l.email.toLowerCase()]) return emailNameMap[l.email.toLowerCase()];
      return l.email || l.telephone || l.user_id || '?';
    };

    const userPageCounts: Record<string, { email: string; count: number }> = {};
    authenticated.forEach(l => {
      if (!l.user_id) return;
      if (!userPageCounts[l.user_id]) userPageCounts[l.user_id] = { email: resolveName(l), count: 0 };
      userPageCounts[l.user_id].count++;
    });
    const activeUsers = Object.values(userPageCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    const hourlyViews: number[] = new Array(24).fill(0);
    const hourlyUserSets: Set<string>[] = Array.from({ length: 24 }, () => new Set<string>());
    const hourlyNameSets: Set<string>[] = Array.from({ length: 24 }, () => new Set<string>());
    const hourlyAnonCounts: number[] = new Array(24).fill(0);
    pageVisits.forEach(l => {
      const h = new Date(l.created_at).getHours();
      hourlyViews[h]++;
      const uid = l.user_id || l.email || l.telephone || '';
      if (uid) {
        hourlyUserSets[h].add(uid);
        hourlyNameSets[h].add(resolveName(l));
      } else {
        hourlyAnonCounts[h]++;
      }
    });
    const hourlyCounts = hourlyViews;
    const hourlyUnique = hourlyUserSets.map((s, i) => s.size + (hourlyAnonCounts[i] > 0 ? 1 : 0));
    const hourlyNames = hourlyNameSets.map((s, i) => {
      const names = Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
      if (hourlyAnonCounts[i] > 0) names.push(`+ ${hourlyAnonCounts[i]} anonyme${hourlyAnonCounts[i] > 1 ? 's' : ''}`);
      return names;
    });

    return { totalVisits: pageVisits.length, uniqueUsers: uniqueUsers.size, logins: logins.length, failed: failed.length, anonymous: anonymous.length, authenticated: authenticated.length, pageRanking, sourceRanking, deviceRanking, failedDetails, failedUniqueUsers, failedThenSucceeded, activeUsers, authEvents, hourlyCounts, hourlyUnique, hourlyNames };
  }, [filteredLogs, reservistes, auditPages]);

  // ─── Stats audit_pages ────────────────────────────────────────────
  const auditStats = useMemo(() => {
    const filtered = excludeMe && currentUserId
      ? auditPages.filter(p => p.user_id !== currentUserId)
      : auditPages;

    const connexions = filtered.filter(p => p.page === '__connexion__');
    const pages = filtered.filter(p => p.page !== '__connexion__');
    const uniqueUsers = new Set(filtered.filter(p => p.user_id || p.benevole_id).map(p => p.benevole_id || p.user_id));

    // Top pages
    const pageCounts: Record<string, number> = {};
    pages.forEach(p => { pageCounts[p.page] = (pageCounts[p.page] || 0) + 1; });
    const pageRanking = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Top utilisateurs actifs
    const userMap: Record<string, string> = {};
    reservistes.forEach(r => {
      if (r.prenom && r.nom) {
        userMap[r.benevole_id || String(r.id)] = `${r.prenom} ${r.nom}`;
        if (r.user_id) userMap[r.user_id] = `${r.prenom} ${r.nom}`;
      }
    });
    const userCounts: Record<string, number> = {};
    pages.forEach(p => {
      const key = p.benevole_id || p.user_id;
      if (!key) return;
      userCounts[key] = (userCounts[key] || 0) + 1;
    });
    const activeUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ name: userMap[key] || key.slice(0, 8) + '…', count }));

    // Réservistes jamais vus dans audit_pages — on croise par user_id (fiable même sans cookie benevole_id)
    const seenUserIds = new Set(auditPagesAll.map(p => p.user_id).filter(Boolean));
    const neverConnected = reservistes.filter(r => r.user_id && !seenUserIds.has(r.user_id));

    return { totalPages: pages.length, connexions: connexions.length, uniqueUsers: uniqueUsers.size, pageRanking, activeUsers, neverConnected };
  }, [auditPages, auditPagesAll, excludeMe, currentUserId, reservistes]);

  // ─── Render ───────────────────────────────────────────────────────
  const GROUP_COLORS: Record<string, string> = {
    'Approuvé': GREEN, 'Intérêt': BLUE, 'Formation incomplète': ORANGE, 'Non défini': '#9ca3af',
  };

  return (
    <div style={{ background: '#f9fafb', minHeight: '100%' }}>
      <div className="print-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

        {/* Actions */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: PRIMARY }}>📊 Statistiques du portail</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setExcludeMe(prev => !prev)}
              style={{
                background: excludeMe ? PRIMARY : '#fff',
                color: excludeMe ? '#fff' : PRIMARY,
                border: `1px solid ${PRIMARY}`,
                borderRadius: 8,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
              title={excludeMe ? 'Vous êtes exclu des statistiques — cliquez pour vous inclure' : 'Vous êtes inclus dans les statistiques — cliquez pour vous exclure'}
            >
              {excludeMe ? '🙈 Moi exclu' : '👁️ Moi inclus'}
            </button>
            <button
              onClick={() => window.print()}
              style={{
                background: '#fff',
                color: PRIMARY,
                border: `1px solid ${GREY_BORDER}`,
                borderRadius: 8,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              🖨️ Exporter PDF
            </button>
          </div>
        </div>

        {/* En-tête PDF avec date — visible seulement à l'impression */}
        <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${GREY_BORDER}` }}>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            Rapport généré le {new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Montreal' })}
            {period === 'today' ? " — Période : Aujourd'hui" : period === '7d' ? ' — Période : 7 derniers jours' : period === '30d' ? ' — Période : 30 derniers jours' : ` — Période : ${customFrom} au ${customTo}`}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Chargement des données...</div>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════════════
                SECTION 1 — RÉSERVISTES (données globales)
            ═══════════════════════════════════════════════════════════ */}
            <Divider label="🧑‍🤝‍🧑 Réservistes" />

            {/* KPI globaux */}
            <div className="print-cards" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              <StatCard icon="👥" label="Total réservistes" value={resStats.total} />
              <StatCard icon="✅" label="Approuvés" value={resStats.approuves} color={GREEN} sub={`${resStats.total > 0 ? Math.round(resStats.approuves / resStats.total * 100) : 0}% du total`} />
              <StatCard icon="🔵" label="Intérêt" value={resStats.interets} color={BLUE} sub={`${resStats.total > 0 ? Math.round(resStats.interets / resStats.total * 100) : 0}% du total`} />
              <StatCard icon="🔗" label="Comptes liés" value={resStats.linked} color={PURPLE} sub={`${resStats.total - resStats.linked} sans compte`} />
            </div>

            {/* Nouvelles inscriptions */}
            <div className="print-section" style={{
              background: '#fff',
              borderRadius: 12,
              border: `1px solid ${GREY_BORDER}`,
              borderTop: `3px solid ${BLUE}`,
              padding: 24,
              marginBottom: 20,
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: PRIMARY }}>📥 Nouvelles inscriptions</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: `1px solid ${GREY_BG}`, marginBottom: 16 }}>
                <MiniStat label="Dernières 24h" value={resStats.last24h} color={resStats.last24h > 0 ? GREEN : '#9ca3af'} />
                <MiniStat label="7 derniers jours" value={resStats.last7d} color={resStats.last7d > 0 ? BLUE : '#9ca3af'} />
                <MiniStat label="30 derniers jours" value={resStats.last30d} color={resStats.last30d > 0 ? PRIMARY : '#9ca3af'} />
              </div>

              {/* Sparkline 30 jours */}
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, fontWeight: 500 }}>Inscriptions par jour (30 derniers jours)</div>
              <div className="print-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
                {resStats.dailyData.map(([day, count]) => {
                  const maxD = Math.max(...resStats.dailyData.map(d => d[1] as number), 1);
                  const height = ((count as number) / maxD) * 100;
                  const isToday = day === formatDate(new Date());
                  return (
                    <div key={day} title={`${day}: ${count} inscription${(count as number) > 1 ? 's' : ''}`} style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                    }}>
                      <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 500 }}>{(count as number) > 0 ? count : ''}</div>
                      <div style={{
                        width: '100%',
                        maxWidth: 22,
                        height: `${Math.max(height, 4)}%`,
                        background: isToday ? GREEN : (count as number) > 0 ? BLUE : '#e5e7eb',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.5s ease',
                        opacity: (count as number) > 0 ? 1 : 0.3,
                      }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>il y a 30j</span>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>aujourd&#39;hui</span>
              </div>
            </div>

            <div className="print-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>
              {/* Groupes */}
              <Section title="📋 Répartition par groupe" accent={PRIMARY}>
                {resStats.groupRanking.map(([group, count]) => (
                  <BarRow key={group} label={group} value={count} max={resStats.groupRanking[0]?.[1] || 1} color={GROUP_COLORS[group] || '#6b7280'} />
                ))}
              </Section>

              {/* Régions */}
              <Section title="🗺️ Répartition par région" accent={PRIMARY}>
                {resStats.regionRanking.slice(0, 12).map(([region, count]) => (
                  <BarRow key={region} label={region.length > 25 ? region.slice(0, 23) + '…' : region} value={count} max={resStats.regionRanking[0]?.[1] || 1} color={PRIMARY_LIGHT} />
                ))}
                {resStats.regionRanking.length > 12 && (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>+ {resStats.regionRanking.length - 12} autres régions</div>
                )}
              </Section>
            </div>

            {/* 10 dernières inscriptions */}
            <div style={{ marginBottom: 8 }}>
              <Section title="🆕 Dernières inscriptions" accent={GREEN}>
                {resStats.recentInscriptions.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Aucune inscription récente</div>
                  : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: `2px solid ${GREY_BORDER}` }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Nom</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Groupe</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Région</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Quand</th>
                            <th style={{ textAlign: 'center', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Compte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resStats.recentInscriptions.map((r) => (
                            <tr key={r.id} style={{ borderBottom: `1px solid ${GREY_BG}` }}>
                              <td style={{ padding: '8px 12px', color: '#374151', fontWeight: 500 }}>{r.prenom && r.nom ? `${r.prenom} ${r.nom}` : `#${r.id}`}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 10px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: r.groupe === 'Approuvé' ? '#dcfce7' : r.groupe === 'Intérêt' ? '#dbeafe' : '#fef3c7',
                                  color: r.groupe === 'Approuvé' ? GREEN : r.groupe === 'Intérêt' ? BLUE : ORANGE,
                                }}>
                                  {r.groupe || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.region || '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{(r.monday_created_at || r.created_at) ? timeAgo(r.monday_created_at || r.created_at!) : '—'}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                {r.user_id
                                  ? <span style={{ color: GREEN, fontWeight: 600 }}>✓</span>
                                  : <span style={{ color: '#d1d5db' }}>—</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </Section>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 2 — ACTIVITÉ PORTAIL (audit_pages)
            ═══════════════════════════════════════════════════════════ */}
            <Divider label="📱 Activité portail" />

            <div className="print-cards" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
              <StatCard icon="📄" label="Pages vues" value={auditStats.totalPages} sub="utilisateurs connectés" />
              <StatCard icon="🔑" label="Connexions" value={auditStats.connexions} color={GREEN} />
              <StatCard icon="🧑" label="Visiteurs uniques" value={auditStats.uniqueUsers} color={PRIMARY_LIGHT} />
              <StatCard icon="😴" label="Jamais connectés" value={auditStats.neverConnected.length} color={auditStats.neverConnected.length > 0 ? ORANGE : '#6b7280'} sub="avec un compte portail" />
            </div>

            <div className="print-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
              <Section title="📄 Pages les plus visitées" accent={PRIMARY}>
                {auditStats.pageRanking.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Aucune donnée pour cette période</div>
                  : auditStats.pageRanking.map(([page, count]) => (
                    <BarRow key={page} label={getPageLabel(page)} value={count} max={auditStats.pageRanking[0]?.[1] || 1} />
                  ))
                }
              </Section>

              <Section title="👥 Réservistes les plus actifs" accent={PRIMARY_LIGHT}>
                {auditStats.activeUsers.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Aucune donnée pour cette période</div>
                  : auditStats.activeUsers.map((u, i) => (
                    <BarRow key={i} label={u.name.length > 22 ? u.name.slice(0, 20) + '…' : u.name} value={u.count} max={auditStats.activeUsers[0]?.count || 1} color={PRIMARY_LIGHT} />
                  ))
                }
              </Section>
            </div>

            {/* Jamais connectés */}
            {auditStats.neverConnected.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Section title={`😴 Réservistes avec compte mais jamais vus (${auditStats.neverConnected.length})`} accent={ORANGE}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${GREY_BORDER}` }}>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Nom</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Groupe</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Région</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Courriel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditStats.neverConnected.slice(0, 20).map((r) => (
                          <tr key={r.id} style={{ borderBottom: `1px solid ${GREY_BG}` }}>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.prenom} {r.nom}</td>
                            <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.groupe || '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.region || '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {auditStats.neverConnected.length > 20 && (
                      <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 12px' }}>+ {auditStats.neverConnected.length - 20} autres</div>
                    )}
                  </div>
                </Section>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                SECTION 3 — TRAFIC & CONNEXIONS (liée à la période)
            ═══════════════════════════════════════════════════════════ */}
            <Divider label="📈 Trafic & connexions" />

            {/* Period selector */}
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {([
                ['today', "Aujourd'hui"],
                ['7d', '7 jours'],
                ['30d', '30 jours'],
                ['custom', 'Personnalisé'],
              ] as [Period, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: period === key ? `2px solid ${PRIMARY}` : `1px solid ${GREY_BORDER}`,
                    background: period === key ? PRIMARY : '#fff',
                    color: period === key ? '#fff' : '#374151',
                    fontWeight: period === key ? 600 : 400,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              ))}

              {period === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${GREY_BORDER}`, fontSize: 14 }}
                  />
                  <span style={{ color: '#6b7280' }}>→</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${GREY_BORDER}`, fontSize: 14 }}
                  />
                </div>
              )}
            </div>

            {/* KPI Cards trafic */}
            <div className="print-cards" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <StatCard icon="👁️" label="Visiteurs anonymes" value={logStats.anonymous} sub="Pages publiques (inscription, login)" />
              <StatCard icon="🧑" label="Actifs dans le portail" value={auditStats.uniqueUsers} color={PRIMARY_LIGHT} sub="Utilisateurs avec session active" />
              <StatCard icon="✅" label="Connexions réussies" value={auditStats.connexions || auditStats.uniqueUsers} color={GREEN} sub={auditStats.connexions > 0 ? 'Sessions ouvertes' : `${auditStats.uniqueUsers} utilisateur${auditStats.uniqueUsers > 1 ? 's' : ''} actif${auditStats.uniqueUsers > 1 ? 's' : ''}`} />
              <StatCard icon="⚠️" label="Connexions échouées" value={logStats.failed}
                color={logStats.failed === 0 ? '#6b7280' : (logStats.failedUniqueUsers > 0 && logStats.failedThenSucceeded === logStats.failedUniqueUsers) ? GREEN : RED}
                sub={logStats.failed > 0 ? `${logStats.failedThenSucceeded} / ${logStats.failedUniqueUsers} ont réussi ensuite` : undefined} />
            </div>

            {/* Indicateur de conversion pub → inscription */}
            {(() => {
              const visitesInscription = logStats.pageRanking.find(([p]) => p === '/inscription')?.[1] || 0;
              const visitesLogin = logStats.pageRanking.find(([p]) => p === '/login')?.[1] || 0;
              const nouvInscrits = resStats.last24h;
              const taux = visitesInscription > 0 ? Math.round((nouvInscrits / visitesInscription) * 100) : 0;
              const tauxColor = taux >= 20 ? GREEN : taux >= 5 ? ORANGE : RED;
              if (visitesInscription === 0 && nouvInscrits === 0) return null;
              return (
                <div style={{ backgroundColor: 'white', border: `1px solid ${GREY_BORDER}`, borderLeft: `4px solid ${PURPLE}`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2, fontWeight: 500 }}>📣 Funnel pub → inscription</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{period === 'today' ? "Aujourd'hui" : period === '7d' ? '7 derniers jours' : period === '30d' ? '30 derniers jours' : 'Période personnalisée'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center', padding: '8px 20px', backgroundColor: GREY_BG, borderRadius: 8 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: PRIMARY }}>{visitesInscription}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>vues /inscription</div>
                    </div>
                    <div style={{ fontSize: 18, color: '#d1d5db' }}>→</div>
                    <div style={{ textAlign: 'center', padding: '8px 20px', backgroundColor: GREY_BG, borderRadius: 8 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: PRIMARY }}>{visitesLogin}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>vues /login</div>
                    </div>
                    <div style={{ fontSize: 18, color: '#d1d5db' }}>→</div>
                    <div style={{ textAlign: 'center', padding: '8px 20px', backgroundColor: '#f0fdf4', borderRadius: 8, border: `1px solid #bbf7d0` }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: GREEN }}>{nouvInscrits}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>nouveaux inscrits</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '8px 20px', backgroundColor: '#faf5ff', borderRadius: 8, border: `1px solid #e9d5ff` }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: tauxColor }}>{taux}%</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>taux conversion</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="print-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
              {/* Pages populaires */}
              <Section title="📄 Pages les plus visitées">
                {logStats.pageRanking.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Aucune donnée</div>
                  : logStats.pageRanking.map(([page, count]) => (
                    <BarRow key={page} label={getPageLabel(page)} value={count} max={logStats.pageRanking[0]?.[1] || 1} />
                  ))
                }
              </Section>

              {/* Sources visiteurs anonymes */}
              <Section title="📱 Sources visiteurs (anonymes)">
                {logStats.sourceRanking.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Aucune donnée</div>
                  : logStats.sourceRanking.map(([source, count]) => (
                    <BarRow key={source} label={source} value={count} max={logStats.sourceRanking[0]?.[1] || 1}
                      color={source === 'Facebook' ? '#1877f2' : source === 'Instagram' ? '#e4405f' : '#6b7280'} />
                  ))
                }
              </Section>

              {/* Appareils */}
              <Section title="💻 Appareils">
                {logStats.deviceRanking.map(([device, count]) => (
                  <BarRow key={device} label={device} value={count} max={logStats.deviceRanking[0]?.[1] || 1}
                    color={device === 'Mobile' ? ORANGE : device === 'Desktop' ? PRIMARY : '#6b7280'} />
                ))}
              </Section>

              {/* Utilisateurs les plus actifs */}
              <Section title="👥 Utilisateurs les plus actifs">
                {logStats.activeUsers.length === 0
                  ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Aucune donnée</div>
                  : logStats.activeUsers.map((u, i) => (
                    <BarRow key={i} label={u.email.length > 22 ? u.email.slice(0, 20) + '…' : u.email} value={u.count}
                      max={logStats.activeUsers[0]?.count || 1} color={PRIMARY_LIGHT} />
                  ))
                }
              </Section>
            </div>

            {/* Distribution horaire */}
            <div style={{ marginBottom: 24 }}>
              <Section title="🕐 Distribution horaire des visites (personnes uniques)">
                <div className="print-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, paddingTop: 8 }}>
                  {logStats.hourlyCounts.map((views, h) => {
                    const uniqueCount = logStats.hourlyUnique[h];
                    const names = logStats.hourlyNames[h] || [];
                    const maxH = Math.max(...logStats.hourlyCounts, 1);
                    const height = (views / maxH) * 100;
                    const tooltip = views > 0
                      ? `${uniqueCount} personne${uniqueCount > 1 ? 's' : ''} · ${views} page${views > 1 ? 's' : ''} vue${views > 1 ? 's' : ''}\n\n${names.join('\n')}`
                      : `${h}h — aucune visite`;
                    return (
                      <div key={h} title={tooltip} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ fontSize: 10, color: '#1e3a5f', fontWeight: 600 }}>{uniqueCount > 0 ? uniqueCount : ''}</div>
                        <div style={{
                          width: '100%',
                          maxWidth: 28,
                          height: `${Math.max(height, 3)}%`,
                          background: views > 0 ? PRIMARY : '#e5e7eb',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.5s ease',
                          opacity: views > 0 ? 1 : 0.4,
                        }} />
                        <div style={{ fontSize: 9, color: '#9ca3af' }}>{h}h</div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* Actif aujourd'hui */}
            {(() => {
              const now = Date.now();
              const userMap: Record<string, string> = {};
              reservistes.forEach(r => {
                if (r.prenom && r.nom) {
                  if (r.user_id) userMap[r.user_id] = `${r.prenom} ${r.nom}`;
                  if (r.benevole_id) userMap[r.benevole_id] = `${r.prenom} ${r.nom}`;
                }
              });
              // Grouper par user — dernière page vue + heure
              const userActivity: Record<string, { name: string; lastPage: string; lastSeen: number; count: number }> = {};
              const todayStart = new Date(); todayStart.setHours(0,0,0,0);
              auditPages
                .filter(p => (p.user_id || p.benevole_id) && new Date(p.visite_a).getTime() >= todayStart.getTime())
                .forEach(p => {
                  const key = p.user_id || p.benevole_id || '';
                  const t = new Date(p.visite_a).getTime();
                  if (!userActivity[key] || t > userActivity[key].lastSeen) {
                    userActivity[key] = {
                      name: userMap[key] || key.slice(0, 10) + '…',
                      lastPage: p.page,
                      lastSeen: t,
                      count: (userActivity[key]?.count || 0) + 1,
                    };
                  } else {
                    userActivity[key].count++;
                  }
                });
              const actifs = Object.values(userActivity).sort((a, b) => b.lastSeen - a.lastSeen);
              const enCeMoment = actifs.filter(u => now - u.lastSeen < 30 * 60 * 1000).length;

              return (
                <div style={{ marginBottom: 24 }}>
                  <Section title={`🟢 Actif aujourd'hui — ${actifs.length} utilisateur${actifs.length !== 1 ? 's' : ''}`} accent={GREEN}>
                    {actifs.length === 0
                      ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Aucune activité aujourd'hui</div>
                      : (
                        <>
                          <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: GREEN, display: 'inline-block' }} />
                              En ce moment (−30 min) : <strong style={{ color: PRIMARY }}>{enCeMoment}</strong>
                            </span>
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr style={{ borderBottom: `2px solid ${GREY_BORDER}` }}>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Utilisateur</th>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Dernière page</th>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Pages vues</th>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Dernière activité</th>
                                </tr>
                              </thead>
                              <tbody>
                                {actifs.map((u, i) => {
                                  const diffMin = Math.floor((now - u.lastSeen) / 60000);
                                  const isNow = diffMin < 30;
                                  const isRecent = diffMin < 120;
                                  const dot = isNow ? GREEN : isRecent ? ORANGE : '#d1d5db';
                                  const label = diffMin < 1 ? 'à l\'instant' : diffMin < 60 ? `il y a ${diffMin} min` : `il y a ${Math.floor(diffMin/60)}h`;
                                  return (
                                    <tr key={i} style={{ borderBottom: `1px solid ${GREY_BG}` }}>
                                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dot, flexShrink: 0, display: 'inline-block' }} />
                                        {u.name}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: '#374151' }}>{getPageLabel(u.lastPage)}</td>
                                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{u.count}</td>
                                      <td style={{ padding: '8px 12px', color: isNow ? GREEN : '#6b7280', fontWeight: isNow ? 600 : 400 }}>{label}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )
                    }
                  </Section>
                </div>
              );
            })()}

            {/* Journal authentification unifié */}
            <Section title="🔐 Journal d'authentification">
              {logStats.authEvents.length === 0
                ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Aucune tentative dans cette période</div>
                : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${GREY_BORDER}` }}>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Statut</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Email / Tél</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Méthode</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Quand</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logStats.authEvents.map((e, i) => {
                          const ok = e.event_type === 'login_sms' || e.event_type === 'login_email';
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${GREY_BG}` }}>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: ok ? '#dcfce7' : '#fef2f2', color: ok ? GREEN : RED }}>
                                  {ok ? '✓ Réussi' : '✗ Échoué'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', color: ok ? '#374151' : RED, fontWeight: ok ? 400 : 500 }}>{e.email || e.telephone || '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{e.auth_method || <span style={{ color: '#d1d5db' }}>code non soumis</span>}</td>
                              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{new Date(e.created_at).toLocaleString('fr-CA', { timeZone: 'America/Montreal' })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
