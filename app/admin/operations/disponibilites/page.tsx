'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ModalComposeCourriel from '@/app/components/ModalComposeCourriel'

const C = '#1e3a5f'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Deployment {
  id: string; identifiant: string; nom: string; lieu?: string
  date_debut?: string; date_fin?: string; nb_personnes_par_vague?: number
  latitude?: number; longitude?: number
}
interface ReservisteDetail {
  benevole_id: string; prenom: string; nom: string; telephone: string; email?: string
  ville?: string; region?: string; latitude?: number; longitude?: number
  competence_rs?: string[]; certificat_premiers_soins?: string[]
  vehicule_tout_terrain?: string[]; navire_marin?: string[]
  permis_conduire?: string[]; satp_drone?: string[]; equipe_canine?: string[]
  competences_securite?: string[]; competences_sauvetage?: string[]
  communication?: string[]; cartographie_sig?: string[]; operation_urgence?: string[]
}
interface DispoV2 { benevole_id: string; date_jour: string; disponible: boolean; a_confirmer: boolean; commentaire?: string | null; transport?: string | null; created_at?: string }
interface Ciblage { id: string; benevole_id: string; statut: string; updated_at?: string }
interface Vague {
  id: string; identifiant?: string; numero: number
  date_debut: string; date_fin: string; nb_personnes_requis?: number; statut: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function dateFr(iso?: string | null) {
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

// ─── Compétences ──────────────────────────────────────────────────────────────
const COMP_BADGES: { field: keyof ReservisteDetail; label: string; color: string; bg: string }[] = [
  { field: 'competence_rs',             label: 'RS',  color: '#7c3aed', bg: '#f5f3ff' },
  { field: 'certificat_premiers_soins', label: 'PS',  color: '#059669', bg: '#f0fdf4' },
  { field: 'permis_conduire',           label: 'PdC', color: '#475569', bg: '#f8fafc' },
  { field: 'vehicule_tout_terrain',     label: 'VTT', color: '#d97706', bg: '#fffbeb' },
  { field: 'navire_marin',              label: '⚓',  color: '#0284c7', bg: '#eff6ff' },
  { field: 'satp_drone',                label: 'UAV', color: '#9333ea', bg: '#faf5ff' },
  { field: 'equipe_canine',             label: 'K9',  color: '#78350f', bg: '#fef3c7' },
  { field: 'competences_securite',      label: 'Séc', color: '#dc2626', bg: '#fef2f2' },
  { field: 'competences_sauvetage',     label: 'SAR', color: '#ea580c', bg: '#fff7ed' },
  { field: 'communication',             label: 'Com', color: '#0891b2', bg: '#f0f9ff' },
  { field: 'cartographie_sig',          label: 'SIG', color: '#16a34a', bg: '#f0fdf4' },
  { field: 'operation_urgence',         label: 'OpU', color: '#be185d', bg: '#fdf2f8' },
]

function BadgesComp({ r }: { r: ReservisteDetail }) {
  const badges = COMP_BADGES.filter(b => {
    const val = r[b.field]
    return Array.isArray(val) && (val as string[]).length > 0
  })
  if (!badges.length) return null
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:3 }}>
      {badges.map(b => (
        <span key={b.field as string} style={{
          fontSize:9, padding:'1px 5px', borderRadius:6,
          backgroundColor:b.bg, color:b.color, fontWeight:700, whiteSpace:'nowrap',
        }}>{b.label}</span>
      ))}
    </div>
  )
}

