'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PortailHeader from '@/app/components/PortailHeader'
import ImpersonateBanner from '@/app/components/ImpersonateBanner'
import { isDemoActive, getDemoGroupe, DEMO_RESERVISTE, DEMO_USER } from '@/utils/demoMode'
import { useAuth } from '@/utils/useAuth'
import { createClient } from '@/utils/supabase/client'
import { logPageVisit } from '@/utils/logEvent'

export default function PreparationDeploiementPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { user: authUser, loading: authLoading } = useAuth()

  useEffect(() => {
    const load = async () => {
      // 🎯 MODE DÉMO
      if (isDemoActive()) {
        logPageVisit('/informations/preparation-deploiement')
        setLoading(false)
        return
      }

      if (authLoading) return
      if (!authUser) { router.push('/login'); return }

      logPageVisit('/informations/preparation-deploiement')
      setLoading(false)
    }
    load()
  }, [authUser, authLoading])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader subtitle="Préparation au déploiement" />
      <ImpersonateBanner />

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <a href="/informations" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '20px' }}>
          ← Retour aux informations pratiques
        </a>

        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚧</div>
          <h2 style={{ color: '#1e3a5f', margin: '0 0 12px 0', fontSize: '24px', fontWeight: '700' }}>
            Page en construction
          </h2>
          <p style={{ color: '#6b7280', margin: '0 0 32px 0', fontSize: '16px', lineHeight: '1.7', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
            Cette section contiendra prochainement toutes les informations pour bien vous préparer
            avant un déploiement : quoi apporter, quoi prévoir et à quoi vous attendre sur le terrain.
          </p>

          <div style={{ backgroundColor: '#f0f4f8', borderRadius: '12px', padding: '24px', maxWidth: '440px', margin: '0 auto 32px', textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a5f', marginBottom: '12px' }}>
              À venir dans cette section :
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#374151' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#9ca3af' }}>○</span> Liste du matériel personnel à apporter
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#9ca3af' }}>○</span> Équipements de protection individuelle (ÉPI)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#9ca3af' }}>○</span> Déroulement typique d&apos;un déploiement
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#9ca3af' }}>○</span> Conseils pratiques des réservistes expérimentés
              </div>
            </div>
          </div>

          <a
            href="/informations"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2d4a6f')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#1e3a5f')}
          >
            ← Retour aux informations pratiques
          </a>
        </div>
      </main>

      <ImpersonateBanner position="bottom" />

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
