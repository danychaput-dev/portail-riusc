'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Image from 'next/image'

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // États pour le login par téléphone
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'not_authorized') {
      setError('Votre courriel n\'est pas autorisé. Contactez l\'administrateur.')
    } else if (errorParam === 'auth_failed') {
      setError('Erreur de connexion. Veuillez réessayer.')
    }

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

  // Formater le numéro de téléphone
  const formatPhoneNumber = (value: string) => {
    // Garder seulement les chiffres
    const numbers = value.replace(/\D/g, '')
    
    // Formater pour affichage: (XXX) XXX-XXXX
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  // Convertir en format E.164 pour Twilio
  const toE164 = (phoneNumber: string) => {
    const numbers = phoneNumber.replace(/\D/g, '')
    if (numbers.length === 10) {
      return `+1${numbers}` // Ajouter +1 pour Canada/US
    }
    if (numbers.length === 11 && numbers.startsWith('1')) {
      return `+${numbers}`
    }
    return `+${numbers}`
  }

  // Envoyer le code OTP
  const handleSendOtp = async () => {
    const phoneNumbers = phone.replace(/\D/g, '')
    
    if (phoneNumbers.length < 10) {
      setError('Veuillez entrer un numéro de téléphone valide (10 chiffres)')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const formattedPhone = toE164(phone)

    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone
    })

    if (error) {
      console.error('OTP Error:', error)
      if (error.message.includes('not authorized')) {
        setError('Ce numéro n\'est pas autorisé. Contactez l\'administrateur.')
      } else {
        setError(`Erreur d'envoi du code: ${error.message}`)
      }
      setLoading(false)
      return
    }

    setOtpSent(true)
    setSuccess('Code envoyé! Vérifiez vos SMS.')
    setLoading(false)
  }

  // Vérifier le code OTP
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setError('Le code doit contenir 6 chiffres')
      return
    }

    setLoading(true)
    setError('')

    const formattedPhone = toE164(phone)

    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otpCode,
      type: 'sms'
    })

    if (error) {
      console.error('Verify Error:', error)
      setError('Code invalide ou expiré. Réessayez.')
      setLoading(false)
      return
    }

    if (data.user) {
      router.push('/')
    }
  }

  // Réinitialiser pour changer de numéro
  const handleReset = () => {
    setOtpSent(false)
    setOtpCode('')
    setError('')
    setSuccess('')
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

        {success && (
          <div style={{
            backgroundColor: '#d1fae5',
            color: '#059669',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {success}
          </div>
        )}

        {/* ===== SECTION TÉLÉPHONE OTP ===== */}
        <div style={{ marginBottom: '24px' }}>
          {!otpSent ? (
            // Étape 1: Entrer le numéro
            <>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '14px', 
                fontWeight: '500',
                color: '#374151'
              }}>
                Numéro de téléphone
              </label>
              <input
                type="tel"
                placeholder="(514) 555-1234"
                value={phone}
                onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={handleSendOtp}
                disabled={loading || phone.replace(/\D/g, '').length < 10}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  backgroundColor: '#1e3a5f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading || phone.replace(/\D/g, '').length < 10 ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {loading ? 'Envoi en cours...' : '📱 Recevoir un code par SMS'}
              </button>
            </>
          ) : (
            // Étape 2: Entrer le code
            <>
              <p style={{ 
                fontSize: '14px', 
                color: '#6b7280', 
                marginBottom: '12px',
                textAlign: 'center'
              }}>
                Code envoyé au <strong>{phone}</strong>
                <br />
                <button 
                  onClick={handleReset}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#2563eb', 
                    cursor: 'pointer',
                    fontSize: '13px',
                    textDecoration: 'underline'
                  }}
                >
                  Changer de numéro
                </button>
              </p>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '14px', 
                fontWeight: '500',
                color: '#374151'
              }}>
                Code de vérification (6 chiffres)
              </label>
              <input
                type="text"
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.length !== 6}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading || otpCode.length !== 6 ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {loading ? 'Vérification...' : '✓ Valider le code'}
              </button>
              <button
                onClick={handleSendOtp}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginTop: '8px'
                }}
              >
                Renvoyer le code
              </button>
            </>
          )}
        </div>

        {/* Séparateur */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          margin: '24px 0',
          gap: '16px'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>ou</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
        </div>

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
          Se connecter avec Google
        </button>

        <p style={{
          marginTop: '24px',
          fontSize: '13px',
          color: '#6b7280',
          textAlign: 'center',
          lineHeight: '1.5'
        }}>
          En vous connectant, vous acceptez que vos informations soient utilisées pour vous identifier dans le système RIUSC.
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
