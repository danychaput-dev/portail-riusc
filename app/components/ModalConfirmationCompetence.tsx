// components/ModalConfirmationCompetence.tsx
// Modal de confirmation quand un réserviste retire une compétence liée à un certificat

'use client';

import { ConfirmationRetrait } from '@/utils/competenceConfirmation';

interface Props {
  confirmation: ConfirmationRetrait;
  onConfirm: () => void;   // L'utilisateur confirme le retrait
  onCancel: () => void;     // L'utilisateur annule (remet la coche)
  loading?: boolean;
}

export default function ModalConfirmationCompetence({ 
  confirmation, 
  onConfirm, 
  onCancel, 
  loading = false 
}: Props) {
  if (!confirmation.requiresConfirmation) return null;

  const avecCertificat = confirmation.certificatsAffectes.some(c => c.certificat_url);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: avecCertificat ? '#fef2f2' : '#fffbeb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            flexShrink: 0,
          }}>
            {avecCertificat ? '⚠️' : '📋'}
          </div>
          <h3 style={{
            margin: 0,
            fontSize: '17px',
            fontWeight: 600,
            color: '#1e3a5f',
          }}>
            {confirmation.titre}
          </h3>
        </div>

        {/* Body */}
        <div style={{
          padding: '0 24px 20px',
        }}>
          <div style={{
            fontSize: '14px',
            color: '#4b5563',
            lineHeight: '1.6',
            whiteSpace: 'pre-line',
          }}>
            {confirmation.message}
          </div>
        </div>

        {/* Certificats affectés (résumé visuel) */}
        {confirmation.certificatsAffectes.length > 0 && (
          <div style={{
            padding: '0 24px 16px',
          }}>
            {confirmation.certificatsAffectes.map((cert) => (
              <div key={cert.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: cert.certificat_url ? '#fef2f2' : '#fffbeb',
                borderRadius: '8px',
                marginBottom: '6px',
                border: `1px solid ${cert.certificat_url ? '#fecaca' : '#fde68a'}`,
              }}>
                <span style={{ fontSize: '16px' }}>
                  {cert.certificat_url ? '📄' : '🔶'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                    {cert.nom_formation}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {cert.certificat_url 
                      ? `Certificat validé${cert.date_reussite ? ` — ${new Date(cert.date_reussite).toLocaleDateString('fr-CA')}` : ''}`
                      : 'Certificat en attente'
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#f9fafb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          borderTop: '1px solid #e5e7eb',
        }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: avecCertificat ? '#dc2626' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'En cours...' : 'Retirer quand même'}
          </button>
        </div>
      </div>
    </div>
  );
}
