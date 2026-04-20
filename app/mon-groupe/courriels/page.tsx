'use client'

/**
 * /mon-groupe/courriels
 *
 * Page réservée aux responsables de groupes R&S. Affiche les courriels envoyés
 * aux membres de leurs groupes dans les 90 derniers jours, avec le statut
 * individuel (envoyé / ouvert / rebondi / répondu).
 *
 * Le responsable peut relancer les non-ouverts via un mailto: qui ouvre son
 * propre client courriel — la relance part donc de son adresse réelle, pas
 * du système, ce qui simplifie la gestion des droits.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PortailHeader from '@/app/components/PortailHeader'

const C = '#1e3a5f'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'
const GREEN = '#059669'
const AMBER = '#d97706'
const RED = '#dc2626'

interface Groupe { id: string; nom: string; district: number }

interface Destinataire {
  courriel_id: string
  benevole_id: string
  prenom: string
  nom: string
  email: string
  statut: string
  ouvert_at: string | null
  clics_count: number
  has_reply: boolean | null
}

interface CourrielGroup {
  key: string
  campagne_id: string | null
  subject: string
  body_html: string
  from_name: string
  from_email: string
  created_at: string
  destinataires: Destinataire[]
}

interface ApiResponse {
  is_responsable: boolean
  groupes: Groupe[]
  courriels: CourrielGroup[]
  fenetre_jours?: number
  error?: string
}

function dateFr(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
}

// Catégorise un statut de courriel pour un affichage visuel uniforme
function categorizeStatut(d: Destinataire): {
  txt: string; color: string; bg: string; estOuvert: boolean; estRebond: boolean
} {
  if (d.ouvert_at || d.statut === 'opened' || d.statut === 'clicked') {
    return { txt: '✅ Ouvert', color: GREEN, bg: '#ecfdf5', estOuvert: true, estRebond: false }
  }
  if (d.statut === 'bounced' || d.statut === 'rebond' || d.statut === 'failed') {
    return { txt: '❌ Rebondi', color: RED, bg: '#fef2f2', estOuvert: false, estRebond: true }
  }
  if (d.statut === 'complained') {
    return { txt: '⚠️ Plainte', color: RED, bg: '#fef2f2', estOuvert: false, estRebond: true }
  }
  if (d.statut === 'delivered' || d.statut === 'livre') {
    return { txt: '📨 Livré', color: '#1d4ed8', bg: '#eff6ff', estOuvert: false, estRebond: false }
  }
  if (d.statut === 'queued' || d.statut === 'sent' || d.statut === 'envoye') {
    return { txt: '⏳ Envoyé', color: AMBER, bg: '#fffbeb', estOuvert: false, estRebond: false }
  }
  return { txt: d.statut || '· inconnu', color: MUTED, bg: '#f1f5f9', estOuvert: false, estRebond: false }
}

// Génère un lien mailto: pour relancer les non-ouverts, avec BCC (pas To)
// pour ne pas exposer les adresses entre elles.
function genererMailto(subject: string, emails: string[]): string {
  const bcc = emails.filter(e => e && e.includes('@')).join(',')
  const sujet = `Rappel : ${subject}`
  const corps = [
    'Bonjour,',
    '',
    'Je suis responsable de ton groupe de recherche et sauvetage au sein du RIUSC.',
    '',
    `Tu as récemment reçu un courriel du RIUSC avec pour objet : « ${subject} ».`,
    'Je voulais m\'assurer que tu en as pris connaissance et je reste disponible si tu as des questions.',
    '',
    'Merci de ton implication !',
  ].join('\n')
  const qs = [
    `bcc=${encodeURIComponent(bcc)}`,
    `subject=${encodeURIComponent(sujet)}`,
    `body=${encodeURIComponent(corps)}`,
  ].join('&')
  return `mailto:?${qs}`
}

export default function MonGroupeCourrielsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [onlyWithUnread, setOnlyWithUnread] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/mon-groupe/courriels', { cache: 'no-store' })
        if (res.status === 401) { router.push('/login'); return }
        const json: ApiResponse = await res.json()
        if (json.error) setError(json.error)
        else setData(json)
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const courrielsAffiches = useMemo(() => {
    if (!data) return [] as CourrielGroup[]
    if (!onlyWithUnread) return data.courriels
    return data.courriels.filter(c => c.destinataires.some(d => !categorizeStatut(d).estOuvert))
  }, [data, onlyWithUnread])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
        <PortailHeader subtitle="Mon groupe — Courriels" />
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', flex: 1 }}>
          <div style={{ padding: 60, textAlign: 'center', color: MUTED, fontSize: 14 }}>Chargement…</div>
        </main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
        <PortailHeader subtitle="Mon groupe — Courriels" />
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', flex: 1 }}>
          <div style={{ padding: 40, backgroundColor: '#fee2e2', color: RED, borderRadius: 10 }}>
            {error || 'Erreur inconnue'}
          </div>
        </main>
      </div>
    )
  }

  if (!data.is_responsable) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
        <PortailHeader subtitle="Mon groupe — Courriels" />
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', flex: 1 }}>
          <div style={{ padding: 40, backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🚫</div>
            <h2 style={{ color: C, fontSize: 18, margin: '0 0 8px' }}>Réservé aux responsables de groupe</h2>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      <PortailHeader subtitle="Mon groupe — Courriels" />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', flex: 1, width: '100%' }}>

        {/* En-tête */}
        <div style={{ marginBottom: 20 }}>
          <a href="/mon-groupe" style={{ fontSize: 12, color: MUTED, textDecoration: 'none' }}>
            ← Retour à Mon groupe
          </a>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C, margin: '6px 0 6px' }}>
            📧 Courriels envoyés à mes membres
          </h1>
          <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>
            Courriels des {data.fenetre_jours || 90} derniers jours envoyés aux membres de
            ton/tes groupe(s). Tu peux voir qui a ouvert et relancer les non-ouverts
            avec ton propre client courriel.
          </p>
        </div>

        {/* Barre de filtres */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          padding: '10px 14px', marginBottom: 16,
          backgroundColor: 'white', borderRadius: 10, border: `1px solid ${BORDER}`,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyWithUnread} onChange={e => setOnlyWithUnread(e.target.checked)} style={{ accentColor: C }} />
            Seulement les courriels avec non-ouverts
          </label>
          <span style={{ fontSize: 12, color: MUTED, marginLeft: 'auto' }}>
            {courrielsAffiches.length} courriel{courrielsAffiches.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Liste des courriels */}
        {courrielsAffiches.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div style={{ color: C, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              Aucun courriel {onlyWithUnread ? 'avec non-ouverts' : 'aux membres de ton groupe'}
            </div>
            <div style={{ color: MUTED, fontSize: 13 }}>
              Quand les admins enverront des courriels à tes membres, ils apparaîtront ici.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {courrielsAffiches.map(c => (
              <CourrielCard
                key={c.key}
                courriel={c}
                expanded={expanded.has(c.key)}
                onToggle={() => setExpanded(prev => {
                  const next = new Set(prev)
                  next.has(c.key) ? next.delete(c.key) : next.add(c.key)
                  return next
                })}
              />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}

function CourrielCard({
  courriel, expanded, onToggle,
}: {
  courriel: CourrielGroup
  expanded: boolean
  onToggle: () => void
}) {
  const stats = useMemo(() => {
    let ouvert = 0, nonOuvert = 0, rebond = 0
    for (const d of courriel.destinataires) {
      const cat = categorizeStatut(d)
      if (cat.estRebond) rebond++
      else if (cat.estOuvert) ouvert++
      else nonOuvert++
    }
    return { total: courriel.destinataires.length, ouvert, nonOuvert, rebond }
  }, [courriel.destinataires])

  const nonOuvertsEmails = courriel.destinataires
    .filter(d => !categorizeStatut(d).estOuvert && !categorizeStatut(d).estRebond)
    .map(d => d.email)
    .filter(Boolean)

  const mailtoLink = nonOuvertsEmails.length > 0
    ? genererMailto(courriel.subject, nonOuvertsEmails)
    : null

  const pctOuvert = stats.total > 0 ? Math.round(stats.ouvert / stats.total * 100) : 0

  return (
    <div style={{ backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
      {/* En-tête cliquable */}
      <div
        onClick={onToggle}
        style={{
          padding: '14px 18px', cursor: 'pointer',
          display: 'flex', gap: 14, alignItems: 'center',
          borderBottom: expanded ? `1px solid ${BORDER}` : 'none',
        }}
      >
        <span style={{ fontSize: 14, color: MUTED, width: 12 }}>{expanded ? '▼' : '▶'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C, marginBottom: 3 }}>
            {courriel.subject}
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>
            {dateFr(courriel.created_at)} · expédié par {courriel.from_name}
            {courriel.campagne_id && <span> · 📢 Campagne</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            backgroundColor: '#ecfdf5', color: GREEN,
          }}>
            ✅ {stats.ouvert} ouvert{stats.ouvert > 1 ? 's' : ''}
          </span>
          {stats.nonOuvert > 0 && (
            <span style={{
              padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              backgroundColor: '#fffbeb', color: AMBER,
            }}>
              ⏳ {stats.nonOuvert} non-ouvert{stats.nonOuvert > 1 ? 's' : ''}
            </span>
          )}
          {stats.rebond > 0 && (
            <span style={{
              padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              backgroundColor: '#fef2f2', color: RED,
            }}>
              ❌ {stats.rebond}
            </span>
          )}
          <span style={{ fontSize: 11, color: MUTED, minWidth: 40, textAlign: 'right' }}>
            {pctOuvert}%
          </span>
        </div>
      </div>

      {/* Drill-down */}
      {expanded && (
        <div>
          {/* Action relance si au moins un non-ouvert */}
          {mailtoLink && (
            <div style={{ padding: '10px 18px', backgroundColor: '#fffbeb', borderBottom: `1px solid #fde68a`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#92400e' }}>
                {nonOuvertsEmails.length} membre{nonOuvertsEmails.length > 1 ? 's' : ''} n'ont pas encore ouvert ce courriel.
              </span>
              <a
                href={mailtoLink}
                style={{
                  marginLeft: 'auto', padding: '6px 14px',
                  backgroundColor: '#d97706', color: 'white',
                  borderRadius: 8, fontSize: 12, fontWeight: 700,
                  textDecoration: 'none',
                }}
                title="Ouvre ton client courriel avec la liste pré-remplie en BCC"
              >
                🔁 Relancer par mon courriel
              </a>
            </div>
          )}

          {/* Liste des destinataires */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={thStyle}>Membre</th>
                  <th style={thStyle}>Courriel</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Ouvert le</th>
                  <th style={thStyle}>Clics</th>
                </tr>
              </thead>
              <tbody>
                {courriel.destinataires.map(d => {
                  const cat = categorizeStatut(d)
                  return (
                    <tr key={d.courriel_id} style={{ borderTop: `1px solid #f3f4f6` }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: C }}>{d.prenom} {d.nom}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, color: MUTED }}>{d.email}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11,
                          backgroundColor: cat.bg, color: cat.color,
                        }}>{cat.txt}</span>
                        {d.has_reply && <span style={{ marginLeft: 6, fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>· 💬 a répondu</span>}
                      </td>
                      <td style={tdStyle}>
                        {d.ouvert_at ? <span style={{ fontSize: 11, color: MUTED }}>{dateFr(d.ouvert_at)}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        {d.clics_count > 0 ? (
                          <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600 }}>🔗 {d.clics_count}</span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left',
  fontSize: 10, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: `2px solid ${BORDER}`,
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 12, color: '#1e293b',
  verticalAlign: 'top',
}
