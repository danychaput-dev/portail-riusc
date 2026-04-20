'use client'

import { useState } from 'react'

const C = '#1e3a5f'
const GREEN = '#16a34a'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

interface Session {
  contexte_nom: string
  contexte_lieu: string | null
  titre?: string | null
  shift: string | null
  date_shift: string | null
  approuveur_nom?: string | null
}

interface Props {
  url: string
  dataUrl: string     // PNG base64 du QR (généré avec la lib qrcode)
  session: Session
  onClose: () => void
}

export default function QRDisplayModal({ url, dataUrl, session, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const download = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    const toSlug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const slug = toSlug(session.contexte_nom || 'qr')
    const titreSlug = session.titre ? toSlug(session.titre) : ''
    const suffix = [titreSlug, session.shift, session.date_shift].filter(Boolean).join('-')
    a.download = `qr-${slug}${suffix ? '-' + suffix : ''}.png`
    a.click()
  }

  const printQR = () => {
    if (!dataUrl) return
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    const titreHtml = session.titre ? `<div class="titre">${escapeHtml(session.titre)}</div>` : ''
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>QR Pointage — ${escapeHtml(session.titre || session.contexte_nom)}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; margin: 0; }
            h1 { font-size: 22px; margin: 0 0 6px; color: #1e3a5f; font-weight: 600; }
            .titre { font-size: 34px; font-weight: 800; color: #1e3a5f; margin: 12px 0 16px; letter-spacing: 0.02em; }
            .sub { font-size: 14px; color: #6b7280; margin-bottom: 20px; }
            img { max-width: 70vw; max-height: 65vh; border: 2px solid #e5e7eb; padding: 12px; background: white; }
            .sous-qr { margin-top: 14px; font-size: 16px; font-weight: 600; color: #475569; }
            .footer { margin-top: 20px; font-size: 11px; color: #9ca3af; word-break: break-all; }
            @media print {
              .no-print { display: none; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(session.contexte_nom)}</h1>
          <div class="sub">
            ${session.shift ? labelShift(session.shift) : 'Tout le camp'}
            ${session.date_shift ? ' · ' + formatDate(session.date_shift) : ''}
            ${session.contexte_lieu ? ' · 📍 ' + escapeHtml(session.contexte_lieu) : ''}
          </div>
          ${titreHtml}
          <img src="${dataUrl}" alt="QR code" />
          ${session.titre ? `<div class="sous-qr">${escapeHtml(session.titre)}</div>` : ''}
          <div class="footer">${escapeHtml(url)}</div>
          <div class="no-print" style="margin-top:30px">
            <button onclick="window.print()" style="padding:10px 24px;font-size:14px;cursor:pointer;background:#1e3a5f;color:white;border:none;border-radius:6px">🖨️ Imprimer</button>
          </div>
        </body>
      </html>
    `)
    w.document.close()
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C }}>✅ QR généré</h2>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
              Les réservistes peuvent maintenant scanner ce code depuis leur portail.
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        <div style={{ padding: 14, borderRadius: 10, backgroundColor: '#f8fafc', border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: C, fontSize: 14 }}>{session.contexte_nom}</div>
          {session.titre && (
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginTop: 3 }}>
              🏷️ {session.titre}
            </div>
          )}
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
            {session.shift && <span style={{ fontWeight: 600 }}>{labelShift(session.shift)}</span>}
            {!session.shift && <span>Tout le camp</span>}
            {session.date_shift && <span> · {formatDate(session.date_shift)}</span>}
            {session.contexte_lieu && <span> · 📍 {session.contexte_lieu}</span>}
          </div>
          {session.approuveur_nom && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
              Approuveur : <span style={{ color: C, fontWeight: 600 }}>{session.approuveur_nom}</span>
            </div>
          )}
        </div>

        {/* QR — avec titre en surimpression pour différencier visuellement */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          {session.titre && (
            <div style={{ fontSize: 18, fontWeight: 800, color: C, marginBottom: 10, letterSpacing: '0.02em' }}>
              {session.titre}
            </div>
          )}
          {dataUrl ? (
            <img src={dataUrl} alt="QR code" style={{ maxWidth: '100%', width: 320, height: 320, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, backgroundColor: 'white' }} />
          ) : (
            <div style={{ padding: 60, color: MUTED }}>Erreur de génération du QR.</div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: MUTED, marginTop: 8 }}>
            {session.contexte_nom}
          </div>
        </div>

        {/* URL */}
        <div style={{ padding: 10, borderRadius: 8, backgroundColor: '#f1f5f9', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>URL du QR</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ flex: 1, fontSize: 11, color: '#1e293b', fontFamily: 'monospace', wordBreak: 'break-all' }}>{url}</code>
            <button onClick={copyUrl}
              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${BORDER}`, backgroundColor: copied ? '#d1fae5' : 'white', color: copied ? GREEN : C, cursor: 'pointer' }}>
              {copied ? '✓ Copié' : '📋 Copier'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={download} disabled={!dataUrl}
            style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, backgroundColor: 'white', color: C, border: `1px solid ${BORDER}`, cursor: dataUrl ? 'pointer' : 'not-allowed', opacity: dataUrl ? 1 : 0.5 }}>
            💾 Télécharger PNG
          </button>
          <button onClick={printQR} disabled={!dataUrl}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, borderRadius: 8, backgroundColor: C, color: 'white', border: 'none', cursor: dataUrl ? 'pointer' : 'not-allowed', opacity: dataUrl ? 1 : 0.5 }}>
            🖨️ Ouvrir pour imprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// Helpers

function labelShift(shift: string): string {
  if (shift === 'jour') return '☀️ Jour'
  if (shift === 'nuit') return '🌙 Nuit'
  if (shift === 'complet') return '🕐 Complet'
  return shift
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
}

const modalStyle: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: 12, padding: 24,
  width: '100%', maxWidth: 520, maxHeight: '95vh', overflowY: 'auto',
  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
}

const closeBtn: React.CSSProperties = {
  marginLeft: 'auto', background: 'none', border: 'none',
  fontSize: 28, cursor: 'pointer', color: MUTED, lineHeight: 1,
  padding: 0, width: 32, height: 32,
}
