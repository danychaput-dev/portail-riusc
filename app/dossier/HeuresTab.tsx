'use client'

// app/dossier/HeuresTab.tsx
//
// Onglet « Mes heures » du dossier — rapport crédit d'impôt QC pour bénévoles
// R&S et pompiers volontaires.
//
// Règles (voir memory/project_credit_impot_heures.md) :
//   - Plancher obligatoire : 101h primaires (sur site, QR)
//   - Total requis        : primaires + secondaires ≥ 200h
//   - Éligibilité         : bénévole lié à une organisation flaggée eligible_credit_impot
//
// Si le bénévole n'est pas éligible (ex: réserviste RIUSC sans AQBRS/Pompiers) on
// affiche quand même les heures, mais sans jauge de qualification.

import { useEffect, useMemo, useState } from 'react'

const C = '#1e3a5f'
const GREEN = '#16a34a'
const AMBER = '#d97706'
const BLUE = '#2563eb'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

const SEUIL_PRIMAIRES_MIN = 101
const SEUIL_TOTAL_MIN = 200

interface Evenement {
  key: string
  type: 'camp' | 'deploiement'
  id: string
  nom: string
  dates: string | null
  lieu: string | null
  minutes_primaires_approuve: number
  minutes_primaires_total: number
  minutes_secondaires_approuve: number
  minutes_secondaires_total: number
  derniere_activite: string | null
}

interface Sommaire {
  eligible_credit_impot: boolean
  qualifie_credit_impot: boolean
  heures_primaires_approuve: number | string
  heures_primaires_total: number | string
  heures_secondaires_approuve: number | string
  heures_secondaires_total: number | string
}

