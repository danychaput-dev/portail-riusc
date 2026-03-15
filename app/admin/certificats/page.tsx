'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PortailHeader from '@/app/components/PortailHeader'

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
  statut?: 'idle' | 'saving' | 'saved' | 'error'
}

export default function AdminCertificatsPage() {
  const [certificats, setCertificats] = useState<CertificatEnAttente[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterNom, setFilterNom] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Vérifier que c'est un admin (benevole_id de Dany)
      const { data: reserviste } = await supabase
        .from('reservistes')
        .select('benevole_id')
        .eq('user_id', user.id)
        .single()

      if (!reserviste || reserviste.benevole_id !== '8738174928') {
        router.push('/')
        return
      }

      const { data } = await supabase
        .from('formations_benevoles')
        .select('id, benevole_id, nom_complet, nom_formation, certificat_url')
        .eq('resultat', 'En attente')
        .not('certificat_url', 'is', null)
        .is('date_reussite', null)
        .is('monday_item_id', null)
        .order('nom_complet')

      if (data) {
        const enriched = await Promise.all(data.map(async (item) => {
          const { data: res } = await supabase
            .from('reservistes')
            .select('email')
            .eq('benevole_id', item.benevole_id)
            .single()

          let signedUrl = ''
          if (item.certificat_url?.startsWith('storage:')) {
            const path = item.certificat_url.replace('storage:', '')
            const { data: signed } = await supabase.storage
              .from('certificats')
              .createSignedUrl(path, 3600)
            signedUrl = signed?.signedUrl || ''
          }

          return {
            ...item,
            email: res?.email || '',
            signedUrl,
            dateInput: '',
            dateExpiration: '',
            statut: 'idle' as const,
          }
        }))
        setCertificats(enriched)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const handleDateChange = (id: string, value: string) => {
    setCertificats(prev => prev.map(c => c.id === id ? { ...c, dateInput: value } : c))
  }

  const handleDateExpirationChange = (id: string, value: string) => {
    setCertificats(prev => prev.map(c => c.id === id ? { ...c, dateExpiration: value } : c))
  }

  const handleApprouver = async (id: string) => {
    const cert = certificats.find(c => c.id === id)
    if (!cert?.dateInput) return

    setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'saving' } : c))

    const { error } = await supabase
      .from('formations_benevoles')
      .update({
        resultat: 'Réussi',
        date_reussite: cert.dateInput,
        ...(cert.dateExpiration ? { date_expiration: cert.dateExpiration } : {}),
      })
      .eq('id', id)

    if (error) {
      setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'error' } : c))
    } else {
      setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'saved' } : c))
      setSavedCount(n => n + 1)
    }
  }

  const filtered = certificats.filter(c =>
    !filterNom || c.nom_complet.toLowerCase().includes(filterNom.toLowerCase())
  )

  const pending = certificats.filter(c => c.statut !== 'saved')
  const selected = certificats.find(c => c.id === selectedId)
  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|JPG|JPEG|PNG)$/i.test(url)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <p>Chargement des certificats...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader subtitle="Admin — Validation des certificats" />

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ color: '#1e3a5f', margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700' }}>
              🗂️ Validation des certificats
            </h1>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
              {pending.length} en attente · {savedCount} approuvés cette session
            </p>
          </div>
          <a href="/" style={{ padding: '8px 16px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}>
            ← Retour au portail
          </a>
        </div>

        {/* Filtre */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="🔍 Filtrer par nom..."
            value={filterNom}
            onChange={e => setFilterNom(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '280px', outline: 'none' }}
          />
        </div>

        {/* Layout 2 colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '20px', alignItems: 'start' }}>

          {/* Colonne gauche — liste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', paddingRight: '4px' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', backgroundColor: 'white', borderRadius: '12px' }}>
                Aucun certificat en attente 🎉
              </div>
            )}
            {filtered.map(cert => (
              <div
                key={cert.id}
                onClick={() => setSelectedId(cert.id)}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  border: selectedId === cert.id
                    ? '2px solid #1e3a5f'
                    : cert.statut === 'saved'
                    ? '2px solid #059669'
                    : cert.statut === 'error'
                    ? '2px solid #dc2626'
                    : '1px solid #e5e7eb',
                  opacity: cert.statut === 'saved' ? 0.55 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', color: '#111827', fontSize: '14px', marginBottom: '2px' }}>
                      {cert.statut === 'saved' ? '✅ ' : ''}{cert.nom_complet}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cert.nom_formation}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{cert.email}</div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    backgroundColor: cert.statut === 'saved' ? '#d1fae5' : '#fef3c7',
                    color: cert.statut === 'saved' ? '#065f46' : '#92400e',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    whiteSpace: 'nowrap',
                    fontWeight: '600',
                    flexShrink: 0,
                  }}>
                    {cert.statut === 'saved' ? 'Approuvé' : 'En attente'}
                  </span>
                </div>

                {/* Saisie date — visible si sélectionné et pas encore approuvé */}
                {selectedId === cert.id && cert.statut !== 'saved' && (
                  <div
                    style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                          DATE DE RÉUSSITE *
                        </label>
                        <input
                          type="date"
                          value={cert.dateInput || ''}
                          onChange={e => handleDateChange(cert.id, e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                          DATE D'EXPIRATION <span style={{ color: '#9ca3af', fontWeight: '400' }}>(optionnel)</span>
                        </label>
                        <input
                          type="date"
                          value={cert.dateExpiration || ''}
                          onChange={e => handleDateExpirationChange(cert.id, e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <button
                        onClick={() => handleApprouver(cert.id)}
                        disabled={!cert.dateInput || cert.statut === 'saving'}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: cert.dateInput ? '#059669' : '#e5e7eb',
                          color: cert.dateInput ? 'white' : '#9ca3af',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: cert.dateInput ? 'pointer' : 'not-allowed',
                          whiteSpace: 'nowrap',
                          transition: 'background-color 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        {cert.statut === 'saving' ? '⏳' : '✅ Approuver'}
                      </button>
                    </div>
                  </div>
                )}

                {cert.statut === 'error' && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626' }}>
                    ❌ Erreur lors de la sauvegarde — réessayez
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Colonne droite — aperçu certificat */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            position: 'sticky',
            top: '20px',
            minHeight: '500px',
          }}>
            {!selected ? (
              <div style={{ padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>📄</div>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '500' }}>Sélectionnez un certificat pour le visualiser</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>Le fichier s'affichera ici</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '15px' }}>{selected.nom_complet}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{selected.nom_formation}</div>
                  </div>
                  {selected.signedUrl && (
                    <a
                      href={selected.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: '6px 12px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}
                    >
                      ↗ Ouvrir
                    </a>
                  )}
                </div>
                <div style={{ height: 'calc(100vh - 300px)' }}>
                  {selected.signedUrl ? (
                    isImage(selected.certificat_url) ? (
                      <img
                        src={selected.signedUrl}
                        alt="Certificat"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '20px', boxSizing: 'border-box' }}
                      />
                    ) : (
                      <iframe
                        src={selected.signedUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Certificat PDF"
                      />
                    )
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
                      <p>Impossible de charger le fichier</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
