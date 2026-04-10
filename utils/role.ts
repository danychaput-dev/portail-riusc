// utils/role.ts
// Utilitaire centralise pour la gestion des roles
import { createClient } from '@/utils/supabase/client'

export type Role = 'superadmin' | 'admin' | 'coordonnateur' | 'adjoint' | 'reserviste' | 'partenaire_chef' | 'partenaire'

export interface RoleInfo {
  benevole_id: string
  role: Role
  prenom: string
  nom: string
}

/**
 * Retourne les infos de role de l'utilisateur connecte.
 * Retourne null si non connecte ou non trouve.
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

// superadmin a acces a tout
export const isSuperAdmin = (role: Role) => role === 'superadmin'

// admin inclut superadmin (retrocompatible avec tout le code existant)
export const isAdmin = (role: Role) => role === 'superadmin' || role === 'admin'

export const isAdminOrCoord = (role: Role) => role === 'superadmin' || role === 'admin' || role === 'coordonnateur'

// Partenaires
export const isPartenaire = (role: Role) => role === 'partenaire' || role === 'partenaire_chef'
export const isPartenaireChef = (role: Role) => role === 'partenaire_chef'
