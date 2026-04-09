'use client'

import { useEffect, useState } from 'react'

/**
 * ImpersonateBanner - Ne rend rien visuellement.
 * Injecte le mode read-only (CSS + Ctrl+click) quand un emprunt est actif.
 * L'indicateur visuel est gere par le header (couleur jaune + menu "Retour").
 */
export default function ImpersonateBanner({ position = 'top' }: { position?: 'top' | 'bottom' }) {
  const [isImpersonating, setIsImpersonating] = useState(false)

  useEffect(() => {
    const checkImpersonate = async () => {
      try {
        const response = await fetch('/api/check-impersonate', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          if (data.isImpersonating) setIsImpersonating(true)
        }
      } catch {}
    }
    checkImpersonate()
  }, [])

  // Mode read-only: desactiver les champs sauf Ctrl+click
  useEffect(() => {
    if (!isImpersonating) return

    document.body.classList.add('impersonate-readonly')

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
    `
    document.head.appendChild(style)

    const handleCtrlClick = (e: MouseEvent) => {
      if (!e.ctrlKey && !e.metaKey) return

      const target = e.target as HTMLElement
      const field = target.closest('input, select, textarea') as HTMLElement | null
      if (!field) return

      e.preventDefault()
      e.stopPropagation()

      if (field.hasAttribute('data-impersonate-unlocked')) {
        field.removeAttribute('data-impersonate-unlocked')
      } else {
        field.setAttribute('data-impersonate-unlocked', 'true')
        setTimeout(() => { ;(field as HTMLInputElement).focus?.() }, 50)
      }
    }

    document.addEventListener('click', handleCtrlClick, true)

    return () => {
      document.body.classList.remove('impersonate-readonly')
      const existingStyle = document.getElementById('impersonate-readonly-style')
      if (existingStyle) existingStyle.remove()
      document.removeEventListener('click', handleCtrlClick, true)
    }
  }, [isImpersonating])

  // Ne rend rien visuellement
  return null
}
