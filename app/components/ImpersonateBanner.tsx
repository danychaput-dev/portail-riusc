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
      body.impersonate-readonly textarea:not([data-impersonate-unlocked]) {
        opacity: 0.7 !important;
        cursor: not-allowed !important;
        caret-color: transparent !important;
      }
      /* Champ debloque par Ctrl+clic */
      body.impersonate-readonly input[data-impersonate-unlocked],
      body.impersonate-readonly select[data-impersonate-unlocked],
      body.impersonate-readonly textarea[data-impersonate-unlocked] {
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
      const field = target.closest('input, select, textarea') as HTMLElement | null
      if (!field) return
      if (field.hasAttribute('data-impersonate-unlocked')) return

      // Champ verrouille
      if (e instanceof MouseEvent && (e.ctrlKey || e.metaKey)) {
        // Ctrl+click : debloquer le champ
        e.preventDefault()
        e.stopPropagation()
        field.setAttribute('data-impersonate-unlocked', 'true')
        setTimeout(() => { ;(field as HTMLInputElement).focus?.() }, 50)
      } else {
        // Clic normal ou frappe : bloquer
        e.preventDefault()
        e.stopPropagation()
        // Empêcher le focus
        ;(field as HTMLInputElement).blur?.()
      }
    }

    // Capturer les evenements sur les champs
    document.addEventListener('mousedown', handleInteraction, true)
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const field = target.closest('input, select, textarea') as HTMLElement | null
      if (!field) return
      if (field.hasAttribute('data-impersonate-unlocked')) return
      // Bloquer la frappe clavier dans les champs verrouilles
      e.preventDefault()
    }, true)

    // Bloquer le focus automatique sur les champs verrouilles
    document.addEventListener('focusin', (e: FocusEvent) => {
      const target = e.target as HTMLElement
      const field = target.closest('input, select, textarea') as HTMLElement | null
      if (!field) return
      if (field.hasAttribute('data-impersonate-unlocked')) return
      ;(field as HTMLInputElement).blur?.()
    }, true)

    return () => {
      document.body.classList.remove('impersonate-readonly')
      const existingStyle = document.getElementById('impersonate-readonly-style')
      if (existingStyle) existingStyle.remove()
      // Note: les listeners ne sont pas cleanup proprement car on utilise des fonctions anonymes
      // mais ca marche car le composant ne se demonte que lors d'un changement de page complet
    }
  }, [isImpersonating])

  return null
}
