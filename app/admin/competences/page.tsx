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
  can_edit: boolean
  user_role: string
}

type StatusFilter = 'Approuvé' | 'Intérêt' | 'tous'
type NiveauFilter = 0 | 1 | 2 | 3 | 4 | 'tous'

const NIVEAU_DESCRIPTIONS: Array<{ niveau: 1 | 2 | 3 | 4; titre: string; texte: string }> = [
  {
    niveau: 1,
    titre: 'Réserviste de base',
    texte: 'Qualifié via camp RIUSC/MSP, bases acquises, aucune compétence spécialisée ajoutée. Peut contribuer à des tâches encadrées (distribution, inscription, logistique de centre de services).',
  },
  {
    niveau: 2,
    titre: 'Compétences de base ajoutées',
    texte: "A enrichi son profil avec une ou plusieurs compétences complémentaires (cartographie/GPS, SCI 100 ou 200, sécurité, communication, sauvetage spécialisé à certifier) ou a accumulé plusieurs formations. Peut être affecté à des tâches demandant une compétence supplémentaire, sans responsabilité de supervision.",
  },
  {
    niveau: 3,
    titre: 'Réserviste spécialisé / opérationnel',
    texte: "Possède une spécialité technique reconnue formellement ou une profession critique en intervention d'urgence: Recherche & sauvetage niveau 2, licence drone Transport Canada, paramédic, infirmier/ère, médecin. Peut être déployé sur des tâches techniques et compter comme ressource qualifiée en équipe.",
  },
  {
    niveau: 4,
    titre: 'Réserviste leader / expert',
    texte: "Formation de supervision, commandement ou maîtrise avancée: Recherche & sauvetage niveau 3 (chef d'équipe), SCI 300 (supervision) ou SCI 400 (commandement stratégique). Peut prendre la responsabilité d'une équipe ou d'un secteur.",
  },
]

