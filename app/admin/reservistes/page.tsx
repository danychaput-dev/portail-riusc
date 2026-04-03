'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  remboursement_bottes_date: string | null
  antecedents_statut: string | null
  antecedents_date_verification: string | null
  antecedents_date_expiration: string | null
}

interface ModalAntecedents {
  benevole_id: string
  nom: string
  prenom: string
  date_actuelle: string | null
  statut_actuel: string | null
}

function moisAnnee(iso: string) {
  const [y, m] = iso.split('-')
  const mois = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
  return `${mois[parseInt(m) - 1]} ${y}`
}

function badgeAntecedents(statut: string | null, dateExpir: string | null) {
  const expire = dateExpir && new Date(dateExpir) < new Date()
  if (statut === 'verifie' && !expire) return { couleur: '#16a34a', bg: '#f0fdf4', label: 'Vérifié' }
  if (statut === 'verifie' && expire)  return { couleur: '#dc2626', bg: '#fef2f2', label: 'Expiré' }
  if (statut === 'refuse')             return { couleur: '#dc2626', bg: '#fef2f2', label: 'Refusé' }
  return { couleur: '#d97706', bg: '#fffbeb', label: 'En attente' }
}

export default function ReservistesPageWrapper() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280' }}>Chargement...</div>}>
      <ReservistesPage />
    </Suspense>
  )
}

