'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

// ── Palette AQBRS ─────────────────────────────────────────────────────────────
const BORDEAUX   = '#5C2D49'
const TERRACOTTA = '#C05A30'
const CREAM      = '#F5F0E5'
const GOLD       = '#C8922A'
const SAGE       = '#4A7B65'
const SLATE      = '#3E5A72'
const MUTED      = '#9E7E8C'

const ORG_COLORS: Record<string, string> = {
  'AQBRS-RS':   BORDEAUX,
  'Croix-Rouge': TERRACOTTA,
  'SOPFEU':      GOLD,
  'MSP':         SLATE,
}

const GROUPE_COLORS: Record<string, string> = {
  'Approuvé':    BORDEAUX,
  'Partenaires': TERRACOTTA,
  'Intérêt':     GOLD,
  'Déployable':  SAGE,
}

const ANTECEDENTS_COLORS: Record<string, string> = {
  'verifie':    SAGE,
  'en_attente': GOLD,
  'refuse':     '#C44545',
}

const ANTECEDENTS_LABELS: Record<string, string> = {
  'verifie':    'Vérifié',
  'en_attente': 'En attente',
  'refuse':     'Refusé',
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  total: number
  parGroupe: { groupe: string; total: number }[]
  parOrganisme: { organisme: string; total: number }[]
  interetData: { label: string; total: number }[]
  parRegion: { region: string; total: number }[]
  antecedentsData: { statut: string; total: number }[]
  updatedAt: string
}

// ── Composants réutilisables ──────────────────────────────────────────────────
function Card({ title, children, span = 1 }: { title: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: '24px 28px',
      gridColumn: span > 1 ? `span ${span}` : undefined,
      boxShadow: '0 1px 3px rgba(92,45,73,0.08), 0 4px 16px rgba(92,45,73,0.06)',
      border: '1px solid rgba(92,45,73,0.08)',
    }}>
      <p style={{
        margin: '0 0 20px 0',
        fontFamily: "'Georgia', serif",
        fontSize: 14,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: BORDEAUX,
        borderBottom: `2px solid ${TERRACOTTA}`,
        paddingBottom: 10,
      }}>{title}</p>
      {children}
    </div>
  )
}

