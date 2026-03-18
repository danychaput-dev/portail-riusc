'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'

type Role = 'admin' | 'coordonnateur' | 'reserviste'

interface Utilisateur {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  role: Role
  saving?: boolean
}

const ROLE_LABELS: Record<Role, string> = {
  admin: '🔴 Admin',
  coordonnateur: '🟡 Coordonnateur',
  reserviste: '⚪ Réserviste',
}

const ROLE_COLORS: Record<Role, { bg: string; border: string; text: string }> = {
  admin: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
  coordonnateur: { bg: '#fffbeb', border: '#fcd34d', text: '#d97706' },
  reserviste: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
}

export default function AdminUtilisateursPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [filtre, setFiltre] = useState('')
  const [filtreRole, setFiltreRole] = useState<Role | 'tous'>('tous')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: moi } = await supabase.from('reservistes').select('benevole_id, role').eq('user_id', user.id).single()
      if (!moi || moi.role !== 'admin') { router.push('/admin'); return }

      const { data } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom, email, role')
        .in('role', ['admin', 'coordonnateur'])
        .order('nom')

      setUtilisateurs(data || [])
      setLoading(false)
    }
    init()
  }, [])

  const changerRole = async (benevole_id: string, nouveauRole: Role) => {
    setUtilisateurs(prev => prev.map(u => u.benevole_id === benevole_id ? { ...u, saving: true } : u))
    const { error } = await supabase
      .from('reservistes')
      .update({ role: nouveauRole })
      .eq('benevole_id', benevole_id)

    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' })
      setUtilisateurs(prev => prev.map(u => u.benevole_id === benevole_id ? { ...u, saving: false } : u))
    } else {
      setUtilisateurs(prev => prev.map(u => u.benevole_id === benevole_id ? { ...u, role: nouveauRole, saving: false } : u))
      if (nouveauRole === 'reserviste') {
        setUtilisateurs(prev => prev.filter(u => u.benevole_id !== benevole_id))
      }
      setMessage({ type: 'success', text: 'Rôle mis à jour' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState<Utilisateur[]>([])
  const [rechercheEnCours, setRechercheEnCours] = useState(false)

  const chercherReserviste = async () => {
    if (!recherche.trim()) return
    setRechercheEnCours(true)
    const { data } = await supabase
      .from('reservistes')
      .select('benevole_id, prenom, nom, email, role')
      .or(`nom.ilike.%${recherche}%,prenom.ilike.%${recherche}%,email.ilike.%${recherche}%`)
      .eq('role', 'reserviste')
      .limit(10)
    setResultats(data || [])
    setRechercheEnCours(false)
  }

  const filtres = utilisateurs.filter(u => {
    const matchNom = !filtre || `${u.prenom} ${u.nom}`.toLowerCase().includes(filtre.toLowerCase()) || u.email.toLowerCase().includes(filtre.toLowerCase())
    const matchRole = filtreRole === 'tous' || u.role === filtreRole
    return matchNom && matchRole
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div><p>Chargement...</p></div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px' }}>

        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px', padding: 0 }}>← Admin</button>
          <span style={{ color: '#d1d5db' }}>|</span>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Gestion des rôles</h1>
        </div>

        {message && (
          <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '8px', backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fca5a5'}`, color: message.type === 'success' ? '#166534' : '#dc2626', fontSize: '13px' }}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        {/* Utilisateurs avec rôles élevés */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1e3a5f', flex: 1 }}>
              Admins et coordonnateurs ({utilisateurs.length})
            </h2>
            <input
              type="text"
              placeholder="Filtrer..."
              value={filtre}
              onChange={e => setFiltre(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', width: '160px', outline: 'none' }}
            />
            <select
              value={filtreRole}
              onChange={e => setFiltreRole(e.target.value as Role | 'tous')}
              style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
            >
              <option value="tous">Tous les rôles</option>
              <option value="admin">Admin</option>
              <option value="coordonnateur">Coordonnateur</option>
            </select>
          </div>

          {filtres.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Aucun résultat</div>
          ) : (
            filtres.map(u => {
              const c = ROLE_COLORS[u.role]
              return (
                <div key={u.benevole_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>
                    {(u.prenom?.[0] || '') + (u.nom?.[0] || '')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e3a5f' }}>{u.prenom} {u.nom}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{u.email}</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text, whiteSpace: 'nowrap' }}>
                    {ROLE_LABELS[u.role]}
                  </span>
                  <select
                    value={u.role}
                    disabled={u.saving}
                    onChange={e => changerRole(u.benevole_id, e.target.value as Role)}
                    style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="admin">Admin</option>
                    <option value="coordonnateur">Coordonnateur</option>
                    <option value="reserviste">Réserviste (retirer)</option>
                  </select>
                  {u.saving && <span style={{ fontSize: '12px', color: '#9ca3af' }}>⏳</span>}
                </div>
              )
            })
          )}
        </div>

        {/* Ajouter un rôle à un réserviste */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1e3a5f' }}>Promouvoir un réserviste</h2>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Nom, prénom ou courriel..."
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && chercherReserviste()}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
              />
              <button
                onClick={chercherReserviste}
                disabled={rechercheEnCours}
                style={{ padding: '8px 16px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                {rechercheEnCours ? '⏳' : '🔍 Chercher'}
              </button>
            </div>

            {resultats.length > 0 && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                {resultats.map(r => (
                  <div key={r.benevole_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e3a5f' }}>{r.prenom} {r.nom}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{r.email}</div>
                    </div>
                    <button
                      onClick={() => { changerRole(r.benevole_id, 'coordonnateur'); setResultats([]); setRecherche(''); setUtilisateurs(prev => [...prev, { ...r, role: 'coordonnateur' }]) }}
                      style={{ padding: '4px 10px', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', color: '#d97706', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      + Coordonnateur
                    </button>
                    <button
                      onClick={() => { changerRole(r.benevole_id, 'admin'); setResultats([]); setRecherche(''); setUtilisateurs(prev => [...prev, { ...r, role: 'admin' }]) }}
                      style={{ padding: '4px 10px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      + Admin
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
