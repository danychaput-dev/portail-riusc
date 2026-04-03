'use client'

import React from 'react'

// ─── Card ───────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  /** Couleur de bordure (défaut: #e5e7eb) */
  borderColor?: string
  /** Padding intérieur (défaut: 20px) */
  padding?: string | number
  /** Style supplémentaire */
  style?: React.CSSProperties
  /** Click handler */
  onClick?: () => void
  /** data-tour attribute pour Shepherd.js */
  'data-tour'?: string
}

export default function Card({
  children,
  borderColor = '#e5e7eb',
  padding = 20,
  style,
  onClick,
  ...rest
}: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        border: `1.5px solid ${borderColor}`,
        padding,
        transition: 'all 0.2s',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

// ─── SectionTitle ───────────────────────────────────────────────────────────

interface SectionTitleProps {
  children: React.ReactNode
  /** Icône emoji avant le titre */
  icon?: string
  /** Sous-titre optionnel */
  subtitle?: string
  /** Style supplémentaire */
  style?: React.CSSProperties
}

export function SectionTitle({ children, icon, subtitle, style }: SectionTitleProps) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
        {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
        {children}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
