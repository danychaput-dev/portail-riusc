'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'locked' | 'active' | 'done'

interface Sinistre {
  id: string; nom: string; type_incident?: string
  lieu?: string; date_debut?: string; statut: string
}
interface Demande {
  id: string; sinistre_id: string; organisme: string
  type_mission?: string; lieu?: string
  nb_personnes_requis?: number; date_debut?: string; date_fin_estimee?: string
  priorite: string; statut: string; identifiant?: string
  contact_nom?: string; contact_telephone?: string
}
interface Deployment {
  id: string; identifiant: string; nom: string; lieu?: string
  date_debut?: string; date_fin?: string; nb_personnes_par_vague?: number
  statut: string; point_rassemblement?: string; notes_logistique?: string
}
interface Ciblage {
  id: string; benevole_id: string; statut: string
  reservistes: { prenom: string; nom: string; telephone: string }
}
interface DispoV2 {
  id: string; benevole_id: string; date_jour: string; disponible: boolean
  commentaire?: string
  reservistes?: { prenom: string; nom: string }
}
interface Vague {
  id: string; identifiant?: string; numero: number
  date_debut: string; date_fin: string
  nb_personnes_requis?: number; statut: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES_INCIDENT = [
  'Inondation','Incendie','Glissement de terrain','Vague de froid',
  'Vague de chaleur','Tempête','Accident industriel',
  'Recherche et sauvetage','Vérification de bien-être','Évacuation','Autre',
]
const ORGANISMES = ['SOPFEU','Croix-Rouge','Municipalité','Gouvernement du Québec','Autre']
const TYPES_MISSION: Record<string, string[]> = {
  'SOPFEU':    ['Construction de digues','Gestion des débris','Logistique terrain','Support opérationnel'],
  'Croix-Rouge': ["Centre de services aux sinistrés","Hébergement d'urgence",'Distribution de ressources','Soutien psychosocial','Inscription et référencement'],
  'default':   ['Construction de digues','Gestion des débris',"Centre de services aux sinistrés","Hébergement d'urgence",'Distribution de ressources','Soutien psychosocial','Recherche et sauvetage','Vérification de bien-être','Logistique','Support opérationnel','Autre'],
}

const STEP_LABELS = ['Sinistre','Demandes','Déploiement','Ciblage','Notification dispos','Disponibilités reçues','Rotation créée','Mobilisation confirmée']
const STEP_SUBS   = ['Créer ou sélectionner','Lier les demandes','Créer ou sélectionner','Réservistes ciblés','Message éditable + envoi','Ciblés / Échéancier / Rotations','IA suggère les affectations','Confirmer + envoyer']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateFr(iso?: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function orgAbbr(o: string) {
  const map: Record<string,string> = { 'Croix-Rouge':'CR','Municipalité':'MUN','SOPFEU':'SPF','Gouvernement du Québec':'GQC' }
  return map[o] || o.slice(0,3).toUpperCase()
}
function genDemandeId(existing: Demande[], organisme: string, date: string): string {
  const n = (existing.length + 1).toString().padStart(3,'0')
  const d = date ? date.replace(/-/g,'').slice(2) : 'XXXXXX'
  return `DEM-${n}-${orgAbbr(organisme)}-${d}`
}
function genDeployId(existing: Deployment[]): string {
  return `DEP-${(existing.length + 1).toString().padStart(3,'0')}`
}
function tplNotif(sinNom: string, depNom: string, dateDebut?: string): string {
  return `Bonjour,

Dans le cadre du sinistre « ${sinNom} », nous sollicitons votre disponibilité pour le déploiement ${depNom}${dateDebut ? ` prévu à partir du ${dateFr(dateDebut)}` : ''}.

Veuillez soumettre vos disponibilités via le portail RIUSC dans les 4 prochains jours :
https://portail.riusc.ca/disponibilites

Merci pour votre engagement.
L'équipe RIUSC / AQBRS`
}
function tplMobil(depNom: string, vagNom: string, debut: string, fin: string, lieu?: string): string {
  return `Bonjour,

Vous êtes officiellement mobilisé(e) pour la rotation ${vagNom} du ${dateFr(debut)} au ${dateFr(fin)} dans le cadre du déploiement ${depNom}.

${lieu ? `Lieu de déploiement : ${lieu}\n` : ''}Veuillez confirmer votre présence via le portail RIUSC :
https://portail.riusc.ca/mobilisation

En cas d'empêchement, contactez-nous immédiatement.
L'équipe RIUSC / AQBRS`
}


// ─── Sidebar Stepper ──────────────────────────────────────────────────────────

const STEP_ICONS = ['🔥','📋','🚁','🎯','📨','📊','✦','🚀']

function SidebarStepper({ statuses, curStep, onStep, selSin, selDep }: {
  statuses: StepStatus[]
  curStep: number
  onStep: (n: number) => void
  selSin?: { nom: string }
  selDep?: { nom: string; identifiant: string }
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      {/* Contexte actif */}
      {(selSin || selDep) && (
        <div style={{ padding:'12px 16px', backgroundColor:'#f0fdf4', borderRadius:10, border:'1px solid #bbf7d0', marginBottom:20 }}>
          {selSin && <div style={{ fontSize:12, fontWeight:600, color:'#065f46', marginBottom:selDep?3:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>🔥 {selSin.nom}</div>}
          {selDep && <div style={{ fontSize:11, color:'#047857', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>🚁 {selDep.identifiant} — {selDep.nom}</div>}
        </div>
      )}

      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const s = statuses[i] || 'locked'
        const isDone   = s === 'done'
        const isActive = s === 'active'
        const isLocked = s === 'locked'
        const isAI     = n === 7
        const isLast   = n === 8

        const circleColor = isDone ? '#10b981' : isActive ? (isAI ? '#8b5cf6' : '#3b82f6') : '#d1d5db'
        const labelColor  = isDone ? '#065f46' : isActive ? (isAI ? '#5b21b6' : '#1d4ed8') : '#9ca3af'
        const lineColor   = isDone ? '#10b981' : '#e5e7eb'

        return (
          <div key={n}>
            <div
              onClick={() => !isLocked && onStep(n)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'8px 10px', borderRadius:8,
                cursor: isLocked ? 'default' : 'pointer',
                backgroundColor: isActive ? (isAI ? '#faf5ff' : '#eff6ff') : 'transparent',
                border: isActive ? `1px solid ${isAI ? '#ddd6fe' : '#bfdbfe'}` : '1px solid transparent',
                transition:'background 0.1s',
              }}
            >
              {/* Cercle */}
              <div style={{
                width:28, height:28, borderRadius:'50%', flexShrink:0,
                backgroundColor: circleColor,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: isDone ? 13 : 12, fontWeight:700, color:'white',
                boxShadow: isActive ? `0 0 0 3px ${isAI ? '#ede9fe' : '#dbeafe'}` : 'none',
                transition:'box-shadow 0.2s',
              }}>
                {isDone ? '✓' : isAI ? '✦' : n}
              </div>

              {/* Label + sous-titre */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight: isActive ? 600 : 500, color:labelColor, display:'flex', alignItems:'center', gap:5 }}>
                  {label}
                  {isAI && !isLocked && (
                    <span style={{ fontSize:9, padding:'1px 5px', borderRadius:6, backgroundColor:'#8b5cf6', color:'white', fontWeight:700 }}>IA</span>
                  )}
                  {isLocked && <span style={{ fontSize:11 }}>🔒</span>}
                </div>
                <div style={{ fontSize:10, color: isActive ? labelColor : '#c4c4c4', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {STEP_SUBS[i]}
                </div>
              </div>
            </div>

            {/* Connecteur vertical */}
            {!isLast && (
              <div style={{ marginLeft:23, width:2, height:12, backgroundColor:lineColor, borderRadius:1 }}/>
            )}
          </div>
        )
      })}

      {/* Progression */}
      <div style={{ marginTop:20, padding:'10px 12px', backgroundColor:'#f8fafc', borderRadius:8, border:'1px solid #e5e7eb' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Progression</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#1e3a5f' }}>
            {statuses.filter(s=>s==='done').length}/8
          </span>
        </div>
        <div style={{ height:4, backgroundColor:'#e5e7eb', borderRadius:2, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:2,
            width:`${(statuses.filter(s=>s==='done').length/8)*100}%`,
            backgroundColor:'#10b981', transition:'width 0.4s',
          }}/>
        </div>
      </div>
    </div>
  )
}


// ─── StepCard ─────────────────────────────────────────────────────────────────

function StepCard({ id, n, status, title, subtitle, ai=false, children }: {
  id: string; n: number; status: StepStatus; title: string
  subtitle?: string; ai?: boolean; children?: React.ReactNode
}) {
  const done=status==='done', active=status==='active', locked=status==='locked'
  const bdr = done?'#10b981':active?(ai?'#8b5cf6':'#3b82f6'):'#e5e7eb'
  const hBg = done?'#f0fdf4':active?(ai?'#faf5ff':'#eff6ff'):'#fafafa'
  const hBd = done?'#bbf7d0':active?(ai?'#ddd6fe':'#bfdbfe'):'#f3f4f6'
  const tC  = done?'#065f46':active?(ai?'#5b21b6':'#1d4ed8'):'#9ca3af'
  const sC  = done?'#047857':active?(ai?'#7c3aed':'#2563eb'):'#d1d5db'
  return (
    <div id={id} style={{ backgroundColor:'white', borderRadius:12, border:`1.5px solid ${bdr}`, overflow:'hidden', transition:'border-color 0.2s' }}>
      <div style={{ padding:'12px 20px', backgroundColor:hBg, borderBottom:`1px solid ${hBd}`, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700,
          backgroundColor: done?'#10b981':active?(ai?'#8b5cf6':'#3b82f6'):'#e5e7eb',
          color: locked?'#9ca3af':'white' }}>
          {done?'✓':n}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:15, color:tC, display:'flex', alignItems:'center', gap:8 }}>
            {title}
            {ai && active && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:8, backgroundColor:'#8b5cf6', color:'white', fontWeight:600 }}>IA ✦</span>}
          </div>
          {subtitle && <div style={{ fontSize:12, color:sC, marginTop:1 }}>{subtitle}</div>}
        </div>
        {locked && <span style={{ fontSize:11, color:'#c4c4c4', fontStyle:'italic' }}>🔒 Étapes précédentes requises</span>}
      </div>
      {!locked && children && <div style={{ padding:'20px' }}>{children}</div>}
    </div>
  )
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Btn({ onClick, disabled, loading, color='#1e3a5f', outline=false, children }: {
  onClick:()=>void; disabled?:boolean; loading?:boolean; color?:string; outline?:boolean; children:React.ReactNode
}) {
  return (
    <button onClick={onClick} disabled={disabled||loading} style={{
      padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600, cursor: disabled||loading?'not-allowed':'pointer',
      border: outline?`1.5px solid ${color}`:'none',
      backgroundColor: disabled||loading?'#e5e7eb': outline?'white':color,
      color: disabled||loading?'#9ca3af': outline?color:'white',
      transition:'background 0.15s',
    }}>
      {loading?'⏳ ...':children}
    </button>
  )
}

const IS: React.CSSProperties = { padding:'7px 10px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, backgroundColor:'white', color:'#1e293b', width:'100%', boxSizing:'border-box' }
const LS: React.CSSProperties = { display:'block', fontSize:11, fontWeight:600, color:'#64748b', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.04em' as any }
const G2: React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return <div><label style={LS}>{label}</label>{children}</div>
}
function SBox({ children }: { children:React.ReactNode }) {
  return <div style={{ backgroundColor:'#f8fafc', borderRadius:10, border:'1px solid #e5e7eb', padding:16 }}>{children}</div>
}
function SelCard({ selected, onClick, children }: { selected:boolean; onClick:()=>void; children:React.ReactNode }) {
  return (
    <div onClick={onClick} style={{ padding:'10px 14px', borderRadius:8, cursor:'pointer',
      border:`1.5px solid ${selected?'#3b82f6':'#e5e7eb'}`,
      backgroundColor: selected?'#eff6ff':'white', transition:'all 0.1s' }}>
      {children}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function OperationsPage() {
  const supabase = createClient()
  const router    = useRouter()
  const isMounted = useRef(false)
  const LS_KEY    = 'riusc_ops_context'

  // ── Lire le contexte sauvegardé (URL prime sur localStorage) ─────────────
  const readSavedContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const urlSin  = params.get('sin')
    const urlDep  = params.get('dep')
    const urlDems = params.get('dems')
    if (urlSin || urlDep || urlDems) {
      // URL prime pour sin/dep, mais si dems absent → lire localStorage
      let demIds = urlDems ? urlDems.split(',').filter(Boolean) : []
      if (!demIds.length) {
        try {
          const raw = localStorage.getItem(LS_KEY)
          if (raw) demIds = JSON.parse(raw)?.demIds || []
        } catch {}
      }
      return { sinId: urlSin || null, depId: urlDep || null, demIds }
    }
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) return JSON.parse(raw) as { sinId: string|null; depId: string|null; demIds: string[] }
    } catch {}
    return null
  }, [])

  // données
  const [sinistres,   setSinistres]   = useState<Sinistre[]>([])
  const [demandes,    setDemandes]    = useState<Demande[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [ciblages,    setCiblages]    = useState<Ciblage[]>([])
  const [dispos,      setDispos]      = useState<DispoV2[]>([])
  const [vagues,      setVagues]      = useState<Vague[]>([])

  // sélections
  // ── Sélections (restaurées côté client dans useEffect) ───────────────────
  const [sinId,  setSinId]  = useState<string|null>(null)
  const [demIds, setDemIds] = useState<string[]>([])
  const [depId,  setDepId]  = useState<string|null>(null)

  // ── Restauration du contexte au montage (client uniquement) ──────────────
  useEffect(() => {
    const ctx = readSavedContext()
    if (ctx) {
      if (ctx.sinId)         setSinId(ctx.sinId)
      if (ctx.demIds.length) setDemIds(ctx.demIds)
      if (ctx.depId)         setDepId(ctx.depId)
    }
    // Lire le flag step4 + ciblages sauvegardés depuis ciblage
    try {
      const s4dep = localStorage.getItem('riusc_ops_step4_done')
      if (s4dep && ctx?.depId && s4dep === ctx.depId) {
        setStep4Override(true)
        // Restaurer les ciblages sauvegardés directement sans fetch
        const rawCiblages = localStorage.getItem('riusc_ops_ciblages_cache')
        if (rawCiblages) {
          const cached = JSON.parse(rawCiblages)
          if (cached.depId === ctx.depId && cached.data?.length) {
            setCiblages(cached.data)
          }
        }
      }
    } catch {}
    setTimeout(() => { isMounted.current = true }, 0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selSin = sinistres.find(s=>s.id===sinId)
  const selDep = deployments.find(d=>d.id===depId)

  // ── Sync URL + localStorage à chaque changement de sélection ─────────────
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    try { localStorage.setItem(LS_KEY, JSON.stringify({ sinId, depId, demIds })) } catch {}
    const p = new URLSearchParams()
    if (sinId)         p.set('sin',  sinId)
    if (depId)         p.set('dep',  depId)
    if (demIds.length) p.set('dems', demIds.join(','))
    const qs = p.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? '?'+qs : ''}`)
  }, [sinId, depId, demIds.join(',')])

  // formulaires
  const [showFSin, setShowFSin] = useState(false)
  const [showFDem, setShowFDem] = useState(false)
  const [showFDep, setShowFDep] = useState(false)

  const [fSin, setFSin] = useState({ nom:'', type_incident:'', lieu:'', date_debut:'' })
  const [fDem, setFDem] = useState({ organisme:'', type_mission:'', lieu:'', nb_personnes_requis:'', date_debut:'', date_fin_estimee:'', priorite:'Normale', contact_nom:'', contact_telephone:'' })
  const [fDep, setFDep] = useState({ nom:'', lieu:'', date_debut:'', date_fin:'', nb_personnes_par_vague:'', point_rassemblement:'', notes_logistique:'' })

  const [savSin, setSavSin] = useState(false)
  const [savDem, setSavDem] = useState(false)
  const [savDep, setSavDep] = useState(false)

  // wizard
  const [step4Override, setStep4Override] = useState(false)
  const [step6Ok,       setStep6Ok]       = useState(false)
  const [mobilSent,     setMobilSent]     = useState(false)
  const [msgNotif,      setMsgNotif]      = useState('')
  const [msgMobil,      setMsgMobil]      = useState('')
  const [aiSugg,        setAiSugg]        = useState<string|null>(null)
  const [loadAI,        setLoadAI]        = useState(false)
  const [newVague,      setNewVague]      = useState({ date_debut:'', date_fin:'', nb:'' })
  const [savVague,      setSavVague]      = useState(false)
  const [sendingNotif,  setSendingNotif]  = useState(false)
  const [sendingMobil,  setSendingMobil]  = useState(false)

  // ── Complétion ─────────────────────────────────────────────────────────────
  const done = useCallback((n: number): boolean => {
    switch(n) {
      case 1: return !!sinId
      case 2: return demIds.length > 0
      case 3: return !!depId
      case 4: return ciblages.length > 0 || step4Override
      case 5: return ciblages.some(c=>c.statut==='notifie')
      case 6: return step6Ok
      case 7: return vagues.length > 0
      case 8: return mobilSent
      default: return false
    }
  }, [sinId, demIds, depId, ciblages, step4Override, step6Ok, vagues, mobilSent])

  const curStep = useMemo(() => {
    for (let i=1;i<=8;i++) if(!done(i)) return i
    return 8
  }, [done])

  const ss = (n: number): StepStatus => done(n)?'done': n<=curStep?'active':'locked'
  const statuses: StepStatus[] = [1,2,3,4,5,6,7,8].map(n=>ss(n))

  // ── Chargements ─────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.from('sinistres').select('*').in('statut',['Actif','En cours'])
      .order('created_at',{ascending:false}).then(({data})=>{ if(data) setSinistres(data) })
  }, [])

  useEffect(() => {
    if (!sinId) { setDemandes([]); return }
    supabase.from('demandes').select('*').eq('sinistre_id',sinId)
      .order('date_reception',{ascending:false}).then(({data})=>{ if(data) setDemandes(data) })
  }, [sinId])

  useEffect(() => {
    if (!demIds.length) { setDeployments([]); return }
    supabase.from('deployments_demandes')
      .select('deployment_id, deployments(*)')
      .in('demande_id', demIds)
      .then(({data}) => {
        if (!data) return
        const seen = new Set<string>()
        const deps: Deployment[] = []
        for (const row of data as any[]) {
          if (row.deployments && !seen.has(row.deployment_id)) {
            seen.add(row.deployment_id); deps.push(row.deployments)
          }
        }
        setDeployments(deps)
      })
  }, [demIds.join(',')])

  // Quand depId est restauré sans demIds (retour depuis ciblage),
  // charger le déploiement directement pour que selDep soit défini
  useEffect(() => {
    if (!depId || deployments.some(d => d.id === depId)) return
    supabase.from('deployments').select('*').eq('id', depId).single()
      .then(({ data }) => { if (data) setDeployments([data]) })
  }, [depId])

  useEffect(() => {
    if (!depId) { setCiblages([]); setDispos([]); setVagues([]); setStep6Ok(false); setMobilSent(false); setAiSugg(null); return }
    // Fetch ciblages sans join pour éviter blocage RLS sur reservistes
    supabase.from('ciblages').select('id,benevole_id,statut')
      .eq('niveau','deploiement').eq('reference_id',depId).neq('statut','retire')
      .then(async ({data: cibData}) => {
        if (!cibData?.length) { setCiblages([]); return }
        // Fetch noms séparément
        const ids = cibData.map(c => c.benevole_id)
        const { data: resData } = await supabase.from('reservistes')
          .select('benevole_id,prenom,nom,telephone').in('benevole_id', ids)
        const resMap: Record<string,any> = {}
        for (const r of (resData || [])) resMap[r.benevole_id] = r
        setCiblages(cibData.map(c => ({
          ...c,
          reservistes: resMap[c.benevole_id] || { prenom:'?', nom:'?', telephone:'' }
        })))
      })
    supabase.from('disponibilites_v2').select('id,benevole_id,date_jour,disponible,commentaire,reservistes(prenom,nom)')
      .eq('deployment_id',depId).order('date_jour').then(({data})=>{ if(data) setDispos(data as any) })
    supabase.from('vagues').select('*').eq('deployment_id',depId).order('numero')
      .then(({data})=>{ if(data) setVagues(data) })
  }, [depId, step4Override])

  useEffect(() => {
    if (!selSin || !selDep) return
    setMsgNotif(tplNotif(selSin.nom, selDep.nom, selDep.date_debut))
  }, [sinId, depId])

  useEffect(() => {
    if (!selDep) return
    const v = vagues[0]
    setMsgMobil(tplMobil(selDep.nom, v?(v.identifiant||`Rotation #${v.numero}`):'[rotation à définir]', v?.date_debut||'[date début]', v?.date_fin||'[date fin]', selDep.lieu))
  }, [depId, vagues.length])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const creerSinistre = async () => {
    if (!fSin.nom.trim()) return
    setSavSin(true)
    const {data,error} = await supabase.from('sinistres')
      .insert({ nom:fSin.nom.trim(), type_incident:fSin.type_incident||null, lieu:fSin.lieu||null, date_debut:fSin.date_debut||null, statut:'Actif' })
      .select().single()
    if (!error && data) { setSinistres(p=>[data,...p]); setSinId(data.id); setShowFSin(false); setFSin({nom:'',type_incident:'',lieu:'',date_debut:''}) }
    setSavSin(false)
  }

  const creerDemande = async () => {
    if (!fDem.organisme || !sinId) return
    setSavDem(true)
    const identifiant = genDemandeId(demandes, fDem.organisme, fDem.date_debut)
    const {data,error} = await supabase.from('demandes').insert({
      sinistre_id:sinId, organisme:fDem.organisme, type_mission:fDem.type_mission||null,
      lieu:fDem.lieu||null, nb_personnes_requis:fDem.nb_personnes_requis?parseInt(fDem.nb_personnes_requis):null,
      date_debut:fDem.date_debut||null, date_fin_estimee:fDem.date_fin_estimee||null,
      priorite:fDem.priorite, statut:'Nouvelle', identifiant,
      contact_nom:fDem.contact_nom||null, contact_telephone:fDem.contact_telephone||null,
    }).select().single()
    if (!error && data) {
      setDemandes(p=>[data,...p]); setDemIds(p=>[...p,data.id])
      setShowFDem(false); setFDem({organisme:'',type_mission:'',lieu:'',nb_personnes_requis:'',date_debut:'',date_fin_estimee:'',priorite:'Normale',contact_nom:'',contact_telephone:''})
    }
    setSavDem(false)
  }

  const creerDeployment = async () => {
    if (!fDep.nom.trim() || !demIds.length) return
    setSavDep(true)
    const identifiant = genDeployId(deployments)
    const {data,error} = await supabase.from('deployments').insert({
      identifiant, nom:fDep.nom.trim(), lieu:fDep.lieu||null,
      date_debut:fDep.date_debut||null, date_fin:fDep.date_fin||null,
      nb_personnes_par_vague:fDep.nb_personnes_par_vague?parseInt(fDep.nb_personnes_par_vague):null,
      point_rassemblement:fDep.point_rassemblement||null, notes_logistique:fDep.notes_logistique||null,
      statut:'Planifié',
    }).select().single()
    if (!error && data) {
      await supabase.from('deployments_demandes').insert(demIds.map(did=>({ deployment_id:data.id, demande_id:did })))
      setDeployments(p=>[...p,data]); setDepId(data.id)
      setShowFDep(false); setFDep({nom:'',lieu:'',date_debut:'',date_fin:'',nb_personnes_par_vague:'',point_rassemblement:'',notes_logistique:''})
    }
    setSavDep(false)
  }

  const rafraichirCiblages = async () => {
    if (!depId) return
    const {data: cibData} = await supabase.from('ciblages').select('id,benevole_id,statut')
      .eq('niveau','deploiement').eq('reference_id',depId).neq('statut','retire')
    if (!cibData?.length) { setCiblages([]); return }
    const ids = cibData.map(c => c.benevole_id)
    const { data: resData } = await supabase.from('reservistes')
      .select('benevole_id,prenom,nom,telephone').in('benevole_id', ids)
    const resMap: Record<string,any> = {}
    for (const r of (resData || [])) resMap[r.benevole_id] = r
    setCiblages(cibData.map(c => ({
      ...c,
      reservistes: resMap[c.benevole_id] || { prenom:'?', nom:'?', telephone:'' }
    })))
  }

  const sendNotifications = async () => {
    const toNotify = ciblages.filter(c=>c.statut!=='notifie').map(c=>c.id)
    if (!toNotify.length) return
    setSendingNotif(true)
    await supabase.from('ciblages').update({statut:'notifie',updated_at:new Date().toISOString()}).in('id',toNotify)
    try {
      await fetch('https://n8n.aqbrs.ca/webhook/riusc-envoi-ciblage-portail', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ deployment_id:depId, ciblage_ids:toNotify, message_override:msgNotif, type_envoi:'disponibilites' }),
      })
    } catch(e) { console.error('n8n notif',e) }
    setCiblages(p=>p.map(c=>toNotify.includes(c.id)?{...c,statut:'notifie'}:c))
    setSendingNotif(false)
  }

  const getAISuggestion = async () => {
    if (!selDep) return
    setLoadAI(true); setAiSugg(null)
    try {
      const res = await fetch('/api/operations/rotation-ia', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ deployment:selDep, sinistre:selSin, dispos, nb_cibles_notifies:ciblages.filter(c=>c.statut==='notifie').length }),
      })
      const d = await res.json()
      setAiSugg(d.suggestion||'Aucune suggestion générée.')
      if (d.date_debut) setNewVague(v=>({...v,date_debut:d.date_debut}))
      if (d.date_fin)   setNewVague(v=>({...v,date_fin:d.date_fin}))
      if (d.nb_personnes) setNewVague(v=>({...v,nb:String(d.nb_personnes)}))
    } catch { setAiSugg('Erreur de connexion à Claude.') }
    setLoadAI(false)
  }

  const createVague = async () => {
    if (!depId || !newVague.date_debut || !newVague.date_fin) return
    setSavVague(true)
    const num = vagues.length + 1
    const {data,error} = await supabase.from('vagues').insert({
      deployment_id:depId, numero:num, date_debut:newVague.date_debut, date_fin:newVague.date_fin,
      nb_personnes_requis:newVague.nb?parseInt(newVague.nb):null, statut:'Planifiée',
      identifiant:`ROT-${num.toString().padStart(2,'0')}`,
    }).select().single()
    if (!error && data) { setVagues(p=>[...p,data]); setNewVague({date_debut:'',date_fin:'',nb:''}) }
    setSavVague(false)
  }

  const sendMobilisation = async () => {
    if (!depId || !vagues.length) return
    setSendingMobil(true)
    try {
      await fetch('https://n8n.aqbrs.ca/webhook/riusc-envoi-mobilisation-portail', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ deployment_id:depId, vague_ids:vagues.map(v=>v.id), message_override:msgMobil, type_envoi:'mobilisation' }),
      })
    } catch(e) { console.error('n8n mobil',e) }
    setMobilSent(true); setSendingMobil(false)
  }

  // ── Données dérivées ────────────────────────────────────────────────────────
  const uniqueDates = [...new Set(dispos.map(d=>d.date_jour))].sort()
  const nbReponses  = [...new Set(dispos.map(d=>d.benevole_id))].length

  const TA: React.CSSProperties = { ...IS, minHeight:130, resize:'vertical', lineHeight:1.6, fontFamily:'inherit', height:'auto' }
  const ADD_BTN: React.CSSProperties = { padding:'9px 16px', borderRadius:8, border:'1.5px dashed #cbd5e1', backgroundColor:'transparent', color:'#64748b', fontSize:13, cursor:'pointer', width:'100%', textAlign:'left' }

  // ── Rendu ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', backgroundColor:'#f1f5f9' }}>
      <PortailHeader/>

      <div style={{ display:'flex', alignItems:'flex-start', maxWidth:1200, margin:'0 auto', padding:'24px 16px 80px', gap:24 }}>

        {/* ── Sidebar gauche (sticky) ──────────────────────────────────── */}
        <div style={{
          width:240, flexShrink:0,
          position:'sticky', top:24,
          backgroundColor:'white', borderRadius:14,
          border:'1px solid #e5e7eb', padding:'20px 16px',
          boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1e3a5f' }}>Tableau de bord opérationnel</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Étape {curStep} / 8</div>
          </div>
          <SidebarStepper
            statuses={statuses}
            curStep={curStep}
            onStep={n => document.getElementById(`step-${n}`)?.scrollIntoView({ behavior:'smooth', block:'start' })}
            selSin={selSin}
            selDep={selDep}
          />
        </div>

        {/* ── Contenu principal (scrollable) ──────────────────────────── */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:14 }}>

          {/* ─── ÉTAPE 1 : Sinistre ─────────────────────────────────────── */}
          <StepCard id="step-1" n={1} status={ss(1)} title="Sinistre"
            subtitle={selSin ? `${selSin.nom}${selSin.lieu ? ' · '+selSin.lieu : ''}` : 'Sélectionner ou créer un sinistre'}>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {sinistres.map(s => (
                <SelCard key={s.id} selected={sinId===s.id} onClick={()=>{ setSinId(s.id); setDemIds([]); setDepId(null) }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:600, fontSize:13, color:'#1e3a5f' }}>{s.nom}</span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, backgroundColor:'#d1fae5', color:'#065f46', fontWeight:600 }}>{s.statut}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#64748b', marginTop:2, display:'flex', gap:12, flexWrap:'wrap' }}>
                    {s.type_incident && <span>🔥 {s.type_incident}</span>}
                    {s.lieu && <span>📍 {s.lieu}</span>}
                    {s.date_debut && <span>📅 {dateFr(s.date_debut)}</span>}
                  </div>
                </SelCard>
              ))}
              {showFSin ? (
                <SBox>
                  <div style={{ fontWeight:600, fontSize:13, color:'#1e3a5f', marginBottom:12 }}>Nouveau sinistre</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={G2}>
                      <Field label="Nom *"><input style={IS} value={fSin.nom} onChange={e=>setFSin(f=>({...f,nom:e.target.value}))} placeholder="ex : Inondation Saguenay 2025"/></Field>
                      <Field label="Type d'incident">
                        <select style={IS} value={fSin.type_incident} onChange={e=>setFSin(f=>({...f,type_incident:e.target.value}))}>
                          <option value="">— choisir —</option>
                          {TYPES_INCIDENT.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </Field>
                    </div>
                    <div style={G2}>
                      <Field label="Lieu"><input style={IS} value={fSin.lieu} onChange={e=>setFSin(f=>({...f,lieu:e.target.value}))} placeholder="Ville, région..."/></Field>
                      <Field label="Date de début"><input type="date" style={IS} value={fSin.date_debut} onChange={e=>setFSin(f=>({...f,date_debut:e.target.value}))}/></Field>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn onClick={creerSinistre} loading={savSin} disabled={!fSin.nom.trim()} color="#1e3a5f">✓ Créer</Btn>
                      <Btn onClick={()=>setShowFSin(false)} outline color="#6b7280">Annuler</Btn>
                    </div>
                  </div>
                </SBox>
              ) : (
                <button style={ADD_BTN} onClick={()=>setShowFSin(true)}>+ Créer un nouveau sinistre</button>
              )}
            </div>
          </StepCard>

          {/* ─── ÉTAPE 2 : Demandes ─────────────────────────────────────── */}
          <StepCard id="step-2" n={2} status={ss(2)} title="Demandes"
            subtitle={demIds.length>0 ? `${demIds.length} demande(s) sélectionnée(s)` : `${demandes.length} demande(s) liée(s) au sinistre`}>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <p style={{ fontSize:12, color:'#64748b', margin:0 }}>
                Cochez les demandes couvertes par ce déploiement. Un déploiement peut regrouper plusieurs demandes.
              </p>
              {demandes.length===0 && !showFDem && (
                <div style={{ padding:16, textAlign:'center', color:'#94a3b8', fontSize:13 }}>Aucune demande — créez-en une ci-dessous.</div>
              )}
              {demandes.map(d => {
                const checked = demIds.includes(d.id)
                return (
                  <div key={d.id} onClick={()=>setDemIds(p=>checked?p.filter(x=>x!==d.id):[...p,d.id])} style={{
                    padding:'10px 14px', borderRadius:8, cursor:'pointer',
                    border:`1.5px solid ${checked?'#3b82f6':'#e5e7eb'}`,
                    backgroundColor: checked?'#eff6ff':'white', transition:'all 0.1s',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <input type="checkbox" checked={checked} readOnly style={{ pointerEvents:'none', flexShrink:0 }}/>
                        <span style={{ fontWeight:700, fontSize:12, color:'#7c3aed' }}>{d.identifiant}</span>
                        <span style={{ fontSize:13, color:'#1e3a5f' }}>{d.organisme}</span>
                        {d.type_mission && <span style={{ fontSize:11, color:'#64748b' }}>· {d.type_mission}</span>}
                      </div>
                      <span style={{ fontSize:11, padding:'2px 7px', borderRadius:8, backgroundColor:'#f3f4f6', color:'#6b7280', flexShrink:0 }}>{d.statut}</span>
                    </div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:3, paddingLeft:22, display:'flex', gap:10, flexWrap:'wrap' }}>
                      {d.lieu && <span>📍 {d.lieu}</span>}
                      {d.nb_personnes_requis && <span>👥 {d.nb_personnes_requis} pers.</span>}
                      {d.date_debut && <span>📅 {dateFr(d.date_debut)}{d.date_fin_estimee?` → ${dateFr(d.date_fin_estimee)}`:''}</span>}
                      {d.contact_nom && <span>👤 {d.contact_nom}{d.contact_telephone?` · ${d.contact_telephone}`:''}</span>}
                    </div>
                  </div>
                )
              })}
              {showFDem ? (
                <SBox>
                  <div style={{ fontWeight:600, fontSize:13, color:'#1e3a5f', marginBottom:12 }}>Nouvelle demande</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={G2}>
                      <Field label="Organisme *">
                        <select style={IS} value={fDem.organisme} onChange={e=>setFDem(f=>({...f,organisme:e.target.value,type_mission:''}))}>
                          <option value="">— choisir —</option>
                          {ORGANISMES.map(o=><option key={o}>{o}</option>)}
                        </select>
                      </Field>
                      <Field label="Type de mission">
                        <select style={IS} value={fDem.type_mission} onChange={e=>setFDem(f=>({...f,type_mission:e.target.value}))} disabled={!fDem.organisme}>
                          <option value="">— choisir —</option>
                          {(TYPES_MISSION[fDem.organisme]||TYPES_MISSION['default']).map(t=><option key={t}>{t}</option>)}
                        </select>
                      </Field>
                    </div>
                    <div style={G2}>
                      <Field label="Lieu"><input style={IS} value={fDem.lieu} onChange={e=>setFDem(f=>({...f,lieu:e.target.value}))} placeholder="Adresse ou secteur"/></Field>
                      <Field label="Nb personnes requis"><input type="number" style={IS} value={fDem.nb_personnes_requis} onChange={e=>setFDem(f=>({...f,nb_personnes_requis:e.target.value}))} placeholder="ex : 12"/></Field>
                    </div>
                    <div style={G2}>
                      <Field label="Date de début"><input type="date" style={IS} value={fDem.date_debut} onChange={e=>setFDem(f=>({...f,date_debut:e.target.value}))}/></Field>
                      <Field label="Date de fin estimée"><input type="date" style={IS} value={fDem.date_fin_estimee} onChange={e=>setFDem(f=>({...f,date_fin_estimee:e.target.value}))}/></Field>
                    </div>
                    <div style={G2}>
                      <Field label="Contact (nom)"><input style={IS} value={fDem.contact_nom} onChange={e=>setFDem(f=>({...f,contact_nom:e.target.value}))} placeholder="Responsable"/></Field>
                      <Field label="Contact (téléphone)"><input style={IS} value={fDem.contact_telephone} onChange={e=>setFDem(f=>({...f,contact_telephone:e.target.value}))} placeholder="(418) 000-0000"/></Field>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn onClick={creerDemande} loading={savDem} disabled={!fDem.organisme} color="#7c3aed">✓ Créer la demande</Btn>
                      <Btn onClick={()=>setShowFDem(false)} outline color="#6b7280">Annuler</Btn>
                    </div>
                  </div>
                </SBox>
              ) : (
                <button style={ADD_BTN} onClick={()=>setShowFDem(true)}>+ Ajouter une demande</button>
              )}
            </div>
          </StepCard>

          {/* ─── ÉTAPE 3 : Déploiement ──────────────────────────────────── */}
          <StepCard id="step-3" n={3} status={ss(3)} title="Déploiement"
            subtitle={selDep ? `${selDep.identifiant} — ${selDep.nom}` : deployments.length>0?`${deployments.length} déploiement(s) disponible(s)`:'Créer un déploiement'}>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {demIds.length===0 && !depId && <p style={{ fontSize:12, color:'#f59e0b', margin:0 }}>⚠️ Sélectionnez d'abord les demandes à l'étape 2.</p>}
              {deployments.map(d => (
                <SelCard key={d.id} selected={depId===d.id} onClick={()=>setDepId(d.id)}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <span style={{ fontWeight:700, fontSize:12, color:'#7c3aed' }}>{d.identifiant}</span>
                      <span style={{ fontSize:13, color:'#1e3a5f', marginLeft:8 }}>{d.nom}</span>
                    </div>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, backgroundColor:'#f3f4f6', color:'#6b7280', fontWeight:600 }}>{d.statut}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#64748b', marginTop:3, display:'flex', gap:12, flexWrap:'wrap' }}>
                    {d.lieu && <span>📍 {d.lieu}</span>}
                    {d.date_debut && <span>📅 {dateFr(d.date_debut)}{d.date_fin?` → ${dateFr(d.date_fin)}`:''}</span>}
                    {d.nb_personnes_par_vague && <span>👥 {d.nb_personnes_par_vague}/rotation</span>}
                    {d.point_rassemblement && <span>📌 {d.point_rassemblement}</span>}
                  </div>
                </SelCard>
              ))}
              {showFDep ? (
                <SBox>
                  <div style={{ fontWeight:600, fontSize:13, color:'#1e3a5f', marginBottom:12 }}>
                    Nouveau déploiement
                    {demIds.length>0 && <span style={{ fontWeight:400, fontSize:11, color:'#64748b', marginLeft:8 }}>— lié à {demIds.length} demande(s)</span>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <Field label="Nom du déploiement *"><input style={IS} value={fDep.nom} onChange={e=>setFDep(f=>({...f,nom:e.target.value}))} placeholder="ex : Déploiement Gatineau — Digues"/></Field>
                    <div style={G2}>
                      <Field label="Lieu"><input style={IS} value={fDep.lieu} onChange={e=>setFDep(f=>({...f,lieu:e.target.value}))} placeholder="Ville, secteur"/></Field>
                      <Field label="Personnes / rotation"><input type="number" style={IS} value={fDep.nb_personnes_par_vague} onChange={e=>setFDep(f=>({...f,nb_personnes_par_vague:e.target.value}))} placeholder="ex : 8"/></Field>
                    </div>
                    <div style={G2}>
                      <Field label="Date de début"><input type="date" style={IS} value={fDep.date_debut} onChange={e=>setFDep(f=>({...f,date_debut:e.target.value}))}/></Field>
                      <Field label="Date de fin"><input type="date" style={IS} value={fDep.date_fin} onChange={e=>setFDep(f=>({...f,date_fin:e.target.value}))}/></Field>
                    </div>
                    <Field label="Point de rassemblement"><input style={IS} value={fDep.point_rassemblement} onChange={e=>setFDep(f=>({...f,point_rassemblement:e.target.value}))} placeholder="Adresse de départ"/></Field>
                    <Field label="Notes logistique">
                      <textarea style={{ ...IS, minHeight:60, resize:'vertical', lineHeight:1.5, fontFamily:'inherit', height:'auto' }}
                        value={fDep.notes_logistique} onChange={e=>setFDep(f=>({...f,notes_logistique:e.target.value}))} placeholder="Transport, hébergement, équipement..."/>
                    </Field>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn onClick={creerDeployment} loading={savDep} disabled={!fDep.nom.trim()||demIds.length===0} color="#7c3aed">✓ Créer le déploiement</Btn>
                      <Btn onClick={()=>setShowFDep(false)} outline color="#6b7280">Annuler</Btn>
                    </div>
                  </div>
                </SBox>
              ) : (
                <button style={ADD_BTN} onClick={()=>setShowFDep(true)}>+ Créer un nouveau déploiement</button>
              )}
            </div>
          </StepCard>

          {/* ─── ÉTAPE 4 : Ciblage ──────────────────────────────────────── */}
          <StepCard id="step-4" n={4} status={ss(4)} title="Ciblage"
            subtitle={ciblages.length>0?`${ciblages.length} réserviste(s) ciblé(s)`:'Aucun ciblage pour ce déploiement'}>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {ciblages.length>0 ? (
                <div style={{ backgroundColor:'#f0fdf4', borderRadius:8, border:'1px solid #bbf7d0', padding:'10px 14px' }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'#065f46', marginBottom:6 }}>✅ {ciblages.length} réserviste(s) dans le pool</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {ciblages.slice(0,15).map(c=>(
                      <span key={c.id} style={{ fontSize:11, padding:'2px 8px', borderRadius:10,
                        backgroundColor:c.statut==='notifie'?'#dbeafe':'#f1f5f9',
                        color:c.statut==='notifie'?'#1d4ed8':'#475569', fontWeight:500 }}>
                        {c.reservistes.prenom} {c.reservistes.nom}{c.statut==='notifie'?' ✓':''}
                      </span>
                    ))}
                    {ciblages.length>15 && <span style={{ fontSize:11, color:'#94a3b8' }}>+{ciblages.length-15} autres</span>}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize:13, color:'#94a3b8', margin:0 }}>Rendez-vous sur la page de ciblage pour ajouter des réservistes.</p>
              )}
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <Btn onClick={()=>router.push(`/admin/ciblage?deployment=${depId}`)} color="#1e3a5f">🎯 Aller au ciblage</Btn>
                <Btn onClick={rafraichirCiblages} outline color="#475569">🔄 Rafraîchir</Btn>
              </div>
            </div>
          </StepCard>

          {/* ─── ÉTAPE 5 : Notification dispos ──────────────────────────── */}
          <StepCard id="step-5" n={5} status={ss(5)} title="Notification des disponibilités"
            subtitle={ciblages.some(c=>c.statut==='notifie') ? `${ciblages.filter(c=>c.statut==='notifie').length}/${ciblages.length} notifié(s) — envoyé via n8n` : ciblages.length > 0 ? `${ciblages.length} réserviste(s) à notifier` : 'Chargement des ciblages…'}>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ backgroundColor:'#fafafa', borderRadius:8, border:'1px solid #e5e7eb', padding:'10px 14px', fontSize:12, color:'#64748b' }}>
                <strong style={{ color:'#1e3a5f' }}>📨 {ciblages.filter(c=>c.statut!=='notifie').length} destinataire(s)</strong>
                {' '}— Envoi via n8n (SMS Twilio + courriel SMTP).
              </div>
              <Field label="Aperçu du message (éditable)">
                <textarea style={TA} value={msgNotif} onChange={e=>setMsgNotif(e.target.value)}/>
              </Field>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <Btn onClick={sendNotifications} disabled={!ciblages.length||ciblages.every(c=>c.statut==='notifie')} loading={sendingNotif} color="#1d4ed8">
                  📨 Envoyer via n8n ({ciblages.filter(c=>c.statut!=='notifie').length})
                </Btn>
                {ciblages.some(c=>c.statut==='notifie') && (
                  <span style={{ fontSize:12, color:'#10b981', fontWeight:600 }}>✓ {ciblages.filter(c=>c.statut==='notifie').length} déjà notifié(s)</span>
                )}
              </div>
            </div>
          </StepCard>

          {/* ─── ÉTAPE 6 : Disponibilités reçues ────────────────────────── */}
          <StepCard id="step-6" n={6} status={ss(6)} title="Disponibilités reçues"
            subtitle={`${nbReponses}/${ciblages.length} réponse(s) reçues`}>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr', gap:12, minHeight:160 }}>

                {/* Col ciblés */}
                <div style={{ backgroundColor:'#f8fafc', borderRadius:8, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  <div style={{ padding:'7px 12px', borderBottom:'1px solid #e5e7eb', backgroundColor:'#f1f5f9' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase' as any, letterSpacing:'0.04em' }}>Ciblés ({ciblages.length})</span>
                  </div>
                  <div style={{ overflowY:'auto', maxHeight:260 }}>
                    {ciblages.map(c=>{
                      const ar = dispos.some(d=>d.benevole_id===c.benevole_id)
                      return (
                        <div key={c.id} style={{ padding:'6px 12px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                          <span style={{ fontSize:12, color:'#334155', fontWeight:ar?500:400 }}>{c.reservistes.prenom} {c.reservistes.nom.charAt(0)}.</span>
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, fontWeight:600, backgroundColor:ar?'#d1fae5':'#fef3c7', color:ar?'#065f46':'#92400e' }}>{ar?'✓':'?'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Col échéancier */}
                <div style={{ backgroundColor:'#f8fafc', borderRadius:8, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  <div style={{ padding:'7px 12px', borderBottom:'1px solid #e5e7eb', backgroundColor:'#f1f5f9' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase' as any, letterSpacing:'0.04em' }}>Échéancier</span>
                  </div>
                  {uniqueDates.length===0 ? <p style={{ padding:12, fontSize:12, color:'#94a3b8', margin:0 }}>En attente de réponses…</p> : (
                    <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:260 }}>
                      <table style={{ borderCollapse:'collapse', width:'100%', fontSize:11 }}>
                        <thead>
                          <tr>
                            <th style={{ padding:'4px 8px', textAlign:'left', color:'#64748b', fontWeight:600, borderBottom:'1px solid #e5e7eb', position:'sticky', top:0, backgroundColor:'#f8fafc' }}>Nom</th>
                            {uniqueDates.map(d=>(
                              <th key={d} style={{ padding:'4px 5px', textAlign:'center', color:'#64748b', fontWeight:600, borderBottom:'1px solid #e5e7eb', position:'sticky', top:0, backgroundColor:'#f8fafc', whiteSpace:'nowrap' }}>
                                {d.slice(5)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ciblages.map(c=>{
                            const dc = dispos.filter(d=>d.benevole_id===c.benevole_id)
                            return (
                              <tr key={c.id}>
                                <td style={{ padding:'4px 8px', color:'#334155', borderBottom:'1px solid #f8fafc', whiteSpace:'nowrap' }}>{c.reservistes.prenom.charAt(0)}. {c.reservistes.nom.charAt(0)}.</td>
                                {uniqueDates.map(date=>{
                                  const d = dc.find(x=>x.date_jour===date)
                                  return (
                                    <td key={date} style={{ padding:'4px 5px', textAlign:'center', borderBottom:'1px solid #f8fafc', backgroundColor:!d?'#f8fafc':d.disponible?'#d1fae5':'#fee2e2' }}>
                                      <span style={{ fontSize:11 }}>{!d?'·':d.disponible?'✓':'✗'}</span>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Col rotations */}
                <div style={{ backgroundColor:'#f8fafc', borderRadius:8, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  <div style={{ padding:'7px 12px', borderBottom:'1px solid #e5e7eb', backgroundColor:'#f1f5f9' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#1e3a5f', textTransform:'uppercase' as any, letterSpacing:'0.04em' }}>Rotations ({vagues.length})</span>
                  </div>
                  <div style={{ padding:12 }}>
                    {vagues.length===0 ? <p style={{ fontSize:12, color:'#94a3b8', margin:0 }}>Sera créé à l'étape 7</p>
                    : vagues.map(v=>(
                      <div key={v.id} style={{ marginBottom:8 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'#7c3aed' }}>{v.identifiant||`Rot. #${v.numero}`}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{dateFr(v.date_debut)} → {dateFr(v.date_fin)}</div>
                        {v.nb_personnes_requis && <div style={{ fontSize:11, color:'#64748b' }}>👥 {v.nb_personnes_requis} pers.</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <Btn onClick={()=>setStep6Ok(true)} disabled={dispos.length===0||step6Ok} color="#065f46">
                  {step6Ok?'✅ Étape validée':`✅ Valider (${nbReponses} réponse(s))`}
                </Btn>
                {dispos.length===0 && <span style={{ fontSize:12, color:'#f59e0b' }}>En attente des réponses des réservistes</span>}
              </div>
            </div>
          </StepCard>

          {/* ─── ÉTAPE 7 : Rotation IA ───────────────────────────────────── */}
          <StepCard id="step-7" n={7} status={ss(7)} title="Rotation créée" ai
            subtitle={vagues.length>0?`${vagues.length} rotation(s) planifiée(s)`:'IA suggère les affectations optimales'}>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <Btn onClick={getAISuggestion} loading={loadAI} color="#6d28d9">✦ Demander une suggestion à Claude</Btn>
                <p style={{ fontSize:11, color:'#94a3b8', margin:'6px 0 0' }}>
                  Claude analysera les disponibilités et proposera les créneaux de rotation optimaux.
                </p>
              </div>
              {aiSugg && (
                <div style={{ backgroundColor:'#faf5ff', borderRadius:10, border:'1.5px solid #ddd6fe', padding:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#5b21b6' }}>✦ Suggestion de Claude</span>
                    <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, backgroundColor:'#8b5cf6', color:'white', fontWeight:600 }}>IA</span>
                  </div>
                  <pre style={{ fontSize:12, color:'#4c1d95', margin:0, whiteSpace:'pre-wrap', lineHeight:1.6, fontFamily:'inherit' }}>{aiSugg}</pre>
                </div>
              )}
              {vagues.length>0 && (
                <div style={{ backgroundColor:'#f0fdf4', borderRadius:8, border:'1px solid #bbf7d0', padding:'10px 14px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#065f46', marginBottom:8 }}>Rotations créées ({vagues.length})</div>
                  {vagues.map(v=>(
                    <div key={v.id} style={{ fontSize:12, color:'#065f46', marginBottom:4 }}>
                      <strong>{v.identifiant||`Rot. #${v.numero}`}</strong>{' '}— {dateFr(v.date_debut)} → {dateFr(v.date_fin)}{v.nb_personnes_requis?` · ${v.nb_personnes_requis} pers.`:''}
                    </div>
                  ))}
                </div>
              )}
              <SBox>
                <div style={{ fontSize:12, fontWeight:700, color:'#1e3a5f', marginBottom:10 }}>
                  {vagues.length>0?'+ Ajouter une rotation':'Créer la première rotation'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 90px', gap:10 }}>
                  <Field label="Début"><input type="date" style={IS} value={newVague.date_debut} onChange={e=>setNewVague(v=>({...v,date_debut:e.target.value}))}/></Field>
                  <Field label="Fin"><input type="date" style={IS} value={newVague.date_fin} onChange={e=>setNewVague(v=>({...v,date_fin:e.target.value}))}/></Field>
                  <Field label="Nb pers."><input type="number" style={IS} value={newVague.nb} placeholder="—" onChange={e=>setNewVague(v=>({...v,nb:e.target.value}))}/></Field>
                </div>
                <div style={{ marginTop:10 }}>
                  <Btn onClick={createVague} disabled={!newVague.date_debut||!newVague.date_fin} loading={savVague} color="#7c3aed">+ Créer la rotation</Btn>
                </div>
              </SBox>
            </div>
          </StepCard>

          {/* ─── ÉTAPE 8 : Mobilisation ──────────────────────────────────── */}
          <StepCard id="step-8" n={8} status={ss(8)} title="Mobilisation confirmée"
            subtitle={mobilSent?'Confirmations envoyées via n8n ✓':'Envoyer les confirmations de mobilisation'}>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {vagues.length>0 && (
                <div style={{ backgroundColor:'#fafafa', borderRadius:8, border:'1px solid #e5e7eb', padding:'10px 14px' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1e3a5f', marginBottom:6 }}>Mobilisation pour {vagues.length} rotation(s)</div>
                  {vagues.map(v=>(
                    <div key={v.id} style={{ fontSize:12, color:'#334155', display:'flex', gap:12, padding:'4px 0', borderBottom:'1px solid #f1f5f9' }}>
                      <span style={{ fontWeight:600, color:'#7c3aed' }}>{v.identifiant||`Rot. #${v.numero}`}</span>
                      <span>📅 {dateFr(v.date_debut)} → {dateFr(v.date_fin)}</span>
                      {v.nb_personnes_requis && <span>👥 {v.nb_personnes_requis} pers.</span>}
                    </div>
                  ))}
                </div>
              )}
              <Field label="Aperçu du message de mobilisation (éditable)">
                <textarea style={TA} value={msgMobil} onChange={e=>setMsgMobil(e.target.value)}/>
              </Field>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <Btn onClick={sendMobilisation} disabled={vagues.length===0||mobilSent} loading={sendingMobil} color="#065f46">
                  {mobilSent?'✅ Mobilisation envoyée':'🚀 Envoyer via n8n'}
                </Btn>
                {vagues.length===0 && <span style={{ fontSize:12, color:'#f59e0b' }}>Créez d'abord les rotations à l'étape 7</span>}
              </div>
              {mobilSent && (
                <div style={{ backgroundColor:'#d1fae5', borderRadius:8, border:'1px solid #6ee7b7', padding:'12px 16px', fontSize:13, color:'#065f46', fontWeight:600 }}>
                  🎉 Opération complète — La mobilisation est confirmée et les notifications ont été envoyées via n8n.
                </div>
              )}
            </div>
          </StepCard>

        </div>{/* fin contenu principal */}
      </div>{/* fin flex deux colonnes */}
    </div>
  )
}
