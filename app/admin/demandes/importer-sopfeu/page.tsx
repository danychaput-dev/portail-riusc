'use client'

// app/admin/demandes/importer-sopfeu/page.tsx
// Import du gabarit XLSX « Formulaire de mobilisation des réservistes » (SOPFEU).
//
// Flow:
//   1. Admin sélectionne le XLSX reçu par courriel de SOPFEU.
//   2. POST /api/admin/demandes/importer-sopfeu/parse → preview éditable.
//   3. Admin ajuste type_incident / type_mission / priorité + voit les warnings.
//   4. POST /api/admin/demandes/importer-sopfeu/creer → crée sinistre + demande
//      et redirige vers le wizard /admin/operations à l'étape 3 (déploiement).
//
// Les champs SOPFEU qui n'ont pas encore de colonne DB dédiée (évolution,
// météo, charge mentale, contact site, alimentation, etc.) sont concaténés
// dans demandes.description / operations_wizard_state.msg_notif côté server.
// Voir docs/formulaires-partenaires/ANALYSE-sopfeu-vs-portail.md pour les gaps.

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TYPES_INCIDENT, TYPES_MISSION, PRIORITES } from '@/types/constants'
import type { ParsedSopfeu } from '@/types/sopfeu-import'

// ─── Style helpers ───────────────────────────────────────────────────────────

const input: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
  borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '11px', color: '#6b7280',
  marginBottom: '3px', fontWeight: 600,
}
const card: React.CSSProperties = {
  padding: '16px', border: '1px solid #e5e7eb',
  borderRadius: '8px', backgroundColor: '#fff', marginBottom: '16px',
}
const h2: React.CSSProperties = {
  fontSize: '14px', fontWeight: 700, color: '#111827',
  margin: '0 0 12px 0', paddingBottom: '8px', borderBottom: '1px solid #f3f4f6',
}
const row2: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px',
}
const row3: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '10px',
}

