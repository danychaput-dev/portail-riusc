'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'

const C = '#1e3a5f'

interface CampagneStats {
  id: string
  nom: string
  subject: string
  total_envoyes: number
  created_at: string
  stats: {
    total: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    failed: number
    taux_ouverture: number
    taux_clics: number
  }
}

function StatPill({ value, label, color, bg }: { value: number | string; label: string; color: string; bg: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: '10px', backgroundColor: bg, minWidth: '70px' }}>
      <span style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</span>
      <span style={{ fontSize: '10px', fontWeight: '600', color, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
    </div>
  )
}

export default function CampagnesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [campagnes, setCampagnes] = useState<CampagneStats[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (!res || !['admin', 'coordonnateur'].includes(res.role)) { router.push('/'); return }
      setAuthorized(true)
    }
    init()
  }, [])

  useEffect(() => {
    if (!authorized) return
    fetch('/api/admin/courriels/campagnes')
      .then(r => r.json())
      .then(json => setCampagnes(json.campagnes || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authorized])

  if (!authorized) return null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader />
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>← Admin</button>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: C }}>Campagnes courriels</h1>
            <span style={{ fontSize: '13px', color: '#6b7280', backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '20px' }}>
              {loading ? '…' : `${campagnes.length} campagne${campagnes.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Chargement…</div>
        ) : campagnes.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '15px', color: '#6b7280' }}>Aucune campagne envoyée pour le moment</div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
              Les campagnes sont créées automatiquement quand vous envoyez un courriel à plusieurs réservistes.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {campagnes.map(c => {
              const date = new Date(c.created_at)
              const dateStr = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
              const timeStr = date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
              const s = c.stats

              return (
                <div key={c.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {/* En-tête campagne */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: '#1f2937' }}>
                        {c.subject}
                      </h3>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {dateStr} à {timeStr} — {s.total} destinataire{s.total > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <StatPill value={s.total} label="Envoyés" color="#374151" bg="#f3f4f6" />
                    <StatPill value={s.delivered} label="Livrés" color="#16a34a" bg="#f0fdf4" />
                    <StatPill value={`${s.taux_ouverture}%`} label="Ouverts" color="#2563eb" bg="#eff6ff" />
                    <StatPill value={`${s.taux_clics}%`} label="Clics" color="#1e40af" bg="#dbeafe" />
                    {s.bounced > 0 && <StatPill value={s.bounced} label="Rebondis" color="#dc2626" bg="#fef2f2" />}
                    {s.failed > 0 && <StatPill value={s.failed} label="Échoués" color="#dc2626" bg="#fef2f2" />}
                  </div>

                  {/* Barre de progression */}
                  {s.total > 0 && (
                    <div style={{ marginTop: '12px', height: '6px', borderRadius: '3px', backgroundColor: '#f1f5f9', overflow: 'hidden', display: 'flex' }}>
                      {s.clicked > 0 && (
                        <div style={{ width: `${(s.clicked / s.total) * 100}%`, backgroundColor: '#1e40af', transition: 'width 0.3s' }} />
                      )}
                      {(s.opened - s.clicked) > 0 && (
                        <div style={{ width: `${((s.opened - s.clicked) / s.total) * 100}%`, backgroundColor: '#3b82f6', transition: 'width 0.3s' }} />
                      )}
                      {(s.delivered - s.opened) > 0 && (
                        <div style={{ width: `${((s.delivered - s.opened) / s.total) * 100}%`, backgroundColor: '#86efac', transition: 'width 0.3s' }} />
                      )}
                      {s.bounced > 0 && (
                        <div style={{ width: `${(s.bounced / s.total) * 100}%`, backgroundColor: '#fca5a5', transition: 'width 0.3s' }} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
