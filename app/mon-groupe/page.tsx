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
import { formatPhone, normalizePhone } from '@/utils/phone'

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
  // Nouveaux filtres
  const [search, setSearch] = useState('')
  const [onlyResponded, setOnlyResponded] = useState(false)
  const [includeTermines, setIncludeTermines] = useState(false)

  // Tri partagé entre tous les tableaux de la page
  type SortKey = 'statut' | 'nom' | 'ville' | 'rotation'
  const [sortKey, setSortKey] = useState<SortKey>('statut')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const qs = includeTermines ? '?include_termines=true' : ''
        const res = await fetch(`/api/mon-groupe/deploiements${qs}`, { cache: 'no-store' })
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
  }, [includeTermines])

  // Normalisation pour la recherche insensible à la casse et aux accents
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const searchTerms = useMemo(
    () => normalize(search.trim()).split(/\s+/).filter(Boolean),
    [search]
  )
  function matchesSearch(m: MembreLigne): boolean {
    if (searchTerms.length === 0) return true
    const haystack = normalize([m.prenom, m.nom, m.email, m.ville, m.region].filter(Boolean).join(' '))
    return searchTerms.every(t => haystack.includes(t))
  }

  const deploiementsAffiches = useMemo(() => {
    if (!data) return [] as Deploiement[]
    const groupe = filtreGroupe === 'all' ? null : data.groupes.find(g => g.id === filtreGroupe)
    return data.deploiements
      .map(d => {
        let membres = d.membres
        if (groupe) {
          membres = membres.filter(m => (m.groupe_recherche || '').toLowerCase().includes(groupe.nom.toLowerCase()))
        }
        if (onlyResponded) {
          membres = membres.filter(m => m.dispos.length > 0)
        }
        if (searchTerms.length > 0) {
          membres = membres.filter(matchesSearch)
        }
        return { ...d, membres }
      })
      .filter(d => d.membres.length > 0)
  }, [data, filtreGroupe, onlyResponded, searchTerms])

  // Stats globales (après filtres) pour l'en-tête
  const totalFiltres = deploiementsAffiches.reduce((sum, d) => sum + d.membres.length, 0)

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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C, margin: '0 0 6px' }}>
              🎖️ Mon groupe
            </h1>
            <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>
              Membres de ton/tes groupe(s) de recherche et sauvetage sollicités sur les déploiements actifs.
              Tu peux voir qui a répondu, qui est disponible et qui a été mobilisé dans une rotation.
            </p>
          </div>
          <a
            href="/mon-groupe/courriels"
            style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              backgroundColor: 'white', color: C,
              border: `1px solid ${C}`, borderRadius: 8,
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            📧 Courriels aux membres →
          </a>
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

        {/* Barre de recherche + filtres */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          padding: '10px 14px', marginBottom: 16,
          backgroundColor: 'white', borderRadius: 10, border: `1px solid ${BORDER}`,
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <input
              type="text" placeholder="🔍 Rechercher un membre (nom, courriel, ville…)"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 28px 6px 10px', fontSize: 13,
                border: `1px solid ${BORDER}`, borderRadius: 8, outline: 'none',
                color: '#1e293b', boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                title="Effacer la recherche"
                style={{
                  position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', fontSize: 16, padding: '2px 8px', lineHeight: 1,
                }}
              >×</button>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyResponded} onChange={e => setOnlyResponded(e.target.checked)} style={{ accentColor: C }} />
            Avec réponse seulement
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeTermines} onChange={e => setIncludeTermines(e.target.checked)} style={{ accentColor: C }} />
            Inclure déploiements terminés (archives)
          </label>

          <span style={{ fontSize: 12, color: MUTED, marginLeft: 'auto' }}>
            {totalFiltres} membre{totalFiltres > 1 ? 's' : ''} · {deploiementsAffiches.length} déploiement{deploiementsAffiches.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Liste des déploiements */}
        {deploiementsAffiches.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
            <div style={{ color: C, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              {search || onlyResponded ? 'Aucun résultat ne correspond aux filtres' : 'Aucun membre sollicité pour le moment'}
            </div>
            <div style={{ color: MUTED, fontSize: 13 }}>
              {search || onlyResponded
                ? 'Essaie de relâcher les filtres.'
                : 'Quand des membres de ton groupe seront ciblés pour un déploiement, tu les verras ici.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {deploiementsAffiches.map(dep => (
              <DeploiementCard
                key={dep.id}
                dep={dep}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}

type SortKey = 'statut' | 'nom' | 'ville' | 'rotation'

function DeploiementCard({
  dep, sortKey, sortDir, onSort,
}: {
  dep: Deploiement
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const dates = useMemo(() =>
    dep.date_debut && dep.date_fin ? genDates(dep.date_debut, dep.date_fin) : []
  , [dep.date_debut, dep.date_fin])

  // Priorité de statut pour le tri "statut" : mobilisé > dispo > à confirmer > non dispo > silence
  const statutPriority = (m: MembreLigne): number => {
    if (m.vague_id) return 0
    if (m.dispos.some(d => d.disponible)) return 1
    if (m.dispos.some(d => d.a_confirmer)) return 2
    if (m.dispos.length > 0) return 3 // a répondu non dispo
    return 4 // silence
  }

  // Tri des membres selon la colonne cliquée
  const membresTries = useMemo(() => {
    const compare = (a: MembreLigne, b: MembreLigne): number => {
      let v = 0
      switch (sortKey) {
        case 'nom':
          v = `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr', { sensitivity: 'base' })
          break
        case 'ville':
          v = (a.ville || '').localeCompare(b.ville || '', 'fr', { sensitivity: 'base' })
          break
        case 'rotation':
          // Nulls en dernier quel que soit le sens
          if (!a.vague_identifiant && !b.vague_identifiant) v = 0
          else if (!a.vague_identifiant) v = 1
          else if (!b.vague_identifiant) v = -1
          else v = a.vague_identifiant.localeCompare(b.vague_identifiant)
          break
        case 'statut':
        default:
          v = statutPriority(a) - statutPriority(b)
          if (v === 0) v = `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr', { sensitivity: 'base' })
          break
      }
      return sortDir === 'asc' ? v : -v
    }
    return [...dep.membres].sort(compare)
  }, [dep.membres, sortKey, sortDir])

  // Icône de tri sur l'en-tête cliquable
  const sortIndicator = (k: SortKey) => {
    if (sortKey !== k) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>
    return <span style={{ color: C, marginLeft: 4, fontWeight: 700 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

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

  const isTermine = dep.statut === 'Terminé'

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: 12,
      border: `1px solid ${isTermine ? '#cbd5e1' : BORDER}`,
      overflow: 'hidden',
      opacity: isTermine ? 0.85 : 1,
    }}>
      {/* En-tête déploiement — gris pour les archives, bleu marine sinon */}
      <div style={{ padding: '14px 18px', backgroundColor: isTermine ? '#64748b' : '#1e3a5f', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {isTermine && <span title="Archivé" style={{ fontSize: 14 }}>📦</span>}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
            backgroundColor: 'rgba(255,255,255,0.2)',
          }}>{dep.identifiant || 'DEP'}</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{dep.nom}</span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 8,
            backgroundColor: dep.statut === 'En cours' ? '#10b981'
              : isTermine ? 'rgba(0,0,0,0.25)'
              : 'rgba(255,255,255,0.2)',
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
              <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort('nom')}>
                Membre{sortIndicator('nom')}
              </th>
              <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort('ville')}>
                Contact{sortIndicator('ville')}
              </th>
              <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort('statut')}>
                Statut{sortIndicator('statut')}
              </th>
              {dates.map(d => (
                <th key={d} style={{ ...thStyle, textAlign: 'center', minWidth: 40, whiteSpace: 'nowrap' }}>
                  {d.slice(5)}
                </th>
              ))}
              <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort('rotation')}>
                Rotation{sortIndicator('rotation')}
              </th>
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
                    {m.email && (
                      <div style={{ fontSize: 11 }}>
                        <a
                          href={`mailto:${encodeURIComponent(m.email)}`}
                          title={`Écrire à ${m.prenom} ${m.nom}`}
                          style={{ color: '#1d4ed8', textDecoration: 'none', borderBottom: '1px dotted #93c5fd' }}
                        >
                          ✉ {m.email}
                        </a>
                      </div>
                    )}
                    {m.telephone && (
                      <div style={{ fontSize: 11 }}>
                        <a
                          href={`tel:${normalizePhone(m.telephone)}`}
                          title={`Appeler ${m.prenom} ${m.nom}`}
                          style={{ color: '#1d4ed8', textDecoration: 'none', borderBottom: '1px dotted #93c5fd' }}
                        >
                          📞 {formatPhone(m.telephone)}
                        </a>
                      </div>
                    )}
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
