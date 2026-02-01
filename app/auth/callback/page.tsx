'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Erreur auth callback:', error)
        router.push('/login?error=auth_failed')
        return
      }

      if (session) {
        // Vérifier si l'utilisateur existe dans reservistes
        const { data: reserviste } = await supabase
          .from('reservistes')
          .select('*')
          .eq('email', session.user.email)
          .single()

        if (reserviste) {
          // Lier le user_id si pas encore fait
          if (!reserviste.user_id) {
            await supabase
              .from('reservistes')
              .update({ user_id: session.user.id })
              .eq('email', session.user.email)
          }
          router.push('/')
        } else {
          // Utilisateur non autorisé
          await supabase.auth.signOut()
          router.push('/login?error=not_authorized')
        }
      } else {
        router.push('/login')
      }
    }

    handleCallback()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '18px',
      color: '#1e3a5f'
    }}>
      Connexion en cours...
    </div>
  )
}
