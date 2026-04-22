// app/admin/operations/wizardState.ts
//
// Persistance de l'etat du wizard Operations par sinistre, cote DB.
// Remplace le localStorage pour supporter multi-device et multi-admin.

import { createClient } from '@/utils/supabase/client'

export interface WizardStateRow {
  sinistre_id: string
  demande_ids: string[]
  deployment_id: string | null
  msg_notif: string | null
  updated_at: string
  updated_by_user_id: string | null
  updated_by_email: string | null
}

export interface WizardStatePayload {
  demande_ids: string[]
  deployment_id: string | null
  msg_notif: string | null
}

export async function fetchWizardState(sinistreId: string): Promise<WizardStateRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('operations_wizard_state')
    .select('*')
    .eq('sinistre_id', sinistreId)
    .maybeSingle()
  if (error) {
    console.error('fetchWizardState error:', error)
    return null
  }
  return (data as WizardStateRow | null) ?? null
}

export async function saveWizardState(
  sinistreId: string,
  payload: WizardStatePayload,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user

  const row = {
    sinistre_id: sinistreId,
    demande_ids: payload.demande_ids,
    deployment_id: payload.deployment_id,
    msg_notif: payload.msg_notif,
    updated_at: new Date().toISOString(),
    updated_by_user_id: user?.id ?? null,
    updated_by_email: user?.email ?? null,
  }

  const { error } = await supabase
    .from('operations_wizard_state')
    .upsert(row, { onConflict: 'sinistre_id' })

  if (error) {
    console.error('saveWizardState error:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function deleteWizardState(sinistreId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('operations_wizard_state')
    .delete()
    .eq('sinistre_id', sinistreId)
  if (error) {
    console.error('deleteWizardState error:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
