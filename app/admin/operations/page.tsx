'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'

// ─── Types ───────────────────────────────────────────────────────────────────

type StepStatus = 'locked' | 'active' | 'done'

interface Sinistre {
  id: string; nom: string; type_incident?: string; lieu?: string
  date_debut?: string; statut: string
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

// ─── Message templates ───────────────────────────────────────────────────────

function tplNotif(sinistNom: string, depNom: string, dateDebut: string): string {
  return `Bonjour,

Dans le cadre du sinistre « ${sinistNom} », nous sollicitons votre disponibilité pour le déploiement ${depNom}${dateDebut ? ` prévu à partir du ${dateDebut}` : ''}.

Veuillez soumettre vos disponibilités via le portail RIUSC dans les 4 prochains jours :
https://portail.riusc.ca/disponibilites

Merci pour votre engagement.

L'équipe RIUSC / AQBRS`
}

function tplMobil(depNom: string, vagueNom: string, dateDebut: string, dateFin: string, lieu?: string): string {
  return `Bonjour,

Vous êtes officiellement mobilisé(e) pour la rotation ${vagueNom} du ${dateDebut} au ${dateFin} dans le cadre du déploiement ${depNom}.

${lieu ? `Lieu de déploiement : ${lieu}\n` : ''}Veuillez confirmer votre présence via le portail RIUSC :
https://portail.riusc.ca/mobilisation

En cas d'empêchement, contactez-nous immédiatement.

L'équipe RIUSC / AQBRS`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FF = '"Segoe UI", system-ui, -apple-system, sans-serif'

const STEP_LABELS = [
  'Sinistre', 'Déploiement', 'Ciblage',
  'Notification dispos', 'Disponibilités reçues',
  'Rotation créée', 'Mobilisation confirmée',
]
const STEP_SUBS = [
  'Sélectionner ou créer', 'Configurer le déploiement', 'Réservistes ciblés',
  'Aperçu message + envoi', 'Ciblés / Échéancier / Rotation',
  'IA suggère les affectations', 'Confirmer + envoyer',
]

function getC(s: StepStatus, ai = false) {
  if (s === 'done') return { bg: '#d1fae5', br: '#10b981', t: '#065f46', st: '#047857' }
  if (s === 'active') return ai
    ? { bg: '#ede9fe', br: '#8b5cf6', t: '#5b21b6', st: '#7c3aed' }
    : { bg: '#dbeafe', br: '#3b82f6', t: '#1d4ed8', st: '#2563eb' }
  return { bg: '#f9fafb', br: '#e5e7eb', t: '#c9c9c9', st: '#e5e7eb' }
}

function ac(statuses: StepStatus[], i: number): string {
  const s = statuses[i] || 'locked'
  return s === 'done' ? '#10b981' : s === 'active' ? '#3b82f6' : '#d1d5db'
}

function mId(statuses: StepStatus[], i: number): string {
  const c = ac(statuses, i)
  return `url(#am${c === '#10b981' ? 'g' : c === '#3b82f6' ? 'b' : 'n'})`
}

function dateFr(iso?: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─── Wizard SVG ──────────────────────────────────────────────────────────────

function WizardSVG({ statuses, onStep }: { statuses: StepStatus[]; onStep: (n: number) => void }) {
  // Layout constants — viewBox 680 wide
  const CX = 340, BW = 200, BH = 48
  const Y1 = 20
  const Y2 = Y1 + BH + 22          // 90
  const ZY = Y2 + BH + 20          // 158 — zone top
  const BW34 = 155
  const Y34 = ZY + 28              // 186
  const X3 = 170, X4 = 355
  const X3C = X3 + BW34 / 2        // 247.5
  const X4C = X4 + BW34 / 2        // 432.5
  const BEND_Y = ZY + 8            // 166
  const Y5 = Y34 + BH + 24         // 258
  const BW5 = 280, X5 = CX - 140   // 200
  const Y6 = Y5 + BH + 20          // 326
  const BW6 = 240, X6 = CX - 120   // 220
  const ZB = Y6 + BH + 16          // 390 — zone bottom
  const Y7 = ZB + 22               // 412
  const H = Y7 + BH + 40           // 500

  const renderBox = (n: number, x: number, y: number, w: number, ai = false) => {
    const s = statuses[n - 1] || 'locked'
    const c = getC(s, ai)
    const clickable = s !== 'locked'
    return (
      <g
        key={n}
        onClick={() => clickable && onStep(n)}
        style={{ cursor: clickable ? 'pointer' : 'default' }}
      >
        <rect x={x} y={y} width={w} height={BH} rx="8" fill={c.bg} stroke={c.br} strokeWidth="0.8" />
        <text x={x + w / 2} y={y + BH / 2 - 7} textAnchor="middle" dominantBaseline="central"
          fontSize="13" fontWeight="500" fill={c.t} fontFamily={FF}>
          {STEP_LABELS[n - 1]}
        </text>
        <text x={x + w / 2} y={y + BH / 2 + 9} textAnchor="middle" dominantBaseline="central"
          fontSize="11" fill={c.st} fontFamily={FF}>
          {STEP_SUBS[n - 1]}
        </text>
        {s === 'done' && (
          <text x={x + w - 14} y={y + BH / 2} dominantBaseline="central"
            textAnchor="middle" fontSize="12" fill={c.t} fontFamily={FF}>✓</text>
        )}
        {ai && s !== 'locked' && (
          <>
            <rect x={x + w - 42} y={y + 6} width={33} height={16} rx="8" fill="#8b5cf6" opacity="0.9" />
            <text x={x + w - 26} y={y + 14} textAnchor="middle" dominantBaseline="central"
              fontSize="10" fill="#ede9fe" fontWeight="600" fontFamily={FF}>IA ✦</text>
          </>
        )}
      </g>
    )
  }

  return (
    <svg width="100%" viewBox={`0 0 680 ${H}`} style={{ display: 'block' }}>
      <defs>
        {([['n', '#d1d5db'], ['b', '#3b82f6'], ['g', '#10b981']] as [string, string][]).map(([k, col]) => (
          <marker key={k} id={`am${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M2 1L8 5L2 9" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        ))}
      </defs>

      {/* Étape 1 */}
      {renderBox(1, CX - BW / 2, Y1, BW)}
      <line x1={CX} y1={Y1 + BH} x2={CX} y2={Y2 - 2} stroke={ac(statuses, 0)} strokeWidth="1.5" markerEnd={mId(statuses, 0)} />

      {/* Étape 2 */}
      {renderBox(2, CX - BW / 2, Y2, BW)}

      {/* L-flèche 2→3 (bas → gauche → bas dans la zone) */}
      <path
        d={`M${CX},${Y2 + BH} L${CX},${BEND_Y} L${X3C},${BEND_Y} L${X3C},${Y34 - 2}`}
        fill="none" stroke={ac(statuses, 1)} strokeWidth="1.5" markerEnd={mId(statuses, 1)}
      />

      {/* Zone déploiement */}
      <rect x="30" y={ZY} width="620" height={ZB - ZY} rx="12"
        fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="5 3" opacity="0.35" />
      <text x="46" y={ZY + 16} fontSize="11" fill="#3b82f6" fontFamily={FF} opacity="0.8">
        Niveau : par déploiement
      </text>

      {/* Étape 3 */}
      {renderBox(3, X3, Y34, BW34)}

      {/* Flèche horizontale 3→4 */}
      <line x1={X3 + BW34} y1={Y34 + BH / 2} x2={X4 - 2} y2={Y34 + BH / 2}
        stroke={ac(statuses, 2)} strokeWidth="1.5" markerEnd={mId(statuses, 2)} />

      {/* Étape 4 */}
      {renderBox(4, X4, Y34, BW34)}

      {/* L-flèche 4→5 */}
      <path
        d={`M${X4C},${Y34 + BH} L${X4C},${Y5 - 10} L${CX},${Y5 - 10} L${CX},${Y5 - 2}`}
        fill="none" stroke={ac(statuses, 3)} strokeWidth="1.5" markerEnd={mId(statuses, 3)}
      />

      {/* Étape 5 */}
      {renderBox(5, X5, Y5, BW5)}
      <line x1={CX} y1={Y5 + BH} x2={CX} y2={Y6 - 2} stroke={ac(statuses, 4)} strokeWidth="1.5" markerEnd={mId(statuses, 4)} />

      {/* Étape 6 IA */}
      {renderBox(6, X6, Y6, BW6, true)}
      <line x1={CX} y1={Y6 + BH} x2={CX} y2={Y7 - 2} stroke={ac(statuses, 5)} strokeWidth="1.5" markerEnd={mId(statuses, 5)} />

      {/* Étape 7 */}
      {renderBox(7, CX - BW / 2, Y7, BW)}
    </svg>
  )
}

// ─── StepCard ─────────────────────────────────────────────────────────────────

function StepCard({
  id, n, status, title, subtitle, children,
}: {
  id: string; n: number; status: StepStatus; title: string
  subtitle?: string; children?: React.ReactNode
}) {
  const isDone = status === 'done'
  const isActive = status === 'active'
  const isLocked = status === 'locked'
  return (
    <div
      id={id}
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        border: `1.5px solid ${isDone ? '#10b981' : isActive ? '#3b82f6' : '#e5e7eb'}`,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      <div style={{
        padding: '12px 20px',
        backgroundColor: isDone ? '#f0fdf4' : isActive ? '#eff6ff' : '#fafafa',
        borderBottom: `1px solid ${isDone ? '#bbf7d0' : isActive ? '#bfdbfe' : '#f3f4f6'}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          backgroundColor: isDone ? '#10b981' : isActive ? '#3b82f6' : '#e5e7eb',
          color: isLocked ? '#9ca3af' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
        }}>
          {isDone ? '✓' : n}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: isDone ? '#065f46' : isActive ? '#1d4ed8' : '#9ca3af' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: isDone ? '#047857' : isActive ? '#2563eb' : '#d1d5db', marginTop: 1 }}>
              {subtitle}
            </div>
          )}
        </div>
        {isLocked && (
          <span style={{ fontSize: 11, color: '#c4c4c4', fontStyle: 'italic' }}>
            🔒 Étapes précédentes requises
          </span>
        )}
      </div>
      {!isLocked && children && (
        <div style={{ padding: '20px' }}>{children}</div>
      )}
    </div>
  )
}

// ─── Bouton helper ────────────────────────────────────────────────────────────

function Btn({ onClick, disabled, loading, color = '#1e3a5f', children }: {
  onClick: () => void; disabled?: boolean; loading?: boolean; color?: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: '9px 20px', borderRadius: 8, border: 'none',
        backgroundColor: disabled || loading ? '#e5e7eb' : color,
        color: disabled || loading ? '#9ca3af' : 'white',
        fontSize: 13, fontWeight: 600, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {loading ? '⏳ ...' : children}
    </button>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function OperationsPage() {
  const supabase = createClient()
  const router = useRouter()

  // ── Data ──────────────────────────────────────────────────────────────────
  const [sinistres, setSinistres] = useState<Sinistre[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [ciblages, setCiblages] = useState<Ciblage[]>([])
  const [dispos, setDispos] = useState<DispoV2[]>([])
  const [vagues, setVagues] = useState<Vague[]>([])

  // ── Sélection ──────────────────────────────────────────────────────────────
  const [selectedSinistreId, setSelectedSinistreId] = useState<string | null>(null)
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null)

  const selectedSinistre = sinistres.find(s => s.id === selectedSinistreId)
  const selectedDeployment = deployments.find(d => d.id === selectedDeploymentId)

  // ── État des étapes ────────────────────────────────────────────────────────
  const [step5Validated, setStep5Validated] = useState(false)
  const [mobilisationSent, setMobilisationSent] = useState(false)

  // ── Messages ───────────────────────────────────────────────────────────────
  const [msgNotif, setMsgNotif] = useState('')
  const [msgMobil, setMsgMobil] = useState('')

  // ── IA ─────────────────────────────────────────────────────────────────────
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)

  // ── Formulaire vague ───────────────────────────────────────────────────────
  const [newVague, setNewVague] = useState({ date_debut: '', date_fin: '', nb: '' })
  const [savingVague, setSavingVague] = useState(false)

  // ── Loading / sending ──────────────────────────────────────────────────────
  const [sendingNotif, setSendingNotif] = useState(false)
  const [sendingMobil, setSendingMobil] = useState(false)
  const [loadingDeps, setLoadingDeps] = useState(false)

  // ── Logique de complétion des étapes ──────────────────────────────────────

  const stepDone = useCallback((n: number): boolean => {
    switch (n) {
      case 1: return !!selectedSinistreId
      case 2: return !!selectedDeploymentId
      case 3: return ciblages.length > 0
      case 4: return ciblages.some(c => c.statut === 'notifie')
      case 5: return step5Validated
      case 6: return vagues.length > 0
      case 7: return mobilisationSent
      default: return false
    }
  }, [selectedSinistreId, selectedDeploymentId, ciblages, step5Validated, vagues, mobilisationSent])

  const currentStep = useMemo(() => {
    for (let i = 1; i <= 7; i++) {
      if (!stepDone(i)) return i
    }
    return 7
  }, [stepDone])

  const stepStatus = (n: number): StepStatus => {
    if (stepDone(n)) return 'done'
    if (n <= currentStep) return 'active'
    return 'locked'
  }

  const statuses: StepStatus[] = [1, 2, 3, 4, 5, 6, 7].map(n => stepStatus(n))

  // ── Chargement des données ─────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('sinistres')
      .select('*')
      .in('statut', ['Actif', 'En cours'])
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSinistres(data) })
  }, [])

  useEffect(() => {
    if (!selectedSinistreId) { setDeployments([]); return }
    setLoadingDeps(true)
    // Déploiements liés via deployments_demandes → demandes → sinistres
    supabase
      .from('deployments')
      .select(`
        id, identifiant, nom, lieu, date_debut, date_fin,
        nb_personnes_par_vague, statut, point_rassemblement, notes_logistique,
        deployments_demandes ( demandes ( sinistre_id ) )
      `)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          const filtered = data.filter((d: any) =>
            d.deployments_demandes?.some((dd: any) =>
              dd.demandes?.sinistre_id === selectedSinistreId
            )
          )
          setDeployments(filtered)
        }
        setLoadingDeps(false)
      })
  }, [selectedSinistreId])

  useEffect(() => {
    if (!selectedDeploymentId) {
      setCiblages([]); setDispos([]); setVagues([])
      setStep5Validated(false); setMobilisationSent(false); setAiSuggestion(null)
      return
    }
    // Ciblages
    supabase
      .from('ciblages')
      .select('id, benevole_id, statut, reservistes ( prenom, nom, telephone )')
      .eq('niveau', 'deploiement')
      .eq('reference_id', selectedDeploymentId)
      .neq('statut', 'retire')
      .then(({ data }) => { if (data) setCiblages(data as any) })
    // Disponibilités v2
    supabase
      .from('disponibilites_v2')
      .select('id, benevole_id, date_jour, disponible, commentaire, reservistes ( prenom, nom )')
      .eq('deployment_id', selectedDeploymentId)
      .order('date_jour')
      .then(({ data }) => { if (data) setDispos(data as any) })
    // Vagues (= rotations)
    supabase
      .from('vagues')
      .select('*')
      .eq('deployment_id', selectedDeploymentId)
      .order('numero')
      .then(({ data }) => { if (data) setVagues(data) })
  }, [selectedDeploymentId])

  // Mise à jour des templates de message
  useEffect(() => {
    if (!selectedSinistre || !selectedDeployment) return
    setMsgNotif(tplNotif(selectedSinistre.nom, selectedDeployment.nom, selectedDeployment.date_debut || ''))
  }, [selectedSinistre, selectedDeployment])

  useEffect(() => {
    if (!selectedDeployment) return
    const v = vagues[0]
    setMsgMobil(tplMobil(
      selectedDeployment.nom,
      v ? (v.identifiant || `Rotation #${v.numero}`) : '[rotation à définir]',
      v?.date_debut || '[date début]',
      v?.date_fin || '[date fin]',
      selectedDeployment.lieu,
    ))
  }, [selectedDeployment, vagues])

  // ── Actions ───────────────────────────────────────────────────────────────

  const rafraichirCiblages = async () => {
    if (!selectedDeploymentId) return
    const { data } = await supabase
      .from('ciblages')
      .select('id, benevole_id, statut, reservistes ( prenom, nom, telephone )')
      .eq('niveau', 'deploiement')
      .eq('reference_id', selectedDeploymentId)
      .neq('statut', 'retire')
    if (data) setCiblages(data as any)
  }

  const sendNotifications = async () => {
    const nonNotifies = ciblages.filter(c => c.statut !== 'notifie').map(c => c.id)
    if (nonNotifies.length === 0) return
    setSendingNotif(true)
    const { error } = await supabase
      .from('ciblages')
      .update({ statut: 'notifie', updated_at: new Date().toISOString() })
      .in('id', nonNotifies)
    if (!error) {
      setCiblages(prev => prev.map(c =>
        nonNotifies.includes(c.id) ? { ...c, statut: 'notifie' } : c
      ))
      // TODO: appel Edge Function pour envoi SMS/email réel
      // fetch('/api/notifications/dispos', { method:'POST', body: JSON.stringify({ deployment_id: selectedDeploymentId, message: msgNotif }) })
    }
    setSendingNotif(false)
  }

  const getAISuggestion = async () => {
    if (!selectedDeployment) return
    setLoadingAI(true)
    setAiSuggestion(null)
    try {
      const res = await fetch('/api/operations/rotation-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment: selectedDeployment,
          sinistre: selectedSinistre,
          dispos,
          nb_cibles_notifies: ciblages.filter(c => c.statut === 'notifie').length,
        }),
      })
      const data = await res.json()
      setAiSuggestion(data.suggestion || 'Aucune suggestion générée.')

      // Pré-remplir le formulaire si Claude a extrait des dates
      if (data.date_debut) setNewVague(v => ({ ...v, date_debut: data.date_debut }))
      if (data.date_fin) setNewVague(v => ({ ...v, date_fin: data.date_fin }))
      if (data.nb_personnes) setNewVague(v => ({ ...v, nb: String(data.nb_personnes) }))
    } catch {
      setAiSuggestion('Erreur lors de la connexion à Claude. Vérifiez la route /api/operations/rotation-ia.')
    }
    setLoadingAI(false)
  }

  const createVague = async () => {
    if (!selectedDeploymentId || !newVague.date_debut || !newVague.date_fin) return
    setSavingVague(true)
    const num = vagues.length + 1
    const { data, error } = await supabase
      .from('vagues')
      .insert({
        deployment_id: selectedDeploymentId,
        numero: num,
        date_debut: newVague.date_debut,
        date_fin: newVague.date_fin,
        nb_personnes_requis: newVague.nb ? parseInt(newVague.nb) : null,
        statut: 'Planifiée',
        identifiant: `ROT-${num.toString().padStart(2, '0')}`,
      })
      .select()
      .single()
    if (!error && data) {
      setVagues(prev => [...prev, data])
      setNewVague({ date_debut: '', date_fin: '', nb: '' })
    }
    setSavingVague(false)
  }

  const sendMobilisation = async () => {
    if (!selectedDeploymentId || vagues.length === 0) return
    setSendingMobil(true)
    // TODO: insert assignations + call Edge Function pour envoi
    // Exempe d'insertion dans assignations pour chaque confirmé × chaque vague :
    // const confirmés = dispos.filter(d => d.disponible).map(d => d.benevole_id)
    // for (const vagueId of vagues.map(v => v.id)) {
    //   for (const bId of confirmés) {
    //     await supabase.from('assignations').insert({ vague_id: vagueId, benevole_id: bId, ... })
    //   }
    // }
    setMobilisationSent(true)
    setSendingMobil(false)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  // Données pour la vue disponibilités (étape 5)
  const ciblageBenevoleIds = ciblages.map(c => c.benevole_id)
  const disposByBenevole = ciblages.map(c => ({
    ciblage: c,
    dispos: dispos.filter(d => d.benevole_id === c.benevole_id),
    aRepondu: dispos.some(d => d.benevole_id === c.benevole_id),
  }))
  const uniqueDates = [...new Set(dispos.map(d => d.date_jour))].sort()
  const nbReponses = disposByBenevole.filter(x => x.aRepondu).length

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
    fontSize: 13, backgroundColor: 'white', color: '#1e293b',
  }

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    width: '100%', minHeight: 140, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9' }}>
      <PortailHeader />
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>
            Tableau de bord opérationnel
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0' }}>
            Wizard guidé de mobilisation — chaque étape se déverrouille quand la précédente est complétée.
          </p>
        </div>

        {/* Wizard SVG (progress visual) */}
        <div style={{
          backgroundColor: 'white', borderRadius: 14,
          border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 24,
        }}>
          <WizardSVG statuses={statuses} onStep={n => {
            document.getElementById(`step-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }} />
        </div>

        {/* Panneaux des étapes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ──────────────────────── ÉTAPE 1 : Sinistre ──────────────────── */}
          <StepCard
            id="step-1" n={1} status={stepStatus(1)} title="Sinistre"
            subtitle={selectedSinistre ? `${selectedSinistre.nom} — ${selectedSinistre.lieu || ''}` : 'Sélectionner le sinistre actif'}
          >
            {sinistres.length === 0 ? (
              <p style={{ color: '#f59e0b', fontSize: 13 }}>Aucun sinistre actif trouvé dans Supabase.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sinistres.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSinistreId(s.id)}
                    style={{
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${selectedSinistreId === s.id ? '#3b82f6' : '#e5e7eb'}`,
                      backgroundColor: selectedSinistreId === s.id ? '#eff6ff' : 'white',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#1e3a5f' }}>{s.nom}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, backgroundColor: '#d1fae5', color: '#065f46', fontWeight: 600 }}>
                        {s.statut}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {s.type_incident && <span>🔥 {s.type_incident}</span>}
                      {s.lieu && <span>📍 {s.lieu}</span>}
                      {s.date_debut && <span>📅 {dateFr(s.date_debut)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </StepCard>

          {/* ──────────────────────── ÉTAPE 2 : Déploiement ──────────────── */}
          <StepCard
            id="step-2" n={2} status={stepStatus(2)} title="Déploiement"
            subtitle={selectedDeployment ? `${selectedDeployment.identifiant} — ${selectedDeployment.nom}` : 'Sélectionner le déploiement'}
          >
            {loadingDeps ? (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Chargement des déploiements…</p>
            ) : deployments.length === 0 ? (
              <div>
                <p style={{ color: '#94a3b8', fontSize: 13 }}>
                  Aucun déploiement trouvé pour ce sinistre.{' '}
                  <button
                    onClick={() => router.push('/admin/sinistres')}
                    style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}
                  >
                    Créer un déploiement
                  </button>
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {deployments.map(d => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDeploymentId(d.id)}
                    style={{
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${selectedDeploymentId === d.id ? '#7c3aed' : '#e5e7eb'}`,
                      backgroundColor: selectedDeploymentId === d.id ? '#faf5ff' : 'white',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 12, color: '#7c3aed' }}>{d.identifiant}</span>
                        <span style={{ fontSize: 13, color: '#1e3a5f', marginLeft: 8 }}>{d.nom}</span>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: 600 }}>
                        {d.statut}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {d.lieu && <span>📍 {d.lieu}</span>}
                      {d.date_debut && <span>📅 {dateFr(d.date_debut)}{d.date_fin ? ` → ${dateFr(d.date_fin)}` : ''}</span>}
                      {d.nb_personnes_par_vague && <span>👥 {d.nb_personnes_par_vague}/rotation</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </StepCard>

          {/* ──────────────────────── ÉTAPE 3 : Ciblage ──────────────────── */}
          <StepCard
            id="step-3" n={3} status={stepStatus(3)} title="Ciblage"
            subtitle={ciblages.length > 0 ? `${ciblages.length} réserviste(s) ciblé(s)` : 'Aucun ciblage pour ce déploiement'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ciblages.length > 0 ? (
                <div style={{
                  backgroundColor: '#f0fdf4', borderRadius: 8,
                  border: '1px solid #bbf7d0', padding: '10px 14px',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#065f46', marginBottom: 6 }}>
                    ✅ {ciblages.length} réserviste(s) dans le pool de ciblage
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ciblages.slice(0, 12).map(c => (
                      <span key={c.id} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        backgroundColor: c.statut === 'notifie' ? '#dbeafe' : '#f1f5f9',
                        color: c.statut === 'notifie' ? '#1d4ed8' : '#475569',
                        fontWeight: 500,
                      }}>
                        {c.reservistes.prenom} {c.reservistes.nom}
                        {c.statut === 'notifie' && ' ✓'}
                      </span>
                    ))}
                    {ciblages.length > 12 && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>+{ciblages.length - 12} autres</span>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                  Rendez-vous sur la page de ciblage pour ajouter des réservistes à ce déploiement.
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn
                  onClick={() => router.push(`/admin/ciblage?deployment=${selectedDeploymentId}`)}
                  color="#1e3a5f"
                >
                  🎯 Aller au ciblage
                </Btn>
                <Btn onClick={rafraichirCiblages} color="#475569">
                  🔄 Rafraîchir
                </Btn>
              </div>
            </div>
          </StepCard>

          {/* ──────────────────────── ÉTAPE 4 : Notification dispos ─────── */}
          <StepCard
            id="step-4" n={4} status={stepStatus(4)} title="Notification des disponibilités"
            subtitle={ciblages.some(c => c.statut === 'notifie')
              ? `${ciblages.filter(c => c.statut === 'notifie').length}/${ciblages.length} notifié(s)`
              : `${ciblages.length} réserviste(s) à notifier`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                backgroundColor: '#fafafa', borderRadius: 8, border: '1px solid #e5e7eb',
                padding: '10px 14px', fontSize: 12, color: '#64748b',
              }}>
                <strong style={{ color: '#1e3a5f' }}>📨 {ciblages.length} destinataire(s)</strong>
                {' '}— Ce message sera envoyé à tous les réservistes ciblés non encore notifiés.
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Aperçu du message (éditable)
                </label>
                <textarea
                  value={msgNotif}
                  onChange={e => setMsgNotif(e.target.value)}
                  style={textareaStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Btn
                  onClick={sendNotifications}
                  disabled={ciblages.length === 0 || ciblages.every(c => c.statut === 'notifie')}
                  loading={sendingNotif}
                  color="#1d4ed8"
                >
                  📨 Envoyer les notifications ({ciblages.filter(c => c.statut !== 'notifie').length})
                </Btn>
                {ciblages.some(c => c.statut === 'notifie') && (
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                    ✓ {ciblages.filter(c => c.statut === 'notifie').length} déjà notifié(s)
                  </span>
                )}
              </div>
            </div>
          </StepCard>

          {/* ──────────────────────── ÉTAPE 5 : Disponibilités reçues ────── */}
          <StepCard
            id="step-5" n={5} status={stepStatus(5)} title="Disponibilités reçues"
            subtitle={`${nbReponses}/${ciblages.length} réponses reçues`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Vue 3 colonnes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 12, minHeight: 200 }}>

                {/* Col 1 : Ciblés */}
                <div style={{ backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f1f5f9' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Ciblés ({ciblages.length})
                    </div>
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: 300 }}>
                    {disposByBenevole.map(({ ciblage: c, aRepondu }) => (
                      <div key={c.id} style={{
                        padding: '7px 12px', borderBottom: '1px solid #f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                      }}>
                        <span style={{ fontSize: 12, color: '#334155', fontWeight: aRepondu ? 500 : 400 }}>
                          {c.reservistes.prenom} {c.reservistes.nom.charAt(0)}.
                        </span>
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 600,
                          backgroundColor: aRepondu ? '#d1fae5' : '#fef3c7',
                          color: aRepondu ? '#065f46' : '#92400e',
                        }}>
                          {aRepondu ? '✓' : '?'}
                        </span>
                      </div>
                    ))}
                    {ciblages.length === 0 && (
                      <p style={{ padding: 12, fontSize: 12, color: '#94a3b8', margin: 0 }}>Aucun ciblé</p>
                    )}
                  </div>
                </div>

                {/* Col 2 : Échéancier */}
                <div style={{ backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f1f5f9' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Échéancier des dispos
                    </div>
                  </div>
                  {uniqueDates.length === 0 ? (
                    <p style={{ padding: 12, fontSize: 12, color: '#94a3b8', margin: 0 }}>En attente de réponses…</p>
                  ) : (
                    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 300 }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '4px 8px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, backgroundColor: '#f8fafc' }}>
                              Nom
                            </th>
                            {uniqueDates.map(d => (
                              <th key={d} style={{ padding: '4px 6px', textAlign: 'center', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, backgroundColor: '#f8fafc', whiteSpace: 'nowrap' }}>
                                {d.slice(5)} {/* MM-DD */}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ciblages.map(c => {
                            const dispsCiblage = dispos.filter(d => d.benevole_id === c.benevole_id)
                            return (
                              <tr key={c.id}>
                                <td style={{ padding: '4px 8px', color: '#334155', borderBottom: '1px solid #f8fafc', whiteSpace: 'nowrap' }}>
                                  {c.reservistes.prenom.charAt(0)}. {c.reservistes.nom.charAt(0)}.
                                </td>
                                {uniqueDates.map(date => {
                                  const d = dispsCiblage.find(x => x.date_jour === date)
                                  return (
                                    <td key={date} style={{
                                      padding: '4px 6px', textAlign: 'center',
                                      borderBottom: '1px solid #f8fafc',
                                      backgroundColor: !d ? '#f8fafc' : d.disponible ? '#d1fae5' : '#fee2e2',
                                    }}>
                                      <span style={{ fontSize: 12 }}>
                                        {!d ? '·' : d.disponible ? '✓' : '✗'}
                                      </span>
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

                {/* Col 3 : Rotations */}
                <div style={{ backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f1f5f9' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Rotations ({vagues.length})
                    </div>
                  </div>
                  <div style={{ padding: 12 }}>
                    {vagues.length === 0 ? (
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Sera créé à l'étape 6</p>
                    ) : (
                      vagues.map(v => (
                        <div key={v.id} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed' }}>
                            {v.identifiant || `Rotation #${v.numero}`}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {dateFr(v.date_debut)} → {dateFr(v.date_fin)}
                          </div>
                          {v.nb_personnes_requis && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>👥 {v.nb_personnes_requis} pers.</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bouton validation étape 5 */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Btn
                  onClick={() => { setStep5Validated(true) }}
                  disabled={dispos.length === 0 || step5Validated}
                  color="#065f46"
                >
                  {step5Validated ? '✅ Étape validée' : `✅ Valider (${nbReponses} réponse(s) analysées)`}
                </Btn>
                {dispos.length === 0 && (
                  <span style={{ fontSize: 12, color: '#f59e0b' }}>
                    En attente des disponibilités des réservistes
                  </span>
                )}
              </div>
            </div>
          </StepCard>

          {/* ──────────────────────── ÉTAPE 6 : Rotation IA ──────────────── */}
          <StepCard
            id="step-6" n={6} status={stepStatus(6)} title="Rotation créée"
            subtitle={vagues.length > 0 ? `${vagues.length} rotation(s) créée(s)` : 'IA suggère les affectations optimales'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Bouton IA */}
              <div>
                <Btn onClick={getAISuggestion} loading={loadingAI} color="#6d28d9">
                  ✦ Demander une suggestion à Claude
                </Btn>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>
                  Claude analysera les disponibilités et proposera des rotations optimales.
                </p>
              </div>

              {/* Résultat IA */}
              {aiSuggestion && (
                <div style={{
                  backgroundColor: '#faf5ff', borderRadius: 10,
                  border: '1.5px solid #ddd6fe', padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6' }}>✦ Suggestion de Claude</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, backgroundColor: '#8b5cf6', color: 'white', fontWeight: 600 }}>IA</span>
                  </div>
                  <pre style={{
                    fontSize: 12, color: '#4c1d95', margin: 0,
                    whiteSpace: 'pre-wrap', lineHeight: 1.6,
                    fontFamily: 'inherit',
                  }}>
                    {aiSuggestion}
                  </pre>
                </div>
              )}

              {/* Rotations existantes */}
              {vagues.length > 0 && (
                <div style={{ backgroundColor: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', padding: '10px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 8 }}>
                    Rotations créées ({vagues.length})
                  </div>
                  {vagues.map(v => (
                    <div key={v.id} style={{ fontSize: 12, color: '#065f46', marginBottom: 4 }}>
                      <strong>{v.identifiant || `Rot. #${v.numero}`}</strong>
                      {' '}— {dateFr(v.date_debut)} → {dateFr(v.date_fin)}
                      {v.nb_personnes_requis && ` · ${v.nb_personnes_requis} pers.`}
                    </div>
                  ))}
                </div>
              )}

              {/* Formulaire nouvelle rotation */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>
                  {vagues.length > 0 ? '+ Ajouter une rotation' : 'Créer la première rotation'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Début</label>
                    <input type="date" value={newVague.date_debut}
                      onChange={e => setNewVague(v => ({ ...v, date_debut: e.target.value }))}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Fin</label>
                    <input type="date" value={newVague.date_fin}
                      onChange={e => setNewVague(v => ({ ...v, date_fin: e.target.value }))}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Nb pers.</label>
                    <input type="number" value={newVague.nb} placeholder="—"
                      onChange={e => setNewVague(v => ({ ...v, nb: e.target.value }))}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Btn
                    onClick={createVague}
                    disabled={!newVague.date_debut || !newVague.date_fin}
                    loading={savingVague}
                    color="#7c3aed"
                  >
                    + Créer la rotation
                  </Btn>
                </div>
              </div>
            </div>
          </StepCard>

          {/* ──────────────────────── ÉTAPE 7 : Mobilisation ────────────── */}
          <StepCard
            id="step-7" n={7} status={stepStatus(7)} title="Mobilisation confirmée"
            subtitle={mobilisationSent ? 'Confirmations envoyées ✓' : 'Envoyer les confirmations de mobilisation'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Résumé rotations */}
              {vagues.length > 0 && (
                <div style={{ backgroundColor: '#fafafa', borderRadius: 8, border: '1px solid #e5e7eb', padding: '10px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f', marginBottom: 6 }}>
                    Mobilisation pour {vagues.length} rotation(s)
                  </div>
                  {vagues.map(v => (
                    <div key={v.id} style={{
                      fontSize: 12, color: '#334155', display: 'flex', gap: 12,
                      padding: '4px 0', borderBottom: '1px solid #f1f5f9',
                    }}>
                      <span style={{ fontWeight: 600, color: '#7c3aed' }}>{v.identifiant || `Rot. #${v.numero}`}</span>
                      <span>📅 {dateFr(v.date_debut)} → {dateFr(v.date_fin)}</span>
                      {v.nb_personnes_requis && <span>👥 {v.nb_personnes_requis} pers.</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Message mobilisation */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Aperçu du message de mobilisation (éditable)
                </label>
                <textarea
                  value={msgMobil}
                  onChange={e => setMsgMobil(e.target.value)}
                  style={textareaStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Btn
                  onClick={sendMobilisation}
                  disabled={vagues.length === 0 || mobilisationSent}
                  loading={sendingMobil}
                  color="#065f46"
                >
                  {mobilisationSent ? '✅ Mobilisation envoyée' : '🚀 Envoyer les confirmations'}
                </Btn>
                {vagues.length === 0 && (
                  <span style={{ fontSize: 12, color: '#f59e0b' }}>
                    Créez d'abord les rotations à l'étape 6
                  </span>
                )}
              </div>

              {mobilisationSent && (
                <div style={{
                  backgroundColor: '#d1fae5', borderRadius: 8,
                  border: '1px solid #6ee7b7', padding: '12px 16px',
                  fontSize: 13, color: '#065f46', fontWeight: 600,
                }}>
                  🎉 Opération complète — La mobilisation est confirmée et les assignations sont créées.
                </div>
              )}
            </div>
          </StepCard>

        </div>
      </main>
    </div>
  )
}
