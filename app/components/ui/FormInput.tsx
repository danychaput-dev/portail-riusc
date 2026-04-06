'use client'

import React from 'react'

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label affiché au-dessus du champ */
  label?: string
  /** Message d'erreur */
  error?: string
  /** Taille du champ */
  size?: 'sm' | 'md'
}

export default function FormInput({ label, error, size = 'md', style, ...props }: FormInputProps) {
  const isSmall = size === 'sm'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          padding: isSmall ? '6px 8px' : '8px 12px',
          border: `1px solid ${error ? '#ef4444' : '#9ca3af'}`,
          borderRadius: 6,
          fontSize: 14,
          outline: 'none',
          backgroundColor: props.disabled ? '#f9fafb' : 'white',
          color: '#111827',
          transition: 'border-color 0.15s',
          width: '100%',
          ...style,
        }}
      />
      {error && (
        <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
      )}
    </div>
  )
}

// ─── Select ─────────────────────────────────────────────────────────────────

interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  error?: string
  size?: 'sm' | 'md'
  options: { value: string; label: string }[]
  placeholder?: string
}

export function FormSelect({ label, error, size = 'md', options, placeholder, style, ...props }: FormSelectProps) {
  const isSmall = size === 'sm'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
          {label}
        </label>
      )}
      <select
        {...props}
        style={{
          padding: isSmall ? '6px 8px' : '8px 12px',
          border: `1px solid ${error ? '#ef4444' : '#9ca3af'}`,
          borderRadius: 6,
          fontSize: 14,
          outline: 'none',
          backgroundColor: props.disabled ? '#f9fafb' : 'white',
          color: '#111827',
          transition: 'border-color 0.15s',
          width: '100%',
          ...style,
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && (
        <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
      )}
    </div>
  )
}

// ─── Textarea ───────────────────────────────────────────────────────────────

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function FormTextarea({ label, error, style, ...props }: FormTextareaProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
          {label}
        </label>
      )}
      <textarea
        {...props}
        style={{
          padding: '8px 12px',
          border: `1px solid ${error ? '#ef4444' : '#9ca3af'}`,
          borderRadius: 6,
          fontSize: 14,
          outline: 'none',
          backgroundColor: props.disabled ? '#f9fafb' : 'white',
          color: '#111827',
          resize: 'vertical',
          minHeight: 80,
          width: '100%',
          ...style,
        }}
      />
      {error && (
        <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
      )}
    </div>
  )
}
