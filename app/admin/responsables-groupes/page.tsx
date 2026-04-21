'use client'

/**
 * /admin/responsables-groupes
 *
 * Gestion des responsables de groupes de recherche et sauvetage.
 * - Liste tous les groupes (table `groupes_recherche`)
 * - Pour chaque groupe, affiche les responsables actuels + permet d'en ajouter/retirer
 * - Chaque responsable a un toggle `recoit_cc_courriels` (CC automatique futur)
 *
 * Réservé aux superadmin / admin / coordonnateur (contrôlé par la RLS + ce garde côté client).
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatPhone } from '@/utils/phone'

const C = '#1e3a5f'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'
const GREEN = '#059669'
const RED = '#dc2626'

interface Groupe {
  id: string
  nom: string
  district: number
  actif: boolean | null
}

interface Responsable {
  groupe_id: string
  benevole_id: string
  recoit_cc_courriels: boolean
  prenom: string
  nom: string
  email: string | null
  telephone: string | null
  role: string | null
}

interface SearchResult {
  benevole_id: string
  prenom: string
  nom: string
  email: string | null
  groupe_recherche: string | null
  ville: string | null
  region: string | null
}

export default function ResponsablesGroupesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [groupes, setGroupes] = useState<Groupe[]>([])
  const [responsables, setResponsables] = useState<Responsable[]>([])
  const [showInactifs, setShowInactifs] = useState(false)
  const [filtreTexte, setFiltreTexte] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // État pour l'ajout : groupeId → searchTerm + results
  const [openAddFor, setOpenAddFor] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  // Auth : vérifier le rôle côté client pour bloquer l'accès aux non-admins
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase
        .from('reservistes')
        .select('role')
        .eq('user_id', user.id)
        .single()
      if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) {
        router.push('/')
        return
      }
      setAuthorized(true)
    })()
  }, [])

  // Chargement initial
  const reload = async () => {
    setLoading(true)
    const [grpRes, respRes] = await Promise.all([
      supabase
        .from('groupes_recherche')
        .select('id, nom, district, actif')
        .order('district')
        .order('nom'),
      // Cast as any : la vue v_responsables_groupes_detail n'est pas dans les
      // types Supabase générés. Créée en migration SQL manuelle, donc TS
      // ne la connaît pas. Safe ici puisque le shape est défini dans l'interface
      // Responsable et qu'on mappe les champs explicitement plus bas.
      (supabase as any)
        .from('v_responsables_groupes_detail')
        .select('*')
        .order('nom'),
    ])
    setGroupes((grpRes.data || []) as Groupe[])
    setResponsables(((respRes.data || []) as any[]).map(r => ({
      groupe_id: r.groupe_id,
      benevole_id: r.benevole_id,
      recoit_cc_courriels: !!r.recoit_cc_courriels,
      prenom: r.prenom,
      nom: r.nom,
      email: r.email,
      telephone: r.telephone,
      role: r.role,
    })))
    setLoading(false)
  }

  useEffect(() => { if (authorized) reload() }, [authorized])

  const respByGroupe = useMemo(() => {
    const map = new Map<string, Responsable[]>()
    for (const r of responsables) {
      if (!map.has(r.groupe_id)) map.set(r.groupe_id, [])
      map.get(r.groupe_id)!.push(r)
    }
    return map
  }, [responsables])

  const groupesAffiches = useMemo(() => {
    const terme = filtreTexte.trim().toLowerCase()
    return groupes.filter(g => {
      if (!showInactifs && g.actif === false) return false
      if (terme && !g.nom.toLowerCase().includes(terme) && !String(g.district).includes(terme)) return false
      return true
    })
  }, [groupes, showInactifs, filtreTexte])

  // Recherche de réservistes pour ajout
  const rechercher = async (term: string) => {
    setSearchTerm(term)
    if (term.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('reservistes')
      .select('benevole_id, prenom, nom, email, groupe_recherche, ville, region')
      .or(`prenom.ilike.%${term}%,nom.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(12)
    setSearchResults((data || []) as SearchResult[])
    setSearching(false)
  }

  const ajouterResponsable = async (groupeId: string, benevoleId: string) => {
    const { error } = await (supabase as any)
      .from('groupes_recherche_responsables')
      .insert({ groupe_id: groupeId, benevole_id: benevoleId })
    if (error) {
      if (error.code === '23505') {
        setMsg({ type: 'err', text: 'Ce réserviste est déjà responsable de ce groupe.' })
      } else {
        setMsg({ type: 'err', text: `Erreur : ${error.message}` })
      }
    } else {
      setMsg({ type: 'ok', text: 'Responsable ajouté.' })
      await reload()
      setOpenAddFor(null); setSearchTerm(''); setSearchResults([])
    }
    setTimeout(() => setMsg(null), 3000)
  }

  const retirerResponsable = async (groupeId: string, benevoleId: string) => {
    if (!confirm('Retirer ce responsable de ce groupe ?')) return
    const { error } = await (supabase as any)
      .from('groupes_recherche_responsables')
      .delete()
      .eq('groupe_id', groupeId)
      .eq('benevole_id', benevoleId)
    if (error) {
      setMsg({ type: 'err', text: `Erreur : ${error.message}` })
    } else {
      setMsg({ type: 'ok', text: 'Responsable retiré.' })
      await reload()
    }
    setTimeout(() => setMsg(null), 3000)
  }

  const toggleCc = async (groupeId: string, benevoleId: string, nouvelleValeur: boolean) => {
    const { error } = await (supabase as any)
      .from('groupes_recherche_responsables')
      .update({ recoit_cc_courriels: nouvelleValeur })
      .eq('groupe_id', groupeId)
      .eq('benevole_id', benevoleId)
    if (error) {
      setMsg({ type: 'err', text: `Erreur : ${error.message}` })
      return
    }
    // Mise à jour locale optimiste
    setResponsables(prev => prev.map(r =>
      r.groupe_id === groupeId && r.benevole_id === benevoleId
        ? { ...r, recoit_cc_courriels: nouvelleValeur }
        : r
    ))
  }

  if (!authorized) return null

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C, margin: '0 0 6px' }}>
          🎖️ Responsables des groupes de R&amp;S
        </h1>
        <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>
          Désigne un ou plusieurs responsables par groupe de recherche et sauvetage.
          Les responsables auront accès à une page dédiée (à venir) et seront mis en
          CC des courriels envoyés aux membres de leur groupe.
        </p>
      </div>

      {/* Barre de filtre + options */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 18, padding: '12px 14px', backgroundColor: 'white',
        border: `1px solid ${BORDER}`, borderRadius: 10,
      }}>
        <input
          type="text" placeholder="🔍 Filtrer par nom ou district"
          value={filtreTexte} onChange={e => setFiltreTexte(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '7px 10px', fontSize: 13,
            border: `1px solid ${BORDER}`, borderRadius: 8, outline: 'none', color: '#1e293b' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}>
          <input type="checkbox" checked={showInactifs} onChange={e => setShowInactifs(e.target.checked)} />
          Afficher groupes inactifs
        </label>
        <span style={{ fontSize: 12, color: MUTED }}>
          {groupesAffiches.length} / {groupes.length} groupes
        </span>
      </div>

      {/* Message flash */}
      {msg && (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 8,
          backgroundColor: msg.type === 'ok' ? '#d1fae5' : '#fee2e2',
          color: msg.type === 'ok' ? '#065f46' : '#991b1b',
          fontSize: 13, fontWeight: 600,
        }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Chargement…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groupesAffiches.map(g => {
            const resps = respByGroupe.get(g.id) || []
            const ouvert = openAddFor === g.id
            return (
              <div key={g.id} style={{
                backgroundColor: 'white', border: `1px solid ${BORDER}`, borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 700,
                  }}>
                    District {g.district}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C }}>{g.nom}</span>
                  {g.actif === false && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, backgroundColor: '#f3f4f6', color: MUTED }}>
                      inactif
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: MUTED }}>
                    {resps.length} responsable{resps.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Liste des responsables */}
                {resps.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {resps.map(r => (
                      <div key={r.benevole_id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                        padding: '8px 10px', borderRadius: 8, backgroundColor: '#f8fafc',
                      }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                          {r.prenom} {r.nom}
                        </span>
                        {r.email && <span style={{ fontSize: 11, color: MUTED }}>✉ {r.email}</span>}
                        {r.telephone && <span style={{ fontSize: 11, color: MUTED }}>📞 {formatPhone(r.telephone)}</span>}

                        <label style={{
                          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 11, color: r.recoit_cc_courriels ? GREEN : MUTED, cursor: 'pointer',
                          padding: '3px 8px', borderRadius: 6,
                          backgroundColor: r.recoit_cc_courriels ? '#ecfdf5' : '#f3f4f6',
                          fontWeight: 600,
                        }}>
                          <input
                            type="checkbox"
                            checked={r.recoit_cc_courriels}
                            onChange={e => toggleCc(g.id, r.benevole_id, e.target.checked)}
                            style={{ accentColor: GREEN }}
                          />
                          📧 CC auto
                        </label>

                        <button
                          onClick={() => retirerResponsable(g.id, r.benevole_id)}
                          title="Retirer ce responsable"
                          style={{
                            background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6,
                            padding: '3px 8px', cursor: 'pointer', fontSize: 11,
                            color: RED, fontWeight: 600,
                          }}
                        >
                          ✕ Retirer
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', marginBottom: 10 }}>
                    Aucun responsable désigné pour ce groupe.
                  </div>
                )}

                {/* Ajouter un responsable */}
                {!ouvert ? (
                  <button
                    onClick={() => { setOpenAddFor(g.id); setSearchTerm(''); setSearchResults([]) }}
                    style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 600,
                      backgroundColor: '#eff6ff', color: '#1d4ed8',
                      border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer',
                    }}
                  >
                    + Ajouter un responsable
                  </button>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Nom, prénom ou courriel du réserviste"
                        value={searchTerm}
                        onChange={e => rechercher(e.target.value)}
                        style={{
                          flex: 1, padding: '7px 10px', fontSize: 13,
                          border: `1px solid ${BORDER}`, borderRadius: 8, outline: 'none', color: '#1e293b',
                        }}
                      />
                      <button
                        onClick={() => { setOpenAddFor(null); setSearchTerm(''); setSearchResults([]) }}
                        style={{
                          padding: '6px 12px', fontSize: 12, fontWeight: 600,
                          backgroundColor: 'white', color: MUTED,
                          border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer',
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                    {searching && <div style={{ fontSize: 12, color: MUTED }}>Recherche…</div>}
                    {!searching && searchTerm.trim().length >= 2 && searchResults.length === 0 && (
                      <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>Aucun réserviste trouvé.</div>
                    )}
                    {searchResults.length > 0 && (
                      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                        {searchResults.map(r => {
                          const dejaResp = resps.some(x => x.benevole_id === r.benevole_id)
                          return (
                            <div key={r.benevole_id} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 10px', borderBottom: `1px solid #f3f4f6`,
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                                  {r.prenom} {r.nom}
                                </div>
                                <div style={{ fontSize: 11, color: MUTED }}>
                                  {r.email}
                                  {r.ville && ` · 📍 ${r.ville}`}
                                  {r.groupe_recherche && ` · 🎖️ ${r.groupe_recherche}`}
                                </div>
                              </div>
                              <button
                                onClick={() => ajouterResponsable(g.id, r.benevole_id)}
                                disabled={dejaResp}
                                style={{
                                  padding: '5px 10px', fontSize: 11, fontWeight: 700,
                                  backgroundColor: dejaResp ? '#f3f4f6' : C, color: dejaResp ? MUTED : 'white',
                                  border: 'none', borderRadius: 6,
                                  cursor: dejaResp ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {dejaResp ? 'Déjà responsable' : '+ Ajouter'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {groupesAffiches.length === 0 && !loading && (
            <div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 14 }}>
              Aucun groupe ne correspond au filtre.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
