'use client'

/**
 * Route maintenue pour rétrocompatibilité des courriels/SMS déjà envoyés.
 * Redirige vers la nouvelle page unifiée /disponibilites?tab=mobilisations.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MobilisationRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/disponibilites?tab=mobilisations')
  }, [router])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '16px', color: '#1e3a5f' }}>
      Redirection vers la page des mobilisations…
    </div>
  )
}
