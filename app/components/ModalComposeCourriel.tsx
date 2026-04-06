'use client'

import { useState, useEffect, useRef } from 'react'

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

interface BrouillonPJ {
  filename: string
  storage_path: string
  size: number
}

interface Brouillon {
  id: string
  subject: string
  body_html: string
  destinataires: Destinataire[]
  pieces_jointes?: BrouillonPJ[]
  updated_at: string
}

interface Template {
  id: string
  user_id: string
  nom: string
  subject: string
  body_html: string
  partage: boolean
  updated_at: string
}

interface PieceJointe {
  file: File | null  // null when restored from brouillon
  filename: string
  base64: string
  size: number
}

interface Props {
  destinataires: Destinataire[]
  onClose: () => void
  onSent?: (resultats: { envoyes: number; echoues: number }) => void
  initialSubject?: string
}

type Panel = 'compose' | 'config' | 'brouillons' | 'templates' | 'save_template'

export default function ModalComposeCourriel({ destinataires, onClose, onSent, initialSubject }: Props) {
  const [subject, setSubject] = useState(initialSubject || '')
  const [bodyHtml, setBodyHtml] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ envoyes: number; echoues: number } | null>(null)
  const [config, setConfig] = useState<AdminEmailConfig | null>(null)
  const [panel, setPanel] = useState<Panel>('compose')
  const [configSaving, setConfigSaving] = useState(false)

  // Brouillons
  const [brouillons, setBrouillons] = useState<Brouillon[]>([])
  const [brouillonId, setBrouillonId] = useState<string | null>(null)
  const [savingBrouillon, setSavingBrouillon] = useState(false)

  // Templates
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateNom, setTemplateNom] = useState('')
  const [templatePartage, setTemplatePartage] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)

  // Pièces jointes
  const [attachments, setAttachments] = useState<PieceJointe[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Charger config
  useEffect(() => {
    fetch('/api/admin/courriels/config')
      .then(r => r.json())
      .then(json => { if (json.config) setConfig(json.config) })
      .catch(() => {})
  }, [])

  const loadBrouillons = async () => {
    const res = await fetch('/api/admin/courriels/brouillons')
    const json = await res.json()
    setBrouillons(json.brouillons || [])
  }

  const loadTemplates = async () => {
    const res = await fetch('/api/admin/courriels/templates')
    const json = await res.json()
    setTemplates(json.templates || [])
  }

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
          attachments: attachments.map(a => ({
            filename: a.filename,
            content: a.base64,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Erreur lors de l\'envoi'); setSending(false); return }

      if (brouillonId) {
        fetch(`/api/admin/courriels/brouillons?id=${brouillonId}`, { method: 'DELETE' }).catch(() => {})
      }

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
    setPanel('compose')
  }

  const sauvegarderBrouillon = async () => {
    setSavingBrouillon(true)
    try {
      const res = await fetch('/api/admin/courriels/brouillons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: brouillonId || undefined,
          subject, body_html: bodyHtml,
          destinataires,
          attachments: attachments.map(a => ({ filename: a.filename, base64: a.base64, size: a.size })),
        }),
      })
      const json = await res.json()
      if (json.ok) setBrouillonId(json.brouillon.id)
    } catch {}
    setSavingBrouillon(false)
  }

  const chargerBrouillon = async (b: Brouillon) => {
    setSubject(b.subject || '')
    setBodyHtml(b.body_html || '')
    setBrouillonId(b.id)
    setAttachments([])
    setPanel('compose')
    // Charger les fichiers si le brouillon en a
    if (b.pieces_jointes && b.pieces_jointes.length > 0) {
      try {
        const res = await fetch(`/api/admin/courriels/brouillons?id=${b.id}`)
        const json = await res.json()
        if (json.fichiers && json.fichiers.length > 0) {
          setAttachments(json.fichiers.map((f: { filename: string; base64: string; size: number }) => ({
            file: null,
            filename: f.filename,
            base64: f.base64,
            size: f.size,
          })))
        }
      } catch {}
    }
  }

  const supprimerBrouillon = async (id: string) => {
    await fetch(`/api/admin/courriels/brouillons?id=${id}`, { method: 'DELETE' })
    setBrouillons(prev => prev.filter(b => b.id !== id))
    if (brouillonId === id) setBrouillonId(null)
  }

  const chargerTemplate = (t: Template) => {
    setSubject(t.subject || '')
    setBodyHtml(t.body_html || '')
    setEditingTemplateId(t.id)
    setTemplateNom(t.nom)
    setTemplatePartage(t.partage)
    setPanel('compose')
  }

  const ouvrirSaveTemplate = () => {
    if (!editingTemplateId) {
      setTemplateNom('')
      setTemplatePartage(false)
    }
    setPanel('save_template')
  }

  const sauvegarderTemplate = async () => {
    if (!templateNom.trim()) return
    setSavingTemplate(true)
    try {
      if (editingTemplateId) {
        // Mise à jour du template existant
        await fetch('/api/admin/courriels/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTemplateId,
            nom: templateNom,
            subject,
            body_html: bodyHtml,
            partage: templatePartage,
          }),
        })
      } else {
        // Nouveau template
        const res = await fetch('/api/admin/courriels/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nom: templateNom,
            subject,
            body_html: bodyHtml,
            partage: templatePartage,
          }),
        })
        const json = await res.json()
        if (json.ok) setEditingTemplateId(json.template.id)
      }
      setPanel('compose')
    } catch {}
    setSavingTemplate(false)
  }

  const sauvegarderCommeNouveauTemplate = async () => {
    setEditingTemplateId(null)
    setTemplateNom('')
    setTemplatePartage(false)
    setPanel('save_template')
  }

  const supprimerTemplate = async (id: string) => {
    await fetch(`/api/admin/courriels/templates?id=${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (editingTemplateId === id) setEditingTemplateId(null)
  }

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`Le fichier "${file.name}" dépasse 10 Mo`)
        continue
      }
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] || '')
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setAttachments(prev => [...prev, { file, filename: file.name, base64, size: file.size }])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / 1048576).toFixed(1)} Mo`
  }

  const panelTitle: Record<Panel, string> = {
    compose: editingTemplateId ? `Nouveau courriel (template: ${templateNom})` : 'Nouveau courriel',
    config: 'Configuration courriel',
    brouillons: 'Mes brouillons',
    templates: 'Templates',
    save_template: editingTemplateId ? 'Mettre à jour le template' : 'Sauvegarder comme template',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget && !sending) onClose() }}
    >
      <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '660px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* En-tête */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>✉️</span>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: C, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {panelTitle[panel]}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {panel === 'compose' && !success && (
              <>
                <button onClick={() => { loadBrouillons(); setPanel('brouillons') }} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>📄 Brouillons</button>
                <button onClick={() => { loadTemplates(); setPanel('templates') }} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>📋 Templates</button>
                <button onClick={() => setPanel('config')} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>⚙️ Signature</button>
              </>
            )}
            <button onClick={onClose} disabled={sending} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af', lineHeight: 1, marginLeft: '8px' }}>×</button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>

          {/* === Panel config === */}
          {panel === 'config' && config && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Nom d&apos;affichage</label>
                <input type="text" value={config.from_name} onChange={e => setConfig({ ...config, from_name: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Adresse d&apos;envoi</label>
                <input type="email" value={config.from_email} onChange={e => setConfig({ ...config, from_email: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Reply-to</label>
                <input type="email" value={config.reply_to || ''} onChange={e => setConfig({ ...config, reply_to: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Par défaut, les réponses arrivent à votre adresse. Changez pour noreply@aqbrs.ca si vous ne souhaitez pas recevoir de réponses.</div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Signature HTML</label>
                <textarea value={config.signature_html} onChange={e => setConfig({ ...config, signature_html: e.target.value })} rows={4} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              {config.signature_html && (
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>Aperçu :</div>
                  <div style={{ fontSize: '13px', color: '#374151' }} dangerouslySetInnerHTML={{ __html: config.signature_html }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setPanel('compose')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Retour</button>
                <button onClick={sauvegarderConfig} disabled={configSaving} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: C, color: 'white', fontSize: '13px', fontWeight: '600', cursor: configSaving ? 'not-allowed' : 'pointer', opacity: configSaving ? 0.7 : 1 }}>{configSaving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
              </div>
            </div>
          )}

          {/* === Panel brouillons === */}
          {panel === 'brouillons' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {brouillons.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Aucun brouillon sauvegardé</div>
              ) : brouillons.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fafafa' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => chargerBrouillon(b)}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>{b.subject || '(sans objet)'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {new Date(b.updated_at).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {b.pieces_jointes && b.pieces_jointes.length > 0 && ` · 📎 ${b.pieces_jointes.length}`}
                    </div>
                  </div>
                  <button onClick={() => supprimerBrouillon(b.id)} title="Supprimer" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', padding: '4px' }}>🗑️</button>
                </div>
              ))}
              <button onClick={() => setPanel('compose')} style={{ marginTop: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-start' }}>← Retour</button>
            </div>
          )}

          {/* === Panel templates === */}
          {panel === 'templates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {templates.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Aucun template disponible</div>
              ) : templates.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fafafa' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => chargerTemplate(t)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>{t.nom}</span>
                      {t.partage && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: '600' }}>Partagé</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{t.subject || '(sans objet)'}</div>
                  </div>
                  <button onClick={() => supprimerTemplate(t.id)} title="Supprimer" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', padding: '4px' }}>🗑️</button>
                </div>
              ))}
              <button onClick={() => setPanel('compose')} style={{ marginTop: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-start' }}>← Retour</button>
            </div>
          )}

          {/* === Panel save template === */}
          {panel === 'save_template' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Nom du template</label>
                <input type="text" value={templateNom} onChange={e => setTemplateNom(e.target.value)} placeholder="Ex: Notification cahier participant" style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} autoFocus />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={templatePartage} onChange={e => setTemplatePartage(e.target.checked)} style={{ width: 16, height: 16, accentColor: C }} />
                Partager avec les autres admins/coordonnateurs
              </label>
              <div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                Objet : <strong>{subject || '(vide)'}</strong>
              </div>
              {editingTemplateId && (
                <div style={{ fontSize: '12px', color: '#2563eb', padding: '6px 10px', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
                  ✏️ Mise à jour du template existant
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setPanel('compose')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Annuler</button>
                {editingTemplateId && (
                  <button onClick={sauvegarderCommeNouveauTemplate} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    + Nouveau
                  </button>
                )}
                <button onClick={sauvegarderTemplate} disabled={savingTemplate || !templateNom.trim()} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: C, color: 'white', fontSize: '13px', fontWeight: '600', cursor: (savingTemplate || !templateNom.trim()) ? 'not-allowed' : 'pointer', opacity: (savingTemplate || !templateNom.trim()) ? 0.6 : 1 }}>
                  {savingTemplate ? 'Sauvegarde…' : editingTemplateId ? 'Mettre à jour' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          )}

          {/* === Panel composition === */}
          {panel === 'compose' && !success && (
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
                  {destinataires.length > 20 && <span style={{ padding: '3px 10px', fontSize: '12px', color: '#6b7280' }}>+{destinataires.length - 20} autres</span>}
                </div>
              </div>

              {config && (
                <div style={{ fontSize: '12px', color: '#6b7280' }}>De : <strong>{config.from_name || 'RIUSC'}</strong> &lt;{config.from_email || 'noreply@aqbrs.ca'}&gt;</div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Objet</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet du courriel" style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} autoFocus />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Message</label>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Variables : {'{{ prenom }}'} {'{{ nom }}'}</span>
                </div>
                <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)} placeholder="Bonjour {{ prenom }},&#10;&#10;Votre message ici..." rows={8} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.5' }} />
              </div>

              {/* Pièces jointes */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <button onClick={() => fileInputRef.current?.click()} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#64748b', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📎 Joindre un fichier
                  </button>
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileAttach} style={{ display: 'none' }} />
                  {attachments.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {attachments.length} fichier{attachments.length > 1 ? 's' : ''} ({formatFileSize(attachments.reduce((sum, a) => sum + a.size, 0))})
                    </span>
                  )}
                </div>
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {attachments.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                        📎 {a.filename} <span style={{ color: '#94a3b8' }}>({formatFileSize(a.size)})</span>
                        <button onClick={() => removeAttachment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '13px' }}>{error}</div>
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
                {success.echoues > 0 && <span style={{ color: '#dc2626' }}>, {success.echoues} échoué{success.echoues > 1 ? 's' : ''}</span>}
              </p>
            </div>
          )}
        </div>

        {/* Pied de page */}
        {panel === 'compose' && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            {success ? (
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={onClose} style={{ padding: '9px 24px', borderRadius: '8px', border: 'none', backgroundColor: C, color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Fermer</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={sauvegarderBrouillon} disabled={savingBrouillon || (!subject.trim() && !bodyHtml.trim())} title="Sauvegarder en brouillon" style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: (savingBrouillon || (!subject.trim() && !bodyHtml.trim())) ? 'not-allowed' : 'pointer', opacity: (!subject.trim() && !bodyHtml.trim()) ? 0.4 : 1 }}>
                    {savingBrouillon ? '💾 …' : '💾 Brouillon'}
                  </button>
                  <button onClick={ouvrirSaveTemplate} disabled={!subject.trim() && !bodyHtml.trim()} title={editingTemplateId ? 'Mettre à jour le template' : 'Sauvegarder comme template'} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: (!subject.trim() && !bodyHtml.trim()) ? 'not-allowed' : 'pointer', opacity: (!subject.trim() && !bodyHtml.trim()) ? 0.4 : 1 }}>
                    {editingTemplateId ? '📋 Maj template' : '📋 Template'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={onClose} disabled={sending} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Annuler</button>
                  <button onClick={envoyer} disabled={sending || !subject.trim() || !bodyHtml.trim()} style={{ padding: '9px 24px', borderRadius: '8px', border: 'none', backgroundColor: C, color: 'white', fontSize: '14px', fontWeight: '600', cursor: (sending || !subject.trim() || !bodyHtml.trim()) ? 'not-allowed' : 'pointer', opacity: (sending || !subject.trim() || !bodyHtml.trim()) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {sending ? '⏳ Envoi en cours…' : `📨 Envoyer${destinataires.length > 1 ? ` (${destinataires.length})` : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
