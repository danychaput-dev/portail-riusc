'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'


interface StatCount {
  sinistres_actifs: number
  deploiements_actifs: number
  certificats_en_attente: number
  reservistes_total: number
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
  const [stats, setStats] = useState<StatCount>({ sinistres_actifs: 0, deploiements_actifs: 0, certificats_en_attente: 0, reservistes_total: 0 })
  const [nomAdmin, setNomAdmin] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: res } = await supabase.from('reservistes').select('benevole_id, role, prenom, nom').eq('user_id', user.id).single()
      if (!res || res.role !== 'admin') { router.push('/'); return }
      setNomAdmin(res.prenom || '')

      // Charger les stats en parallèle
      const [sinistres, deploiements, certificats, reservistes] = await Promise.all([
        supabase.from('sinistres').select('id', { count: 'exact', head: true }).eq('statut', 'Actif'),
        supabase.from('deploiements_actifs').select('id', { count: 'exact', head: true }),
        supabase.from('formations_benevoles').select('id', { count: 'exact', head: true }).eq('resultat', 'En attente').not('certificat_url', 'is', null).is('date_reussite', null),
        supabase.from('reservistes').select('benevole_id', { count: 'exact', head: true }),
      ])

      setStats({
        sinistres_actifs: sinistres.count || 0,
        deploiements_actifs: deploiements.count || 0,
        certificats_en_attente: certificats.count || 0,
        reservistes_total: reservistes.count || 0,
      })
      setLoading(false)
    }
    init()
  }, [])

  const modules: Module[] = [
    {
      titre: 'Sinistres',
      description: 'Créer et gérer les sinistres, suivre les demandes d\'aide par organisme',
      icone: '🚨',
      href: '/admin/sinistres',
      couleur: '#dc2626',
      statut: 'actif',
      badge: stats.sinistres_actifs || undefined,
    },
    {
      titre: 'Déploiements',
      description: 'Gérer les déploiements actifs, les vagues et les assignations',
      icone: '🚁',
      href: '/admin/deploiements',
      couleur: '#2563eb',
      statut: 'bientot',
      badge: stats.deploiements_actifs || undefined,
    },
    {
      titre: 'Ciblage',
      description: 'Composer et valider les listes de réservistes ciblés avant envoi',
      icone: '🎯',
      href: '/admin/ciblage',
      couleur: '#7c3aed',
      statut: 'actif',
    },
    {
      titre: 'Validation certificats',
      description: 'Approuver les certificats soumis par les réservistes',
      icone: '🗂️',
      href: '/admin/certificats',
      couleur: '#059669',
      statut: 'actif',
      badge: stats.certificats_en_attente || undefined,
    },
    {
      titre: 'Réservistes',
      description: `${stats.reservistes_total} réservistes — consulter les dossiers et compétences`,
      icone: '👥',
      href: '/admin/reservistes',
      couleur: '#0891b2',
      statut: 'bientot',
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
          {[
            { label: 'Sinistres actifs', valeur: stats.sinistres_actifs, icone: '🚨', couleur: '#fef2f2', border: '#fca5a5', texte: '#dc2626' },
            { label: 'Déploiements', valeur: stats.deploiements_actifs, icone: '🚁', couleur: '#eff6ff', border: '#bfdbfe', texte: '#2563eb' },
            { label: 'Certificats en attente', valeur: stats.certificats_en_attente, icone: '🗂️', couleur: '#f0fdf4', border: '#bbf7d0', texte: '#059669' },
            { label: 'Réservistes', valeur: stats.reservistes_total, icone: '👥', couleur: '#f0f9ff', border: '#bae6fd', texte: '#0891b2' },
          ].map((stat) => (
            <div key={stat.label} style={{ backgroundColor: stat.couleur, border: `1px solid ${stat.border}`, borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{stat.icone}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: stat.texte }}>{stat.valeur}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
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
