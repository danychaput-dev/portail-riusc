'use client'

import React, { useEffect, useState, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const MapMembres = lazy(() => import('@/app/components/MapMembres'))

const NAVY   = '#1e3a5f'
const YELLOW = '#ffd166'
const BG     = '#f5f7fa'
const WHITE  = '#ffffff'
const TEXT   = '#374151'
const MUTED  = '#6b7280'
const BORDER = '#e5e7eb'
const GREEN  = '#059669'
const AMBER  = '#d97706'
const RED    = '#dc2626'

const ORG_COLORS: Record<string, string> = {
  'AQBRS-RS':    NAVY,
  'Croix-Rouge': '#c0392b',
  'SOPFEU':      AMBER,
  'MSP':         '#4a7b65',
}

const ANTECEDENTS_COLORS: Record<string, string> = {
  'verifie':    GREEN,
  'en_attente': AMBER,
  'refuse':     RED,
}

const ANTECEDENTS_LABELS: Record<string, string> = {
  'verifie':    'Vérifié',
  'en_attente': 'En attente',
  'refuse':     'Refusé',
}

interface CampData {
  cohort: number; dates: string; ville?: string
  inscrits: number
  annule: number | null
  informe_absence: number | null
  attendues: number | null
  no_show: number | null
  qualifie: number | null
  passe: boolean
  session_id?: string
}

interface Stats {
  totalReservistes: number; totalRIUSC: number; totalInteret: number; totalApprouves: number; totalPartenaires: number
  parOrganisme: { organisme: string; total: number }[]
  reservistesQualifies: { organisme: string; total: number }[]
  partenairesOrganismes: { organisme: string; total: number }[]
  interetData: { label: string; total: number }[]
  parRegionApprouves: { region: string; total: number }[]
  parRegionInteret: { region: string; total: number }[]
  antecedentsData: { statut: string; total: number }[]
  bottesData: { label: string; total: number }[]
  last24h: number; last7d: number; last30d: number
  dailyData: { date: string; count: number }[]
  campsData: CampData[]
  updatedAt: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      {label && <p style={{ margin: '0 0 4px', fontWeight: 600, color: NAVY }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ margin: 0, color: TEXT }}>{p.name ? `${p.name} : ` : ''}<strong style={{ color: NAVY }}>{p.value}</strong></p>
      ))}
    </div>
  )
}

function Card({ title, subtitle, children, fullWidth = false, action }: {
  title: string; subtitle?: string; children: React.ReactNode; fullWidth?: boolean; action?: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: WHITE, borderRadius: 12, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${BORDER}`, gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${YELLOW}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: NAVY }}>{title}</h3>
          {subtitle && <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  )
}

function StatCard({ value, label, color = NAVY, onClick }: { value: number; label: string; color?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ backgroundColor: WHITE, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${BORDER}`, cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s, transform 0.15s' }}
      onMouseOver={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
      onMouseOut={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ fontSize: 36, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Legend({ items }: { items: { label: string; color: string; value: number; onClick?: () => void }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginTop: 12 }}>
      {items.map((item, i) => (
        <div key={i} onClick={item.onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: item.onClick ? 'pointer' : 'default', padding: '2px 6px', borderRadius: 6, transition: 'background 0.15s' }}
          onMouseOver={e => { if (item.onClick) e.currentTarget.style.backgroundColor = '#f0f4f8' }}
          onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: item.color, flexShrink: 0 }} />
          <span style={{ color: MUTED }}>{item.label}</span>
          <strong style={{ color: NAVY }}>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

function OrgBar({ row, max, color, onClick }: { row: { organisme: string; total: number }; max: number; color: string; onClick?: () => void }) {
  const pct = max > 0 ? Math.round((row.total / max) * 100) : 0
  return (
    <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', padding: '4px 6px', borderRadius: 6, transition: 'background 0.15s' }}
      onMouseOver={e => { if (onClick) e.currentTarget.style.backgroundColor = '#f0f4f8' }}
      onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: TEXT }}>{row.organisme}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY, whiteSpace: 'nowrap' }}>
          {row.total} <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
      </div>
    </div>
  )
}

