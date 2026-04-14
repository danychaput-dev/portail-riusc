// utils/audit.ts
// Helper pour identifier l'auteur d'une mutation cote API service_role.
// A appeler AVANT chaque update/delete dans une API route admin pour que
// le trigger audit_capture() puisse stocker l'auteur dans audit_log.
//
// Usage:
//   import { setActingUser } from '@/utils/audit'
//   await setActingUser(supabaseAdmin, caller.user.id, caller.user.email)
//   await supabaseAdmin.from('reservistes').update(...)

import type { SupabaseClient } from '@supabase/supabase-js'

export async function setActingUser(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  email: string | null | undefined
): Promise<void> {
  if (!userId && !email) return
  try {
    await supabase.rpc('audit_set_acting_user', {
      p_user_id: userId ?? null,
      p_email: email ?? null,
    })
  } catch (e) {
    // Ne pas bloquer la mutation si l'audit echoue (best effort)
    console.warn('[audit] setActingUser failed:', e)
  }
}
