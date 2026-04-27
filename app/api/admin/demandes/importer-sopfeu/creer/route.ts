// app/api/admin/demandes/importer-sopfeu/creer/route.ts
// Crée un sinistre + une demande SOPFEU à partir de l'objet parsé (édité) par
// l'admin dans le preview. Pose ensuite le contexte du wizard opérations pour
// que la redirection vers /admin/operations reprenne là où on s'arrête.
//
// Notes migration:
// - Les champs SOPFEU sans colonne DB dédiée (évolution, météo, charge mentale,
//   contact site, stationnement, alimentation, installations, connectivité)
//   sont CONCATÉNÉS dans demandes.description ou deployments.notes_logistique
//   via formatBlocExtras(). Quand les migrations seront rollées, on pourra les
//   extraire dans leurs propres colonnes.
// - Les effectifs par rôle ne sont pas persistés (table demandes_effectifs pas
//   encore créée). On retient seulement la somme dans nb_personnes_requis.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'
import type { ParsedSopfeu } from '@/types/sopfeu-import'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuthAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabase
    .from('reservistes')
    .select('role, benevole_id')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return { user, benevole_id: res.benevole_id }
}

// ─── Helpers naming (reprise de app/admin/operations/helpers.ts mais côté server) ──

function orgAbbr(o: string): string {
  const map: Record<string, string> = {
    'Croix-Rouge': 'CR', 'Municipalité': 'MUN', 'SOPFEU': 'SPF', 'Gouvernement du Québec': 'GQC',
  }
  return map[o] || o.slice(0, 3).toUpperCase()
}

function slugCourt(s: string, max = 20): string {
  return (s || '').trim().slice(0, max).trim()
}

function genNomSinistre(type: string, lieu: string, date: string): string {
  const d = date || new Date().toISOString().slice(0, 10)
  const t = slugCourt(type.replace(/\s+/g, '-'), 20)
  const l = slugCourt(lieu.split(',')[0].trim().replace(/\s+/g, '-'), 20)
  return [d, t, l].filter(Boolean).join('-')
}

function genDemandeIdentifiant(nbDemandesExistantes: number, organisme: string, date: string): string {
  const n = (nbDemandesExistantes + 1).toString().padStart(3, '0')
  const d = date ? date.replace(/-/g, '').slice(2) : 'XXXXXX'
  return `DEM-${n}-${orgAbbr(organisme)}-${d}`
}

// ─── Composition des champs sans colonne dédiée ──────────────────────────────

function composeNonNull(parts: Array<[string, string]>): string {
  return parts
    .filter(([, v]) => v && v.trim().length > 0)
    .map(([label, v]) => `**${label}**\n${v.trim()}`)
    .join('\n\n')
}

function composeDescription(p: ParsedSopfeu): string {
  const blocs: Array<[string, string]> = [
    ["Description de l'événement", p.description_evenement],
    ['Évolution attendue', p.evolution_attendue],
    ['Au profit de', p.au_profit_de],
    ['Principales tâches', p.principales_taches],
    ['Précisions mandat', p.mandat_autres_precisions],
    ['Météo prévue', p.meteo],
    ['Amplitudes horaires', p.amplitudes_horaires],
    ['Enjeux santé/sécurité', p.enjeux_sst],
    ['Charge mentale', p.charge_mentale],
    ['Précisions conditions', p.conditions_autres],
  ]
  return composeNonNull(blocs) || '(Aucune description fournie dans le gabarit SOPFEU)'
}

function composeNotesLogistique(p: ParsedSopfeu): string {
  const contactSite = [
    p.contact_site_prenom, p.contact_site_nom, p.contact_site_fonction
  ].filter(Boolean).join(' — ')
  const telsSite = [p.contact_site_tel_1, p.contact_site_tel_2].filter(Boolean).join(' / ')

  const blocs: Array<[string, string]> = [
    ['Durée minimale de disponibilité', p.duree_min_dispo],
    ['Heure de rendez-vous', p.rdv_heure],
    ['Stationnement véhicules personnels', p.stationnement],
    ['Contact sur site', [contactSite, telsSite, p.contact_site_courriel].filter(Boolean).join('\n')],
    ['Précisions RDV', p.rdv_autres_precisions],
    ['Alimentation', p.alimentation],
    ['Installations', p.installations],
    ['Connectivité', p.connectivite],
    ['Précisions services', p.services_autres],
  ]
  return composeNonNull(blocs)
}

function sommeEffectifs(p: ParsedSopfeu): number {
  return p.effectifs.reduce((acc, e) => acc + (e.nombre || 0), 0)
}

