'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Sinistre {
  id: string
  monday_id?: string
  nom: string
  type_incident?: string
  lieu?: string
  date_debut?: string
  date_fin?: string
  statut: string
  created_at: string
  updated_at: string
  demandes?: Demande[]
}

interface Demande {
  id: string
  monday_id?: string
  sinistre_id: string
  organisme: string
  type_mission?: string
  description?: string
  lieu?: string
  nb_personnes_requis?: number
  date_debut?: string
  date_fin_estimee?: string
  priorite: string
  statut: string
  date_reception: string
  organisme_detail?: string
  type_mission_detail?: string
  contact_nom?: string
  contact_titre?: string
  contact_telephone?: string
  contact_email?: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TYPES_INCIDENT = [
  'Inondation', 'Incendie', 'Glissement de terrain', 'Vague de froid',
  'Vague de chaleur', 'Tempête', 'Accident industriel', 'Recherche et sauvetage',
  'Vérification de bien-être', 'Évacuation', 'Autre'
]

const ORGANISMES = ['SOPFEU', 'Croix-Rouge', 'Municipalité', 'Autre']

const TYPES_MISSION_SOPFEU = [
  'Construction de digues',
  'Gestion des débris',
  'Logistique terrain',
  'Support opérationnel',
]

const TYPES_MISSION_CROIXROUGE = [
  "Centre de services aux sinistrés",
  "Hébergement d'urgence",
  'Distribution de ressources',
  'Soutien psychosocial',
  'Inscription et référencement',
]

const TYPES_MISSION_AUTRES = [
  'Construction de digues',
  'Gestion des débris',
  "Centre de services aux sinistrés",
  "Hébergement d'urgence",
  'Distribution de ressources',
  'Soutien psychosocial',
  'Recherche et sauvetage',
  'Vérification de bien-être',
  'Logistique',
  'Support opérationnel',
  'Autre',
]

function getMissions(organisme: string): string[] {
  if (organisme === 'SOPFEU') return TYPES_MISSION_SOPFEU
  if (organisme === 'Croix-Rouge') return TYPES_MISSION_CROIXROUGE
  return TYPES_MISSION_AUTRES
}

const TYPES_MISSION = [
  'Construction de digues', 'Gestion des débris', 'Centre de services aux sinistrés',
  'Hébergement d\'urgence', 'Distribution de ressources', 'Soutien psychosocial',
  'Recherche et sauvetage', 'Vérification de bien-être', 'Logistique', 'Autre'
]

const STATUTS_SINISTRE = ['Actif', 'En veille', 'Fermé']
const STATUTS_DEMANDE = ['Nouvelle', 'En traitement', 'Complétée', 'Annulée']
const PRIORITES = ['Urgente', 'Haute', 'Normale', 'Basse']

const STATUT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Actif':        { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  'En veille':    { bg: '#fffbeb', border: '#fcd34d', text: '#d97706' },
  'Fermé':        { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
  'Nouvelle':     { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
  'En traitement':{ bg: '#fffbeb', border: '#fcd34d', text: '#d97706' },
  'Complétée':    { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  'Annulée':      { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
}

const PRIORITE_COLORS: Record<string, string> = {
  'Urgente': '#dc2626', 'Haute': '#d97706', 'Normale': '#2563eb', 'Basse': '#6b7280'
}

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

// ─── Formulaire sinistre ──────────────────────────────────────────────────────

const SINISTRE_VIDE = { nom: '', type_incident: '', lieu: '', date_debut: '', date_fin: '', statut: 'Actif' }

function FormSinistre({ initial, onSave, onCancel, saving }: {
  initial: typeof SINISTRE_VIDE
  onSave: (data: typeof SINISTRE_VIDE) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <label style={labelStyle()}>NOM DU SINISTRE *</label>
        <input style={inputStyle()} value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="ex: Inondation Gatineau — Belle Horizon" />
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
          <select style={inputStyle()} value={form.statut} onChange={e => set('statut', e.target.value)}>
            {STATUTS_SINISTRE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle()}>LIEU</label>
        <input style={inputStyle()} value={form.lieu} onChange={e => set('lieu', e.target.value)} placeholder="ex: Gatineau, QC, Canada" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle()}>DATE DÉBUT</label>
          <input type="date" style={inputStyle()} value={form.date_debut} onChange={e => set('date_debut', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle()}>DATE FIN <span style={{ fontWeight: 400 }}>(opt.)</span></label>
          <input type="date" style={inputStyle()} value={form.date_fin} onChange={e => set('date_fin', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button onClick={onCancel} style={{ padding: '7px 16px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#374151' }}>Annuler</button>
        <button onClick={() => form.nom && onSave(form)} disabled={saving || !form.nom}
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
            <input style={inputStyle(true)} value={form.contact_telephone} onChange={e => set('contact_telephone', e.target.value)} placeholder="514-555-0000" />
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle()}>DATE DÉBUT</label>
          <input type="date" style={inputStyle(true)} value={form.date_debut} onChange={e => set('date_debut', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle()}>DATE FIN EST.</label>
          <input type="date" style={inputStyle(true)} value={form.date_fin_estimee} onChange={e => set('date_fin_estimee', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle()}>PRIORITÉ</label>
          <select style={inputStyle(true)} value={form.priorite} onChange={e => set('priorite', e.target.value)}>
            {PRIORITES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle()}>STATUT</label>
          <select style={inputStyle(true)} value={form.statut} onChange={e => set('statut', e.target.value)}>
            {STATUTS_DEMANDE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
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
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'sinistre' | 'demande'; id: string; nom: string } | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div><p>Chargement...</p></div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>

        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px', padding: 0 }}>← Admin</button>
          <span style={{ color: '#d1d5db' }}>|</span>
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
                  onClick={() => { setSelectedId(s.id); setShowFormDemande(false); setEditDemande(null) }}
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

          {/* ── Colonne droite : détail ───────────────────────────────────── */}
          <div>
            {!selected ? (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚨</div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Sélectionnez un sinistre</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px' }}>Les détails et demandes s'afficheront ici</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Fiche sinistre */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '16px', color: '#1e3a5f' }}>{selected.nom}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        Créé le {new Date(selected.created_at).toLocaleDateString('fr-CA')}
                        {selected.monday_id && <span style={{ marginLeft: '8px', color: '#9ca3af' }}>Monday #{selected.monday_id}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Badge label={selected.statut} />
                      <button
                        onClick={() => { setEditSinistre(selected); setShowFormSinistre(true); window.scrollTo(0, 0) }}
                        style={{ padding: '5px 10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ type: 'sinistre', id: selected.id, nom: selected.nom })}
                        style={{ padding: '5px 10px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {selected.type_incident && <div><div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '600', marginBottom: '2px' }}>TYPE</div><div style={{ fontSize: '13px', color: '#374151' }}>{selected.type_incident}</div></div>}
                    {selected.lieu && <div><div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '600', marginBottom: '2px' }}>LIEU</div><div style={{ fontSize: '13px', color: '#374151' }}>{selected.lieu}</div></div>}
                    {selected.date_debut && <div><div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '600', marginBottom: '2px' }}>PÉRIODE</div><div style={{ fontSize: '13px', color: '#374151' }}>{selected.date_debut}{selected.date_fin ? ` → ${selected.date_fin}` : ''}</div></div>}
                  </div>
                </div>

                {/* Demandes */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f' }}>
                      📋 Demandes d'aide ({selected.demandes?.length || 0})
                    </div>
                    <button
                      onClick={() => { setEditDemande(null); setShowFormDemande(true) }}
                      style={{ padding: '5px 12px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                      + Nouvelle demande
                    </button>
                  </div>

                  {/* Formulaire demande */}
                  {showFormDemande && (
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', marginBottom: '8px' }}>
                        {editDemande ? '✏️ Modifier la demande' : '➕ Nouvelle demande'}
                      </div>
                      <FormDemande
                        initial={initFormDemande(editDemande || undefined)}
                        onSave={sauvegarderDemande}
                        onCancel={() => { setShowFormDemande(false); setEditDemande(null) }}
                        saving={savingDemande}
                      />
                    </div>
                  )}

                  {/* Liste demandes */}
                  {(!selected.demandes || selected.demandes.length === 0) && !showFormDemande ? (
                    <div style={{ padding: '30px 18px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                      Aucune demande — cliquez "+ Nouvelle demande" pour en ajouter une
                    </div>
                  ) : (
                    <div>
                      {selected.demandes?.map(d => (
                        <div key={d.id} style={{ padding: '12px 18px', borderBottom: '1px solid #f9fafb' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e3a5f' }}>{d.organisme}</span>
                              {d.type_mission && <span style={{ fontSize: '12px', color: '#6b7280' }}>— {d.type_mission}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: PRIORITE_COLORS[d.priorite] }}>⚡ {d.priorite}</span>
                              <Badge label={d.statut} />
                              <button
                                onClick={() => { setEditDemande(d); setShowFormDemande(true) }}
                                style={{ padding: '3px 8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                ✏️
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ type: 'demande', id: d.id, nom: `${d.organisme} — ${d.type_mission || d.statut}` })}
                                style={{ padding: '3px 8px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                🗑️
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            {d.nb_personnes_requis && <span style={{ fontSize: '11px', color: '#6b7280' }}>👥 {d.nb_personnes_requis} personnes</span>}
                            {d.lieu && <span style={{ fontSize: '11px', color: '#6b7280' }}>📍 {d.lieu}</span>}
                            {d.date_debut && <span style={{ fontSize: '11px', color: '#6b7280' }}>📅 {d.date_debut}{d.date_fin_estimee ? ` → ${d.date_fin_estimee}` : ''}</span>}
                          </div>
                          {d.description && <div style={{ fontSize: '12px', color: '#374151', marginTop: '5px', lineHeight: '1.4' }}>{d.description}</div>}
                          {(d.contact_nom || d.contact_telephone) && (
                            <div style={{ marginTop: '5px', fontSize: '11px', color: '#6b7280', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              {d.contact_nom && <span>👤 {d.contact_nom}{d.contact_titre ? ` — ${d.contact_titre}` : ''}</span>}
                              {d.contact_telephone && <a href={`tel:${d.contact_telephone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>📞 {d.contact_telephone}</a>}
                              {d.contact_email && <a href={`mailto:${d.contact_email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>✉️ {d.contact_email}</a>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
                  onClick={() => confirmDelete.type === 'sinistre' ? supprimerSinistre(confirmDelete.id) : supprimerDemande(confirmDelete.id)}
                  style={{ padding: '8px 20px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
