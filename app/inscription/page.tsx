'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Camp {
  session_id: string
  camp_nom: string
  camp_dates: string
  camp_lieu: string
  nb_total: number
  nb_confirme: number
  nb_absent: number
  nb_annule: number
  isPast: boolean
}

interface Inscription {
  id: string
  benevole_id: string
  prenom_nom: string
  presence: string
  statut_inscription: string
  courriel: string | null
  telephone: string | null
  camp_nom: string
  camp_dates: string
  camp_lieu: string
  sync_status: string
  monday_item_id: string | null
  created_at: string
  // from reservistes
  region: string | null
  groupe: string | null
  remboursement_bottes_date: string | null
  allergies_alimentaires: string | null
  allergies_autres: string | null
  conditions_medicales: string | null
  prenom: string | null
  nom: string | null
  presence_updated_at: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRESENCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  confirme:  { label: "J'y serai",           color: '#065f46', bg: '#d1fae5' },
  absent:    { label: "Je n'y serai pas",     color: '#7f1d1d', bg: '#fee2e2' },
  incertain: { label: 'Incertain',            color: '#78350f', bg: '#fef3c7' },
  annule:    { label: 'Annulé',               color: '#374151', bg: '#f3f4f6' },
  Jy_etais:  { label: "J'y étais",            color: '#1e3a5f', bg: '#dbeafe' },
}

function presenceBadge(presence: string) {
  const p = PRESENCE_LABELS[presence] || { label: presence, color: '#374151', bg: '#f3f4f6' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      color: p.color,
      background: p.bg,
      whiteSpace: 'nowrap',
    }}>
      {p.label}
    </span>
  )
}