function toutesCapacites(p: ParsedSopfeu): string[] {
  const set = new Set<string>()
  for (const e of p.effectifs) {
    for (const c of e.capacites) if (c) set.add(c)
  }
  return Array.from(set)
}

// ─── Route ───────────────────────────────────────────────────────────────────

interface CreerPayload {
  parsed: ParsedSopfeu
  // Overrides saisis par l'admin dans le preview (type_incident est obligatoire
  // car pas toujours déductible de la "Nature de la demande" SOPFEU).
  type_incident: string
  type_mission: string
  priorite?: string  // 'Urgente' | 'Haute' | 'Normale' | 'Basse'
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthAdmin()
    if (!caller) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const payload = (await req.json()) as CreerPayload
    const { parsed, type_incident, type_mission, priorite = 'Normale' } = payload

    if (!parsed) return NextResponse.json({ error: 'Données parsées manquantes' }, { status: 400 })
    if (!type_incident) return NextResponse.json({ error: 'type_incident requis' }, { status: 400 })
    if (!type_mission) return NextResponse.json({ error: 'type_mission requis' }, { status: 400 })
    if (!parsed.lieu_intervention) return NextResponse.json({ error: "Lieu de l'intervention absent — requis." }, { status: 400 })
    if (!parsed.description_evenement) return NextResponse.json({ error: "Description de l'événement absente — requise." }, { status: 400 })

    const dateDebut = parsed.rdv_date || new Date().toISOString().slice(0, 10)

    await setActingUser(supabaseAdmin, caller.user.id, caller.user.email)

    // 1. Sinistre
    const nomSinistre = genNomSinistre(type_incident, parsed.lieu_intervention, dateDebut)
    const { data: sinistre, error: sinErr } = await supabaseAdmin
      .from('sinistres')
      .insert({
        nom: nomSinistre,
        type_incident,
        lieu: parsed.lieu_intervention,
        date_debut: dateDebut,
        statut: 'Actif',
      })
      .select('id, nom')
      .single()

    if (sinErr || !sinistre) {
      return NextResponse.json({ error: `Création sinistre: ${sinErr?.message || 'erreur'}` }, { status: 500 })
    }

    // 2. Demande
    const { count: nbDemandes } = await supabaseAdmin
      .from('demandes')
      .select('*', { count: 'exact', head: true })

    const identifiant = genDemandeIdentifiant(nbDemandes ?? 0, 'SOPFEU', dateDebut)
    const contactNomComplet = [parsed.contact_cpo_prenom, parsed.contact_cpo_nom].filter(Boolean).join(' ')

    const { data: demande, error: demErr } = await supabaseAdmin
      .from('demandes')
      .insert({
        sinistre_id: sinistre.id,
        identifiant,
        organisme: 'SOPFEU',
        organisme_detail: parsed.numero_intervention ? `N° intervention: ${parsed.numero_intervention}` : null,
        type_mission,
        type_mission_detail: parsed.nature_demande || null,
        description: composeDescription(parsed),
        lieu: parsed.lieu_intervention,
        nb_personnes_requis: sommeEffectifs(parsed) || null,
        competences_requises: toutesCapacites(parsed),
        date_debut: dateDebut,
        date_fin_estimee: null,  // non fourni par SOPFEU; à saisir dans le wizard
        priorite,
        statut: 'Nouvelle',
        date_reception: new Date().toISOString(),
        contact_nom: contactNomComplet || null,
        contact_titre: parsed.contact_cpo_fonction || null,
        contact_telephone: parsed.contact_cpo_tel_1 || null,
        contact_email: parsed.contact_cpo_courriel || null,
      })
      .select('id, identifiant')
      .single()

    if (demErr || !demande) {
      // Rollback manuel du sinistre (pas de transactions côté client Supabase)
      await supabaseAdmin.from('sinistres').delete().eq('id', sinistre.id)
      return NextResponse.json({ error: `Création demande: ${demErr?.message || 'erreur'}` }, { status: 500 })
    }

    // 3. Poser le contexte du wizard opérations
    const notesLogistique = composeNotesLogistique(parsed)
    await supabaseAdmin
      .from('operations_wizard_state')
      .upsert({
        sinistre_id: sinistre.id,
        demande_ids: [demande.id],
        deployment_id: null,
        msg_notif: notesLogistique || null,  // stash des infos logistique pour affichage étape 3
        updated_by_user_id: caller.user.id,
        updated_by_email: caller.user.email,
      })

    return NextResponse.json({
      ok: true,
      sinistre: { id: sinistre.id, nom: sinistre.nom },
      demande: { id: demande.id, identifiant: demande.identifiant },
      redirect: `/admin/operations?sin=${sinistre.id}&dems=${demande.id}`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erreur interne' }, { status: 500 })
  }
}
