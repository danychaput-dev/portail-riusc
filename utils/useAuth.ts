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

export function useAuth() {
  const [user, setUser] = useState<AuthUser | ImpersonatedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadAuth = async () => {
      try {
        // 1. Vérifier d'abord s'il y a un emprunt actif
        const impersonateResponse = await fetch('/api/check-impersonate', {
          credentials: 'include'
        })
        
        if (impersonateResponse.ok) {
          const impersonateData = await impersonateResponse.json()
          
          if (impersonateData.isImpersonating && impersonateData.benevole_id) {
            // Utilisateur emprunté
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
  }, []) // Pas de dépendances - exécuté une seule fois au montage

  return { user, loading }
}