function isCampPast(campDates: string): boolean {
  if (!campDates) return false
  const now = new Date()
  const match = campDates.match(/(\d{1,2})[–-](\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (match) {
    const months: Record<string, number> = {
      janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
      juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11
    }
    const month = months[match[3].toLowerCase()]
    const year = parseInt(match[4])
    const endDay = parseInt(match[2])
    if (month !== undefined) {
      const endDate = new Date(year, month, endDay)
      return endDate < now
    }
  }
  return false
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InscriptionsCampsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [isAdmin, setIsAdmin] = useState(false)
  const [retourHref, setRetourHref] = useState('/')
  const [camps, setCamps] = useState<Camp[]>([])
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null)
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingInscrits, setLoadingInscrits] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPresence, setFilterPresence] = useState<string>('tous')

  // ── Détecter si admin ──────────────────────────────────────────────────────
  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: res } = await supabase
        .from('reservistes')
        .select('role')
        .eq('user_id', user.id)
        .single()
      if (res?.role === 'admin' || res?.role === 'coordonnateur') {
        setIsAdmin(true)
        setRetourHref('/admin')
      } else if (res?.role === 'partenaire') {
        setRetourHref('/partenaire')
      }
    }
    checkRole()
  }, [])

  // ── Charger tous les camps ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadCamps() {
      setLoading(true)
      const { data, error } = await supabase
        .from('inscriptions_camps')
        .select('session_id, camp_nom, camp_dates, camp_lieu, presence')

      if (error) { console.error(error); setLoading(false); return }

      // Grouper par session_id
      const map = new Map<string, {
        session_id: string
        camp_nom: string
        camp_dates: string
        camp_lieu: string
        presences: string[]
      }>()

      for (const row of (data || [])) {
        if (!map.has(row.session_id)) {
          map.set(row.session_id, {
            session_id: row.session_id,
            camp_nom: row.camp_nom || '',
            camp_dates: row.camp_dates || '',
            camp_lieu: row.camp_lieu || '',
            presences: [],
          })
        }
        map.get(row.session_id)!.presences.push(row.presence)
      }

      const campList: Camp[] = Array.from(map.values()).map(c => ({
        session_id: c.session_id,
        camp_nom: c.camp_nom,
        camp_dates: c.camp_dates,
        camp_lieu: c.camp_lieu,
        nb_total:    c.presences.length,
        nb_confirme: c.presences.filter(p => p === 'confirme').length,
        nb_absent:   c.presences.filter(p => p === 'absent').length,
        nb_annule:   c.presences.filter(p => p === 'annule').length,
        isPast: isCampPast(c.camp_dates),
      }))

      // Extraire le numéro de cohorte pour tri numérique
      const getCohortNum = (campNom: string): number => {
        const m = campNom.match(/Cohorte\s+(\d+)/i)
        return m ? parseInt(m[1]) : 999
      }

      // À venir : ascendant (prochain camp en premier — 9, 10, 11...)
      // Passés  : descendant (plus récent en premier — 8, 7, 6...)
      campList.sort((a, b) => {
        if (a.isPast !== b.isPast) return a.isPast ? 1 : -1
        if (!a.isPast) return getCohortNum(a.camp_nom) - getCohortNum(b.camp_nom)
        return getCohortNum(b.camp_nom) - getCohortNum(a.camp_nom)
      })

      setCamps(campList)
      if (campList.length > 0) setSelectedCampId(campList[0].session_id)
      setLoading(false)
    }
    loadCamps()
  }, [])

  // ── Charger les inscrits du camp sélectionné ───────────────────────────────
  useEffect(() => {
    if (!selectedCampId) return
    async function loadInscrits() {
      setLoadingInscrits(true)
      setSearch('')
      setFilterPresence('tous')

      // Étape 1 — inscriptions du camp
      const { data, error } = await supabase
        .from('inscriptions_camps')
        .select('id, benevole_id, prenom_nom, presence, courriel, telephone, camp_nom, camp_dates, camp_lieu, sync_status, monday_item_id, created_at, presence_updated_at')
        .eq('session_id', selectedCampId)
        .order('prenom_nom')

      if (error) { console.error(error); setLoadingInscrits(false); return }
      if (!data || data.length === 0) { setInscriptions([]); setLoadingInscrits(false); return }

      // Étape 2 — données complémentaires des réservistes
      const benevoleIds = data.map((r: any) => r.benevole_id).filter(Boolean)
      const { data: resData } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom, region, groupe, remboursement_bottes_date, allergies_alimentaires, allergies_autres, conditions_medicales')
        .in('benevole_id', benevoleIds)

      const resMap = new Map((resData || []).map((r: any) => [r.benevole_id, r]))

      const flat: Inscription[] = data.map((row: any) => {
        const res = resMap.get(row.benevole_id)
        return {
          id: row.id,
          benevole_id: row.benevole_id,
          prenom_nom: row.prenom_nom,
          presence: row.presence,
          statut_inscription: 'Inscrit',
          courriel: row.courriel,
          telephone: row.telephone,
          camp_nom: row.camp_nom,
          camp_dates: row.camp_dates,
          camp_lieu: row.camp_lieu,
          sync_status: row.sync_status,
          monday_item_id: row.monday_item_id,
          created_at: row.created_at,
          presence_updated_at: row.presence_updated_at ?? null,
          region: res?.region ?? null,
          groupe: res?.groupe ?? null,
          remboursement_bottes_date: res?.remboursement_bottes_date ?? null,
          allergies_alimentaires: res?.allergies_alimentaires ?? null,
          allergies_autres: res?.allergies_autres ?? null,
          conditions_medicales: res?.conditions_medicales ?? null,
          prenom: res?.prenom ?? null,
          nom: res?.nom ?? null,
        }
      })

      setInscriptions(flat)
      setLoadingInscrits(false)
    }
    loadInscrits()
  }, [selectedCampId])

  // ── Filtres ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return inscriptions.filter(i => {
      const matchSearch = !search || i.prenom_nom.toLowerCase().includes(search.toLowerCase())
        || (i.courriel || '').toLowerCase().includes(search.toLowerCase())
        || (i.region || '').toLowerCase().includes(search.toLowerCase())
      const matchPresence = filterPresence === 'tous' || i.presence === filterPresence
      return matchSearch && matchPresence
    })
  }, [inscriptions, search, filterPresence])

  const selectedCamp = camps.find(c => c.session_id === selectedCampId)
  const upcomingCamps = camps.filter(c => !c.isPast)
  const pastCamps = camps.filter(c => c.isPast)

  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // ── Mettre à jour la présence ───────────────────────────────────────────────
  async function updatePresence(inscriptionId: string, newPresence: string) {
    setUpdatingId(inscriptionId)
    const inscription = inscriptions.find(i => i.id === inscriptionId)
    if (!inscription) { setUpdatingId(null); return }

    const now = new Date().toISOString()

    // Mise à jour de la présence + date de modification
    const { error } = await supabase
      .from('inscriptions_camps')
      .update({ presence: newPresence, presence_updated_at: now })
      .eq('id', inscriptionId)

    if (error) {
      console.error('Erreur mise à jour présence:', error)
      alert('Erreur lors de la mise à jour.')
      setUpdatingId(null)
      return
    }

    // Log du changement
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminRes } = await supabase
      .from('reservistes')
      .select('prenom, nom')
      .eq('user_id', user?.id || '')
      .single()
    const modifiePar = adminRes ? `${adminRes.prenom} ${adminRes.nom}` : 'Admin'

    await supabase.from('inscriptions_camps_logs').insert({
      inscription_id: inscriptionId,
      benevole_id: inscription.benevole_id,
      session_id: selectedCampId,
      prenom_nom: inscription.prenom_nom,
      presence_avant: inscription.presence,
      presence_apres: newPresence,
      modifie_par: modifiePar,
    })

    setInscriptions(prev =>
      prev.map(i => i.id === inscriptionId
        ? { ...i, presence: newPresence, presence_updated_at: now }
        : i
      )
    )
    setUpdatingId(null)
  }
  async function exportExcel() {
    try {
      const XLSX = await import('xlsx')
      const rows = filtered.map(i => {
        const digits = (i.telephone || '').replace(/\D/g, '')
        const tel = digits.length === 11 && digits[0] === '1'
          ? `1 ${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`
          : digits.length === 10
          ? `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
          : (i.telephone || '')
        return {
          'Nom complet': i.prenom_nom,
          'Prénom': i.prenom || '',
          'Nom': i.nom || '',
          'Courriel': i.courriel || '',
          'Allergie alimentaire': i.allergies_alimentaires || '',
          'Allergie autre': i.allergies_autres || '',
          'Condition médicale': i.conditions_medicales || '',
        }
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 30 },
        { wch: 24 }, { wch: 20 }, { wch: 24 },
      ]
      const wb = XLSX.utils.book_new()
      const sheetName = (selectedCamp?.camp_nom || 'Camp')
        .replace(' - Camp de qualification', '').trim().slice(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      // Génération Blob — fiable dans tous les contextes browser
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sheetName.replace(/ /g, '_')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export Excel erreur:', err)
      alert('Erreur lors de l\'export. Voir la console pour les détails.')
    }
  }

  return (
    <>
      <PortailHeader />
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>

      {/* ── Colonne gauche : liste des camps ─────────────────────────────── */}
      <aside style={{
        width: 280,
        minWidth: 280,
        background: '#fff',
        borderRight: '1px solid #e5e7eb',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={() => router.push(retourHref)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: '0 0 10px 0', fontWeight: 500 }}
          >
            ← Retour
          </button>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>Camps</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
            {upcomingCamps.length} à venir · {pastCamps.length} passés
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 20, color: '#9ca3af', fontSize: 13 }}>Chargement...</div>
        ) : (
          <>
            {upcomingCamps.length > 0 && (
              <div>
                <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  À venir
                </div>
                {upcomingCamps.map(c => <CampItem key={c.session_id} camp={c} selected={c.session_id === selectedCampId} onClick={() => setSelectedCampId(c.session_id)} />)}
              </div>
            )}
            {pastCamps.length > 0 && (
              <div>
                <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8 }}>
                  Passés
                </div>
                {pastCamps.map(c => <CampItem key={c.session_id} camp={c} selected={c.session_id === selectedCampId} onClick={() => setSelectedCampId(c.session_id)} />)}
              </div>
            )}
          </>
        )}
      </aside>

      {/* ── Zone principale ───────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* En-tête du camp */}
        {selectedCamp && (
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e3a5f' }}>{selectedCamp.camp_nom}</h1>
                <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>📅 {selectedCamp.camp_dates}</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>📍 {selectedCamp.camp_lieu}</span>
                </div>
              </div>
              {/* Badges résumé */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge label="Total" value={selectedCamp.nb_total} color="#1e3a5f" bg="#dbeafe" />
                <Badge label="Confirmés" value={selectedCamp.nb_confirme} color="#065f46" bg="#d1fae5" />
                <Badge label="Absents" value={selectedCamp.nb_absent} color="#7f1d1d" bg="#fee2e2" />
                {selectedCamp.nb_annule > 0 && <Badge label="Annulés" value={selectedCamp.nb_annule} color="#374151" bg="#f3f4f6" />}
              </div>
            </div>

            {/* Filtres */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Rechercher un participant..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                  fontSize: 13, width: 240, outline: 'none', color: '#111827',
                }}
              />
              <select
                value={filterPresence}
                onChange={e => setFilterPresence(e.target.value)}
                style={{
                  padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db',
                  fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer',
                }}
              >
                <option value="tous">Toutes les présences</option>
                <option value="confirme">J&apos;y serai</option>
                <option value="absent">Je n&apos;y serai pas</option>
                <option value="incertain">Incertain</option>
                <option value="annule">Annulé</option>
              </select>
              {(search || filterPresence !== 'tous') && (
                <button
                  onClick={() => { setSearch(''); setFilterPresence('tous') }}
                  style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', cursor: 'pointer', color: '#6b7280' }}
                >
                  Effacer filtres
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>
                {filtered.length} participant{filtered.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={exportExcel}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: '1px solid #1e3a5f',
                  fontSize: 13, background: '#1e3a5f', color: '#fff', cursor: 'pointer',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}
              >
                ↓ Exporter Excel
              </button>
            </div>
          </div>
        )}

        {/* Tableau */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 16px' }}>
          {loadingInscrits ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Chargement des participants...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Aucun participant trouvé</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', position: 'sticky', top: 0, zIndex: 1 }}>
                  {['Nom', 'Présence', 'Inscrit le', 'Téléphone', 'Courriel', 'District', 'Bottes', 'All. alimentaire', 'All. autre', 'Condition méd.', ...(isAdmin ? [''] : [])].map((h, i) => (
                    <th key={i} style={{
                      padding: '10px 16px', textAlign: 'left', fontSize: 11,
                      fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                      letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ins, idx) => (
                  <tr
                    key={ins.id}
                    style={{
                      background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                      {ins.prenom_nom}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {isAdmin ? (
                        <div>
                          <select
                            value={ins.presence}
                            disabled={updatingId === ins.id}
                            onChange={e => updatePresence(ins.id, e.target.value)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 20,
                              border: 'none',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: updatingId === ins.id ? 'wait' : 'pointer',
                              color: PRESENCE_LABELS[ins.presence]?.color || '#374151',
                              background: PRESENCE_LABELS[ins.presence]?.bg || '#f3f4f6',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              paddingRight: 20,
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 6px center',
                            }}
                          >
                            <option value="confirme">J&apos;y serai</option>
                            <option value="absent">Je n&apos;y serai pas</option>
                            <option value="incertain">Incertain</option>
                            <option value="annule">Annulé</option>
                          </select>
                          {ins.presence_updated_at && (
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                              Modifié {new Date(ins.presence_updated_at).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      ) : presenceBadge(ins.presence)}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6b7280', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {ins.created_at
                        ? new Date(ins.created_at).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#374151' }}>
                      {ins.telephone ? (
                        <a href={`tel:${ins.telephone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                          {(() => {
                            const digits = ins.telephone.replace(/\D/g, '')
                            if (digits.length === 11 && digits[0] === '1') {
                              return `1 ${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`
                            } else if (digits.length === 10) {
                              return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
                            }
                            return ins.telephone
                          })()}
                        </a>
                      ) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ins.courriel ? (
                        <a href={`mailto:${ins.courriel}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{ins.courriel}</a>
                      ) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {ins.region || <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6b7280', textAlign: 'center' }}>
                      {ins.remboursement_bottes_date
                        ? <span style={{ color: '#065f46', fontWeight: 600 }}>✓</span>
                        : <span style={{ color: '#d1d5db' }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '10px 16px', color: ins.allergies_alimentaires && ins.allergies_alimentaires !== 'Aucun' ? '#92400e' : '#d1d5db', fontSize: 12 }}>
                      {ins.allergies_alimentaires && ins.allergies_alimentaires !== 'Aucun' ? ins.allergies_alimentaires : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: ins.allergies_autres && ins.allergies_autres !== 'Aucun' ? '#92400e' : '#d1d5db', fontSize: 12 }}>
                      {ins.allergies_autres && ins.allergies_autres !== 'Aucun' ? ins.allergies_autres : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: ins.conditions_medicales && ins.conditions_medicales !== 'Aucun' ? '#7f1d1d' : '#d1d5db', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ins.conditions_medicales && ins.conditions_medicales !== 'Aucun'
                        ? <span title={ins.conditions_medicales}>{ins.conditions_medicales}</span>
                        : '—'}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => router.push(`/admin/reservistes?benevole_id=${ins.benevole_id}`)}
                          title="Voir le profil"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#6b7280', fontSize: 16, padding: '2px 6px',
                            borderRadius: 4, transition: 'color 0.15s',
                          }}
                          onMouseOver={e => (e.currentTarget.style.color = '#1e3a5f')}
                          onMouseOut={e => (e.currentTarget.style.color = '#6b7280')}
                        >
                          →
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CampItem({ camp, selected, onClick }: { camp: Camp; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '10px 16px', border: 'none', cursor: 'pointer',
        background: selected ? '#eff6ff' : 'transparent',
        borderLeft: selected ? '3px solid #1e3a5f' : '3px solid transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? '#1e3a5f' : '#374151', lineHeight: 1.3 }}>
        {camp.camp_nom.replace(' - Camp de qualification', '').trim()}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{camp.camp_dates}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>{camp.nb_total} inscrits</span>
        {camp.nb_confirme > 0 && <span style={{ fontSize: 11, color: '#065f46' }}>· {camp.nb_confirme} ✓</span>}
        {camp.nb_absent > 0 && <span style={{ fontSize: 11, color: '#dc2626' }}>· {camp.nb_absent} ✗</span>}
      </div>
    </button>
  )
}

function Badge({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 60 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color, opacity: 0.8 }}>{label}</div>
    </div>
  )
}
