'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

const C = '#1e3a5f'

// Couleurs prédéfinies pour les pastilles de vues
const COULEURS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6']

export interface VueFiltres {
  recherche: string
  groupes: string[]
  sortKey: string
  sortDir: string
  filtreBottes: boolean
  filtreOrganisme: string
  filtreGroupeRS: string
  filtresReadiness: Record<string, string | null>
  filtreDeployable: string | null
  filtreCertifsManquants?: boolean
  filtreCertifsEnAttente?: boolean
}

export interface Vue {
  id: string
  user_id: string
  nom: string
  description: string | null
  filtres: VueFiltres
  partage: boolean
  position: number
  couleur: string | null
  created_at: string
  updated_at: string
  own: boolean
}

interface Props {
  currentFilters: VueFiltres
  onLoadView: (filtres: VueFiltres) => void
}

export default function SavedViewsBar({ currentFilters, onLoadView }: Props) {
  const [vues, setVues] = useState<Vue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeVueId, setActiveVueId] = useState<string | null>(null)

  // Modals
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveNom, setSaveNom] = useState('')
  const [savePartage, setSavePartage] = useState(false)
  const [saveCouleur, setSaveCouleur] = useState(COULEURS[0])
  const [saving, setSaving] = useState(false)

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNom, setEditNom] = useState('')

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; vue: Vue } | null>(null)

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Fetch vues
  const fetchVues = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/vues-reservistes')
      const json = await res.json()
      setVues(json.vues || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchVues() }, [fetchVues])

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // Save new view
  const handleSave = async () => {
    if (!saveNom.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/vues-reservistes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: saveNom,
          filtres: currentFilters,
          partage: savePartage,
          couleur: saveCouleur,
        }),
      })
      const json = await res.json()
      if (json.vue) {
        setVues(prev => [...prev, { ...json.vue, own: true }])
        setActiveVueId(json.vue.id)
      }
    } catch {}
    setSaving(false)
    setShowSaveModal(false)
    setSaveNom('')
    setSavePartage(false)
  }

  // Load view
  const handleLoad = (vue: Vue) => {
    setActiveVueId(vue.id)
    onLoadView(vue.filtres)
  }

  // Update view filters with current
  const handleUpdate = async (vue: Vue) => {
    try {
      await fetch('/api/admin/vues-reservistes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vue.id, filtres: currentFilters }),
      })
      setVues(prev => prev.map(v => v.id === vue.id ? { ...v, filtres: currentFilters } : v))
    } catch {}
    setContextMenu(null)
  }

  // Rename
  const handleRename = async (id: string) => {
    if (!editNom.trim()) { setEditingId(null); return }
    try {
      await fetch('/api/admin/vues-reservistes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nom: editNom }),
      })
      setVues(prev => prev.map(v => v.id === id ? { ...v, nom: editNom.trim() } : v))
    } catch {}
    setEditingId(null)
  }

  // Toggle share
  const handleTogglePartage = async (vue: Vue) => {
    try {
      await fetch('/api/admin/vues-reservistes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vue.id, partage: !vue.partage }),
      })
      setVues(prev => prev.map(v => v.id === vue.id ? { ...v, partage: !v.partage } : v))
    } catch {}
    setContextMenu(null)
  }

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette vue ?')) return
    try {
      await fetch('/api/admin/vues-reservistes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setVues(prev => prev.filter(v => v.id !== id))
      if (activeVueId === id) setActiveVueId(null)
    } catch {}
    setContextMenu(null)
  }

  // Drag & drop
  const handleDragEnd = async () => {
    if (!dragId || !dragOverId || dragId === dragOverId) {
      setDragId(null); setDragOverId(null); return
    }
    const myVues = vues.filter(v => v.own)
    const sharedVues = vues.filter(v => !v.own)
    const fromIdx = myVues.findIndex(v => v.id === dragId)
    const toIdx = myVues.findIndex(v => v.id === dragOverId)
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); setDragOverId(null); return }

    const reordered = [...myVues]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    const positions = reordered.map((v, i) => ({ id: v.id, position: i }))
    const updated = reordered.map((v, i) => ({ ...v, position: i }))
    setVues([...updated, ...sharedVues])

    try {
      await fetch('/api/admin/vues-reservistes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
      })
    } catch {}

    setDragId(null)
    setDragOverId(null)
  }

  if (loading) return null

  const myVues = vues.filter(v => v.own).sort((a, b) => a.position - b.position)
  const sharedVues = vues.filter(v => !v.own)

  return (
    <div style={{ marginBottom: '12px' }}>
      {/* Barre de vues */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        padding: '6px 0',
      }}>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '4px' }}>
          Vues
        </span>

        {/* Mes vues */}
        {myVues.map(vue => (
          <button
            key={vue.id}
            draggable
            onDragStart={() => setDragId(vue.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(vue.id) }}
            onDragEnd={handleDragEnd}
            onClick={() => handleLoad(vue)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, vue }) }}
            onDoubleClick={() => { setEditingId(vue.id); setEditNom(vue.nom) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '4px 12px', fontSize: '12px', fontWeight: activeVueId === vue.id ? '700' : '500',
              borderRadius: '16px', cursor: 'pointer',
              border: activeVueId === vue.id ? `2px solid ${vue.couleur || C}` : '1px solid #e2e8f0',
              backgroundColor: activeVueId === vue.id ? `${vue.couleur || C}15` : 'white',
              color: activeVueId === vue.id ? (vue.couleur || C) : '#374151',
              transition: 'all 0.15s',
              opacity: dragId === vue.id ? 0.5 : dragOverId === vue.id ? 0.7 : 1,
              transform: dragOverId === vue.id ? 'scale(1.05)' : 'none',
            }}
          >
            {vue.couleur && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: vue.couleur, flexShrink: 0 }} />
            )}
            {editingId === vue.id ? (
              <input
                autoFocus
                value={editNom}
                onChange={e => setEditNom(e.target.value)}
                onBlur={() => handleRename(vue.id)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(vue.id); if (e.key === 'Escape') setEditingId(null) }}
                onClick={e => e.stopPropagation()}
                style={{ border: 'none', outline: 'none', fontSize: '12px', fontWeight: '600', width: `${Math.max(editNom.length, 3) * 8}px`, backgroundColor: 'transparent', color: 'inherit' }}
              />
            ) : (
              <span>{vue.nom}</span>
            )}
            {vue.partage && <span title="Vue partagée" style={{ fontSize: '10px' }}>👥</span>}
          </button>
        ))}

        {/* Vues partagées par d'autres */}
        {sharedVues.map(vue => (
          <button
            key={vue.id}
            onClick={() => handleLoad(vue)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '4px 12px', fontSize: '12px', fontWeight: activeVueId === vue.id ? '700' : '400',
              borderRadius: '16px', cursor: 'pointer',
              border: activeVueId === vue.id ? `2px solid ${vue.couleur || '#6b7280'}` : '1px dashed #d1d5db',
              backgroundColor: activeVueId === vue.id ? '#f9fafb' : 'transparent',
              color: '#6b7280',
              transition: 'all 0.15s',
            }}
            title="Vue partagée par un collègue"
          >
            {vue.couleur && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: vue.couleur, flexShrink: 0, opacity: 0.6 }} />
            )}
            <span>{vue.nom}</span>
            <span style={{ fontSize: '10px' }}>👥</span>
          </button>
        ))}

        {/* Bouton + Sauvegarder vue */}
        <button
          onClick={() => { setShowSaveModal(true); setSaveCouleur(COULEURS[myVues.length % COULEURS.length]) }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', fontSize: '12px', fontWeight: '500',
            borderRadius: '16px', cursor: 'pointer',
            border: '1px dashed #94a3b8', backgroundColor: 'transparent',
            color: '#6b7280', transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = C; e.currentTarget.style.color = C }}
          onMouseOut={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#6b7280' }}
          title="Sauvegarder les filtres actuels comme vue"
        >
          + Sauvegarder vue
        </button>

        {/* Bouton réinitialiser si une vue est active */}
        {activeVueId && (
          <button
            onClick={() => setActiveVueId(null)}
            style={{
              padding: '4px 8px', fontSize: '11px', color: '#ef4444',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
            title="Désélectionner la vue active"
          >
            ✕
          </button>
        )}
      </div>

      {/* Astuce si pas de vues */}
      {vues.length === 0 && !loading && (
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', fontStyle: 'italic' }}>
          Appliquez vos filtres puis cliquez « + Sauvegarder vue » pour les retrouver rapidement. Clic droit sur une vue pour la modifier.
        </div>
      )}

      {/* Modal sauvegarder */}
      {showSaveModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={() => setShowSaveModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'white', borderRadius: '12px', padding: '24px',
              width: '380px', maxWidth: '90vw', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: C }}>
              Sauvegarder la vue actuelle
            </h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Nom</label>
              <input
                autoFocus
                value={saveNom}
                onChange={e => setSaveNom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && saveNom.trim()) handleSave() }}
                placeholder="Ex: Approuvés sans antécédents"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Couleur</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {COULEURS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSaveCouleur(c)}
                    style={{
                      width: '24px', height: '24px', borderRadius: '50%', border: saveCouleur === c ? '3px solid #1f2937' : '2px solid #e2e8f0',
                      backgroundColor: c, cursor: 'pointer', padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                <input type="checkbox" checked={savePartage} onChange={e => setSavePartage(e.target.checked)} />
                Partager avec les autres admins/coordonnateurs
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', color: '#374151', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!saveNom.trim() || saving}
                style={{
                  padding: '8px 16px', fontSize: '13px', fontWeight: '600',
                  border: 'none', borderRadius: '8px', cursor: saving ? 'wait' : 'pointer',
                  backgroundColor: saveNom.trim() ? C : '#94a3b8', color: 'white',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? '⏳' : '💾'} Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu contextuel */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            backgroundColor: 'white', borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0',
            padding: '4px 0', zIndex: 1001, minWidth: '180px',
          }}
        >
          {contextMenu.vue.own && (
            <>
              <button onClick={() => handleUpdate(contextMenu.vue)} style={menuItemStyle}>
                🔄 Mettre à jour les filtres
              </button>
              <button onClick={() => { setEditingId(contextMenu.vue.id); setEditNom(contextMenu.vue.nom); setContextMenu(null) }} style={menuItemStyle}>
                ✏️ Renommer
              </button>
              <button onClick={() => handleTogglePartage(contextMenu.vue)} style={menuItemStyle}>
                {contextMenu.vue.partage ? '🔒 Rendre privée' : '👥 Partager'}
              </button>
              <div style={{ borderTop: '1px solid #f3f4f6', margin: '4px 0' }} />
              <button onClick={() => handleDelete(contextMenu.vue.id)} style={{ ...menuItemStyle, color: '#dc2626' }}>
                🗑️ Supprimer
              </button>
            </>
          )}
          {!contextMenu.vue.own && (
            <div style={{ padding: '8px 14px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
              Vue partagée (lecture seule)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 14px', fontSize: '13px', color: '#374151',
  border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
}
