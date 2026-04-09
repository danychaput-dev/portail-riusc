'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/utils/useAuth'
import PortailHeader from '@/app/components/PortailHeader'

export default function OutilTransportsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { user: authUser, loading: authLoading } = useAuth()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!authUser) { router.push('/login'); return }

    const checkAccess = async () => {
      const userId = 'isImpersonated' in authUser && authUser.isImpersonated
        ? authUser.benevole_id
        : authUser.id

      // Chercher par user_id pour les vrais users, par benevole_id pour impersonation
      let res: any = null
      if ('isImpersonated' in authUser && authUser.isImpersonated) {
        const { data } = await supabase.from('reservistes').select('role').eq('benevole_id', userId).single()
        res = data
      } else {
        const { data } = await supabase.from('reservistes').select('role').eq('user_id', userId).single()
        res = data
      }

      if (!res) { router.push('/'); return }

      // Accessible aux admins, coordonnateurs, adjoints et partenaires
      const allowed = ['admin', 'coordonnateur', 'adjoint', 'partenaire']
      if (!allowed.includes(res.role)) { router.push('/'); return }

      setAuthorized(true)
    }
    checkAccess()
  }, [authUser, authLoading])

  if (!authorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280' }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <PortailHeader subtitle="Estimation et optimisation des transports" />
      <iframe
        src="/outil-transport.html"
        style={{
          width: '100%',
          height: 'calc(100vh - 73px)',
          border: 'none',
        }}
        title="Calculateur de transport dynamique"
      />
    </div>
  )
}
