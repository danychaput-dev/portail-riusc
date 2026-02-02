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

  // États pour le login
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpMethod, setOtpMethod] = useState<'sms' | 'email' | null>(null)
  const [maskedPhone, setMaskedPhone] = useState('')

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

  // Masquer le numéro de téléphone pour l'affichage (ex: *** ***-7313)
  const maskPhone = (phone: string) => {
    const numbers = phone.replace(/\D/g, '')
    if (numbers.length >= 4) {
      return `*** ***-${numbers.slice(-4)}`
    }
    return '***'
  }

  // Convertir en format E.164 pour Twilio
  const toE164 = (phoneNumber: string) => {
    const numbers = phoneNumber.replace(/\D/g, '')
    if (numbers.length === 10) {
      return `+1${numbers}`
    }
    if (numbers.length === 11 && numbers.startsWith('1')) {
      return `+${numbers}`
    }
    return `+${numbers}`
  }

  // Envoyer le code OTP
  const handleSendOtp = async () => {
    if (!email || !email.includes('@')) {
      setError('Veuillez entrer une adresse courriel valide')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // 1. Chercher le réserviste par email
      const { data: reserviste, error: fetchError } = await supabase
        .from('reservistes')
        .select('email, telephone')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (fetchError || !reserviste) {
        setError('Ce courriel n\'est pas enregistré dans le système. Contactez l\'administrateur.')
        setLoading(false)
        return
      }

      // 2. Déterminer la méthode d'envoi
      if (reserviste.telephone) {
        // Envoyer par SMS
        const formattedPhone = toE164(reserviste.telephone)
        
        const { error: otpError } = await supabase.auth.signInWithOtp({
          phone: formattedPhone
        })

        if (otpError) {
          console.error('SMS OTP Error:', otpError)
          setError(`Erreur d'envoi SMS: ${otpError.message}`)
          setLoading(false)
          return
        }

        setOtpMethod('sms')
        setMaskedPhone(maskPhone(reserviste.telephone))
        setSuccess(`Code envoyé par SMS au ${maskPhone(reserviste.telephone)}`)
      } else {
        // Envoyer par email
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim()
        })

        if (otpError) {
          console.error('Email OTP Error:', otpError)
          setError(`Erreur d'envoi courriel: ${otpError.message}`)
          setLoading(false)
          return
        }

        setOtpMethod('email')
        setSuccess(`Code envoyé par courriel à ${email}`)
      }

      setOtpSent(true)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Une erreur inattendue est survenue. Réessayez.')
    }

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

    try {
      let verifyResult

      if (otpMethod === 'sms') {
        // Récupérer le téléphone pour la vérification
        const { data: reserviste } = await supabase
          .from('reservistes')
          .select('telephone')
          .eq('email', email.toLowerCase().trim())
          .single()

        if (reserviste?.telephone) {
          const formattedPhone = toE164(reserviste.telephone)
          verifyResult = await supabase.auth.verifyOtp({
            phone: formattedPhone,
            token: otpCode,
            type: 'sms'
          })
        }
      } else {
        // Vérification par email
        verifyResult = await supabase.auth.verifyOtp({
          email: email.toLowerCase().trim(),
          token: otpCode,
          type: 'email'
        })
      }

      if (verifyResult?.error) {
        console.error('Verify Error:', verifyResult.error)
        setError('Code invalide ou expiré. Réessayez.')
        setLoading(false)
        return
      }

      if (verifyResult?.data?.user) {
        router.push('/')
      }
    } catch (err) {
      console.error('Verify unexpected error:', err)
      setError('Erreur de vérification. Réessayez.')
    }

    setLoading(false)
  }

  // Réinitialiser
  const handleReset = () => {
    setOtpSent(false)
    setOtpCode('')
    setOtpMethod(null)
    setMaskedPhone('')
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

        {!otpSent ? (
          // Étape 1: Entrer le courriel
          <>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#374151'
            }}>
              Adresse courriel
            </label>
            <input
              type="email"
              placeholder="votre.nom@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={handleSendOtp}
              disabled={loading || !email.includes('@')}
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
                opacity: loading || !email.includes('@') ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Vérification en cours...' : 'Recevoir un code de connexion'}
            </button>
            <p style={{
              marginTop: '16px',
              fontSize: '13px',
              color: '#6b7280',
              textAlign: 'center',
              lineHeight: '1.5'
            }}>
              Un code vous sera envoyé par SMS si votre numéro est enregistré, sinon par courriel.
            </p>
          </>
        ) : (
          // Étape 2: Entrer le code
          <>
            <p style={{ 
              fontSize: '14px', 
              color: '#6b7280', 
              marginBottom: '16px',
              textAlign: 'center',
              lineHeight: '1.6'
            }}>
              {otpMethod === 'sms' ? (
                <>Code envoyé par <strong>SMS</strong> au <strong>{maskedPhone}</strong></>
              ) : (
                <>Code envoyé par <strong>courriel</strong> à <strong>{email}</strong></>
              )}
              <br />
              <button 
                onClick={handleReset}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#2563eb', 
                  cursor: 'pointer',
                  fontSize: '13px',
                  textDecoration: 'underline',
                  marginTop: '4px'
                }}
              >
                Changer de courriel
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
              onKeyDown={(e) => e.key === 'Enter' && otpCode.length === 6 && handleVerifyOtp()}
              maxLength={6}
              autoFocus
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '24px',
                fontWeight: 'bold',
                letterSpacing: '8px',
                textAlign: 'center',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                marginBottom: '16px',
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
