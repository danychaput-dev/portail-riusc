'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const C = '#1e3a5f'

interface NavItem {
  titre: string
  icone: string
  href: string
  badge?: number
  externe?: boolean       // lien hors /admin (ex: /communaute)
  statut: 'actif' | 'bientot'
  superadminOnly?: boolean
}

interface Props {
  stats?: {
    sinistres_actifs?: number
    certificats_attente?: number
    messages_non_lus?: number
    courriels_reponses_non_lues?: number
    notes_non_lues?: number
  }
  userRole?: string
}

const NAV_ITEMS: NavItem[] = [
  { titre: 'Reservistes',          icone: '👥', href: '/admin/reservistes',        statut: 'actif' },
  { titre: 'Operations',           icone: '🚨', href: '/admin/operations',         statut: 'actif' },
  { titre: 'Sinistres',            icone: '🌊', href: '/admin/sinistres',          statut: 'actif' },
  { titre: 'Certificats',          icone: '🗂️', href: '/admin/certificats',        statut: 'actif' },
  { titre: 'Courriels',            icone: '✉️', href: '/admin/courriels',          statut: 'actif' },
  { titre: 'Camps',                icone: '🏕️', href: '/admin/inscriptions-camps', statut: 'actif' },
  { titre: 'Communaute',           icone: '💬', href: '/admin/communaute',         statut: 'actif' },
  { titre: 'Dashboard',            icone: '📈', href: '/admin/dashboard',          statut: 'actif' },
  { titre: 'Statistiques',         icone: '📊', href: '/admin/stats',              statut: 'actif' },
  { titre: 'Utilisateurs',         icone: '🔐', href: '/admin/utilisateurs',       statut: 'actif', superadminOnly: true },
  { titre: 'Health Check',         icone: '🩺', href: '/admin/health-check',        statut: 'actif', superadminOnly: true },
  { titre: 'Debug Camp',           icone: '🔬', href: '/api/admin/debug-camp',      statut: 'actif', superadminOnly: true, externe: true },
  { titre: 'Partenaires',          icone: '🤝', href: '/admin/partenaires',        statut: 'bientot' },
  { titre: 'Présences',            icone: '📋', href: '/admin/pointage',          statut: 'actif' },
]

export default function AdminSidebar({ stats, userRole }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  // Persister l'état collapsed
  useEffect(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed(prev => {
      localStorage.setItem('admin-sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  const isActive = (href: string) => {
    if (href === '/admin/reservistes') {
      return pathname === '/admin/reservistes' || pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  const getBadge = (item: NavItem): { count?: number; color?: string } | undefined => {
    if (!stats) return undefined
    if (item.href === '/admin/certificats' && stats.certificats_attente) return { count: stats.certificats_attente }
    if (item.href === '/admin/communaute' && stats.messages_non_lus) return { count: stats.messages_non_lus }
    if (item.href === '/admin/courriels' && stats.courriels_reponses_non_lues) return { count: stats.courriels_reponses_non_lues }
    if (item.href === '/admin/reservistes' && stats.notes_non_lues) return { count: stats.notes_non_lues, color: '#d946ef' }  // magenta
    return undefined
  }

  return (
    <aside
      style={{
        width: collapsed ? '56px' : '220px',
        minHeight: 'calc(100vh - 64px)',
        backgroundColor: 'white',
        borderRight: '1px solid #e5e7eb',
        transition: 'width 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Toggle */}
      <div style={{ padding: '12px 8px 8px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
        <button
          onClick={toggle}
          title={collapsed ? 'Ouvrir le menu' : 'Fermer le menu'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '16px', color: '#9ca3af', padding: '4px 8px',
            borderRadius: '6px', transition: 'background-color 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
          onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {collapsed ? '☰' : '◀'}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.filter(item => !item.superadminOnly || userRole === 'superadmin').map(item => {
          const active = isActive(item.href)
          const disabled = item.statut === 'bientot'
          const badgeInfo = getBadge(item)
          const badge = badgeInfo?.count
          const badgeColor = badgeInfo?.color || '#dc2626'

          return (
            <button
              key={item.href}
              onClick={() => !disabled && (item.externe ? window.open(item.href, '_blank') : router.push(item.href))}
              disabled={disabled}
              title={collapsed ? item.titre : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? '#eff6ff' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                transition: 'background-color 0.12s',
                width: '100%',
                textAlign: 'left',
                position: 'relative',
              }}
              onMouseOver={e => { if (!active && !disabled) e.currentTarget.style.backgroundColor = '#f9fafb' }}
              onMouseOut={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <span style={{ fontSize: '17px', flexShrink: 0, lineHeight: 1 }}>{item.icone}</span>
              {!collapsed && (
                <span style={{
                  fontSize: '13px',
                  fontWeight: active ? '700' : '500',
                  color: active ? C : '#374151',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                }}>
                  {item.titre}
                </span>
              )}
              {badge !== undefined && badge > 0 && (
                <span style={{
                  position: collapsed ? 'absolute' : 'relative',
                  top: collapsed ? '4px' : 'auto',
                  right: collapsed ? '4px' : 'auto',
                  backgroundColor: badgeColor,
                  color: 'white',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: '700',
                  lineHeight: '1.4',
                  flexShrink: 0,
                }}>
                  {badge}
                </span>
              )}
              {!collapsed && disabled && (
                <span style={{ fontSize: '9px', color: '#9ca3af', fontWeight: '600', whiteSpace: 'nowrap' }}>Bientôt</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Lien retour portail */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid #f3f4f6' }}>
        <button
          onClick={() => router.push('/')}
          title={collapsed ? 'Retour au portail' : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: collapsed ? '8px 0' : '8px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: 'none', border: 'none', cursor: 'pointer',
            width: '100%', borderRadius: '8px', transition: 'background-color 0.12s',
          }}
          onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
          onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <span style={{ fontSize: '15px', flexShrink: 0 }}>←</span>
          {!collapsed && <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Retour portail</span>}
        </button>
      </div>
    </aside>
  )
}
