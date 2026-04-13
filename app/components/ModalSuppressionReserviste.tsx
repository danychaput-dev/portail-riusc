'use client'

// Modal de confirmation de suppression d'un reserviste.
// Exige: raison (>= 10 caracteres) et confirmation du nom exact.
// Aligne avec la loi 25: journal minimal cote serveur.

import { useState } from 'react'

interface Props {
  prenom: string
  nom: string
  benevole_id: string
  onClose: () => void
  onDeleted: () => void
}

export default function ModalSuppressionReserviste({ prenom, nom, benevole_id, onClose, onDeleted }: Props) {
  const [raison, setRaison] = useState('')
  const [demandeParReserviste, setDemandeParReserviste] = useState(false)
  const [confirmationNom, setConfirmationNom] = useState('')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const nomComplet = `${prenom} ${nom}`.trim()
  const raisonValide = raison.trim().length >= 10
  const nomConfirme = confirmationNom.trim().toLowerCase() === nomComplet.toLowerCase()
  const peutSupprimer = raisonValide && nomConfirme && !loading

  async function handleSupprimer() {
    if (!peutSupprimer) return
    setLoading(true)
    setErreur(null)
    try {
      const res = await fetch('/api/admin/reservistes/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id,
          raison: raison.trim(),
          demande_par_reserviste: demandeParReserviste,
          confirmation_nom: confirmationNom.trim(),
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        setErreur(result.error || 'Echec de la suppression')
        setLoading(false)
        return
      }
      onDeleted()
    } catch (e: any) {
      setErreur(e.message || 'Erreur reseau')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'white', borderRadius: '12px', padding: '24px',
          maxWidth: '500px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#dc2626' }}>
            Supprimer le compte de {nomComplet}
          </h2>
        </div>

        <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 16px' }}>
          Cette action est <strong>irreversible</strong>. Toutes les donnees liees (formations, disponibilites,
          ciblages, dossier) seront effacees. Une trace minimale (nom, raison, qui et quand) sera conservee
          dans le journal de suppressions conformement a la loi 25.
        </p>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Raison de la suppression (obligatoire, min. 10 caracteres)
          </label>
          <textarea
            value={raison}
            onChange={e => setRaison(e.target.value)}
            placeholder="Ex: Demande de retrait du reserviste le 13 avril 2026"
            rows={3}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
              fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', resize: 'vertical',
            }}
          />
          <div style={{ fontSize: '11px', color: raisonValide ? '#16a34a' : '#9ca3af', marginTop: '3px' }}>
            {raison.trim().length} / 10 caracteres minimum
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', marginBottom: '14px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={demandeParReserviste}
            onChange={e => setDemandeParReserviste(e.target.checked)}
          />
          Le reserviste lui-meme a demande ce retrait
        </label>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Pour confirmer, tapez le nom exact: <code style={{ backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '4px' }}>{nomComplet}</code>
          </label>
          <input
            type="text"
            value={confirmationNom}
            onChange={e => setConfirmationNom(e.target.value)}
            placeholder={nomComplet}
            style={{
              width: '100%', padding: '8px 10px', border: `1px solid ${nomConfirme ? '#16a34a' : '#d1d5db'}`,
              borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>

        {erreur && (
          <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
            {erreur}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db',
              backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSupprimer}
            disabled={!peutSupprimer}
            style={{
              padding: '8px 14px', borderRadius: '6px', border: '1px solid #dc2626',
              backgroundColor: peutSupprimer ? '#dc2626' : '#fca5a5', color: 'white',
              fontSize: '13px', fontWeight: 600, cursor: peutSupprimer ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Suppression...' : 'Supprimer definitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}