function ReservistesPage() {
  const supabase = createClient()
  const router   = useRouter()
  const searchParams = useSearchParams()

  // Filtres avancés depuis URL (dashboard drill-down)
  const urlGroupes     = searchParams.get('groupes')
  const urlOrganisme   = searchParams.get('organisme')
  const urlRegion      = searchParams.get('region')
  const urlAntecedents = searchParams.get('antecedents')
  const urlBottes      = searchParams.get('bottes')
  const urlLabel       = searchParams.get('label')
  const urlFrom        = searchParams.get('from')
  const hasUrlFilters  = !!(urlOrganisme || urlRegion || urlAntecedents || urlBottes || urlFrom)

  const defaultGroupes = urlGroupes
    ? urlGroupes.split(',').map(g => g.trim()).filter(Boolean)
    : ['Approuvé', 'Intérêt']

  const [loading,        setLoading]        = useState(true)
  const [data,           setData]           = useState<Reserviste[]>([])
  const [total,          setTotal]          = useState(0)
  const [recherche,      setRecherche]      = useState('')
  const [groupesFiltres, setGroupesFiltres] = useState<string[]>(defaultGroupes)
  const [exporting,      setExporting]      = useState(false)
  const [sortAsc,        setSortAsc]        = useState(true)
  const [authorized,     setAuthorized]     = useState(false)
  const [userRole,       setUserRole]       = useState<string>('')
  const [filtreBottes,   setFiltreBottes]   = useState(false)
  const [modal,          setModal]          = useState<ModalAntecedents | null>(null)
  const [modalDate,      setModalDate]      = useState('')
  const [modalStatut,    setModalStatut]    = useState('verifie')
  const [modalSaving,    setModalSaving]    = useState(false)

  // Auth
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (!res || !['admin', 'coordonnateur', 'adjoint'].includes(res.role)) { router.push('/'); return }
      setUserRole(res.role)
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
      // Filtres avancés depuis URL
      if (urlOrganisme) params.set('organisme', urlOrganisme)
      if (urlRegion) params.set('region', urlRegion)
      if (urlAntecedents) params.set('antecedents', urlAntecedents)
      if (urlBottes) params.set('bottes', urlBottes)
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

  const exporter = async () => {
    setExporting(true)
    const params = new URLSearchParams({ format: 'xlsx' })
    if (recherche) params.set('recherche', recherche)
    if (groupesFiltres.length > 0) params.set('groupes', groupesFiltres.join(','))
    const res  = await fetch(`/api/admin/reservistes?${params}`)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `reservistes-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  const toggleBottes = async (benevole_id: string, currentDate: string | null) => {
    const newDate = currentDate ? null : new Date().toISOString().split('T')[0]
    const res = await fetch('/api/admin/reservistes/bottes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benevole_id, date: newDate }),
    })
    if (res.ok) {
      setData(prev => prev.map(r =>
        r.benevole_id === benevole_id ? { ...r, remboursement_bottes_date: newDate } : r
      ))
    }
  }

  const ouvrirModalAntecedents = (r: Reserviste) => {
    setModal({ benevole_id: r.benevole_id, nom: r.nom, prenom: r.prenom, date_actuelle: r.antecedents_date_verification, statut_actuel: r.antecedents_statut })
    setModalDate(r.antecedents_date_verification || '')
    setModalStatut(r.antecedents_statut === 'refuse' ? 'refuse' : 'verifie')
  }

  const sauvegarderAntecedents = async () => {
    if (!modal) return
    setModalSaving(true)
    const res = await fetch('/api/admin/reservistes/antecedents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benevole_id: modal.benevole_id, date_verification: modalDate || null, statut: modalStatut }),
    })
    if (res.ok) {
      const json = await res.json()
      setData(prev => prev.map(r =>
        r.benevole_id === modal.benevole_id
          ? { ...r, antecedents_statut: json.statut, antecedents_date_verification: json.date_verification, antecedents_date_expiration: json.date_expiration }
          : r
      ))
      setModal(null)
    }
    setModalSaving(false)
  }

  const isAdmin = userRole === 'admin'

  // Colonnes dynamiques selon le rôle
  const gridCols = isAdmin
    ? '1.5fr 1fr 1.6fr 1fr 1.4fr 90px 130px 100px'
    : '1.5fr 1fr 1.6fr 1fr 1.2fr 1.4fr 90px 100px'
  const headers = isAdmin
    ? ['Nom', 'Téléphone', 'Courriel', 'Ville', 'Région / CP', 'Bottes', 'Antécédents', 'Groupe']
    : ['Nom', 'Téléphone', 'Courriel', 'Ville', 'Adresse', 'Région / CP', 'Bottes', 'Groupe']

  if (!authorized) return null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px' }}>

        {/* Bandeau filtre dashboard */}
        {hasUrlFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px' }}>
            <span style={{ fontSize: '14px' }}>🔍</span>
            <span style={{ fontSize: '14px', color: '#1e40af', fontWeight: '600' }}>
              {urlLabel || 'Filtre actif depuis le dashboard'}
            </span>
            <button
              onClick={() => router.push(urlFrom === 'dashboard' ? '/dashboard' : '/admin')}
              style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '8px', border: '1px solid #93c5fd', backgroundColor: 'white', color: '#1e40af', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              ← Retour au {urlFrom === 'dashboard' ? 'dashboard' : 'panneau admin'}
            </button>
          </div>
        )}

        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push(hasUrlFilters && urlFrom === 'dashboard' ? '/dashboard' : '/admin')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>← {hasUrlFilters && urlFrom === 'dashboard' ? 'Dashboard' : 'Admin'}</button>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: C }}>Annuaire des réservistes</h1>
            <span style={{ fontSize: '13px', color: '#6b7280', backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '20px' }}>
              {loading ? '…' : `${total} résultat${total !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={() => exporter()}
            disabled={exporting || data.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', border: `1px solid ${C}`,
              backgroundColor: 'white', color: C, fontSize: '13px', fontWeight: '600',
              cursor: (exporting || data.length === 0) ? 'not-allowed' : 'pointer',
              opacity: data.length === 0 ? 0.5 : 1
            }}
          >
            {exporting ? '⟳ Export…' : '⬇ Exporter Excel'}
          </button>
        </div>

        {/* Filtres */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Rechercher par nom, courriel, ville, téléphone…"
              value={recherche}
              onChange={e => handleRecherche(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, outline: 'none' }}
            />
          </div>
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
          <button
            onClick={() => setFiltreBottes(f => !f)}
            style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
              border: `1px solid ${filtreBottes ? '#1e3a5f' : '#e2e8f0'}`,
              backgroundColor: filtreBottes ? '#1e3a5f' : 'white',
              color: filtreBottes ? 'white' : '#94a3b8',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            🥾 Bottes remboursées
            <span style={{
              fontSize: '10px', padding: '0 5px', borderRadius: '8px', fontWeight: '700',
              backgroundColor: filtreBottes ? 'white' : '#1e3a5f',
              color: filtreBottes ? '#1e3a5f' : 'white',
            }}>
              {data.filter(r => r.remboursement_bottes_date).length}
            </span>
          </button>
        </div>

        {/* Tableau */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {/* En-tête tableau */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            {headers.map(h => (
              <div key={h} onClick={() => {
                if (h !== 'Nom') return
                const asc = !sortAsc
                setSortAsc(asc)
                setData(prev => [...prev].sort((a, b) => asc
                  ? a.nom.localeCompare(b.nom, 'fr')
                  : b.nom.localeCompare(a.nom, 'fr')
                ))
              }} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', cursor: h === 'Nom' ? 'pointer' : 'default', userSelect: 'none' as const, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {h}
                {h === 'Nom' && <span style={{ color: '#94a3b8' }}>{sortAsc ? ' ↑' : ' ↓'}</span>}
                {h === 'Bottes' && (
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#1e3a5f', color: 'white', fontWeight: '700', marginLeft: '4px' }}>
                    {data.filter(r => r.remboursement_bottes_date).length}
                  </span>
                )}
                {h === 'Antécédents' && (
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#16a34a', color: 'white', fontWeight: '700', marginLeft: '4px' }}>
                    {data.filter(r => r.antecedents_statut === 'verifie').length}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Lignes */}
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Chargement…</div>
          ) : data.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Aucun réserviste trouvé</div>
          ) : data.filter(r => !filtreBottes || r.remboursement_bottes_date).map((r, i) => {
            const badge    = badgeGroupe(r.groupe)
            const badgeAnt = badgeAntecedents(r.antecedents_statut, r.antecedents_date_expiration)
            const adresse  = [r.adresse].filter(Boolean).join(', ')
            return (
              <div
                key={r.benevole_id}
                style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0', borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa', transition: 'background-color 0.1s' }}
                onMouseOver={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f5ff'}
                onMouseOut={e => (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? 'white' : '#fafafa'}
              >
                {/* Nom */}
                <div style={{ padding: '11px 14px' }}>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{r.nom} {r.prenom}</div>
                  {r.telephone_secondaire && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Alt: {r.telephone_secondaire}</div>
                  )}
                </div>
                {/* Téléphone */}
                <div style={{ padding: '11px 14px', fontSize: '13px', color: '#374151' }}>
                  {r.telephone || <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                {/* Courriel */}
                <div style={{ padding: '11px 14px', fontSize: '12px', color: '#374151', wordBreak: 'break-all' as const }}>
                  {r.email
                    ? <a href={`mailto:${r.email}`} style={{ color: C, textDecoration: 'none' }}>{r.email}</a>
                    : <span style={{ color: '#d1d5db' }}>—</span>
                  }
                </div>
                {/* Ville */}
                <div style={{ padding: '11px 14px', fontSize: '13px', color: '#374151' }}>
                  {r.ville || <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                {/* Adresse (non-admin seulement) ou Région (admin) */}
                {!isAdmin && (
                  <div style={{ padding: '11px 14px', fontSize: '12px', color: '#374151' }}>
                    {adresse || <span style={{ color: '#d1d5db' }}>—</span>}
                  </div>
                )}
                {/* Région / CP */}
                <div style={{ padding: '11px 14px', fontSize: '12px', color: '#374151' }}>
                  <div>{r.region || <span style={{ color: '#d1d5db' }}>—</span>}</div>
                  {r.code_postal && <div style={{ color: '#94a3b8', marginTop: '2px' }}>{r.code_postal}</div>}
                </div>
                {/* Bottes */}
                <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                  <input
                    type="checkbox"
                    checked={!!r.remboursement_bottes_date}
                    onChange={() => toggleBottes(r.benevole_id, r.remboursement_bottes_date)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1e3a5f' }}
                  />
                  {r.remboursement_bottes_date && (
                    <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {moisAnnee(r.remboursement_bottes_date)}
                    </span>
                  )}
                </div>
                {/* Antécédents — admin seulement */}
                {isAdmin && (
                  <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '20px', backgroundColor: badgeAnt.bg, color: badgeAnt.couleur, fontWeight: '600', whiteSpace: 'nowrap' as const }}>
                        {badgeAnt.label}
                      </span>
                      <button
                        onClick={() => ouvrirModalAntecedents(r)}
                        title="Modifier la date de vérification"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94a3b8', fontSize: '13px', lineHeight: 1 }}
                      >
                        ✏️
                      </button>
                    </div>
                    {r.antecedents_date_verification && (
                      <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' as const }}>
                        {moisAnnee(r.antecedents_date_verification)}
                      </span>
                    )}
                  </div>
                )}
                {/* Groupe */}
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

      {/* Modal antécédents */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: C }}>
              Antécédents judiciaires
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
              {modal.prenom} {modal.nom}
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Statut
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['verifie', 'en_attente', 'refuse'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setModalStatut(s)}
                    style={{
                      flex: 1, padding: '7px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                      border: `2px solid ${modalStatut === s ? C : '#e2e8f0'}`,
                      backgroundColor: modalStatut === s ? '#eef2ff' : 'white',
                      color: modalStatut === s ? C : '#94a3b8',
                    }}
                  >
                    {s === 'verifie' ? 'Vérifié' : s === 'en_attente' ? 'En attente' : 'Refusé'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Date de vérification
                <span style={{ fontWeight: '400', color: '#94a3b8', marginLeft: '6px' }}>(expiration calculée automatiquement + 3 ans)</span>
              </label>
              <input
                type="date"
                value={modalDate}
                onChange={e => setModalDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
              />
              {modalDate && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                  Expire le : {new Date(new Date(modalDate).setFullYear(new Date(modalDate).getFullYear() + 3)).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModal(null)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={sauvegarderAntecedents}
                disabled={modalSaving}
                style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: C, color: 'white', fontSize: '13px', fontWeight: '600', cursor: modalSaving ? 'not-allowed' : 'pointer', opacity: modalSaving ? 0.7 : 1 }}
              >
                {modalSaving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
