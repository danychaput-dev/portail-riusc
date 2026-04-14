'use client'

// Corbeille des certificats/formations soft-deletes.
// Permet de restaurer ou de purger definitivement.
// Acces: admin/coord/superadmin pour restaurer, superadmin pour purger.

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

const C = '#1e3a5f'

interface ReservisteInfo {
  prenom: string
  nom: string
  email: string | null
}

interface Entry {
  id: number
  benevole_id: string
  nom_formation: string | null
  resultat: string | null
  date_reussite: string | null
  date_expiration: string | null
  certificat_url: string | null
  certificat_url_archive: string | null
  deleted_at: string
  deleted_reason: string | null
  deleted_by_user_id: string | null
  reserviste: ReservisteInfo | null
  deleted_by: ReservisteInfo | null
}

export default function CorbeilleCertificatsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rows, setRows] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [actionEnCours, setActionEnCours] = useState<number | null>(null)
  const [actionLabel, setActionLabel] = useState<string>('')
  const [purgeCible, setPurgeCible] = useState<Entry | null>(null)
  const [purgeRaison, setPurgeRaison] = useState('')
  const [purgeNomForm, setPurgeNomForm] = useState('')

  const charger = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/formations/corbeille')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
      setRows(json.entries || [])
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur')
    }
    setLoading(false)
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: me } = await supabase
        .from('reservistes')
        .select('role')
        .eq('user_id', user.id)
        .single()
      if (!me || !['admin', 'coordonnateur', 'superadmin'].includes(me.role)) {
        setErreur('Acces reserve aux admins/coordonnateurs/superadmins.')
        setLoading(false)
        return
      }
      setRole(me.role)
      await charger()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restaurer = async (e: Entry) => {
    const label = e.nom_formation || `formation #${e.id}`
    const qui = e.reserviste ? `${e.reserviste.prenom} ${e.reserviste.nom}` : e.benevole_id
    if (!confirm(`Restaurer "${label}" pour ${qui} ?\n\nLa formation reapparaitra dans le dossier du reserviste.`)) return
    setActionEnCours(e.id)
    setActionLabel(`Restauration de ${label}...`)
    try {
      const res = await fetch('/api/admin/formations/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formation_id: e.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      await charger()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur')
    }
    setActionEnCours(null)
    setActionLabel('')
  }

  const purger = async () => {
    if (!purgeCible) return
    if (purgeRaison.trim().length < 10) {
      alert('Raison de purge obligatoire (minimum 10 caracteres)')
      return
    }
    setActionEnCours(purgeCible.id)
    setActionLabel(`Purge definitive de ${purgeCible.nom_formation || 'formation'} en cours...`)
    try {
      const res = await fetch('/api/admin/formations/hard-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formation_id: purgeCible.id,
          raison_purge: purgeRaison.trim(),
          confirmation_nom_formation: purgeNomForm,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setPurgeCible(null)
      setPurgeRaison('')
      setPurgeNomForm('')
      await charger()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur')
    }
    setActionEnCours(null)
    setActionLabel('')
  }

  const filtres = rows.filter(e => {
    if (!recherche.trim()) return true
    const q = recherche.toLowerCase()
    return (
      e.nom_formation?.toLowerCase().includes(q) ||
      e.reserviste?.prenom?.toLowerCase().includes(q) ||
      e.reserviste?.nom?.toLowerCase().includes(q) ||
      e.reserviste?.email?.toLowerCase().includes(q) ||
      e.deleted_reason?.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return <div style={{ padding: 24, color: '#6b7280' }}>Chargement de la corbeille des certificats...</div>
  }
  if (erreur) {
    return <div style={{ padding: 24, color: '#dc2626' }}>{erreur}</div>
  }

  const peutPurger = role === 'superadmin'

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {actionEnCours !== null && actionLabel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '420px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: C, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <div style={{ color: C, fontSize: '14px', fontWeight: 600 }}>{actionLabel}</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, color: C, fontSize: '24px' }}>🗑️ Corbeille des certificats</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
            {rows.length} certificat{rows.length > 1 ? 's' : ''} en corbeille. Restauration possible a tout moment.
            {!peutPurger && <span> Purge definitive reservee au superadmin.</span>}
          </p>
        </div>
        <input
          type="text"
          placeholder="Rechercher (formation, reserviste, raison)..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', minWidth: '280px' }}
        />
      </div>

      {filtres.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          {rows.length === 0 ? 'Aucun certificat en corbeille. 🎉' : 'Aucun resultat pour cette recherche.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtres.map(e => {
            const urlAvailable = e.certificat_url_archive || e.certificat_url
            return (
              <div key={e.id} style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderLeft: '4px solid #dc2626', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: C, marginBottom: '2px' }}>
                      {e.nom_formation || <em style={{ color: '#9ca3af' }}>(sans nom)</em>}
                    </div>
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                      <strong>Reserviste :</strong>{' '}
                      {e.reserviste
                        ? <>{e.reserviste.prenom} {e.reserviste.nom} {e.reserviste.email && <span style={{ color: '#6b7280' }}>({e.reserviste.email})</span>}</>
                        : <span style={{ color: '#9ca3af' }}>{e.benevole_id}</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                      {e.resultat && <>resultat: {e.resultat} · </>}
                      {e.date_reussite && <>reussite: {new Date(e.date_reussite).toLocaleDateString('fr-CA')} · </>}
                      {e.date_expiration && <>expire: {new Date(e.date_expiration).toLocaleDateString('fr-CA')} · </>}
                      ID formation: {e.id}
                    </div>
                    <div style={{ fontSize: '12px', color: '#374151' }}>
                      <strong>Supprime le :</strong> {new Date(e.deleted_at).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })}
                      {e.deleted_by && (
                        <> · <strong>par :</strong> {e.deleted_by.prenom} {e.deleted_by.nom}</>
                      )}
                    </div>
                    {e.deleted_reason && (
                      <div style={{ fontSize: '12px', color: '#374151', marginTop: '2px' }}>
                        <strong>Raison :</strong> {e.deleted_reason}
                      </div>
                    )}
                    {urlAvailable && (
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        <a href={urlAvailable} target="_blank" rel="noreferrer" style={{ color: C, textDecoration: 'underline' }}>
                          📄 Voir le fichier certificat {e.certificat_url_archive && !e.certificat_url ? '(archive)' : ''}
                        </a>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => restaurer(e)}
                      disabled={actionEnCours === e.id}
                      style={{ padding: '6px 14px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, opacity: actionEnCours === e.id ? 0.6 : 1 }}
                    >
                      {actionEnCours === e.id ? 'Restauration...' : '↩ Restaurer'}
                    </button>
                    {peutPurger && (
                      <button
                        onClick={() => { setPurgeCible(e); setPurgeRaison(''); setPurgeNomForm('') }}
                        disabled={actionEnCours === e.id}
                        style={{ padding: '6px 14px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, opacity: actionEnCours === e.id ? 0.6 : 1 }}
                      >
                        🔥 Purger definitivement
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de confirmation purge definitive */}
      {purgeCible && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={ev => { if (ev.target === ev.currentTarget) setPurgeCible(null) }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '500px', width: '100%', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ margin: '0 0 12px', color: '#dc2626', fontSize: '18px' }}>
              🔥 Purge definitive
            </h2>
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px', color: '#991b1b' }}>
              <strong>Action irreversible.</strong> Cette purge supprime definitivement :<br />
              · La ligne <strong>{purgeCible.nom_formation || `formation #${purgeCible.id}`}</strong><br />
              · Tout son historique d&apos;audit<br /><br />
              Le fichier PDF dans Storage reste intact (protection anti-perte).
            </div>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Raison de la purge (min 10 car.) :
            </label>
            <textarea
              value={purgeRaison}
              onChange={e => setPurgeRaison(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '12px', fontFamily: 'inherit' }}
              placeholder="Ex: Demande du reserviste (loi 25) - doublon certifie"
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Pour confirmer, retape exactement le nom de la formation :<br />
              <strong>{purgeCible.nom_formation}</strong>
            </label>
            <input
              type="text"
              value={purgeNomForm}
              onChange={e => setPurgeNomForm(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPurgeCible(null)}
                style={{ padding: '8px 16px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={purger}
                disabled={
                  purgeRaison.trim().length < 10 ||
                  purgeNomForm.trim().toLowerCase() !== (purgeCible.nom_formation || '').trim().toLowerCase() ||
                  actionEnCours === purgeCible.id
                }
                style={{
                  padding: '8px 16px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                  opacity: (purgeRaison.trim().length < 10 || purgeNomForm.trim().toLowerCase() !== (purgeCible.nom_formation || '').trim().toLowerCase() || actionEnCours === purgeCible.id) ? 0.5 : 1
                }}
              >
                {actionEnCours === purgeCible.id ? 'Purge en cours...' : 'Purger definitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
