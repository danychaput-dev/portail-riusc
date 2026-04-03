'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'


interface StatCount {
  sinistres_actifs: number
  deploiements_actifs: number
  bottes_avec: number
  bottes_sans: number
  antecedents_verifie: number
  antecedents_attente: number
  certificats_attente: number
  messages_non_lus: number
}

interface Module {
  titre: string
  description: string
  icone: string
  href: string
  couleur: string
  statut: 'actif' | 'bientot'
  badge?: number
}

export default function AdminDashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatCount>({ sinistres_actifs: 0, deploiements_actifs: 0, bottes_avec: 0, bottes_sans: 0, antecedents_verifie: 0, antecedents_attente: 0, certificats_attente: 0, messages_non_lus: 0 })
  const [nomAdmin, setNomAdmin] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('benevole_id, role, prenom, nom').eq('user_id', user.id).single()
      if (!res || !['admin', 'coordonnateur'].includes(res.role)) { router.push('/'); return }
      setNomAdmin(res.prenom || '')

      // Charger les stats en parallèle
      const [sinistres, deploiements, bottesRes, antecedentsRes, certificatsRes, lastSeenRes] = await Promise.all([
        supabase.from('sinistres').select('id', { count: 'exact', head: true }).eq('statut', 'Actif'),
        supabase.from('deploiements_actifs').select('id', { count: 'exact', head: true }),
        supabase.from('reservistes').select('remboursement_bottes_date').eq('statut', 'Actif').eq('groupe', 'Approuvé'),
        supabase.from('reservistes').select('antecedents_statut').eq('statut', 'Actif').eq('groupe', 'Approuvé'),
        supabase.from('formations_benevoles').select('id', { count: 'exact', head: true }).eq('resultat', 'En attente').not('certificat_url', 'is', null).is('date_reussite', null),
        supabase.from('community_last_seen').select('last_seen_at').eq('user_id', user.id).maybeSingle(),
      ])

      // Compter messages non lus
      const lastSeenAt = lastSeenRes.data?.last_seen_at || '1970-01-01'
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .gt('created_at', lastSeenAt)

      const approuvesBottes = bottesRes.data || []
      const approuvesAnt = antecedentsRes.data || []
      setStats({
        sinistres_actifs: sinistres.count || 0,
        deploiements_actifs: deploiements.count || 0,
        bottes_avec: approuvesBottes.filter(r => r.remboursement_bottes_date).length,
        bottes_sans: approuvesBottes.filter(r => !r.remboursement_bottes_date).length,
        antecedents_verifie: approuvesAnt.filter(r => r.antecedents_statut === 'verifie').length,
        antecedents_attente: approuvesAnt.filter(r => r.antecedents_statut !== 'verifie').length,
        certificats_attente: certificatsRes.count || 0,
        messages_non_lus: messagesCount ?? 0,
      })
      setLoading(false)
    }
    init()
  }, [])

  const modules: Module[] = [
    {
      titre: 'Opérations',
      description: 'Wizard guidé de mobilisation — sinistre, demandes, déploiement, ciblage, notifications, rotations',
      icone: '🚨',
      href: '/admin/operations',
      couleur: '#dc2626',
      statut: 'actif',
      badge: stats.sinistres_actifs || undefined,
    },
    {
      titre: 'Validation certificats',
      description: 'Approuver les certificats soumis par les réservistes',
      icone: '🗂️',
      href: '/admin/certificats',
      couleur: '#059669',
      statut: 'actif',
      badge: stats.certificats_attente || undefined,
    },
    {
      titre: 'Communauté',
      description: 'Messages, discussions et activité des réservistes',
      icone: '💬',
      href: '/communaute',
      couleur: '#8b5cf6',
      statut: 'actif',
      badge: stats.messages_non_lus || undefined,
    },
    {
      titre: 'Réservistes',
      description: 'Consulter les dossiers et compétences',
      icone: '👥',
      href: '/admin/reservistes',
      couleur: '#0891b2',
      statut: 'actif',
    },
    {
      titre: 'Dashboard public',
      description: 'Vue publique des statistiques RIUSC — inscrits, antécédents, bottes, cohortes',
      icone: '📈',
      href: '/dashboard',
      couleur: '#0891b2',
      statut: 'actif',
    },
    {
      titre: 'Statistiques',
      description: 'Trafic, connexions, utilisateurs actifs, conversions pub → inscriptions',
      icone: '📊',
      href: '/stats',
      couleur: '#7c3aed',
      statut: 'actif',
    },
    {
      titre: 'Portail partenaires',
      description: 'Accès SOPFEU, Croix-Rouge — vue lecture sur leurs déploiements',
      icone: '🤝',
      href: '/admin/partenaires',
      couleur: '#d97706',
      statut: 'bientot',
    },
    {
      titre: 'Présences & CNESST',
      description: 'Gestion des présences et génération des rapports CNESST',
      icone: '📋',
      href: '/admin/presences',
      couleur: '#be185d',
      statut: 'bientot',
    },
    {
      titre: 'Communications',
      description: 'Infolettres, annonces et historique des envois',
      icone: '📣',
      href: '/admin/communications',
      couleur: '#1e3a5f',
      statut: 'bientot',
    },
    {
      titre: 'Utilisateurs & rôles',
      description: 'Gérer les admins et coordonnateurs — ajouter ou retirer des accès',
      icone: '🔐',
      href: '/admin/utilisateurs',
      couleur: '#4f46e5',
      statut: 'actif',
    },
  ]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader />
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#1e3a5f', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⚙️</div>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#1e3a5f' }}>
                Administration RIUSC
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                Bonjour {nomAdmin} — panneau de gestion
              </p>
            </div>
          </div>
        </div>

        {/* Bande de stats rapides */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
          {/* Sinistres */}
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>🚨</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>{stats.sinistres_actifs}</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Sinistres actifs</div>
          </div>
          {/* Déploiements */}
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>🚁</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb' }}>{stats.deploiements_actifs}</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Déploiements</div>
          </div>
          {/* Bottes */}
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>🥾</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>{stats.bottes_avec}</span>
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>/ {stats.bottes_avec + stats.bottes_sans}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Bottes remboursées (approuvés)</div>
            {stats.bottes_sans > 0 && <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>{stats.bottes_sans} sans remboursement</div>}
          </div>
          {/* Antécédents */}
          <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>🔍</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: '700', color: '#0891b2' }}>{stats.antecedents_verifie}</span>
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>/ {stats.antecedents_verifie + stats.antecedents_attente}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Antécédents vérifiés (approuvés)</div>
            {stats.antecedents_attente > 0 && <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>{stats.antecedents_attente} en attente</div>}
          </div>
        </div>

        {/* Grille des modules */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {modules.map((mod) => {
            const estActif = mod.statut === 'actif'
            return (
              <div
                key={mod.titre}
                onClick={() => estActif && router.push(mod.href)}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: `1px solid ${estActif ? '#e5e7eb' : '#f3f4f6'}`,
                  padding: '20px',
                  cursor: estActif ? 'pointer' : 'default',
                  opacity: estActif ? 1 : 0.65,
                  transition: 'box-shadow 0.15s, transform 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseOver={e => {
                  if (estActif) {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                  }
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  ;(e.currentTarget as HTMLElement).style.transform = 'none'
                }}
              >
                {/* Barre couleur gauche */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', backgroundColor: mod.couleur, borderRadius: '12px 0 0 12px' }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>{mod.icone}</span>
                    <span style={{ fontWeight: '700', fontSize: '15px', color: '#1e3a5f' }}>{mod.titre}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {mod.badge !== undefined && mod.badge > 0 && (
                      <span style={{ backgroundColor: mod.couleur, color: 'white', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' }}>
                        {mod.badge}
                      </span>
                    )}
                    {!estActif && (
                      <span style={{ backgroundColor: '#f3f4f6', color: '#9ca3af', borderRadius: '20px', padding: '2px 8px', fontSize: '10px', fontWeight: '600' }}>
                        Bientôt
                      </span>
                    )}
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', lineHeight: '1.5' }}>
                  {mod.description}
                </p>

                {estActif && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: mod.couleur, fontWeight: '600' }}>
                    Ouvrir →
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Lien retour portail */}
        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>
            ← Retour au portail
          </button>
        </div>

      </main>
    </div>
  )
}
