'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'
import AdminSidebar from '@/app/components/AdminSidebar'

interface SidebarStats {
  sinistres_actifs: number
  certificats_attente: number
  messages_non_lus: number
  courriels_reponses_non_lues: number
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [stats, setStats] = useState<SidebarStats>({ sinistres_actifs: 0, certificats_attente: 0, messages_non_lus: 0, courriels_reponses_non_lues: 0 })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (!res || !['admin', 'coordonnateur'].includes(res.role)) { router.push('/'); return }
      setAuthorized(true)

      // Charger les badges en background (non bloquant)
      try {
        const [sinistres, certificats, lastSeen] = await Promise.all([
          supabase.from('sinistres').select('id', { count: 'exact', head: true }).eq('statut', 'Actif'),
          supabase.from('formations_benevoles').select('id', { count: 'exact', head: true }).eq('resultat', 'En attente').not('certificat_url', 'is', null).is('date_reussite', null),
          supabase.from('community_last_seen').select('last_seen_at').eq('user_id', user.id).maybeSingle(),
        ])
        const lastSeenAt = lastSeen.data?.last_seen_at || '1970-01-01'
        const { count: messagesCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('is_deleted', false)
          .gt('created_at', lastSeenAt)

        // Compter les réponses inbound non lues (défensif si table pas encore créée)
        let reponsesNonLues = 0
        try {
          const repRes = await fetch('/api/admin/courriels/reponses?statut=recu&limit=200')
          const repJson = await repRes.json()
          reponsesNonLues = (repJson.reponses || []).length
        } catch {}

        setStats({
          sinistres_actifs: sinistres.count || 0,
          certificats_attente: certificats.count || 0,
          messages_non_lus: messagesCount ?? 0,
          courriels_reponses_non_lues: reponsesNonLues,
        })
      } catch {}
    }
    init()
  }, [])

  // Écouter les mises à jour du badge courriels depuis la page courriels
  useEffect(() => {
    const handler = (e: Event) => {
      const count = (e as CustomEvent).detail?.count
      if (typeof count === 'number') {
        setStats(prev => ({ ...prev, courriels_reponses_non_lues: count }))
      }
    }
    window.addEventListener('courriels-badge-update', handler)
    return () => window.removeEventListener('courriels-badge-update', handler)
  }, [])

  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      <PortailHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <AdminSidebar stats={stats} />
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
