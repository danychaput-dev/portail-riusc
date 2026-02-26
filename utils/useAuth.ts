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
  benevole_id: string
  prenom: string
  nom: string
  email: string
  groupe?: string
  telephone?: string
  isDebug: true
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | ImpersonatedUser | DebugUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadAuth = async () => {
      // 0. Vérifier d'abord le mode debug (localStorage)
      try {
        const debugMode = localStorage.getItem('debug_mode')
        if (debugMode === 'true') {
          const debugUserStr = localStorage.getItem('debug_user')
          if (debugUserStr) {
            const debugData = JSON.parse(debugUserStr)
            console.log('🔧 useAuth: mode debug détecté', debugData)
            setUser({
              benevole_id: debugData.benevole_id,
              prenom: debugData.prenom,
              nom: debugData.nom,
              email: debugData.email,
              groupe: debugData.groupe,
              telephone: debugData.telephone,
              isDebug: true
            })
            setLoading(false)
            return
          }
        }
      } catch (e) {
        // localStorage peut échouer en SSR ou mode privé
      }

      try {
        // 1. Vérifier s'il y a un emprunt actif
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
  }, []) // Pas de dépendances - exécuté une seule fois au montage

  return { user, loading }
}
