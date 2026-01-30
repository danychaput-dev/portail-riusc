'use client'

import { useRouter } from 'next/navigation'

export default function FormulairesPage() {
  const router = useRouter()

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '60px 40px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚧</div>
        
        <h1 style={{ 
          color: '#1e3a5f', 
          margin: '0 0 15px 0',
          fontSize: '24px'
        }}>
          Formulaires
        </h1>
        
        <p style={{ 
          color: '#6b7280', 
          fontSize: '16px',
          margin: '0 0 30px 0',
          lineHeight: '1.6'
        }}>
          Cette section sera disponible prochainement.
        </p>
        
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
        >
          ← Retour à l'accueil
        </button>
      </div>
    </div>
  )
}
