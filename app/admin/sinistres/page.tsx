'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatPhone } from '@/utils/phone'
import type { Sinistre, Demande, Deployment, Vague as Rotation } from '@/types'
import {
  TYPES_INCIDENT, ORGANISMES,
  STATUTS_SINISTRE, STATUTS_DEMANDE, PRIORITES, STATUTS_DEPLOIEMENT, STATUTS_ROTATION,
  STATUT_COLORS, PRIORITE_COLORS,
  orgAbbr, dateCourtFr, slugCourt,
  genNomSinistre, genNomDemande, genNomDeployment, genNomRotation,
  previewDemande, previewDeployment, getMissions,
} from '@/types/constants'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Badge({ label }: { label: string }) {
  const c = STATUT_COLORS[label] || { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' }
  return (
    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function inputStyle(small = false): React.CSSProperties {
  return { width: '100%', padding: small ? '5px 8px' : '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: small ? '12px' : '13px', outline: 'none', boxSizing: 'border-box' }
}

function labelStyle(): React.CSSProperties {
  return { display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px', fontWeight: '600' }
}

// ─── Formulaire déploiement ──────────────────────────────────────────────────

const DEPLOYMENT_VIDE = { nom: '', lieu: '', date_debut: '', date_fin: '', nb_personnes_par_vague: '', statut: 'Planifié', point_rassemblement: '', transport: '', hebergement: '', notes_logistique: '', demandes_ids: [] as string[] }

function FormDeployment({ initial, onSave, onCancel, saving, nextIdentifiant, demandesDisponibles }: {
  initial: typeof DEPLOYMENT_VIDE
  onSave: (data: typeof DEPLOYMENT_VIDE) => void
  onCancel: () => void
  saving: boolean
  nextIdentifiant: string
  demandesDisponibles: { id: string; label: string }[]
}) {
  const [form, setForm] = useState(initial)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Auto-générer le nom depuis le preview identifiant
  useEffect(() => {
    const demandesSelectionnees = demandesDisponibles
      .filter(d => form.demandes_ids.includes(d.id))
      .map(d => ({ organisme: d.label.split(' — ')[0], type_mission: d.label.split(' — ')[1] }))
    const preview = previewDeployment(demandesSelectionnees, form.lieu)
    if (preview !== '— sélectionner les demandes —') {
      setForm(f => ({ ...f, nom: preview }))
    }
  }, [form.demandes_ids, form.lieu])

  const toggleDemande = (id: string) => setForm(f => ({
    ...f,
    demandes_ids: f.demandes_ids.includes(id) ? f.demandes_ids.filter(d => d !== id) : [...f.demandes_ids, id]
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600' }}>IDENTIFIANT AUTO : {nextIdentifiant}</div>

      {/* Demandes liées */}
      {demandesDisponibles.length > 1 && (
        <div>
          <label style={labelStyle()}>DEMANDES COUVERTES</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {demandesDisponibles.map(d => (
              <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.demandes_ids.includes(d.id)} onChange={() => toggleDemande(d.id)} />
                {d.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label style={labelStyle()}>IDENTIFIANT <span style={{ fontWeight: 400, color: '#9ca3af' }}>(auto-généré)</span></label>
        <div style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', backgroundColor: '#f3f4f6', color: '#6b7280', fontFamily: 'monospace' }}>
          {previewDeployment(
            demandesDisponibles.filter(d => form.demandes_ids.includes(d.id)).map(d => ({
              organisme: d.label.split(' — ')[0],
              type_mission: d.label.split(' — ')[1]
            })),
            form.lieu
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle()}>STATUT</label>
          <select style={inputStyle(true)} value={form.statut} onChange={e => {
            const newStatut = e.target.value
            setForm(f => ({
              ...f,
              statut: newStatut,
              date_fin: (newStatut === 'Complété' || newStatut === 'Annulé') && !f.date_fin
                ? new Date().toISOString().slice(0, 10) : f.date_fin
            }))
          }}>
            {STATUTS_DEPLOIEMENT.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle()}>NB PERSONNES / ROTATION</label>
          <input type="number" style={inputStyle(true)} value={form.nb_personnes_par_vague} onChange={e => set('nb_personnes_par_vague', e.target.value)} min="1" />
        </div>
      </div>
      <div>
        <label style={labelStyle()}>LIEU</label>
        <input style={inputStyle(true)} value={form.lieu} onChange={e => set('lieu', e.target.value)} placeholder="Adresse ou secteur spécifique" />
      </div>
      <div>
        <label style={labelStyle()}>DATE DÉBUT</label>
        <input type="date" style={inputStyle(true)} value={form.date_debut} onChange={e => set('date_debut', e.target.value)} />
      </div>
      {form.date_fin && (
        <div>
          <label style={labelStyle()}>DATE FIN <span style={{ fontWeight: 400, color: '#059669' }}>(auto-remplie à la fermeture)</span></label>
          <input type="date" style={inputStyle(true)} value={form.date_fin} onChange={e => set('date_fin', e.target.value)} />
        </div>
      )}

      {/* Logistique */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '2px' }}>
        <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', marginBottom: '6px' }}>LOGISTIQUE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelStyle()}>POINT DE RASSEMBLEMENT</label>
            <input style={inputStyle(true)} value={form.point_rassemblement} onChange={e => set('point_rassemblement', e.target.value)} placeholder="ex: Aréna Saint-Laurent" />
          </div>
          <div>
            <label style={labelStyle()}>TRANSPORT</label>
            <input style={inputStyle(true)} value={form.transport} onChange={e => set('transport', e.target.value)} placeholder="ex: Autobus — départ 6h00" />
          </div>
          <div>
            <label style={labelStyle()}>HÉBERGEMENT</label>
            <input style={inputStyle(true)} value={form.hebergement} onChange={e => set('hebergement', e.target.value)} placeholder="ex: École primaire Duplessis" />
          </div>
          <div>
            <label style={labelStyle()}>NOTES</label>
            <input style={inputStyle(true)} value={form.notes_logistique} onChange={e => set('notes_logistique', e.target.value)} placeholder="Informations complémentaires" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '5px 12px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Annuler</button>
        <button onClick={() => (form.nom || form.date_debut) && onSave({ ...form, nom: form.nom || form.date_debut })} disabled={saving || (!form.nom && !form.date_debut)}
          style={{ padding: '5px 12px', backgroundColor: form.nom ? '#1e3a5f' : '#e5e7eb', color: form.nom ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: form.nom ? 'pointer' : 'not-allowed' }}>
          {saving ? '⏳' : '✓ Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

// ─── Formulaire rotation ──────────────────────────────────────────────────────

const ROTATION_VIDE = { date_debut: '', date_fin: '', nb_personnes_requis: '', statut: 'Planifiée' }

function FormRotation({ initial, onSave, onCancel, saving, numero, contextDemandes }: {
  initial: typeof ROTATION_VIDE
  onSave: (data: typeof ROTATION_VIDE) => void
  onCancel: () => void
  saving: boolean
  numero: number
  contextDemandes?: { organisme: string; type_mission?: string }[]
}) {
  const [form, setForm] = useState(initial)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.date_debut && form.date_fin

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600' }}>
        ROTATION #{numero}
        {contextDemandes && form.date_debut && (
          <span style={{ marginLeft: '8px', color: '#d97706' }}>
            → {genNomRotation(contextDemandes, form.date_debut, form.nb_personnes_requis)}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle()}>DATE DÉBUT *</label>
          <input type="date" style={inputStyle(true)} value={form.date_debut} onChange={e => set('date_debut', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle()}>DATE FIN *</label>
          <input type="date" style={inputStyle(true)} value={form.date_fin} onChange={e => set('date_fin', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle()}>NB PERSONNES</label>
          <input type="number" style={inputStyle(true)} value={form.nb_personnes_requis} onChange={e => set('nb_personnes_requis', e.target.value)} min="1" />
        </div>
        <div>
          <label style={labelStyle()}>STATUT</label>
          <select style={inputStyle(true)} value={form.statut} onChange={e => set('statut', e.target.value)}>
            {STATUTS_ROTATION.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '4px 10px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Annuler</button>
        <button onClick={() => valid && onSave(form)} disabled={saving || !valid}
          style={{ padding: '4px 10px', backgroundColor: valid ? '#1e3a5f' : '#e5e7eb', color: valid ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: valid ? 'pointer' : 'not-allowed' }}>
          {saving ? '⏳' : '✓ Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

// ─── Formulaire sinistre ──────────────────────────────────────────────────────

const SINISTRE_VIDE = { nom: '', type_incident: '', lieu: '', date_debut: '', date_fin: '', statut: 'Actif' }

function FormSinistre({ initial, onSave, onCancel, saving }: {
  initial: typeof SINISTRE_VIDE
  onSave: (data: typeof SINISTRE_VIDE) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const [nomManuel, setNomManuel] = useState(!!initial.nom)

  const set = (k: string, v: string) => setForm(f => {
    const updated = { ...f, [k]: v }
    // Auto-générer le nom si pas modifié manuellement
    if (!nomManuel && (k === 'type_incident' || k === 'lieu' || k === 'date_debut')) {
      updated.nom = genNomSinistre(
        k === 'type_incident' ? v : f.type_incident,
        k === 'lieu' ? v : f.lieu,
        k === 'date_debut' ? v : f.date_debut,
      )
    }
    return updated
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <label style={labelStyle()}>NOM DU SINISTRE <span style={{ fontWeight: 400, color: '#9ca3af' }}>(auto-généré)</span></label>
        <div style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', backgroundColor: '#f9fafb', color: form.nom ? '#374151' : '#9ca3af', minHeight: '34px' }}>
          {form.nom || "Remplir type d'incident, lieu et date de début..."}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle()}>TYPE D'INCIDENT</label>
          <select style={inputStyle()} value={form.type_incident} onChange={e => set('type_incident', e.target.value)}>
            <option value="">— Sélectionner —</option>
            {TYPES_INCIDENT.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle()}>STATUT</label>
          <select style={inputStyle()} value={form.statut} onChange={e => {
            const newStatut = e.target.value
            setForm(f => ({
              ...f,
              statut: newStatut,
              date_fin: newStatut === 'Fermé' && !f.date_fin ? new Date().toISOString().slice(0, 10) : f.date_fin
            }))
          }}>
            {STATUTS_SINISTRE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle()}>LIEU</label>
        <input style={inputStyle()} value={form.lieu} onChange={e => set('lieu', e.target.value)} placeholder="ex: Gatineau, QC, Canada" />
      </div>
      <div>
        <label style={labelStyle()}>DATE DÉBUT</label>
        <input type="date" style={inputStyle()} value={form.date_debut} onChange={e => set('date_debut', e.target.value)} />
      </div>
      {form.date_fin && (
        <div>
          <label style={labelStyle()}>DATE FIN <span style={{ fontWeight: 400, color: '#059669' }}>(auto-remplie à la fermeture)</span></label>
          <input type="date" style={inputStyle()} value={form.date_fin} onChange={e => set('date_fin', e.target.value)} />
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button onClick={onCancel} style={{ padding: '7px 16px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#374151' }}>Annuler</button>
        <button onClick={() => (form.nom || form.date_debut) && onSave({ ...form, nom: form.nom || form.date_debut })} disabled={saving || (!form.nom && !form.date_debut)}
          style={{ padding: '7px 16px', backgroundColor: form.nom ? '#1e3a5f' : '#e5e7eb', color: form.nom ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: form.nom ? 'pointer' : 'not-allowed' }}>
          {saving ? '⏳ Sauvegarde...' : '✓ Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

// ─── Formulaire demande ───────────────────────────────────────────────────────

const DEMANDE_VIDE = { organisme: '', organisme_detail: '', type_mission: '', type_mission_detail: '', description: '', lieu: '', nb_personnes_requis: '', date_debut: '', date_fin_estimee: '', priorite: 'Normale', statut: 'Nouvelle', contact_nom: '', contact_titre: '', contact_telephone: '', contact_email: '' }

function FormDemande({ initial, onSave, onCancel, saving }: {
  initial: typeof DEMANDE_VIDE
  onSave: (data: typeof DEMANDE_VIDE) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      <div>
        <label style={labelStyle()}>IDENTIFIANT <span style={{ fontWeight: 400, color: '#9ca3af' }}>(auto-généré)</span></label>
        <div style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', backgroundColor: '#f3f4f6', color: '#6b7280', fontFamily: 'monospace' }}>
          {previewDemande(form.organisme, form.date_debut, form.type_mission)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle()}>ORGANISME *</label>
          <select style={inputStyle(true)} value={form.organisme} onChange={e => { set('organisme', e.target.value); set('organisme_detail', ''); set('type_mission', ''); set('type_mission_detail', '') }}>
            <option value="">— Sélectionner —</option>
            {ORGANISMES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {form.organisme === 'Municipalité' && (
            <input style={{ ...inputStyle(true), marginTop: '5px' }} value={form.organisme_detail} onChange={e => set('organisme_detail', e.target.value)} placeholder="Nom de la municipalité *" />
          )}
          {form.organisme === 'Autre' && (
            <input style={{ ...inputStyle(true), marginTop: '5px' }} value={form.organisme_detail} onChange={e => set('organisme_detail', e.target.value)} placeholder="Préciser l'organisme *" />
          )}
        </div>
        <div>
          <label style={labelStyle()}>TYPE DE MISSION</label>
          <select style={inputStyle(true)} value={form.type_mission} onChange={e => { set('type_mission', e.target.value); set('type_mission_detail', '') }}>
            <option value="">— Sélectionner —</option>
            {getMissions(form.organisme).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {form.type_mission === 'Autre' && (
            <input style={{ ...inputStyle(true), marginTop: '5px' }} value={form.type_mission_detail} onChange={e => set('type_mission_detail', e.target.value)} placeholder="Préciser la mission *" />
          )}
        </div>
      </div>
      <div>
        <label style={labelStyle()}>DESCRIPTION</label>
        <textarea style={{ ...inputStyle(true), resize: 'vertical', minHeight: '60px' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Détails de la demande..." />
      </div>
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '2px' }}>
        <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', marginBottom: '6px' }}>PERSONNE CONTACT</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
          <div>
            <label style={labelStyle()}>NOM</label>
            <input style={inputStyle(true)} value={form.contact_nom} onChange={e => set('contact_nom', e.target.value)} placeholder="Nom complet" />
          </div>
          <div>
            <label style={labelStyle()}>TITRE / FONCTION</label>
            <input style={inputStyle(true)} value={form.contact_titre} onChange={e => set('contact_titre', e.target.value)} placeholder="ex: Directeur urgences" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelStyle()}>TÉLÉPHONE</label>
            <input style={inputStyle(true)} value={form.contact_telephone} onChange={e => set('contact_telephone', formatPhone(e.target.value))} placeholder="(514) 555-0000" />
          </div>
          <div>
            <label style={labelStyle()}>COURRIEL</label>
            <input style={inputStyle(true)} value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="contact@organisme.ca" />
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle()}>LIEU</label>
          <input style={inputStyle(true)} value={form.lieu} onChange={e => set('lieu', e.target.value)} placeholder="Lieu spécifique" />
        </div>
        <div>
          <label style={labelStyle()}>NB PERSONNES</label>
          <input type="number" style={inputStyle(true)} value={form.nb_personnes_requis} onChange={e => set('nb_personnes_requis', e.target.value)} min="1" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle()}>DATE DÉBUT</label>
          <input type="date" style={inputStyle(true)} value={form.date_debut} onChange={e => set('date_debut', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle()}>PRIORITÉ</label>
          <select style={inputStyle(true)} value={form.priorite} onChange={e => set('priorite', e.target.value)}>
            {PRIORITES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle()}>STATUT</label>
          <select style={inputStyle(true)} value={form.statut} onChange={e => {
            const newStatut = e.target.value
            setForm(f => ({
              ...f,
              statut: newStatut,
              date_fin_estimee: (newStatut === 'Complétée' || newStatut === 'Annulée') && !f.date_fin_estimee
                ? new Date().toISOString().slice(0, 10) : f.date_fin_estimee
            }))
          }}>
            {STATUTS_DEMANDE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {form.date_fin_estimee && (
        <div>
          <label style={labelStyle()}>DATE FIN <span style={{ fontWeight: 400, color: '#059669' }}>(auto-remplie à la fermeture)</span></label>
          <input type="date" style={inputStyle(true)} value={form.date_fin_estimee} onChange={e => set('date_fin_estimee', e.target.value)} />
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button onClick={onCancel} style={{ padding: '5px 12px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Annuler</button>
        {(() => {
            const needsDetail = form.organisme === 'Municipalité' || form.organisme === 'Autre'
            const valid = form.organisme && (!needsDetail || form.organisme_detail)
            return (
              <button onClick={() => valid && onSave(form)} disabled={saving || !valid}
                style={{ padding: '5px 12px', backgroundColor: valid ? '#1e3a5f' : '#e5e7eb', color: valid ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: valid ? 'pointer' : 'not-allowed' }}>
                {saving ? '⏳' : '✓ Sauvegarder'}
              </button>
            )
          })()}
        {false && <button onClick={() => form.organisme && onSave(form)} disabled={saving || !form.organisme}
          style={{ padding: '5px 12px', backgroundColor: form.organisme ? '#1e3a5f' : '#e5e7eb', color: form.organisme ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: form.organisme ? 'pointer' : 'not-allowed' }}>
          {saving ? '⏳' : '✓ Sauvegarder'}
        </button>}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AdminSinistresPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [sinistres, setSinistres] = useState<Sinistre[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filtre, setFiltre] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<string>('Actif')
  const [adminBenevoleId, setAdminBenevoleId] = useState('')

  // États formulaires
  const [showFormSinistre, setShowFormSinistre] = useState(false)
  const [editSinistre, setEditSinistre] = useState<Sinistre | null>(null)
  const [savingSinistre, setSavingSinistre] = useState(false)
  const [showFormDemande, setShowFormDemande] = useState(false)
  const [editDemande, setEditDemande] = useState<Demande | null>(null)
  const [savingDemande, setSavingDemande] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'sinistre' | 'demande' | 'deploiement' | 'rotation'; id: string; nom: string } | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // États déploiements et rotations
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [selectedDemandeId, setSelectedDemandeId] = useState<string | null>(null)
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null)
  const [showFormDeployment, setShowFormDeployment] = useState(false)
  const [editDeployment, setEditDeployment] = useState<Deployment | null>(null)
  const [savingDeployment, setSavingDeployment] = useState(false)
  const [showFormRotation, setShowFormRotation] = useState(false)
  const [editRotation, setEditRotation] = useState<Rotation | null>(null)
  const [savingRotation, setSavingRotation] = useState(false)

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3500)
  }

  // ─── Chargement ──────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('benevole_id, role').eq('user_id', user.id).single()
      if (!res || (res.role !== 'admin' && res.role !== 'coordonnateur')) { router.push('/admin'); return }
      setAdminBenevoleId(res.benevole_id)
      await chargerSinistres()
      setLoading(false)
    }
    init()
  }, [])

  const chargerSinistres = async () => {
    const { data: sinData } = await supabase
      .from('sinistres')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: demData } = await supabase
      .from('demandes')
      .select('*')
      .order('date_reception', { ascending: false })

    const enriched = (sinData || []).map(s => ({
      ...s,
      demandes: (demData || []).filter(d => d.sinistre_id === s.id)
    }))
    setSinistres(enriched)
  }

  // ─── Chargement déploiements et rotations ───────────────────────────────────

  const chargerDeployments = async (sinisterId: string) => {
    // Charger tous les déploiements du sinistre via les demandes liées
    const sinistre = sinistres.find(s => s.id === sinisterId)
    const demandeIds = (sinistre?.demandes || []).map(d => d.id)
    if (!demandeIds.length) { setDeployments([]); return }

    // Récupérer les deployment_ids via la table de jonction
    const { data: jonction } = await supabase
      .from('deployments_demandes')
      .select('deployment_id')
      .in('demande_id', demandeIds)
    const depIds = [...new Set((jonction || []).map(j => j.deployment_id))]
    if (!depIds.length) { setDeployments([]); setSelectedDeploymentId(null); setRotations([]); return }

    // Charger les déploiements + leurs demandes liées
    const { data: deps } = await supabase.from('deployments').select('*').in('id', depIds).order('created_at')
    const { data: allJonction } = await supabase.from('deployments_demandes').select('*').in('deployment_id', depIds)

    const enriched = (deps || []).map(dep => ({
      ...dep,
      demandes_ids: (allJonction || []).filter(j => j.deployment_id === dep.id).map(j => j.demande_id)
    }))
    setDeployments(enriched)
    setSelectedDeploymentId(null)
    setRotations([])
  }

  const chargerRotations = async (deploymentId: string) => {
    const { data } = await supabase.from('vagues').select('*').eq('deployment_id', deploymentId).order('numero')
    setRotations(data || [])
  }

  const genererIdentifiant = () => {
    const ts = Date.now().toString().slice(-5)
    return `DEP-${ts}`
  }

  // ─── API calls ────────────────────────────────────────────────────────────

  const apiCall = async (method: string, body: object) => {
    const res = await fetch('/api/admin/sinistres', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, admin_benevole_id: adminBenevoleId }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    return json
  }

  // ─── CRUD Sinistres ───────────────────────────────────────────────────────

  const sauvegarderSinistre = async (form: typeof SINISTRE_VIDE) => {
    setSavingSinistre(true)
    try {
      const payload = {
        nom: form.nom,
        type_incident: form.type_incident || null,
        lieu: form.lieu || null,
        date_debut: form.date_debut || null,
        date_fin: form.date_fin || null,
        statut: form.statut,
      }
      if (editSinistre) {
        await apiCall('PUT', { table: 'sinistres', id: editSinistre.id, payload })
        showMsg('success', 'Sinistre mis à jour')
      } else {
        const { data } = await apiCall('POST', { table: 'sinistres', payload })
        setSelectedId(data.id)
        showMsg('success', 'Sinistre créé')
      }
      await chargerSinistres()
      setShowFormSinistre(false)
      setEditSinistre(null)
    } catch (e: any) {
      showMsg('error', e.message)
    }
    setSavingSinistre(false)
  }

  const supprimerSinistre = async (id: string) => {
    try {
      await apiCall('DELETE', { table: 'sinistres', id })
      setSinistres(prev => prev.filter(s => s.id !== id))
      if (selectedId === id) setSelectedId(null)
      showMsg('success', 'Sinistre supprimé')
    } catch (e: any) {
      showMsg('error', e.message)
    }
    setConfirmDelete(null)
  }

  // ─── CRUD Demandes ────────────────────────────────────────────────────────

  const sauvegarderDemande = async (form: typeof DEMANDE_VIDE) => {
    if (!selectedId) return
    setSavingDemande(true)
    try {
      const payload = {
        sinistre_id: selectedId,
        organisme: form.organisme === 'Municipalité' && form.organisme_detail ? `Municipalité — ${form.organisme_detail}` : form.organisme === 'Autre' && form.organisme_detail ? form.organisme_detail : form.organisme,
        type_mission: form.type_mission === 'Autre' && form.type_mission_detail ? form.type_mission_detail : (form.type_mission || null),
        description: form.description || null,
        lieu: form.lieu || null,
        nb_personnes_requis: form.nb_personnes_requis ? parseInt(form.nb_personnes_requis) : null,
        date_debut: form.date_debut || null,
        date_fin_estimee: form.date_fin_estimee || null,
        priorite: form.priorite,
        statut: form.statut,
        contact_nom: form.contact_nom || null,
        contact_titre: form.contact_titre || null,
        contact_telephone: form.contact_telephone || null,
        contact_email: form.contact_email || null,
      }
      if (editDemande) {
        await apiCall('PUT', { table: 'demandes', id: editDemande.id, payload })
        showMsg('success', 'Demande mise à jour')
      } else {
        await apiCall('POST', { table: 'demandes', payload })
        showMsg('success', 'Demande créée')
      }
      await chargerSinistres()
      setShowFormDemande(false)
      setEditDemande(null)
    } catch (e: any) {
      showMsg('error', e.message)
    }
    setSavingDemande(false)
  }

  const supprimerDemande = async (id: string) => {
    try {
      await apiCall('DELETE', { table: 'demandes', id })
      await chargerSinistres()
      showMsg('success', 'Demande supprimée')
    } catch (e: any) {
      showMsg('error', e.message)
    }
    setConfirmDelete(null)
  }

  // ─── Dérivés ──────────────────────────────────────────────────────────────

  // ─── CRUD Déploiements ───────────────────────────────────────────────────────

  const sauvegarderDeployment = async (form: typeof DEPLOYMENT_VIDE) => {
    setSavingDeployment(true)
    const selectedSinistre = sinistres.find(s => s.id === selectedId)
    const firstDemande = selectedSinistre?.demandes?.find(d => form.demandes_ids.includes(d.id)) || selectedSinistre?.demandes?.[0]
    try {
      const identifiant = editDeployment?.identifiant || genererIdentifiant()
      const payload = {
        identifiant,
        nom: form.nom,
        lieu: form.lieu || null,
        date_debut: form.date_debut || null,
        date_fin: form.date_fin || null,
        nb_personnes_par_vague: form.nb_personnes_par_vague ? parseInt(form.nb_personnes_par_vague) : null,
        statut: form.statut,
        point_rassemblement: form.point_rassemblement || null,
        transport: form.transport || null,
        hebergement: form.hebergement || null,
        notes_logistique: form.notes_logistique || null,
      }
      const context = { demande: firstDemande, sinistre: selectedSinistre }
      let depId = editDeployment?.id
      if (editDeployment) {
        await apiCall('PUT', { table: 'deployments', id: editDeployment.id, payload, context })
      } else {
        const { data } = await apiCall('POST', { table: 'deployments', payload, context })
        depId = data.id
        setSelectedDeploymentId(data.id)
      }
      // Sync table de jonction deployments_demandes
      if (depId) {
        await apiCall('PUT', { table: 'deployments_demandes_sync', id: depId, payload: { demandes_ids: form.demandes_ids.length ? form.demandes_ids : (selectedDemandeId ? [selectedDemandeId] : []) }, context: {} })
      }
      await chargerDeployments(selectedId!)
      setShowFormDeployment(false)
      setEditDeployment(null)
      showMsg('success', editDeployment ? 'Déploiement mis à jour' : 'Déploiement créé')
    } catch (e: any) { showMsg('error', e.message) }
    setSavingDeployment(false)
  }

  const supprimerDeployment = async (id: string) => {
    try {
      await apiCall('DELETE', { table: 'deployments', id })
      setDeployments(prev => prev.filter(d => d.id !== id))
      if (selectedDeploymentId === id) { setSelectedDeploymentId(null); setRotations([]) }
      showMsg('success', 'Déploiement supprimé')
    } catch (e: any) { showMsg('error', e.message) }
    setConfirmDelete(null)
  }

  // ─── CRUD Rotations ───────────────────────────────────────────────────────

  const sauvegarderRotation = async (form: typeof ROTATION_VIDE) => {
    if (!selectedDeploymentId) return
    setSavingRotation(true)
    try {
      const nextNumero = editRotation?.numero || (rotations.length + 1)
      const payload = {
        deployment_id: selectedDeploymentId,
        numero: nextNumero,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        nb_personnes_requis: form.nb_personnes_requis ? parseInt(form.nb_personnes_requis) : null,
        statut: form.statut,
      }
      const rotationContext = {
        deployment: {
          context_org: (selectedDeployment?.demandes_ids || []).map(did => {
            const d = sinistres.find(s => s.id === selectedId)?.demandes?.find(d => d.id === did)
            return d ? orgAbbr(d.organisme) : ''
          }).filter(Boolean).join('+'),
          context_mission: (selectedDeployment?.demandes_ids || []).map(did => {
            const d = sinistres.find(s => s.id === selectedId)?.demandes?.find(d => d.id === did)
            return d?.type_mission?.slice(0, 8) || ''
          }).filter(Boolean).join('/'),
        }
      }
      if (editRotation) {
        await apiCall('PUT', { table: 'vagues', id: editRotation.id, payload })
      } else {
        await apiCall('POST', { table: 'vagues', payload, context: rotationContext })
      }
      await chargerRotations(selectedDeploymentId)
      setShowFormRotation(false)
      setEditRotation(null)
      showMsg('success', editRotation ? 'Rotation mise à jour' : 'Rotation créée')
    } catch (e: any) { showMsg('error', e.message) }
    setSavingRotation(false)
  }

  const supprimerRotation = async (id: string) => {
    try {
      await apiCall('DELETE', { table: 'vagues', id })
      setRotations(prev => prev.filter(r => r.id !== id))
      showMsg('success', 'Rotation supprimée')
    } catch (e: any) { showMsg('error', e.message) }
    setConfirmDelete(null)
  }

  // ─── Dérivés ──────────────────────────────────────────────────────────────

  const selectedDemande = sinistres.find(s => s.id === selectedId)?.demandes?.find(d => d.id === selectedDemandeId)
  const selectedDeployment = deployments.find(d => d.id === selectedDeploymentId)

  const initFormDeployment = (d?: Deployment): typeof DEPLOYMENT_VIDE => d ? {
    nom: d.nom,
    lieu: d.lieu || '',
    date_debut: d.date_debut || '',
    date_fin: d.date_fin || '',
    nb_personnes_par_vague: d.nb_personnes_par_vague?.toString() || '',
    statut: d.statut,
    point_rassemblement: d.point_rassemblement || '',
    transport: d.transport || '',
    hebergement: d.hebergement || '',
    notes_logistique: d.notes_logistique || '',
    demandes_ids: d.demandes_ids || [],
  } : { ...DEPLOYMENT_VIDE, demandes_ids: selectedDemandeId ? [selectedDemandeId] : [] }

  // Demandes disponibles pour le sinistre sélectionné (pour les checkboxes)
  const demandesDisponibles = (sinistres.find(s => s.id === selectedId)?.demandes || []).map(d => ({
    id: d.id,
    label: `${d.organisme}${d.type_mission ? ` — ${d.type_mission}` : ''}`
  }))

  const initFormRotation = (r?: Rotation): typeof ROTATION_VIDE => r ? {
    date_debut: r.date_debut,
    date_fin: r.date_fin,
    nb_personnes_requis: r.nb_personnes_requis?.toString() || '',
    statut: r.statut,
  } : ROTATION_VIDE

  const sinistresFiltrés = sinistres.filter(s => {
    const matchStatut = filtreStatut === 'tous' || s.statut === filtreStatut
    const matchNom = !filtre || s.nom.toLowerCase().includes(filtre.toLowerCase()) || (s.lieu || '').toLowerCase().includes(filtre.toLowerCase())
    return matchStatut && matchNom
  })

  const selected = sinistres.find(s => s.id === selectedId)

  const initFormDemande = (d?: Demande): typeof DEMANDE_VIDE => d ? {
    organisme: d.organisme,
    organisme_detail: d.organisme_detail || '',
    type_mission: d.type_mission || '',
    type_mission_detail: d.type_mission_detail || '',
    description: d.description || '',
    lieu: d.lieu || '',
    nb_personnes_requis: d.nb_personnes_requis?.toString() || '',
    date_debut: d.date_debut || '',
    date_fin_estimee: d.date_fin_estimee || '',
    priorite: d.priorite,
    statut: d.statut,
    contact_nom: d.contact_nom || '',
    contact_titre: d.contact_titre || '',
    contact_telephone: d.contact_telephone || '',
    contact_email: d.contact_email || '',
  } : DEMANDE_VIDE

  const initFormSinistre = (s?: Sinistre): typeof SINISTRE_VIDE => s ? {
    nom: s.nom,
    type_incident: s.type_incident || '',
    lieu: s.lieu || '',
    date_debut: s.date_debut || '',
    date_fin: s.date_fin || '',
    statut: s.statut,
  } : SINISTRE_VIDE

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div><p>Chargement...</p></div>
    </div>
  )

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f', flex: 1 }}>🚨 Sinistres</h1>
          <button
            onClick={() => { setEditSinistre(null); setShowFormSinistre(true) }}
            style={{ padding: '8px 16px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            + Nouveau sinistre
          </button>
        </div>

        {/* Message */}
        {message && (
          <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '8px', backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fca5a5'}`, color: message.type === 'success' ? '#166534' : '#dc2626', fontSize: '13px' }}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        {/* Formulaire nouveau/edit sinistre */}
        {showFormSinistre && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', color: '#1e3a5f' }}>
              {editSinistre ? '✏️ Modifier le sinistre' : '➕ Nouveau sinistre'}
            </h2>
            <FormSinistre
              initial={initFormSinistre(editSinistre || undefined)}
              onSave={sauvegarderSinistre}
              onCancel={() => { setShowFormSinistre(false); setEditSinistre(null) }}
              saving={savingSinistre}
            />
          </div>
        )}

        {/* Layout 2 colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' }}>

          {/* ── Colonne gauche : liste ────────────────────────────────────── */}
          <div>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text" placeholder="🔍 Rechercher..." value={filtre}
                onChange={e => setFiltre(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '13px', outline: 'none' }}
              />
              <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
                style={{ padding: '7px 8px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '12px', outline: 'none' }}>
                <option value="tous">Tous</option>
                {STATUTS_SINISTRE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Liste */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', paddingRight: '2px' }}>
              {sinistresFiltrés.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}>
                  Aucun sinistre
                </div>
              )}
              {sinistresFiltrés.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setShowFormDemande(false); setEditDemande(null); setSelectedDemandeId(null); setSelectedDeploymentId(null); setRotations([]); chargerDeployments(s.id) }}
                  style={{
                    backgroundColor: 'white', borderRadius: '10px',
                    border: `2px solid ${selectedId === s.id ? '#1e3a5f' : '#e5e7eb'}`,
                    padding: '12px 14px', cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    position: 'relative', overflow: 'hidden'
                  }}
                >
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', backgroundColor: STATUT_COLORS[s.statut]?.text || '#6b7280', borderRadius: '10px 0 0 10px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e3a5f', lineHeight: '1.3' }}>{s.nom}</div>
                    <Badge label={s.statut} />
                  </div>
                  {s.type_incident && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>🏷️ {s.type_incident}</div>}
                  {s.lieu && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>📍 {s.lieu}</div>}
                  {s.date_debut && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>📅 {s.date_debut}{s.date_fin ? ` → ${s.date_fin}` : ''}</div>}
                  {(s.demandes?.length || 0) > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#2563eb', fontWeight: '600' }}>
                      📋 {s.demandes!.length} demande{s.demandes!.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Colonne droite : drill-down ───────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {!selected ? (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚨</div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Sélectionnez un sinistre</p>
              </div>
            ) : (
              <>
                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '600', color: '#1e3a5f' }}>{selected.nom}</span>
                  {selectedDemande && <><span>›</span><span style={{ fontWeight: '600', color: '#2563eb', cursor: 'pointer' }} onClick={() => { setSelectedDeploymentId(null); setRotations([]) }}>{selectedDemande.organisme}{selectedDemande.type_mission ? ` — ${selectedDemande.type_mission}` : ''}</span></>}
                  {selectedDeployment && <><span>›</span><span style={{ fontWeight: '600', color: '#7c3aed' }}>{selectedDeployment.identifiant}</span></>}
                </div>

                {/* ── Fiche sinistre ── */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f' }}>{selected.nom}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>
                        {selected.type_incident && `${selected.type_incident} · `}
                        {selected.lieu && `${selected.lieu} · `}
                        {selected.created_at && `Créé le ${new Date(selected.created_at).toLocaleDateString('fr-CA')}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Badge label={selected.statut} />
                      <button onClick={() => { setEditSinistre(selected); setShowFormSinistre(true); window.scrollTo(0, 0) }} style={{ padding: '4px 8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '5px', fontSize: '11px', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => setConfirmDelete({ type: 'sinistre', id: selected.id, nom: selected.nom })} style={{ padding: '4px 8px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '5px', fontSize: '11px', cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </div>
                </div>

                {/* ── Demandes ── */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e3a5f' }}>📋 Demandes ({selected.demandes?.length || 0})</div>
                    <button onClick={() => { setEditDemande(null); setShowFormDemande(true) }} style={{ padding: '4px 10px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>+ Nouvelle</button>
                  </div>
                  {showFormDemande && (
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6' }}>
                      <FormDemande initial={initFormDemande(editDemande || undefined)} onSave={sauvegarderDemande} onCancel={() => { setShowFormDemande(false); setEditDemande(null) }} saving={savingDemande} />
                    </div>
                  )}
                  {(!selected.demandes || selected.demandes.length === 0) && !showFormDemande ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>Aucune demande</div>
                  ) : (
                    selected.demandes?.map(d => (
                      <div key={d.id}
                        onClick={() => { setSelectedDemandeId(d.id === selectedDemandeId ? null : d.id); if (d.id !== selectedDemandeId) { chargerDeployments(selectedId!); setSelectedDeploymentId(null); setRotations([]) } else { setSelectedDeploymentId(null); setRotations([]) } }}
                        style={{ padding: '10px 16px', borderBottom: '1px solid #f9fafb', cursor: 'pointer', backgroundColor: selectedDemandeId === d.id ? '#eff6ff' : 'white', borderLeft: selectedDemandeId === d.id ? '3px solid #2563eb' : '3px solid transparent', transition: 'background 0.1s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e3a5f' }}>{d.organisme}</span>
                            {d.type_mission && <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '6px' }}>— {d.type_mission}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: PRIORITE_COLORS[d.priorite] }}>⚡ {d.priorite}</span>
                            <Badge label={d.statut} />
                            <button onClick={e => { e.stopPropagation(); setEditDemande(d); setShowFormDemande(true) }} style={{ padding: '2px 6px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>✏️</button>
                            <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'demande', id: d.id, nom: `${d.organisme} — ${d.type_mission || d.statut}` }) }} style={{ padding: '2px 6px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>🗑️</button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '3px', flexWrap: 'wrap' }}>
                          {d.nb_personnes_requis && <span style={{ fontSize: '10px', color: '#6b7280' }}>👥 {d.nb_personnes_requis}</span>}
                          {d.lieu && <span style={{ fontSize: '10px', color: '#6b7280' }}>📍 {d.lieu}</span>}
                          {d.date_debut && <span style={{ fontSize: '10px', color: '#6b7280' }}>📅 {d.date_debut}{d.date_fin_estimee ? ` → ${d.date_fin_estimee}` : ''}</span>}
                          {(d.contact_nom || d.contact_telephone) && <span style={{ fontSize: '10px', color: '#6b7280' }}>👤 {d.contact_nom}{d.contact_telephone ? ` · ${d.contact_telephone}` : ''}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ── Déploiements (si demande sélectionnée) ── */}
                {selectedId && (
                  <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '2px solid #ddd6fe', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#faf5ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#7c3aed' }}>🚁 Déploiements ({deployments.length})</div>
                      <button onClick={() => { setEditDeployment(null); setShowFormDeployment(true); if (!deployments.length) chargerDeployments(selectedId!) }} style={{ padding: '4px 10px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>+ Nouveau</button>
                    </div>
                    {showFormDeployment && (
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6' }}>
                        <FormDeployment
                          initial={initFormDeployment(editDeployment || undefined)}
                          onSave={sauvegarderDeployment}
                          onCancel={() => { setShowFormDeployment(false); setEditDeployment(null) }}
                          saving={savingDeployment}
                          nextIdentifiant={genererIdentifiant()}
                          demandesDisponibles={demandesDisponibles}
                        />
                      </div>
                    )}
                    {deployments.length === 0 && !showFormDeployment ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>Aucun déploiement — cliquez "+ Nouveau" pour en créer un</div>
                    ) : (
                      deployments.map(dep => (
                        <div key={dep.id}
                          onClick={() => { setSelectedDeploymentId(dep.id === selectedDeploymentId ? null : dep.id); if (dep.id !== selectedDeploymentId) chargerRotations(dep.id) }}
                          style={{ padding: '10px 16px', borderBottom: '1px solid #f9fafb', cursor: 'pointer', backgroundColor: selectedDeploymentId === dep.id ? '#faf5ff' : 'white', borderLeft: selectedDeploymentId === dep.id ? '3px solid #7c3aed' : '3px solid transparent', transition: 'background 0.1s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <div>
                              <span style={{ fontWeight: '700', fontSize: '12px', color: '#7c3aed' }}>{dep.identifiant}</span>
                              <span style={{ fontSize: '12px', color: '#374151', marginLeft: '6px' }}>{dep.nom}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <Badge label={dep.statut} />
                              <button onClick={e => { e.stopPropagation(); setEditDeployment(dep); setShowFormDeployment(true) }} style={{ padding: '2px 6px', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', color: '#7c3aed', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>✏️</button>
                              <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'deploiement' as any, id: dep.id, nom: dep.nom }) }} style={{ padding: '2px 6px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>🗑️</button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '3px', flexWrap: 'wrap' }}>
                            {dep.lieu && <span style={{ fontSize: '10px', color: '#6b7280' }}>📍 {dep.lieu}</span>}
                            {dep.date_debut && <span style={{ fontSize: '10px', color: '#6b7280' }}>📅 {dep.date_debut}{dep.date_fin ? ` → ${dep.date_fin}` : ''}</span>}
                            {dep.nb_personnes_par_vague && <span style={{ fontSize: '10px', color: '#6b7280' }}>👥 {dep.nb_personnes_par_vague}/rotation</span>}
                            {dep.transport && <span style={{ fontSize: '10px', color: '#6b7280' }}>🚌 {dep.transport}</span>}
                            {dep.point_rassemblement && <span style={{ fontSize: '10px', color: '#6b7280' }}>📌 {dep.point_rassemblement}</span>}
                            {dep.demandes_ids && dep.demandes_ids.length > 1 && <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '600' }}>🔗 {dep.demandes_ids.length} demandes</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ── Rotations (si déploiement sélectionné) ── */}
                {selectedDeploymentId && (
                  <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '2px solid #fed7aa', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff7ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#c2410c' }}>🔄 Rotations ({rotations.length})</div>
                      <button onClick={() => { setEditRotation(null); setShowFormRotation(true) }} style={{ padding: '4px 10px', backgroundColor: '#c2410c', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>+ Nouvelle</button>
                    </div>
                    {showFormRotation && (
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6' }}>
                        <FormRotation
                          initial={initFormRotation(editRotation || undefined)}
                          onSave={sauvegarderRotation}
                          onCancel={() => { setShowFormRotation(false); setEditRotation(null) }}
                          saving={savingRotation}
                          numero={editRotation?.numero || rotations.length + 1}
                          contextDemandes={(selectedDeployment?.demandes_ids || []).map(did => {
                            const d = sinistres.find(s => s.id === selectedId)?.demandes?.find(d => d.id === did)
                            return { organisme: d?.organisme || '', type_mission: d?.type_mission }
                          })}
                        />
                      </div>
                    )}
                    {rotations.length === 0 && !showFormRotation ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>Aucune rotation — les rotations seront proposées par l'agent IA</div>
                    ) : (
                      rotations.map(r => (
                        <div key={r.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: '700', fontSize: '12px', color: '#c2410c' }}>{r.identifiant || `Rotation #${r.numero}`}</span>
                            <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>📅 {r.date_debut} → {r.date_fin}</span>
                            {r.nb_personnes_requis && <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>👥 {r.nb_personnes_requis} pers.</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <Badge label={r.statut} />
                            <button onClick={() => { setEditRotation(r); setShowFormRotation(true) }} style={{ padding: '2px 6px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>✏️</button>
                            <button onClick={() => setConfirmDelete({ type: 'rotation' as any, id: r.id, nom: `Rotation #${r.numero}` })} style={{ padding: '2px 6px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>🗑️</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal confirmation suppression */}
        {confirmDelete && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '32px', textAlign: 'center', marginBottom: '12px' }}>⚠️</div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e3a5f', textAlign: 'center', marginBottom: '8px' }}>
                Supprimer ce {confirmDelete.type} ?
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', marginBottom: '20px' }}>
                {confirmDelete.nom}
                {confirmDelete.type === 'sinistre' && <div style={{ marginTop: '6px', color: '#dc2626', fontSize: '12px' }}>⚠️ Les demandes liées seront aussi supprimées</div>}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 20px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
                <button
                  onClick={() => {
                    if (confirmDelete.type === 'sinistre') supprimerSinistre(confirmDelete.id)
                    else if (confirmDelete.type === 'demande') supprimerDemande(confirmDelete.id)
                    else if (confirmDelete.type === 'deploiement') supprimerDeployment(confirmDelete.id)
                    else if (confirmDelete.type === 'rotation') supprimerRotation(confirmDelete.id)
                  }}
                  style={{ padding: '8px 20px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

    </main>
  )
}
