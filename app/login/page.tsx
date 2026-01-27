'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'magic' | 'password'>('password')
  const supabase = createClient()
  const router = useRouter()

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage(`Erreur: ${error.message}`)
    } else {
      setMessage('Magic link envoyé ! Vérifiez votre email.')
    }
    setLoading(false)
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(`Erreur: ${error.message}`)
    } else {
      router.push('/')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h1>Connexion RIUSC</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setMode('password')}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: mode === 'password' ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Email + Password
        </button>
        <button
          onClick={() => setMode('magic')}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: mode === 'magic' ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Magic Link
        </button>
      </div>

      <form onSubmit={mode === 'magic' ? handleMagicLink : handlePasswordLogin}>
        <input
          type="email"
          placeholder="Votre email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            fontSize: '16px'
          }}
        />
        
        {mode === 'password' && (
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              fontSize: '16px'
            }}
          />
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Chargement...' : mode === 'magic' ? 'Envoyer Magic Link' : 'Se connecter'}
        </button>
      </form>
      
      {message && <p style={{ marginTop: '20px' }}>{message}</p>}
    </div>
  )
}