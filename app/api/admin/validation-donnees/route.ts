import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ─── Configuration ─────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DESTINATAIRES = ['dany.chaput@aqbrs.ca', 'Esther.Lapointe@aqbrs.ca']
const FROM_EMAIL = 'RIUSC <portail@aqbrs.ca>'

// Champs obligatoires pour un reserviste approuve
const CHAMPS_OBLIGATOIRES: { colonne: string; label: string }[] = [
  { colonne: 'date_naissance', label: 'Date de naissance' },
  { colonne: 'adresse', label: 'Adresse' },
  { colonne: 'telephone', label: 'Telephone' },
  { colonne: 'ville', label: 'Ville' },
  { colonne: 'region', label: 'Region' },
  { colonne: 'contact_urgence_nom', label: 'Contact urgence (nom)' },
  { colonne: 'contact_urgence_telephone', label: 'Contact urgence (telephone)' },
]

// ─── Types internes ────────────────────────────────────────────────────────

interface DoublonResult {
  cle: string
  items: { benevole_id: string; prenom: string; nom: string; email: string; ville: string; groupe: string }[]
}

interface ChampManquantResult {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  groupe: string
  champs_manquants: string[]
}

interface ValidationResult {
  doublons_email: DoublonResult[]
  doublons_nom: DoublonResult[]
  champs_manquants: ChampManquantResult[]
  total_reservistes: number
  total_approuves: number
  date_validation: string
}

// ─── Logique de validation ─────────────────────────────────────────────────

export async function validerDonnees(): Promise<ValidationResult> {
  const now = new Date().toISOString()

  // Recuperer tous les reservistes actifs (via la vue qui exclut la corbeille)
  // IMPORTANT: .range(0, 4999) pour depasser la limite par defaut de 1000 lignes Supabase.
  // Sans ca, la detection de doublons (email/telephone) tronque silencieusement au-dela
  // de 1000 reservistes et rate des duplicates.
  const { data: reservistes, error } = await supabaseAdmin
    .from('reservistes_actifs')
    .select('benevole_id, prenom, nom, email, telephone, date_naissance, adresse, ville, region, groupe, statut, contact_urgence_nom, contact_urgence_telephone')
    .in('statut', ['Actif', 'Inactif'])
    .range(0, 4999)

  if (error || !reservistes) {
    throw new Error(`Erreur Supabase: ${error?.message || 'aucune donnee'}`)
  }

  // 1. Doublons par email
  const emailMap = new Map<string, typeof reservistes>()
  for (const r of reservistes) {
    if (!r.email) continue
    const key = r.email.trim().toLowerCase()
    if (!emailMap.has(key)) emailMap.set(key, [])
    emailMap.get(key)!.push(r)
  }

  const doublons_email: DoublonResult[] = []
  for (const [email, items] of emailMap) {
    if (items.length > 1) {
      doublons_email.push({
        cle: email,
        items: items.map(r => ({
          benevole_id: r.benevole_id,
          prenom: r.prenom,
          nom: r.nom,
          email: r.email,
          ville: r.ville || '',
          groupe: r.groupe || '',
        }))
      })
    }
  }

  // 2. Doublons par nom (meme prenom+nom ET meme ville ou meme email)
  const nomMap = new Map<string, typeof reservistes>()
  for (const r of reservistes) {
    const key = `${r.prenom?.trim()} ${r.nom?.trim()}`.toLowerCase()
    if (!nomMap.has(key)) nomMap.set(key, [])
    nomMap.get(key)!.push(r)
  }

  const doublons_nom: DoublonResult[] = []
  for (const [nom, items] of nomMap) {
    if (items.length <= 1) continue

    // Verifier si c'est un vrai doublon (meme email ou meme ville)
    let isDoublon = false
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const memeEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()
        const memeVille = a.ville && b.ville && a.ville.toLowerCase() === b.ville.toLowerCase()
        if (memeEmail || memeVille) {
          isDoublon = true
          break
        }
      }
      if (isDoublon) break
    }

    if (isDoublon) {
      doublons_nom.push({
        cle: nom,
        items: items.map(r => ({
          benevole_id: r.benevole_id,
          prenom: r.prenom,
          nom: r.nom,
          email: r.email,
          ville: r.ville || '',
          groupe: r.groupe || '',
        }))
      })
    }
  }

  // 3. Champs manquants pour les reservistes approuves
  const approuves = reservistes.filter(r => r.groupe === 'Approuvé')
  const champs_manquants: ChampManquantResult[] = []

  for (const r of approuves) {
    const manquants: string[] = []
    for (const champ of CHAMPS_OBLIGATOIRES) {
      const val = r[champ.colonne as keyof typeof r]
      if (!val || (typeof val === 'string' && val.trim() === '')) {
        manquants.push(champ.label)
      }
    }
    if (manquants.length > 0) {
      champs_manquants.push({
        benevole_id: r.benevole_id,
        prenom: r.prenom,
        nom: r.nom,
        email: r.email,
        groupe: r.groupe || '',
        champs_manquants: manquants,
      })
    }
  }

  return {
    doublons_email,
    doublons_nom,
    champs_manquants,
    total_reservistes: reservistes.length,
    total_approuves: approuves.length,
    date_validation: now,
  }
}

// ─── Generation du rapport HTML ────────────────────────────────────────────