// Champ preview (lecture seule)
function PV({ label, value }: { label: string; value: string | number | null }) {
  const v = value ?? ''
  return (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{ ...input, backgroundColor: '#f9fafb', minHeight: '32px', whiteSpace: 'pre-wrap' }}>
        {v || <span style={{ color: '#9ca3af' }}>—</span>}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ImporterSopfeuPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [parsed, setParsed] = useState<ParsedSopfeu | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Overrides éditables par l'admin
  const [typeIncident, setTypeIncident] = useState<string>('')
  const [typeMission, setTypeMission] = useState<string>('')
  const [priorite, setPriorite] = useState<string>('Normale')

  const handleParse = useCallback(async () => {
    if (!file) return
    setParsing(true); setError(null); setParsed(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/demandes/importer-sopfeu/parse', {
        method: 'POST', body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur parsing')
      setParsed(json.data as ParsedSopfeu)
      // Heuristique type_mission : SOPFEU → "Support opérationnel" par défaut
      setTypeMission('Support opérationnel')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setParsing(false)
    }
  }, [file])

  const handleCreer = useCallback(async () => {
    if (!parsed) return
    if (!typeIncident) { setError('Choisir un type de sinistre'); return }
    if (!typeMission) { setError('Choisir un type de mission'); return }
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/admin/demandes/importer-sopfeu/creer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed, type_incident: typeIncident, type_mission: typeMission, priorite }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur création')
      router.push(json.redirect || '/admin/operations')
    } catch (e: any) {
      setError(e.message)
      setCreating(false)
    }
  }, [parsed, typeIncident, typeMission, priorite, router])

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0' }}>
        Importer une demande SOPFEU
      </h1>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px 0' }}>
        Gabarit reconnu : <code style={{ backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>Formulaire de mobilisation</code> (onglet 1 du classeur SOPFEU). Le parsing pré-remplit un sinistre + une demande que tu peux ajuster avant de poursuivre dans le wizard opérations.
      </p>

      {/* Zone upload */}
      <div style={card}>
        <h2 style={h2}>1. Fichier SOPFEU</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setParsed(null) }}
            style={{ flex: 1, ...input, padding: '5px' }}
          />
          <button
            onClick={handleParse}
            disabled={!file || parsing}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none',
              backgroundColor: !file || parsing ? '#d1d5db' : '#2563eb',
              color: 'white', fontSize: '13px', fontWeight: 600,
              cursor: !file || parsing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {parsing ? 'Analyse…' : 'Analyser'}
          </button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{ ...card, backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {/* Warnings parsing */}
      {parsed && parsed.warnings.length > 0 && (
        <div style={{ ...card, backgroundColor: '#fffbeb', borderColor: '#fcd34d' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
            Vérifications à faire ({parsed.warnings.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#78350f' }}>
            {parsed.warnings.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
        </div>
      )}

      {parsed && (
        <>
          {/* Section: choix type_incident / type_mission / priorité */}
          <div style={card}>
            <h2 style={h2}>2. Classification (à choisir)</h2>
            <div style={row3}>
              <div>
                <label style={lbl}>TYPE DE SINISTRE *</label>
                <select value={typeIncident} onChange={(e) => setTypeIncident(e.target.value)} style={input}>
                  <option value="">— Sélectionner —</option>
                  {TYPES_INCIDENT.map(t => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div>
                <label style={lbl}>TYPE DE MISSION *</label>
                <select value={typeMission} onChange={(e) => setTypeMission(e.target.value)} style={input}>
                  <option value="">— Sélectionner —</option>
                  {(TYPES_MISSION.SOPFEU || []).map(t => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div>
                <label style={lbl}>PRIORITÉ</label>
                <select value={priorite} onChange={(e) => setPriorite(e.target.value)} style={input}>
                  {PRIORITES.map(p => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
            </div>
            {parsed.nature_demande && (
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Nature SOPFEU indiquée : <em>{parsed.nature_demande}</em>
              </div>
            )}
          </div>

          {/* Identification */}
          <div style={card}>
            <h2 style={h2}>3. Identification</h2>
            <div style={row3}>
              <PV label="N° intervention SOPFEU" value={parsed.numero_intervention} />
              <PV label="Lieu de l'intervention" value={parsed.lieu_intervention} />
              <PV label="Nature de la demande" value={parsed.nature_demande} />
            </div>
          </div>

          {/* Contact CPO */}
          <div style={card}>
            <h2 style={h2}>4. Contact SOPFEU (CPO)</h2>
            <div style={row3}>
              <PV label="Prénom" value={parsed.contact_cpo_prenom} />
              <PV label="Nom" value={parsed.contact_cpo_nom} />
              <PV label="Fonction" value={parsed.contact_cpo_fonction} />
            </div>
            <div style={row3}>
              <PV label="Téléphone 1" value={parsed.contact_cpo_tel_1} />
              <PV label="Téléphone 2" value={parsed.contact_cpo_tel_2} />
              <PV label="Courriel" value={parsed.contact_cpo_courriel} />
            </div>
          </div>

          {/* Mandat */}
          <div style={card}>
            <h2 style={h2}>5. Mandat opérationnel</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              <PV label="Description de l'événement" value={parsed.description_evenement} />
              <PV label="Évolution attendue" value={parsed.evolution_attendue} />
              <PV label="Au profit de" value={parsed.au_profit_de} />
              <PV label="Principales tâches" value={parsed.principales_taches} />
              <PV label="Autres précisions" value={parsed.mandat_autres_precisions} />
            </div>
          </div>

          {/* Conditions */}
          <div style={card}>
            <h2 style={h2}>6. Conditions opérationnelles</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              <PV label="Météo prévue" value={parsed.meteo} />
              <PV label="Amplitudes horaires" value={parsed.amplitudes_horaires} />
              <PV label="Enjeux santé/sécurité" value={parsed.enjeux_sst} />
              <PV label="Charge mentale (psychosocial)" value={parsed.charge_mentale} />
              <PV label="Autres précisions" value={parsed.conditions_autres} />
            </div>
          </div>

          {/* Effectifs */}
          <div style={card}>
            <h2 style={h2}>7. Effectifs requis</h2>
            {parsed.effectifs.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                Aucun effectif renseigné dans le gabarit.
              </p>
            ) : (
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>Rôle</th>
                    <th style={{ padding: '6px 8px', border: '1px solid #e5e7eb', width: 70 }}>Nombre</th>
                    <th style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>Capacités</th>
                    <th style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>Précisions</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.effectifs.map((e, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{e.label}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb', fontWeight: 600 }}>{e.nombre ?? '—'}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{e.capacites.join(', ') || '—'}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{e.autres_precisions || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {parsed.effectifs_autres_precisions && (
              <div style={{ marginTop: 10 }}>
                <PV label="Autres précisions effectifs" value={parsed.effectifs_autres_precisions} />
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 8, fontStyle: 'italic' }}>
              Note : la décomposition par rôle n'est pas encore persistée (colonne dédiée à créer). Seul le total {parsed.effectifs.reduce((a, e) => a + (e.nombre || 0), 0)} sera enregistré dans <code>demandes.nb_personnes_requis</code>.
            </div>
          </div>

          {/* RDV */}
          <div style={card}>
            <h2 style={h2}>8. Rendez-vous</h2>
            <div style={row3}>
              <PV label="Durée min. de dispo" value={parsed.duree_min_dispo} />
              <PV label="Date de RDV" value={parsed.rdv_date} />
              <PV label="Heure de RDV" value={parsed.rdv_heure} />
            </div>
            <div style={row2}>
              <PV label="Lieu de RDV" value={parsed.rdv_lieu} />
              <PV label="Stationnement véhicules perso" value={parsed.stationnement} />
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', margin: '14px 0 6px 0', fontWeight: 600 }}>
              CONTACT SUR SITE
            </div>
            <div style={row3}>
              <PV label="Prénom" value={parsed.contact_site_prenom} />
              <PV label="Nom" value={parsed.contact_site_nom} />
              <PV label="Fonction" value={parsed.contact_site_fonction} />
            </div>
            <div style={row3}>
              <PV label="Téléphone 1" value={parsed.contact_site_tel_1} />
              <PV label="Téléphone 2" value={parsed.contact_site_tel_2} />
              <PV label="Courriel" value={parsed.contact_site_courriel} />
            </div>
            <div style={{ marginTop: 10 }}>
              <PV label="Autres précisions" value={parsed.rdv_autres_precisions} />
            </div>
          </div>

          {/* Services */}
          <div style={card}>
            <h2 style={h2}>9. Services et installations</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              <PV label="Hébergement" value={parsed.hebergement} />
              <PV label="Alimentation" value={parsed.alimentation} />
              <PV label="Installations" value={parsed.installations} />
              <PV label="Connectivité" value={parsed.connectivite} />
              <PV label="Autres précisions" value={parsed.services_autres} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button
              onClick={() => { setParsed(null); setFile(null) }}
              style={{
                padding: '10px 16px', borderRadius: '6px',
                border: '1px solid #d1d5db', backgroundColor: '#fff',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleCreer}
              disabled={creating || !typeIncident || !typeMission}
              style={{
                padding: '10px 20px', borderRadius: '6px', border: 'none',
                backgroundColor: creating || !typeIncident || !typeMission ? '#d1d5db' : '#16a34a',
                color: 'white', fontSize: '13px', fontWeight: 700,
                cursor: creating || !typeIncident || !typeMission ? 'not-allowed' : 'pointer',
              }}
            >
              {creating ? 'Création…' : 'Créer sinistre + demande et ouvrir le wizard'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
