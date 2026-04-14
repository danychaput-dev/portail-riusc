// Composants UI partagés pour le wizard Operations
import type React from 'react'

export const IS: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, backgroundColor: 'white', color: '#1e293b',
  width: '100%', boxSizing: 'border-box',
}

export const LS: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b',
  marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' as any,
}

export const G2: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
}

export const TA: React.CSSProperties = {
  ...IS, minHeight: 130, resize: 'vertical', lineHeight: 1.6,
  fontFamily: 'inherit', height: 'auto',
}

export const ADD_BTN: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 8, border: '1.5px dashed #cbd5e1',
  backgroundColor: 'transparent', color: '#64748b', fontSize: 13,
  cursor: 'pointer', width: '100%', textAlign: 'left',
}

export function Btn({ onClick, disabled, loading, color = '#1e3a5f', outline = false, children }: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  color?: string
  outline?: boolean
  children: React.ReactNode
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      border: outline ? `1.5px solid ${color}` : 'none',
      backgroundColor: disabled || loading ? '#e5e7eb' : outline ? 'white' : color,
      color: disabled || loading ? '#9ca3af' : outline ? color : 'white',
      transition: 'background 0.15s',
    }}>
      {loading ? '⏳ ...' : children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={LS}>{label}</label>{children}</div>
}

export function SBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb',
      padding: 16,
    }}>
      {children}
    </div>
  )
}

export function SelCard({ selected, onClick, children }: {
  selected: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <div onClick={onClick} style={{
      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
      border: `1.5px solid ${selected ? '#3b82f6' : '#e5e7eb'}`,
      backgroundColor: selected ? '#eff6ff' : 'white',
      transition: 'all 0.1s',
    }}>
      {children}
    </div>
  )
}