function StatBadge({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 16px' }}>
      <div style={{ fontSize: 42, fontWeight: 800, color: BORDEAUX, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'white',
      border: `1px solid ${BORDEAUX}22`,
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: 13,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      {label && <p style={{ margin: '0 0 4px', fontWeight: 600, color: BORDEAUX }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ margin: 0, color: p.color || BORDEAUX }}>
          {p.name ? `${p.name} : ` : ''}<strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function DashboardPage() {
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
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: "'Gill Sans', 'Trebuchet MS', sans-serif" }}>

      {/* ── En-tête ── */}
      <div style={{
        background: BORDEAUX,
        color: 'white',
        padding: '32px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
            <img src="/logo-aqbrs.png" alt="AQBRS" style={{ height: 40, filter: 'brightness(0) invert(1)' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '0.02em' }}>
                Tableau de bord — RIUSC
              </h1>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.75, marginTop: 2 }}>
                Réserve d'intervention d'urgence en sécurité civile du Québec
              </p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {stats && (
            <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
              Mis à jour le {new Date(stats.updatedAt).toLocaleDateString('fr-CA', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          )}
        </div>
      </div>

      {/* ── Bande orange ── */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${TERRACOTTA}, ${GOLD})` }} />

      {loading && (
        <div style={{ padding: 80, textAlign: 'center', color: MUTED, fontSize: 16 }}>
          Chargement des données…
        </div>
      )}

      {error && (
        <div style={{ padding: 80, textAlign: 'center', color: TERRACOTTA, fontSize: 16 }}>
          Erreur lors du chargement des données.
        </div>
      )}

      {stats && (
        <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>

          {/* ── Badges sommaire ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 28,
          }}>
            {[
              { value: stats.total, label: 'Réservistes actifs' },
              { value: totalQualifies, label: 'Réservistes qualifiés' },
              { value: totalInteret, label: 'En cours de qualification' },
              { value: totalVerifies, label: 'Antécédents vérifiés' },
            ].map((b, i) => (
              <div key={i} style={{
                background: 'white',
                borderRadius: 12,
                padding: '20px 16px',
                boxShadow: '0 1px 3px rgba(92,45,73,0.08)',
                border: '1px solid rgba(92,45,73,0.08)',
              }}>
                <StatBadge value={b.value} label={b.label} />
              </div>
            ))}
          </div>

          {/* ── Grille de graphiques ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* 1. Qualifiés par organisme */}
            <Card title="Réservistes qualifiés par organisme">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.parOrganisme} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe8" />
                  <XAxis dataKey="organisme" tick={{ fontSize: 12, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                    {stats.parOrganisme.map((entry, i) => (
                      <Cell key={i} fill={ORG_COLORS[entry.organisme] || MUTED} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                {stats.parOrganisme.map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: ORG_COLORS[o.organisme] || MUTED }} />
                    <span style={{ color: '#555' }}>{o.organisme}</span>
                    <strong style={{ color: BORDEAUX }}>{o.total}</strong>
                  </div>
                ))}
              </div>
            </Card>

            {/* 2. Intérêt public vs AQBRS */}
            <Card title="Public et membres AQBRS avec intérêt à joindre">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={stats.interetData}
                    dataKey="total"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ label, total, percent }) =>
                      `${label}: ${total} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    <Cell fill={SAGE} />
                    <Cell fill={TERRACOTTA} />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 4 }}>
                {stats.interetData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: i === 0 ? SAGE : TERRACOTTA }} />
                    <span>{d.label}</span>
                    <strong style={{ color: BORDEAUX }}>{d.total}</strong>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ color: MUTED }}>Total</span>
                  <strong style={{ color: BORDEAUX }}>{totalInteret}</strong>
                </div>
              </div>
            </Card>

            {/* 3. Total RIUSC par groupe */}
            <Card title="Répartition totale par groupe">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.parGroupe} layout="vertical" barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe8" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#666' }} />
                  <YAxis type="category" dataKey="groupe" tick={{ fontSize: 12, fill: '#666' }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                    {stats.parGroupe.map((entry, i) => (
                      <Cell key={i} fill={GROUPE_COLORS[entry.groupe] || MUTED} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* 4. Antécédents judiciaires */}
            <Card title="Antécédents judiciaires">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.antecedentsData}
                    dataKey="total"
                    nameKey="statut"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                  >
                    {stats.antecedentsData.map((entry, i) => (
                      <Cell key={i} fill={ANTECEDENTS_COLORS[entry.statut] || MUTED} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, ANTECEDENTS_LABELS[name as string] || name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
                {stats.antecedentsData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: ANTECEDENTS_COLORS[d.statut] || MUTED }} />
                    <span style={{ color: '#555' }}>{ANTECEDENTS_LABELS[d.statut] || d.statut}</span>
                    <strong style={{ color: BORDEAUX }}>{d.total}</strong>
                  </div>
                ))}
              </div>
            </Card>

            {/* 5. Répartition géographique — pleine largeur */}
            <Card title="Répartition géographique par région" span={2}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.parRegion} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe8" />
                  <XAxis
                    dataKey="region"
                    tick={{ fontSize: 11, fill: '#666' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Réservistes" fill={BORDEAUX} radius={[4, 4, 0, 0]}>
                    {stats.parRegion.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? BORDEAUX : TERRACOTTA} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

          </div>

          {/* ── Pied de page ── */}
          <div style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: `1px solid rgba(92,45,73,0.12)`,
            textAlign: 'center',
            fontSize: 12,
            color: MUTED,
          }}>
            <p style={{ margin: 0 }}>
              Données agrégées — aucune information nominale n'est divulguée.
              Portail RIUSC © {new Date().getFullYear()} AQBRS
            </p>
          </div>

        </div>
      )}
    </div>
  )
}
