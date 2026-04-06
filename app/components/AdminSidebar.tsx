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
}

interface Props {
  stats?: {
    sinistres_actifs?: number
    certificats_attente?: number
    messages_non_lus?: number
    courriels_reponses_non_lues?: number
  }
}

const NAV_ITEMS: NavItem[] = [
  { titre: 'Réservistes',          icone: '👥', href: '/admin/reservistes',       statut: 'actif' },
  { titre: 'Opérations',           icone: '🚨', href: '/admin/operations',        statut: 'actif' },
  { titre: 'Sinistres',            icone: '🌊', href: '/admin/sinistres',         statut: 'actif' },
  { titre: 'Certificats',          icone: '🗂️', href: '/admin/certificats',       statut: 'actif' },
  { titre: 'Courriels',            icone: '✉️', href: '/admin/courriels',         statut: 'actif' },
  { titre: 'Camps',                icone: '🏕️', href: '/admin/inscriptions-camps', statut: 'actif' },
  { titre: 'Communauté',           icone: '💬', href: '/communaute',              statut: 'actif', externe: true },
  { titre: 'Dashboard',            icone: '📈', href: '/dashboard',               statut: 'actif', externe: true },
  { titre: 'Statistiques',         icone: '📊', href: '/stats',                   statut: 'actif', externe: true },
  { titre: 'Utilisateurs',         icone: '🔐', href: '/admin/utilisateurs',      statut: 'actif' },
  { titre: 'Partenaires',          icone: '🤝', href: '/admin/partenaires',       statut: 'bientot' },
  { titre: 'Présences & CNESST',   icone: '📋', href: '/admin/presences',         statut: 'bientot' },
]

export default function AdminSidebar({ stats }: Props) {
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

  const getBadge = (item: NavItem) => {
    if (!stats) return undefined
    if (item.href === '/admin/operations' || item.href === '/admin/sinistres') return stats.sinistres_actifs
    if (item.href === '/admin/certificats') return stats.certificats_attente
    if (item.href === '/communaute') return stats.messages_non_lus
    if (item.href === '/admin/courriels') return stats.courriels_reponses_non_lues
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
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href)
          const disabled = item.statut === 'bientot'
          const badge = getBadge(item)

          return (
            <button
              key={item.href}
              onClick={() => !disabled && router.push(item.href)}
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
                  backgroundColor: '#dc2626',
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
          {!collapsed && <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '500' }}>Retour au portail</span>}
        </button>
      </div>
    </aside>
  )
}
