import { createClient } from '@/utils/supabase/client'

export interface AuthUser {
  user: any
  isDebug: boolean
}

/**
 * Récupère l'utilisateur actuel
 * Supporte à la fois Supabase Auth et le mode debug
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const supabase = createClient()
  
  // Vérifier le mode debug
  if (typeof window !== 'undefined') {
    const debugMode = localStorage.getItem('debug_mode')
    if (debugMode === 'true') {
      const debugUser = localStorage.getItem('debug_user')
      const debugEmail = localStorage.getItem('debug_email')
      
      if (debugUser) {
        const user = JSON.parse(debugUser)
        console.log('🔧 Mode debug actif - Utilisateur:', user.email)
        
        return {
          user: {
            ...user,
            email: debugEmail || user.email,
            // Ajouter un ID fictif pour compatibilité
            id: `debug_${user.benevole_id || user.id}`
          },
          isDebug: true
        }
      }
    }
  }
  
  // Mode normal : Supabase Auth
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return {
      user: null,
      isDebug: false
    }
  }
  
  // Récupérer les données complètes du réserviste depuis Supabase
  const { data: reserviste } = await supabase
    .from('reservistes')
    .select('*')
    .eq('email', user.email)
    .maybeSingle()
  
  return {
    user: reserviste || user,
    isDebug: false
  }
}

/**
 * Déconnexion (supporte debug et normal)
 */
export async function signOut() {
  const supabase = createClient()
  
  // Nettoyer le mode debug
  if (typeof window !== 'undefined') {
    localStorage.removeItem('debug_mode')
    localStorage.removeItem('debug_user')
    localStorage.removeItem('debug_email')
  }
  
  // Déconnexion Supabase
  await supabase.auth.signOut()
}

/**
 * Vérifie si l'utilisateur est connecté
 */
export async function isAuthenticated(): Promise<boolean> {
  const { user } = await getCurrentUser()
  return user !== null
}
