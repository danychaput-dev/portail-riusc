'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const NAVY     = '#1e3a5f'
const YELLOW   = '#ffd166'
const BG       = '#f5f7fa'
const WHITE    = '#ffffff'
const TEXT     = '#374151'
const MUTED    = '#6b7280'
const BORDER   = '#e5e7eb'
const GREEN    = '#059669'
const AMBER    = '#d97706'
const RED      = '#dc2626'

const ORG_COLORS: Record<string, string> = {
  'AQBRS-RS':    NAVY,
  'Croix-Rouge': '#c0392b',
  'SOPFEU':      AMBER,
  'MSP':         '#4a7b65',
}

const GROUPE_COLORS: Record<string, string> = {
  'Approuvé':    NAVY,
  'Partenaires': '#4a7b65',
  'Intérêt':     AMBER,
  'Déployable':  GREEN,
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

interface Stats {
  total: number
  parGroupe: { groupe: string; total: number }[]
  parOrganisme: { organisme: string; total: number }[]
  interetData: { label: string; total: number }[]
  parRegion: { region: string; total: number }[]
  antecedentsData: { statut: string; total: number }[]
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

function Card({ title, children, fullWidth = false }: { title: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div style={{ backgroundColor: WHITE, borderRadius: 12, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${BORDER}`, gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 600, color: NAVY, paddingBottom: 12, borderBottom: `2px solid ${YELLOW}` }}>{title}</h3>
      {children}
    </div>
  )
}

function StatCard({ value, label, color = NAVY }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ backgroundColor: WHITE, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 36, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Legend({ items }: { items: { label: string; color: string; value: number }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginTop: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: item.color, flexShrink: 0 }} />
          <span style={{ color: MUTED }}>{item.label}</span>
          <strong style={{ color: NAVY }}>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPublicPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const totalQualifies = stats?.parOrganisme.reduce((s, o) => s + o.total, 0) || 0
  const totalInteret   = stats?.interetData.reduce((s, i) => s + i.total, 0) || 0
  const totalVerifies  = stats?.antecedentsData.find(a => a.statut === 'verifie')?.total || 0

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG }}>
      <div style={{ backgroundColor: NAVY, borderBottom: `3px solid ${YELLOW}`, padding: '16px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/logo-aqbrs.png" alt="AQBRS" style={{ height: 36, filter: 'brightness(0) invert(1)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: WHITE }}>Tableau de bord — RIUSC</h1>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Réserve d&apos;intervention d&apos;urgence en sécurité civile du Québec</p>
            </div>
          </div>
          {stats && (
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              Mis à jour le {new Date(stats.updatedAt).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })} à {new Date(stats.updatedAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {loading && <div style={{ padding: 80, textAlign: 'center', color: MUTED, fontSize: 16 }}>Chargement des données…</div>}
        {error && <div style={{ backgroundColor: '#fef2f2', color: RED, padding: '16px 20px', borderRadius: 8, fontSize: 14, border: '1px solid #fecaca' }}>Erreur lors du chargement des données.</div>}

        {stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard value={stats.total}     label="Réservistes actifs" />
              <StatCard value={totalQualifies}  label="Réservistes qualifiés" color={GREEN} />
              <StatCard value={totalInteret}    label="En cours de qualification" color={AMBER} />
              <StatCard value={totalVerifies}   label="Antécédents vérifiés" color={GREEN} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              <Card title="Réservistes qualifiés par organisme">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.parOrganisme} barCategoryGap="40%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="organisme" tick={{ fontSize: 12, fill: MUTED }} />
                    <YAxis tick={{ fontSize: 12, fill: MUTED }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                      {stats.parOrganisme.map((entry, i) => (
                        <Cell key={i} fill={ORG_COLORS[entry.organisme] || NAVY} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <Legend items={stats.parOrganisme.map(o => ({ label: o.organisme, color: ORG_COLORS[o.organisme] || NAVY, value: o.total }))} />
              </Card>

              <Card title="Personnes avec intérêt à joindre la RIUSC">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={stats.interetData} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={85}
                      label={({ name, value, percent }: any) => `${name} : ${value} (${(percent * 100).toFixed(0)}%)`}>
                      <Cell fill={NAVY} />
                      <Cell fill={AMBER} />
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <Legend items={stats.interetData.map((d, i) => ({ label: d.label, color: i === 0 ? NAVY : AMBER, value: d.total }))} />
              </Card>

              <Card title="Répartition totale par groupe">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.parGroupe} layout="vertical" barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: MUTED }} />
                    <YAxis type="category" dataKey="groupe" tick={{ fontSize: 12, fill: MUTED }} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                      {stats.parGroupe.map((entry, i) => (
                        <Cell key={i} fill={GROUPE_COLORS[entry.groupe] || MUTED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Antécédents judiciaires">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats.antecedentsData} dataKey="total" nameKey="statut" cx="50%" cy="50%" innerRadius={55} outerRadius={85}>
                      {stats.antecedentsData.map((entry, i) => (
                        <Cell key={i} fill={ANTECEDENTS_COLORS[entry.statut] || MUTED} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: any) => [value, ANTECEDENTS_LABELS[name] || name]} />
                  </PieChart>
                </ResponsiveContainer>
                <Legend items={stats.antecedentsData.map(d => ({ label: ANTECEDENTS_LABELS[d.statut] || d.statut, color: ANTECEDENTS_COLORS[d.statut] || MUTED, value: d.total }))} />
              </Card>

              <Card title="Répartition géographique par région" fullWidth>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.parRegion} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="region" tick={{ fontSize: 11, fill: MUTED }} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: MUTED }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Réservistes" fill={NAVY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

            </div>

            <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${BORDER}`, textAlign: 'center', fontSize: 12, color: MUTED }}>
              Données agrégées — aucune information nominale n&apos;est divulguée. &nbsp;·&nbsp; Portail RIUSC © {new Date().getFullYear()} AQBRS
            </div>
          </>
        )}
      </main>
    </div>
  )
}
