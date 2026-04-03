'use client'

import React from 'react'

// ─── Variantes de bouton ────────────────────────────────────────────────────

const VARIANTS = {
  primary:   { bg: '#2563eb', color: 'white', border: 'none', hoverBg: '#1d4ed8' },
  success:   { bg: '#059669', color: 'white', border: 'none', hoverBg: '#047857' },
  danger:    { bg: '#dc2626', color: 'white', border: 'none', hoverBg: '#b91c1c' },
  warning:   { bg: '#f59e0b', color: 'white', border: 'none', hoverBg: '#d97706' },
  secondary: { bg: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', hoverBg: '#e5e7eb' },
  ghost:     { bg: 'transparent', color: '#6b7280', border: 'none', hoverBg: '#f3f4f6' },
} as const

type ButtonVariant = keyof typeof VARIANTS

// ─── Composant ──────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Variante visuelle */
  variant?: ButtonVariant
  /** Taille */
  size?: 'sm' | 'md' | 'lg'
  /** Affiche un spinner et désactive le bouton */
  loading?: boolean
  /** Icône (emoji ou composant) à gauche du label */
  icon?: React.ReactNode
  /** Prend toute la largeur */
  fullWidth?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const v = VARIANTS[variant]
  const isDisabled = disabled || loading

  const padding = size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 24px' : '8px 18px'
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 15 : 13

  return (
    <button
      {...props}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding,
        borderRadius: 8,
        fontSize,
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        backgroundColor: isDisabled ? '#d1d5db' : v.bg,
        color: isDisabled ? '#9ca3af' : v.color,
        border: v.border,
        transition: 'all 0.15s',
        opacity: loading ? 0.7 : 1,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {loading ? (
        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      ) : icon ? (
        <span>{icon}</span>
      ) : null}
      {children}
    </button>
  )
}
