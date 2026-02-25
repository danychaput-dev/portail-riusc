'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ImpersonateBanner({ position = 'top' }: { position?: 'top' | 'bottom' }) {
  const [impersonateData, setImpersonateData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkImpersonate = async () => {
      try {
        const response = await fetch('/api/check-impersonate', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.isImpersonating) {
            setImpersonateData(data)
          }
        }
      } catch (error) {
        console.error('Erreur vérification emprunt:', error)
      }
      setLoading(false)
    }

    checkImpersonate()
  }, [])

  const handleStopImpersonate = async () => {
    try {
      const response = await fetch('/api/stop-impersonate', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        router.refresh()
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Erreur arrêt emprunt:', error)
    }
  }

  if (loading || !impersonateData) {
    return null
  }

  return (
    <div style={{ 
      backgroundColor: '#fef3c7', 
      ...(position === 'top' 
        ? { borderBottom: '2px solid #f59e0b' } 
        : { borderTop: '2px solid #f59e0b' }),
      padding: '12px 24px',
      position: 'sticky',
      ...(position === 'top' ? { top: 0 } : { bottom: 0 }),
      zIndex: 999
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🎭</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>
              Vous empruntez l'identité de :
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#78350f' }}>
              {impersonateData.prenom} {impersonateData.nom}
            </div>
          </div>
        </div>

        <button
          onClick={handleStopImpersonate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
        >
          Retour à mon compte
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
