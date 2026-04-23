'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  COMPETENCES,
  FAMILLE_COLORS,
  FamilleCompetence,
  getCompetenceLabels,
  getFamilleRuns,
} from '@/utils/competencesMapping'

interface ReservisteRow {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  groupe_recherche: string
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

export default function CompetencesPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [exporting, setExporting] = useState(false)

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

  const filtered = useMemo(() => {
    if (!data) return []
    if (!recherche.trim()) return data.reservistes
    const q = recherche.toLowerCase()
    return data.reservistes.filter(r =>
      (r.nom || '').toLowerCase().includes(q) ||
      (r.prenom || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.groupe_recherche || '').toLowerCase().includes(q)
    )
  }, [data, recherche])

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

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Chargement des compétences...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        {error}
      </div>
    )
  }

  if (!data) return null

  const labels = getCompetenceLabels()
  const familleRuns = getFamilleRuns()

  return (
    <div className="p-4 md:p-8 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Compétences des réservistes</h1>
        <p className="text-sm text-gray-600">
          Matrice détaillée des {data.total_actifs} réservistes actifs, une colonne par compétence.
          Source: dossier du réserviste + jointure langues.
        </p>
      </div>

      {/* Synthèse totaux */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">Synthèse par compétence</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
          {COMPETENCES.map(c => {
            const n = data.totaux[c.label] || 0
            const pct = data.total_actifs > 0 ? Math.round((n / data.total_actifs) * 100) : 0
            return (
              <div
                key={c.label}
                className={`flex justify-between items-center px-2 py-1 rounded ${FAMILLE_COLORS[c.famille]}`}
              >
                <span className="truncate" title={`${c.famille} — ${c.label}`}>{c.label}</span>
                <span className="font-bold tabular-nums ml-2">{n} <span className="font-normal opacity-75">({pct}%)</span></span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Rechercher nom, prénom, courriel, groupe..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          className="flex-1 min-w-[260px] px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm font-medium"
        >
          {exporting ? 'Export…' : '⬇ Exporter Excel'}
        </button>
        <div className="text-sm text-gray-600 ml-2">
          {filtered.length} / {data.total_actifs}
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-auto border border-gray-200 rounded-lg bg-white" style={{ maxHeight: '75vh' }}>
        <table className="text-xs border-collapse">
          <thead className="sticky top-0 bg-white z-20">
            {/* Row 1: bannières familles */}
            <tr>
              {/* Identité: 5 colonnes vides */}
              <th className="sticky left-0 bg-white z-30 border-b border-r border-gray-300" colSpan={5} style={{ minWidth: 480 }}></th>
              {familleRuns.map(run => {
                const colSpan = run.end - run.start + 1
                return (
                  <th
                    key={run.famille + run.start}
                    colSpan={colSpan}
                    className={`border-b border-r border-gray-300 px-2 py-1 text-center font-bold ${FAMILLE_COLORS[run.famille as FamilleCompetence]}`}
                  >
                    {run.famille}
                  </th>
                )
              })}
            </tr>
            {/* Row 2: en-têtes colonnes */}
            <tr className="bg-gray-50">
              <th className="sticky left-0 bg-gray-50 z-30 border-b border-r border-gray-300 px-2 py-2 text-left font-medium min-w-[120px]">Nom</th>
              <th className="sticky left-0 bg-gray-50 z-20 border-b border-r border-gray-300 px-2 py-2 text-left font-medium min-w-[110px]" style={{ left: 120 }}>Prénom</th>
              <th className="border-b border-r border-gray-300 px-2 py-2 text-left font-medium min-w-[180px]">Groupe</th>
              <th className="border-b border-r border-gray-300 px-2 py-2 text-center font-medium" title="Niveau de déployabilité (1-4)">Niv</th>
              <th className="border-b border-r border-gray-300 px-2 py-2 text-center font-medium" title="Antécédents criminels">Antéc</th>
              {labels.map(label => (
                <th
                  key={label}
                  className="border-b border-r border-gray-300 px-1 py-2 text-center font-medium align-bottom"
                  style={{ minWidth: 24, writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 140 }}
                  title={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.benevole_id} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
                <td className="sticky left-0 bg-inherit z-10 border-b border-r border-gray-200 px-2 py-1 font-medium whitespace-nowrap">{r.nom}</td>
                <td className="sticky left-0 bg-inherit z-10 border-b border-r border-gray-200 px-2 py-1 whitespace-nowrap" style={{ left: 120 }}>{r.prenom}</td>
                <td className="border-b border-r border-gray-200 px-2 py-1 whitespace-nowrap truncate max-w-[200px]" title={r.groupe_recherche}>{r.groupe_recherche || <span className="text-gray-400">—</span>}</td>
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
                {labels.map(label => (
                  <td
                    key={label}
                    className={`border-b border-r border-gray-200 px-1 py-1 text-center ${r.competences[label] ? 'bg-blue-100 font-bold text-blue-900' : ''}`}
                  >
                    {r.competences[label] ? 'X' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Aucun réserviste ne correspond à la recherche.
        </div>
      )}
    </div>
  )
}
