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
  notes_non_lues: number
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [stats, setStats] = useState<SidebarStats>({ sinistres_actifs: 0, certificats_attente: 0, messages_non_lus: 0, courriels_reponses_non_lues: 0, notes_non_lues: 0 })
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
      let notesNonLues = 0
      try {
        const [repRes, notesRes] = await Promise.all([
          fetch('/api/admin/courriels/reponses/count'),
          fetch('/api/admin/notes/non-lues'),
        ])
        const repJson = await repRes.json()
        reponsesNonLues = repJson.count || 0
        const notesJson = await notesRes.json()
        notesNonLues = notesJson.count || 0
      } catch {}

      setStats({
        sinistres_actifs: sinistres.count || 0,
        certificats_attente: certificats.count || 0,
        messages_non_lus: messagesCount ?? 0,
        courriels_reponses_non_lues: reponsesNonLues,
        notes_non_lues: notesNonLues,
      })
    } catch {}
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Detection impersonation: si active, on utilise le role de l'utilisateur impersonne
      // pour l'affichage du sidebar et les restrictions d'acces.
      let impersonatedRole: string | null = null
      let impersonatedBenevoleId: string | null = null
      try {
        const impRes = await fetch('/api/check-impersonate', { credentials: 'include' })
        if (impRes.ok) {
          const impData = await impRes.json()
          if (impData.isImpersonating && impData.benevole_id) {
            impersonatedBenevoleId = impData.benevole_id
            const { data: impRole } = await supabase
              .from('reservistes')
              .select('role')
              .eq('benevole_id', impData.benevole_id)
              .single()
            impersonatedRole = impRole?.role || null
          }
        }
      } catch (_) {}

      // Role effectif = role impersonne si active, sinon role reel
      let effectiveRole: string | null = impersonatedRole
      if (!effectiveRole) {
        // 1. Chercher par user_id
        let res = (await supabase.from('reservistes').select('role, benevole_id').eq('user_id', user.id).single()).data
        // 2. Fallback par email si user_id pas lie
        if (!res && user.email) {
          const { data: byEmail } = await supabase.from('reservistes').select('role, benevole_id').ilike('email', user.email).single()
          if (byEmail) {
            await supabase.from('reservistes').update({ user_id: user.id }).eq('benevole_id', byEmail.benevole_id)
            res = byEmail
          }
        }
        // 3. Si le role n'est pas detecte via SELECT (RLS), essayer via RPC
        if (res && !['superadmin', 'admin', 'coordonnateur', 'adjoint'].includes(res.role)) {
          const { data: roleFromDb } = await supabase.rpc('get_reserviste_role', { target_benevole_id: res.benevole_id })
          if (roleFromDb) res = { ...res, role: roleFromDb }
        }
        effectiveRole = res?.role || null
      }

      // Partenaires ont acces uniquement a /admin/inscriptions-camps
      const isPartenaireRole = effectiveRole === 'partenaire' || effectiveRole === 'partenaire_lect'
      const isAdminRole = ['superadmin', 'admin', 'coordonnateur', 'adjoint'].includes(effectiveRole || '')

      if (!isAdminRole && !isPartenaireRole) {
        router.push('/')
        return
      }
      // Partenaire: seule la page inscriptions-camps est autorisee
      if (isPartenaireRole && !pathname.startsWith('/admin/inscriptions-camps')) {
        router.push('/')
        return
      }

      setAuthorized(true)
      setUserRole(effectiveRole || '')
      userIdRef.current = user.id
      if (isAdminRole) refreshBadges()
    }
    init()
  }, [pathname])

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

  // Écouter les mises à jour du badge notes
  useEffect(() => {
    const handler = (e: Event) => {
      const count = (e as CustomEvent).detail?.count
      if (typeof count === 'number') {
        setStats(prev => ({ ...prev, notes_non_lues: count }))
      }
    }
    window.addEventListener('notes-badge-update', handler)
    return () => window.removeEventListener('notes-badge-update', handler)
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
        {userRole !== 'adjoint' && userRole !== 'partenaire' && userRole !== 'partenaire_lect' && <AdminSidebar stats={stats} userRole={userRole} />}
        <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
