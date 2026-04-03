'use client'

import React from 'react'

// ─── Couleurs par catégorie ─────────────────────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; color: string; border?: string }> = {
  // Groupes
  'Approuvé':     { bg: '#dcfce7', color: '#166534' },
  'Intérêt':      { bg: '#dbeafe', color: '#1e40af' },

  // Statuts réserviste
  'Actif':        { bg: '#dcfce7', color: '#166534' },
  'Inactif':      { bg: '#f3f4f6', color: '#6b7280' },
  'Suspendu':     { bg: '#fee2e2', color: '#991b1b' },

  // Antécédents
  'verifie':      { bg: '#dcfce7', color: '#166534' },
  'en_attente':   { bg: '#fef3c7', color: '#92400e' },
  'refuse':       { bg: '#fee2e2', color: '#991b1b' },

  // Statuts déploiement/opération
  'actif':        { bg: '#dbeafe', color: '#1e40af' },
  'termine':      { bg: '#f3f4f6', color: '#6b7280' },
  'annule':       { bg: '#fee2e2', color: '#991b1b' },
  'planifie':     { bg: '#fef3c7', color: '#92400e' },
  'en_cours':     { bg: '#dbeafe', color: '#1e40af' },
  'brouillon':    { bg: '#f3f4f6', color: '#6b7280' },

  // Priorités
  'haute':        { bg: '#fee2e2', color: '#991b1b' },
  'moyenne':      { bg: '#fef3c7', color: '#92400e' },
  'basse':        { bg: '#dcfce7', color: '#166534' },

  // Ciblage
  'notifie':      { bg: '#dbeafe', color: '#1e40af' },
  'non_notifie':  { bg: '#f3f4f6', color: '#6b7280' },

  // Sélection / mobilisation
  'Sélectionné':    { bg: '#dcfce7', color: '#166534' },
  'Non sélectionné':{ bg: '#fee2e2', color: '#991b1b' },
  'En attente':     { bg: '#fef3c7', color: '#92400e' },

  // Formations
  'Réussi':       { bg: '#dcfce7', color: '#166534' },
  'En cours':     { bg: '#dbeafe', color: '#1e40af' },
  'Échoué':       { bg: '#fee2e2', color: '#991b1b' },
  'Expiré':       { bg: '#fef3c7', color: '#92400e' },

  // Présence camps
  'present':      { bg: '#dcfce7', color: '#166534' },
  'absent':       { bg: '#fee2e2', color: '#991b1b' },
  'confirme':     { bg: '#dbeafe', color: '#1e40af' },

  // Générique
  'success':      { bg: '#dcfce7', color: '#166534' },
  'warning':      { bg: '#fef3c7', color: '#92400e' },
  'error':        { bg: '#fee2e2', color: '#991b1b' },
  'info':         { bg: '#dbeafe', color: '#1e40af' },
  'neutral':      { bg: '#f3f4f6', color: '#6b7280' },
}

// Fallback si la valeur n'est pas dans la map
const DEFAULT_STYLE = { bg: '#f3f4f6', color: '#6b7280' }

// ─── Labels français pour les statuts ───────────────────────────────────────

const LABELS_FR: Record<string, string> = {
  'verifie': 'Vérifié',
  'en_attente': 'En attente',
  'refuse': 'Refusé',
  'actif': 'Actif',
  'termine': 'Terminé',
  'annule': 'Annulé',
  'planifie': 'Planifié',
  'en_cours': 'En cours',
  'brouillon': 'Brouillon',
  'notifie': 'Notifié',
  'non_notifie': 'Non notifié',
  'present': 'Présent',
  'absent': 'Absent',
  'confirme': 'Confirmé',
}

// ─── Composant ──────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  /** Valeur du statut (ex: 'Approuvé', 'verifie', 'haute') */
  status: string | null | undefined
  /** Label personnalisé (sinon déduit du statut) */
  label?: string
  /** Taille du badge */
  size?: 'sm' | 'md'
  /** Style supplémentaire */
  style?: React.CSSProperties
}

export default function StatusBadge({ status, label, size = 'sm', style }: StatusBadgeProps) {
  if (!status) return null

  const { bg, color } = BADGE_STYLES[status] || DEFAULT_STYLE
  const displayLabel = label || LABELS_FR[status] || status

  const isSmall = size === 'sm'

  return (
    <span
      style={{
        display: 'inline-block',
        padding: isSmall ? '2px 8px' : '4px 12px',
        borderRadius: 999,
        fontSize: isSmall ? 11 : 13,
        fontWeight: 600,
        backgroundColor: bg,
        color,
        whiteSpace: 'nowrap',
        lineHeight: isSmall ? '18px' : '20px',
        ...style,
      }}
    >
      {displayLabel}
    </span>
  )
}

// ─── Export des styles pour usage avancé ─────────────────────────────────────

export { BADGE_STYLES, LABELS_FR }
