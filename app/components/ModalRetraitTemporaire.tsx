'use client'

// Modale de confirmation pour mettre un reserviste en Retrait temporaire
// ou pour le reactiver. Exige une raison >= 10 caracteres et journalise
// l'evenement dans retraits_temporaires (table immuable, loi 25).

import { useState } from 'react'

type Mode = 'retrait' | 'reactivation'

interface Props {
  mode: Mode
  prenom: string
  nom: string
  benevole_id: string
  /** Groupe de destination apres reactivation (par defaut Interet). Ignore en mode retrait. */
  groupeReactivation?: string
  onClose: () => void
  onConfirmed: (nouveauGroupe: string) => void
}

export default function ModalRetraitTemporaire({
  mode,
  prenom,
  nom,
  benevole_id,
  groupeReactivation = 'Intérêt',
  onClose,
  onConfirmed,
}: Props) {
  const [raison, setRaison] = useState('')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const nomComplet = `${prenom} ${nom}`.trim()
  const raisonValide = raison.trim().length >= 10
  const peutConfirmer = raisonValide && !loading

  const groupeCible = mode === 'retrait' ? 'Retrait temporaire' : groupeReactivation
  const titre = mode === 'retrait'
    ? `Mettre ${nomComplet} en retrait temporaire`
    : `Réactiver ${nomComplet}`
  const couleur = mode === 'retrait' ? '#d97706' : '#16a34a'
  const couleurClaire = mode === 'retrait' ? '#fffbeb' : '#f0fdf4'
  const icone = mode === 'retrait' ? '⏸️' : '▶️'
  const ctaLabel = mode === 'retrait' ? 'Confirmer le retrait' : 'Confirmer la réactivation'
  const placeholder = mode === 'retrait'
    ? 'Ex: Demande personnelle pour raisons de santé, valide jusqu\'à nouvel ordre'
    : 'Ex: Réserviste contacté le 14 avril, retour disponible immédiatement'

  async function handleConfirmer() {
    if (!peutConfirmer) return
    setLoading(true)
    setErreur(null)
    try {
      const res = await fetch('/api/admin/reservistes/groupe', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id,
          groupe: groupeCible,
          raison: raison.trim(),
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        setErreur(result.error || 'Echec de l\'operation')
        setLoading(false)
        return
      }
      // Le groupe a ete change mais la journalisation a echoue : alerter au lieu de fermer silencieusement
      if (result.warning) {
        setErreur(`Attention : ${result.warning}. Le journal n'a PAS ete mis a jour - merci de signaler ce probleme.`)
        setLoading(false)
        return
      }
      onConfirmed(groupeCible)
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
          <span style={{ fontSize: '24px' }}>{icone}</span>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: couleur }}>
            {titre}
          </h2>
        </div>

        <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 16px' }}>
          {mode === 'retrait' ? (
            <>Le réserviste passera au groupe <strong>Retrait temporaire</strong>. Cette action est réversible. Une trace
            (raison, qui et quand) sera conservée dans le journal des retraits.</>
          ) : (
            <>Le réserviste sortira du <strong>Retrait temporaire</strong> et passera au groupe <strong>{groupeReactivation}</strong>.
            Une trace (raison, qui et quand) sera conservée dans le journal des retraits.</>
          )}
        </p>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            {mode === 'retrait' ? 'Raison du retrait' : 'Raison de la réactivation'} (obligatoire, min. 10 caractères)
          </label>
          <textarea
            value={raison}
            onChange={e => setRaison(e.target.value)}
            placeholder={placeholder}
            rows={3}
            autoFocus
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
              fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', resize: 'vertical',
            }}
          />
          <div style={{ fontSize: '11px', color: raisonValide ? '#16a34a' : '#9ca3af', marginTop: '3px' }}>
            {raison.trim().length} / 10 caractères minimum
          </div>
        </div>

        <div style={{ backgroundColor: couleurClaire, padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: '#374151', marginBottom: '14px' }}>
          📅 Date enregistrée automatiquement : <strong>{new Date().toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })}</strong>
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
            onClick={handleConfirmer}
            disabled={!peutConfirmer}
            style={{
              padding: '8px 14px', borderRadius: '6px', border: `1px solid ${couleur}`,
              backgroundColor: peutConfirmer ? couleur : '#fcd9a4', color: 'white',
              fontSize: '13px', fontWeight: 600, cursor: peutConfirmer ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Enregistrement…' : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
