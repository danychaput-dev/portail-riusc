'use client'

import { useState, useEffect } from 'react'

const C = '#1e3a5f'

interface Destinataire {
  benevole_id: string
  email: string
  prenom: string
  nom: string
}

interface AdminEmailConfig {
  from_name: string
  from_email: string
  signature_html: string
  reply_to: string
}

interface Props {
  destinataires: Destinataire[]
  onClose: () => void
  onSent?: (resultats: { envoyes: number; echoues: number }) => void
}

export default function ModalComposeCourriel({ destinataires, onClose, onSent }: Props) {
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ envoyes: number; echoues: number } | null>(null)
  const [config, setConfig] = useState<AdminEmailConfig | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)

  // Charger la config email de l'admin
  useEffect(() => {
    fetch('/api/admin/courriels/config')
      .then(r => r.json())
      .then(json => { if (json.config) setConfig(json.config) })
      .catch(() => {})
  }, [])

  const envoyer = async () => {
    if (!subject.trim()) { setError('L\'objet est requis'); return }
    if (!bodyHtml.trim()) { setError('Le contenu est requis'); return }

    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/courriels/envoyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinataires,
          subject,
          body_html: bodyHtml.replace(/\n/g, '<br/>'),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Erreur lors de l\'envoi'); setSending(false); return }

      setSuccess({ envoyes: json.envoyes, echoues: json.echoues })
      onSent?.({ envoyes: json.envoyes, echoues: json.echoues })
    } catch (err: any) {
      setError(err.message)
    }
    setSending(false)
  }

  const sauvegarderConfig = async () => {
    if (!config) return
    setConfigSaving(true)
    try {
      await fetch('/api/admin/courriels/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
    } catch {}
    setConfigSaving(false)
    setShowConfig(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget && !sending) onClose() }}
    >
      <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: showConfig ? '520px' : '640px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* En-tête */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>✉️</span>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: C }}>
              {showConfig ? 'Configuration courriel' : 'Nouveau courriel'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!showConfig && !success && (
              <button
                onClick={() => setShowConfig(true)}
                style={{ background: 'none', border: 'none', fontSize: '13px', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ⚙️ Signature
              </button>
            )}
            <button
              onClick={onClose}
              disabled={sending}
              style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* === Panel config signature === */}
          {showConfig && config && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Nom d'affichage</label>
                <input
                  type="text"
                  value={config.from_name}
                  onChange={e => setConfig({ ...config, from_name: e.target.value })}
                  placeholder="Dany Chaput - RIUSC"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Adresse d'envoi</label>
                <input
                  type="email"
                  value={config.from_email}
                  onChange={e => setConfig({ ...config, from_email: e.target.value })}
                  placeholder="noreply@aqbrs.ca"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Adresse reply-to</label>
                <input
                  type="email"
                  value={config.reply_to || ''}
                  onChange={e => setConfig({ ...config, reply_to: e.target.value })}
                  placeholder="dany.chaput@aqbrs.ca"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Par défaut, les réponses arrivent à votre adresse. Changez pour noreply@aqbrs.ca si vous ne souhaitez pas recevoir de réponses.
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Signature HTML</label>
                <textarea
                  value={config.signature_html}
                  onChange={e => setConfig({ ...config, signature_html: e.target.value })}
                  placeholder="<b>Dany Chaput</b><br/>Coordonnateur RIUSC<br/>dany.chaput@aqbrs.ca"
                  rows={4}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
              {config.signature_html && (
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>Aperçu :</div>
                  <div style={{ fontSize: '13px', color: '#374151' }} dangerouslySetInnerHTML={{ __html: config.signature_html }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => setShowConfig(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Retour
                </button>
                <button
                  onClick={sauvegarderConfig}
                  disabled={configSaving}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: C, color: 'white', fontSize: '13px', fontWeight: '600', cursor: configSaving ? 'not-allowed' : 'pointer', opacity: configSaving ? 0.7 : 1 }}
                >
                  {configSaving ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          )}

          {/* === Panel composition === */}
          {!showConfig && !success && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Destinataires */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Destinataire{destinataires.length > 1 ? 's' : ''} ({destinataires.length})
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '80px', overflowY: 'auto', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {destinataires.slice(0, 20).map(d => (
                    <span key={d.benevole_id} style={{ padding: '3px 10px', borderRadius: '12px', backgroundColor: '#e0e7ff', color: '#3730a3', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                      {d.prenom} {d.nom}
                    </span>
                  ))}
                  {destinataires.length > 20 && (
                    <span style={{ padding: '3px 10px', fontSize: '12px', color: '#6b7280' }}>
                      +{destinataires.length - 20} autres
                    </span>
                  )}
                </div>
              </div>

              {/* Expéditeur */}
              {config && (
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  De : <strong>{config.from_name || 'RIUSC'}</strong> &lt;{config.from_email || 'noreply@aqbrs.ca'}&gt;
                </div>
              )}

              {/* Objet */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Objet</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Objet du courriel"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>

              {/* Contenu */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Message</label>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Variables : {'{{ prenom }}'} {'{{ nom }}'}
                  </span>
                </div>
                <textarea
                  value={bodyHtml}
                  onChange={e => setBodyHtml(e.target.value)}
                  placeholder="Bonjour {{ prenom }},&#10;&#10;Votre message ici..."
                  rows={8}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.5' }}
                />
              </div>

              {/* Erreur */}
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '13px' }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* === Panel succès === */}
          {success && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: '700', color: C }}>
                Courriel{success.envoyes > 1 ? 's' : ''} envoyé{success.envoyes > 1 ? 's' : ''}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                {success.envoyes} envoi{success.envoyes > 1 ? 's' : ''} réussi{success.envoyes > 1 ? 's' : ''}
                {success.echoues > 0 && (
                  <span style={{ color: '#dc2626' }}>, {success.echoues} échoué{success.echoues > 1 ? 's' : ''}</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Pied de page */}
        {!showConfig && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            {success ? (
              <button
                onClick={onClose}
                style={{ padding: '9px 24px', borderRadius: '8px', border: 'none', backgroundColor: C, color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Fermer
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  disabled={sending}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  onClick={envoyer}
                  disabled={sending || !subject.trim() || !bodyHtml.trim()}
                  style={{
                    padding: '9px 24px', borderRadius: '8px', border: 'none',
                    backgroundColor: C, color: 'white', fontSize: '14px', fontWeight: '600',
                    cursor: (sending || !subject.trim() || !bodyHtml.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (sending || !subject.trim() || !bodyHtml.trim()) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {sending ? '⏳ Envoi en cours…' : `📨 Envoyer${destinataires.length > 1 ? ` (${destinataires.length})` : ''}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
