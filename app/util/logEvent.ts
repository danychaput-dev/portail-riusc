// app/utils/logEvent.ts
// ============================================
// RIUSC — Utilitaire de logging des événements
// ============================================

import { createClient } from '@/app/utils/supabase/client';

export type EventType =
  | 'login_email'
  | 'login_sms'
  | 'login_debug'
  | 'login_failed'
  | 'logout'
  | 'session_expired'
  | 'page_visit';

interface LogEventParams {
  eventType: EventType;
  email?: string | null;
  telephone?: string | null;
  userId?: string | null;
  authMethod?: string | null;
  pageVisited?: string | null;
  metadata?: Record<string, any>;
}

export async function logEvent({
  eventType,
  email,
  telephone,
  userId,
  authMethod,
  pageVisited,
  metadata = {},
}: LogEventParams) {
  try {
    const supabase = createClient();

    // Récupérer le user courant si pas fourni
    if (!userId || !email) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = userId || user.id;
        email = email || user.email || null;
        telephone = telephone || user.phone || null;
      }
    }

    const { error } = await supabase.from('auth_logs').insert({
      user_id: userId || null,
      email: email || null,
      telephone: telephone || null,
      event_type: eventType,
      auth_method: authMethod || null,
      page_visited: pageVisited || null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      metadata,
    });

    if (error) {
      // Silent fail — on ne veut pas que le logging casse l'UX
      console.warn('[auth_logs] Erreur insert:', error.message);
    }
  } catch (err) {
    // Silent fail
    console.warn('[auth_logs] Exception:', err);
  }
}

// ============================================
// Hook pour logger les visites de pages
// Usage: appeler usePageLog('/formation') dans chaque page
// ============================================
export function logPageVisit(page: string) {
  // Fire and forget — ne bloque pas le rendu
  logEvent({
    eventType: 'page_visit',
    pageVisited: page,
  });
}