// ─── Config groupes ───────────────────────────────────────────────────────────
type Groupe = 'plage' | 'partiel' | 'nondispo' | 'silence'
const GROUPE_CFG: Record<Groupe, { label: string; bg: string; border: string }> = {
  plage:    { label: '✅ Dans la fenêtre de rotation', bg: '#f0fdf4', border: '#bbf7d0' },
  partiel:  { label: '⚠️ Partiellement disponible',   bg: '#fffbeb', border: '#fde68a' },
  nondispo: { label: '❌ Non disponible',             bg: '#fef2f2', border: '#fecaca' },
  silence:  { label: '· Sans réponse',               bg: '#f8fafc', border: '#e2e8f0' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function DisponibilitesInner() {
  const supabase  = createClient()
  const router    = useRouter()
  const params    = useSearchParams()
  const depId     = params.get('dep')

  const [authorized,  setAuthorized]  = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [dep,         setDep]         = useState<Deployment | null>(null)
  const [ciblages,    setCiblages]    = useState<Ciblage[]>([])
  const [resMap,      setResMap]      = useState<Record<string, ReservisteDetail>>({})
  const [dispos,      setDispos]      = useState<DispoV2[]>([])
  const [vagues,      setVagues]      = useState<Vague[]>([])
  const [rotStart,    setRotStart]    = useState('')
  const [rotEnd,      setRotEnd]      = useState('')
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [aiSugg,      setAiSugg]      = useState<string | null>(null)
  const [loadAI,      setLoadAI]      = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [autresDeployables, setAutresDeployables] = useState<Array<{ benevole_id: string; email: string; prenom: string; nom: string }>>([])
  const [loadingAutres, setLoadingAutres] = useState(false)
  const [search,     setSearch]     = useState('')

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
      if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) { router.push('/'); return }
      setAuthorized(true)
    }
    init()
  }, [])

  // ── Injection des styles d'impression (avant early return pour respecter Rules of Hooks) ─
  useEffect(() => {
    const existing = document.querySelector('style[data-print-dispo]')
    if (existing) return
    const el = document.createElement('style')
    el.setAttribute('data-print-dispo', 'true')
    el.textContent = `
      @media print {
        @page { size: letter landscape; margin: 10mm; }
        html, body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        header, nav, aside, footer, .no-print { display: none !important; }
        button { display: none !important; }
        input[type="checkbox"] { display: none !important; }
        [data-print-hide] { display: none !important; }
        main { max-width: none !important; padding: 0 !important; }
        /* CRUCIAL: forcer tous les conteneurs a laisser deborder le contenu en impression */
        div, section, article { overflow: visible !important; max-height: none !important; height: auto !important; }
        tr { page-break-inside: avoid !important; }
        thead { display: table-header-group !important; }
        body { font-size: 10pt !important; }
        table { font-size: 9pt !important; }
      }
    `
    document.head.appendChild(el)
    return () => { el.remove() }
  }, [])

  // ── Data ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authorized || !depId) return
    const load = async () => {
      setLoading(true)

      const { data: depData } = await supabase.from('deployments').select('*').eq('id', depId).single()
      if (depData) { setDep(depData as unknown as Deployment); setRotStart(depData.date_debut || ''); setRotEnd(depData.date_fin || '') }

      // Utiliser l'API admin (service_role) pour bypass les RLS auth browser
      try {
        const resp = await fetch(`/api/admin/operations/dispos?dep=${encodeURIComponent(depId)}&full=1`, { credentials: 'include' })
        if (resp.ok) {
          const data = await resp.json() as { ciblages: Ciblage[], reservistes: ReservisteDetail[], dispos: DispoV2[] }
          setCiblages(data.ciblages || [])
          const map: Record<string, ReservisteDetail> = {}
          for (const r of (data.reservistes || [])) { if (r.benevole_id) map[r.benevole_id] = r as unknown as ReservisteDetail }
          setResMap(map)
          setDispos(data.dispos || [])
        }
      } catch (err) {
        console.error('Erreur fetch dispos admin:', err)
      }

      const { data: vagData } = await supabase.from('vagues')
        .select('*').eq('deployment_id', depId).order('numero')
      setVagues((vagData || []) as unknown as Vague[])

      setLoading(false)
    }
    load()
  }, [authorized, depId])

  // ── Computed ──────────────────────────────────────────────────────────────
  const allDates = useMemo(() => dep?.date_debut && dep?.date_fin ? genDates(dep.date_debut, dep.date_fin) : [], [dep])
  const rotDates = useMemo(() => rotStart && rotEnd ? genDates(rotStart, rotEnd) : [], [rotStart, rotEnd])

  const grouped = useMemo(() => {
    const plage: string[] = [], partiel: string[] = [], nondispo: string[] = [], silence: string[] = []
    for (const c of ciblages) {
      const myDispos = dispos.filter(d => d.benevole_id === c.benevole_id)
      if (!myDispos.length) { silence.push(c.benevole_id); continue }
      const dispoDays  = new Set(myDispos.filter(d => d.disponible).map(d => d.date_jour))
      const allNon     = myDispos.every(d => !d.disponible)
      if (allNon) { nondispo.push(c.benevole_id); continue }
      if (!rotDates.length) { partiel.push(c.benevole_id); continue }
      const inWindow   = rotDates.every(d => dispoDays.has(d))
      const someWindow = rotDates.some(d => dispoDays.has(d))
      if (inWindow) plage.push(c.benevole_id)
      else if (someWindow) partiel.push(c.benevole_id)
      else nondispo.push(c.benevole_id)
    }
    return { plage, partiel, nondispo, silence }
  }, [ciblages, dispos, rotDates])

  const nbRequis  = dep?.nb_personnes_par_vague ?? 0

  // Déficit par jour : un jour est en déficit si (oui + à confirmer) < requis
  // C'est plus représentatif que de compter les plages continues car on est en jour-par-jour
  const joursDeficit = useMemo(() => {
    if (nbRequis === 0 || rotDates.length === 0) return [] as string[]
    return rotDates.filter(d => {
      const dispoJour = dispos.filter(x => x.date_jour === d && x.disponible).length
      const confJour  = dispos.filter(x => x.date_jour === d && x.a_confirmer).length
      return dispoJour + confJour < nbRequis
    })
  }, [rotDates, dispos, nbRequis])

  // % Oui : proportion des cibles qui ont dit oui à au moins une journée
  const nbOuiAuMoinsUnJour = grouped.plage.length + grouped.partiel.length
  const pctOui = ciblages.length > 0 ? Math.round(nbOuiAuMoinsUnJour / ciblages.length * 100) : 0

  // ── Vagues d'envoi ────────────────────────────────────────────────────────
  // Détecte automatiquement les vagues de notification (ciblage → SMS/email)
  // en regroupant les ciblages notifiés par clusters temporels (gap > 30 min = nouvelle vague).
  // Utile quand l'admin relance des ciblages supplémentaires pour combler un déficit :
  // permet de visualiser qui a répondu dans chaque vague.
  const WAVE_COLORS = useMemo(() => ([
    { bg: '#f1f5f9', color: '#475569' }, // V1 — gris neutre
    { bg: '#ffedd5', color: '#c2410c' }, // V2 — orange
    { bg: '#f5f3ff', color: '#7c3aed' }, // V3 — violet
    { bg: '#ecfeff', color: '#0891b2' }, // V4 — teal
    { bg: '#fef3c7', color: '#a16207' }, // V5 — ambre
  ]), [])

  const wavesInfo = useMemo(() => {
    const GAP_MS = 30 * 60 * 1000 // 30 minutes entre deux vagues
    const fallback = { bg: '#f1f5f9', color: '#475569' }
    const notified = ciblages
      .filter(c => c.statut === 'notifie' && c.updated_at)
      .map(c => ({ bid: c.benevole_id, t: new Date(c.updated_at!).getTime() }))
      .sort((a, b) => a.t - b.t)

    const waveByBid = new Map<string, number>()
    if (notified.length === 0) {
      return { waveByBid, waveCount: 0, waveStats: [] as Array<{ wave: number; total: number; repondus: number; silence: number; notifiedAt: Date; color: { bg: string; color: string } }> }
    }

    const waveFirstTime: number[] = [notified[0].t]
    let currentWave = 1
    waveByBid.set(notified[0].bid, 1)
    for (let i = 1; i < notified.length; i++) {
      if (notified[i].t - notified[i-1].t > GAP_MS) {
        currentWave++
        waveFirstTime.push(notified[i].t)
      }
      waveByBid.set(notified[i].bid, currentWave)
    }

    const waveStats = [] as Array<{ wave: number; total: number; repondus: number; silence: number; notifiedAt: Date; color: { bg: string; color: string } }>
    for (let w = 1; w <= currentWave; w++) {
      const bidsOfWave = [...waveByBid.entries()].filter(([, n]) => n === w).map(([bid]) => bid)
      const repondus = bidsOfWave.filter(bid => dispos.some(d => d.benevole_id === bid)).length
      waveStats.push({
        wave: w,
        total: bidsOfWave.length,
        repondus,
        silence: bidsOfWave.length - repondus,
        notifiedAt: new Date(waveFirstTime[w-1]),
        color: WAVE_COLORS[w-1] || fallback,
      })
    }

    return { waveByBid, waveCount: currentWave, waveStats }
  }, [ciblages, dispos, WAVE_COLORS])

  function getDistance(bid: string): number | null {
    if (!dep?.latitude || !dep?.longitude) return null
    const r = resMap[bid]
    if (!r?.latitude || !r?.longitude) return null
    return haversine(dep.latitude, dep.longitude, r.latitude, r.longitude)
  }

  function sortedByDist(ids: string[]): string[] {
    return [...ids].sort((a, b) => {
      const da = getDistance(a), db = getDistance(b)
      if (da === null && db === null) return 0
      if (da === null) return 1; if (db === null) return -1
      return da - db
    })
  }

  // Filtre par recherche : prénom, nom, ville, ou n'importe quel mot du nom complet.
  // Recherche insensible à la casse et aux accents.
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const searchTerms = useMemo(
    () => normalize(search.trim()).split(/\s+/).filter(Boolean),
    [search]
  )
  function matchesSearch(bid: string): boolean {
    if (searchTerms.length === 0) return true
    const r = resMap[bid]
    if (!r) return false
    const haystack = normalize([r.prenom, r.nom, r.ville, r.region].filter(Boolean).join(' '))
    return searchTerms.every(t => haystack.includes(t))
  }
  function filterAndSort(ids: string[]): string[] {
    const filtered = searchTerms.length > 0 ? ids.filter(matchesSearch) : ids
    return sortedByDist(filtered)
  }

  const toggleSelect = (bid: string) => setSelected(prev => {
    const next = new Set(prev); next.has(bid) ? next.delete(bid) : next.add(bid); return next
  })

  // ── IA ────────────────────────────────────────────────────────────────────
  const getAISugg = async () => {
    if (!dep) return
    setLoadAI(true); setAiSugg(null)
    try {
      const res = await fetch('/api/operations/rotation-ia', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          deployment: { nom:dep.nom, lieu:dep.lieu, date_debut:dep.date_debut, date_fin:dep.date_fin, nb_personnes_par_vague:dep.nb_personnes_par_vague },
          disponibilites: ciblages.map(c => ({
            benevole_id: c.benevole_id,
            jours_dispo: dispos.filter(d => d.benevole_id === c.benevole_id && d.disponible).map(d => d.date_jour),
          })),
          vagues_existantes: vagues,
          note_operationnelle: 'Tenir compte du chevauchement opérationnel : la rotation suivante doit être en transit la veille du dernier jour de la rotation précédente.',
        }),
      })
      const json = await res.json()
      setAiSugg(json.suggestion || 'Aucune suggestion disponible.')
    } catch { setAiSugg("Erreur lors de la consultation de l'IA.") }
    setLoadAI(false)
  }

  // Selection filtree pour la rotation : exclut les nondispo
  // (nondispo peut etre selectionne pour courriel de remerciement mais pas mobilise)
  const selectedForRotation = useMemo(
    () => Array.from(selected).filter(bid => !grouped.nondispo.includes(bid)),
    [selected, grouped.nondispo]
  )

  // ── Créer rotation ────────────────────────────────────────────────────────
  const creerRotation = async () => {
    if (!depId || !rotStart || !rotEnd || selectedForRotation.length === 0) return
    setSaving(true)
    const nextNum  = (vagues.length || 0) + 1
    const identifiant = `ROT-${nextNum.toString().padStart(2,'0')}`
    const { error } = await supabase.from('vagues').insert({
      deployment_id: depId, numero: nextNum, identifiant,
      date_debut: rotStart, date_fin: rotEnd,
      nb_personnes_requis: selectedForRotation.length, statut: 'Planifiée',
    })
    if (!error) router.push(`/admin/operations?dep=${depId}`)
    setSaving(false)
  }

  if (!authorized) return null

  // ─── Composants internes ──────────────────────────────────────────────────

  const PersonRow = ({ bid, groupe }: { bid: string; groupe: Groupe }) => {
    const r       = resMap[bid]
    const myDispos = dispos.filter(d => d.benevole_id === bid)
    const dispMap  = Object.fromEntries(myDispos.map(d => [d.date_jour, d]))
    const dist     = getDistance(bid)
    const isSel    = selected.has(bid)

    // Délai entre l'envoi du ciblage (updated_at) et la 1ère soumission de dispo
    const ciblage = ciblages.find(c => c.benevole_id === bid)
    const firstDispoMs = myDispos.length > 0
      ? Math.min(...myDispos.map(d => d.created_at ? new Date(d.created_at).getTime() : Infinity))
      : Infinity
    const cibMs = ciblage?.updated_at ? new Date(ciblage.updated_at).getTime() : null
    const delayMin = (cibMs !== null && firstDispoMs !== Infinity && firstDispoMs > cibMs)
      ? Math.round((firstDispoMs - cibMs) / 60000)
      : null
    const formatDelay = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m/60)}h${(m%60).toString().padStart(2,'0')}`

    return (
      <tr style={{ backgroundColor: isSel ? '#eff6ff' : 'transparent', transition:'background 0.1s' }}
        onMouseOver={e => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = '#f8fafc' }}
        onMouseOut={e  => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}>
        {/* Checkbox — tous les groupes selectionnables (nondispo filtre en creer-rotation) */}
        <td style={{ padding:'5px 8px', textAlign:'center', borderBottom:'1px solid #f1f5f9', verticalAlign:'middle' }}>
          <input type="checkbox" checked={isSel} onChange={() => toggleSelect(bid)}
            style={{ width:14, height:14, cursor:'pointer', accentColor:C }}/>
        </td>
        {/* Nom + badges + distance */}
        <td style={{ padding:'5px 10px', borderBottom:'1px solid #f1f5f9', minWidth:170, verticalAlign:'top' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#1e293b' }}>
              {r ? `${r.prenom} ${r.nom}` : bid}
            </span>
            {/* Badge de vague d'envoi — seulement si 2+ vagues détectées */}
            {wavesInfo.waveCount >= 2 && (() => {
              const w = wavesInfo.waveByBid.get(bid)
              if (!w) return null
              const c = wavesInfo.waveStats[w-1]?.color
              if (!c) return null
              return (
                <span title={`Notifié en vague ${w}`} style={{
                  fontSize:9, padding:'1px 6px', borderRadius:6,
                  backgroundColor: c.color, color:'white',
                  fontWeight:700, whiteSpace:'nowrap', letterSpacing:'0.02em'
                }}>V{w}</span>
              )
            })()}
            {dist !== null && (
              <span style={{ fontSize:10, color:'#64748b', whiteSpace:'nowrap', padding:'1px 6px', borderRadius:6, backgroundColor:'#f1f5f9' }}>
                📍 {dist < 10 ? dist.toFixed(1) : Math.round(dist)} km
              </span>
            )}
          </div>
          {r && <BadgesComp r={r}/>}
          {r?.ville && <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{r.ville}{r.region ? ` · ${r.region}` : ''}</div>}
          {delayMin !== null && (
            <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>
              ⏱ Réponse en {formatDelay(delayMin)}
            </div>
          )}
        </td>
        {/* Cellule par jour */}
        {allDates.map(date => {
          const d    = dispMap[date]
          const inRot = rotDates.includes(date)
          const bg   = !d
            ? (inRot ? '#f1f5f9' : 'transparent')
            : d.disponible
              ? (inRot ? '#bbf7d0' : '#d1fae5')
              : (inRot ? '#fecaca' : '#fee2e2')
          return (
            <td key={date} style={{
              padding:'5px 3px', textAlign:'center', borderBottom:'1px solid #f1f5f9',
              backgroundColor: bg, minWidth:30,
              borderLeft:  inRot && date === rotStart ? '2px solid #3b82f6' : undefined,
              borderRight: inRot && date === rotEnd   ? '2px solid #3b82f6' : undefined,
            }}>
              <span style={{ fontSize:11 }}>{!d ? '·' : d.disponible ? '✓' : '✗'}</span>
            </td>
          )
        })}
        {/* Transport — badge colore selon le mode */}
        <td style={{ padding:'5px 8px', borderBottom:'1px solid #f1f5f9', fontSize:10, verticalAlign:'top', whiteSpace:'nowrap' }}>
          {(() => {
            const t = myDispos.find(d => d.transport)?.transport
            if (!t) return <span style={{ color:'#cbd5e1' }}>·</span>
            const cfg: Record<string, { icon: string; label: string; bg: string; color: string }> = {
              autonome:               { icon:'🚗', label:'Autonome',         bg:'#f0fdf4', color:'#065f46' },
              covoiturage_offre:      { icon:'🤝', label:'Offre covoit.',    bg:'#eff6ff', color:'#1d4ed8' },
              covoiturage_recherche:  { icon:'🔎', label:'Cherche covoit.',  bg:'#faf5ff', color:'#7c3aed' },
              besoin_transport:       { icon:'🚌', label:'Besoin transport', bg:'#fff7ed', color:'#c2410c' },
            }
            const c = cfg[t] || { icon:'?', label:t, bg:'#f1f5f9', color:'#475569' }
            return (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:6, backgroundColor:c.bg, color:c.color, fontWeight:600, fontSize:10 }}>
                {c.icon} {c.label}
              </span>
            )
          })()}
        </td>
        {/* Commentaires — premier commentaire non vide parmi les dispos du réserviste */}
        <td style={{ padding:'5px 10px', borderBottom:'1px solid #f1f5f9', fontSize:10, color:'#475569', verticalAlign:'top' }}>
          {(() => {
            const com = myDispos.find(d => d.commentaire && d.commentaire.trim())?.commentaire
            return com ? <span style={{ whiteSpace:'pre-wrap' }}>{com}</span> : <span style={{ color:'#cbd5e1' }}>—</span>
          })()}
        </td>
      </tr>
    )
  }

  const GroupeSection = ({ ids, groupe }: { ids: string[]; groupe: Groupe }) => {
    if (!ids.length) return null
    const cfg    = GROUPE_CFG[groupe]
    const sorted = filterAndSort(ids)
    // Si une recherche est active mais qu'aucun résultat dans ce groupe, on cache la section.
    if (searchTerms.length > 0 && sorted.length === 0) return null
    return (
      <>
        <tr>
          <td colSpan={4 + allDates.length} style={{
            padding:'6px 14px', backgroundColor:cfg.bg,
            borderTop:'2px solid ' + cfg.border, borderBottom:'1px solid ' + cfg.border,
          }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#475569' }}>{cfg.label}</span>
            <span style={{ marginLeft:8, fontSize:11, color:'#64748b' }}>· {ids.length} pers.</span>
            <button onClick={() => setSelected(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next })}
              style={{ marginLeft:12, fontSize:10, padding:'2px 8px', borderRadius:6, backgroundColor:C, color:'white', border:'none', cursor:'pointer', fontWeight:600 }}>
              Sélectionner ce groupe
            </button>
            <button onClick={() => setSelected(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next })}
              style={{ marginLeft:6, fontSize:10, padding:'2px 8px', borderRadius:6, backgroundColor:'white', color:'#64748b', border:'1px solid #e5e7eb', cursor:'pointer', fontWeight:600 }}>
              Désélectionner
            </button>
          </td>
        </tr>
        {sorted.map(bid => <PersonRow key={bid} bid={bid} groupe={groupe}/>)}
      </>
    )
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div>
      <main style={{ maxWidth:1400, margin:'0 auto', padding:'20px 16px 60px' }}>

        {/* En-tête */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <button onClick={() => router.push(`/admin/operations?dep=${depId}`)}
            style={{ background:'none', border:'none', color:'#9ca3af', fontSize:13, cursor:'pointer' }}>
            ← Opérations
          </button>
          <div>
            <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:C }}>
              📊 Disponibilités · {dep?.nom || '…'}
            </h1>
            {dep && (
              <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                {dep.lieu && <span>📍 {dep.lieu} · </span>}
                {dep.date_debut && dep.date_fin && <span>📅 {dateFr(dep.date_debut)} → {dateFr(dep.date_fin)}</span>}
                {nbRequis > 0 && <span> · 👥 {nbRequis} pers./rotation</span>}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding:60, textAlign:'center', color:'#94a3b8', fontSize:14 }}>Chargement…</div>
        ) : <>

          {/* Rotations existantes */}
          {vagues.length > 0 && (
            <div style={{ backgroundColor:'white', borderRadius:12, border:'1px solid #e5e7eb', padding:'12px 16px', marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#475569' }}>Rotations existantes :</span>
              {vagues.map(v => (
                <span key={v.id} style={{ fontSize:11, padding:'3px 10px', borderRadius:20, backgroundColor:'#f5f3ff', color:'#7c3aed', fontWeight:600 }}>
                  {v.identifiant||`ROT-${v.numero}`} · {dateFr(v.date_debut)} → {dateFr(v.date_fin)} · {v.nb_personnes_requis ?? '?'} pers.
                </span>
              ))}
            </div>
          )}

          {/* Fenêtre + stats */}
          <div style={{ backgroundColor:'white', borderRadius:12, border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:16, display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4, textTransform:'uppercase' as const, letterSpacing:'0.04em' }}>
                Fenêtre de rotation
              </label>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <input type="date" value={rotStart} min={dep?.date_debut} max={dep?.date_fin}
                  onChange={e => setRotStart(e.target.value)}
                  style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, color:'#1e293b' }}/>
                <span style={{ color:'#94a3b8' }}>→</span>
                <input type="date" value={rotEnd} min={rotStart || dep?.date_debut} max={dep?.date_fin}
                  onChange={e => setRotEnd(e.target.value)}
                  style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, color:'#1e293b' }}/>
                {joursDeficit.length > 0 && (
                  <span style={{ padding:'4px 10px', borderRadius:6, backgroundColor:'#fef3c7', border:'1px solid #fde68a', fontSize:11, color:'#92400e', fontWeight:600 }}>
                    ⚠️ {joursDeficit.length} jour{joursDeficit.length > 1 ? 's' : ''} déficit
                  </span>
                )}
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
                💡 Clique un jour ci-dessous pour définir la fenêtre. Shift+clic pour étendre la plage.
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {[
                { label:'Ciblés',        val:ciblages.length,        color:'#1e3a5f', bg:'#eff6ff' },
                { label:'Dans la plage', val:grouped.plage.length,   color:'#065f46', bg:'#d1fae5' },
                { label:'Partiel',       val:grouped.partiel.length, color:'#92400e', bg:'#fef3c7' },
                { label:'Non dispo',     val:grouped.nondispo.length,color:'#991b1b', bg:'#fee2e2' },
                { label:'Sans réponse',  val:grouped.silence.length, color:'#475569', bg:'#f1f5f9' },
                { label:'% Réponses',    val: ciblages.length > 0 ? Math.round((ciblages.length - grouped.silence.length) / ciblages.length * 100) + '%' : '0%', color:'#0369a1', bg:'#e0f2fe' },
                { label:'% Oui ≥1 jour', val: pctOui + '%',          color:'#065f46', bg:'#d1fae5' },
                ...(nbRequis > 0 ? [{ label:'Requis', val:nbRequis, color:'#1e3a5f', bg:'#e0e7ff' }] : []),
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center', padding:'6px 14px', borderRadius:10, backgroundColor:s.bg }}>
                  <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Stats par jour : nb dispo + à confirmer pour chaque date de la fenêtre — cliquable */}
            {allDates.length > 0 && (
              <div style={{ width:'100%', marginTop:4 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase' as const, letterSpacing:'0.04em' }}>
                  Disponibles par jour (oui + à confirmer)
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {allDates.map(d => {
                    const dispoJour = dispos.filter(x => x.date_jour === d && x.disponible).length
                    const confJour  = dispos.filter(x => x.date_jour === d && x.a_confirmer).length
                    const total     = dispoJour + confJour
                    const manque    = nbRequis > 0 ? Math.max(0, nbRequis - total) : 0
                    const inRot     = rotDates.includes(d)
                    const labelDate = new Date(d + 'T00:00:00').toLocaleDateString('fr-CA', { weekday:'short', day:'numeric', month:'short' })
                    const onClickDay = (ev: React.MouseEvent) => {
                      if (ev.shiftKey && rotStart) {
                        // Shift+clic: étendre la plage depuis rotStart jusqu'à d (ou inverser si d < rotStart)
                        if (d < rotStart) { setRotEnd(rotStart); setRotStart(d) }
                        else { setRotEnd(d) }
                      } else {
                        // Clic simple: single-day window
                        setRotStart(d); setRotEnd(d)
                      }
                    }
                    return (
                      <div key={d}
                        onClick={onClickDay}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickDay(e as any) } }}
                        title="Clic: fenêtre d'1 jour  ·  Shift+clic: étendre la plage"
                        style={{
                          textAlign:'center', padding:'8px 14px', borderRadius:10,
                          backgroundColor: inRot ? '#eff6ff' : '#f8fafc',
                          border: inRot ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                          minWidth:100, cursor:'pointer', userSelect:'none',
                          transition:'transform 0.1s, box-shadow 0.1s',
                        }}
                        onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(59,130,246,0.15)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                        onMouseOut={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
                      >
                        <div style={{ fontSize:10, color:'#64748b', fontWeight:600, textTransform:'uppercase' as const }}>
                          {labelDate}
                        </div>
                        <div style={{ fontSize:22, fontWeight:800, color: nbRequis > 0 && total < nbRequis ? '#d97706' : '#065f46', marginTop:2 }}>
                          {total}
                          {nbRequis > 0 && <span style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}> / {nbRequis}</span>}
                        </div>
                        <div style={{ fontSize:10, color:'#64748b', fontWeight:500, marginTop:2 }}>
                          ✓ {dispoJour}{confJour > 0 && ` + ⏳ ${confJour}`}
                          {manque > 0 && <span style={{ color:'#dc2626', fontWeight:700 }}> (−{manque})</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Vagues d'envoi — affiche un panneau si 2+ vagues détectées */}
          {wavesInfo.waveCount >= 2 && (
            <div style={{ backgroundColor:'white', borderRadius:12, border:'1px solid #e5e7eb', padding:'14px 18px', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase' as const, letterSpacing:'0.04em' }}>
                  📨 Vagues d'envoi détectées ({wavesInfo.waveCount})
                </span>
                <span style={{ fontSize:10, color:'#94a3b8' }}>
                  · regroupement automatique par cluster temporel (gap &gt; 30 min)
                </span>
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {wavesInfo.waveStats.map(w => {
                  const pct = w.total > 0 ? Math.round(w.repondus / w.total * 100) : 0
                  const envoyeLe = w.notifiedAt.toLocaleDateString('fr-CA', { day:'numeric', month:'short' }) + ' ' +
                                   w.notifiedAt.toLocaleTimeString('fr-CA', { hour:'2-digit', minute:'2-digit' })
                  return (
                    <div key={w.wave} style={{
                      padding:'10px 14px', borderRadius:10,
                      backgroundColor: w.color.bg,
                      border: `1.5px solid ${w.color.color}55`,
                      minWidth:180, flex:'0 0 auto'
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <span style={{
                          padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700,
                          backgroundColor: w.color.color, color:'white'
                        }}>V{w.wave}</span>
                        <span style={{ fontSize:10, color:'#64748b' }}>envoyé le {envoyeLe}</span>
                      </div>
                      <div style={{ fontSize:15, fontWeight:700, color: w.color.color }}>
                        {w.repondus} / {w.total}
                        <span style={{ fontWeight:500, fontSize:11, color:'#64748b', marginLeft:6 }}>répondu ({pct}%)</span>
                      </div>
                      <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>
                        · {w.silence} sans réponse
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Suggestion IA */}
          <div data-print-hide style={{ backgroundColor:'white', borderRadius:12, border:'1.5px solid #ddd6fe', padding:'14px 20px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: aiSugg ? 12 : 0 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#5b21b6' }}>✦ Suggestion IA — Fenêtres de rotation</span>
              <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, backgroundColor:'#8b5cf6', color:'white', fontWeight:600 }}>IA</span>
              <button onClick={getAISugg} disabled={loadAI} style={{
                marginLeft:'auto', padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600,
                backgroundColor: loadAI ? '#e5e7eb' : '#8b5cf6',
                color: loadAI ? '#9ca3af' : 'white', border:'none',
                cursor: loadAI ? 'not-allowed' : 'pointer',
              }}>
                {loadAI ? '⏳ Analyse en cours…' : '✦ Demander à Claude'}
              </button>
            </div>
            {aiSugg
              ? <pre style={{ fontSize:12, color:'#4c1d95', margin:0, whiteSpace:'pre-wrap', lineHeight:1.6, fontFamily:'inherit', backgroundColor:'#faf5ff', borderRadius:8, padding:12 }}>{aiSugg}</pre>
              : !loadAI && <p style={{ margin:0, fontSize:12, color:'#a78bfa' }}>Claude analysera les disponibilités et proposera les meilleures fenêtres de rotation en tenant compte du chevauchement opérationnel d'un jour.</p>
            }
          </div>

          {/* Grille principale */}
          <div style={{ backgroundColor:'white', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:16 }}>
            <div style={{ padding:'10px 16px', backgroundColor:'#f8fafc', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, fontWeight:700, color:C }}>
                  Échéancier complet · {ciblages.length} réservistes · triés par distance
                </span>
                {/* Recherche par nom/prénom/ville (insensible à la casse et aux accents) */}
                <div style={{ display:'flex', alignItems:'center', gap:6, position:'relative' }}>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Rechercher (nom, ville…)"
                    style={{
                      padding:'5px 28px 5px 10px', fontSize:12, borderRadius:6,
                      border:'1px solid #cbd5e1', backgroundColor:'white',
                      width:220, color:'#1e293b'
                    }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      title="Effacer la recherche"
                      style={{
                        position:'absolute', right:4, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer',
                        color:'#94a3b8', fontSize:14, padding:'2px 6px', lineHeight:1
                      }}
                    >×</button>
                  )}
                  {searchTerms.length > 0 && (() => {
                    const matchCount = (['plage','partiel','nondispo','silence'] as Groupe[])
                      .reduce((sum, g) => sum + grouped[g].filter(matchesSearch).length, 0)
                    return (
                      <span style={{ fontSize:11, color: matchCount > 0 ? '#059669' : '#dc2626', fontWeight:600 }}>
                        {matchCount} résultat{matchCount > 1 ? 's' : ''}
                      </span>
                    )
                  })()}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                {/* Raccourcis selection par categorie + ouvrir courriel */}
                {grouped.silence.length > 0 && (
                  <button
                    onClick={() => { setSelected(new Set(grouped.silence)); setShowEmailModal(true) }}
                    title="Selectionne tous les non-repondants et ouvre le compose courriel"
                    style={{ fontSize:11, padding:'3px 10px', borderRadius:6, backgroundColor:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe', cursor:'pointer', fontWeight:600 }}>
                    📧 Relancer sans-réponse ({grouped.silence.length})
                  </button>
                )}
                {grouped.nondispo.length > 0 && (
                  <button
                    onClick={() => { setSelected(new Set(grouped.nondispo)); setShowEmailModal(true) }}
                    title="Selectionne les non-dispos et ouvre le compose courriel"
                    style={{ fontSize:11, padding:'3px 10px', borderRadius:6, backgroundColor:'#fef2f2', color:'#991b1b', border:'1px solid #fecaca', cursor:'pointer', fontWeight:600 }}>
                    📧 Remercier non-dispo ({grouped.nondispo.length})
                  </button>
                )}
                {(grouped.plage.length + grouped.partiel.length) > 0 && (
                  <button
                    onClick={() => { setSelected(new Set([...grouped.plage, ...grouped.partiel])); setShowEmailModal(true) }}
                    title="Selectionne les dispos (plage + partiel) et ouvre le compose courriel"
                    style={{ fontSize:11, padding:'3px 10px', borderRadius:6, backgroundColor:'#ecfdf5', color:'#065f46', border:'1px solid #a7f3d0', cursor:'pointer', fontWeight:600 }}>
                    📧 Contacter dispos ({grouped.plage.length + grouped.partiel.length})
                  </button>
                )}
                <button
                  disabled={loadingAutres}
                  onClick={async () => {
                    if (!depId) return
                    setLoadingAutres(true)
                    try {
                      const resp = await fetch(`/api/admin/operations/deployables-autres?dep=${encodeURIComponent(depId)}`, { credentials: 'include' })
                      if (resp.ok) {
                        const data = await resp.json() as { deployables: Array<{ benevole_id: string; email: string; prenom: string; nom: string }> }
                        setAutresDeployables(data.deployables || [])
                        setShowEmailModal(true)
                      } else {
                        alert('Erreur chargement autres deployables')
                      }
                    } finally {
                      setLoadingAutres(false)
                    }
                  }}
                  title="Deployables (qualification complete) qui ne sont PAS cibles dans ce deployment"
                  style={{ fontSize:11, padding:'3px 10px', borderRadius:6, backgroundColor:'#fdf4ff', color:'#86198f', border:'1px solid #f5d0fe', cursor: loadingAutres ? 'wait' : 'pointer', fontWeight:600, opacity: loadingAutres ? 0.6 : 1 }}>
                  {loadingAutres ? '⏳ Chargement…' : '📧 Autres déployables (non ciblés)'}
                </button>
                {selected.size > 0 && (
                  <span style={{ fontSize:12, padding:'3px 12px', borderRadius:20, backgroundColor:'#eff6ff', color:C, fontWeight:700 }}>
                    {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
                    {nbRequis > 0 && ` / ${nbRequis} requis`}
                  </span>
                )}
                <button onClick={() => setSelected(new Set())}
                  style={{ fontSize:11, color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>
                  Tout désélectionner
                </button>
              </div>
            </div>

            <div style={{ overflowX:'auto' }}>
              <table style={{ borderCollapse:'collapse', width:'100%', fontSize:11 }}>
                <thead>
                  <tr style={{ backgroundColor:'#f8fafc' }}>
                    <th style={{ width:32, borderBottom:'2px solid #e5e7eb', padding:4 }}></th>
                    <th style={{ padding:'6px 10px', textAlign:'left', color:'#64748b', fontWeight:700, borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' as const, minWidth:180 }}>
                      Nom · Compétences · Distance
                    </th>
                    {allDates.map(d => {
                      const inRot = rotDates.includes(d)
                      return (
                        <th key={d} style={{
                          padding:'4px 2px', textAlign:'center',
                          color: inRot ? '#1d4ed8' : '#94a3b8',
                          fontWeight: inRot ? 800 : 500,
                          borderBottom:'2px solid #e5e7eb',
                          borderLeft:  inRot && d === rotStart ? '2px solid #3b82f6' : undefined,
                          borderRight: inRot && d === rotEnd   ? '2px solid #3b82f6' : undefined,
                          backgroundColor: inRot ? '#eff6ff' : undefined,
                          whiteSpace:'nowrap' as const, minWidth:32,
                        }}>
                          {d.slice(5)}
                        </th>
                      )
                    })}
                    <th style={{ padding:'6px 8px', textAlign:'left', color:'#64748b', fontWeight:700, borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' as const, minWidth:130 }}>
                      Transport
                    </th>
                    <th style={{ padding:'6px 10px', textAlign:'left', color:'#64748b', fontWeight:700, borderBottom:'2px solid #e5e7eb', minWidth:200 }}>
                      Commentaires
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <GroupeSection ids={grouped.plage}    groupe="plage"/>
                  <GroupeSection ids={grouped.partiel}  groupe="partiel"/>
                  <GroupeSection ids={grouped.nondispo} groupe="nondispo"/>
                  <GroupeSection ids={grouped.silence}  groupe="silence"/>
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div style={{ backgroundColor:'white', borderRadius:12, border:'1px solid #e5e7eb', padding:'16px 20px', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <button
              onClick={creerRotation}
              disabled={saving || selectedForRotation.length === 0 || !rotStart || !rotEnd}
              title={selected.size > selectedForRotation.length ? `${selected.size - selectedForRotation.length} non dispo sera exclu(e)(s) de la rotation` : undefined}
              style={{
                padding:'10px 22px', borderRadius:8, fontSize:13, fontWeight:700,
                backgroundColor: selectedForRotation.length === 0 ? '#e5e7eb' : '#065f46',
                color: selectedForRotation.length === 0 ? '#9ca3af' : 'white',
                border:'none', cursor: selectedForRotation.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '⏳ Création…' : `✅ Créer la rotation — ${selectedForRotation.length} pers. · ${dateFr(rotStart)} → ${dateFr(rotEnd)}`}
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              disabled={selected.size === 0}
              title={selected.size === 0 ? 'Sélectionnez au moins 1 réserviste' : `Composer courriel à ${selected.size} réserviste(s)`}
              style={{
                padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600,
                backgroundColor: selected.size === 0 ? '#e5e7eb' : '#1d4ed8',
                color: selected.size === 0 ? '#9ca3af' : 'white',
                border:'none',
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              }}>
              📧 Envoyer courriel ({selected.size})
            </button>

            <button disabled title="Disponible prochainement" style={{
              padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600,
              backgroundColor:'#f8fafc', color:'#94a3b8',
              border:'1px dashed #cbd5e1', cursor:'not-allowed',
            }}>
              🗺️ Voir sur la carte (bientôt)
            </button>

            {selected.size > 0 && nbRequis > 0 && selected.size < nbRequis && (
              <span style={{ fontSize:12, color:'#dc2626', fontWeight:600 }}>
                ⚠️ {nbRequis - selected.size} personne{nbRequis - selected.size > 1 ? 's' : ''} manquante{nbRequis - selected.size > 1 ? 's' : ''}
              </span>
            )}
            {selected.size > 0 && nbRequis > 0 && selected.size > nbRequis && (
              <span style={{ fontSize:12, color:'#f59e0b', fontWeight:600 }}>
                ⚠️ {selected.size - nbRequis} personne{selected.size - nbRequis > 1 ? 's' : ''} en surplus — réduire la sélection
              </span>
            )}
          </div>

        </>}
      </main>

      {/* Modal composition courriel
          - Si autresDeployables a des entrees => on les utilise (bouton 'Autres deployables')
          - Sinon => liste basee sur la selection locale (resMap) */}
      {showEmailModal && (
        <ModalComposeCourriel
          destinataires={autresDeployables.length > 0
            ? autresDeployables
            : Array.from(selected)
                .map(bid => resMap[bid])
                .filter(r => r && r.email)
                .map(r => ({
                  benevole_id: r!.benevole_id,
                  email: r!.email!,
                  prenom: r!.prenom,
                  nom: r!.nom,
                }))}
          onClose={() => { setShowEmailModal(false); setAutresDeployables([]) }}
          onSent={() => { setShowEmailModal(false); setAutresDeployables([]) }}
        />
      )}
    </div>
  )
}

export default function DisponibilitesPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'48px 0', color:'#94a3b8', fontSize:14 }}>Chargement…</div>}>
      <DisponibilitesInner/>
    </Suspense>
  )
}
