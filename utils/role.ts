// utils/role.ts
// Utilitaire centralisé pour la gestion des rôles
import { createClient } from '@/utils/supabase/client'

export type Role = 'admin' | 'coordonnateur' | 'reserviste'

export interface RoleInfo {
  benevole_id: string
  role: Role
  prenom: string
  nom: string
}

/**
 * Retourne les infos de rôle de l'utilisateur connecté.
 * Retourne null si non connecté ou non trouvé.
 */
export async function getCurrentRole(): Promise<RoleInfo | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('reservistes')
    .select('benevole_id, role, prenom, nom')
    .eq('user_id', user.id)
    .single()

  if (!data) return null
  return data as RoleInfo
}

export const isAdmin = (role: Role) => role === 'admin'
export const isAdminOrCoord = (role: Role) => role === 'admin' || role === 'coordonnateur'
