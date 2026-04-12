'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface NomSummary {
  nom_resultat: string
  total: number
  sources: string[]
}

interface NomResult {
  total_formations_avec_camp: number
  detail: NomSummary[]
}

interface ReservisteResult {
  results: {
    reserviste: { benevole_id: string; prenom: string; nom: string }
    formations: any[]
    inscriptions_camps: any[]
  }[]
}

export default function DebugCampPage() {
  const supabase = createClient()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'noms' | 'reserviste'>('noms')
  const [nomSearch, setNomSearch] = useState('')
  const [nomResult, setNomResult] = useState<NomResult | null>(null)
  const [reservisteResult, setReservisteResult] = useState<ReservisteResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: r } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (!r || r.role !== 'superadmin') { router.push('/'); return }
      setAuthorized(true)
      runNoms()
    }
    init()
  }, [])

  async function runNoms() {
    setLoading(true); setError(''); setReservisteResult(null)
    try {
      const res = await fetch('/api/admin/debug-camp?action=noms')
      const json = await res.json()
      setNomResult(json)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  async function runReserviste() {
    if (!nomSearch.trim()) return
    setLoading(true); setError(''); setNomResult(null)
    try {
      const res = await fetch(`/api/admin/debug-camp?action=reserviste&nom=${encodeURIComponent(nomSearch)}`)
      const json = await res.json()
      setReservisteResult(json)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  if (!authorized) return null

  const C = '#1e3a5f'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => router.push('/admin')}
          style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>
          ← Admin
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: C }}>🔬 Debug Camp</h1>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'noms', label: '📋 Noms de formations' },
          { key: 'reserviste', label: '👤 Debug réserviste' },
        ].map(t => (
          <button key={t.key}
            onClick={() => { setMode(t.key as any); if (t.key === 'noms') runNoms() }}
            style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: mode === t.key ? C : '#f3f4f6',
              color: mode === t.key ? '#fff' : '#374151',
              border: mode === t.key ? 'none' : '1px solid #d1d5db',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Mode: Noms */}
      {mode === 'noms' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>Toutes les formations contenant "camp" dans formations_benevoles</span>
            <button onClick={runNoms} disabled={loading}
              style={{ marginLeft: 'auto', background: C, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? 'Chargement...' : '🔄 Actualiser'}
            </button>
          </div>
          {nomResult && (
            <>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <strong style={{ color: C }}>{nomResult.total_formations_avec_camp}</strong>
                <span style={{ color: '#374151', marginLeft: 8 }}>formations contenant "camp" au total</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {nomResult.detail.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <span style={{ fontWeight: 700, color: C, minWidth: 36, textAlign: 'right' }}>{d.total}</span>
                    <span style={{ flex: 1, fontSize: 13, color: '#1f2937' }}>{d.nom_resultat}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{d.sources.join(', ')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Mode: Réserviste */}
      {mode === 'reserviste' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              value={nomSearch}
              onChange={e => setNomSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runReserviste()}
              placeholder="Nom du réserviste (ex: Fourier)"
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
            />
            <button onClick={runReserviste} disabled={loading || !nomSearch.trim()}
              style={{ background: C, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? '...' : '🔍 Chercher'}
            </button>
          </div>

          {reservisteResult?.results?.map((r, i) => (
            <div key={i} style={{ marginBottom: 20, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: C, color: '#fff', padding: '10px 16px', fontWeight: 700 }}>
                {r.reserviste.prenom} {r.reserviste.nom} — {r.reserviste.benevole_id}
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                    Formations ({r.formations.length})
                  </div>
                  {r.formations.length === 0
                    ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune formation</div>
                    : r.formations.map((f, j) => (
                      <div key={j} style={{ fontSize: 12, padding: '6px 10px', background: '#f9fafb', borderRadius: 6, marginBottom: 4, display: 'flex', gap: 12 }}>
                        <span style={{ fontWeight: 600, color: C, minWidth: 120 }}>{f.nom_formation}</span>
                        <span style={{ color: '#6b7280' }}>{f.resultat}</span>
                        <span style={{ color: '#9ca3af' }}>{f.source}</span>
                        <span style={{ color: '#9ca3af', marginLeft: 'auto' }}>{f.date_reussite || 'sans date'}</span>
                      </div>
                    ))
                  }
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                    Inscriptions camps ({r.inscriptions_camps.length})
                  </div>
                  {r.inscriptions_camps.length === 0
                    ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune inscription</div>
                    : r.inscriptions_camps.map((ic, j) => (
                      <div key={j} style={{ fontSize: 12, padding: '6px 10px', background: '#f9fafb', borderRadius: 6, marginBottom: 4, display: 'flex', gap: 12 }}>
                        <span style={{ fontWeight: 600, color: C }}>{ic.camp_nom}</span>
                        <span style={{ color: '#6b7280' }}>{ic.presence || 'présence ?'}</span>
                        <span style={{ color: '#9ca3af' }}>{ic.camp_dates}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ color: '#dc2626', padding: 16, background: '#fef2f2', borderRadius: 8, marginTop: 16 }}>{error}</div>}
    </div>
  )
}
