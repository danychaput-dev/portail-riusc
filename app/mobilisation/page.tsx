'use client'

/**
 * Page atterrissage pour le lien "Confirmer ma présence" des courriels
 * de mobilisation (étape 8 opérations).
 *
 * Liste les déploiements où le réserviste est mobilisé (ciblages.statut = 'mobilise')
 * avec ses rotations assignées et un bouton pour signaler un empêchement.
 */

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PortailHeader from '@/app/components/PortailHeader'
import { logPageVisit } from '@/utils/logEvent'

interface Mobilisation {
  ciblage_id: string
  deployment_id: string
  identifiant: string
  nom: string
  lieu: string | null
  date_debut: string | null
  date_fin: string | null
  point_rassemblement: string | null
  statut: string
  vagues: {
    id: string
    identifiant: string | null
    numero: number
    date_debut: string
    date_fin: string
  }[]
}

export default function MobilisationPage() {
  const [loading, setLoading] = useState(true)
  const [mobilisations, setMobilisations] = useState<Mobilisation[]>([])
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/mobilisation'
        router.push(`/login?redirect=${encodeURIComponent(returnTo)}`)
        return
      }

      const { data: reserviste } = await supabase
        .from('reservistes')
        .select('benevole_id')
        .ilike('email', user.email || '')
        .single()

      if (!reserviste) {
        setLoading(false)
        return
      }

      // Charger les ciblages mobilisés
      const { data: ciblages } = await supabase
        .from('ciblages')
        .select('id, reference_id, statut')
        .eq('benevole_id', reserviste.benevole_id)
        .eq('niveau', 'deploiement')
        .eq('statut', 'mobilise')

      if (!ciblages?.length) {
        setMobilisations([])
        setLoading(false)
        logPageVisit('/mobilisation')
        return
      }

      const depIds = ciblages.map(c => c.reference_id)
      const [{ data: deps }, { data: vagues }] = await Promise.all([
        supabase.from('deployments')
          .select('id, identifiant, nom, lieu, date_debut, date_fin, statut, point_rassemblement')
          .in('id', depIds),
        supabase.from('vagues')
          .select('id, deployment_id, identifiant, numero, date_debut, date_fin')
          .in('deployment_id', depIds)
          .order('numero'),
      ])

      const vaguesParDep: Record<string, Mobilisation['vagues']> = {}
      for (const v of vagues || []) {
        if (!vaguesParDep[v.deployment_id]) vaguesParDep[v.deployment_id] = []
        vaguesParDep[v.deployment_id].push({
          id: v.id,
          identifiant: v.identifiant,
          numero: v.numero,
          date_debut: v.date_debut,
          date_fin: v.date_fin,
        })
      }

      const mobs: Mobilisation[] = (deps || []).map(d => {
        const ciblage = ciblages.find(c => c.reference_id === d.id)
        return {
          ciblage_id: ciblage?.id || '',
          deployment_id: d.id,
          identifiant: d.identifiant,
          nom: d.nom,
          lieu: d.lieu,
          date_debut: d.date_debut,
          date_fin: d.date_fin,
          point_rassemblement: d.point_rassemblement,
          statut: d.statut,
          vagues: vaguesParDep[d.id] || [],
        }
      })

      setMobilisations(mobs)
      setLoading(false)
      logPageVisit('/mobilisation')
    }
    load()
  }, [])

  function formatDate(iso: string | null): string {
    if (!iso) return ''
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>Chargement...</div>
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader subtitle="Mes mobilisations" />

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour à l&apos;accueil</a>
        </div>

        <h2 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>🚀 Mes mobilisations</h2>
        <p style={{ color: '#6b7280', margin: '0 0 24px 0', fontSize: '14px' }}>
          Vous trouverez ici les déploiements pour lesquels vous avez été officiellement mobilisé.
        </p>

        {mobilisations.length === 0 ? (
          <div style={{ padding: '32px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#1e3a5f' }}>Aucune mobilisation active</h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
              Vous n&apos;avez pas de déploiement actif pour le moment.<br/>
              Consultez <a href="/disponibilites" style={{ color: '#1e3a5f', fontWeight: 600 }}>vos disponibilités</a> pour voir les demandes en cours.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mobilisations.map(m => (
              <div key={m.deployment_id} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '2px solid #059669' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '18px', color: '#1e3a5f' }}>{m.nom}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>{m.identifiant} · Mobilisation confirmée</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0', fontSize: '14px', color: '#1f2937' }}>
                  {m.lieu && <div><span style={{ color: '#6b7280' }}>📍</span> <strong style={{ color: '#111827' }}>Lieu:</strong> <span style={{ color: '#111827' }}>{m.lieu}</span></div>}
                  {m.point_rassemblement && <div><span style={{ color: '#6b7280' }}>📌</span> <strong style={{ color: '#111827' }}>Rassemblement:</strong> <span style={{ color: '#111827' }}>{m.point_rassemblement}</span></div>}
                  {m.date_debut && <div><span style={{ color: '#6b7280' }}>📅</span> <strong style={{ color: '#111827' }}>Début:</strong> <span style={{ color: '#111827' }}>{formatDate(m.date_debut)}</span></div>}
                  {m.date_fin && <div><span style={{ color: '#6b7280' }}>📅</span> <strong style={{ color: '#111827' }}>Fin:</strong> <span style={{ color: '#111827' }}>{formatDate(m.date_fin)}</span></div>}
                </div>

                {m.vagues.length > 0 && (
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px', marginTop: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#065f46', marginBottom: '6px' }}>🔄 Rotations planifiées</div>
                    {m.vagues.map(v => (
                      <div key={v.id} style={{ fontSize: '13px', color: '#065f46', padding: '4px 0' }}>
                        <strong>{v.identifiant || `Rotation #${v.numero}`}</strong> : {formatDate(v.date_debut)} → {formatDate(v.date_fin)}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                  <a href={`/deploiement/taches?deployment=${m.deployment_id}`}
                    style={{ padding: '10px 16px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
                    📋 Voir les tâches
                  </a>
                  <a href="mailto:riusc@aqbrs.ca?subject=Empêchement pour {m.identifiant}"
                    style={{ padding: '10px 16px', backgroundColor: 'white', color: '#b91c1c', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, border: '1px solid #fca5a5' }}>
                    ⚠️ Signaler un empêchement
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '32px', padding: '16px 20px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1e40af' }}>
          <strong>💡 Important:</strong> Si vous êtes dans l&apos;impossibilité de vous présenter, contactez-nous <strong>immédiatement</strong> par courriel à <a href="mailto:riusc@aqbrs.ca" style={{ color: '#1e40af', fontWeight: 600 }}>riusc@aqbrs.ca</a>.
        </div>
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
