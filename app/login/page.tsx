'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Image from 'next/image'

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    // Vérifier les erreurs dans l'URL
    const errorParam = searchParams.get('error')
    if (errorParam === 'not_authorized') {
      setError('Votre courriel n\'est pas autorisé. Contactez l\'administrateur.')
    } else if (errorParam === 'auth_failed') {
      setError('Erreur de connexion. Veuillez réessayer.')
    }

    // Vérifier si déjà connecté
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/')
      }
    }
    checkUser()
  }, [searchParams])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) {
      setError('Erreur de connexion avec Google')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      {/* Logo et titre */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <Image
          src="/logo.png"
          alt="Logo RIUSC"
          width={120}
          height={120}
          style={{ borderRadius: '50%', marginBottom: '20px' }}
        />
        <h1 style={{ color: '#1e3a5f', margin: '0 0 10px 0', fontSize: '32px' }}>
          Portail RIUSC
        </h1>
        <p style={{ color: '#666', margin: 0, fontSize: '16px' }}>
          Réserve d'Intervention d'Urgence - Sécurité Civile du Québec
        </p>
      </div>

      {/* Boîte de connexion */}
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '420px'
      }}>
        <h2 style={{ 
          color: '#1e3a5f', 
          margin: '0 0 30px 0', 
          textAlign: 'center',
          fontSize: '24px'
        }}>
          Connexion
        </h2>

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Bouton Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 20px',
            backgroundColor: 'white',
            color: '#333',
            border: '2px solid #e5e7eb',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            transition: 'all 0.2s',
            opacity: loading ? 0.7 : 1
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#f9fafb'
              e.currentTarget.style.borderColor = '#d1d5db'
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'white'
            e.currentTarget.style.borderColor = '#e5e7eb'
          }}
        >
          {/* Google Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Connexion en cours...' : 'Se connecter avec Google'}
        </button>

        <p style={{
          marginTop: '24px',
          fontSize: '13px',
          color: '#6b7280',
          textAlign: 'center',
          lineHeight: '1.5'
        }}>
          En vous connectant, vous acceptez que votre adresse courriel soit utilisée pour vous identifier dans le système RIUSC.
        </p>
      </div>

      {/* Footer */}
      <p style={{
        marginTop: '40px',
        fontSize: '14px',
        color: '#9ca3af'
      }}>
        © 2026 AQBRS - Tous droits réservés
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Chargement...</div>}>
      <LoginContent />
    </Suspense>
  )
}
