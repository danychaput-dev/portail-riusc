'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

const C = '#1e3a5f'
const RED = '#dc2626'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'

interface CampOption {
  session_id: string
  camp_nom: string
  camp_dates: string
  camp_lieu: string
}

interface DeploymentOption {
  id: string
  identifiant?: string | null
  nom: string
  lieu?: string | null
  date_debut?: string | null
  date_fin?: string | null
  statut?: string | null
}

interface Approuveur {
  benevole_id: string
  prenom: string
  nom: string
  role: string
}

type ContexteType = 'camp' | 'deploiement'

interface Props {
  onClose: () => void
  onCreated: (url: string, session: any) => void
}

export default function CreateSessionModal({ onClose, onCreated }: Props) {
  const supabase = createClient()

  const [camps, setCamps] = useState<CampOption[]>([])
  const [deployments, setDeployments] = useState<DeploymentOption[]>([])
  const [approuveurs, setApprouveurs] = useState<Approuveur[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Champs formulaire
  const [typeContexte, setTypeContexte] = useState<ContexteType>('camp')
  const [campSessionId, setCampSessionId] = useState('')
  const [deploymentId, setDeploymentId] = useState('')
  const [titre, setTitre] = useState('')
  const [shift, setShift] = useState<'' | 'jour' | 'nuit' | 'complet'>('')
  const [dateShift, setDateShift] = useState('')
  const [approuveurId, setApprouveurId] = useState('')

  // Charger camps + déploiements + approuveurs
  useEffect(() => {
    ;(async () => {
      setLoadingData(true)
      const [campsRes, depsRes, appsRes] = await Promise.all([
        supabase
          .from('inscriptions_camps')
          .select('session_id, camp_nom, camp_dates, camp_lieu')
          .not('session_id', 'is', null)
          .range(0, 4999),
        // On ne montre que les déploiements actifs/planifiés (pas les Annulé/Terminé)
        supabase
          .from('deployments')
          .select('id, identifiant, nom, lieu, date_debut, date_fin, statut')
          .in('statut', ['Planifié', 'En cours', 'Actif'])
          .order('date_debut', { ascending: false }),
        supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, role')
          .in('role', ['superadmin', 'admin', 'coordonnateur', 'partenaire_lect', 'partenaire'])
          .eq('statut', 'Actif')
          .order('nom'),
      ])

      // Dédupliquer camps par session_id
      const seen = new Set<string>()
      const uniqueCamps = (campsRes.data || []).filter((c: any) => {
        if (seen.has(c.session_id)) return false
        seen.add(c.session_id)
        return true
      }) as CampOption[]
      setCamps(uniqueCamps)
      setDeployments((depsRes.data || []) as DeploymentOption[])
      setApprouveurs((appsRes.data || []) as Approuveur[])
      setLoadingData(false)
    })()
  }, [])

  const selectedCamp = camps.find(c => c.session_id === campSessionId)
  const selectedDep  = deployments.find(d => d.id === deploymentId)

  // Format helper pour les dates de déploiement
  const fmtDate = (iso?: string | null) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  const depDatesText = (d: DeploymentOption) => {
    if (!d.date_debut) return ''
    const debut = fmtDate(d.date_debut)
    const fin   = d.date_fin ? fmtDate(d.date_fin) : null
    return fin && fin !== debut ? `${debut} → ${fin}` : debut
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)

    if (!approuveurId) { setErr('Sélectionne un approuveur'); return }

    // Construire le payload selon le type de contexte
    let payload: Record<string, any>
    if (typeContexte === 'camp') {
      if (!campSessionId) { setErr('Sélectionne un camp'); return }
      if (!selectedCamp)  { setErr('Camp introuvable'); return }
      payload = {
        type_contexte: 'camp',
        session_id: campSessionId,
        contexte_nom: selectedCamp.camp_nom,
        contexte_dates: selectedCamp.camp_dates || null,
        contexte_lieu: selectedCamp.camp_lieu || null,
      }
    } else {
      if (!deploymentId) { setErr('Sélectionne un déploiement'); return }
      if (!selectedDep)  { setErr('Déploiement introuvable'); return }
      // Évite de dupliquer l'identifiant si le nom le contient déjà
      // (ex: nom = "DEP-002 - Construction digue" et identifiant = "DEP-002")
      const ident = selectedDep.identifiant?.trim()
      const nom   = (selectedDep.nom || '').trim()
      const contexte_nom = (ident && !nom.toUpperCase().includes(ident.toUpperCase()))
        ? `${ident} — ${nom}`
        : nom
      payload = {
        type_contexte: 'deploiement',
        session_id: selectedDep.id,
        contexte_nom,
        contexte_dates: depDatesText(selectedDep) || null,
        contexte_lieu: selectedDep.lieu || null,
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/pointage/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          titre: titre.trim() || null,
          shift: shift || null,
          date_shift: dateShift || null,
          approuveur_id: approuveurId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error || 'Erreur création')
        setSubmitting(false)
        return
      }
      // Reset + callback
      onCreated(json.url, json.session)
    } catch (e: any) {
      setErr(e.message || 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C }}>Nouveau QR de présence</h2>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        {loadingData ? (
          <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Chargement…</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Type contexte — camp ou déploiement */}
              <div>
                <label style={labelStyle}>Type de contexte</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setTypeContexte('camp')}
                    style={{
                      ...typeBtn,
                      cursor: 'pointer',
                      borderColor: typeContexte === 'camp' ? C : BORDER,
                      backgroundColor: typeContexte === 'camp' ? '#eff6ff' : 'white',
                      color: typeContexte === 'camp' ? C : MUTED,
                    }}
                  >
                    🏕️ Camp de qualification
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeContexte('deploiement')}
                    style={{
                      ...typeBtn,
                      cursor: 'pointer',
                      borderColor: typeContexte === 'deploiement' ? RED : BORDER,
                      backgroundColor: typeContexte === 'deploiement' ? '#fef2f2' : 'white',
                      color: typeContexte === 'deploiement' ? RED : MUTED,
                    }}
                  >
                    🚨 Déploiement
                  </button>
                </div>
              </div>

              {/* Camp ou Déploiement — rendu conditionnel selon le type */}
              {typeContexte === 'camp' ? (
                <div>
                  <label style={labelStyle}>Camp *</label>
                  <select
                    value={campSessionId}
                    onChange={e => setCampSessionId(e.target.value)}
                    style={inputStyle}
                    required
                  >
                    <option value="">— Choisir un camp —</option>
                    {camps.map(c => (
                      <option key={c.session_id} value={c.session_id}>
                        {c.camp_nom}{c.camp_dates ? ` — ${c.camp_dates}` : ''}{c.camp_lieu ? ` (${c.camp_lieu})` : ''}
                      </option>
                    ))}
                  </select>
                  {camps.length === 0 && (
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Aucun camp trouvé dans inscriptions_camps.</div>
                  )}
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Déploiement *</label>
                  <select
                    value={deploymentId}
                    onChange={e => setDeploymentId(e.target.value)}
                    style={inputStyle}
                    required
                  >
                    <option value="">— Choisir un déploiement —</option>
                    {deployments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.identifiant ? `${d.identifiant} — ` : ''}{d.nom}
                        {d.lieu ? ` (${d.lieu})` : ''}
                        {d.date_debut ? ` · ${depDatesText(d)}` : ''}
                      </option>
                    ))}
                  </select>
                  {deployments.length === 0 && (
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                      Aucun déploiement actif. Crée-en un via /admin/operations.
                    </div>
                  )}
                </div>
              )}

              {/* Titre libre — permet plusieurs QR par camp/shift/date */}
              <div>
                <label style={labelStyle}>Titre du QR (optionnel)</label>
                <input
                  type="text"
                  value={titre}
                  onChange={e => setTitre(e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: Équipe Alpha, Chef Marc, Zone Nord…"
                  maxLength={80}
                />
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                  Sert à distinguer plusieurs QR d'un même contexte/shift/date (ex: un QR par équipe ou par chef). Sera affiché au-dessus du QR à l'impression.
                </div>
              </div>

              {/* Shift + Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Shift</label>
                  <select
                    value={shift}
                    onChange={e => setShift(e.target.value as any)}
                    style={inputStyle}
                  >
                    <option value="">Aucun (QR unique pour le camp)</option>
                    <option value="jour">☀️ Jour</option>
                    <option value="nuit">🌙 Nuit</option>
                    <option value="complet">🕐 Complet (24h)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input
                    type="date"
                    value={dateShift}
                    onChange={e => setDateShift(e.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Vide = valide pour toute la durée du camp.</div>
                </div>
              </div>

              {/* Approuveur */}
              <div>
                <label style={labelStyle}>Approuveur *</label>
                <select
                  value={approuveurId}
                  onChange={e => setApprouveurId(e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">— Choisir un approuveur —</option>
                  {approuveurs.map(a => (
                    <option key={a.benevole_id} value={a.benevole_id}>
                      {a.prenom} {a.nom} · {a.role}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                  La personne qui pourra valider/contester les pointages. Admin, coordonnateur ou partenaire.
                </div>
              </div>

              {err && (
                <div style={{ padding: 10, borderRadius: 6, backgroundColor: '#fef2f2', color: RED, fontSize: 13 }}>
                  {err}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={onClose}
                  style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, backgroundColor: 'white', color: MUTED, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, backgroundColor: submitting ? '#9ca3af' : C, color: 'white', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? 'Création…' : '✓ Créer le QR'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
}

const modalStyle: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: 12, padding: 24,
  width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
}

const closeBtn: React.CSSProperties = {
  marginLeft: 'auto', background: 'none', border: 'none',
  fontSize: 28, cursor: 'pointer', color: MUTED, lineHeight: 1,
  padding: 0, width: 32, height: 32,
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: MUTED,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: `1px solid ${BORDER}`, borderRadius: 8,
  outline: 'none', color: '#1e293b', backgroundColor: 'white',
}

const typeBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  border: `1.5px solid ${BORDER}`, backgroundColor: 'white', color: MUTED,
  flex: 1, textAlign: 'center',
}
