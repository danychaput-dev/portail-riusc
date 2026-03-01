'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Image from 'next/image'
import { logEvent, logPageVisit } from '@/utils/logEvent'

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | React.ReactNode>('')
  const [success, setSuccess] = useState('')
  const [showJoinPrompt, setShowJoinPrompt] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpMethod, setOtpMethod] = useState<'sms' | 'email' | null>(null)

  // Récupérer le camp_id si présent dans l'URL
  const campId = searchParams.get('camp') || ''

  const contactLink = (
    <span> Si le problème persiste, <a href="mailto:dany.chaput@aqbrs.ca" style={{ color: '#dc2626', fontWeight: '600', textDecoration: 'underline' }}>contactez-nous</a>.</span>
  )

  useEffect(() => {
    // Log visite page login
    logPageVisit('/login')

    const errorParam = searchParams.get('error')
    if (errorParam === 'not_authorized') {
      setError(<>Votre courriel n&apos;est pas autorisé.{contactLink}</>)
    } else if (errorParam === 'auth_failed') {
      setError(<>Erreur de connexion. Veuillez réessayer.{contactLink}</>)
    }

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push(campId ? `/formation?camp=${campId}` : '/')
      }
    }
    checkUser()
  }, [searchParams])

  const toE164 = (phoneNumber: string) => {
    const numbers = phoneNumber.replace(/\D/g, '')
    if (numbers.length === 10) return `+1${numbers}`
    if (numbers.length === 11 && numbers.startsWith('1')) return `+${numbers}`
    return `+${numbers}`
  }

  const handleSendOtp = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    // Empêcher le submit du form si événement vient d'un click
    if (e) {
      e.preventDefault()
    }

    // 🔧 MODE DEBUG : Ctrl+Shift+Click
    if (e && e.ctrlKey && e.shiftKey) {
      console.log('🔧 MODE DEBUG ACTIVÉ !')
      setLoading(true)
      setError('')

      try {
        // Récupérer les données du réserviste depuis Supabase
        const { data: debugData, error: fetchError } = await supabase
          .rpc('check_reserviste_login', { lookup_email: email.trim() })
        const reserviste = debugData?.[0] || null

        if (fetchError || !reserviste) {
          setError('Réserviste non trouvé pour cet email')
          await logEvent({
            eventType: 'login_failed',
            email: email.trim(),
            authMethod: 'debug',
            metadata: { reason: 'reserviste_not_found' },
          })
          setLoading(false)
          return
        }

        console.log('✅ Réserviste trouvé:', reserviste)

        // Log login debug
        await logEvent({
          eventType: 'login_debug',
          email: email.trim(),
          authMethod: 'debug',
          metadata: { impersonated_email: email.trim() },
        })

        // Créer une session debug en localStorage
        localStorage.setItem('debug_mode', 'true')
        localStorage.setItem('debug_user', JSON.stringify(reserviste))
        localStorage.setItem('debug_email', email.trim())

        // Rediriger
        window.location.href = campId ? `/formation?camp=${campId}` : '/'
        return
      } catch (err) {
        console.error('Erreur mode debug:', err)
        setError('Erreur mode debug')
        setLoading(false)
        return
      }
    }

    // 🎯 MODE DÉMO : taper "demoriusc" comme identifiant
    if (email.trim().toLowerCase() === 'demoriusc') {
      setLoading(true)
      setError('')
      
      // Stocker le mode démo
      localStorage.setItem('demo_mode', 'true')
      localStorage.setItem('demo_groupe', 'Intérêt')
      
      // Rediriger
      window.location.href = '/'
      return
    }

    // Mode normal
    if (!email || !email.includes('@')) {
      setError('Veuillez entrer une adresse courriel valide')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    setShowJoinPrompt(false)

    try {
      const { data: reservistes, error: fetchError } = await supabase
        .rpc('check_reserviste_login', { lookup_email: email.trim() })

      const reserviste = reservistes?.[0] || null

      if (fetchError) {
        console.error('Erreur recherche réserviste:', fetchError)
        setError(<>Erreur de connexion. Veuillez réessayer.{contactLink}</>)
        await logEvent({
          eventType: 'login_failed',
          email: email.trim(),
          metadata: { reason: 'rpc_error', error: fetchError.message },
        })
        setLoading(false)
        return
      }

      if (!reserviste) {
        setShowJoinPrompt(true)
        await logEvent({
          eventType: 'login_failed',
          email: email.trim(),
          metadata: { reason: 'reserviste_not_found', showed_join_prompt: true },
        })
        setLoading(false)
        return
      }

      let smsSent = false

      if (reserviste.telephone) {
        const formattedPhone = toE164(reserviste.telephone)
        const { error: smsError } = await supabase.auth.signInWithOtp({ phone: formattedPhone })
        if (!smsError) {
          smsSent = true
          setOtpMethod('sms')
        } else {
          console.warn('SMS échoué, fallback email:', smsError.message)
        }
      }

      if (!smsSent) {
        const { error: emailError } = await supabase.auth.signInWithOtp({ email: email.toLowerCase().trim() })
        if (emailError) {
          console.error('Email OTP Error:', emailError)
          setError(<>Erreur d&apos;envoi du code de connexion.{contactLink}</>)
          await logEvent({
            eventType: 'login_failed',
            email: email.trim(),
            metadata: { reason: 'otp_send_failed', error: emailError.message },
          })
          setLoading(false)
          return
        }
        setOtpMethod('email')
      }

      setOtpSent(true)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError(<>Une erreur inattendue est survenue. Réessayez.{contactLink}</>)
      await logEvent({
        eventType: 'login_failed',
        email: email.trim(),
        metadata: { reason: 'unexpected_error', error: String(err) },
      })
    }

    setLoading(false)
  }

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) { setError('Le code doit contenir 6 chiffres'); return }
    setLoading(true)
    setError('')

    try {
      let verifyResult

      if (otpMethod === 'sms') {
        const { data: reservistes } = await supabase.rpc('check_reserviste_login', { lookup_email: email.trim() })
        const reserviste = reservistes?.[0] || null
        if (reserviste?.telephone) {
          const formattedPhone = toE164(reserviste.telephone)
          verifyResult = await supabase.auth.verifyOtp({ phone: formattedPhone, token: otpCode, type: 'sms' })
        }
      } else {
        verifyResult = await supabase.auth.verifyOtp({ email: email.toLowerCase().trim(), token: otpCode, type: 'email' })
      }

      if (verifyResult?.error) {
        console.error('Verify Error:', verifyResult.error)
        setError(<>Code invalide ou expiré. Réessayez.{contactLink}</>)
        await logEvent({
          eventType: 'login_failed',
          email: email.trim(),
          authMethod: otpMethod === 'sms' ? 'sms_otp' : 'email_otp',
          metadata: { reason: 'otp_verify_failed', error: verifyResult.error.message },
        })
        setLoading(false)
        return
      }

      if (verifyResult?.data?.user) {
        // ✅ Login réussi — logger avant la redirection
        await logEvent({
          eventType: otpMethod === 'sms' ? 'login_sms' : 'login_email',
          email: email.trim(),
          userId: verifyResult.data.user.id,
          telephone: verifyResult.data.user.phone || null,
          authMethod: otpMethod === 'sms' ? 'sms_otp' : 'email_otp',
        })
        router.push(campId ? `/formation?camp=${campId}` : '/')
      }
    } catch (err) {
      console.error('Verify unexpected error:', err)
      setError(<>Erreur de vérification. Réessayez.{contactLink}</>)
      await logEvent({
        eventType: 'login_failed',
        email: email.trim(),
        metadata: { reason: 'verify_unexpected_error', error: String(err) },
      })
    }

    setLoading(false)
  }

  const handleReset = () => {
    setOtpSent(false)
    setOtpCode('')
    setOtpMethod(null)
    setError('')
    setSuccess('')
    setShowJoinPrompt(false)
  }

  // Construire les URLs avec le camp param + email pré-rempli
  const inscriptionUrl = (() => {
    const params = new URLSearchParams()
    if (campId) params.set('camp', campId)
    if (email.trim()) params.set('email', email.trim())
    const qs = params.toString()
    return '/inscription' + (qs ? '?' + qs : '')
  })()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Image src="/logo.png" alt="Logo RIUSC" width={120} height={120} style={{ borderRadius: '50%', marginBottom: '20px' }} />
        <h1 style={{ color: '#1e3a5f', margin: '0 0 10px 0', fontSize: '32px' }}>Portail RIUSC</h1>
        <p style={{ color: '#666', margin: 0, fontSize: '16px' }}>Réserve d&apos;Intervention d&apos;Urgence en Sécurité Civile</p>
      </div>

      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '420px' }}>
        <h2 style={{ color: '#1e3a5f', margin: '0 0 30px 0', textAlign: 'center', fontSize: '24px' }}>Connexion</h2>

        {/* Bandeau camp si présent */}
        {campId && !otpSent && !showJoinPrompt && (
          <div style={{ backgroundColor: '#f0f9ff', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #3b82f6', fontSize: '14px', color: '#1e40af' }}>
            🏕️ Connectez-vous pour vous inscrire au camp de qualification.
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>
        )}

        {success && (
          <div style={{ backgroundColor: '#d1fae5', color: '#059669', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{success}</div>
        )}

        {showJoinPrompt ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: '#dbeafe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
              👋
            </div>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 12px 0', fontSize: '20px' }}>
              Ce courriel n&apos;est pas enregistré
            </h3>
            <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              <strong>{email}</strong> n&apos;est associé à aucun compte. Souhaitez-vous joindre la Réserve d&apos;Intervention d&apos;Urgence ?
            </p>
            <a
              href={inscriptionUrl}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                backgroundColor: '#1e3a5f',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                textDecoration: 'none',
                textAlign: 'center',
                boxSizing: 'border-box',
                marginBottom: '12px'
              }}
            >
              Oui, je veux m&apos;inscrire →
            </a>
            <button
              type="button"
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '12px 20px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              ← Essayer un autre courriel
            </button>
          </div>
        ) : !otpSent ? (
          <>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Adresse courriel</label>
            <input
              type="email"
              placeholder="votre.nom@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
              style={{ width: '100%', padding: '14px 16px', fontSize: '16px', border: '2px solid #e5e7eb', borderRadius: '10px', marginBottom: '16px', boxSizing: 'border-box', color: '#111827' }}
            />
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading || (!email.includes('@') && email.trim().toLowerCase() !== 'demoriusc')}
              style={{ width: '100%', padding: '14px 20px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || (!email.includes('@') && email.trim().toLowerCase() !== 'demoriusc') ? 0.7 : 1, transition: 'all 0.2s' }}
            >
              {loading ? 'Vérification en cours...' : email.trim().toLowerCase() === 'demoriusc' ? 'Accéder à la démo' : 'Recevoir un code de connexion'}
            </button>
            <p style={{ marginTop: '16px', fontSize: '13px', color: '#6b7280', textAlign: 'center', lineHeight: '1.5' }}>
              Un code vous sera envoyé par SMS si votre numéro est enregistré, sinon par courriel.
            </p>
            
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Vous n&apos;avez pas de compte ?</p>
              <a href={inscriptionUrl} style={{ color: '#1e3a5f', fontWeight: '600', fontSize: '14px', textDecoration: 'none' }}>S&apos;inscrire comme réserviste →</a>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px', textAlign: 'center', lineHeight: '1.6' }}>
              {otpMethod === 'sms' ? (
                <>Code envoyé par <strong>SMS</strong> au numéro associé à votre compte</>
              ) : (
                <>Code envoyé par <strong>courriel</strong> à <strong>{email}</strong></>
              )}
              <br />
              <button type="button" onClick={handleReset} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', marginTop: '4px' }}>Changer de courriel</button>
            </p>
            
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Code de vérification (6 chiffres)</label>
            <input
              type="text"
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && otpCode.length === 6 && handleVerifyOtp()}
              maxLength={6}
              autoFocus
              style={{ width: '100%', padding: '14px 16px', fontSize: '24px', fontWeight: 'bold', letterSpacing: '8px', textAlign: 'center', border: '2px solid #e5e7eb', borderRadius: '10px', marginBottom: '16px', boxSizing: 'border-box', color: '#111827' }}
            />
            <button type="button" onClick={handleVerifyOtp} disabled={loading || otpCode.length !== 6} style={{ width: '100%', padding: '14px 20px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || otpCode.length !== 6 ? 0.7 : 1, transition: 'all 0.2s' }}>
              {loading ? 'Vérification...' : '✓ Valider le code'}
            </button>
            <button type="button" onClick={handleSendOtp} disabled={loading} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#6b7280', border: 'none', fontSize: '14px', cursor: 'pointer', marginTop: '8px' }}>Renvoyer le code</button>
          </>
        )}

        <p style={{ marginTop: '24px', fontSize: '13px', color: '#6b7280', textAlign: 'center', lineHeight: '1.5' }}>
          En vous connectant, vous acceptez que vos informations soient utilisées pour vous identifier dans le système RIUSC.
        </p>
      </div>

      <p style={{ marginTop: '40px', fontSize: '14px', color: '#9ca3af' }}>© 2026 AQBRS - Tous droits réservés</p>
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
