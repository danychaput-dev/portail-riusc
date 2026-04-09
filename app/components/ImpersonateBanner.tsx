'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function ImpersonateBanner({ position = 'top' }: { position?: 'top' | 'bottom' }) {
  const [impersonateData, setImpersonateData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
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

  // Mode read-only: desactiver tous les champs sauf Ctrl+click
  useEffect(() => {
    if (!impersonateData) return

    // Ajouter la classe au body
    document.body.classList.add('impersonate-readonly')

    // Injecter le CSS global pour le mode read-only
    const style = document.createElement('style')
    style.id = 'impersonate-readonly-style'
    style.textContent = `
      body.impersonate-readonly input:not([data-impersonate-unlocked]),
      body.impersonate-readonly select:not([data-impersonate-unlocked]),
      body.impersonate-readonly textarea:not([data-impersonate-unlocked]) {
        pointer-events: none !important;
        opacity: 0.7 !important;
        cursor: not-allowed !important;
      }
      body.impersonate-readonly input[data-impersonate-unlocked],
      body.impersonate-readonly select[data-impersonate-unlocked],
      body.impersonate-readonly textarea[data-impersonate-unlocked] {
        outline: 2px solid #f59e0b !important;
        outline-offset: 1px !important;
      }
      body.impersonate-readonly button:not([data-impersonate-unlocked]):not(.impersonate-btn) {
        opacity: 0.6 !important;
        pointer-events: none !important;
      }
    `
    document.head.appendChild(style)

    // Ctrl+click handler pour debloquer un champ
    const handleCtrlClick = (e: MouseEvent) => {
      if (!e.ctrlKey && !e.metaKey) return

      const target = e.target as HTMLElement
      const field = target.closest('input, select, textarea, button') as HTMLElement | null
      if (!field) return

      e.preventDefault()
      e.stopPropagation()

      // Toggle unlock
      if (field.hasAttribute('data-impersonate-unlocked')) {
        field.removeAttribute('data-impersonate-unlocked')
      } else {
        field.setAttribute('data-impersonate-unlocked', 'true')
        // Focus le champ apres le deblocage
        setTimeout(() => {
          ;(field as HTMLInputElement).focus?.()
        }, 50)
      }
    }

    document.addEventListener('click', handleCtrlClick, true)

    return () => {
      document.body.classList.remove('impersonate-readonly')
      const existingStyle = document.getElementById('impersonate-readonly-style')
      if (existingStyle) existingStyle.remove()
      document.removeEventListener('click', handleCtrlClick, true)
    }
  }, [impersonateData])

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

  // Petit badge flottant au lieu du gros bandeau
  return (
    <div
      className="impersonate-btn"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
      }}
    >
      {expanded && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          border: '2px solid #f59e0b',
          padding: '14px 18px',
          minWidth: '220px',
        }}>
          <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Emprunt actif
          </div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#78350f', marginBottom: '10px' }}>
            {impersonateData.prenom} {impersonateData.nom}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px', lineHeight: '1.4' }}>
            Mode lecture seule. <strong>Ctrl+clic</strong> sur un champ pour le modifier.
          </div>
          <button
            className="impersonate-btn"
            onClick={handleStopImpersonate}
            style={{
              width: '100%',
              padding: '8px 14px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Retour a mon compte
          </button>
        </div>
      )}

      <button
        className="impersonate-btn"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#f59e0b',
          border: '3px solid white',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          transition: 'transform 0.15s',
        }}
        title={`Emprunt: ${impersonateData.prenom} ${impersonateData.nom}`}
      >
        🎭
      </button>
    </div>
  )
}
