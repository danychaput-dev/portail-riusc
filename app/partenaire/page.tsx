'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'
import test from 'node:test'

const C = '#1e3a5f'

interface Partenaire {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  role: string
}

interface Organisme {
  id: number
  nom: string
}

interface Demande {
  id: string
  identifiant: string
  organisme: string
  type_mission: string
  nb_personnes_requis: number
  date_debut: string
  date_fin_estimee: string | null
  statut: string
  created_at: string
}

interface Deploiement {
  id: string
  identifiant: string
  nom: string
  lieu: string
  date_debut: string
  date_fin: string | null
  statut: string
  nb_personnes_par_vague: number
}
// partenaire
const STATUT_DEMANDE_COLORS: Record<string, { bg: string; color: string }> = {
  'Nouvelle':      { bg: '#eff6ff', color: '#2563eb' },
  'En traitement': { bg: '#fffbeb', color: '#d97706' },
  'Complétée':     { bg: '#f0fdf4', color: '#16a34a' },
  'Annulée':       { bg: '#fef2f2', color: '#dc2626' },
}

const STATUT_DEP_COLORS: Record<string, { bg: string; color: string }> = {
  'Planifié':               { bg: '#eff6ff', color: '#2563eb' },
  'Demande disponibilités': { bg: '#fffbeb', color: '#d97706' },
  'En cours':               { bg: '#f0fdf4', color: '#16a34a' },
  'Complété':               { bg: '#f1f5f9', color: '#64748b' },
  'Annulé':                 { bg: '#fef2f2', color: '#dc2626' },
}

