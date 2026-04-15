'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
//maj du text dans le fichier pour forcer un update
interface Item {
  id: string
  benevole_id: string | null
  sender_email: string
  sender_name: string | null
  subject: string | null
  date_courriel: string | null
  filename_original: string
  storage_path: string
  match_status: string | null
  reserviste: { prenom: string; nom: string; email: string } | null
  formations_existantes: { id: number; nom_formation: string; date_reussite: string | null; certificat_url: string | null }[]
}

interface ReservisteLite {
  benevole_id: string
  prenom: string
  nom: string
  email: string
}

const FORMATIONS_SUGGESTIONS = [
  'Certificat pilote drone (SATP)',
  'Certification SCI — ICS-100',
  'Certification SCI — ICS-200',
  'Certification SCI — ICS-300',
  'Certification SCI — ICS-400',
  'Certificat premiers soins',
  'RCR',
  'Permis navigation / embarcation',
  'Formation SOPFEU',
  "S'initier à la sécurité civile",
  'Le bénévole en sécurité civile (AQBRS)',
  'Cohorte 4 - Camp de qualification - MSP',
  'Autre',
]

export default function PageCertificatsATrier() {
  const supabase = createClient()
  const router = useRouter()

  const [adminBenevoleId, setAdminBenevoleId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [counts, setCounts] = useState({ pending: 0, assigned: 0, deleted: 0 })
  const [statutView, setStatutView] = useState<'pending' | 'assigned' | 'deleted'>('pending')
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [allReservistes, setAllReservistes] = useState<ReservisteLite[]>([])
  const [selected, setSelected] = useState<Item | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: r } = await supabase
        .from('reservistes').select('benevole_id, role').eq('user_id', user.id).single()
      if (!r || !r.benevole_id || !r.role || !['superadmin', 'admin', 'coordonnateur'].includes(r.role)) {
        router.push('/'); return
      }
      setAdminBenevoleId(r.benevole_id)
      await loadAll(r.benevole_id)
      const { data: rs } = await supabase
        .from('reservistes').select('benevole_id, prenom, nom, email')
        .order('nom')
      setAllReservistes((rs || []).filter((r): r is ReservisteLite => r.benevole_id !== null))
      setLoading(false)
    })()
  }, [])

  async function loadAll(adminBid: string) {
    const [p, a, d] = await Promise.all([
      fetch(`/api/admin/certificats-a-trier?admin_benevole_id=${adminBid}&statut=pending`).then(r => r.json()),
      fetch(`/api/admin/certificats-a-trier?admin_benevole_id=${adminBid}&statut=assigned`).then(r => r.json()),
      fetch(`/api/admin/certificats-a-trier?admin_benevole_id=${adminBid}&statut=deleted`).then(r => r.json()),
    ])
    setCounts({
      pending: (p.items || []).length,
      assigned: (a.items || []).length,
      deleted: (d.items || []).length,
    })
    const view = statutView === 'pending' ? p : statutView === 'assigned' ? a : d
    setItems(view.items || [])
  }

  async function changerVue(v: 'pending' | 'assigned' | 'deleted') {
    setStatutView(v)
    if (!adminBenevoleId) return
    const res = await fetch(`/api/admin/certificats-a-trier?admin_benevole_id=${adminBenevoleId}&statut=${v}`).then(r => r.json())
    setItems(res.items || [])
    setSelected(null)
  }

  async function voirFichier(item: Item) {
    setSelected(item)
    if (signedUrls[item.id]) return
    // URL proxifiée par notre serveur (évite X-Frame-Options:DENY de Supabase)
    const proxyUrl = `/api/admin/certificats-a-trier/file?path=${encodeURIComponent(item.storage_path)}&admin_benevole_id=${adminBenevoleId}`
    setSignedUrls(prev => ({ ...prev, [item.id]: proxyUrl }))
  }

  // Groupement par réserviste
  const groupes = useMemo(() => {
    const map = new Map<string, { key: string; label: string; email: string; items: Item[] }>()
    for (const it of items) {
      const key = it.benevole_id || 'NON_ASSOCIE'
      const label = it.reserviste
        ? `${it.reserviste.prenom} ${it.reserviste.nom}`
        : (it.benevole_id ? `(${it.benevole_id})` : 'Non associé')
      const email = it.reserviste?.email || it.sender_email
      if (!map.has(key)) map.set(key, { key, label, email, items: [] })
      map.get(key)!.items.push(it)
    }
    return [...map.values()].sort((a, b) => {
      if (a.key === 'NON_ASSOCIE') return 1
      if (b.key === 'NON_ASSOCIE') return -1
      return a.label.localeCompare(b.label, 'fr')
    })
  }, [items])

  if (loading) return <div className="p-6">Chargement…</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Certificats à trier — Gmail Esther</h1>
            <p className="text-sm text-gray-600">Source : extraction gmail_extract_2026-04</p>
          </div>
          <button onClick={() => router.push('/admin/certificats')} className="px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50">
            ← Retour certificats
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {(['pending', 'assigned', 'deleted'] as const).map(v => (
            <button
              key={v}
              onClick={() => changerVue(v)}
              className={`px-3 py-2 text-sm rounded border ${statutView === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
            >
              {v === 'pending' ? 'À trier' : v === 'assigned' ? 'Assignés' : 'Supprimés'} ({counts[v]})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
          {/* Liste gauche */}
          <div className="bg-white border rounded overflow-hidden max-h-[calc(100vh-180px)] overflow-y-auto">
            {groupes.length === 0 && (
              <div className="p-6 text-center text-gray-500 text-sm">Aucun certificat dans cette vue.</div>
            )}
            {groupes.map(g => (
              <div key={g.key} className="border-b">
                <div className={`px-3 py-2 text-sm font-semibold ${g.key === 'NON_ASSOCIE' ? 'bg-amber-100' : 'bg-gray-100'}`}>
                  {g.label} <span className="text-gray-500 font-normal">({g.items.length})</span>
                  <div className="text-xs text-gray-500 font-normal">{g.email}</div>
                </div>
                {g.items.map(it => (
                  <button
                    key={it.id}
                    onClick={() => voirFichier(it)}
                    className={`w-full text-left px-3 py-2 text-xs border-t hover:bg-blue-50 ${selected?.id === it.id ? 'bg-blue-100' : ''}`}
                  >
                    <div className="font-medium truncate">{it.filename_original}</div>
                    <div className="text-gray-500 truncate">{it.subject || '(sans objet)'}</div>
                    <div className="text-gray-400">{it.date_courriel?.slice(0, 10)} · {it.match_status}</div>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Détail droit */}
          <div className="bg-white border rounded p-4 min-h-[500px]">
            {!selected ? (
              <div className="text-gray-500 text-sm">Sélectionne un certificat à gauche.</div>
            ) : (
              <DetailPane
                key={selected.id}
                item={selected}
                signedUrl={signedUrls[selected.id]}
                adminBenevoleId={adminBenevoleId}
                allReservistes={allReservistes}
                readonly={statutView !== 'pending'}
                onDone={async () => { await loadAll(adminBenevoleId); setSelected(null) }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailPane({
  item, signedUrl, adminBenevoleId, allReservistes, readonly, onDone,
}: {
  item: Item
  signedUrl?: string
  adminBenevoleId: string
  allReservistes: ReservisteLite[]
  readonly: boolean
  onDone: () => void
}) {
  const [mode, setMode] = useState<'nouvelle' | 'attacher'>('nouvelle')
  const [nomFormation, setNomFormation] = useState<string>(FORMATIONS_SUGGESTIONS[0])
  const [nomFormationCustom, setNomFormationCustom] = useState('')
  const [dateReussite, setDateReussite] = useState<string>(item.date_courriel?.slice(0, 10) || '')
  const [dateExpiration, setDateExpiration] = useState('')
  const [formationBenevoleId, setFormationBenevoleId] = useState<string>('')
  const [reassignerVers, setReassignerVers] = useState<string>(item.benevole_id || '')
  const [rechercheReserviste, setRechercheReserviste] = useState('')
  const [noteSupprimer, setNoteSupprimer] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const isNoMatch = !item.benevole_id

  const reservistesFiltrés = useMemo(() => {
    if (!rechercheReserviste.trim()) return allReservistes.slice(0, 50)
    const q = rechercheReserviste.toLowerCase()
    return allReservistes
      .filter(r => `${r.prenom} ${r.nom} ${r.email}`.toLowerCase().includes(q))
      .slice(0, 50)
  }, [rechercheReserviste, allReservistes])

  async function assigner() {
    setSaving(true); setMsg('')
    const nf = nomFormation === 'Autre' ? nomFormationCustom.trim() : nomFormation
    const body: any = {
      id: item.id,
      admin_benevole_id: adminBenevoleId,
      mode,
      benevole_id_cible: isNoMatch ? reassignerVers : undefined,
      nom_formation: nf,
      date_reussite: dateReussite || null,
      date_expiration: dateExpiration || null,
      formation_benevole_id: mode === 'attacher' ? (formationBenevoleId || null) : null,
    }
    const res = await fetch('/api/admin/certificats-a-trier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg('Erreur : ' + (j.error || 'inconnue')); return }
    onDone()
  }

  async function supprimer() {
    if (!noteSupprimer.trim()) { setMsg('Note obligatoire pour supprimer.'); return }
    setSaving(true); setMsg('')
    const res = await fetch(`/api/admin/certificats-a-trier?id=${item.id}&admin_benevole_id=${adminBenevoleId}&note=${encodeURIComponent(noteSupprimer)}`, {
      method: 'DELETE',
    })
    const j = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg('Erreur : ' + (j.error || 'inconnue')); return }
    onDone()
  }

  const pdfUrl = signedUrl
  const isPdf = item.filename_original.toLowerCase().endsWith('.pdf')

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Aperçu fichier */}
      <div>
        <div className="text-xs text-gray-500 mb-1">Fichier : {item.filename_original}</div>
        <div className="text-xs text-gray-500 mb-2">
          Courriel : <strong>{item.sender_name || item.sender_email}</strong> — {item.subject || '(sans objet)'}
        </div>
        {item.benevole_id && (
          <div className="mb-2 flex gap-2 flex-wrap">
            <button
              onClick={async () => {
                const res = await fetch('/api/impersonate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ benevole_id: item.benevole_id }),
                })
                const j = await res.json()
                if (j.success) window.open('/formation', '_blank')
                else alert(j.error || 'Erreur impersonation')
              }}
              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              🎓 Voir ses formations
            </button>
            <button
              onClick={async () => {
                const res = await fetch('/api/impersonate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ benevole_id: item.benevole_id }),
                })
                const j = await res.json()
                if (j.success) window.open('/dossier', '_blank')
                else alert(j.error || 'Erreur impersonation')
              }}
              className="px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700"
            >
              📋 Voir son parcours
            </button>
          </div>
        )}
        {pdfUrl ? (
          <>
            <div className="mb-2 flex gap-2">
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                🔗 Ouvrir dans un nouvel onglet
              </a>
              <a href={pdfUrl} download={item.filename_original} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">
                ⬇ Télécharger
              </a>
            </div>
            {isPdf ? (
              <iframe src={pdfUrl} className="w-full h-[600px] border rounded" title={item.filename_original} />
            ) : (
              <img src={pdfUrl} alt={item.filename_original} className="max-w-full border rounded" onError={(e: any) => { e.target.style.display = 'none' }} />
            )}
          </>
        ) : (
          <div className="p-6 text-center text-gray-400 text-sm">Chargement du fichier…</div>
        )}
      </div>

      {/* Actions */}
      <div>
        {readonly ? (
          <div className="text-sm text-gray-600">Lecture seule (déjà {item.match_status === 'deleted' ? 'supprimé' : 'assigné'}).</div>
        ) : (
          <>
            {isNoMatch && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                <div className="text-sm font-semibold text-amber-900 mb-2">Réserviste non identifié</div>
                <input
                  type="text"
                  placeholder="Rechercher (nom, prénom, courriel)…"
                  value={rechercheReserviste}
                  onChange={e => setRechercheReserviste(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded mb-2"
                />
                <select
                  value={reassignerVers}
                  onChange={e => setReassignerVers(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                >
                  <option value="">— Sélectionner un réserviste —</option>
                  {reservistesFiltrés.map(r => (
                    <option key={r.benevole_id} value={r.benevole_id}>
                      {r.prenom} {r.nom} ({r.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setMode('nouvelle')}
                className={`px-3 py-1 text-sm rounded border ${mode === 'nouvelle' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}
              >
                Nouvelle formation
              </button>
              <button
                onClick={() => setMode('attacher')}
                disabled={item.formations_existantes.length === 0}
                className={`px-3 py-1 text-sm rounded border ${mode === 'attacher' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'} disabled:opacity-40`}
              >
                Attacher à existante ({item.formations_existantes.length})
              </button>
            </div>

            {mode === 'nouvelle' ? (
              <>
                <label className="block text-sm font-medium mb-1">Formation</label>
                <select value={nomFormation} onChange={e => setNomFormation(e.target.value)} className="w-full px-2 py-1 text-sm border rounded mb-2">
                  {FORMATIONS_SUGGESTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {nomFormation === 'Autre' && (
                  <input
                    type="text"
                    placeholder="Nom de la formation…"
                    value={nomFormationCustom}
                    onChange={e => setNomFormationCustom(e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded mb-2"
                  />
                )}
              </>
            ) : (
              <>
                <label className="block text-sm font-medium mb-1">Formation existante</label>
                <select value={formationBenevoleId} onChange={e => setFormationBenevoleId(e.target.value)} className="w-full px-2 py-1 text-sm border rounded mb-2">
                  <option value="">— Sélectionner —</option>
                  {item.formations_existantes.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nom_formation} {f.certificat_url ? '(déjà 1 fichier)' : ''}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-sm font-medium mb-1">Date réussite</label>
                <input type="date" value={dateReussite} onChange={e => setDateReussite(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date expiration</label>
                <input type="date" value={dateExpiration} onChange={e => setDateExpiration(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
              </div>
            </div>

            <button
              onClick={assigner}
              disabled={saving}
              className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 mb-4"
            >
              {saving ? 'Enregistrement…' : 'Assigner ce certificat'}
            </button>

            <details className="border-t pt-3">
              <summary className="text-sm text-red-700 cursor-pointer">Supprimer (doublon ou hors-sujet)</summary>
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Raison (obligatoire)…"
                  value={noteSupprimer}
                  onChange={e => setNoteSupprimer(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded mb-2"
                />
                <button
                  onClick={supprimer}
                  disabled={saving || !noteSupprimer.trim()}
                  className="w-full px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Supprimer définitivement
                </button>
              </div>
            </details>

            {msg && <div className="mt-3 text-sm text-red-700">{msg}</div>}
          </>
        )}

        {item.formations_existantes.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="text-xs font-semibold text-gray-600 mb-1">Formations existantes ({item.formations_existantes.length})</div>
            <ul className="text-xs text-gray-600 space-y-1">
              {item.formations_existantes.map(f => (
                <li key={f.id}>
                  {f.nom_formation} {f.date_reussite && <span className="text-gray-400">· {f.date_reussite}</span>} {f.certificat_url && <span className="text-green-600">✓ fichier</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
