// app/api/admin/pointage/sessions/[id]/export/route.ts
// GET — export XLSX des pointages d'une session
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierRole() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur', 'partenaire', 'partenaire_lect'].includes(res.role)) return null
  return res
}

function formatLocalISO(iso: string | null): string {
  if (!iso) return ''
  // Le serveur Vercel est en UTC → on force le fuseau Montréal pour l'export Excel
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montreal',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

function formatDureeHM(min: number | null): string {
  if (min === null || min === undefined) return ''
  const h = Math.floor(min / 60)
  const m = Math.floor(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id: sessionId } = await ctx.params
  const { searchParams } = new URL(req.url)
  const includeAnnule = searchParams.get('include_annule') === 'true'

  const { data: session } = await supabaseAdmin
    .from('pointage_sessions')
    .select('contexte_nom, contexte_dates, contexte_lieu, shift, date_shift, approuveur_id')
    .eq('id', sessionId)
    .single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  // Aucune restriction par approuveur_id pour les partenaires (2026-04-23):
  // tout partenaire peut exporter les pointages (cas: Laurence absente, collègue
  // partenaire prend le relais).

  let query = supabaseAdmin
    .from('pointages')
    .select('benevole_id, heure_arrivee, heure_depart, duree_minutes, statut, source, notes, approuve_par, approuve_at')
    .eq('pointage_session_id', sessionId)
    .order('heure_arrivee', { ascending: true, nullsFirst: false })

  if (!includeAnnule) query = query.neq('statut', 'annule')

  const { data: pointages } = await query

  // Enrichir avec réservistes
  const bIds = Array.from(new Set((pointages || []).flatMap((p: any) => [p.benevole_id, p.approuve_par].filter(Boolean))))
  const { data: resList } = bIds.length > 0
    ? await supabaseAdmin.from('reservistes').select('benevole_id, prenom, nom, email').in('benevole_id', bIds)
    : { data: [] }
  const resMap: Record<string, { prenom: string; nom: string; email: string }> = {}
  for (const r of (resList || [])) resMap[(r as any).benevole_id] = { prenom: (r as any).prenom, nom: (r as any).nom, email: (r as any).email }

  const entetes = ['Prénom', 'Nom', 'Courriel', 'Arrivée', 'Départ', 'Durée (h:mm)', 'Durée (min)', 'Statut', 'Source', 'Approuvé par', 'Approuvé le', 'Notes']
  const rows = (pointages || []).map((p: any) => {
    const r = resMap[p.benevole_id]
    const approuveur = p.approuve_par ? resMap[p.approuve_par] : null
    return [
      r?.prenom || '',
      r?.nom || '',
      r?.email || '',
      formatLocalISO(p.heure_arrivee),
      formatLocalISO(p.heure_depart),
      formatDureeHM(p.duree_minutes),
      p.duree_minutes ?? '',
      p.statut || '',
      p.source || '',
      approuveur ? `${approuveur.prenom} ${approuveur.nom}` : '',
      formatLocalISO(p.approuve_at),
      p.notes || '',
    ]
  })

  // Construire XLSX
  const ws = XLSX.utils.aoa_to_sheet([entetes, ...rows])
  ws['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 18 },
    { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 18 }, { wch: 40 },
  ]
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: entetes.length - 1 } }) }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pointages')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const slug = (session.contexte_nom || 'pointages')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const suffix = [session.shift, session.date_shift].filter(Boolean).join('-')
  const filename = `pointages-${slug}${suffix ? '-' + suffix : ''}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
