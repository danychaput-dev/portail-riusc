'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'

const C = '#1e3a5f'

const GROUPES_OPTIONS = [
  { val: 'Approuvé',           label: 'Approuvé',            couleur: '#22c55e', bg: '#f0fdf4' },
  { val: 'Intérêt',            label: 'Intérêt',             couleur: '#f59e0b', bg: '#fffbeb' },
  { val: 'Formation incomplète', label: 'Formation incomplète', couleur: '#3b82f6', bg: '#eff6ff' },
  { val: 'Responsable',        label: 'Responsable',         couleur: '#7c3aed', bg: '#f5f3ff' },
  { val: 'Retrait temporaire', label: 'Retrait temporaire',  couleur: '#ef4444', bg: '#fef2f2' },
]

function badgeGroupe(groupe: string) {
  const opt = GROUPES_OPTIONS.find(o => o.val === groupe)
  return opt || { couleur: '#94a3b8', bg: '#f1f5f9', label: groupe }
}

interface Reserviste {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  telephone: string
  telephone_secondaire: string
  adresse: string
  ville: string
  region: string
  code_postal: string
  groupe: string
  statut: string
}

export default function ReservistesPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [loading,     setLoading]     = useState(true)
  const [data,        setData]        = useState<Reserviste[]>([])
  const [total,       setTotal]       = useState(0)
  const [recherche,   setRecherche]   = useState('')
  const [groupesFiltres, setGroupesFiltres] = useState<string[]>(['Approuvé', 'Intérêt'])
  const [exporting,   setExporting]   = useState(false)
  const [sortAsc,      setSortAsc]      = useState(true)
  const [authorized,  setAuthorized]  = useState(false)
  // Auth
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (!res || !['admin', 'coordonnateur', 'adjoint'].includes(res.role)) { router.push('/'); return }
      setAuthorized(true)
    }
    init()
  }, [])

  // Charger à chaque changement de recherche ou groupes
  useEffect(() => {
    if (!authorized) return
    const timer = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (recherche) params.set('recherche', recherche)
      if (groupesFiltres.length > 0) params.set('groupes', groupesFiltres.join(','))
      const res = await fetch(`/api/admin/reservistes?${params}`)
      const json = await res.json()
      const sorted = (json.data || []).sort((a: any, b: any) => a.nom.localeCompare(b.nom, 'fr'))
    setData(sorted)
      setTotal(json.total || 0)
      setLoading(false)
    }, recherche ? 350 : 0)
    return () => clearTimeout(timer)
  }, [authorized, recherche, groupesFiltres])

  const handleRecherche = (val: string) => setRecherche(val)

  const toggleGroupe = (g: string) => {
    setGroupesFiltres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  const exporter = async (format: 'csv') => {
    setExporting(true)
    const params = new URLSearchParams({ format })
    if (recherche) params.set('recherche', recherche)
    if (groupesFiltres.length > 0) params.set('groupes', groupesFiltres.join(','))
    const res  = await fetch(`/api/admin/reservistes?${params}`)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `reservistes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  if (!authorized) return null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px' }}>

        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>← Admin</button>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: C }}>Annuaire des réservistes</h1>
            <span style={{ fontSize: '13px', color: '#6b7280', backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '20px' }}>
              {loading ? '…' : `${total} résultat${total !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={() => exporter('csv')}
            disabled={exporting || data.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', border: `1px solid ${C}`,
              backgroundColor: 'white', color: C, fontSize: '13px', fontWeight: '600',
              cursor: (exporting || data.length === 0) ? 'not-allowed' : 'pointer',
              opacity: data.length === 0 ? 0.5 : 1
            }}
          >
            {exporting ? '⟳ Export…' : '⬇ Exporter CSV'}
          </button>
        </div>

        {/* Filtres */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Recherche */}
          <div style={{ flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Rechercher par nom, courriel, ville, téléphone…"
              value={recherche}
              onChange={e => handleRecherche(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, outline: 'none' }}
            />
          </div>

          {/* Groupes */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' as const }}>Groupe :</span>
            {GROUPES_OPTIONS.map(opt => (
              <button
                key={opt.val}
                onClick={() => toggleGroupe(opt.val)}
                style={{
                  padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                  border: `1px solid ${groupesFiltres.includes(opt.val) ? opt.couleur : '#e2e8f0'}`,
                  backgroundColor: groupesFiltres.includes(opt.val) ? opt.bg : 'white',
                  color: groupesFiltres.includes(opt.val) ? opt.couleur : '#94a3b8',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                {opt.label}
              </button>
            ))}
            {groupesFiltres.length > 0 && (
              <button onClick={() => setGroupesFiltres([])} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                Tout effacer
              </button>
            )}
          </div>
        </div>

        {/* Tableau */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {/* En-tête tableau */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.6fr 1fr 1.2fr 1.4fr 100px', gap: '0', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            {['Nom', 'Téléphone', 'Courriel', 'Ville', 'Adresse', 'Région / CP', 'Groupe'].map(h => (
              <div key={h} onClick={() => {
                if (h !== 'Nom') return
                const asc = !sortAsc
                setSortAsc(asc)
                setData(prev => [...prev].sort((a, b) => asc
                  ? a.nom.localeCompare(b.nom, 'fr')
                  : b.nom.localeCompare(a.nom, 'fr')
                ))
              }} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', cursor: h === 'Nom' ? 'pointer' : 'default', userSelect: 'none' as const, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {h}{h === 'Nom' && <span style={{ color: '#94a3b8' }}>{sortAsc ? ' ↑' : ' ↓'}</span>}
              </div>
            ))}
          </div>

          {/* Lignes */}
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Chargement…</div>
          ) : data.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
              Aucun réserviste trouvé
            </div>
          ) : data.map((r, i) => {
            const badge = badgeGroupe(r.groupe)
            const adresse = [r.adresse].filter(Boolean).join(', ')
            return (
              <div
                key={r.benevole_id}
                style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.6fr 1fr 1.2fr 1.4fr 100px',
                  gap: '0', borderBottom: '1px solid #f1f5f9',
                  backgroundColor: i % 2 === 0 ? 'white' : '#fafafa',
                  transition: 'background-color 0.1s'
                }}
                onMouseOver={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f5ff'}
                onMouseOut={e => (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? 'white' : '#fafafa'}
              >
                <div style={{ padding: '11px 14px' }}>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>
                    {r.nom} {r.prenom}
                  </div>
                  {r.telephone_secondaire && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Alt: {r.telephone_secondaire}
                    </div>
                  )}
                </div>
                <div style={{ padding: '11px 14px', fontSize: '13px', color: '#374151' }}>
                  {r.telephone || <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                <div style={{ padding: '11px 14px', fontSize: '12px', color: '#374151', wordBreak: 'break-all' as const }}>
                  {r.email
                    ? <a href={`mailto:${r.email}`} style={{ color: C, textDecoration: 'none' }}>{r.email}</a>
                    : <span style={{ color: '#d1d5db' }}>—</span>
                  }
                </div>
                <div style={{ padding: '11px 14px', fontSize: '13px', color: '#374151' }}>
                  {r.ville || <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                <div style={{ padding: '11px 14px', fontSize: '12px', color: '#374151' }}>
                  {adresse || <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                <div style={{ padding: '11px 14px', fontSize: '12px', color: '#374151' }}>
                  <div>{r.region || <span style={{ color: '#d1d5db' }}>—</span>}</div>
                  {r.code_postal && <div style={{ color: '#94a3b8', marginTop: '2px' }}>{r.code_postal}</div>}
                </div>
                <div style={{ padding: '11px 14px' }}>
                  <span style={{
                    fontSize: '11px', padding: '3px 8px', borderRadius: '20px',
                    backgroundColor: badge.bg, color: badge.couleur, fontWeight: '600', whiteSpace: 'nowrap' as const
                  }}>
                    {badge.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer info */}
        {!loading && data.length > 0 && (
          <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '12px', color: '#94a3b8' }}>
            {total} réserviste{total !== 1 ? 's' : ''} · Données en temps réel
          </div>
        )}

      </main>
    </div>
  )
}
