'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  COMPETENCES,
  FAMILLES,
  FAMILLE_ACCENT,
  FamilleCompetence,
  getCompetenceLabels,
  getFamilleRuns,
} from '@/utils/competencesMapping'

interface ReservisteRow {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  groupe: string
  groupe_recherche: string
  statut: string
  profession: string
  niveau_ressource: number
  antecedents_statut: string
  camp_qualif_complete: boolean
  competences: Record<string, boolean>
}

interface ApiResponse {
  reservistes: ReservisteRow[]
  totaux: Record<string, number>
  total_actifs: number
}

type StatusFilter = 'Approuvé' | 'Intérêt' | 'tous'

export default function CompetencesPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Approuvé')
  const [expandedFamille, setExpandedFamille] = useState<FamilleCompetence | null>(null)
  const [competenceFilter, setCompetenceFilter] = useState<string | null>(null)
  const [familleFilter, setFamilleFilter] = useState<FamilleCompetence | null>(null)
  const [synthVisible, setSynthVisible] = useState(true)

  // Double scrollbar (top + bottom) pour le tableau
  const topScrollRef = useRef<HTMLDivElement>(null)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const [tableWidth, setTableWidth] = useState(0)

  useEffect(() => {
    fetch('/api/admin/competences')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Non autorisé' : `Erreur ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Réservistes filtrés par statut (Approuvé / Intérêt / tous)
  const statusFiltered = useMemo(() => {
    if (!data) return []
    if (statusFilter === 'tous') return data.reservistes
    return data.reservistes.filter(r => r.groupe === statusFilter)
  }, [data, statusFilter])

  // Totaux par compétence recalculés sur le sous-ensemble filtré par statut
  const totauxByStatus = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of COMPETENCES) {
      out[c.label] = statusFiltered.filter(r => r.competences[c.label]).length
    }
    return out
  }, [statusFiltered])

  // Totaux par famille (union : compte les personnes qui ont AU MOINS UNE compétence de la famille)
  const totauxByFamille = useMemo(() => {
    const out: Record<FamilleCompetence, number> = {} as any
    for (const famille of FAMILLES) {
      const labels = COMPETENCES.filter(c => c.famille === famille).map(c => c.label)
      out[famille] = statusFiltered.filter(r => labels.some(l => r.competences[l])).length
    }
    return out
  }, [statusFiltered])

  // Tableau du bas : filtrage par recherche + compétence/famille active
  const rowsAffichees = useMemo(() => {
    let list = statusFiltered
    if (competenceFilter) {
      list = list.filter(r => r.competences[competenceFilter])
    } else if (familleFilter) {
      const labels = COMPETENCES.filter(c => c.famille === familleFilter).map(c => c.label)
      list = list.filter(r => labels.some(l => r.competences[l]))
    }
    if (recherche.trim()) {
      const q = recherche.toLowerCase()
      list = list.filter(r =>
        (r.nom || '').toLowerCase().includes(q) ||
        (r.prenom || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.profession || '').toLowerCase().includes(q) ||
        (r.groupe_recherche || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [statusFiltered, recherche, competenceFilter, familleFilter])

  // Mesurer la largeur du tableau (pour le scrollbar du haut)
  useEffect(() => {
    if (mainScrollRef.current) {
      setTableWidth(mainScrollRef.current.scrollWidth)
    }
  }, [rowsAffichees.length, synthVisible])

  // Sync scroll entre haut et bas
  const handleTopScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      if (mainScrollRef.current.scrollLeft !== topScrollRef.current.scrollLeft) {
        mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
      }
    }
  }
  const handleMainScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      if (topScrollRef.current.scrollLeft !== mainScrollRef.current.scrollLeft) {
        topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft
      }
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/competences?format=xlsx')
      if (!res.ok) throw new Error(`Export échoué (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `competences-reservistes-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message || 'Export échoué')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement...</div>
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>
  if (!data) return null

  const labels = getCompetenceLabels()
  const familleRuns = getFamilleRuns()

  // Map : pour chaque index de label, retourne la classe border accent si c'est la première colonne d'une famille, sinon ''
  const borderStartByIndex: Record<number, string> = {}
  for (const run of familleRuns) {
    borderStartByIndex[run.start] = FAMILLE_ACCENT[run.famille as FamilleCompetence]
  }

  const toggleFamille = (f: FamilleCompetence) => {
    setExpandedFamille(prev => (prev === f ? null : f))
  }
  const clickFamille = (f: FamilleCompetence, e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setFamilleFilter(prev => (prev === f ? null : f))
      setCompetenceFilter(null)
    } else {
      toggleFamille(f)
    }
  }
  const clickCompetence = (label: string) => {
    setCompetenceFilter(prev => (prev === label ? null : label))
    setFamilleFilter(null)
  }
  const resetFilters = () => {
    setCompetenceFilter(null)
    setFamilleFilter(null)
    setRecherche('')
  }

  const hasActiveFilter = competenceFilter || familleFilter

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* En-tête */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Compétences des réservistes</h1>
        <p className="text-sm text-gray-600">
          Matrice des compétences. Clique sur une famille pour voir ses sous-catégories, puis sur une sous-catégorie pour filtrer le tableau.
        </p>
      </div>

      {/* Filtre statut */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-gray-700 font-medium">Statut:</span>
        {(['Approuvé', 'Intérêt', 'tous'] as StatusFilter[]).map(s => {
          const count = s === 'tous' ? data.total_actifs : data.reservistes.filter(r => r.groupe === s).length
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-md border transition ${
                statusFilter === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {s === 'tous' ? 'Tous' : s} ({count})
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          onClick={() => setSynthVisible(v => !v)}
          className="px-3 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm"
          title={synthVisible ? 'Masquer pour voir plus de réservistes' : 'Afficher la synthèse'}
        >
          {synthVisible ? '▲ Masquer la synthèse' : '▼ Afficher la synthèse'}
        </button>
      </div>

      {/* Synthèse par famille (hiérarchique, neutre) — collapsible */}
      {synthVisible && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-700 uppercase tracking-wide">
            Synthèse par famille — {statusFiltered.length} réservistes {statusFilter !== 'tous' ? statusFilter.toLowerCase() + 's' : ''}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {FAMILLES.map(famille => {
              const total = totauxByFamille[famille]
              const pct = statusFiltered.length > 0 ? Math.round((total / statusFiltered.length) * 100) : 0
              const isExpanded = expandedFamille === famille
              const isActiveFilter = familleFilter === famille
              const subs = COMPETENCES.filter(c => c.famille === famille)
              return (
                <div
                  key={famille}
                  className={`border-l-4 ${FAMILLE_ACCENT[famille]} bg-gray-50 rounded-r ${isActiveFilter ? 'ring-2 ring-gray-900' : ''}`}
                >
                  <button
                    onClick={e => clickFamille(famille, e)}
                    className="w-full px-3 py-2 flex justify-between items-center hover:bg-gray-100 text-left transition"
                    title="Clic: ouvrir/fermer · Shift+Clic: filtrer le tableau"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                      <span className="font-medium text-gray-800">{famille}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-gray-900">
                      {total} <span className="font-normal text-gray-500 text-xs">({pct}%)</span>
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-2 pt-1 border-t border-gray-200">
                      {subs.map(sub => {
                        const n = totauxByStatus[sub.label]
                        const p = statusFiltered.length > 0 ? Math.round((n / statusFiltered.length) * 100) : 0
                        const isActive = competenceFilter === sub.label
                        return (
                          <button
                            key={sub.label}
                            onClick={() => clickCompetence(sub.label)}
                            className={`w-full flex justify-between items-center px-2 py-1 rounded text-sm hover:bg-gray-200 transition ${
                              isActive ? 'bg-gray-900 text-white hover:bg-gray-800' : 'text-gray-700'
                            }`}
                          >
                            <span>{sub.label}</span>
                            <span className="tabular-nums">
                              {n} <span className={`text-xs ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>({p}%)</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Barre d'actions */}
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Rechercher nom, prénom, courriel, groupe..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          className="flex-1 min-w-[260px] px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        {(hasActiveFilter || recherche) && (
          <button
            onClick={resetFilters}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm border border-gray-300"
          >
            ✕ Effacer filtres
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white rounded-md text-sm font-medium"
        >
          {exporting ? 'Export…' : '⬇ Exporter Excel'}
        </button>
        <div className="text-sm text-gray-600 ml-2">
          <span className="font-semibold">{rowsAffichees.length}</span> / {statusFiltered.length}
          {rowsAffichees.length !== statusFiltered.length && (
            <span className="ml-1 text-gray-500">(filtré)</span>
          )}
        </div>
      </div>

      {/* Bandeau filtre actif */}
      {hasActiveFilter && (
        <div className="mb-3 text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-900">
          Filtre actif: {competenceFilter ? <strong>{competenceFilter}</strong> : <strong>{familleFilter}</strong>}
          <span className="text-blue-700 ml-2">— clique sur "Effacer filtres" pour voir tout le monde.</span>
        </div>
      )}

      {/* Scrollbar horizontal du haut (synchronisé avec le tableau) */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto border-x border-t border-gray-200 rounded-t-lg bg-white"
        style={{ height: 14 }}
      >
        <div style={{ width: tableWidth, height: 1 }} />
      </div>

      {/* Tableau */}
      <div
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="overflow-auto border-x border-b border-gray-200 rounded-b-lg bg-white"
        style={{ maxHeight: '72vh' }}
      >
        <table className="text-xs border-collapse">
          <thead className="sticky top-0 bg-white z-20">
            <tr>
              <th className="sticky left-0 bg-white z-30 border-b border-r border-gray-300" colSpan={6} style={{ minWidth: 660 }}></th>
              {familleRuns.map(run => {
                const colSpan = run.end - run.start + 1
                return (
                  <th
                    key={run.famille + run.start}
                    colSpan={colSpan}
                    className={`border-b border-r border-gray-300 px-2 py-1 text-center font-semibold text-gray-700 border-l-4 ${FAMILLE_ACCENT[run.famille as FamilleCompetence]} bg-gray-50`}
                  >
                    {run.famille}
                  </th>
                )
              })}
            </tr>
            <tr className="bg-gray-50">
              <th className="sticky left-0 bg-gray-50 z-30 border-b border-r border-gray-300 px-2 py-2 text-left font-medium min-w-[120px]">Nom</th>
              <th className="sticky left-0 bg-gray-50 z-20 border-b border-r border-gray-300 px-2 py-2 text-left font-medium min-w-[110px]" style={{ left: 120 }}>Prénom</th>
              <th className="border-b border-r border-gray-300 px-2 py-2 text-center font-medium min-w-[100px]">Statut</th>
              <th className="border-b border-r border-gray-300 px-2 py-2 text-left font-medium min-w-[180px]">Profession</th>
              <th className="border-b border-r border-gray-300 px-2 py-2 text-center font-medium" title="Niveau de déployabilité (1-4)">Niv</th>
              <th className="border-b border-r border-gray-300 px-2 py-2 text-center font-medium" title="Antécédents criminels">Antéc</th>
              {labels.map((label, idx) => {
                const borderClass = borderStartByIndex[idx] ? `border-l-4 ${borderStartByIndex[idx]}` : ''
                return (
                  <th
                    key={label}
                    className={`border-b border-r border-gray-300 px-1 py-2 text-center font-medium align-bottom ${borderClass}`}
                    style={{ minWidth: 24, writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 140 }}
                    title={label}
                  >
                    {label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rowsAffichees.map((r, i) => (
              <tr key={r.benevole_id} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
                <td className="sticky left-0 bg-inherit z-10 border-b border-r border-gray-200 px-2 py-1 font-medium whitespace-nowrap">{r.nom}</td>
                <td className="sticky left-0 bg-inherit z-10 border-b border-r border-gray-200 px-2 py-1 whitespace-nowrap" style={{ left: 120 }}>{r.prenom}</td>
                <td className="border-b border-r border-gray-200 px-2 py-1 text-center whitespace-nowrap">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                    r.groupe === 'Approuvé' ? 'bg-green-50 text-green-800 border border-green-200' :
                    r.groupe === 'Intérêt' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {r.groupe || '—'}
                  </span>
                </td>
                <td className="border-b border-r border-gray-200 px-2 py-1 whitespace-nowrap truncate max-w-[200px]" title={r.profession}>{r.profession || <span className="text-gray-400">—</span>}</td>
                <td className="border-b border-r border-gray-200 px-2 py-1 text-center tabular-nums">{r.niveau_ressource || <span className="text-gray-400">—</span>}</td>
                <td className="border-b border-r border-gray-200 px-2 py-1 text-center">
                  {r.antecedents_statut === 'verifie' ? (
                    <span className="text-green-600" title="Vérifié">✓</span>
                  ) : r.antecedents_statut === 'en_attente' ? (
                    <span className="text-orange-500" title="En attente">…</span>
                  ) : r.antecedents_statut === 'refuse' ? (
                    <span className="text-red-500" title="Refusé">✗</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                {labels.map((label, idx) => {
                  const borderClass = borderStartByIndex[idx] ? `border-l-4 ${borderStartByIndex[idx]}` : ''
                  return (
                    <td
                      key={label}
                      className={`border-b border-r border-gray-200 px-1 py-1 text-center ${borderClass} ${r.competences[label] ? 'bg-gray-200 font-semibold' : ''}`}
                    >
                      {r.competences[label] ? '✓' : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rowsAffichees.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Aucun réserviste ne correspond aux filtres.
        </div>
      )}
    </div>
  )
}