export default function CompetencesPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Approuvé')
  const [niveauFilter, setNiveauFilter] = useState<NiveauFilter>('tous')
  const [expandedFamille, setExpandedFamille] = useState<FamilleCompetence | null>(null)
  const [competenceFilter, setCompetenceFilter] = useState<string | null>(null)
  const [familleFilter, setFamilleFilter] = useState<FamilleCompetence | null>(null)
  const [synthVisible, setSynthVisible] = useState(true)
  const [showNiveauPanel, setShowNiveauPanel] = useState(false)
  const [editingNiveau, setEditingNiveau] = useState<string | null>(null) // benevole_id en édition
  const [savingNiveau, setSavingNiveau] = useState<string | null>(null)
  const [limitRender, setLimitRender] = useState<number>(100) // limite de rendu pour eviter le lag

  // Double scrollbar (top + bottom)
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

  const statusFiltered = useMemo(() => {
    if (!data) return []
    if (statusFilter === 'tous') return data.reservistes
    return data.reservistes.filter(r => r.groupe === statusFilter)
  }, [data, statusFilter])

  const niveauStatusFiltered = useMemo(() => {
    if (niveauFilter === 'tous') return statusFiltered
    const niv = niveauFilter === 0 ? 0 : niveauFilter
    return statusFiltered.filter(r => (r.niveau_ressource || 0) === niv)
  }, [statusFiltered, niveauFilter])

  const totauxByStatus = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of COMPETENCES) {
      out[c.label] = niveauStatusFiltered.filter(r => r.competences[c.label]).length
    }
    return out
  }, [niveauStatusFiltered])

  const totauxByFamille = useMemo(() => {
    const out: Record<FamilleCompetence, number> = {} as any
    for (const famille of FAMILLES) {
      const labels = COMPETENCES.filter(c => c.famille === famille).map(c => c.label)
      out[famille] = niveauStatusFiltered.filter(r => labels.some(l => r.competences[l])).length
    }
    return out
  }, [niveauStatusFiltered])

  // Compte par niveau (sur le sous-ensemble du statut sélectionné — pour la synthèse du bouton niveau)
  const comptesParNiveau = useMemo(() => {
    const out: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const r of statusFiltered) {
      const n = r.niveau_ressource || 0
      out[n] = (out[n] || 0) + 1
    }
    return out
  }, [statusFiltered])

  const rowsAffichees = useMemo(() => {
    let list = niveauStatusFiltered
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
  }, [niveauStatusFiltered, recherche, competenceFilter, familleFilter])

  useEffect(() => {
    if (mainScrollRef.current) {
      setTableWidth(mainScrollRef.current.scrollWidth)
    }
  }, [rowsAffichees.length, synthVisible])

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

  async function saveNiveau(benevole_id: string, niveau: number | null) {
    setSavingNiveau(benevole_id)
    try {
      const res = await fetch('/api/admin/competences/niveau', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id, niveau }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erreur ${res.status}`)
      }
      const updated = await res.json()
      // Optimistic update local state
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          reservistes: prev.reservistes.map(r =>
            r.benevole_id === benevole_id ? { ...r, niveau_ressource: updated.niveau_ressource } : r
          ),
        }
      })
      setEditingNiveau(null)
    } catch (e: any) {
      alert(`Impossible de sauvegarder: ${e.message}`)
    } finally {
      setSavingNiveau(null)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement...</div>
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>
  if (!data) return null

  const labels = getCompetenceLabels()
  const familleRuns = getFamilleRuns()
  const canEdit = data.can_edit

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
    setNiveauFilter('tous')
    setRecherche('')
  }

  const hasActiveFilter = !!competenceFilter || !!familleFilter || niveauFilter !== 'tous'

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* En-tête avec bouton "Voir les niveaux" à droite */}
      <div className="mb-4 flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Compétences des réservistes</h1>
          <p className="text-sm text-gray-600">
            Matrice des compétences. Clique sur une famille pour voir ses sous-catégories, puis sur une sous-catégorie pour filtrer le tableau.
          </p>
        </div>
        <button
          onClick={() => setShowNiveauPanel(v => !v)}
          className={`px-3 py-2 rounded-md border text-sm font-medium transition ${
            showNiveauPanel
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
          }`}
        >
          {showNiveauPanel ? '✕ Fermer' : 'ℹ Niveaux 1-4'}
        </button>
      </div>

      {/* Panel descriptions des niveaux (collapsible, à droite) */}
      {showNiveauPanel && (
        <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
          <div className="mb-3 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Niveaux de déployabilité — synthèse et descriptions
            </h2>
          </div>
          {/* Synthèse rapide par niveau */}
          <div className="grid grid-cols-5 gap-2 mb-4 text-sm">
            {[0, 1, 2, 3, 4].map(n => {
              const count = comptesParNiveau[n] || 0
              const total = statusFiltered.length
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <button
                  key={n}
                  onClick={() => setNiveauFilter(niveauFilter === (n as NiveauFilter) ? 'tous' : (n as NiveauFilter))}
                  className={`px-3 py-2 rounded border text-center transition ${
                    niveauFilter === n
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800'
                  }`}
                  title={n === 0 ? 'Filtrer: non classés' : `Filtrer: niveau ${n}`}
                >
                  <div className="text-xs font-medium">
                    {n === 0 ? 'Non classé' : `Niveau ${n}`}
                  </div>
                  <div className="text-lg font-bold tabular-nums">{count}</div>
                  <div className={`text-xs ${niveauFilter === n ? 'text-gray-300' : 'text-gray-500'}`}>({pct}%)</div>
                </button>
              )
            })}
          </div>
          {/* Descriptions */}
          <div className="space-y-3 text-sm">
            {NIVEAU_DESCRIPTIONS.map(nd => (
              <div key={nd.niveau} className="border-l-4 border-gray-300 pl-3">
                <div className="font-semibold text-gray-900 mb-1">Niveau {nd.niveau} — {nd.titre}</div>
                <div className="text-gray-700">{nd.texte}</div>
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
              💡 Tu peux modifier le niveau d'un réserviste en cliquant sur sa cellule dans la colonne <strong>Niv</strong> du tableau.
            </div>
          )}
        </div>
      )}

      {/* Filtres statut + bouton masquer synthèse */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
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

        <span className="text-gray-700 font-medium ml-3">Niveau:</span>
        {(['tous', 1, 2, 3, 4, 0] as NiveauFilter[]).map(n => (
          <button
            key={String(n)}
            onClick={() => setNiveauFilter(n)}
            className={`px-2 py-1 rounded-md border transition ${
              niveauFilter === n
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            {n === 'tous' ? 'Tous' : n === 0 ? 'N/A' : `N${n}`}
          </button>
        ))}

        <div className="flex-1" />
        <button
          onClick={() => setSynthVisible(v => !v)}
          className="px-3 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm"
          title={synthVisible ? 'Masquer pour voir plus de réservistes' : 'Afficher la synthèse'}
        >
          {synthVisible ? '▲ Masquer la synthèse' : '▼ Afficher la synthèse'}
        </button>
      </div>

      {/* Synthèse par famille */}
      {synthVisible && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-700 uppercase tracking-wide">
            Synthèse par famille — {niveauStatusFiltered.length} réservistes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {FAMILLES.map(famille => {
              const total = totauxByFamille[famille]
              const pct = niveauStatusFiltered.length > 0 ? Math.round((total / niveauStatusFiltered.length) * 100) : 0
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
                        const p = niveauStatusFiltered.length > 0 ? Math.round((n / niveauStatusFiltered.length) * 100) : 0
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
          placeholder="Rechercher nom, prénom, courriel, profession..."
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
          <span className="font-semibold">{rowsAffichees.length}</span> / {niveauStatusFiltered.length}
          {rowsAffichees.length !== niveauStatusFiltered.length && (
            <span className="ml-1 text-gray-500">(filtré)</span>
          )}
        </div>
      </div>

      {/* Info performance: rendu limité + bouton pour tout charger */}
      {rowsAffichees.length > limitRender && (
        <div className="mb-3 text-sm bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-yellow-900 flex justify-between items-center flex-wrap gap-2">
          <span>
            Affichage des <strong>{limitRender} premiers</strong> sur {rowsAffichees.length} résultats pour garder la page fluide. Affine tes filtres pour réduire la liste, ou clique pour tout charger (peut causer un ralentissement temporaire).
          </span>
          <button
            onClick={() => setLimitRender(99999)}
            className="px-3 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-xs font-medium whitespace-nowrap"
          >
            Charger les {rowsAffichees.length - limitRender} autres
          </button>
        </div>
      )}

      {/* Bandeau filtre actif */}
      {hasActiveFilter && (
        <div className="mb-3 text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-900">
          Filtres actifs:
          {competenceFilter && <strong className="ml-1">{competenceFilter}</strong>}
          {familleFilter && <strong className="ml-1">{familleFilter}</strong>}
          {niveauFilter !== 'tous' && <strong className="ml-1">Niveau {niveauFilter === 0 ? 'N/A' : niveauFilter}</strong>}
          <span className="text-blue-700 ml-2">— clique "Effacer filtres" pour voir tout le monde.</span>
        </div>
      )}

      {/* Scrollbar horizontal du haut */}
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
              <th className="border-b border-r border-gray-300 px-2 py-2 text-center font-medium" title={canEdit ? 'Niveau — cliquer pour éditer' : 'Niveau de déployabilité (1-4)'}>
                Niv{canEdit && <span className="text-gray-400 text-[10px] ml-1">✎</span>}
              </th>
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
            {rowsAffichees.slice(0, limitRender).map((r, i) => (
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
                <td className="border-b border-r border-gray-200 px-2 py-1 text-center tabular-nums">
                  {editingNiveau === r.benevole_id ? (
                    <select
                      autoFocus
                      defaultValue={String(r.niveau_ressource || 0)}
                      disabled={savingNiveau === r.benevole_id}
                      onBlur={() => setEditingNiveau(null)}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10)
                        saveNiveau(r.benevole_id, v === 0 ? 0 : v)
                      }}
                      className="w-full border border-gray-400 rounded px-1 py-0.5 text-center bg-white"
                    >
                      <option value="0">—</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </select>
                  ) : canEdit ? (
                    <button
                      onClick={() => setEditingNiveau(r.benevole_id)}
                      className="w-full py-0.5 rounded hover:bg-blue-100 cursor-pointer"
                      title="Cliquer pour modifier"
                    >
                      {r.niveau_ressource || <span className="text-gray-400">—</span>}
                    </button>
                  ) : (
                    <>{r.niveau_ressource || <span className="text-gray-400">—</span>}</>
                  )}
                </td>
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
