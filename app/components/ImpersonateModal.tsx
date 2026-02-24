'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Reserviste {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  groupe: string
}

interface ImpersonateModalProps {
  onClose: () => void
  onImpersonate: (benevole_id: string) => void
}

export default function ImpersonateModal({ onClose, onImpersonate }: ImpersonateModalProps) {
  const [search, setSearch] = useState('')
  const [reservistes, setReservistes] = useState<Reserviste[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const searchReservistes = async () => {
      if (search.length < 2) {
        setReservistes([])
        return
      }

      setLoading(true)

      const { data } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom, email, groupe')
        .or(`prenom.ilike.%${search}%,nom.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(20)

      setReservistes(data || [])
      setLoading(false)
    }

    const timeoutId = setTimeout(searchReservistes, 300)
    return () => clearTimeout(timeoutId)
  }, [search])

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: 'rgba(0, 0, 0, 0.5)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          width: '100%', 
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          padding: '24px', 
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🎭</span>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>
              Emprunter une identité
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ 
              backgroundColor: 'transparent', 
              border: 'none', 
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="24" height="24" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ position: 'relative' }}>
            <svg 
              width="20" 
              height="20" 
              fill="none" 
              stroke="#6b7280" 
              strokeWidth="2" 
              viewBox="0 0 24 24"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par nom, prénom ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 12px 12px 44px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '15px',
                outline: 'none'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#1e3a5f'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>

        {/* Results */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          padding: '12px'
        }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              Recherche en cours...
            </div>
          )}

          {!loading && search.length >= 2 && reservistes.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              Aucun réserviste trouvé
            </div>
          )}

          {!loading && search.length < 2 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              Tapez au moins 2 caractères pour rechercher
            </div>
          )}

          {!loading && reservistes.map((reserviste) => (
            <button
              key={reserviste.benevole_id}
              onClick={() => onImpersonate(reserviste.benevole_id)}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                marginBottom: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
                e.currentTarget.style.borderColor = '#1e3a5f'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'white'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a5f', marginBottom: '4px' }}>
                    {reserviste.prenom} {reserviste.nom}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    {reserviste.email}
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px',
                  backgroundColor: reserviste.groupe === 'Approuvé' ? '#d1fae5' : '#f3f4f6',
                  color: reserviste.groupe === 'Approuvé' ? '#065f46' : '#6b7280',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {reserviste.groupe}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
