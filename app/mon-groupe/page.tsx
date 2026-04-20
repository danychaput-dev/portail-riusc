'use client'

/**
 * /mon-groupe
 *
 * Page réservée aux responsables de groupe(s) de R&S.
 * Affiche les déploiements actifs où des membres de leurs groupes ont été
 * ciblés, avec pour chaque membre :
 *  - Statut de ciblage (cible / notifie / mobilise)
 *  - Réponses de disponibilité par date (oui / non / à confirmer)
 *  - Assignation éventuelle dans une rotation
 *
 * Les responsables restent sur la landing réserviste ; cette page est
 * accessible via le menu utilisateur.
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

interface Groupe {
  id: string
  nom: string
  district: number
}

interface Dispo {
  date_jour: string
  disponible: boolean
  a_confirmer: boolean
}

interface MembreLigne {
  benevole_id: string
  prenom: string
  nom: string
  email: string | null
  telephone: string | null
  ville: string | null
  region: string | null
  groupe_recherche: string | null
  ciblage_statut: string
  ciblage_updated_at: string | null
  dispos: Dispo[]
  vague_id: string | null
  vague_identifiant: string | null
  vague_statut: string | null
}

interface Deploiement {
  id: string
  identifiant: string | null
  nom: string
  lieu: string | null
  date_debut: string | null
  date_fin: string | null
  statut: string
  membres: MembreLigne[]
}

interface ApiResponse {
  is_responsable: boolean
  groupes: Groupe[]
  deploiements: Deploiement[]
  error?: string
}

function dateFr(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function genDates(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  while (d <= e) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }
  return dates
}

export default function MonGroupePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Filtre par groupe : 'all' = tous
  const [filtreGroupe, setFiltreGroupe] = useState<string>('all')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/mon-groupe/deploiements', { cache: 'no-store' })
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

  const deploiementsAffiches = useMemo(() => {
    if (!data) return [] as Deploiement[]
    if (filtreGroupe === 'all') return data.deploiements
    // Filtrer par groupe : ne garder que les membres dont groupe_recherche contient le nom du groupe sélectionné
    const groupe = data.groupes.find(g => g.id === filtreGroupe)
    if (!groupe) return data.deploiements
    return data.deploiements
      .map(d => ({
        ...d,
        membres: d.membres.filter(m => (m.groupe_recherche || '').toLowerCase().includes(groupe.nom.toLowerCase())),
      }))
      .filter(d => d.membres.length > 0)
  }, [data, filtreGroupe])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
        <PortailHeader subtitle="Mon groupe" />
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', flex: 1 }}>
          <div style={{ padding: 60, textAlign: 'center', color: MUTED, fontSize: 14 }}>Chargement…</div>
        </main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
        <PortailHeader subtitle="Mon groupe" />
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
        <PortailHeader subtitle="Mon groupe" />
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', flex: 1 }}>
          <div style={{ padding: 40, backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🚫</div>
            <h2 style={{ color: C, fontSize: 18, margin: '0 0 8px' }}>Cette page n'est accessible qu'aux responsables de groupe</h2>
            <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>Si tu devrais y avoir accès, contacte un administrateur.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      <PortailHeader subtitle="Mon groupe" />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', flex: 1, width: '100%' }}>

        {/* En-tête */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C, margin: '0 0 6px' }}>
            🎖️ Mon groupe
          </h1>
          <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>
            Membres de ton/tes groupe(s) de recherche et sauvetage sollicités sur les déploiements actifs.
            Tu peux voir qui a répondu, qui est disponible et qui a été mobilisé dans une rotation.
          </p>
        </div>

        {/* Groupes dont je suis responsable + filtre */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          padding: '12px 14px', marginBottom: 16,
          backgroundColor: 'white', borderRadius: 10, border: `1px solid ${BORDER}`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Mes groupes
          </span>
          <button
            onClick={() => setFiltreGroupe('all')}
            style={{
              padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999,
              border: `1px solid ${filtreGroupe === 'all' ? C : BORDER}`,
              backgroundColor: filtreGroupe === 'all' ? '#eff6ff' : 'white',
              color: filtreGroupe === 'all' ? C : MUTED, cursor: 'pointer',
            }}
          >
            Tous ({data.groupes.length})
          </button>
          {data.groupes.map(g => (
            <button
              key={g.id}
              onClick={() => setFiltreGroupe(g.id)}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999,
                border: `1px solid ${filtreGroupe === g.id ? C : BORDER}`,
                backgroundColor: filtreGroupe === g.id ? '#eff6ff' : 'white',
                color: filtreGroupe === g.id ? C : MUTED, cursor: 'pointer',
              }}
            >
              D{g.district} · {g.nom}
            </button>
          ))}
        </div>

        {/* Liste des déploiements */}
        {deploiementsAffiches.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
            <div style={{ color: C, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Aucun membre sollicité pour le moment</div>
            <div style={{ color: MUTED, fontSize: 13 }}>
              Quand des membres de ton groupe seront ciblés pour un déploiement, tu les verras ici.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {deploiementsAffiches.map(dep => (
              <DeploiementCard key={dep.id} dep={dep} />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}

function DeploiementCard({ dep }: { dep: Deploiement }) {
  const dates = useMemo(() =>
    dep.date_debut && dep.date_fin ? genDates(dep.date_debut, dep.date_fin) : []
  , [dep.date_debut, dep.date_fin])

  // Trier les membres : mobilisés d'abord, puis dispos, puis silence
  const membresTries = useMemo(() => {
    const order = (m: MembreLigne) => {
      if (m.vague_id) return 0
      const dispoOui = m.dispos.some(d => d.disponible)
      const aConfirmer = m.dispos.some(d => d.a_confirmer)
      if (dispoOui) return 1
      if (aConfirmer) return 2
      if (m.dispos.length > 0) return 3 // a répondu non dispo
      return 4 // silence
    }
    return [...dep.membres].sort((a, b) => order(a) - order(b))
  }, [dep.membres])

  const stats = useMemo(() => {
    let mobilises = 0, dispoOui = 0, aConfirmer = 0, nondispo = 0, silence = 0
    for (const m of dep.membres) {
      if (m.vague_id) mobilises++
      else if (m.dispos.some(d => d.disponible)) dispoOui++
      else if (m.dispos.some(d => d.a_confirmer)) aConfirmer++
      else if (m.dispos.length > 0) nondispo++
      else silence++
    }
    return { mobilises, dispoOui, aConfirmer, nondispo, silence }
  }, [dep.membres])

  return (
    <div style={{ backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
      {/* En-tête déploiement */}
      <div style={{ padding: '14px 18px', backgroundColor: '#1e3a5f', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
            backgroundColor: 'rgba(255,255,255,0.2)',
          }}>{dep.identifiant || 'DEP'}</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{dep.nom}</span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 8,
            backgroundColor: dep.statut === 'En cours' ? '#10b981' : 'rgba(255,255,255,0.2)',
            color: 'white', fontWeight: 600, textTransform: 'uppercase',
          }}>{dep.statut}</span>
        </div>
        <div style={{ fontSize: 12, marginTop: 6, opacity: 0.9, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {dep.lieu && <span>📍 {dep.lieu}</span>}
          {dep.date_debut && (
            <span>📅 {dateFr(dep.date_debut)}{dep.date_fin ? ` → ${dateFr(dep.date_fin)}` : ''}</span>
          )}
          <span style={{ marginLeft: 'auto' }}>{dep.membres.length} membre(s) ciblé(s)</span>
        </div>
      </div>

      {/* Stats rapides */}
      <div style={{ padding: '12px 18px', backgroundColor: '#f8fafc', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Mobilisés',       val: stats.mobilises,   color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Dispo ✓',         val: stats.dispoOui,    color: GREEN,     bg: '#ecfdf5' },
          { label: 'À confirmer',     val: stats.aConfirmer,  color: AMBER,     bg: '#fffbeb' },
          { label: 'Non dispo',       val: stats.nondispo,    color: RED,       bg: '#fef2f2' },
          { label: 'Sans réponse',    val: stats.silence,     color: MUTED,     bg: '#f1f5f9' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '6px 12px', borderRadius: 8, backgroundColor: s.bg,
            fontSize: 12, fontWeight: 600, color: s.color,
          }}>
            {s.val} {s.label}
          </div>
        ))}
      </div>

      {/* Tableau des membres */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <th style={thStyle}>Membre</th>
              <th style={thStyle}>Contact</th>
              <th style={thStyle}>Statut</th>
              {dates.map(d => (
                <th key={d} style={{ ...thStyle, textAlign: 'center', minWidth: 40, whiteSpace: 'nowrap' }}>
                  {d.slice(5)}
                </th>
              ))}
              <th style={thStyle}>Rotation</th>
            </tr>
          </thead>
          <tbody>
            {membresTries.map(m => {
              const dispoMap = Object.fromEntries(m.dispos.map(x => [x.date_jour, x]))
              const statutLabel = m.vague_id ? { txt: '🚨 Mobilisé',  color: '#7c3aed', bg: '#f5f3ff' }
                : m.dispos.some(d => d.disponible) ? { txt: '✅ Dispo', color: GREEN, bg: '#ecfdf5' }
                : m.dispos.some(d => d.a_confirmer) ? { txt: '⏳ À confirmer', color: AMBER, bg: '#fffbeb' }
                : m.dispos.length > 0 ? { txt: '❌ Non dispo', color: RED, bg: '#fef2f2' }
                : m.ciblage_statut === 'notifie' ? { txt: '· Notifié', color: MUTED, bg: '#f1f5f9' }
                : { txt: '· Ciblé', color: MUTED, bg: '#f1f5f9' }
              return (
                <tr key={m.benevole_id} style={{ borderTop: `1px solid #f3f4f6` }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: C }}>{m.prenom} {m.nom}</div>
                    {m.ville && <div style={{ fontSize: 10, color: MUTED }}>📍 {m.ville}{m.region ? `, ${m.region}` : ''}</div>}
                  </td>
                  <td style={tdStyle}>
                    {m.email && <div style={{ fontSize: 11, color: MUTED }}>✉ {m.email}</div>}
                    {m.telephone && <div style={{ fontSize: 11, color: MUTED }}>📞 {m.telephone}</div>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11,
                      backgroundColor: statutLabel.bg, color: statutLabel.color,
                    }}>{statutLabel.txt}</span>
                  </td>
                  {dates.map(d => {
                    const dispo = dispoMap[d]
                    const bg = !dispo ? 'transparent' : dispo.disponible ? '#d1fae5' : '#fee2e2'
                    const icon = !dispo ? '·' : dispo.disponible ? '✓' : '✗'
                    return (
                      <td key={d} style={{ ...tdStyle, textAlign: 'center', backgroundColor: bg, fontWeight: 600 }}>
                        <span style={{ color: !dispo ? '#cbd5e1' : dispo.disponible ? '#065f46' : '#991b1b' }}>{icon}</span>
                      </td>
                    )
                  })}
                  <td style={tdStyle}>
                    {m.vague_identifiant ? (
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11,
                        backgroundColor: '#f5f3ff', color: '#7c3aed',
                      }}>
                        {m.vague_identifiant}
                      </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
