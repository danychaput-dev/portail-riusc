'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface Check {
  name: string
  status: 'pass' | 'fail' | 'warn'
  expected?: number
  actual?: number
  detail: string
}

interface HealthResult {
  status: 'OK' | 'WARN' | 'FAIL' | 'ERROR'
  timestamp: string
  summary: {
    approuves: number
    interet: number
    retrait: number
    partenaires: number
    formationIncomplete: number
    totalDashboard: number
    totalAdmin: number
  }
  checks: Check[]
  error?: string
}

export default function HealthCheckPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<HealthResult | null>(null)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: r } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
    if (!r || r.role !== 'admin') { router.push('/'); return }
    setAuthorized(true)
    await runCheck()
  }

  async function runCheck() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/health-check')
      const json = await res.json()
      setResult(json)
    } catch (err: any) {
      setResult({ status: 'ERROR', timestamp: new Date().toISOString(), summary: {} as any, checks: [], error: err.message })
    }
    setLoading(false)
  }

  if (!authorized) return null

  const statusIcon = (s: string) => s === 'pass' ? '✅' : s === 'fail' ? '❌' : s === 'warn' ? '⚠️' : '💥'
  const statusColor = (s: string) => s === 'pass' ? '#16a34a' : s === 'fail' ? '#dc2626' : s === 'warn' ? '#d97706' : '#6b7280'
  const statusBg = (s: string) => s === 'pass' ? '#f0fdf4' : s === 'fail' ? '#fef2f2' : s === 'warn' ? '#fffbeb' : '#f9fafb'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => router.push('/admin')}
          style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
        >
          ← Admin
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Health Check - Verification de coherence
        </h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
          Verification en cours...
        </div>
      ) : result ? (
        <>
          {/* Status global */}
          <div style={{
            padding: 20, borderRadius: 12, marginBottom: 24, textAlign: 'center',
            background: result.status === 'OK' ? '#f0fdf4' : result.status === 'WARN' ? '#fffbeb' : '#fef2f2',
            border: `2px solid ${result.status === 'OK' ? '#22c55e' : result.status === 'WARN' ? '#f59e0b' : '#ef4444'}`,
          }}>
            <div style={{ fontSize: 48 }}>
              {result.status === 'OK' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: result.status === 'OK' ? '#16a34a' : result.status === 'WARN' ? '#d97706' : '#dc2626' }}>
              {result.status === 'OK' ? 'Tout est coherent' : result.status === 'WARN' ? 'Avertissements detectes' : 'Incoherences detectees!'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              Verifie le {new Date(result.timestamp).toLocaleString('fr-CA')}
            </div>
          </div>

          {/* Decomptes */}
          {result.summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Approuves', value: result.summary.approuves, color: '#16a34a' },
                { label: 'Interet', value: result.summary.interet, color: '#3b82f6' },
                { label: 'Retrait temp.', value: result.summary.retrait, color: '#6b7280' },
                { label: 'Partenaires', value: result.summary.partenaires, color: '#8b5cf6' },
                { label: 'Total dashboard', value: result.summary.totalDashboard, color: '#1e3a5f' },
              ].map((s, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Checks detail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.checks.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: 16, borderRadius: 8,
                  background: statusBg(c.status),
                  border: `1px solid ${c.status === 'fail' ? '#fca5a5' : c.status === 'warn' ? '#fde68a' : '#bbf7d0'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{statusIcon(c.status)}</span>
                  <strong style={{ color: statusColor(c.status) }}>{c.name}</strong>
                  {c.expected !== undefined && c.actual !== undefined && c.expected !== c.actual && (
                    <span style={{ fontSize: 13, color: '#dc2626', marginLeft: 8 }}>
                      attendu {c.expected}, obtenu {c.actual}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#4b5563', marginLeft: 26 }}>{c.detail}</div>
              </div>
            ))}
          </div>

          {/* Bouton re-check */}
          <button
            onClick={runCheck}
            disabled={loading}
            style={{
              marginTop: 24, background: '#1e3a5f', color: '#fff', border: 'none',
              borderRadius: 8, padding: '12px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 15,
            }}
          >
            Reverifier
          </button>
        </>
      ) : (
        <div style={{ color: '#dc2626', padding: 24 }}>Erreur lors de la verification</div>
      )}
    </div>
  )
}
