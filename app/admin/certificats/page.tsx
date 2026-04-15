'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ModalComposeCourriel from '@/app/components/ModalComposeCourriel'

interface CertificatEnAttente {
  id: string
  benevole_id: string
  nom_complet: string
  nom_formation: string
  certificat_url: string
  email: string
  signedUrl?: string
  dateInput?: string
  dateExpiration?: string
  statut?: 'idle' | 'saving' | 'saved' | 'refused' | 'error'
}

interface CertificatACompleter {
  id: string
  benevole_id: string
  nom_complet: string
  nom_formation: string
  email: string
}

interface DownloadedFile {
  storagePath: string
  signedUrl: string
  name: string
  file: File
}

interface MondayItem {
  monday_item_id: number
  nom: string
  email: string
  files: { name: string; url: string }[]
  downloadedFiles?: DownloadedFile[]
  mState: {
    status: 'idle' | 'saving' | 'saved' | 'error' | 'skipped'
    formation: string
    dateObtention: string
    dateExpiration: string
    error?: string
    uploadedFile?: File
    selectedStoragePath?: string
    selectedSignedUrl?: string
  }
}

const FORMATIONS = [
  "S'initier à la sécurité civile (MSP)",
  "Introduction à la sécurité civile",
  "Cours ICS/SCI 100",
  "Cours ICS/SCI 200",
  "Premiers soins / RCR",
  "Radio amateur",
  "Prévention incendie",
  "Formation RIUSC",
  "Autre",
]

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)/i.test(url)
function initials(nom: string | null | undefined) {
  if (!nom) return '??'
  const p = nom.trim().split(' ')
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}

function formationsMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (norm(a) === norm(b)) return true
  const initierKeys = ['sinitier', 'initierlasecuritecivile', 'securitecivile', 'msp']
  const aIsInitier = initierKeys.some(k => norm(a).includes(k))
  const bIsInitier = initierKeys.some(k => norm(b).includes(k))
  if (aIsInitier && bIsInitier) return true
  return false
}

function detectFormation(files: { name: string; url: string }[]): string {
  const text = files.map(f => f.name + ' ' + f.url).join(' ').toLowerCase()
  if (/initier|msp|s-initier|sinitier|securite.civile|s%c3%a9curit|ssc/.test(text)) return "S'initier à la sécurité civile (MSP)"
  if (/incendie/.test(text)) return 'Prévention incendie'
  if (/radio.amateur/.test(text)) return 'Radio amateur'
  if (/premiers.soins|rcr|secourisme/.test(text)) return 'Premiers soins / RCR'
  if (/ics.?100|sci.?100/.test(text)) return 'Cours ICS/SCI 100'
  if (/ics.?200|sci.?200/.test(text)) return 'Cours ICS/SCI 200'
  if (/riusc/.test(text)) return 'Formation RIUSC'
  return "S'initier à la sécurité civile (MSP)"
}

// 101 personnes avec certificats Monday sans entree dans formations_benevoles
// MONDAY_RAW vidé le 2026-04-14 : les 152 entrées ont été migrées vers formations_benevoles
// via scripts/migration_monday_pdfs/. Le code Monday ci-dessous est conservé temporairement
// comme dette technique à nettoyer (voir /admin/certificats tab Monday masqué).
const MONDAY_RAW: Omit<MondayItem, 'mState'>[] = []

