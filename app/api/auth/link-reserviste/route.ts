// app/api/auth/link-reserviste/route.ts
//
// POST — lie reservistes.user_id à auth.users.id pour l'utilisateur authentifié.
//
// CAS D'USAGE
// -----------
// Appelé par PortailHeader.tsx quand le lookup normal par user_id échoue, pour
// guérir les cas legacy où reservistes.user_id ne matche pas auth.users.id
// (réservistes pré-créés avec l'ancien DEFAULT gen_random_uuid() avant que
// l'auth.users correspondant n'existe, ou importés depuis Monday, etc.).
//
// POURQUOI CETTE ROUTE EXISTE
// ---------------------------
// Le self-heal client-side dans PortailHeader.tsx est bloqué par la RLS sur
// reservistes qui exige user_id = auth.uid(). Quand le user_id est desync, la
// RLS refuse même un simple SELECT sur la ligne à réparer → loop permanent.
// Cette route utilise service_role pour bypasser cette RLS proprement, en se
// limitant strictement à la liaison du user authentifié à SON profil via
// match d'email ou téléphone (case-insensitive).
//
// SÉCURITÉ
// --------
// - Exige un user authentifié (session Supabase valide).
// - Ne crée jamais de nouveau réserviste — se contente de lier un profil
//   existant par match d'email ou téléphone.
// - Match strict : un seul réserviste actif (deleted_at IS NULL) doit matcher.
//   Si plusieurs, refuse et renvoie 409.
// - N'écrase pas un user_id déjà correctement lié à un AUTRE auth.users.
//
// RÉPONSES
// --------
// { ok: true, benevole_id, action: 'already_linked' | 'linked' | 'relinked' }
// { error, status: 401 | 404 | 409 | 500 }

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ReservisteMin {
  benevole_id: string
  user_id: string | null
  email: string | null
  telephone: string | null
}

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // ─── 1. Déjà lié correctement? Rien à faire. ─────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, user_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      ok: true,
      benevole_id: existing.benevole_id,
      action: 'already_linked',
    })
  }

  // ─── 2. Chercher un réserviste actif matchant email ou téléphone ─────
  const candidates: ReservisteMin[] = []

  if (user.email) {
    const { data } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, user_id, email, telephone')
      .ilike('email', user.email)
      .is('deleted_at', null)
    if (data) candidates.push(...(data as ReservisteMin[]))
  }

  if (candidates.length === 0 && user.phone) {
    const digits = user.phone.replace(/\D/g, '')
    const variants = new Set<string>([digits])
    if (digits.startsWith('1')) variants.add(digits.slice(1))
    if (!digits.startsWith('1') && digits.length === 10) variants.add('1' + digits)

    // On normalise côté DB avec regexp_replace pour matcher peu importe le formatage
    const { data } = await supabaseAdmin
      .rpc('match_reservistes_by_phone_digits', { phone_variants: Array.from(variants) })
      .then(r => r as any)
      .catch(() => ({ data: null } as any))

    // Fallback si la RPC n'existe pas : fetch en mémoire (plus lourd mais robuste)
    if (!data) {
      const { data: all } = await supabaseAdmin
        .from('reservistes')
        .select('benevole_id, user_id, email, telephone')
        .is('deleted_at', null)
      ;(all || []).forEach((r: any) => {
        const rDigits = (r.telephone || '').replace(/\D/g, '')
        if (variants.has(rDigits)) candidates.push(r)
      })
    } else {
      candidates.push(...(data as ReservisteMin[]))
    }
  }

  // Déduplication par benevole_id (au cas où email ET téléphone matchent le même)
  const uniqueByBenevole = Array.from(
    new Map(candidates.map(c => [c.benevole_id, c])).values()
  )

  if (uniqueByBenevole.length === 0) {
    return NextResponse.json({
      error: 'Aucun profil réserviste correspondant',
      searched: { email: user.email, phone: user.phone },
    }, { status: 404 })
  }

  if (uniqueByBenevole.length > 1) {
    return NextResponse.json({
      error: 'Plusieurs profils réservistes correspondent — résolution manuelle requise',
      candidates: uniqueByBenevole.map(c => c.benevole_id),
    }, { status: 409 })
  }

  const target = uniqueByBenevole[0]

  // ─── 3. Safety: ne pas écraser un user_id déjà lié à un autre auth ───
  if (target.user_id && target.user_id !== user.id) {
    // Vérifier si c'est un UUID fantôme (pas de auth.users correspondant) → OK d'écraser
    const { data: { user: existingAuth } } = await supabaseAdmin.auth.admin.getUserById(target.user_id)
      .catch(() => ({ data: { user: null } } as any))

    if (existingAuth) {
      return NextResponse.json({
        error: 'Ce profil réserviste est déjà lié à un autre compte auth',
        benevole_id: target.benevole_id,
      }, { status: 409 })
    }
    // Sinon c'est un fantôme, on écrase
  }

  // ─── 4. Liaison ──────────────────────────────────────────────────────
  await setActingUser(supabaseAdmin, user.id, user.email)

  const { error: updateErr } = await supabaseAdmin
    .from('reservistes')
    .update({ user_id: user.id, updated_at: new Date().toISOString() })
    .eq('benevole_id', target.benevole_id)

  if (updateErr) {
    return NextResponse.json({
      error: `Échec de la liaison: ${updateErr.message}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    benevole_id: target.benevole_id,
    action: target.user_id ? 'relinked' : 'linked',
    previous_user_id: target.user_id,
  })
}
