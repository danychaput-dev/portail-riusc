'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  
  const supabase = createClient()
  const router = useRouter()

  // Étape 1 : Envoyer le code OTP par email
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setMessageType('')

    // Vérifier si l'email existe dans la table reservistes
    const { data: reserviste, error: checkError } = await supabase
      .from('reservistes')
      .select('email')
      .eq('email', email.toLowerCase())
      .single()

    if (checkError || !reserviste) {
      setMessage('Cet email n\'est pas associé à un compte réserviste. Contactez l\'administration.')
      setMessageType('error')
      setLoading(false)
      return
    }

    // Envoyer le code OTP
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      setMessage(`Erreur: ${error.message}`)
      setMessageType('error')
    } else {
      setMessage('Code envoyé ! Vérifiez votre boîte de réception (et vos spams).')
      setMessageType('success')
      setStep('code')
    }
    setLoading(false)
  }

  // Étape 2 : Vérifier le code OTP
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setMessageType('')

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    })

    if (error) {
      setMessage('Code invalide ou expiré. Veuillez réessayer.')
      setMessageType('error')
      setLoading(false)
    } else {
      setMessage('Connexion réussie !')
      setMessageType('success')
      router.push('/')
    }
  }

  // Renvoyer le code
  const handleResendCode = async () => {
    setLoading(true)
    setMessage('')
    setMessageType('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      setMessage(`Erreur: ${error.message}`)
      setMessageType('error')
    } else {
      setMessage('Nouveau code envoyé !')
      setMessageType('success')
    }
    setLoading(false)
  }

  // Retour à l'étape email
  const handleBackToEmail = () => {
    setStep('email')
    setOtpCode('')
    setMessage('')
    setMessageType('')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '20px 0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px'
        }}>
          <Image
            src="/logo.png"
            alt="Logo RIUSC"
            width={60}
            height={60}
            style={{ borderRadius: '50%' }}
          />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '24px' }}>Portail RIUSC</h1>
            <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '12px' }}>
              Réserve d'Intervention d'Urgence - Sécurité Civile
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ 
        maxWidth: '420px', 
        margin: '0 auto', 
        padding: '60px 20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px 30px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            textAlign: 'center', 
            color: '#1e3a5f', 
            marginTop: 0,
            marginBottom: '10px',
            fontSize: '22px'
          }}>
            {step === 'email' ? 'Connexion' : 'Entrez le code'}
          </h2>
          
          <p style={{ 
            textAlign: 'center', 
            color: '#6b7280', 
            marginBottom: '30px',
            fontSize: '14px'
          }}>
            {step === 'email' 
              ? 'Entrez votre email pour recevoir un code de connexion'
              : `Un code à 6 chiffres a été envoyé à ${email}`
            }
          </p>

          {/* Étape 1 : Entrer l'email */}
          {step === 'email' && (
            <form onSubmit={handleSendCode}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500',
                  color: '#374151',
                  fontSize: '14px'
                }}>
                  Adresse courriel
                </label>
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: loading ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = '#2563eb')}
              >
                {loading ? 'Envoi en cours...' : '📧 Envoyer le code'}
              </button>
            </form>
          )}

          {/* Étape 2 : Entrer le code OTP */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500',
                  color: '#374151',
                  fontSize: '14px'
                }}>
                  Code à 6 chiffres
                </label>
                <input
                  type="text"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '24px',
                    fontWeight: '600',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: (loading || otpCode.length !== 6) ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (loading || otpCode.length !== 6) ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  marginBottom: '12px'
                }}
              >
                {loading ? 'Vérification...' : '✅ Vérifier le code'}
              </button>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: 'transparent',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  ← Changer d'email
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: 'transparent',
                    color: '#2563eb',
                    border: '1px solid #2563eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  🔄 Renvoyer le code
                </button>
              </div>
            </form>
          )}

          {/* Message de feedback */}
          {message && (
            <div style={{
              marginTop: '20px',
              padding: '12px 16px',
              backgroundColor: messageType === 'success' ? '#d1fae5' : '#fee2e2',
              color: messageType === 'success' ? '#065f46' : '#991b1b',
              borderRadius: '8px',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              {message}
            </div>
          )}
        </div>

        {/* Info */}
        <p style={{ 
          textAlign: 'center', 
          color: '#9ca3af', 
          fontSize: '13px',
          marginTop: '30px'
        }}>
          Vous recevrez un code de connexion valide pour 10 minutes.
          <br />
          Vérifiez vos spams si vous ne le recevez pas.
        </p>
      </main>

      {/* Footer */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '15px',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
          © 2026 AQBRS - Tous droits réservés
        </p>
      </footer>
    </div>
  )
}
