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

  useEffect(() => {
    if (!isImpersonating) return

    document.body.classList.add('impersonate-readonly')

    const style = document.createElement('style')
    style.id = 'impersonate-readonly-style'
    style.textContent = `
      /* Champs verrouilles : visuellement gris mais cliquables (pointer-events actif) */
      body.impersonate-readonly input:not([data-impersonate-unlocked]),
      body.impersonate-readonly select:not([data-impersonate-unlocked]),
      body.impersonate-readonly textarea:not([data-impersonate-unlocked]),
      body.impersonate-readonly button:not([data-impersonate-unlocked]):not([data-impersonate-ignore]) {
        opacity: 0.7 !important;
        cursor: not-allowed !important;
        caret-color: transparent !important;
      }
      /* Champ debloque par Ctrl+clic */
      body.impersonate-readonly input[data-impersonate-unlocked],
      body.impersonate-readonly select[data-impersonate-unlocked],
      body.impersonate-readonly textarea[data-impersonate-unlocked],
      body.impersonate-readonly button[data-impersonate-unlocked] {
        opacity: 1 !important;
        cursor: auto !important;
        caret-color: auto !important;
        outline: 2px solid #f59e0b !important;
        outline-offset: 1px !important;
      }
    `
    document.head.appendChild(style)

    // Intercepter les interactions sur les champs verrouilles
    const handleInteraction = (e: Event) => {
      const target = e.target as HTMLElement
      const field = target.closest('input, select, textarea, button:not([data-impersonate-ignore])') as HTMLElement | null
      if (!field) return
      if (field.hasAttribute('data-impersonate-unlocked')) return

      // Champ verrouille
      if (e instanceof MouseEvent && (e.ctrlKey || e.metaKey)) {
        // Ctrl+click : debloquer le champ
        e.preventDefault()
        e.stopPropagation()
        field.setAttribute('data-impersonate-unlocked', 'true')
        if (field.tagName === 'BUTTON') {
          // Re-cliquer le bouton maintenant qu'il est debloque
          setTimeout(() => { field.click() }, 50)
        } else {
          setTimeout(() => { ;(field as HTMLInputElement).focus?.() }, 50)
        }
      } else {
        // Clic normal ou frappe : bloquer
        e.preventDefault()
        e.stopPropagation()
        // Empêcher le focus
        ;(field as HTMLInputElement).blur?.()
      }
    }

    // Bloquer les changements de valeur sur checkboxes/radio/select verrouilles
    const handleChange = (e: Event) => {
      const target = e.target as HTMLElement
      const field = target.closest('input, select, textarea, button:not([data-impersonate-ignore])') as HTMLElement | null
      if (!field) return
      if (field.hasAttribute('data-impersonate-unlocked')) return
      e.preventDefault()
      e.stopPropagation()
      // Remettre la valeur d'origine pour les checkboxes
      const input = field as HTMLInputElement
      if (input.type === 'checkbox') input.checked = !input.checked
      if (input.type === 'radio') input.checked = false
    }

    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const field = target.closest('input, select, textarea, button:not([data-impersonate-ignore])') as HTMLElement | null
      if (!field) return
      if (field.hasAttribute('data-impersonate-unlocked')) return
      e.preventDefault()
    }

    const handleFocusin = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      const field = target.closest('input, select, textarea, button:not([data-impersonate-ignore])') as HTMLElement | null
      if (!field) return
      if (field.hasAttribute('data-impersonate-unlocked')) return
      ;(field as HTMLInputElement).blur?.()
    }

    // Capturer les evenements sur les champs
    document.addEventListener('mousedown', handleInteraction, true)
    document.addEventListener('click', handleInteraction, true)
    document.addEventListener('change', handleChange, true)
    document.addEventListener('keydown', handleKeydown, true)
    document.addEventListener('focusin', handleFocusin, true)

    return () => {
      document.body.classList.remove('impersonate-readonly')
      const existingStyle = document.getElementById('impersonate-readonly-style')
      if (existingStyle) existingStyle.remove()
      document.removeEventListener('mousedown', handleInteraction, true)
      document.removeEventListener('click', handleInteraction, true)
      document.removeEventListener('change', handleChange, true)
      document.removeEventListener('keydown', handleKeydown, true)
      document.removeEventListener('focusin', handleFocusin, true)
    }
  }, [isImpersonating])

  return null
}