export function genererRapportHtml(result: ValidationResult): { html: string; subject: string } {
  const totalProblemes = result.doublons_email.length + result.doublons_nom.length + result.champs_manquants.length

  if (totalProblemes === 0) {
    return {
      subject: 'Validation donnees - Aucun probleme',
      html: `
        <html><body style="font-family: Arial, sans-serif; margin: 20px;">
          <h2 style="color: green;">Aucun probleme detecte</h2>
          <p>Tout est en ordre dans la base de donnees du portail RIUSC.</p>
          <p><strong>Reservistes verifies:</strong> ${result.total_reservistes}</p>
          <p><strong>Approuves verifies:</strong> ${result.total_approuves}</p>
          <p><em>Verification effectuee le ${new Date(result.date_validation).toLocaleDateString('fr-CA')}</em></p>
        </body></html>
      `
    }
  }

  let html = `
    <html><head><style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
      h2 { color: #1B4F72; }
      h3 { color: #2E86C1; margin-top: 30px; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }
      th { background-color: #1B4F72; color: white; }
      .danger { background-color: #f8d7da; }
      .warning { background-color: #fff3cd; }
      .info { background-color: #d1ecf1; padding: 12px; margin: 10px 0; border-radius: 5px; }
      .count { font-weight: bold; color: #d9534f; }
    </style></head><body>
      <h2>Rapport de validation - Portail RIUSC</h2>
      <p><strong>Date:</strong> ${new Date(result.date_validation).toLocaleDateString('fr-CA')} ${new Date(result.date_validation).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</p>
      <div class="info">
        <strong>Reservistes verifies:</strong> ${result.total_reservistes} |
        <strong>Approuves:</strong> ${result.total_approuves}
      </div>
      <p class="count">Problemes detectes: ${totalProblemes}</p>
  `

  // Doublons par email
  if (result.doublons_email.length > 0) {
    html += `<h3>Doublons par courriel (${result.doublons_email.length})</h3>
      <table><tr><th>Courriel</th><th>Noms</th><th>Villes</th><th>Groupes</th><th>IDs</th></tr>`
    for (const d of result.doublons_email) {
      html += `<tr class="danger">
        <td>${d.cle}</td>
        <td>${d.items.map(i => `${i.prenom} ${i.nom}`).join('<br>')}</td>
        <td>${d.items.map(i => i.ville || '(vide)').join('<br>')}</td>
        <td>${d.items.map(i => i.groupe || '(vide)').join('<br>')}</td>
        <td>${d.items.map(i => i.benevole_id).join('<br>')}</td>
      </tr>`
    }
    html += '</table>'
  }

  // Doublons par nom
  if (result.doublons_nom.length > 0) {
    html += `<h3>Doublons par nom (${result.doublons_nom.length})</h3>
      <p><em>Meme nom avec meme courriel ou meme ville</em></p>
      <table><tr><th>Nom</th><th>Courriels</th><th>Villes</th><th>Groupes</th><th>IDs</th></tr>`
    for (const d of result.doublons_nom) {
      html += `<tr class="warning">
        <td>${d.cle}</td>
        <td>${d.items.map(i => i.email || '(vide)').join('<br>')}</td>
        <td>${d.items.map(i => i.ville || '(vide)').join('<br>')}</td>
        <td>${d.items.map(i => i.groupe || '(vide)').join('<br>')}</td>
        <td>${d.items.map(i => i.benevole_id).join('<br>')}</td>
      </tr>`
    }
    html += '</table>'
  }

  // Champs manquants
  if (result.champs_manquants.length > 0) {
    // Trier: ceux avec le plus de champs manquants en premier
    const sorted = [...result.champs_manquants].sort((a, b) => b.champs_manquants.length - a.champs_manquants.length)

    html += `<h3>Champs manquants - Reservistes approuves (${result.champs_manquants.length})</h3>
      <table><tr><th>Nom</th><th>Courriel</th><th>Champs manquants</th><th>Nb</th></tr>`
    for (const m of sorted) {
      const rowClass = m.champs_manquants.length >= 3 ? 'danger' : 'warning'
      html += `<tr class="${rowClass}">
        <td>${m.prenom} ${m.nom}</td>
        <td>${m.email || '(vide)'}</td>
        <td>${m.champs_manquants.join(', ')}</td>
        <td>${m.champs_manquants.length}</td>
      </tr>`
    }
    html += '</table>'
  }

  html += `
    <hr>
    <p><em>Ce rapport est genere automatiquement depuis le Portail RIUSC.</em></p>
    </body></html>
  `

  const subject = totalProblemes > 5
    ? `Validation donnees - ${totalProblemes} probleme(s) detecte(s)`
    : `Validation donnees - ${totalProblemes} probleme(s)`

  return { html, subject }
}

// ─── API Handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const envoyer = searchParams.get('envoyer') === 'true'

    // Executer les validations
    const result = await validerDonnees()

    // Envoyer par courriel si demande
    if (envoyer) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { html, subject } = genererRapportHtml(result)

      const { error: emailError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: DESTINATAIRES,
        subject,
        html,
      })

      if (emailError) {
        return NextResponse.json(
          { ...result, email_error: emailError.message },
          { status: 207 }
        )
      }

      return NextResponse.json({ ...result, email_envoye: true })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
