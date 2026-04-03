'use client'

import React from 'react'
import { CERT_REQUIRED_LABELS } from './constants'

// ─── Section — Carte avec titre, icône et description ───────────────────────

export const Section = ({ title, icon, description, confidential, children }: {
  title: string
  icon?: string
  description?: string
  confidential?: boolean
  children: React.ReactNode
}) => (
  <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: description ? '8px' : '20px' }}>
      {icon && <span style={{ fontSize: '24px' }}>{icon}</span>}
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>{title}</h2>
      {confidential && (
        <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '4px 10px', borderRadius: '12px', fontWeight: '500' }}>
          🔒 Confidentiel
        </span>
      )}
    </div>
    {description && (
      <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '0', marginBottom: '20px', lineHeight: '1.5' }}>
        {description}
      </p>
    )}
    {children}
  </div>
)

// ─── TextInput — Champ texte avec label ─────────────────────────────────────

export const TextInput = ({ label, value, onChange, disabled, placeholder, type = 'text', inputRef }: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  type?: string
  inputRef?: React.RefObject<HTMLInputElement>
}) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
      {label}
    </label>
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '14px',
        color: disabled ? '#9ca3af' : '#111827',
        backgroundColor: disabled ? '#f9fafb' : 'white',
        boxSizing: 'border-box',
      }}
    />
  </div>
)

// ─── TextArea — Zone de texte avec label ────────────────────────────────────

export const TextArea = ({ label, value, onChange, placeholder, rows = 3 }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
      {label}
    </label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#111827',
        backgroundColor: 'white',
        resize: 'vertical',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    />
  </div>
)

// ─── Checkbox — Case à cocher simple ────────────────────────────────────────

export const Checkbox = ({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151', marginBottom: '12px' }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
      style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
    {label}
  </label>
)

// ─── CheckboxGroup — Groupe de cases à cocher avec certificat requis ────────

export const CheckboxGroup = ({ label, options, selected, onChange }: {
  label: string
  options: { id: number; label: string }[]
  selected: number[]
  onChange: (selected: number[]) => void
}) => (
  <div style={{ marginBottom: '20px' }}>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
      {label}
    </label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {options.map(opt => (
        <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
          <input
            type="checkbox"
            checked={selected.includes(opt.id)}
            onChange={e => {
              if (e.target.checked) {
                onChange([...selected, opt.id])
              } else {
                onChange(selected.filter(id => id !== opt.id))
              }
            }}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          {opt.label}
          {CERT_REQUIRED_LABELS.has(opt.label) && (
            <span style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>(certificat requis)</span>
          )}
        </label>
      ))}
    </div>
  </div>
)
