'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PortailHeader from '@/app/components/PortailHeader'

export default function MissionsPage() {
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setLoading(false)
    }
    check()
  }, [])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>Chargement...</div>
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader subtitle="Missions actives" />

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour à l&apos;accueil</a>
        </div>

        <h2 style={{ color: '#1e3a5f', margin: '0 0 24px 0', fontSize: '28px', fontWeight: '700' }}>🚨 Missions actives</h2>

        <div style={{ padding: '24px', backgroundColor: '#fff3cd', borderRadius: '12px', border: '1px solid #ffc107' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#92400e' }}>Aucune mission active pour le moment</h3>
          <p style={{ margin: '0 0 4px 0', color: '#78350f', fontSize: '14px' }}><em>Les déploiements et missions actifs apparaîtront ici</em></p>
          <p style={{ margin: 0, color: '#78350f', fontSize: '14px' }}><em>Synchronisé avec Monday.com</em></p>
        </div>
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
