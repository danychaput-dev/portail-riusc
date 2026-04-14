import type React from 'react'
import type { StepStatus } from '../types'

export function StepCard({ id, n, status, title, subtitle, ai = false, children }: {
  id: string
  n: number
  status: StepStatus
  title: string
  subtitle?: string
  ai?: boolean
  children?: React.ReactNode
}) {
  const done = status === 'done'
  const active = status === 'active'
  const locked = status === 'locked'
  const bdr = done ? '#10b981' : active ? (ai ? '#8b5cf6' : '#3b82f6') : '#e5e7eb'
  const hBg = done ? '#f0fdf4' : active ? (ai ? '#faf5ff' : '#eff6ff') : '#fafafa'
  const hBd = done ? '#bbf7d0' : active ? (ai ? '#ddd6fe' : '#bfdbfe') : '#f3f4f6'
  const tC = done ? '#065f46' : active ? (ai ? '#5b21b6' : '#1d4ed8') : '#9ca3af'
  const sC = done ? '#047857' : active ? (ai ? '#7c3aed' : '#2563eb') : '#d1d5db'
  return (
    <div id={id} style={{ backgroundColor: 'white', borderRadius: 12, border: `1.5px solid ${bdr}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <div style={{ padding: '12px 20px', backgroundColor: hBg, borderBottom: `1px solid ${hBd}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
          backgroundColor: done ? '#10b981' : active ? (ai ? '#8b5cf6' : '#3b82f6') : '#e5e7eb',
          color: locked ? '#9ca3af' : 'white',
        }}>
          {done ? '✓' : n}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: tC, display: 'flex', alignItems: 'center', gap: 8 }}>
            {title}
            {ai && active && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, backgroundColor: '#8b5cf6', color: 'white', fontWeight: 600 }}>IA ✦</span>}
          </div>
          {subtitle && <div style={{ fontSize: 12, color: sC, marginTop: 1 }}>{subtitle}</div>}
        </div>
        {locked && <span style={{ fontSize: 11, color: '#c4c4c4', fontStyle: 'italic' }}>🔒 Étapes précédentes requises</span>}
      </div>
      {!locked && children && <div style={{ padding: '20px' }}>{children}</div>}
    </div>
  )
}