export default function HeuresTab() {
  const [loading, setLoading] = useState(true)
  const [sommaire, setSommaire] = useState<Sommaire | null>(null)
  const [evenements, setEvenements] = useState<Evenement[]>([])

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/heures-benevoles/me', { cache: 'no-store' })
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        setSommaire(data.sommaire)
        setEvenements(data.evenements || [])
      } catch {
        // ignore
      }
      setLoading(false)
    })()
  }, [])

  const hPrimApprouve = Number(sommaire?.heures_primaires_approuve || 0)
  const hSecApprouve = Number(sommaire?.heures_secondaires_approuve || 0)
  const hPrimTotal = Number(sommaire?.heures_primaires_total || 0)
  const hSecTotal = Number(sommaire?.heures_secondaires_total || 0)
  const hTotalApprouve = hPrimApprouve + hSecApprouve
  const hTotalTotal = hPrimTotal + hSecTotal

  const pctPrimaires = Math.min(100, (hPrimApprouve / SEUIL_PRIMAIRES_MIN) * 100)
  const pctTotal = Math.min(100, (hTotalApprouve / SEUIL_TOTAL_MIN) * 100)

  const hPrimManquantes = Math.max(0, SEUIL_PRIMAIRES_MIN - hPrimApprouve)
  const hTotalManquantes = Math.max(0, SEUIL_TOTAL_MIN - hTotalApprouve)

  const exportCSV = () => {
    // Export CSV simple (Excel lit le CSV directement)
    const lignes = [
      ['Type', 'Nom', 'Dates', 'Lieu', 'Primaires (approuvées, h)', 'Primaires (incl. en attente, h)', 'Secondaires (approuvées, h)', 'Secondaires (incl. en attente, h)', 'Dernière activité'],
      ...evenements.map(e => [
        e.type === 'camp' ? 'Camp' : 'Déploiement',
        e.nom || '',
        e.dates || '',
        e.lieu || '',
        (e.minutes_primaires_approuve / 60).toFixed(2),
        (e.minutes_primaires_total / 60).toFixed(2),
        (e.minutes_secondaires_approuve / 60).toFixed(2),
        (e.minutes_secondaires_total / 60).toFixed(2),
        e.derniere_activite ? new Date(e.derniere_activite).toLocaleDateString('fr-CA') : '',
      ]),
      [],
      ['TOTAL (approuvées)', '', '', '', hPrimApprouve.toFixed(2), hPrimTotal.toFixed(2), hSecApprouve.toFixed(2), hSecTotal.toFixed(2), ''],
      ['Qualifié crédit impôt QC', sommaire?.qualifie_credit_impot ? 'OUI' : 'NON'],
    ]
    const csv = lignes.map(l =>
      l.map(c => {
        const s = String(c ?? '')
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    ).join('\n')
    // BOM UTF-8 pour qu'Excel affiche les accents correctement
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `heures-benevolat-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: MUTED }}>Chargement des heures…</div>
  }

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: 13, color: MUTED, marginBottom: 20 }}>
        {'Récapitulatif de tes heures de bénévolat pour le '}
        <strong>crédit d&apos;impôt du Québec</strong>
        {' (applicable aux bénévoles Recherche & Sauvetage et pompiers volontaires).'}
      </p>

      {/* Badge éligibilité / qualification */}
      {!sommaire?.eligible_credit_impot ? (
        <div style={{ padding: 16, backgroundColor: '#f1f5f9', border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: MUTED }}>ℹ️ Non éligible au crédit d&apos;impôt QC</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
            Le crédit d&apos;impôt s&apos;applique aux bénévoles <strong>R&amp;S (AQBRS)</strong> et <strong>pompiers volontaires</strong>.
            Si tu crois que c&apos;est une erreur, contacte un admin pour qu&apos;il ajoute l&apos;organisation à ton dossier.
          </div>
        </div>
      ) : sommaire?.qualifie_credit_impot ? (
        <div style={{ padding: 16, backgroundColor: '#dcfce7', border: `2px solid ${GREEN}`, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#065f46' }}>✅ Qualifié pour le crédit d&apos;impôt QC !</div>
          <div style={{ fontSize: 13, color: '#065f46', marginTop: 4 }}>
            Tu as atteint les deux seuils : 101h primaires minimum et 200h au total.
            Tu peux demander le crédit dans ta déclaration de revenus.
          </div>
        </div>
      ) : (
        <div style={{ padding: 16, backgroundColor: '#fef3c7', border: `1px solid #fde68a`, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>⏳ En progression vers la qualification</div>
          <div style={{ fontSize: 13, color: '#78350f', marginTop: 4 }}>
            {hPrimManquantes > 0 && <>Il te manque <strong>{hPrimManquantes.toFixed(1)}h primaires</strong> (plancher obligatoire 101h).<br /></>}
            {hTotalManquantes > 0 && <>Il te manque <strong>{hTotalManquantes.toFixed(1)}h au total</strong> (primaires + secondaires ≥ 200h).</>}
          </div>
        </div>
      )}

      {/* Jauges */}
      <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
        <Jauge
          label="🟢 Heures PRIMAIRES (sur site)"
          sublabel="Seuil obligatoire 101h"
          value={hPrimApprouve}
          pending={Math.max(0, hPrimTotal - hPrimApprouve)}
          max={SEUIL_PRIMAIRES_MIN}
          color={GREEN}
          pct={pctPrimaires}
        />
        <Jauge
          label="🔵 TOTAL (primaires + secondaires)"
          sublabel="Seuil requis 200h"
          value={hTotalApprouve}
          pending={Math.max(0, hTotalTotal - hTotalApprouve)}
          max={SEUIL_TOTAL_MIN}
          color={BLUE}
          pct={pctTotal}
        />
      </div>

      {/* Petit encart explicatif secondaires */}
      <div style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 12, color: MUTED, marginBottom: 20 }}>
        💡 Les <strong>heures secondaires</strong> (déplacements) comptent pour atteindre 200h au total, mais
        ne remplacent pas les 101h primaires obligatoires. Si tu as 200h+ en primaires seulement, tu es aussi qualifié.
      </div>

      {/* Tableau événements */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C }}>Détail par événement</h3>
        {evenements.length > 0 && (
          <button onClick={exportCSV}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, backgroundColor: C, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            📥 Exporter Excel (CSV)
          </button>
        )}
      </div>

      {evenements.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C, marginBottom: 8 }}>
            Aucune heure cumulée pour le moment
          </div>
          <div style={{ fontSize: 13, color: MUTED, maxWidth: 480, margin: '0 auto', lineHeight: 1.5 }}>
            Tes heures vont s&apos;accumuler ici en fonction des heures entrées via le <strong>système
            de prise des présences</strong> sur place (code QR) et de tes <strong>trajets</strong>
            lors des camps et déploiements.
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={thStyle}>Événement</th>
                <th style={thStyle}>Dates</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>🟢 Primaires</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>🔵 Secondaires</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {evenements.map(e => {
                const primApprouve = e.minutes_primaires_approuve / 60
                const primPending = (e.minutes_primaires_total - e.minutes_primaires_approuve) / 60
                const secApprouve = e.minutes_secondaires_approuve / 60
                const secPending = (e.minutes_secondaires_total - e.minutes_secondaires_approuve) / 60
                const totApprouve = primApprouve + secApprouve
                const totPending = primPending + secPending
                return (
                  <tr key={e.key} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, backgroundColor: e.type === 'camp' ? '#dbeafe' : '#fef3c7', color: e.type === 'camp' ? C : AMBER }}>
                          {e.type === 'camp' ? '🏕️ Camp' : '🚨 Déploiement'}
                        </span>
                        <span style={{ fontWeight: 600, color: C }}>{e.nom}</span>
                      </div>
                      {e.lieu && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>📍 {e.lieu}</div>}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: MUTED }}>{e.dates || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{primApprouve.toFixed(2)}h</div>
                      {primPending > 0 && <div style={{ fontSize: 10, color: AMBER }}>+{primPending.toFixed(2)}h en attente</div>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{secApprouve.toFixed(2)}h</div>
                      {secPending > 0 && <div style={{ fontSize: 10, color: AMBER }}>+{secPending.toFixed(2)}h en attente</div>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: C }}>
                      {totApprouve.toFixed(2)}h
                      {totPending > 0 && <div style={{ fontSize: 10, color: AMBER, fontWeight: 400 }}>+{totPending.toFixed(2)}h</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Jauge ────────────────────────────────────────────────────────────

function Jauge({ label, sublabel, value, pending, max, color, pct }: {
  label: string; sublabel: string; value: number; pending: number; max: number; color: string; pct: number
}) {
  const pctPending = Math.min(100 - pct, (pending / max) * 100)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C }}>{label}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{sublabel}</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>
          {value.toFixed(1)}<span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>h / {max}h</span>
          {pending > 0 && <span style={{ fontSize: 11, color: AMBER, fontWeight: 500, marginLeft: 6 }}>(+{pending.toFixed(1)}h en attente)</span>}
        </div>
      </div>
      <div style={{ height: 14, backgroundColor: '#f1f5f9', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, transition: 'width 0.4s' }} />
        {pctPending > 0 && (
          <div style={{ position: 'absolute', top: 0, left: `${pct}%`, width: `${pctPending}%`, height: '100%', backgroundColor: color, opacity: 0.3 }} />
        )}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED,
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em',
}

const tdStyle: React.CSSProperties = { padding: '10px 14px' }
