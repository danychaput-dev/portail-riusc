'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = '#1e3a5f'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Deployment {
  id: string; identifiant: string; nom: string; lieu?: string
  date_debut?: string; date_fin?: string; nb_personnes_par_vague?: number
  latitude?: number; longitude?: number
}
interface ReservisteDetail {
  benevole_id: string; prenom: string; nom: string; telephone: string
  ville?: string; region?: string; latitude?: number; longitude?: number
  competence_rs?: string[]; certificat_premiers_soins?: string[]
  vehicule_tout_terrain?: string[]; navire_marin?: string[]
  permis_conduire?: string[]; satp_drone?: string[]; equipe_canine?: string[]
  competences_securite?: string[]; competences_sauvetage?: string[]
  communication?: string[]; cartographie_sig?: string[]; operation_urgence?: string[]
}
interface DispoV2 { benevole_id: string; date_jour: string; disponible: boolean; a_confirmer: boolean }
interface Ciblage { id: string; benevole_id: string; statut: string }
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
        tr { page-break-inside: avoid !important; }
        thead { display: table-header-group !important; }
        body { font-size: 10pt !important; }
        table { font-size: 9pt !important; }
        [data-print-expand] { overflow: visible !important; max-height: none !important; }
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
  const deficit   = nbRequis > 0 ? Math.max(0, nbRequis - grouped.plage.length) : 0

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

  // ── Créer rotation ────────────────────────────────────────────────────────
  const creerRotation = async () => {
    if (!depId || !rotStart || !rotEnd || selected.size === 0) return
    setSaving(true)
    const nextNum  = (vagues.length || 0) + 1
    const identifiant = `ROT-${nextNum.toString().padStart(2,'0')}`
    const { error } = await supabase.from('vagues').insert({
      deployment_id: depId, numero: nextNum, identifiant,
      date_debut: rotStart, date_fin: rotEnd,
      nb_personnes_requis: selected.size, statut: 'Planifiée',
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

    return (
      <tr style={{ backgroundColor: isSel ? '#eff6ff' : 'transparent', transition:'background 0.1s' }}
        onMouseOver={e => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = '#f8fafc' }}
        onMouseOut={e  => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}>
        {/* Checkbox */}
        <td style={{ padding:'5px 8px', textAlign:'center', borderBottom:'1px solid #f1f5f9', verticalAlign:'middle' }}>
          {groupe !== 'nondispo' && (
            <input type="checkbox" checked={isSel} onChange={() => toggleSelect(bid)}
              style={{ width:14, height:14, cursor:'pointer', accentColor:C }}/>
          )}
        </td>
        {/* Nom + badges + distance */}
        <td style={{ padding:'5px 10px', borderBottom:'1px solid #f1f5f9', minWidth:170, verticalAlign:'top' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#1e293b' }}>
              {r ? `${r.prenom} ${r.nom}` : bid}
            </span>
            {dist !== null && (
              <span style={{ fontSize:10, color:'#64748b', whiteSpace:'nowrap', padding:'1px 6px', borderRadius:6, backgroundColor:'#f1f5f9' }}>
                📍 {dist < 10 ? dist.toFixed(1) : Math.round(dist)} km
              </span>
            )}
          </div>
          {r && <BadgesComp r={r}/>}
          {r?.ville && <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{r.ville}{r.region ? ` · ${r.region}` : ''}</div>}
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
      </tr>
    )
  }

  const GroupeSection = ({ ids, groupe }: { ids: string[]; groupe: Groupe }) => {
    if (!ids.length) return null
    const cfg    = GROUPE_CFG[groupe]
    const sorted = sortedByDist(ids)
    return (
      <>
        <tr>
          <td colSpan={2 + allDates.length} style={{
            padding:'6px 14px', backgroundColor:cfg.bg,
            borderTop:'2px solid ' + cfg.border, borderBottom:'1px solid ' + cfg.border,
          }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#475569' }}>{cfg.label}</span>
            <span style={{ marginLeft:8, fontSize:11, color:'#64748b' }}>— {ids.length} pers.</span>
            {groupe === 'plage' && (
              <button onClick={() => setSelected(new Set(ids))}
                style={{ marginLeft:12, fontSize:10, padding:'2px 8px', borderRadius:6, backgroundColor:C, color:'white', border:'none', cursor:'pointer', fontWeight:600 }}>
                Tout sélectionner
              </button>
            )}
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
              📊 Disponibilités — {dep?.nom || '…'}
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
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="date" value={rotStart} min={dep?.date_debut} max={dep?.date_fin}
                  onChange={e => setRotStart(e.target.value)}
                  style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, color:'#1e293b' }}/>
                <span style={{ color:'#94a3b8' }}>→</span>
                <input type="date" value={rotEnd} min={rotStart || dep?.date_debut} max={dep?.date_fin}
                  onChange={e => setRotEnd(e.target.value)}
                  style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, color:'#1e293b' }}/>
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
                💡 La rotation suivante devrait commencer 1 jour avant la fin de celle-ci (chevauchement opérationnel)
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
                ...(nbRequis > 0 ? [{ label:'Requis', val:nbRequis, color:'#1e3a5f', bg:'#e0e7ff' }] : []),
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center', padding:'6px 14px', borderRadius:10, backgroundColor:s.bg }}>
                  <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {deficit > 0 && (
              <div style={{ padding:'8px 14px', borderRadius:8, backgroundColor:'#fef3c7', border:'1px solid #fde68a', fontSize:12, color:'#92400e', fontWeight:600 }}>
                ⚠️ Déficit de {deficit} personne{deficit > 1 ? 's' : ''} — vérifier les partiels et les non-répondants
              </div>
            )}
          </div>

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
              <span style={{ fontSize:12, fontWeight:700, color:C }}>Échéancier complet · {ciblages.length} réservistes · triés par distance</span>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
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
              disabled={saving || selected.size === 0 || !rotStart || !rotEnd}
              style={{
                padding:'10px 22px', borderRadius:8, fontSize:13, fontWeight:700,
                backgroundColor: selected.size === 0 ? '#e5e7eb' : '#065f46',
                color: selected.size === 0 ? '#9ca3af' : 'white',
                border:'none', cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '⏳ Création…' : `✅ Créer la rotation — ${selected.size} pers. · ${dateFr(rotStart)} → ${dateFr(rotEnd)}`}
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
