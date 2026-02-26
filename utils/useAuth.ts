import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface AuthUser {
  id: string
  email?: string
  phone?: string
}

interface ImpersonatedUser {
  benevole_id: string
  email?: string
  isImpersonated: true
}

interface DebugUser {
  id: string
  email?: string
  benevole_id: string
  isDebug: true
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | ImpersonatedUser | DebugUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadAuth = async () => {
      // 0. Vérifier le mode debug en premier
      if (typeof window !== 'undefined') {
        const debugMode = localStorage.getItem('debug_mode')
        if (debugMode === 'true') {
          const debugUser = localStorage.getItem('debug_user')
          const debugEmail = localStorage.getItem('debug_email')
          if (debugUser) {
            const userData = JSON.parse(debugUser)
            console.log('🔧 useAuth - Mode debug actif:', userData.email)
            setUser({
              id: `debug_${userData.benevole_id || userData.id}`,
              email: debugEmail || userData.email,
              benevole_id: userData.benevole_id,
              isDebug: true
            })
            setLoading(false)
            return
          }
        }
      }

      // 1. Vérifier s'il y a un emprunt actif
      try {
        const impersonateResponse = await fetch('/api/check-impersonate', {
          credentials: 'include'
        })
        
        if (impersonateResponse.ok) {
          const impersonateData = await impersonateResponse.json()
          
          if (impersonateData.isImpersonating && impersonateData.benevole_id) {
            setUser({
              benevole_id: impersonateData.benevole_id,
              email: impersonateData.email,
              isImpersonated: true
            })
            setLoading(false)
            return
          }
        }
      } catch (error) {
        console.error('Erreur vérification emprunt:', error)
      }

      // 2. Sinon, utiliser l'auth normale
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        setUser(authUser)
      } catch (error) {
        console.error('Erreur auth:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadAuth()
  }, [])

  return { user, loading }
}