function OrgTable({ reservistesQualifies, partenairesOrganismes, totalApprouves, totalPartenaires, onDrill }: {
  reservistesQualifies: { organisme: string; total: number }[]
  partenairesOrganismes: { organisme: string; total: number }[]
  totalApprouves: number
  totalPartenaires: number
  onDrill?: (params: Record<string, string>) => void
}) {
  const orgClick = (org: string, groupe: string) => {
    if (!onDrill) return undefined
    // "Réservistes sans groupe assigné" = réservistes sans org assignée
    if (org.includes('sans groupe')) {
      return () => onDrill({ groupes: groupe, organisme: 'sans_org', org_principale: 'true', label: `${org} (Qualifiés)` })
    }
    // "Membres AQBRS Recherche et Sauvetage" = ceux avec AQBRS comme org
    if (org.includes('Membres AQBRS')) {
      return () => onDrill({ groupes: groupe, organisme: 'AQBRS', org_principale: 'true', label: `${org} (Qualifiés)` })
    }
    const orgKey = org.includes('AQBRS') ? 'AQBRS' : org.includes('SOPFEU') ? 'SOPFEU' : org.includes('Croix-Rouge') ? 'Croix-Rouge' : org.includes('MSP') ? 'MSP' : org
    return () => onDrill({ groupes: groupe, organisme: orgKey, org_principale: 'true', label: `${org} (${groupe === 'Approuvé' ? 'Qualifiés' : 'Partenaires'})` })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Section Réservistes qualifiés */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: NAVY }}>Réservistes qualifiés</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, backgroundColor: '#e8eef5', padding: '2px 10px', borderRadius: 12 }}>{totalApprouves}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reservistesQualifies.map((row, i) => (
            <OrgBar key={i} row={row} max={totalApprouves} color={i === 0 ? NAVY : '#64748b'} onClick={orgClick(row.organisme, 'Approuvé')} />
          ))}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}` }} />

      {/* Section Partenaires */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a7b65' }}>Partenaires</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4a7b65', backgroundColor: '#e8f5f0', padding: '2px 10px', borderRadius: 12 }}>{totalPartenaires}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {partenairesOrganismes.map((row, i) => (
            <OrgBar key={i} row={row} max={totalPartenaires} color={ORG_COLORS[row.organisme] || MUTED} onClick={orgClick(row.organisme, 'Partenaires')} />
          ))}
        </div>
      </div>

    </div>
  )
}

// Hook responsive
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export function DashboardContent({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  // Détecter si l'utilisateur est admin pour les drill-downs
  // Respecte l'impersonation : si on emprunte un compte partenaire, isAdmin = false
  useEffect(() => {
    const checkRole = async () => {
      const supabase = createClient()
      // Vérifier d'abord si on est en impersonation
      try {
        const impRes = await fetch('/api/check-impersonate', { credentials: 'include' })
        if (impRes.ok) {
          const impData = await impRes.json()
          if (impData.isImpersonating && impData.benevole_id) {
            // En impersonation, vérifier le rôle du compte emprunté
            const { data } = await supabase.from('reservistes').select('role').eq('benevole_id', impData.benevole_id).single()
            if (data && ['admin', 'coordonnateur', 'adjoint'].includes(data.role)) setIsAdmin(true)
            return
          }
        }
      } catch {}
      // Pas en impersonation : vérifier le rôle réel
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (data && ['admin', 'coordonnateur', 'adjoint'].includes(data.role)) setIsAdmin(true)
    }
    checkRole()
  }, [])

  // Helper pour construire les URLs de drill-down vers /admin/reservistes
  function drillUrl(params: Record<string, string>) {
    const sp = new URLSearchParams({ from: 'dashboard', statut: 'Actif', ...params })
    return `/admin/reservistes?${sp}`
  }
  function drill(params: Record<string, string>) {
    if (!isAdmin) return undefined
    return () => router.push(drillUrl(params))
  }

  const maxDaily = stats ? Math.max(...stats.dailyData.map(d => d.count), 1) : 1
  const today = new Date().toISOString().slice(0, 10)

  const campCols: { key: keyof CampData; label: string; color: string }[] = [
    { key: 'inscrits',        label: 'Inscrits',             color: NAVY },
    { key: 'annule',          label: 'Annulé',               color: RED },
    { key: 'informe_absence', label: "Informé de l'absence", color: AMBER },
    { key: 'attendues',       label: 'Attendues',            color: NAVY },
    { key: 'no_show',         label: 'No Show',              color: RED },
    { key: 'qualifie',        label: 'Qualifiés',            color: GREEN },
  ]

  return (
    <div style={{ minHeight: embedded ? 'auto' : '100vh', backgroundColor: BG }}>

      {!embedded && <PortailHeader subtitle="Tableau de bord" />}

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 12px' : '32px 24px' }}>
        {loading && <div style={{ padding: 80, textAlign: 'center', color: MUTED, fontSize: 16 }}>Chargement des données…</div>}
        {error && <div style={{ backgroundColor: '#fef2f2', color: RED, padding: '16px 20px', borderRadius: 8, fontSize: 14, border: '1px solid #fecaca' }}>Erreur lors du chargement des données.</div>}

        {stats && (
          <>
            {stats.updatedAt && (
              <p style={{ margin: 0, marginBottom: 16, fontSize: 12, color: MUTED, textAlign: 'right' }}>
                Mis à jour le {new Date(stats.updatedAt).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })} à {new Date(stats.updatedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {/* ── Badges ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard value={stats.totalReservistes} label="Réservistes" onClick={drill({ groupes: 'Approuvé,Intérêt', label: 'Tous les réservistes' })} />
              <StatCard value={stats.totalApprouves}   label="Qualifiés" color={NAVY} onClick={drill({ groupes: 'Approuvé', label: 'Réservistes qualifiés' })} />
              <StatCard value={stats.totalInteret}     label="Avec intérêt" color={AMBER} onClick={drill({ groupes: 'Intérêt', label: 'Personnes avec intérêt à joindre' })} />
              <StatCard value={stats.totalPartenaires} label="Partenaires" color="#4a7b65" onClick={drill({ groupes: 'Partenaires', label: 'Partenaires' })} />
              <StatCard value={stats.totalRIUSC}       label="Membres RIUSC" color={MUTED} onClick={drill({ groupes: 'Approuvé,Intérêt,Partenaires', label: 'Tous les membres RIUSC' })} />
            </div>

            {/* ── Ligne 1 : Organisme | (Intérêt + Antécédents) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20, alignItems: isMobile ? 'start' : 'stretch' }}>

              <Card title="Réservistes qualifiés et Partenaires">
                <OrgTable
                  reservistesQualifies={stats.reservistesQualifies}
                  partenairesOrganismes={stats.partenairesOrganismes}
                  totalApprouves={stats.totalApprouves}
                  totalPartenaires={stats.totalPartenaires}
                  onDrill={isAdmin ? (params) => router.push(drillUrl(params)) : undefined}
                />
              </Card>

              {/* Colonne droite : 3 graphiques empilés à hauteur égale */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: isMobile ? 'auto' : '100%' }}>

                {/* Carte 1 : Intérêt */}
                <div style={{ backgroundColor: WHITE, borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${BORDER}`, flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: NAVY, paddingBottom: 8, borderBottom: `2px solid ${YELLOW}` }}>Personnes avec intérêt à joindre</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.interetData} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={70}
                        label={({ name, value, percent }: any) => `${name} : ${value} (${(percent*100).toFixed(0)}%)`}
                        labelLine={false}>
                        <Cell fill={NAVY} />
                        <Cell fill={AMBER} />
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Legend items={stats.interetData.map((d, i) => ({ label: d.label, color: i === 0 ? NAVY : i === 1 ? AMBER : '#94a3b8', value: d.total, onClick: drill({ groupes: 'Intérêt', organisme: d.label === 'AQBRS' ? 'AQBRS' : d.label === 'Public' ? 'sans_org' : 'autres_org', label: `Intérêt — ${d.label}` }) }))} />
                </div>

                {/* Carte 2 : Antécédents */}
                <div style={{ backgroundColor: WHITE, borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${BORDER}`, flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: NAVY, paddingBottom: 8, borderBottom: `2px solid ${YELLOW}` }}>Antécédents judiciaires <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>— Réservistes qualifiés</span></p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.antecedentsData} dataKey="total" nameKey="statut" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                        {stats.antecedentsData.map((entry, i) => (
                          <Cell key={i} fill={ANTECEDENTS_COLORS[entry.statut] || MUTED} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name: any) => [value, ANTECEDENTS_LABELS[name] || name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Legend items={stats.antecedentsData.map(d => ({ label: ANTECEDENTS_LABELS[d.statut] || d.statut, color: ANTECEDENTS_COLORS[d.statut] || MUTED, value: d.total, onClick: drill({ groupes: 'Approuvé', antecedents: d.statut, label: `Antécédents — ${ANTECEDENTS_LABELS[d.statut] || d.statut}` }) }))} />
                </div>

                {/* Carte 3 : Bottes */}
                <div style={{ backgroundColor: WHITE, borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${BORDER}`, flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: NAVY, paddingBottom: 8, borderBottom: `2px solid ${YELLOW}` }}>Bottes <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>— Réservistes qualifiés</span></p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.bottesData} dataKey="total" nameKey="label" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                        <Cell fill={NAVY} />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Legend items={stats.bottesData.map((d, i) => ({ label: d.label, color: i === 0 ? NAVY : BORDER, value: d.total, onClick: drill({ groupes: 'Approuvé', bottes: i === 0 ? 'oui' : 'non', label: `Bottes — ${d.label}` }) }))} />
                </div>

              </div>
            </div>

            {/* ── Ligne 2 : Géo côte à côte ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <Card title="Géographie — Réservistes qualifiés">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.parRegionApprouves} barCategoryGap="30%" style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                    onClick={isAdmin ? (e: any) => { if (e?.activeLabel) router.push(drillUrl({ groupes: 'Approuvé', region: e.activeLabel, label: `Qualifiés — ${e.activeLabel}` })) } : undefined}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="region" tick={{ fontSize: 9, fill: MUTED }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11, fill: MUTED }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Réservistes" fill={NAVY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Géographie — Avec intérêt">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.parRegionInteret} barCategoryGap="30%" style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                    onClick={isAdmin ? (e: any) => { if (e?.activeLabel) router.push(drillUrl({ groupes: 'Intérêt', region: e.activeLabel, label: `Intérêt — ${e.activeLabel}` })) } : undefined}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="region" tick={{ fontSize: 9, fill: MUTED }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11, fill: MUTED }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Personnes" fill={AMBER} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* ── Carte des membres ── */}
            {isAdmin && (
              <div style={{ marginBottom: 20 }}>
                <Card title="Carte des membres" subtitle="Position géographique des réservistes actifs">
                  <Suspense fallback={<div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>Chargement de la carte...</div>}>
                    <MapMembres />
                  </Suspense>
                </Card>
              </div>
            )}

            {/* ── Ligne 3 : Nouvelles inscriptions ── */}
            <div style={{ marginBottom: 20 }}>
              <Card title="Nouvelles inscriptions">
                <div style={{ display: 'flex', gap: 40, borderBottom: `1px solid ${BORDER}`, paddingBottom: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Dernières 24h',      value: stats.last24h,  color: stats.last24h  > 0 ? GREEN : MUTED, jours: 1 },
                    { label: '7 derniers jours',   value: stats.last7d,   color: stats.last7d   > 0 ? NAVY  : MUTED, jours: 7 },
                    { label: '30 derniers jours',  value: stats.last30d,  color: stats.last30d  > 0 ? NAVY  : MUTED, jours: 30 },
                  ].map((s, i) => (
                    <div key={i} onClick={drill({ inscrit_depuis: String(s.jours), groupes: 'Approuvé,Intérêt,Partenaires', label: `Nouvelles inscriptions — ${s.label.toLowerCase()}` })}
                      style={{ cursor: isAdmin ? 'pointer' : 'default', padding: '4px 8px', borderRadius: 8, transition: 'background 0.15s' }}
                      onMouseOver={e => { if (isAdmin) e.currentTarget.style.backgroundColor = '#f0f4f8' }}
                      onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 8, fontWeight: 500 }}>Inscriptions par jour (30 derniers jours)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
                  {stats.dailyData.map(({ date, count }) => {
                    const h = (count / maxDaily) * 100
                    const isToday = date === today
                    return (
                      <div key={date} title={`${date} : ${count} inscription${count > 1 ? 's' : ''}`}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <div style={{ fontSize: 9, color: MUTED }}>{count > 0 ? count : ''}</div>
                        <div style={{ width: '100%', maxWidth: 22, height: `${Math.max(h, 4)}%`, background: isToday ? GREEN : count > 0 ? NAVY : BORDER, borderRadius: '3px 3px 0 0', opacity: count > 0 ? 1 : 0.4 }} />
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: MUTED }}>il y a 30 jours</span>
                  <span style={{ fontSize: 10, color: MUTED }}>aujourd&apos;hui</span>
                </div>
              </Card>
            </div>

            {/* ── Ligne 4 : Camps ── */}
            {stats.campsData.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <Card
                  title="Camps de qualification — Résultats par cohorte"
                  action={isAdmin ? (
                    <a
                      href="/admin/inscriptions-camps"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        color: NAVY, border: `1px solid ${BORDER}`, textDecoration: 'none',
                        backgroundColor: WHITE, whiteSpace: 'nowrap' as const,
                      }}
                    >
                      🏕️ Voir les inscriptions
                    </a>
                  ) : undefined}
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ backgroundColor: BG, borderBottom: `2px solid ${BORDER}` }}>
                          <th style={{ textAlign: 'left', padding: '10px 16px', color: NAVY, fontWeight: 600, fontSize: 13 }}>Cohorte</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px', color: NAVY, fontWeight: 600, fontSize: 13 }}>Ville</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px', color: NAVY, fontWeight: 600, fontSize: 13 }}>Dates</th>
                          {campCols.map(col => (
                            <th key={col.key} style={{ textAlign: 'center', padding: '10px 8px', color: col.color, fontWeight: 600, fontSize: 13, whiteSpace: 'normal', lineHeight: '1.3', maxWidth: '90px' }}>
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stats.campsData.map((camp, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: i % 2 === 0 ? WHITE : BG }}>
                            <td style={{ padding: '12px 16px', color: NAVY, fontWeight: 700, fontSize: 15 }}>{camp.cohort}<sup style={{ fontSize: 11 }}>e</sup></td>
                            <td style={{ padding: '12px 16px', color: TEXT, fontSize: 13 }}>{camp.ville || '—'}</td>
                            <td style={{ padding: '12px 16px', color: MUTED, fontSize: 13 }}>{camp.dates || '—'}</td>
                            {campCols.map(col => {
                              const val = camp[col.key]
                              if (!camp.passe && col.key !== 'inscrits' && col.key !== 'annule') {
                                return <td key={col.key} style={{ padding: '12px 16px', textAlign: 'center', color: MUTED }}>—</td>
                              }
                              const canDrill = isAdmin && camp.session_id && val != null && (val as number) > 0
                              const drillParams: Record<string, string> = { camp_session: camp.session_id!, groupes: 'Approuvé,Intérêt,Partenaires', label: `Cohorte ${camp.cohort} — ${col.label} (${camp.ville || ''})` }
                              if (col.key === 'inscrits') drillParams.camp_statut = 'non_annule'
                              else drillParams.camp_statut = col.key
                              const campDrill = canDrill ? () => router.push(drillUrl(drillParams)) : undefined
                              if (col.key === 'qualifie') {
                                return (
                                  <td key={col.key} style={{ padding: '12px 16px', textAlign: 'center' }}>
                                    <span onClick={campDrill} style={{ display: 'inline-block', backgroundColor: '#dcfce7', color: GREEN, padding: '2px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: campDrill ? 'pointer' : 'default' }}
                                      onMouseOver={e => { if (campDrill) e.currentTarget.style.backgroundColor = '#bbf7d0' }}
                                      onMouseOut={e => { e.currentTarget.style.backgroundColor = '#dcfce7' }}
                                    >{val}</span>
                                  </td>
                                )
                              }
                              return (
                                <td key={col.key} onClick={campDrill} style={{ padding: '12px 16px', textAlign: 'center', cursor: campDrill ? 'pointer' : 'default' }}
                                  onMouseOver={e => { if (campDrill) e.currentTarget.style.backgroundColor = '#f0f4f8' }}
                                  onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                                >
                                  <span style={{ fontWeight: 600, color: col.color }}>{val ?? '—'}</span>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                        {/* Ligne totaux — camps passés seulement */}
                        <tr style={{ borderTop: `2px solid ${BORDER}`, backgroundColor: '#f0f4f8' }}>
                          <td colSpan={3} style={{ padding: '10px 16px', fontWeight: 700, color: NAVY, fontSize: 13 }}>Total</td>
                          {campCols.map(col => {
                            const total = stats.campsData
                              .filter(c => c.passe || col.key === 'inscrits' || col.key === 'annule')
                              .reduce((s, c) => s + ((c[col.key] as number) || 0), 0)
                            return (
                              <td key={col.key} style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: col.color, fontSize: 14 }}>
                                {total}
                              </td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* Pied de page */}
            <div style={{ paddingTop: 20, borderTop: `1px solid ${BORDER}`, textAlign: 'center', fontSize: 12, color: MUTED }}>
              Données agrégées — aucune information nominale n&apos;est divulguée. &nbsp;·&nbsp; Portail RIUSC © {new Date().getFullYear()} AQBRS
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default function DashboardPublicPage() {
  return <DashboardContent />
}
