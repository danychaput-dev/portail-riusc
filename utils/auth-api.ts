// utils/auth-api.ts
// Helper d'authentification pour les API routes (server-side)
// Utilise le cookie de session Supabase pour valider l'utilisateur

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Role } from '@/utils/role'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AuthResult {
  user_id: string
  benevole_id: string
  role: Role
}

/**
 * Verifie la session de l'utilisateur et retourne ses infos.
 * Retourne null si non authentifie.
 */
export async function getAuthUser(): Promise<AuthResult | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() { /* read-only dans les API routes */ },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabaseAdmin
      .from('reservistes_actifs')
      .select('benevole_id, role')
      .eq('user_id', user.id)
      .single()

    if (!data) return null

    return {
      user_id: user.id,
      benevole_id: data.benevole_id,
      role: data.role as Role,
    }
  } catch {
    return null
  }
}

/**
 * Verifie qu'un utilisateur est authentifie.
 * Retourne AuthResult ou une NextResponse 401.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const auth = await getAuthUser()
  if (!auth) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }
  return auth
}

/**
 * Verifie qu'un utilisateur a un des roles requis.
 * Retourne AuthResult ou une NextResponse 401/403.
 */
export async function requireRole(...roles: Role[]): Promise<AuthResult | NextResponse> {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  if (!roles.includes(auth.role)) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
  }
  return auth
}

/** Helper : est-ce une erreur (NextResponse) ou un AuthResult? */
export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
