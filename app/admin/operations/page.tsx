'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { n8nUrl } from '@/utils/n8n'

import type { Sinistre, Demande, Deployment, Ciblage, DispoV2, Vague, StepStatus } from './types'
import { TYPES_INCIDENT, ORGANISMES, TYPES_MISSION } from './types'
import { dateFr, genDemandeId, genDeployId, tplNotif, tplMobil } from './helpers'
import { Btn, Field, SBox, SelCard, IS, LS, G2, TA, ADD_BTN } from './ui'
import { SidebarStepper } from './components/SidebarStepper'
import { StepCard } from './components/StepCard'
import { fetchWizardState, saveWizardState, deleteWizardState } from './wizardState'

// ─── Page principale ──────────────────────────────────────────────────────────

export default function OperationsPage() {
  const supabase = createClient()
  const router    = useRouter()
  const isMounted = useRef(false)
  const LS_KEY    = 'riusc_ops_context'

  // ── Lire les params URL uniquement (la persistance DB est gerree plus bas) ──
  const readUrlContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const sinId = params.get('sin')
    const depId = params.get('dep')
    const dems = params.get('dems')
    const demIds = dems ? dems.split(',').filter(Boolean) : []
    if (!sinId && !depId && !demIds.length) return null
    return { sinId, depId, demIds }
  }, [])

  // Ref pour gerer la race: si l'admin change de sinistre pendant un fetch,
  // on ne veut pas appliquer l'ancien state par-dessus le nouveau.
  const pendingSinIdRef = useRef<string | null>(null)
  // Ref pour eviter les re-saves inutiles quand on restaure depuis la DB
  const restoredSinIdRef = useRef<string | null>(null)
  // Indique si un etat DB existe pour le sinistre courant (pour afficher le bouton reset)
  const [hasSavedState, setHasSavedState] = useState(false)

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

  // ── Restauration du contexte au montage (URL uniquement) ─────────────────
  useEffect(() => {
    const ctx = readUrlContext()
    if (ctx) {
      if (ctx.sinId)         setSinId(ctx.sinId)
      if (ctx.demIds.length) setDemIds(ctx.demIds)
      if (ctx.depId)         setDepId(ctx.depId)
    }
    // Lire le flag step4 + ciblages sauvegardes (cache UI ephemere, reste en localStorage)
    try {
      const s4dep = localStorage.getItem('riusc_ops_step4_done')
      if (s4dep && ctx?.depId && s4dep === ctx.depId) {
        setStep4Override(true)
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

  // ── Quand le sinistre change: fetch son etat DB et l'appliquer ────────────
  useEffect(() => {
    if (!sinId) {
      setHasSavedState(false)
      restoredSinIdRef.current = null
      return
    }
    // Si on vient deja de restaurer ce sinistre, on ne refetch pas
    if (restoredSinIdRef.current === sinId) return
    pendingSinIdRef.current = sinId
    const currentSin = sinId
    fetchWizardState(sinId).then((row) => {
      // Race check: l'utilisateur a peut-etre change de sinistre pendant le fetch
      if (pendingSinIdRef.current !== currentSin) return
      if (row) {
        // Appliquer les valeurs persistees SAUF si l'URL nous a deja donne un override
        const urlCtx = readUrlContext()
        const hasUrlDems = !!(urlCtx?.demIds?.length)
        const hasUrlDep = !!urlCtx?.depId
        if (!hasUrlDems && row.demande_ids?.length) setDemIds(row.demande_ids)
        if (!hasUrlDep && row.deployment_id) setDepId(row.deployment_id)
        if (row.msg_notif) setMsgNotif(row.msg_notif)
        setHasSavedState(true)
      } else {
        setHasSavedState(false)
      }
      restoredSinIdRef.current = currentSin
    })
  }, [sinId, readUrlContext])

  const selSin = sinistres.find(s=>s.id===sinId)
  const selDep = deployments.find(d=>d.id===depId)

  // formulaires
  // msgNotif est restaure via la DB quand le sinistre est selectionne (effet plus haut)
  const [msgNotif, setMsgNotif] = useState('')

  // ── Sync URL a chaque changement de selection ────────────────────────────
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    const p = new URLSearchParams()
    if (sinId)         p.set('sin',  sinId)
    if (depId)         p.set('dep',  depId)
    if (demIds.length) p.set('dems', demIds.join(','))
    const qs = p.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? '?'+qs : ''}`)
  }, [sinId, depId, demIds.join(','), msgNotif])

  // ── Upsert dans DB a chaque changement (debounce 500ms) ──────────────────
  useEffect(() => {
    if (!sinId) return
    // On attend que la restauration soit finie pour le sinistre courant
    if (restoredSinIdRef.current !== sinId) return
    const timer = setTimeout(() => {
      saveWizardState(sinId, {
        demande_ids: demIds,
        deployment_id: depId,
        msg_notif: msgNotif || null,
      }).then(r => { if (r.ok) setHasSavedState(true) })
    }, 500)
    return () => clearTimeout(timer)
  }, [sinId, depId, demIds.join(','), msgNotif])

  // ── Handler: nouvelle configuration (reset DB + state local) ─────────────
  const resetConfiguration = useCallback(async () => {
    if (!sinId) return
    if (!confirm('Effacer la configuration sauvegardee pour ce sinistre (demandes + deploiement) et repartir a zero ?')) return
    await deleteWizardState(sinId)
    setDemIds([])
    setDepId(null)
    setMsgNotif('')
    setHasSavedState(false)
    restoredSinIdRef.current = sinId // eviter de refetch juste apres
  }, [sinId])
  const [showFSin, setShowFSin] = useState(false)
  const [showFDem, setShowFDem] = useState(false)
  const [showFDep, setShowFDep] = useState(false)

  const [fSin, setFSin] = useState({ nom:'', type_incident:'', lieu:'', date_debut:'' })
  const [fDem, setFDem] = useState({ organisme:'', type_mission:'', lieu:'', nb_personnes_requis:'', date_debut:'', date_fin_estimee:'', priorite:'Normale', contact_nom:'', contact_telephone:'' })
  const [fDep, setFDep] = useState({ nom:'', lieu:'', date_debut:'', date_fin:'', duree_preset:'', nb_personnes_par_vague:'', point_rassemblement:'', notes_logistique:'', mode_dates:'plage_continue' as 'plage_continue' | 'jours_individuels', jours_proposes:[] as string[], branding:'RIUSC' as 'RIUSC' | 'AQBRS', heures_limite_reponse:'8' })

  const DUREE_EN_JOURS: Record<string, number> = {
    '24h': 1, '36h': 2, '48h': 2,
    '3j': 3, '4j': 4, '5j': 5, '6j': 6, '7j': 7, '14j': 14,
  }

  const [savSin, setSavSin] = useState(false)
  const [savDem, setSavDem] = useState(false)
  const [savDep, setSavDep] = useState(false)

  // Mode édition : quand non-null, les formulaires passent en mode UPDATE au lieu de INSERT
  const [editingSinId, setEditingSinId] = useState<string | null>(null)
  const [editingDemId, setEditingDemId] = useState<string | null>(null)
  const [editingDepId, setEditingDepId] = useState<string | null>(null)

  // Modal de config dédiée du déploiement (branding, mode dates, heures, jours proposés)
  const [configDepId, setConfigDepId] = useState<string | null>(null)
  const [fConfig, setFConfig] = useState({
    mode_dates: 'plage_continue' as 'plage_continue' | 'jours_individuels',
    jours_proposes: [] as string[],
    branding: 'RIUSC' as 'RIUSC' | 'AQBRS',
    heures_limite_reponse: '8',
  })
  const [savConfig, setSavConfig] = useState(false)

  // Démobilisation d'une vague
  const [demobilisating, setDemobilisating] = useState<string | null>(null)

  // Rotation: expansion + personnes assignées
  const [expandedVagues, setExpandedVagues] = useState<Set<string>>(new Set())
  const [assignParVague, setAssignParVague] = useState<Record<string, { benevole_id: string; prenom: string; nom: string; telephone: string | null; statut_ciblage?: string }[]>>({})
  // Compteur d'assignations par vague (chargé une fois au mount des vagues pour affichage rapide)
  const [countsParVague, setCountsParVague] = useState<Record<string, number>>({})

  // Pré-charger les counts d'assignations pour toutes les vagues dès qu'elles sont chargées
  useEffect(() => {
    if (!vagues.length) { setCountsParVague({}); return }
    const vagueIds = vagues.map(v => v.id)
    supabase.from('assignations')
      .select('vague_id')
      .in('vague_id', vagueIds)
      .then(({ data }) => {
        const counts: Record<string, number> = {}
        for (const id of vagueIds) counts[id] = 0
        for (const row of (data || [])) {
          counts[row.vague_id] = (counts[row.vague_id] || 0) + 1
        }
        setCountsParVague(counts)
      })
  }, [vagues.map(v => v.id).join(',')])

  const toggleVagueExpansion = async (vagueId: string) => {
    setExpandedVagues(prev => {
      const next = new Set(prev)
      if (next.has(vagueId)) next.delete(vagueId)
      else next.add(vagueId)
      return next
    })
    // Lazy load si pas déjà chargé
    if (!assignParVague[vagueId]) {
      const { data: assigns } = await supabase
        .from('assignations')
        .select('benevole_id')
        .eq('vague_id', vagueId)
      const benevoleIds = (assigns || []).map(a => a.benevole_id).filter(Boolean) as string[]
      if (!benevoleIds.length) { setAssignParVague(p => ({ ...p, [vagueId]: [] })); return }
      const { data: res } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom, telephone')
        .in('benevole_id', benevoleIds)
      // Charger aussi le statut ciblage pour afficher badge
      const { data: ciblagesData } = await supabase
        .from('ciblages')
        .select('benevole_id, statut')
        .eq('reference_id', depId as string)
        .eq('niveau', 'deploiement')
        .in('benevole_id', benevoleIds)
      const statutMap = Object.fromEntries((ciblagesData || []).map((c: any) => [c.benevole_id, c.statut]))
      setAssignParVague(p => ({
        ...p,
        [vagueId]: (res || []).map((r: any) => ({
          benevole_id: r.benevole_id,
          prenom: r.prenom,
          nom: r.nom,
          telephone: r.telephone,
          statut_ciblage: statutMap[r.benevole_id],
        })),
      }))
    }
  }

  // Clôture COMPLÈTE du déploiement: inclut notifie en plus de mobilise/confirme
  // Marque aussi le déploiement comme 'Complété'. Utile en fin d'opération.
  const cloturerDeploiement = async () => {
    if (!depId || !selDep) return
    if (!confirm(`Clôturer le déploiement « ${selDep.nom} » au complet ?\n\nCette action:\n- Passe TOUS les ciblages (notifie + mobilisé + confirmé) au statut "terminé"\n- Marque le déploiement comme "Complété"\n- Marque toutes les vagues comme "Terminée"\n\nÀ utiliser quand l'opération est vraiment finie et qu'aucune sollicitation ne doit rester active.`)) return
    setDemobilisating('CLOSE')
    try {
      const res = await fetch('/api/admin/operations/demobiliser', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deployment_id: depId, close_deployment: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Erreur : ${data.error || 'inconnue'}`)
      } else {
        alert(`🔒 Clôture OK\n\n${data.ciblages_termines} ciblage(s) passés à "termine" (incluant notifie)\n${data.vagues_terminees ?? 0} vague(s) marquée(s) Terminée\nDéploiement marqué Complété: ${data.deployment_closed ? 'oui' : 'non'}`)
        const { data: fresh } = await supabase.from('vagues').select('*').eq('deployment_id', depId).order('numero')
        if (fresh) setVagues(fresh as unknown as Vague[])
        // Refetch aussi le déploiement pour voir le nouveau statut
        const { data: depFresh } = await supabase.from('deployments').select('*').eq('id', depId).single()
        if (depFresh) setDeployments(p => p.map(d => d.id === depId ? (depFresh as unknown as Deployment) : d))
      }
    } catch (e: any) {
      alert('Erreur réseau : ' + (e?.message || 'inconnue'))
    }
    setDemobilisating(null)
  }

  // Démobilisation BULK d'un déploiement entier (ignore les vagues, tous les ciblages mobilise/confirme → termine)
  const demobiliserDeploiement = async () => {
    if (!depId || !selDep) return
    if (!confirm(`Démobiliser TOUT le déploiement « ${selDep.nom} » ?\n\nÇa passe TOUS les réservistes encore en statut "mobilise" ou "confirme" au statut "terminé", peu importe les vagues.\n\nUtile quand: mode jours individuels (pas de vagues alignées) OU fin complète de l'opération.\n\nAction non destructive — les ciblages deviennent "termine".`)) return
    setDemobilisating('ALL')
    try {
      const res = await fetch('/api/admin/operations/demobiliser', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deployment_id: depId, all_deployment: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Erreur : ${data.error || 'inconnue'}`)
      } else {
        alert(`✅ Démobilisation bulk OK\n\n${data.ciblages_termines} ciblage(s) passés à "termine"\n${data.vagues_terminees ?? 0} vague(s) marquée(s) Terminée`)
        const { data: fresh } = await supabase.from('vagues').select('*').eq('deployment_id', depId).order('numero')
        if (fresh) setVagues(fresh as unknown as Vague[])
      }
    } catch (e: any) {
      alert('Erreur réseau : ' + (e?.message || 'inconnue'))
    }
    setDemobilisating(null)
  }

  const demobiliserVague = async (vagueId: string, nomVague: string) => {
    if (!confirm(`Démobiliser « ${nomVague} » ?\n\nÇa passe tous les réservistes assignés à cette vague au statut "terminé" (ils ne verront plus le déploiement dans leurs mobilisations). La vague passe à "Terminée". Action non destructive — tu peux toujours remettre leur ciblage à "mobilise" en SQL si besoin.`)) return
    setDemobilisating(vagueId)
    try {
      const res = await fetch('/api/admin/operations/demobiliser', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vague_id: vagueId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Erreur : ${data.error || 'inconnue'}`)
      } else {
        alert(`✅ Démobilisation OK\n\n${data.vagues_terminees} vague(s) marquée(s) Terminée\n${data.ciblages_termines} ciblage(s) passés à "termine"\n${data.benevoles_affectes} réserviste(s) affectés`)
        // Rafraîchir les vagues côté wizard pour voir le nouveau statut
        if (depId) {
          const { data: fresh } = await supabase.from('vagues').select('*').eq('deployment_id', depId).order('numero')
          if (fresh) setVagues(fresh as unknown as Vague[])
        }
      }
    } catch (e: any) {
      alert('Erreur réseau : ' + (e?.message || 'inconnue'))
    }
    setDemobilisating(null)
  }

  // Helper: une vague est-elle "en retard" de démobilisation (date_fin > 24h passée et pas encore Terminée)?
  const vagueEstEnRetard = (v: Vague) => {
    if (!v.date_fin || v.statut === 'Terminée') return false
    const fin = new Date(v.date_fin).getTime() + 24 * 3600 * 1000
    return Date.now() > fin
  }

  const openConfigModal = (d: Deployment) => {
    setConfigDepId(d.id)
    setFConfig({
      mode_dates: (d.mode_dates || 'plage_continue') as 'plage_continue' | 'jours_individuels',
      jours_proposes: Array.isArray(d.jours_proposes) ? d.jours_proposes : [],
      branding: (d.branding || 'RIUSC') as 'RIUSC' | 'AQBRS',
      heures_limite_reponse: d.heures_limite_reponse ? String(d.heures_limite_reponse) : '8',
    })
  }

  const saveConfig = async () => {
    if (!configDepId) return
    const jours = fConfig.jours_proposes.filter(d => d && d.trim())
    if (fConfig.mode_dates === 'jours_individuels' && jours.length === 0) {
      alert('En mode "jours individuels", ajoute au moins une date dans la liste.')
      return
    }
    setSavConfig(true)
    const payload = {
      mode_dates: fConfig.mode_dates,
      jours_proposes: fConfig.mode_dates === 'jours_individuels' ? jours : null,
      branding: fConfig.branding,
      heures_limite_reponse: parseInt(fConfig.heures_limite_reponse) || 8,
    }
    const { data, error } = await supabase.from('deployments').update(payload).eq('id', configDepId).select().single()
    if (error) {
      console.error('Erreur sauvegarde config:', error)
      alert(`Erreur sauvegarde config : ${error.message}`)
    } else if (data) {
      setDeployments(p => p.map(d => d.id === configDepId ? (data as unknown as Deployment) : d))
      setConfigDepId(null)
    }
    setSavConfig(false)
  }

  // wizard
  const [step4Override, setStep4Override] = useState(false)
  const [step6Ok,       setStep6Ok]       = useState(false)
  const [mobilSent,     setMobilSent]     = useState(false)
  const [msgMobil,      setMsgMobil]      = useState('')
  const [aiSugg,        setAiSugg]        = useState<string|null>(null)
  const [loadAI,        setLoadAI]        = useState(false)
  const [newVague,      setNewVague]      = useState({ date_debut:'', date_fin:'', nb:'' })
  const [savVague,      setSavVague]      = useState(false)
  const [sendingNotif,  setSendingNotif]  = useState(false)
  const [sendingMobil,  setSendingMobil]  = useState(false)
  const [fullscreen,    setFullscreen]    = useState(false)

  // ── Complétion ─────────────────────────────────────────────────────────────
  // Les étapes 6 et 8 sont dérivées de la DB (pas seulement de l'état local) pour
  // que TOUS les admins (Dany, Esther, Guy…) voient la même progression du wizard.
  // - Étape 6 (validation des dispos) : implicite si des vagues existent (étape 7
  //   ne se fait pas sans avoir vu les dispos).
  // - Étape 8 (mobilisation envoyée) : dérivée du statut des vagues — sendMobilisation()
  //   passe les vagues à 'Mobilisée' en DB.
  const mobilSentDerived = mobilSent || (vagues.length > 0 && vagues.some(v => v.statut === 'Mobilisée' || v.statut === 'Confirmée'))
  const step6OkDerived   = step6Ok   || vagues.length > 0 || mobilSentDerived
  const done = useCallback((n: number): boolean => {
    switch(n) {
      case 1: return !!sinId
      case 2: return demIds.length > 0
      case 3: return !!depId
      case 4: return ciblages.length > 0 || step4Override
      case 5: return ciblages.some(c=>c.statut==='notifie')
      case 6: return step6OkDerived
      case 7: return vagues.length > 0
      case 8: return mobilSentDerived
      default: return false
    }
  }, [sinId, demIds, depId, ciblages, step4Override, step6OkDerived, vagues, mobilSentDerived])

  const curStep = useMemo(() => {
    for (let i=1;i<=8;i++) if(!done(i)) return i
    return 8
  }, [done])

  const ss = (n: number): StepStatus => done(n)?'done': n<=curStep?'active':'locked'
  const statuses: StepStatus[] = [1,2,3,4,5,6,7,8].map(n=>ss(n))

  // ── Chargements ─────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.from('sinistres').select('*').in('statut',['Actif','En cours'])
      .order('created_at',{ascending:false}).then(({data})=>{ if(data) setSinistres(data as unknown as Sinistre[]) })
  }, [])

  useEffect(() => {
    if (!sinId) { setDemandes([]); return }
    supabase.from('demandes').select('*').eq('sinistre_id',sinId)
      .order('date_reception',{ascending:false}).then(({data})=>{ if(data) setDemandes(data as unknown as Demande[]) })
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
      .then(({ data }) => { if (data) setDeployments([data as unknown as Deployment]) })
  }, [depId])

  // Filet de sécurité : si on arrive sur le wizard avec un depId mais sans sinId
  // ni demIds (ex: retour depuis /admin/operations/disponibilites via router.push
  // qui ne garde que ?dep=...), on remonte la chaîne DB pour reconstruire le
  // contexte : deployment → demandes (via deployments_demandes) → sinistre.
  // Sans ça, l'étape 1 reste "active" et l'étape 8 reste locked, ce qui bloque
  // le workflow même quand tout est fait côté données.
  useEffect(() => {
    if (!depId) return
    if (sinId && demIds.length > 0) return  // contexte déjà complet
    ;(async () => {
      const { data: liens } = await supabase
        .from('deployments_demandes')
        .select('demande_id, demandes(id, sinistre_id)')
        .eq('deployment_id', depId)
      if (!liens || liens.length === 0) return
      const dems = (liens as any[])
        .map(l => l.demandes)
        .filter(Boolean) as { id: string; sinistre_id: string }[]
      if (dems.length === 0) return
      // Tous les demandes d'un même déploiement partagent le même sinistre
      const sinFromDB = dems[0].sinistre_id
      const demIdsFromDB = dems.map(d => d.id)
      if (!sinId && sinFromDB) setSinId(sinFromDB)
      if (demIds.length === 0 && demIdsFromDB.length > 0) setDemIds(demIdsFromDB)
    })()
  }, [depId, sinId, demIds.length])

  useEffect(() => {
    if (!depId) { setCiblages([]); setDispos([]); setVagues([]); setStep6Ok(false); setMobilSent(false); setAiSugg(null); return }
    // Utiliser l'API admin (service_role) pour bypass les RLS auth browser qui
    // ne propagent pas toujours correctement auth.uid() côté client.
    fetch(`/api/admin/operations/dispos?dep=${encodeURIComponent(depId)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { ciblages: any[], reservistes: any[], dispos: any[] } | null) => {
        if (!data) return
        const resMap: Record<string, any> = {}
        for (const r of (data.reservistes || [])) { if (r.benevole_id) resMap[r.benevole_id] = r }
        if (data.ciblages?.length) {
          setCiblages(data.ciblages.map(c => ({
            ...c,
            reservistes: (c.benevole_id && resMap[c.benevole_id]) || { prenom: '?', nom: '?', telephone: '' }
          })) as any)
        } else {
          setCiblages(prev => prev.length > 0 ? prev : [])
        }
        setDispos((data.dispos || []) as any)
      })
      .catch(err => console.error('Erreur fetch dispos admin:', err))
    supabase.from('vagues').select('*').eq('deployment_id',depId).order('numero')
      .then(({data})=>{ if(data) setVagues(data as any) })
  }, [depId, step4Override])

  // Helper exposé pour rafraîchir les vagues à la demande (bouton Refresh étape 7)
  const rafraichirVagues = async () => {
    if (!depId) return
    const { data } = await supabase.from('vagues').select('*').eq('deployment_id', depId).order('numero')
    if (data) setVagues(data as any)
  }

  // Quand l'utilisateur revient sur l'onglet (depuis /admin/operations/disponibilites
  // où il a pu créer/modifier une rotation), on refetch les vagues pour que le wizard
  // reflète l'état actuel de la DB. Sans ça, le wizard pense que step 7/8 ne sont pas
  // encore done et les bloque.
  useEffect(() => {
    if (!depId) return
    const refreshVagues = () => {
      if (document.visibilityState === 'visible') {
        supabase.from('vagues').select('*').eq('deployment_id', depId).order('numero')
          .then(({ data }) => { if (data) setVagues(data as any) })
      }
    }
    window.addEventListener('focus', refreshVagues)
    document.addEventListener('visibilitychange', refreshVagues)
    // Refetch aussi quand on arrive sur la page (router.push depuis /disponibilites
    // ne retriggère pas les useEffect depId-based, donc on ajoute un refetch initial
    // explicite).
    refreshVagues()
    return () => {
      window.removeEventListener('focus', refreshVagues)
      document.removeEventListener('visibilitychange', refreshVagues)
    }
  }, [depId])

  // Auto-remplir le message notification si vide, en utilisant la config complete
  // (branding, mode, heures limite). Ne reecrase pas un texte deja edite.
  useEffect(() => {
    if (!selSin || !selDep) return
    if (sinId && restoredSinIdRef.current !== sinId) return // attendre restauration DB
    setMsgNotif((prev: string) => prev && prev.trim() ? prev : tplNotif({
      sinNom: selSin.nom,
      depNom: selDep.nom,
      dateDebut: selDep.date_debut,
      dateFin: selDep.date_fin,
      lieu: selDep.lieu,
      branding: (selDep.branding || 'RIUSC') as 'RIUSC' | 'AQBRS',
      heuresLimite: selDep.heures_limite_reponse ?? 8,
      modeDates: (selDep.mode_dates || 'plage_continue') as 'plage_continue' | 'jours_individuels',
      joursProposes: selDep.jours_proposes,
      // Défaut 5 jours en attendant la colonne DB dédiée (#15). Admin peut éditer.
      dureeMinRotationJours: 5,
      // Lien direct vers le formulaire pour ce déploiement (sinon liste générale)
      deploymentId: selDep.id,
    }))
  }, [selSin?.id, selDep?.id, selDep?.branding, selDep?.mode_dates, selDep?.heures_limite_reponse, sinId])

  // Auto-remplir le message mobilisation si vide, en utilisant la config complete.
  useEffect(() => {
    if (!selDep) return
    setMsgMobil((prev: string) => {
      if (prev && prev.trim()) return prev
      const v = vagues[0]
      return tplMobil({
        depNom: selDep.nom,
        vagNom: v ? (v.identifiant || `Rotation #${v.numero}`) : '[rotation à définir]',
        debut: v?.date_debut || '[date début]',
        fin: v?.date_fin || '[date fin]',
        lieu: selDep.lieu,
        branding: (selDep.branding || 'RIUSC') as 'RIUSC' | 'AQBRS',
      })
    })
  }, [depId, vagues.length, selDep?.branding])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const creerSinistre = async () => {
    if (!fSin.nom.trim() || !fSin.type_incident || !fSin.lieu || !fSin.date_debut) {
      alert('Tous les champs (nom, type, lieu, date de début) sont obligatoires.')
      return
    }
    setSavSin(true)
    const payload = { nom:fSin.nom.trim(), type_incident:fSin.type_incident, lieu:fSin.lieu, date_debut:fSin.date_debut }
    const query = editingSinId
      ? supabase.from('sinistres').update(payload).eq('id', editingSinId).select().single()
      : supabase.from('sinistres').insert({ ...payload, statut:'Actif' }).select().single()
    const {data,error} = await query
    if (error) {
      console.error('Erreur sinistre:', error)
      alert(`Erreur ${editingSinId ? 'modification' : 'création'} sinistre : ${error.message}${error.code ? ` (${error.code})` : ''}`)
    } else if (data) {
      const sinistre = data as unknown as Sinistre
      if (editingSinId) {
        setSinistres(p => p.map(s => s.id === editingSinId ? sinistre : s))
      } else {
        setSinistres(p => [sinistre, ...p])
        setSinId(sinistre.id)
      }
      setShowFSin(false); setEditingSinId(null)
      setFSin({nom:'',type_incident:'',lieu:'',date_debut:''})
    }
    setSavSin(false)
  }

  const creerDemande = async () => {
    if (!fDem.organisme || !sinId) return
    if (!fDem.type_mission || !fDem.lieu || !fDem.date_debut) {
      alert('Type de mission, lieu et date de début sont obligatoires.')
      return
    }
    setSavDem(true)
    const description = `${fDem.type_mission} - ${fDem.lieu}`
    const payload = {
      organisme: fDem.organisme, type_mission: fDem.type_mission, description,
      lieu: fDem.lieu,
      nb_personnes_requis: fDem.nb_personnes_requis ? parseInt(fDem.nb_personnes_requis) : null,
      date_debut: fDem.date_debut, date_fin_estimee: fDem.date_fin_estimee || null,
      priorite: fDem.priorite,
      contact_nom: fDem.contact_nom || null, contact_telephone: fDem.contact_telephone || null,
    }
    const query = editingDemId
      ? supabase.from('demandes').update(payload).eq('id', editingDemId).select().single()
      : (() => {
          const identifiant = genDemandeId(demandes, fDem.organisme, fDem.date_debut)
          return supabase.from('demandes').insert({
            ...payload,
            sinistre_id: sinId, statut: 'Nouvelle', identifiant,
            date_reception: new Date().toISOString(),
          }).select().single()
        })()
    const {data,error} = await query
    if (error) {
      console.error('Erreur demande:', error)
      alert(`Erreur ${editingDemId ? 'modification' : 'création'} demande : ${error.message}${error.code ? ` (${error.code})` : ''}`)
    } else if (data) {
      const demande = data as unknown as Demande
      if (editingDemId) {
        setDemandes(p => p.map(d => d.id === editingDemId ? demande : d))
      } else {
        setDemandes(p => [demande, ...p])
        setDemIds(p => [...p, demande.id])
      }
      setShowFDem(false); setEditingDemId(null)
      setFDem({organisme:'',type_mission:'',lieu:'',nb_personnes_requis:'',date_debut:'',date_fin_estimee:'',priorite:'Normale',contact_nom:'',contact_telephone:''})
    }
    setSavDem(false)
  }

  const creerDeployment = async () => {
    if (!fDep.nom.trim()) return
    if (!editingDepId && !demIds.length) return
    if (!fDep.lieu || !fDep.date_debut || !fDep.nb_personnes_par_vague) {
      alert('Lieu, date de début et nombre de personnes par vague sont obligatoires.')
      return
    }
    setSavDep(true)
    // Payload CRUD seulement; la config (branding, mode_dates, heures) est geree
    // via le bouton ⚙️ sur la card. Les defauts SQL s'appliquent a la creation.
    const payload: any = {
      nom: fDep.nom.trim(), lieu: fDep.lieu,
      date_debut: fDep.date_debut, date_fin: fDep.date_fin || null,
      nb_personnes_par_vague: parseInt(fDep.nb_personnes_par_vague),
      point_rassemblement: fDep.point_rassemblement || null,
      notes_logistique: fDep.notes_logistique || null,
    }
    if (editingDepId) {
      const {data, error} = await supabase.from('deployments').update(payload).eq('id', editingDepId).select().single()
      if (error) {
        console.error('Erreur modification déploiement:', error)
        alert(`Erreur modification déploiement : ${error.message}${error.code ? ` (${error.code})` : ''}`)
      } else if (data) {
        const dep = data as unknown as Deployment
        setDeployments(p => p.map(d => d.id === editingDepId ? dep : d))
        setShowFDep(false); setEditingDepId(null)
        setFDep({nom:'',lieu:'',date_debut:'',date_fin:'',duree_preset:'',nb_personnes_par_vague:'',point_rassemblement:'',notes_logistique:'',mode_dates:'plage_continue' as 'plage_continue' | 'jours_individuels',jours_proposes:[] as string[],branding:'RIUSC' as 'RIUSC' | 'AQBRS',heures_limite_reponse:'8'})
      }
    } else {
      const identifiant = genDeployId(deployments)
      const {data, error} = await supabase.from('deployments').insert({
        ...payload, identifiant, statut: 'Planifié',
      }).select().single()
      if (!error && data) {
        await supabase.from('deployments_demandes').insert(demIds.map(did => ({ deployment_id: data.id, demande_id: did })))
        setDeployments(p => [...p, data as unknown as Deployment]); setDepId(data.id)
        setShowFDep(false)
        setFDep({nom:'',lieu:'',date_debut:'',date_fin:'',duree_preset:'',nb_personnes_par_vague:'',point_rassemblement:'',notes_logistique:'',mode_dates:'plage_continue' as 'plage_continue' | 'jours_individuels',jours_proposes:[] as string[],branding:'RIUSC' as 'RIUSC' | 'AQBRS',heures_limite_reponse:'8'})
      } else if (error) {
        console.error('Erreur creation déploiement:', error)
        alert(`Erreur création déploiement : ${error.message}${error.code ? ` (${error.code})` : ''}`)
      }
    }
    setSavDep(false)
  }

  // ── Helpers pour entrer en mode édition ──────────────────────────────────
  const editSinistre = (s: Sinistre) => {
    setEditingSinId(s.id)
    setFSin({
      nom: s.nom || '',
      type_incident: s.type_incident || '',
      lieu: s.lieu || '',
      date_debut: s.date_debut || '',
    })
    setShowFSin(true)
  }
  const editDemande = (d: Demande) => {
    setEditingDemId(d.id)
    setFDem({
      organisme: d.organisme || '',
      type_mission: d.type_mission || '',
      lieu: d.lieu || '',
      nb_personnes_requis: d.nb_personnes_requis ? String(d.nb_personnes_requis) : '',
      date_debut: d.date_debut || '',
      date_fin_estimee: d.date_fin_estimee || '',
      priorite: d.priorite || 'Normale',
      contact_nom: d.contact_nom || '',
      contact_telephone: d.contact_telephone || '',
    })
    setShowFDem(true)
  }
  const editDeployment = (d: Deployment) => {
    setEditingDepId(d.id)
    let duree_preset = ''
    if (d.date_debut && d.date_fin) {
      const deb = new Date(d.date_debut + 'T00:00:00')
      const fin = new Date(d.date_fin + 'T00:00:00')
      const nbJours = Math.round((fin.getTime() - deb.getTime()) / 86400000) + 1
      const mapInverse: Record<number, string> = { 1:'24h', 2:'48h', 3:'3j', 4:'4j', 5:'5j', 6:'6j', 7:'7j', 14:'14j' }
      duree_preset = mapInverse[nbJours] || 'custom'
    }
    setFDep({
      nom: d.nom || '',
      lieu: d.lieu || '',
      date_debut: d.date_debut || '',
      date_fin: d.date_fin || '',
      duree_preset,
      nb_personnes_par_vague: d.nb_personnes_par_vague ? String(d.nb_personnes_par_vague) : '',
      point_rassemblement: (d as any).point_rassemblement || '',
      notes_logistique: (d as any).notes_logistique || '',
      mode_dates: (d.mode_dates || 'plage_continue') as 'plage_continue' | 'jours_individuels',
      jours_proposes: Array.isArray(d.jours_proposes) ? d.jours_proposes : [],
      branding: (d.branding || 'RIUSC') as 'RIUSC' | 'AQBRS',
      heures_limite_reponse: d.heures_limite_reponse ? String(d.heures_limite_reponse) : '8',
    })
    setShowFDep(true)
  }
  const cancelEdit = (kind: 'sin' | 'dem' | 'dep') => {
    if (kind === 'sin') { setShowFSin(false); setEditingSinId(null); setFSin({nom:'',type_incident:'',lieu:'',date_debut:''}) }
    if (kind === 'dem') { setShowFDem(false); setEditingDemId(null); setFDem({organisme:'',type_mission:'',lieu:'',nb_personnes_requis:'',date_debut:'',date_fin_estimee:'',priorite:'Normale',contact_nom:'',contact_telephone:''}) }
    if (kind === 'dep') { setShowFDep(false); setEditingDepId(null); setFDep({nom:'',lieu:'',date_debut:'',date_fin:'',duree_preset:'',nb_personnes_par_vague:'',point_rassemblement:'',notes_logistique:'',mode_dates:'plage_continue' as 'plage_continue' | 'jours_individuels',jours_proposes:[] as string[],branding:'RIUSC' as 'RIUSC' | 'AQBRS',heures_limite_reponse:'8'}) }
  }

  const rafraichirCiblages = async () => {
    if (!depId) return
    const {data: cibData} = await supabase.from('ciblages').select('id,benevole_id,statut')
      .eq('niveau','deploiement').eq('reference_id',depId).neq('statut','retire')
    if (!cibData?.length) { setCiblages([]); return }
    const ids = cibData.map(c => c.benevole_id).filter((x): x is string => !!x)
    const { data: resData } = await supabase.from('reservistes')
      .select('benevole_id,prenom,nom,telephone').in('benevole_id', ids)
    const resMap: Record<string,any> = {}
    for (const r of (resData || [])) { if (r.benevole_id) resMap[r.benevole_id] = r }
    setCiblages(cibData.map(c => ({
      ...c,
      reservistes: (c.benevole_id && resMap[c.benevole_id]) || { prenom:'?', nom:'?', telephone:'' }
    })) as any)
  }

  const sendNotifications = async () => {
    const toNotify = ciblages.filter(c=>c.statut!=='notifie').map(c=>c.id)
    if (!toNotify.length) return
    setSendingNotif(true)
    await supabase.from('ciblages').update({statut:'notifie',updated_at:new Date().toISOString()}).in('id',toNotify)
    try {
      // Passage par notre proxy serveur qui injecte les clés Supabase/Twilio
      // dans le body avant de forward à n8n (les clés ne quittent pas Vercel).
      await fetch('/api/admin/operations/n8n-webhook', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          path: 'riusc-envoi-ciblage-portail',
          payload: { deployment_id:depId, ciblage_ids:toNotify, message_override:msgNotif, type_envoi:'disponibilites' },
        }),
      })
    } catch(e) { console.error('n8n notif',e) }
    setCiblages(p=>p.map(c=>toNotify.includes(c.id)?{...c,statut:'notifie'}:c))
    setSendingNotif(false)
  }

  // Envoi d'un test de notification (ciblage) à l'admin courant uniquement.
  // Le flag test:true indique à n8n de router vers test_destinataire plutôt
  // que les vrais ciblages. AUCUNE modification de DB (statut des ciblages
  // inchangé) pour qu'on puisse tester plusieurs fois sans effet de bord.
  const sendTestCiblage = async () => {
    if (!depId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Non authentifié'); return }
    const { data: me } = await supabase
      .from('reservistes')
      .select('benevole_id, prenom, nom, email, telephone')
      .eq('user_id', user.id)
      .single()
    if (!me) { alert('Ton profil réserviste est introuvable'); return }
    if (!me.email && !me.telephone) {
      alert('Aucun email ni téléphone dans ton profil — impossible de tester')
      return
    }
    setSendingNotif(true)
    try {
      const res = await fetch('/api/admin/operations/n8n-webhook', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          path: 'riusc-envoi-ciblage-portail',
          payload: {
            test: true,
            test_destinataire: {
              benevole_id: me.benevole_id,
              prenom: me.prenom, nom: me.nom,
              email: me.email, telephone: me.telephone,
            },
            deployment_id: depId,
            message_override: msgNotif,
            type_envoi: 'disponibilites',
          },
        }),
      })
      if (res.ok) {
        alert(`✅ Test envoyé à ${me.email || ''}${me.email && me.telephone ? ' + ' : ''}${me.telephone || ''}.\n\nVérifie ta boîte courriel et tes SMS dans la prochaine minute.`)
      } else {
        alert(`⚠️ n8n a renvoyé un code ${res.status}. Vérifie le workflow.`)
      }
    } catch(e: any) {
      alert('Erreur : ' + (e?.message || 'connexion n8n'))
    }
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
    if (!error && data) { setVagues(p=>[...p,data as unknown as Vague]); setNewVague({date_debut:'',date_fin:'',nb:''}) }
    setSavVague(false)
  }

  const sendMobilisation = async () => {
    if (!depId || !vagues.length) return
    // Guard anti-double-clic : refuse l'envoi si la mobilisation est déjà marquée en DB.
    // Protège contre les reloads, les changements d'admin ou les clics accidentels.
    const dejaMobilise = vagues.some(v => v.statut === 'Mobilisée' || v.statut === 'Confirmée')
    if (dejaMobilise) {
      const ok = confirm('⚠️ La mobilisation semble déjà avoir été envoyée pour ce déploiement (vagues marquées "Mobilisée" en DB).\n\nCliquer OK va RE-envoyer les SMS/courriels via n8n. Les réservistes recevront une deuxième notification.\n\nContinuer quand même ?')
      if (!ok) return
    }
    setSendingMobil(true)
    try {
      await fetch('/api/admin/operations/n8n-webhook', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          path: 'riusc-envoi-mobilisation-portail',
          payload: { deployment_id:depId, vague_ids:vagues.map(v=>v.id), message_override:msgMobil, type_envoi:'mobilisation' },
        }),
      })
      // Persister l'état "mobilisée" au niveau des vagues pour que TOUS les admins
      // voient que la mobilisation a été envoyée. On limite aux vagues encore 'Planifiée'
      // pour ne pas écraser les statuts ultérieurs (En cours, Terminée...).
      await supabase.from('vagues')
        .update({ statut: 'Mobilisée' })
        .eq('deployment_id', depId)
        .eq('statut', 'Planifiée')
      setVagues(prev => prev.map(v => v.statut === 'Planifiée' ? { ...v, statut: 'Mobilisée' } : v))
    } catch(e) { console.error('n8n mobil',e) }
    setMobilSent(true); setSendingMobil(false)
  }

  // Envoi d'un test de mobilisation à l'admin courant uniquement.
  // Même logique que sendTestCiblage : flag test:true + test_destinataire,
  // AUCUNE modification de DB (vagues restent en leur statut actuel).
  const sendTestMobilisation = async () => {
    if (!depId || !vagues.length) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Non authentifié'); return }
    const { data: me } = await supabase
      .from('reservistes')
      .select('benevole_id, prenom, nom, email, telephone')
      .eq('user_id', user.id)
      .single()
    if (!me) { alert('Ton profil réserviste est introuvable'); return }
    if (!me.email && !me.telephone) {
      alert('Aucun email ni téléphone dans ton profil — impossible de tester')
      return
    }
    setSendingMobil(true)
    try {
      const res = await fetch('/api/admin/operations/n8n-webhook', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          path: 'riusc-envoi-mobilisation-portail',
          payload: {
            test: true,
            test_destinataire: {
              benevole_id: me.benevole_id,
              prenom: me.prenom, nom: me.nom,
              email: me.email, telephone: me.telephone,
            },
            deployment_id: depId,
            vague_ids: vagues.map(v => v.id),
            message_override: msgMobil,
            type_envoi: 'mobilisation',
          },
        }),
      })
      if (res.ok) {
        alert(`✅ Test envoyé à ${me.email || ''}${me.email && me.telephone ? ' + ' : ''}${me.telephone || ''}.\n\nVérifie ta boîte courriel et tes SMS dans la prochaine minute.`)
      } else {
        alert(`⚠️ n8n a renvoyé un code ${res.status}. Vérifie le workflow.`)
      }
    } catch(e: any) {
      alert('Erreur : ' + (e?.message || 'connexion n8n'))
    }
    setSendingMobil(false)
  }

  // ── Données dérivées ────────────────────────────────────────────────────────
  const uniqueDates = selDep?.date_debut && selDep?.date_fin
    ? (() => {
        const dates: string[] = []
        const d = new Date(selDep.date_debut + 'T00:00:00')
        const end = new Date(selDep.date_fin + 'T00:00:00')
        while (d <= end) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }
        return dates
      })()
    : [...new Set(dispos.map(d => d.date_jour))].sort()
  const nbReponses  = [...new Set(dispos.map(d=>d.benevole_id))].length

  // ── Rendu ────────────────────────────────────────────────────────────────────
  return (
    <div>

      <button
        onClick={() => {
          if (!fullscreen) { document.documentElement.requestFullscreen?.().catch(()=>{}) }
          else { document.exitFullscreen?.().catch(()=>{}) }
          setFullscreen(f => !f)
        }}
        title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        style={{
          position:'fixed', top:fullscreen ? 12 : 72, right:16, zIndex:9999,
          width:36, height:36, borderRadius:8,
          backgroundColor:'white', border:'1px solid #e5e7eb',
          boxShadow:'0 2px 6px rgba(0,0,0,0.1)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:16, color:'#1e3a5f',
        }}
      >
        {fullscreen ? '⤓' : '⤢'}
      </button>

      <div style={{ display:'flex', alignItems:'flex-start', maxWidth: fullscreen ? '100%' : 1200, margin:'0 auto', padding: fullscreen ? '12px 16px 40px' : '24px 16px 80px', gap:24 }}>

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
            {/* Partage : copie l'URL avec sin/dems/dep pour que les autres admins
                ouvrent exactement le même contexte d'opération */}
            {(sinId || depId) && (
              <button
                onClick={async () => {
                  try {
                    const p = new URLSearchParams()
                    if (sinId)         p.set('sin',  sinId)
                    if (depId)         p.set('dep',  depId)
                    if (demIds.length) p.set('dems', demIds.join(','))
                    const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`
                    await navigator.clipboard.writeText(url)
                    const btn = document.activeElement as HTMLButtonElement | null
                    if (btn) {
                      const orig = btn.innerText
                      btn.innerText = '✓ Lien copié'
                      setTimeout(() => { btn.innerText = orig }, 1800)
                    }
                  } catch (e) {
                    alert('Impossible de copier le lien — copiez l\'URL depuis la barre d\'adresse.')
                  }
                }}
                title="Copie l'URL de cette opération pour la partager avec un autre admin"
                style={{
                  marginTop:10, width:'100%', padding:'7px 10px', fontSize:11, fontWeight:600,
                  borderRadius:6, border:'1px solid #c7d2fe', backgroundColor:'#eef2ff',
                  color:'#4338ca', cursor:'pointer', display:'flex', alignItems:'center',
                  justifyContent:'center', gap:6
                }}
              >
                🔗 Partager le lien
              </button>
            )}
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
              {selSin && hasSavedState && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', backgroundColor:'#fef3c7', borderRadius:8, border:'1px solid #fde68a', fontSize:12 }}>
                  <span style={{ color:'#92400e' }}>💾 Configuration sauvegardée pour ce sinistre restaurée.</span>
                  <button type="button" onClick={resetConfiguration}
                    style={{ marginLeft:'auto', padding:'4px 10px', fontSize:11, border:'1px solid #f59e0b', borderRadius:6, background:'#fff', color:'#92400e', cursor:'pointer', fontWeight:600 }}>
                    🔄 Nouvelle configuration
                  </button>
                </div>
              )}
              {sinistres.map(s => (
                <SelCard key={s.id} selected={sinId===s.id} onClick={()=>{
                  // Change de sinistre: on reset les selections locales, l'effet DB restaurera si un etat existe
                  if (sinId !== s.id) { setDemIds([]); setDepId(null); setMsgNotif('') }
                  setSinId(s.id)
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <span style={{ fontWeight:600, fontSize:13, color:'#1e3a5f' }}>{s.nom}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, backgroundColor:'#d1fae5', color:'#065f46', fontWeight:600 }}>{s.statut}</span>
                      <button onClick={(e) => { e.stopPropagation(); editSinistre(s) }}
                        title="Modifier ce sinistre"
                        style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:6, padding:'2px 6px', cursor:'pointer', fontSize:12, color:'#64748b' }}>
                        ✏️
                      </button>
                    </div>
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
                  <div style={{ fontWeight:600, fontSize:13, color:'#1e3a5f', marginBottom:12 }}>
                    {editingSinId ? '✏️ Modifier le sinistre' : 'Nouveau sinistre'}
                  </div>
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
                      <Btn onClick={creerSinistre} loading={savSin} disabled={!fSin.nom.trim()} color="#1e3a5f">
                        {editingSinId ? '✓ Mettre à jour' : '✓ Créer'}
                      </Btn>
                      <Btn onClick={()=>cancelEdit('sin')} outline color="#6b7280">Annuler</Btn>
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
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                        <span style={{ fontSize:11, padding:'2px 7px', borderRadius:8, backgroundColor:'#f3f4f6', color:'#6b7280' }}>{d.statut}</span>
                        <button onClick={(e) => { e.stopPropagation(); editDemande(d) }}
                          title="Modifier cette demande"
                          style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:6, padding:'2px 6px', cursor:'pointer', fontSize:12, color:'#64748b' }}>
                          ✏️
                        </button>
                      </div>
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
                  <div style={{ fontWeight:600, fontSize:13, color:'#1e3a5f', marginBottom:12 }}>
                    {editingDemId ? '✏️ Modifier la demande' : 'Nouvelle demande'}
                  </div>
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
                      <Btn onClick={creerDemande} loading={savDem} disabled={!fDem.organisme} color="#7c3aed">
                        {editingDemId ? '✓ Mettre à jour' : '✓ Créer la demande'}
                      </Btn>
                      <Btn onClick={()=>cancelEdit('dem')} outline color="#6b7280">Annuler</Btn>
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
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div>
                      <span style={{ fontWeight:700, fontSize:12, color:'#7c3aed' }}>{d.identifiant}</span>
                      <span style={{ fontSize:13, color:'#1e3a5f', marginLeft:8 }}>{d.nom}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, backgroundColor:'#f3f4f6', color:'#6b7280', fontWeight:600 }}>{d.statut}</span>
                      <button onClick={(e) => { e.stopPropagation(); openConfigModal(d) }}
                        title="Configurer (branding, mode dates, heures limite)"
                        style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:6, padding:'2px 6px', cursor:'pointer', fontSize:12, color:'#64748b' }}>
                        ⚙️
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); editDeployment(d) }}
                        title="Modifier ce déploiement"
                        style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:6, padding:'2px 6px', cursor:'pointer', fontSize:12, color:'#64748b' }}>
                        ✏️
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'#64748b', marginTop:3, display:'flex', gap:12, flexWrap:'wrap' }}>
                    {d.lieu && <span>📍 {d.lieu}</span>}
                    {d.date_debut && <span>📅 {dateFr(d.date_debut)}{d.date_fin?` → ${dateFr(d.date_fin)}`:''}</span>}
                    {d.nb_personnes_par_vague && <span>👥 {d.nb_personnes_par_vague}/rotation</span>}
                    {d.point_rassemblement && <span>📌 {d.point_rassemblement}</span>}
                    <span style={{ padding:'1px 6px', borderRadius:4, backgroundColor: (d.branding || 'RIUSC') === 'AQBRS' ? '#ede9fe' : '#dbeafe', color: (d.branding || 'RIUSC') === 'AQBRS' ? '#6d28d9' : '#1d4ed8', fontWeight:600 }}>{d.branding || 'RIUSC'}</span>
                    {d.mode_dates === 'jours_individuels'
                      ? <span style={{ color:'#7c3aed' }}>📆 jours individuels{d.jours_proposes?.length ? ` (${d.jours_proposes.length})` : ''}</span>
                      : <span style={{ color:'#059669' }}>📅 plage continue</span>}
                    <span>⏱️ {d.heures_limite_reponse ?? 8}h pour répondre</span>
                  </div>
                </SelCard>
              ))}
              {showFDep ? (
                <SBox>
                  <div style={{ fontWeight:600, fontSize:13, color:'#1e3a5f', marginBottom:12 }}>
                    {editingDepId ? '✏️ Modifier le déploiement' : 'Nouveau déploiement'}
                    {!editingDepId && demIds.length>0 && <span style={{ fontWeight:400, fontSize:11, color:'#64748b', marginLeft:8 }}>— lié à {demIds.length} demande(s)</span>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <Field label="Nom du déploiement *"><input style={IS} value={fDep.nom} onChange={e=>setFDep(f=>({...f,nom:e.target.value}))} placeholder="ex : Déploiement Gatineau — Digues"/></Field>
                    <div style={G2}>
                      <Field label="Lieu"><input style={IS} value={fDep.lieu} onChange={e=>setFDep(f=>({...f,lieu:e.target.value}))} placeholder="Ville, secteur"/></Field>
                      <Field label="Personnes / rotation"><input type="number" style={IS} value={fDep.nb_personnes_par_vague} onChange={e=>setFDep(f=>({...f,nb_personnes_par_vague:e.target.value}))} placeholder="ex : 8"/></Field>
                    </div>
                    <div style={G2}>
                      <Field label="Date de début">
                        <input type="date" style={IS} value={fDep.date_debut} onChange={e=>{
                          const d = e.target.value
                          setFDep(f => {
                            if (f.duree_preset && f.duree_preset !== 'custom' && d) {
                              const nJ = DUREE_EN_JOURS[f.duree_preset] || 1
                              const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + nJ - 1)
                              return { ...f, date_debut: d, date_fin: dt.toISOString().slice(0,10) }
                            }
                            return { ...f, date_debut: d }
                          })
                        }}/>
                      </Field>
                      <Field label="Durée">
                        <select style={IS} value={fDep.duree_preset} onChange={e=>{
                          const p = e.target.value
                          setFDep(f => {
                            if (p === 'custom' || p === '' || !f.date_debut) return { ...f, duree_preset: p }
                            const nJ = DUREE_EN_JOURS[p] || 1
                            const dt = new Date(f.date_debut + 'T00:00:00'); dt.setDate(dt.getDate() + nJ - 1)
                            return { ...f, duree_preset: p, date_fin: dt.toISOString().slice(0,10) }
                          })
                        }}>
                          <option value="">-- Sélectionner --</option>
                          <option value="24h">24 heures</option>
                          <option value="36h">36 heures</option>
                          <option value="48h">48 heures</option>
                          <option value="3j">3 jours</option>
                          <option value="4j">4 jours</option>
                          <option value="5j">5 jours</option>
                          <option value="6j">6 jours</option>
                          <option value="7j">7 jours</option>
                          <option value="14j">14 jours (max)</option>
                          <option value="custom">Personnalisée</option>
                        </select>
                      </Field>
                    </div>
                    {fDep.duree_preset === 'custom' && (
                      <Field label="Date de fin">
                        <input type="date" style={IS} value={fDep.date_fin} onChange={e=>setFDep(f=>({...f,date_fin:e.target.value}))}/>
                      </Field>
                    )}

                    {/* Note: la config cycle (branding, mode dates, heures limite) est geree via le bouton ⚙️ de la card,
                        pas ici, pour eviter la confusion entre CRUD du deploiement et configuration operationnelle. */}
                    {editingDepId && (
                      <div style={{ backgroundColor:'#fffbeb', border:'1px solid #fde68a', borderRadius:6, padding:'8px 10px', fontSize:12, color:'#92400e' }}>
                        💡 Pour ajuster le branding, le mode de dates ou le délai de réponse, utilise le bouton <strong>⚙️</strong> sur la card du déploiement.
                      </div>
                    )}

                    <Field label="Point de rassemblement"><input style={IS} value={fDep.point_rassemblement} onChange={e=>setFDep(f=>({...f,point_rassemblement:e.target.value}))} placeholder="Adresse de départ"/></Field>
                    <Field label="Notes logistique">
                      <textarea style={{ ...IS, minHeight:60, resize:'vertical', lineHeight:1.5, fontFamily:'inherit', height:'auto' }}
                        value={fDep.notes_logistique} onChange={e=>setFDep(f=>({...f,notes_logistique:e.target.value}))} placeholder="Transport, hébergement, équipement..."/>
                    </Field>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn onClick={creerDeployment} loading={savDep} disabled={!fDep.nom.trim() || (!editingDepId && demIds.length===0)} color="#7c3aed">
                        {editingDepId ? '✓ Mettre à jour' : '✓ Créer le déploiement'}
                      </Btn>
                      <Btn onClick={()=>cancelEdit('dep')} outline color="#6b7280">Annuler</Btn>
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
              {selDep && (() => {
                const branding = selDep.branding || 'RIUSC'
                const heures = selDep.heures_limite_reponse ?? 8
                const mode = selDep.mode_dates === 'jours_individuels' ? 'jours_individuels' : 'plage_continue'
                const limitePreview = new Date(Date.now() + heures * 3600 * 1000).toLocaleString('fr-CA', {
                  timeZone: 'America/Montreal', hour: '2-digit', minute: '2-digit',
                  day: 'numeric', month: 'long',
                })
                return (
                  <div style={{ backgroundColor:'#f0f9ff', borderRadius:8, border:'1px solid #bae6fd', padding:'10px 14px', fontSize:12, color:'#075985' }}>
                    <div style={{ fontWeight:700, marginBottom:4, color:'#0369a1' }}>⚙️ Configuration qui sera appliquée</div>
                    <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                      <span><strong>Branding :</strong> <span style={{ padding:'1px 6px', borderRadius:4, backgroundColor: branding === 'AQBRS' ? '#ede9fe' : '#dbeafe', color: branding === 'AQBRS' ? '#6d28d9' : '#1d4ed8', fontWeight:600 }}>{branding}</span></span>
                      <span><strong>Mode :</strong> {mode === 'jours_individuels' ? `📆 jours individuels (${selDep.jours_proposes?.length ?? 0})` : '📅 plage continue'}</span>
                      <span><strong>Délai :</strong> {heures}h</span>
                      <span><strong>Date limite si envoyé maintenant :</strong> {limitePreview}</span>
                    </div>
                  </div>
                )
              })()}
              <div style={{ backgroundColor:'#fafafa', borderRadius:8, border:'1px solid #e5e7eb', padding:'10px 14px', fontSize:12, color:'#64748b' }}>
                <strong style={{ color:'#1e3a5f' }}>📨 {ciblages.filter(c=>c.statut!=='notifie').length} destinataire(s)</strong>
                {' '}— Envoi via n8n (SMS Twilio + courriel SMTP).
              </div>
              <Field label="Aperçu du message (éditable)">
                <textarea style={TA} value={msgNotif} onChange={e=>setMsgNotif(e.target.value)}/>
                <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selSin || !selDep) return
                      if (msgNotif.trim() && !confirm('Écraser le texte actuel avec le template regénéré depuis la config ?')) return
                      setMsgNotif(tplNotif({
                        sinNom: selSin.nom,
                        depNom: selDep.nom,
                        dateDebut: selDep.date_debut,
                        dateFin: selDep.date_fin,
                        lieu: selDep.lieu,
                        branding: (selDep.branding || 'RIUSC') as 'RIUSC' | 'AQBRS',
                        heuresLimite: selDep.heures_limite_reponse ?? 8,
                        modeDates: (selDep.mode_dates || 'plage_continue') as 'plage_continue' | 'jours_individuels',
                        joursProposes: selDep.jours_proposes,
                        dureeMinRotationJours: 5,
                        deploymentId: selDep.id,
                      }))
                    }}
                    style={{ padding:'4px 10px', fontSize:11, fontWeight:600, borderRadius:6, border:'1px solid #cbd5e1', backgroundColor:'white', color:'#475569', cursor:'pointer' }}>
                    🔄 Regénérer depuis la config
                  </button>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>(utilise ça après avoir changé la config ⚙️, le branding ou les dates)</span>
                </div>
              </Field>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <Btn
                  onClick={() => {
                    const nbCibles = ciblages.filter(c => c.statut !== 'notifie').length
                    const confirme = confirm(`⚠️ Êtes-vous sûr ?\n\nVous êtes sur le point d'envoyer une demande de disponibilités à ${nbCibles} réserviste${nbCibles > 1 ? 's' : ''} (SMS + courriel).\n\nCette action est irréversible — chacun recevra un message immédiatement.\n\nContinuer ?`)
                    if (confirme) sendNotifications()
                  }}
                  disabled={!ciblages.length||ciblages.every(c=>c.statut==='notifie')}
                  loading={sendingNotif}
                  color="#1d4ed8">
                  📨 Envoyer demandes de dispo ({ciblages.filter(c=>c.statut!=='notifie').length})
                </Btn>
                {/* Test : envoi SMS+courriel à l'admin courant uniquement, aucune modif DB */}
                <Btn onClick={sendTestCiblage} disabled={!depId} loading={sendingNotif} outline color="#d97706">
                  🧪 Envoyer un test à moi
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12, minHeight:160 }}>

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

              </div>

              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                {/* Bouton principal : mène à la page de sélection des gens pour la rotation.
                    Toujours cliquable tant qu'il y a des dispos, même si l'étape 6 a déjà
                    été marquée comme validée (vagues créées) — on veut pouvoir revenir
                    modifier la sélection à tout moment. */}
                <Btn
                  onClick={() => { if (depId) router.push(`/admin/operations/disponibilites?dep=${depId}`) }}
                  disabled={dispos.length === 0}
                  color="#1d4ed8"
                >
                  📊 Choisir les personnes à déployer
                </Btn>
                {/* Badge discret qui confirme visuellement l'état de l'étape, sans bloquer
                    l'accès à la page de sélection. */}
                {step6OkDerived && (
                  <span style={{
                    fontSize:12, color:'#065f46', fontWeight:600,
                    padding:'4px 10px', borderRadius:6, backgroundColor:'#d1fae5',
                  }}>
                    ✅ Étape validée
                  </span>
                )}
                {dispos.length === 0 && (
                  <span style={{ fontSize:12, color:'#f59e0b' }}>
                    En attente des réponses des réservistes
                  </span>
                )}
              </div>
            </div>
          </StepCard>

          {/* ─── ÉTAPE 7 : Rotation IA ───────────────────────────────────── */}
          <StepCard id="step-7" n={7} status={ss(7)} title="Rotation créée" ai
            subtitle={vagues.length>0?`${vagues.length} rotation(s) planifiée(s)`:'IA suggère les affectations optimales'}>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Action principale : aller à la page des dispos pour sélectionner les gens */}
              <div style={{
                backgroundColor:'#eff6ff', borderRadius:10, border:'1.5px solid #93c5fd',
                padding:'14px 18px', display:'flex', gap:14, alignItems:'center', flexWrap:'wrap',
              }}>
                <div style={{ flex:1, minWidth:220 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#1e3a5f', marginBottom:3 }}>
                    📊 Voir les disponibilités et sélectionner
                  </div>
                  <div style={{ fontSize:11, color:'#475569', lineHeight:1.5 }}>
                    Ouvre le tableau complet avec la grille des membres, leurs réponses
                    par date et leurs compétences. C'est là que tu coches précisément
                    qui va dans la rotation.
                  </div>
                </div>
                <Btn
                  onClick={() => { if (depId) router.push(`/admin/operations/disponibilites?dep=${depId}`) }}
                  disabled={!depId}
                  color="#1d4ed8"
                >
                  📊 Ouvrir les disponibilités
                </Btn>
              </div>

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
              {vagues.length>0 ? (
                <div style={{ backgroundColor:'#f0fdf4', borderRadius:8, border:'1px solid #bbf7d0', padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#065f46' }}>Rotations créées ({vagues.length})</div>
                    <button onClick={rafraichirVagues} title="Recharger la liste depuis la DB"
                      style={{ fontSize:11, padding:'3px 10px', borderRadius:6, backgroundColor:'white', color:'#065f46', border:'1px solid #a7f3d0', cursor:'pointer', fontWeight:600, flexShrink:0 }}>
                      🔄 Rafraîchir
                    </button>
                  </div>
                  {vagues.map(v=>{
                    const expanded = expandedVagues.has(v.id)
                    const personnes = assignParVague[v.id]
                    return (
                      <div key={v.id} style={{ borderBottom:'1px solid #d1fae5', padding:'4px 0' }}>
                        <button
                          type="button"
                          onClick={() => toggleVagueExpansion(v.id)}
                          style={{
                            display:'flex', alignItems:'center', gap:8, width:'100%',
                            padding:'6px 4px', backgroundColor:'transparent', border:'none',
                            cursor:'pointer', textAlign:'left', fontSize:12, color:'#065f46',
                          }}>
                          <span style={{ fontSize:10, color:'#10b981', display:'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform 0.15s' }}>▶</span>
                          <strong>{v.identifiant||`Rot. #${v.numero}`}</strong>
                          <span>— {dateFr(v.date_debut)} → {dateFr(v.date_fin)}</span>
                          {v.nb_personnes_requis != null && (() => {
                            const assignes = assignParVague[v.id]?.length
                            if (assignes === undefined) {
                              return <span>· {v.nb_personnes_requis} requis</span>
                            }
                            return (
                              <span style={{ color: assignes < v.nb_personnes_requis! ? '#b45309' : '#065f46' }}>
                                · {assignes} / {v.nb_personnes_requis} assigné(s)
                              </span>
                            )
                          })()}
                          {v.statut === 'Terminée' && <span style={{ marginLeft:'auto', padding:'1px 6px', borderRadius:4, backgroundColor:'#e5e7eb', color:'#374151', fontSize:10, fontWeight:600 }}>✓ Terminée</span>}
                        </button>
                        {expanded && (
                          <div style={{ marginLeft:22, marginBottom:8, padding:'8px 12px', backgroundColor:'#ffffff', borderRadius:6, border:'1px solid #d1fae5' }}>
                            {!personnes ? (
                              <div style={{ fontSize:11, color:'#94a3b8', fontStyle:'italic' }}>⏳ Chargement...</div>
                            ) : personnes.length === 0 ? (
                              <div style={{ fontSize:11, color:'#94a3b8' }}>Aucune personne assignée à cette rotation.</div>
                            ) : (
                              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:'#065f46', marginBottom:4 }}>
                                  👥 {personnes.length} personne(s) assignée(s)
                                </div>
                                {personnes.map(p => (
                                  <div key={p.benevole_id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 6px', borderBottom:'1px solid #f0fdf4', fontSize:12 }}>
                                    <span style={{ fontWeight:600, color:'#065f46' }}>{p.prenom} {p.nom}</span>
                                    {p.telephone && <span style={{ color:'#6b7280', fontSize:11 }}>📞 {p.telephone}</span>}
                                    {p.statut_ciblage && (
                                      <span style={{
                                        marginLeft:'auto', fontSize:10, padding:'1px 6px', borderRadius:4, fontWeight:600,
                                        backgroundColor: p.statut_ciblage === 'mobilise' ? '#dcfce7' : p.statut_ciblage === 'confirme' ? '#bbf7d0' : p.statut_ciblage === 'termine' ? '#e5e7eb' : '#dbeafe',
                                        color: p.statut_ciblage === 'mobilise' ? '#166534' : p.statut_ciblage === 'confirme' ? '#15803d' : p.statut_ciblage === 'termine' ? '#374151' : '#1d4ed8',
                                      }}>
                                        {p.statut_ciblage === 'mobilise' ? '🚀 mobilisé' :
                                         p.statut_ciblage === 'confirme' ? '✅ confirmé' :
                                         p.statut_ciblage === 'termine' ? '🏁 terminé' :
                                         '✓ ' + p.statut_ciblage}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding:'10px 14px', display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#94a3b8' }}>Aucune rotation créée pour ce déploiement.</span>
                  <button onClick={rafraichirVagues} title="Recharger depuis la DB au cas où une rotation vient d'être créée"
                    style={{ fontSize:11, padding:'3px 10px', borderRadius:6, backgroundColor:'white', color:'#475569', border:'1px solid #e5e7eb', cursor:'pointer', fontWeight:600 }}>
                    🔄 Rafraîchir
                  </button>
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
            subtitle={mobilSentDerived?'Confirmations envoyées via n8n ✓':'Envoyer les confirmations de mobilisation'}>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {vagues.length>0 && (
                <div style={{ backgroundColor:'#fafafa', borderRadius:8, border:'1px solid #e5e7eb', padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6, flexWrap:'wrap', gap:8 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1e3a5f' }}>Mobilisation pour {vagues.length} rotation(s)</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <button
                        type="button"
                        onClick={demobiliserDeploiement}
                        disabled={demobilisating !== null}
                        title="Passe les réservistes mobilise/confirme → terminé (laisse les notifie actifs)"
                        style={{ padding:'4px 12px', fontSize:11, fontWeight:600, borderRadius:6, border:'1px solid #7c3aed', backgroundColor:'#faf5ff', color:'#6d28d9', cursor: demobilisating !== null ? 'wait' : 'pointer' }}>
                        {demobilisating === 'ALL' ? '⏳' : '🏁 Démobiliser'}
                      </button>
                      <button
                        type="button"
                        onClick={cloturerDeploiement}
                        disabled={demobilisating !== null}
                        title="Clôture COMPLÈTE: inclut aussi les notifie non-répondants + marque le déploiement Complété"
                        style={{ padding:'4px 12px', fontSize:11, fontWeight:600, borderRadius:6, border:'1px solid #dc2626', backgroundColor:'#fef2f2', color:'#991b1b', cursor: demobilisating !== null ? 'wait' : 'pointer' }}>
                        {demobilisating === 'CLOSE' ? '⏳' : '🔒 Clôturer l\'opération'}
                      </button>
                    </div>
                  </div>
                  {vagues.map(v=>{
                    const enRetard = vagueEstEnRetard(v)
                    const terminee = v.statut === 'Terminée'
                    return (
                      <div key={v.id} style={{ fontSize:12, color:'#334155', display:'flex', alignItems:'center', gap:12, padding:'6px 0', borderBottom:'1px solid #f1f5f9', flexWrap:'wrap' }}>
                        <span style={{ fontWeight:600, color: terminee ? '#6b7280' : '#7c3aed' }}>{v.identifiant||`Rot. #${v.numero}`}</span>
                        <span>📅 {dateFr(v.date_debut)} → {dateFr(v.date_fin)}</span>
                        {v.nb_personnes_requis && <span>👥 {v.nb_personnes_requis} pers.</span>}
                        {terminee && <span style={{ padding:'1px 6px', borderRadius:4, backgroundColor:'#e5e7eb', color:'#374151', fontSize:10, fontWeight:600 }}>✓ Terminée</span>}
                        {!terminee && enRetard && <span style={{ padding:'1px 6px', borderRadius:4, backgroundColor:'#fef3c7', color:'#92400e', fontSize:10, fontWeight:600 }}>⚠️ À démobiliser</span>}
                        {!terminee && (v.statut === 'Mobilisée' || v.statut === 'Confirmée' || enRetard) && (
                          <button
                            type="button"
                            onClick={() => demobiliserVague(v.id, v.identifiant || `Rot. #${v.numero}`)}
                            disabled={demobilisating === v.id}
                            title="Passer tous les réservistes de cette vague au statut terminé"
                            style={{ marginLeft:'auto', padding:'3px 10px', fontSize:11, fontWeight:600, borderRadius:6, border:'1px solid #059669', backgroundColor:'#ecfdf5', color:'#065f46', cursor: demobilisating === v.id ? 'wait' : 'pointer' }}>
                            {demobilisating === v.id ? '⏳' : '🏁 Démobiliser'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {vagues.some(vagueEstEnRetard) && (
                    <div style={{ marginTop:8, padding:'8px 12px', backgroundColor:'#fffbeb', border:'1px solid #fde68a', borderRadius:6, fontSize:12, color:'#92400e' }}>
                      💡 Une ou plusieurs rotations sont terminées depuis plus de 24h. Clique <strong>🏁 Démobiliser</strong> pour retirer le déploiement de leurs mobilisations actives.
                    </div>
                  )}
                </div>
              )}
              <Field label="Aperçu du message de mobilisation (éditable)">
                <textarea style={TA} value={msgMobil} onChange={e=>setMsgMobil(e.target.value)}/>
                <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selDep) return
                      if (msgMobil.trim() && !confirm('Écraser le texte actuel avec le template regénéré depuis la config ?')) return
                      const v = vagues[0]
                      setMsgMobil(tplMobil({
                        depNom: selDep.nom,
                        vagNom: v ? (v.identifiant || `Rotation #${v.numero}`) : '[rotation à définir]',
                        debut: v?.date_debut || '[date début]',
                        fin: v?.date_fin || '[date fin]',
                        lieu: selDep.lieu,
                        branding: (selDep.branding || 'RIUSC') as 'RIUSC' | 'AQBRS',
                      }))
                    }}
                    style={{ padding:'4px 10px', fontSize:11, fontWeight:600, borderRadius:6, border:'1px solid #cbd5e1', backgroundColor:'white', color:'#475569', cursor:'pointer' }}>
                    🔄 Regénérer depuis les données
                  </button>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>(utilise ça si tu as édité le déploiement/sinistre après)</span>
                </div>
                <div style={{ fontSize:11, color:'#64748b', marginTop:8, lineHeight:1.5 }}>
                  💡 Astuce : pour envoyer un texte <strong>SMS différent</strong> du courriel, encadre-le avec :
                  <code style={{ backgroundColor:'#eef2ff', padding:'1px 5px', borderRadius:4, margin:'0 3px' }}>---SMS---</code>
                  au début et
                  <code style={{ backgroundColor:'#eef2ff', padding:'1px 5px', borderRadius:4, margin:'0 3px' }}>---FIN---</code>
                  à la fin.
                  Le bloc SMS sera envoyé par texto (max 160&nbsp;car.), retiré du courriel, et le reste ira uniquement par courriel.
                </div>
              </Field>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <Btn onClick={sendMobilisation} disabled={vagues.length===0||mobilSentDerived} loading={sendingMobil} color="#065f46">
                  {mobilSentDerived?'✅ Mobilisation envoyée':'🚀 Envoyer via n8n'}
                </Btn>
                {/* Test : envoi SMS+courriel à l'admin courant uniquement, aucune modif DB */}
                <Btn onClick={sendTestMobilisation} disabled={vagues.length===0} loading={sendingMobil} outline color="#d97706">
                  🧪 Envoyer un test à moi
                </Btn>
                {vagues.length===0 && <span style={{ fontSize:12, color:'#f59e0b' }}>Créez d'abord les rotations à l'étape 7</span>}
              </div>
              {mobilSentDerived && (
                <div style={{ backgroundColor:'#d1fae5', borderRadius:8, border:'1px solid #6ee7b7', padding:'12px 16px', fontSize:13, color:'#065f46', fontWeight:600 }}>
                  🎉 Opération complète — La mobilisation est confirmée et les notifications ont été envoyées via n8n.
                </div>
              )}
            </div>
          </StepCard>

        </div>{/* fin contenu principal */}
      </div>{/* fin flex deux colonnes */}

      {/* ─── Modal de configuration du déploiement ───────────────────────── */}
      {configDepId && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => { if (!savConfig) setConfigDepId(null) }}
          style={{
            position:'fixed', inset:0, backgroundColor:'rgba(15,23,42,0.55)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor:'#fff', borderRadius:12, padding:24, width:'100%', maxWidth:540,
            boxShadow:'0 20px 50px -10px rgba(0,0,0,0.3)', maxHeight:'90vh', overflowY:'auto',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <span style={{ fontSize:20 }}>⚙️</span>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'#1e3a5f' }}>Configuration du déploiement</div>
                {(() => {
                  const d = deployments.find(x => x.id === configDepId)
                  return d ? <div style={{ fontSize:12, color:'#64748b' }}>{d.identifiant} · {d.nom}</div> : null
                })()}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Branding */}
              <Field label="Branding des communications">
                <div style={{ display:'flex', gap:10 }}>
                  {(['RIUSC', 'AQBRS'] as const).map(b => (
                    <label key={b} style={{
                      display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                      padding:'10px 14px', borderRadius:8, flex:1,
                      border: fConfig.branding === b ? '2px solid #1e3a5f' : '1.5px solid #e5e7eb',
                      backgroundColor: fConfig.branding === b ? '#eff6ff' : '#fff',
                    }}>
                      <input type="radio" name="config_branding" value={b}
                        checked={fConfig.branding === b}
                        onChange={() => setFConfig(f => ({ ...f, branding: b }))} />
                      <img src={`/logo-${b.toLowerCase()}.png`} alt={`Logo ${b}`} style={{ height:32, width:'auto' }} />
                      <span style={{ fontWeight:600, fontSize:13, color:'#1e3a5f' }}>{b}</span>
                    </label>
                  ))}
                </div>
              </Field>

              {/* Mode dates */}
              <Field label="Mode de dates pour les réservistes">
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'8px 12px', borderRadius:6, border: fConfig.mode_dates === 'plage_continue' ? '1.5px solid #059669' : '1px solid #e5e7eb', backgroundColor: fConfig.mode_dates === 'plage_continue' ? '#ecfdf5' : '#fff' }}>
                    <input type="radio" name="config_mode" value="plage_continue"
                      checked={fConfig.mode_dates === 'plage_continue'}
                      onChange={() => setFConfig(f => ({ ...f, mode_dates: 'plage_continue' }))} />
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>📅 Plage continue</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>Tout ou rien: le réserviste accepte toutes les dates du déploiement ou refuse.</div>
                    </div>
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'8px 12px', borderRadius:6, border: fConfig.mode_dates === 'jours_individuels' ? '1.5px solid #7c3aed' : '1px solid #e5e7eb', backgroundColor: fConfig.mode_dates === 'jours_individuels' ? '#faf5ff' : '#fff' }}>
                    <input type="radio" name="config_mode" value="jours_individuels"
                      checked={fConfig.mode_dates === 'jours_individuels'}
                      onChange={() => setFConfig(f => ({ ...f, mode_dates: 'jours_individuels' }))} />
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>📆 Jours individuels</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>Le réserviste coche les jours qui lui conviennent (ex: 19 et 21 sans le 20).</div>
                    </div>
                  </label>
                </div>
              </Field>

              {/* Jours proposes (si jours_individuels) */}
              {fConfig.mode_dates === 'jours_individuels' && (
                <Field label="Jours proposés aux réservistes">
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {(fConfig.jours_proposes.length > 0 ? fConfig.jours_proposes : ['']).map((jour, idx) => (
                      <div key={idx} style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="date" style={{ ...IS, flex:1 }} value={jour}
                          onChange={e => setFConfig(f => {
                            const base = f.jours_proposes.length > 0 ? f.jours_proposes : ['']
                            const arr = [...base]
                            arr[idx] = e.target.value
                            return { ...f, jours_proposes: arr }
                          })} />
                        <button type="button" onClick={() => setFConfig(f => ({
                          ...f,
                          jours_proposes: f.jours_proposes.filter((_, i) => i !== idx),
                        }))} style={{ padding:'4px 10px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:6, background:'#fff', cursor:'pointer', color:'#ef4444' }}>✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setFConfig(f => ({
                      ...f,
                      jours_proposes: [...(f.jours_proposes.length > 0 ? f.jours_proposes : ['']), ''],
                    }))} style={{ alignSelf:'flex-start', padding:'4px 10px', fontSize:12, border:'1px dashed #cbd5e1', borderRadius:6, background:'#fff', cursor:'pointer', color:'#475569' }}>+ Ajouter un jour</button>
                  </div>
                </Field>
              )}

              {/* Heures limite */}
              <Field label="Délai de réponse (heures)">
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="number" min="1" max="168" style={{ ...IS, width:80 }}
                    value={fConfig.heures_limite_reponse}
                    onChange={e => setFConfig(f => ({ ...f, heures_limite_reponse: e.target.value }))} />
                  <span style={{ fontSize:12, color:'#64748b' }}>
                    heures après l'envoi de la notification. Défaut : 8h. La date limite exacte sera calculée au moment de l'envoi (étape 5).
                  </span>
                </div>
              </Field>
            </div>

            {/* Boutons */}
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end', borderTop:'1px solid #e5e7eb', paddingTop:16 }}>
              <Btn onClick={() => setConfigDepId(null)} outline color="#6b7280" disabled={savConfig}>Annuler</Btn>
              <Btn onClick={saveConfig} loading={savConfig} color="#1e3a5f">💾 Enregistrer la config</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
