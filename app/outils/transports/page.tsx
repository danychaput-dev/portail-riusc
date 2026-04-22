'use client'
// text pour upd
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/utils/useAuth'
import PortailHeader from '@/app/components/PortailHeader'
import PartenaireReturnBar from '@/app/components/PartenaireReturnBar'

export default function OutilTransportsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { user: authUser, loading: authLoading } = useAuth()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (authLoading) return
    const init = async () => {
      if (!authUser) { router.push('/login'); return }

      let role: string | null = null

      // CAS 1 : Emprunt d'identite
      if ('isImpersonated' in authUser && authUser.isImpersonated) {
        const { data: rpcData } = await supabase
          .rpc('get_reserviste_by_benevole_id', { target_benevole_id: authUser.benevole_id })
        if (rpcData?.[0]) role = rpcData[0].role
      } else {
        // CAS 2 : Auth normale
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        const { data } = await supabase
          .from('reservistes')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()
        role = data?.role || null
      }

      // Accessible aux admins, coordonnateurs, adjoints et partenaires (lect inclus)
      const allowed = ['superadmin', 'admin', 'coordonnateur', 'adjoint', 'partenaire', 'partenaire_lect']
      if (!role || !allowed.includes(role)) { router.push('/'); return }

      setAuthorized(true)
    }
    init()
  }, [authUser, authLoading])

  if (!authorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280' }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <PortailHeader subtitle="Estimation et optimisation des transports" />
      <PartenaireReturnBar />
      <iframe
        src="/outil-transport.html"
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          minHeight: 400,
        }}
        title="Calculateur de transport dynamique"
      />
    </div>
  )
}