export default function PartenairePage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading]         = useState(true)
  const [partenaire, setPartenaire]   = useState<Partenaire | null>(null)
  const [organismes, setOrganismes]   = useState<Organisme[]>([])
  const [demandes, setDemandes]       = useState<Demande[]>([])
  const [deploiements, setDeploiements] = useState<Deploiement[]>([])
  const [onglet, setOnglet]           = useState<'demandes' | 'deploiements' | 'nouvelle'>('demandes')

  // Formulaire nouvelle demande
  const [form, setForm]               = useState({ organisme: '', type_mission: '', type_mission_detail: '', nb_personnes: '1', date_debut: '', date_fin: '', contact_nom: '', contact_titre: '', contact_telephone: '', contact_email: '', priorite: 'Normale' })
  const [submitting, setSubmitting]   = useState(false)
  const [submitMsg, setSubmitMsg]     = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Chercher par email
      const { data: res } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom, email, role')
        .ilike('email', user.email || '')
        .single()

      if (!res || res.role !== 'partenaire') { router.push('/'); return }
      setPartenaire(res)

      // Organismes du partenaire
      const { data: orgs } = await supabase
        .from('reserviste_organisations')
        .select('organisation_id, organisations(id, nom)')
        .eq('benevole_id', res.benevole_id)
      const orgList = (orgs || []).map((o: any) => o.organisations).filter(Boolean)
      setOrganismes(orgList)

      // Pré-remplir organisme dans le formulaire
      if (orgList.length === 1) {
        setForm(f => ({ ...f, organisme: orgList[0].nom }))
      }

      // Demandes de cet organisme
      if (orgList.length > 0) {
        const orgNoms = orgList.map((o: any) => o.nom)
        const { data: dem } = await supabase
          .from('demandes')
          .select('id, identifiant, organisme, type_mission, nb_personnes_requis, date_debut, date_fin_estimee, statut, created_at')
          .in('organisme', orgNoms)
          .order('created_at', { ascending: false })
          .limit(50)
        setDemandes(dem || [])

        // Déploiements liés à leurs demandes
        if (dem && dem.length > 0) {
          const demandeIds = dem.map((d: any) => d.id)
          const { data: ddJoin } = await supabase
            .from('deployments_demandes')
            .select('deployment_id')
            .in('demande_id', demandeIds)
          const depIds = [...new Set((ddJoin || []).map((d: any) => d.deployment_id))]
          if (depIds.length > 0) {
            const { data: deps } = await supabase
              .from('deployments')
              .select('id, identifiant, nom, lieu, date_debut, date_fin, statut, nb_personnes_par_vague')
              .in('id', depIds)
              .order('date_debut', { ascending: false })
            setDeploiements(deps || [])
          }
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  const soumettreDemande = async () => {
    if (!form.organisme || !form.type_mission || !form.date_debut || !form.contact_nom) {
      setSubmitMsg('Veuillez remplir tous les champs obligatoires.')
      return
    }
    setSubmitting(true)
    setSubmitMsg('')

    // Générer identifiant DEM-###
    const { count } = await supabase.from('demandes').select('id', { count: 'exact', head: true })
    const identifiant = `DEM-${String((count || 0) + 1).padStart(3, '0')}`

    const { error } = await supabase.from('demandes').insert({
      identifiant,
      organisme: form.organisme,
      organisme_detail: form.type_mission_detail,
      type_mission: form.type_mission,
      type_mission_detail: form.type_mission_detail,
      nb_personnes_requis: parseInt(form.nb_personnes) || 1,
      date_debut: form.date_debut,
      date_fin_estimee: form.date_fin || null,
      contact_nom: form.contact_nom,
      contact_titre: form.contact_titre,
      contact_telephone: form.contact_telephone,
      contact_email: form.contact_email || partenaire?.email,
      priorite: form.priorite,
      statut: 'Nouvelle',
    })

    if (error) {
      setSubmitMsg('Erreur lors de la soumission. Veuillez réessayer.')
    } else {
      setSubmitMsg('✅ Demande soumise avec succès ! L\'équipe RIUSC en a été notifiée.')
      setOnglet('demandes')
      // Rafraîchir les demandes
      const orgNoms = organismes.map(o => o.nom)
      const { data: dem } = await supabase.from('demandes').select('id, identifiant, organisme, type_mission, nb_personnes_requis, date_debut, date_fin_estimee, statut, created_at').in('organisme', orgNoms).order('created_at', { ascending: false }).limit(50)
      setDemandes(dem || [])
      setForm(f => ({ ...f, type_mission: '', type_mission_detail: '', nb_personnes: '1', date_debut: '', date_fin: '', contact_nom: '', contact_titre: '', contact_telephone: '', priorite: 'Normale' }))
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Chargement…</div>
    </div>
  )

  if (!partenaire) return null

  const orgLabel = organismes.map(o => o.nom).join(', ')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader />
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 20px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: C, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🤝</div>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: C }}>
                Portail partenaires
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                {partenaire.prenom} {partenaire.nom} — {orgLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '0' }}>
          {([
            { key: 'demandes',      label: `📋 Mes demandes (${demandes.length})` },
            { key: 'deploiements',  label: `🚁 Déploiements (${deploiements.length})` },
            { key: 'nouvelle',      label: '➕ Nouvelle demande' },
          ] as const).map(o => (
            <button
              key={o.key}
              onClick={() => setOnglet(o.key)}
              style={{
                padding: '10px 18px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
                backgroundColor: onglet === o.key ? 'white' : 'transparent',
                color: onglet === o.key ? C : '#94a3b8',
                borderBottom: onglet === o.key ? `2px solid ${C}` : '2px solid transparent',
                marginBottom: '-2px',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Onglet Demandes */}
        {onglet === 'demandes' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {submitMsg && (
              <div style={{ padding: '14px 20px', backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>
                {submitMsg}
              </div>
            )}
            {demandes.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                Aucune demande pour le moment.<br />
                <button onClick={() => setOnglet('nouvelle')} style={{ marginTop: '12px', padding: '8px 18px', backgroundColor: C, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  Soumettre une première demande →
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    {['ID', 'Type de mission', 'Personnes', 'Date début', 'Statut', 'Soumis le'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((d, i) => {
                    const sc = STATUT_DEMANDE_COLORS[d.statut] || { bg: '#f1f5f9', color: '#64748b' }
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: C }}>{d.identifiant}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{d.type_mission}</td>
                        <td style={{ padding: '10px 14px', color: '#374151', textAlign: 'center' }}>{d.nb_personnes_requis}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{new Date(d.date_debut).toLocaleDateString('fr-CA')}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: sc.bg, color: sc.color }}>
                            {d.statut}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{new Date(d.created_at).toLocaleDateString('fr-CA')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Onglet Déploiements */}
        {onglet === 'deploiements' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {deploiements.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                Aucun déploiement en cours pour vos demandes.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    {['ID', 'Nom', 'Lieu', 'Date début', 'Personnes', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deploiements.map((d, i) => {
                    const sc = STATUT_DEP_COLORS[d.statut] || { bg: '#f1f5f9', color: '#64748b' }
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: C }}>{d.identifiant}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1e293b' }}>{d.nom}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{d.lieu}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{new Date(d.date_debut).toLocaleDateString('fr-CA')}</td>
                        <td style={{ padding: '10px 14px', color: '#374151', textAlign: 'center' }}>{d.nb_personnes_par_vague}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: sc.bg, color: sc.color }}>
                            {d.statut}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Onglet Nouvelle demande */}
        {onglet === 'nouvelle' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '28px' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: C }}>Nouvelle demande d&apos;intervention</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

              {/* Organisme */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Organisme demandeur *</label>
                {organismes.length === 1 ? (
                  <input value={form.organisme} readOnly style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', backgroundColor: '#f8fafc', boxSizing: 'border-box' as const }} />
                ) : (
                  <select value={form.organisme} onChange={e => setForm(f => ({ ...f, organisme: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}>
                    <option value="">Sélectionner…</option>
                    {organismes.map(o => <option key={o.id} value={o.nom}>{o.nom}</option>)}
                  </select>
                )}
              </div>

              {/* Type mission */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Type de mission *</label>
                <select value={form.type_mission} onChange={e => setForm(f => ({ ...f, type_mission: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}>
                  <option value="">Sélectionner…</option>
                  <option>Recherche et sauvetage</option>
                  <option>Évacuation</option>
                  <option>Support logistique</option>
                  <option>Centre d&apos;hébergement</option>
                  <option>Soutien psychosocial</option>
                  <option>Communication</option>
                  <option>Autre</option>
                </select>
              </div>

              {/* Priorité */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Priorité</label>
                <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}>
                  <option>Normale</option>
                  <option>Urgente</option>
                  <option>Critique</option>
                </select>
              </div>

              {/* Nb personnes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Nombre de personnes requises *</label>
                <input type="number" min="1" value={form.nb_personnes} onChange={e => setForm(f => ({ ...f, nb_personnes: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>

              {/* Date début */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Date de début *</label>
                <input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>

              {/* Date fin */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Date de fin estimée</label>
                <input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>

              {/* Détails mission */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Détails supplémentaires</label>
                <textarea value={form.type_mission_detail} onChange={e => setForm(f => ({ ...f, type_mission_detail: e.target.value }))} rows={3}
                  placeholder="Décrivez la nature de l'intervention, les compétences spécifiques requises, etc."
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, resize: 'vertical' as const }} />
              </div>

              {/* Séparateur contact */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '4px' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Contact sur le terrain</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Nom du contact *</label>
                <input value={form.contact_nom} onChange={e => setForm(f => ({ ...f, contact_nom: e.target.value }))}
                  placeholder="Prénom Nom"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Titre / fonction</label>
                <input value={form.contact_titre} onChange={e => setForm(f => ({ ...f, contact_titre: e.target.value }))}
                  placeholder="Ex: Coordonnateur terrain"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Téléphone</label>
                <input value={form.contact_telephone} onChange={e => setForm(f => ({ ...f, contact_telephone: e.target.value }))}
                  placeholder="(418) 555-0000"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Courriel contact</label>
                <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                  placeholder={partenaire.email}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>

            </div>

            {submitMsg && !submitMsg.startsWith('✅') && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', fontSize: '13px', color: '#dc2626' }}>{submitMsg}</div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setOnglet('demandes')}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={soumettreDemande} disabled={submitting}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: C, color: 'white', fontSize: '13px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Envoi…' : 'Soumettre la demande'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
          Portail RIUSC — AQBRS · <a href="/dashboard" style={{ color: '#94a3b8' }}>Statistiques publiques</a>
        </div>

      </main>
    </div>
  )
}
