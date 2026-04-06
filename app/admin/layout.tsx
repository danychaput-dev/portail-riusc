'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [stats, setStats] = useState<SidebarStats>({ sinistres_actifs: 0, certificats_attente: 0, messages_non_lus: 0, courriels_reponses_non_lues: 0 })
  const userIdRef = useRef<string | null>(null)

  const refreshBadges = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return
    try {
      const [sinistres, certificats, lastSeen] = await Promise.all([
        supabase.from('sinistres').select('id', { count: 'exact', head: true }).eq('statut', 'Actif'),
        supabase.from('formations_benevoles').select('id', { count: 'exact', head: true }).eq('resultat', 'En attente').not('certificat_url', 'is', null).is('date_reussite', null),
        supabase.from('community_last_seen').select('last_seen_at').eq('user_id', userId).maybeSingle(),
      ])
      const lastSeenAt = lastSeen.data?.last_seen_at || '1970-01-01'
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .gt('created_at', lastSeenAt)

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
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (!res || !['admin', 'coordonnateur'].includes(res.role)) { router.push('/'); return }
      setAuthorized(true)
      userIdRef.current = user.id
      refreshBadges()
    }
    init()
  }, [])

  // Rafraîchir les badges quand on navigue entre pages admin
  useEffect(() => {
    if (authorized) refreshBadges()
  }, [pathname])

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

  // Écouter les mises à jour du badge certificats depuis la page certificats
  useEffect(() => {
    const handler = (e: Event) => {
      const delta = (e as CustomEvent).detail?.delta
      if (typeof delta === 'number') {
        setStats(prev => ({ ...prev, certificats_attente: Math.max(0, (prev.certificats_attente || 0) + delta) }))
      }
    }
    window.addEventListener('certificats-badge-update', handler)
    return () => window.removeEventListener('certificats-badge-update', handler)
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
    <div style={{ height: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      <PortailHeader />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <AdminSidebar stats={stats} />
        <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
