'use client'

// app/components/PartenaireReturnBar.tsx
//
// Bande bleue "Retour au portail partenaire" affichee en haut des pages
// hors /partenaire pour les roles partenaire / partenaire_lect. Les
// partenaires n'ont pas de sidebar et peuvent se sentir perdus sur les
// pages admin ou dashboard sans bouton retour evident.
//
// Le composant detecte lui-meme le role effectif (tenant compte de
// l'emprunt d'identite) via l'API /api/check-impersonate + lecture du
// role dans reservistes. Se rend null si non-partenaire.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = '#1e3a5f'
const BLUE_LIGHT = '#eff6ff'
const BLUE_BORDER = '#bfdbfe'

export default function PartenaireReturnBar() {
  const [isPartenaire, setIsPartenaire] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    const detect = async () => {
      const supabase = createClient()
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Detecter emprunt
        let effectiveBenevoleId: string | null = null
        let impersonatedRole: string | null = null
        try {
          const impRes = await fetch('/api/check-impersonate', { credentials: 'include' })
          if (impRes.ok) {
            const impData = await impRes.json()
            if (impData.isImpersonating && impData.benevole_id) {
              effectiveBenevoleId = impData.benevole_id
              const { data: impRole } = await supabase
                .from('reservistes')
                .select('role')
                .eq('benevole_id', impData.benevole_id)
                .single()
              impersonatedRole = impRole?.role || null
            }
          }
        } catch {}

        let effectiveRole: string | null = impersonatedRole
        if (!effectiveRole) {
          const { data: me } = await supabase
            .from('reservistes')
            .select('role')
            .eq('user_id', user.id)
            .single()
          effectiveRole = me?.role || null
        }

        if (!cancelled && (effectiveRole === 'partenaire' || effectiveRole === 'partenaire_lect')) {
          setIsPartenaire(true)
        }
      } catch {}
    }
    detect()
    return () => { cancelled = true }
  }, [])

  // Si on est deja sur /partenaire, pas besoin de retour
  if (!isPartenaire) return null
  if (pathname?.startsWith('/partenaire')) return null

  // Label contextuel selon la route
  let contexte = ''
  if (pathname?.startsWith('/admin/pointage')) contexte = 'Présences · codes QR'
  else if (pathname?.startsWith('/admin/inscriptions-camps')) contexte = 'Inscriptions camps'
  else if (pathname?.startsWith('/dashboard')) contexte = 'Tableau de bord'

  return (
    <div
      style={{
        backgroundColor: BLUE_LIGHT,
        borderBottom: `1px solid ${BLUE_BORDER}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}
    >
      <a
        href="/partenaire"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          backgroundColor: 'white',
          border: `1px solid ${BLUE_BORDER}`,
          borderRadius: 6,
          color: C,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        ← Retour au portail partenaire
      </a>
      {contexte && (
        <span style={{ fontSize: 12, color: '#6b7280' }}>{contexte}</span>
      )}
    </div>
  )
}