export default function AdminCertificatsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [certificats, setCertificats] = useState<CertificatEnAttente[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterNom, setFilterNom] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'portail' | 'monday' | 'a_completer'>('portail')
  const [certifsACompleter, setCertifsACompleter] = useState<CertificatACompleter[]>([])
  const [filterACompleter, setFilterACompleter] = useState('')
  const [mondayItems, setMondayItems] = useState<MondayItem[]>([])
  const [mondaySelectedId, setMondaySelectedId] = useState<number | null>(null)
  const [mondayViewFileIdx, setMondayViewFileIdx] = useState(0)
  const [mondayFilter, setMondayFilter] = useState('')
  const [adminBenevoleId, setAdminBenevoleId] = useState<string>('')
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number; active: boolean }>({ done: 0, total: 0, active: false })
  const [composeDestinataire, setComposeDestinataire] = useState<{ benevole_id: string; email: string; prenom: string; nom: string } | null>(null)

  const downloadFirst50 = async () => {
    const toDownload = mondayItems.filter(i => i.mState.status === 'idle' && !i.downloadedFiles).slice(0, 50)
    if (!toDownload.length) return
    setDownloadProgress({ done: 0, total: toDownload.length, active: true })
    let done = 0
    for (const item of toDownload) {
      const downloaded: DownloadedFile[] = []
      for (let idx = 0; idx < item.files.length; idx++) {
        const f = item.files[idx]
        try {
          const proxyUrl = `/api/monday-proxy?url=${encodeURIComponent(f.url)}`
          const res = await fetch(proxyUrl)
          if (!res.ok) continue
          const contentType = res.headers.get('content-type') || ''
          // Rejeter si le proxy retourne du HTML (page d'erreur Monday ou redirect)
          if (contentType.includes('text/html')) continue
          const blob = await res.blob()
          // Forcer le bon type selon l'extension si le blob type est générique
          const ext = f.name.split('.').pop()?.toLowerCase() || 'pdf'
          const mimeMap: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }
          const resolvedType = (blob.type && !blob.type.includes('octet-stream')) ? blob.type : (mimeMap[ext] || 'application/pdf')
          const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
          const storagePath = `monday_temp/${item.monday_item_id}_${idx}_${safeName}`
          const file = new File([blob], safeName, { type: resolvedType })
          const { error: upErr } = await supabase.storage.from('certificats').upload(storagePath, file, { upsert: true, contentType: resolvedType })
          if (upErr) continue
          const { data: signed } = await supabase.storage.from('certificats').createSignedUrl(storagePath, 3600 * 24)
          if (!signed?.signedUrl) continue
          downloaded.push({ storagePath, signedUrl: signed.signedUrl, name: f.name, file })
        } catch {}
      }
      if (downloaded.length > 0) {
        setMondayItems(prev => prev.map(i => {
          if (i.monday_item_id !== item.monday_item_id) return i
          const autoSelect = downloaded.length === 1 ? {
            uploadedFile: downloaded[0].file,
            selectedStoragePath: downloaded[0].storagePath,
            selectedSignedUrl: downloaded[0].signedUrl,
          } : {}
          return { ...i, downloadedFiles: downloaded, mState: { ...i.mState, ...autoSelect } }
        }))
      }
      done++
      setDownloadProgress(p => ({ ...p, done }))
    }
    setDownloadProgress(p => ({ ...p, active: false }))
  }

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: reserviste } = await supabase.from('reservistes').select('benevole_id, role').eq('user_id', user.id).single()
      if (!reserviste || !reserviste.benevole_id || !reserviste.role || !['superadmin', 'admin'].includes(reserviste.role)) { router.push('/'); return }
      setAdminBenevoleId(reserviste.benevole_id)

      // ═══ PHASE 1 : 3 requêtes indépendantes en parallèle ═══
      const mondayIds = MONDAY_RAW.map(i => i.monday_item_id)
      const [mondayResult, portailResult, aCompleterResult] = await Promise.allSettled([
        // Monday: quels items sont déjà traités?
        supabase.from('formations_benevoles').select('monday_item_id').in('monday_item_id', mondayIds).is('deleted_at', null),
        // Portail: certificats en attente d'approbation (avec fichier)
        supabase.from('formations_benevoles')
          .select('id, benevole_id, nom_complet, nom_formation, certificat_url')
          .eq('resultat', 'En attente')
          .not('certificat_url', 'is', null)
          .is('date_reussite', null)
          .is('monday_item_id', null)
          .is('deleted_at', null)
          .order('nom_complet'),
        // À compléter: certificats déclarés sans fichier
        supabase.from('formations_benevoles')
          .select('id, benevole_id, nom_complet, nom_formation')
          .eq('resultat', 'En attente')
          .is('certificat_url', null)
          .is('date_reussite', null)
          .is('monday_item_id', null)
          .is('deleted_at', null)
          .order('nom_complet'),
      ])

      const existingMonday = mondayResult.status === 'fulfilled' ? mondayResult.value?.data || [] : []
      const portailData = portailResult.status === 'fulfilled' ? portailResult.value?.data || [] : []
      const aCompleterData = aCompleterResult.status === 'fulfilled' ? aCompleterResult.value?.data || [] : []

      // ═══ PHASE 2 : Monday — résoudre emails + formations existantes en parallèle ═══
      const alreadyDone = new Set(existingMonday.map((r: any) => r.monday_item_id))
      const remaining = MONDAY_RAW.filter(item => !alreadyDone.has(item.monday_item_id))
      const emails = remaining.map(i => i.email.toLowerCase())

      // Collecter tous les benevole_ids nécessaires pour portail + à compléter
      const allPortailBIds = [...new Set(portailData.map((d: any) => d.benevole_id))]
      const allACompleterBIds = [...new Set(aCompleterData.map((c: any) => c.benevole_id))]
      const allBIdsNeeded = [...new Set([...allPortailBIds, ...allACompleterBIds])]

      const [emailsResult, reservistesInfoResult] = await Promise.allSettled([
        // Résoudre emails Monday → benevole_id
        emails.length > 0
          ? supabase.from('reservistes').select('benevole_id, email').in('email', emails)
          : Promise.resolve({ data: [] }),
        // Noms + emails pour portail ET à compléter (une seule requête bulk)
        allBIdsNeeded.length > 0
          ? supabase.from('reservistes').select('benevole_id, email, prenom, nom').in('benevole_id', allBIdsNeeded)
          : Promise.resolve({ data: [] }),
      ])

      const reservistesFound = emailsResult.status === 'fulfilled' ? (emailsResult.value as any)?.data || [] : []
      const emailToBenevoleId = new Map<string, string>(reservistesFound.map((r: any) => [r.email.toLowerCase(), r.benevole_id]))

      // Map globale benevole_id → info (réutilisée pour portail + à compléter)
      const reservistesInfo = reservistesInfoResult.status === 'fulfilled' ? (reservistesInfoResult.value as any)?.data || [] : []
      const infoMap = new Map<string, { email: string; prenom: string; nom: string }>()
      for (const r of reservistesInfo) infoMap.set(r.benevole_id, { email: r.email || '', prenom: r.prenom || '', nom: r.nom || '' })

      // ═══ PHASE 3 : Formations existantes pour déduplication (Monday + Portail) en parallèle ═══
      const mondayBenevoleIds = [...new Set([...emailToBenevoleId.values()])]
      const allDeduplicationBIds = [...new Set([...mondayBenevoleIds, ...allPortailBIds])]

      const { data: allExistingFormations } = allDeduplicationBIds.length > 0
        ? await supabase.from('formations_benevoles').select('benevole_id, nom_formation, resultat').in('benevole_id', allDeduplicationBIds).is('deleted_at', null)
        : { data: [] }

      // Map benevole_id → set de toutes les formations
      const formationsByBenevole = new Map<string, Set<string>>()
      const approuveesByBenevole = new Map<string, Set<string>>()
      for (const f of allExistingFormations || []) {
        if (!f.benevole_id || !f.nom_formation) continue
        if (!formationsByBenevole.has(f.benevole_id)) formationsByBenevole.set(f.benevole_id, new Set())
        formationsByBenevole.get(f.benevole_id)!.add(f.nom_formation.toLowerCase().trim())
        if (f.resultat === 'Réussi') {
          if (!approuveesByBenevole.has(f.benevole_id)) approuveesByBenevole.set(f.benevole_id, new Set())
          approuveesByBenevole.get(f.benevole_id)!.add(f.nom_formation.toLowerCase().trim())
        }
      }

      // ═══ Monday : filtrer et afficher ═══
      const finalItems = remaining.filter(item => {
        const benevoleId = emailToBenevoleId.get(item.email.toLowerCase())
        if (!benevoleId) return true
        const detectedFormation = detectFormation(item.files)
        const existing = formationsByBenevole.get(benevoleId)
        if (!existing) return true
        return ![...existing].some(f => formationsMatch(f, detectedFormation))
      })

      setMondayItems(
        finalItems.map(item => ({ ...item, mState: { status: 'idle', formation: detectFormation(item.files), dateObtention: '', dateExpiration: '' } }))
      )

      // ═══ Portail : enrichir avec noms + signed URLs (batch, pas N+1) ═══
      if (portailData.length > 0) {
        const dataFiltered = portailData.filter((item: any) => {
          const existing = approuveesByBenevole.get(item.benevole_id)
          if (!existing) return true
          return ![...existing].some(f => formationsMatch(f, item.nom_formation))
        })

        // Générer les signed URLs en batch (max 5 en parallèle pour éviter rate limit)
        const storagePaths = dataFiltered
          .filter((item: any) => item.certificat_url?.startsWith('storage:'))
          .map((item: any) => ({ id: item.id, path: item.certificat_url.replace('storage:', '') }))

        const signedUrlMap = new Map<string, string>()
        // Batch de 10 signed URLs à la fois
        for (let i = 0; i < storagePaths.length; i += 10) {
          const batch = storagePaths.slice(i, i + 10)
          const results = await Promise.allSettled(
            batch.map(({ path }) => supabase.storage.from('certificats').createSignedUrl(path, 3600))
          )
          results.forEach((res, idx) => {
            if (res.status === 'fulfilled' && res.value?.data?.signedUrl) {
              signedUrlMap.set(batch[idx].id, res.value.data.signedUrl)
            }
          })
        }

        const enriched: CertificatEnAttente[] = dataFiltered.map((item: any) => {
          const info = infoMap.get(item.benevole_id)
          const nomComplet = item.nom_complet || (info ? `${info.prenom} ${info.nom}`.trim() : '') || 'Inconnu'
          return {
            ...item,
            nom_complet: nomComplet,
            email: info?.email || '',
            signedUrl: signedUrlMap.get(item.id) || '',
            dateInput: '',
            dateExpiration: '',
            statut: 'idle' as const,
          }
        })
        setCertificats(enriched)
      }

      // ═══ À compléter : enrichir avec noms (déjà chargés dans infoMap) ═══
      if (aCompleterData.length > 0) {
        setCertifsACompleter(aCompleterData.map((c: any) => ({
          ...c,
          nom_complet: c.nom_complet || (infoMap.get(c.benevole_id) ? `${infoMap.get(c.benevole_id)!.prenom} ${infoMap.get(c.benevole_id)!.nom}`.trim() : '') || 'Inconnu',
          email: infoMap.get(c.benevole_id)?.email || '',
        })))
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handleDateChange = (id: string, value: string) => setCertificats(prev => prev.map(c => c.id === id ? { ...c, dateInput: value } : c))
  const handleDateExpirationChange = (id: string, value: string) => setCertificats(prev => prev.map(c => c.id === id ? { ...c, dateExpiration: value } : c))
  const handleApprouver = async (id: string) => {
    const cert = certificats.find(c => c.id === id)
    if (!cert?.dateInput) return
    setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'saving' } : c))
    try {
      const res = await fetch('/api/admin/approuver-formation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          date_reussite: cert.dateInput,
          date_expiration: cert.dateExpiration || null,
          admin_benevole_id: adminBenevoleId,
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'saved' } : c))
      setSavedCount(n => n + 1)
      window.dispatchEvent(new CustomEvent('certificats-badge-update', { detail: { delta: -1 } }))
    } catch {
      setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'error' } : c))
    }
  }

  const handleRefuser = async (id: string) => {
    if (!confirm('Refuser ce certificat ? Le reserviste pourra soumettre un nouveau fichier.')) return
    setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'saving' } : c))
    try {
      const res = await fetch('/api/admin/approuver-formation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, admin_benevole_id: adminBenevoleId }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'refused' } : c))
      window.dispatchEvent(new CustomEvent('certificats-badge-update', { detail: { delta: -1 } }))
    } catch {
      setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'error' } : c))
    }
  }

  const handleSupprimer = async (id: string) => {
    if (!confirm('Supprimer ce fichier ? Le certificat sera remis en attente sans fichier. Le reserviste devra re-telecharger.')) return
    setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'saving' } : c))
    try {
      const res = await fetch(`/api/admin/approuver-formation?id=${id}&admin_benevole_id=${adminBenevoleId}`, {
        method: 'DELETE',
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setCertificats(prev => prev.filter(c => c.id !== id))
      setSelectedId(null)
      window.dispatchEvent(new CustomEvent('certificats-badge-update', { detail: { delta: -1 } }))
    } catch {
      setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'error' } : c))
    }
  }

  const updMonday = (id: number, field: keyof MondayItem['mState'], val: string) =>
    setMondayItems(prev => prev.map(i => i.monday_item_id === id ? { ...i, mState: { ...i.mState, [field]: val } } : i))
  const handleApprouverMonday = async (item: MondayItem) => {
    if (!item.mState.dateObtention) return
    setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
      ? { ...i, mState: { ...i.mState, status: 'saving' } } : i))
    try {
      // 1. Trouver le benevole_id par email
      const { data: res } = await supabase.from('reservistes').select('benevole_id').ilike('email', item.email).single()
      if (!res?.benevole_id) throw new Error(`Réserviste introuvable pour ${item.email}`)
      const benevoleId = res.benevole_id

      let certificatUrl = item.files[0]?.url || ''

      // 2. Utiliser le fichier déjà téléchargé (pre-downloaded) OU upload manuel
      if (item.mState.selectedStoragePath) {
        // Déjà dans Storage via downloadFirst50 — déplacer vers dossier final
        const src = item.mState.selectedStoragePath
        const ext = src.split('.').pop()?.toLowerCase() || 'pdf'
        const destPath = `${benevoleId}/${item.mState.formation.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${item.monday_item_id}.${ext}`
        // Copier via re-upload du même blob (Storage ne supporte pas copy entre chemins)
        const dlFile = item.downloadedFiles?.find(d => d.storagePath === src)
        if (dlFile) {
          await supabase.storage.from('certificats').upload(destPath, dlFile.file, { contentType: dlFile.file.type, upsert: true })
          await supabase.storage.from('certificats').remove([src])
        }
        certificatUrl = `storage:${destPath}`
      } else if (item.mState.uploadedFile) {
        // Upload manuel
        const file = item.mState.uploadedFile
        const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
        const storagePath = `${benevoleId}/${item.mState.formation.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${item.monday_item_id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('certificats')
          .upload(storagePath, file, { contentType: file.type || 'application/pdf', upsert: true })
        if (uploadError) throw new Error(`Upload Storage: ${uploadError.message}`)
        certificatUrl = `storage:${storagePath}`
      }

      // 3. Insert via route API (service_role — bypass RLS)
      const apiRes = await fetch('/api/admin/approuver-formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: benevoleId,
          monday_item_id: item.monday_item_id,
          nom_complet: item.nom,
          nom_formation: item.mState.formation,
          date_reussite: item.mState.dateObtention,
          date_expiration: item.mState.dateExpiration || null,
          certificat_url: certificatUrl,
          initiation_sc_completee: item.mState.formation.toLowerCase().includes('initier')
            || item.mState.formation.toLowerCase().includes('sécurité civile')
            || item.mState.formation.toLowerCase().includes('securite civile'),
          admin_benevole_id: adminBenevoleId,
        }),
      })
      if (!apiRes.ok) { const e = await apiRes.json(); throw new Error(e.error) }

      setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
        ? { ...i, mState: { ...i.mState, status: 'saved' } } : i))
    } catch (err: any) {
      setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
        ? { ...i, mState: { ...i.mState, status: 'error', error: err.message } } : i))
    }
  }
  const skipMonday = (id: number) => setMondayItems(prev => prev.map(i => i.monday_item_id === id ? { ...i, mState: { ...i.mState, status: 'skipped' } } : i))
  const undoMonday = (id: number) => setMondayItems(prev => prev.map(i => i.monday_item_id === id ? { ...i, mState: { ...i.mState, status: 'idle', error: undefined } } : i))

  const filtered = certificats.filter(c => !filterNom || c.nom_complet.toLowerCase().includes(filterNom.toLowerCase()))
  const pending = certificats.filter(c => c.statut !== 'saved')
  const selected = certificats.find(c => c.id === selectedId)
  const mondayFiltered = mondayItems.filter(i => i.mState.status !== 'skipped' && (!mondayFilter || i.nom.toLowerCase().includes(mondayFilter.toLowerCase()) || i.email.toLowerCase().includes(mondayFilter.toLowerCase())))
  const mondaySelected = mondayItems.find(i => i.monday_item_id === mondaySelectedId)
  const mondaySavedCount = mondayItems.filter(i => i.mState.status === 'saved').length
  const mondayPendingCount = mondayItems.filter(i => i.mState.status === 'idle' || i.mState.status === 'error').length

  // Regrouper les certificats portail par personne
  const filteredGrouped = (() => {
    const map = new Map<string, CertificatEnAttente[]>()
    for (const c of filtered) {
      const key = c.benevole_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return [...map.entries()].map(([benevoleId, certs]) => ({
      benevoleId,
      nom: certs[0].nom_complet,
      email: certs[0].email,
      certs,
    }))
  })()

  // Regrouper les certificats à compléter par personne
  const aCompleterFiltered = certifsACompleter.filter(c => !filterACompleter || c.nom_complet.toLowerCase().includes(filterACompleter.toLowerCase()))
  const aCompleterGrouped = (() => {
    const map = new Map<string, CertificatACompleter[]>()
    for (const c of aCompleterFiltered) {
      const key = c.benevole_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return [...map.entries()].map(([benevoleId, certs]) => ({
      benevoleId,
      nom: certs[0].nom_complet,
      email: certs[0].email,
      certs,
    }))
  })()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div><p>Chargement des certificats...</p></div>
      </div>
    )
  }


  const tabBtn = (tab: 'portail' | 'monday' | 'a_completer', label: string) => (
    <button onClick={() => setActiveTab(tab)} style={{ padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === tab ? '700' : '400', color: activeTab === tab ? '#1e3a5f' : '#6b7280', borderBottom: activeTab === tab ? '2px solid #1e3a5f' : '2px solid transparent', marginBottom: '-2px' }}>
      {label}
    </button>
  )

  return (
    <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ color: '#1e3a5f', margin: 0, fontSize: '24px', fontWeight: '700' }}>🗂️ Validation des certificats</h1>
        <button
          onClick={() => router.push('/admin/certificats/a-trier')}
          style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          📥 Gmail Esther (à trier)
        </button>
      </div>

        {/* Onglets */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', gap: '4px' }}>
          {tabBtn('portail', `📁 Portail (${pending.length} en attente)`)}
          {tabBtn('a_completer', `📎 Certificat à ajouter (${certifsACompleter.length})`)}
          {/* Tab Monday retiré 2026-04-14 après migration complète vers formations_benevoles */}
        </div>

        {/* ════ ONGLET PORTAIL ════ */}
        {activeTab === 'portail' && (
          <>
            <p style={{ color: '#6b7280', margin: '0 0 16px', fontSize: '14px' }}>{pending.length} en attente · {savedCount} approuvés cette session · {filteredGrouped.length} personne{filteredGrouped.length > 1 ? 's' : ''}</p>
            <div style={{ marginBottom: '16px' }}>
              <input type="text" placeholder="🔍 Filtrer par nom..." value={filterNom} onChange={e => setFilterNom(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '280px', outline: 'none' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '480px 1fr', gap: '20px', alignItems: 'start' }}>
              {/* Liste regroupée par personne */}
              <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredGrouped.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', backgroundColor: 'white', borderRadius: '12px' }}>Aucun certificat en attente 🎉</div>}
                {filteredGrouped.map((group, gi) => {
                  const allSaved = group.certs.every(c => c.statut === 'saved')
                  const pendingCount = group.certs.filter(c => c.statut !== 'saved').length
                  return (
                    <div key={group.benevoleId} style={{ marginBottom: '16px' }}>
                      {/* ── En-tête personne ── */}
                      <div style={{
                        padding: '10px 14px', backgroundColor: allSaved ? '#f0fdf4' : '#f1f5f9',
                        borderRadius: '8px 8px 0 0', border: '1px solid #d1d5db', borderBottom: 'none',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        opacity: allSaved ? 0.6 : 1,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                            {initials(group.nom)}
                          </div>
                          <div>
                            <a href={`/dossier?bid=${group.benevoleId}&from=certificats`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: '700', color: '#111827', fontSize: '14px', textDecoration: 'none' }}>{allSaved ? '✅ ' : ''}{group.nom || 'Sans nom'}</a>
                            {group.email && <a href="#" onClick={e => { e.preventDefault(); const parts = (group.nom || '').trim().split(' '); setComposeDestinataire({ benevole_id: group.benevoleId, email: group.email, prenom: parts.slice(0, -1).join(' ') || parts[0] || '', nom: parts[parts.length - 1] || '' }) }} style={{ marginLeft: '8px', fontSize: '12px', color: '#3b82f6', textDecoration: 'none', cursor: 'pointer' }}>{group.email}</a>}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', backgroundColor: allSaved ? '#d1fae5' : '#fef3c7', color: allSaved ? '#065f46' : '#92400e', padding: '2px 8px', borderRadius: '10px', fontWeight: '600', flexShrink: 0 }}>
                          {allSaved ? 'Tout approuvé' : `${pendingCount} en attente`}
                        </span>
                      </div>
                      {/* ── Certificats de cette personne ── */}
                      {group.certs.map((cert, ci) => (
                        <div
                          key={cert.id}
                          onClick={() => setSelectedId(cert.id)}
                          style={{
                            padding: '12px 14px 12px 54px',
                            cursor: 'pointer',
                            border: '1px solid #d1d5db',
                            borderTop: 'none',
                            borderRadius: ci === group.certs.length - 1 ? '0 0 8px 8px' : '0',
                            backgroundColor: selectedId === cert.id ? '#dbeafe' : cert.statut === 'saved' ? '#f0fdf4' : (ci % 2 === 0 ? '#ffffff' : '#f9fafb'),
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: cert.statut === 'saved' ? '#059669' : '#1f2937', fontWeight: '600' }}>
                              {cert.statut === 'saved' ? '✅' : '📄'} {cert.nom_formation || 'Formation'}
                            </span>
                            <span style={{ fontSize: '10px', backgroundColor: cert.statut === 'saved' ? '#d1fae5' : cert.statut === 'refused' ? '#fee2e2' : '#fef3c7', color: cert.statut === 'saved' ? '#065f46' : cert.statut === 'refused' ? '#991b1b' : '#92400e', padding: '2px 8px', borderRadius: '8px', fontWeight: '600', flexShrink: 0 }}>
                              {cert.statut === 'saved' ? 'Approuvé' : cert.statut === 'refused' ? 'Refusé' : 'En attente'}
                            </span>
                          </div>
                          {selectedId === cert.id && cert.statut !== 'saved' && cert.statut !== 'refused' && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>DATE DE RÉUSSITE *</label>
                                  <input type="date" value={cert.dateInput || ''} onChange={e => handleDateChange(cert.id, e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>EXPIRATION <span style={{ color: '#9ca3af', fontWeight: '400' }}>(opt.)</span></label>
                                  <input type="date" value={cert.dateExpiration || ''} onChange={e => handleDateExpirationChange(cert.id, e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <button onClick={() => handleApprouver(cert.id)} disabled={!cert.dateInput || cert.statut === 'saving'} style={{ padding: '8px 14px', backgroundColor: cert.dateInput ? '#059669' : '#e5e7eb', color: cert.dateInput ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: cert.dateInput ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {cert.statut === 'saving' ? '⏳' : '✅ Approuver'}
                                </button>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button onClick={() => handleRefuser(cert.id)} disabled={cert.statut === 'saving'} style={{ padding: '6px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: cert.statut === 'saving' ? 'not-allowed' : 'pointer' }}>
                                  ❌ Refuser
                                </button>
                                <button onClick={() => handleSupprimer(cert.id)} disabled={cert.statut === 'saving'} style={{ padding: '6px 12px', backgroundColor: '#f9fafb', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: cert.statut === 'saving' ? 'not-allowed' : 'pointer' }}>
                                  🗑️ Supprimer le fichier
                                </button>
                              </div>
                            </div>
                          )}
                          {cert.statut === 'error' && <div style={{ marginTop: '6px', fontSize: '12px', color: '#dc2626' }}>❌ Erreur — réessayez</div>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
              {/* Prévisualisation */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', position: 'sticky', top: '20px', minHeight: '500px' }}>
                {!selected ? (
                  <div style={{ padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '56px', marginBottom: '16px' }}>📄</div><p style={{ margin: 0, fontSize: '15px', fontWeight: '500' }}>Sélectionnez un certificat pour le visualiser</p></div>
                ) : (
                  <>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><div style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '15px' }}>{selected.nom_complet}</div><div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{selected.nom_formation}</div></div>
                      {selected.signedUrl && <a href={selected.signedUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '500' }}>↗ Ouvrir</a>}
                    </div>
                    <div style={{ height: 'calc(100vh - 300px)' }}>
                      {selected.signedUrl ? (
                        isImage(selected.certificat_url)
                          ? <img src={selected.signedUrl} alt="Certificat" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '20px', boxSizing: 'border-box' }} />
                          : <iframe src={selected.signedUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Certificat PDF" />
                      ) : <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div><p>Impossible de charger le fichier</p></div>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ════ ONGLET À COMPLÉTER ════ */}
        {activeTab === 'a_completer' && (
          <>
            <p style={{ color: '#6b7280', margin: '0 0 16px', fontSize: '14px' }}>
              Compétences déclarées dans le profil sans fichier soumis. {aCompleterGrouped.length} personne{aCompleterGrouped.length > 1 ? 's' : ''} · {aCompleterFiltered.length} certificat{aCompleterFiltered.length > 1 ? 's' : ''} manquant{aCompleterFiltered.length > 1 ? 's' : ''}
            </p>
            <div style={{ marginBottom: '16px' }}>
              <input type="text" placeholder="🔍 Filtrer par nom..." value={filterACompleter} onChange={e => setFilterACompleter(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '280px', outline: 'none' }} />
            </div>
            <div style={{ maxWidth: '800px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {aCompleterGrouped.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', backgroundColor: 'white', borderRadius: '12px' }}>Aucun certificat à compléter</div>}
              {/* En-tête tableau */}
              {aCompleterGrouped.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 100px', padding: '8px 14px', backgroundColor: '#f1f5f9', borderRadius: '8px 8px 0 0', border: '1px solid #d1d5db', borderBottom: 'none', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <div>Réserviste</div>
                  <div>Courriel</div>
                  <div style={{ textAlign: 'center' }}>Manquants</div>
                </div>
              )}
              {aCompleterGrouped.map((group, gi) => (
                <div key={group.benevoleId} style={{ border: '1px solid #d1d5db', borderTop: gi === 0 ? 'none' : '1px solid #d1d5db', borderRadius: gi === aCompleterGrouped.length - 1 ? '0 0 8px 8px' : '0' }}>
                  {/* Ligne personne */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 200px 100px', padding: '10px 14px',
                    backgroundColor: gi % 2 === 0 ? '#ffffff' : '#f9fafb',
                    alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#dc2626', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                        {initials(group.nom)}
                      </div>
                      <div>
                        <a href={`/dossier?bid=${group.benevoleId}&from=certificats`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: '700', color: '#111827', fontSize: '13px', textDecoration: 'none' }}>{group.nom || 'Sans nom'}</a>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          {group.certs.map((c, ci) => (
                            <div key={ci}>📎 {c.nom_formation || 'Formation non spécifiée'}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      {group.email ? (
                        <a href="#" onClick={e => { e.preventDefault(); const parts = (group.nom || '').trim().split(' '); setComposeDestinataire({ benevole_id: group.benevoleId, email: group.email, prenom: parts.slice(0, -1).join(' ') || parts[0] || '', nom: parts[parts.length - 1] || '' }) }} style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', cursor: 'pointer' }}>
                          {group.email}
                        </a>
                      ) : <span style={{ fontSize: '12px', color: '#9ca3af' }}>—</span>}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', backgroundColor: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                        {group.certs.length}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════ ONGLET MONDAY ════ */}
        {activeTab === 'monday' && (
          <>
            <p style={{ color: '#6b7280', margin: '0 0 16px', fontSize: '14px' }}>Certificats dans Monday sans entrée dans <code>formations_benevoles</code> · {mondayPendingCount} en attente · {mondaySavedCount} approuvés cette session</p>
            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="🔍 Filtrer par nom ou courriel..." value={mondayFilter} onChange={e => setMondayFilter(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '320px', outline: 'none' }} />
              <button
                onClick={downloadFirst50}
                disabled={downloadProgress.active}
                style={{ padding: '10px 16px', backgroundColor: downloadProgress.active ? '#e5e7eb' : '#1e3a5f', color: downloadProgress.active ? '#9ca3af' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: downloadProgress.active ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {downloadProgress.active
                  ? `⏳ Téléchargement ${downloadProgress.done}/${downloadProgress.total}...`
                  : '⬇️ Télécharger les 50 premiers'}
              </button>
              {!downloadProgress.active && downloadProgress.total > 0 && (
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>✓ {downloadProgress.done}/{downloadProgress.total} téléchargés</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: '4px' }}>
                {mondayFiltered.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', backgroundColor: 'white', borderRadius: '12px' }}>Aucun certificat en attente 🎉</div>}
                {mondayFiltered.map(item => {
                  const s = item.mState
                  const isSel = mondaySelectedId === item.monday_item_id
                  return (
                    <div key={item.monday_item_id} onClick={() => { setMondaySelectedId(item.monday_item_id); setMondayViewFileIdx(0) }} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', border: isSel ? '2px solid #1e3a5f' : s.status === 'saved' ? '2px solid #059669' : s.status === 'error' ? '2px solid #dc2626' : '1px solid #e5e7eb', opacity: s.status === 'saved' ? 0.55 : 1, transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600', color: '#1d4ed8', flexShrink: 0 }}>{initials(item.nom)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{s.status === 'saved' ? '✅ ' : ''}{item.nom}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', backgroundColor: s.status === 'saved' ? '#d1fae5' : s.status === 'error' ? '#fee2e2' : '#fef3c7', color: s.status === 'saved' ? '#065f46' : s.status === 'error' ? '#991b1b' : '#92400e', padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: '600', flexShrink: 0 }}>
                          {s.status === 'saved' ? 'Approuvé' : s.status === 'error' ? 'Erreur' : s.status === 'saving' ? '⏳' : `${item.files.length} fichier${item.files.length > 1 ? 's' : ''}`}
                        </span>
                      </div>
                      <div style={{ marginTop: '5px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {item.files.slice(0, 2).map((f, i) => <span key={i} style={{ fontSize: '10px', backgroundColor: '#f3f4f6', color: '#4b5563', padding: '1px 5px', borderRadius: '3px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>)}
                        {item.files.length > 2 && <span style={{ fontSize: '10px', color: '#9ca3af' }}>+{item.files.length - 2}</span>}
                      </div>
                      {isSel && (s.status === 'idle' || s.status === 'error') && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }} onClick={e => e.stopPropagation()}>
                          <div style={{ marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px', fontWeight: '600' }}>FORMATION À ATTRIBUER</label>
                            <select value={s.formation} onChange={e => updMonday(item.monday_item_id, 'formation', e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none' }}>
                              {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            {s.selectedStoragePath ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                                <span style={{ fontSize: '13px' }}>✅</span>
                                <span style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>Fichier prêt (téléchargé automatiquement)</span>
                                <button onClick={() => setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id ? { ...i, mState: { ...i.mState, selectedStoragePath: undefined, selectedSignedUrl: undefined, uploadedFile: undefined } } : i))} style={{ marginLeft: 'auto', fontSize: '10px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>changer</button>
                              </div>
                            ) : (
                              <>
                                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px', fontWeight: '600' }}>
                                  FICHIER <span style={{ fontWeight: '400', color: '#9ca3af' }}>(optionnel — sinon l'URL Monday est conservée)</span>
                                </label>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={e => {
                                    const file = e.target.files?.[0]
                                    if (file) setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
                                      ? { ...i, mState: { ...i.mState, uploadedFile: file, error: undefined } } : i))
                                  }}
                                  style={{ width: '100%', fontSize: '11px', color: '#374151' }}
                                />
                                {s.uploadedFile && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#059669' }}>✓ {s.uploadedFile.name}</p>}
                              </>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px', fontWeight: '600' }}>DATE RÉUSSITE *</label>
                              <input type="date" value={s.dateObtention} onChange={e => updMonday(item.monday_item_id, 'dateObtention', e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px', fontWeight: '600' }}>EXPIRATION <span style={{ fontWeight: '400' }}>(opt.)</span></label>
                              <input type="date" value={s.dateExpiration} onChange={e => updMonday(item.monday_item_id, 'dateExpiration', e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
                            </div>
                            <button onClick={() => handleApprouverMonday(item)} disabled={!s.dateObtention} style={{ padding: '6px 12px', backgroundColor: s.dateObtention ? '#059669' : '#e5e7eb', color: s.dateObtention ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: s.dateObtention ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              ✅ Approuver
                            </button>
                          </div>
                          {s.error && <p style={{ marginTop: '5px', fontSize: '11px', color: '#dc2626' }}>❌ {s.error}</p>}
                          <button onClick={() => skipMonday(item.monday_item_id)} style={{ marginTop: '5px', fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ignorer cette entrée</button>
                        </div>
                      )}
                      {s.status === 'saved' && (
                        <div style={{ marginTop: '5px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <button
                            onClick={e => { e.stopPropagation(); undoMonday(item.monday_item_id) }}
                            style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            Annuler
                          </button>
                          {item.files.length > 1 && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
                                  ? { ...i, mState: { ...i.mState, status: 'idle', error: undefined, uploadedFile: undefined, dateObtention: '', dateExpiration: '' } } : i))
                              }}
                              style={{ fontSize: '11px', color: '#059669', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: '600' }}
                            >
                              + Approuver un autre fichier
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', position: 'sticky', top: '20px', minHeight: '500px' }}>
                {!mondaySelected ? (
                  <div style={{ padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '56px', marginBottom: '16px' }}>📄</div><p style={{ margin: 0, fontSize: '15px', fontWeight: '500' }}>Sélectionnez un réserviste</p><p style={{ margin: '8px 0 0', fontSize: '13px' }}>Le certificat s'affichera ici</p></div>
                ) : (
                  <>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '14px' }}>{mondaySelected.nom}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{mondaySelected.email}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {mondaySelected.files.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '11px', fontWeight: '500', whiteSpace: 'nowrap' }}>↗ {mondaySelected.files.length > 1 ? f.name.slice(0, 20) + (f.name.length > 20 ? '…' : '') : 'Ouvrir'}</a>
                        ))}
                      </div>
                    </div>
                    {/* Sélecteur de fichier si plusieurs */}
                    {mondaySelected.files.length > 1 && (
                      <div style={{ padding: '8px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {mondaySelected.files.map((f, i) => (
                          <button key={i} onClick={() => setMondayViewFileIdx(i)} style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: mondayViewFileIdx === i ? '#1e3a5f' : '#f3f4f6', color: mondayViewFileIdx === i ? 'white' : '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: mondayViewFileIdx === i ? '600' : '400' }}>
                            {isImage(f.url) ? '🖼️' : '📄'} Fichier {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ height: 'calc(100vh - 340px)' }}>
                      {(() => {
                        const idx = mondayViewFileIdx ?? 0
                        const f = mondaySelected.files[idx]
                        if (!f) return null
                        // Utiliser signed URL Storage si déjà téléchargé, sinon proxy Monday
                        const dlFile = mondaySelected.downloadedFiles?.[idx]
                        const viewUrl = dlFile?.signedUrl
                          ? dlFile.signedUrl
                          : `/api/monday-proxy?url=${encodeURIComponent(f.url)}`
                        const isImg = isImage(f.url)
                        return isImg
                          ? <img src={viewUrl} alt="Certificat" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '20px', boxSizing: 'border-box' }} />
                          : <iframe src={viewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Certificat PDF" />
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      {composeDestinataire && (
        <ModalComposeCourriel
          destinataires={[composeDestinataire]}
          onClose={() => setComposeDestinataire(null)}
        />
      )}
    </main>
  )
}
