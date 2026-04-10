'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/utils/useAuth'
import PortailHeader from '@/app/components/PortailHeader'

const C = '#1e3a5f'

interface Partenaire {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  role: string
}

interface Organisme {
  id: number
  nom: string
}

interface Demande {
  id: string
  identifiant: string
  organisme: string
  type_mission: string
  nb_personnes_requis: number
  date_debut: string
  date_fin_estimee: string | null
  statut: string
  created_at: string
}

interface Deploiement {
  id: string
  identifiant: string
  nom: string
  lieu: string
  date_debut: string
  date_fin: string | null
  statut: string
  nb_personnes_par_vague: number
}

const STATUT_DEMANDE_COLORS: Record<string, { bg: string; color: string }> = {
  'Nouvelle':      { bg: '#eff6ff', color: '#2563eb' },
  'En traitement': { bg: '#fffbeb', color: '#d97706' },
  'Complétée':     { bg: '#f0fdf4', color: '#16a34a' },
  'Annulée':       { bg: '#fef2f2', color: '#dc2626' },
}

const STATUT_DEP_COLORS: Record<string, { bg: string; color: string }> = {
  'Planifié':               { bg: '#eff6ff', color: '#2563eb' },
  'Demande disponibilités': { bg: '#fffbeb', color: '#d97706' },
  'En cours':               { bg: '#f0fdf4', color: '#16a34a' },
  'Complété':               { bg: '#f1f5f9', color: '#64748b' },
  'Annulé':                 { bg: '#fef2f2', color: '#dc2626' },
}

export default function PartenairePage() {
  const supabase = createClient()
  const router = useRouter()
  const { user: authUser, loading: authLoading } = useAuth()

  const [loading, setLoading]         = useState(true)
  const [partenaire, setPartenaire]   = useState<Partenaire | null>(null)
  const [organismes, setOrganismes]   = useState<Organisme[]>([])
  const [demandes, setDemandes]       = useState<Demande[]>([])
  const [deploiements, setDeploiements] = useState<Deploiement[]>([])
  const [onglet, setOnglet]           = useState<'demandes' | 'deploiements' | 'processus'>('demandes')

  useEffect(() => {
    if (authLoading) return
    const init = async () => {
      if (!authUser) { router.push('/login'); return }

      let res = null

      // CAS 1 : Emprunt d'identite — charger le partenaire via RPC
      if ('isImpersonated' in authUser && authUser.isImpersonated) {
        const { data: rpcData } = await supabase
          .rpc('get_reserviste_by_benevole_id', { target_benevole_id: authUser.benevole_id })
        if (rpcData?.[0]) {
          res = { benevole_id: rpcData[0].benevole_id, prenom: rpcData[0].prenom, nom: rpcData[0].nom, email: rpcData[0].email, role: rpcData[0].role }
        }
      } else {
        // CAS 2 : Auth normale
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        // Chercher par user_id (plus fiable) avec fallback email
        const { data: resByUserId } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, role')
          .eq('user_id', user.id)
          .maybeSingle()

        if (resByUserId) {
          res = resByUserId
        } else {
          // Fallback par email
          const { data: resByEmail } = await supabase
            .from('reservistes')
            .select('benevole_id, prenom, nom, email, role')
            .ilike('email', user.email || '')
            .maybeSingle()
          res = resByEmail
        }
      }

      if (!res || (res.role !== 'partenaire' && res.role !== 'partenaire_chef')) { router.push('/'); return }
      setPartenaire(res)

      // Organismes du partenaire
      const { data: orgs } = await supabase
        .from('reserviste_organisations')
        .select('organisation_id, organisations(id, nom)')
        .eq('benevole_id', res.benevole_id)
      const orgList = (orgs || []).map((o: any) => o.organisations).filter(Boolean)
      setOrganismes(orgList)

      // Pré-remplir organisme dans le formulaire
      if (orgList.length === 1) {
        // organisme unique — mémorisé pour usage futur si nécessaire
      }

      // Demandes de cet organisme
      if (orgList.length > 0) {
        const orgNoms = orgList.map((o: any) => o.nom)
        const { data: dem } = await supabase
          .from('demandes')
          .select('id, identifiant, organisme, type_mission, nb_personnes_requis, date_debut, date_fin_estimee, statut, created_at')
          .in('organisme', orgNoms)
          .order('created_at', { ascending: false })
          .limit(50)
        setDemandes(dem || [])

        // Déploiements liés à leurs demandes
        if (dem && dem.length > 0) {
          const demandeIds = dem.map((d: any) => d.id)
          const { data: ddJoin } = await supabase
            .from('deployments_demandes')
            .select('deployment_id')
            .in('demande_id', demandeIds)
          const depIds = [...new Set((ddJoin || []).map((d: any) => d.deployment_id))]
          if (depIds.length > 0) {
            const { data: deps } = await supabase
              .from('deployments')
              .select('id, identifiant, nom, lieu, date_debut, date_fin, statut, nb_personnes_par_vague')
              .in('id', depIds)
              .order('date_debut', { ascending: false })
            setDeploiements(deps || [])
          }
        }
      }

      setLoading(false)
    }
    init()
  }, [authUser, authLoading])

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Chargement…</div>
    </div>
  )

  if (!partenaire) return null

  const orgLabel = organismes.map(o => o.nom).join(', ')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader />
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 20px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: C, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🤝</div>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: C }}>
                Portail partenaires
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                {partenaire.prenom} {partenaire.nom} — {orgLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation rapide */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <a
            href="/dashboard"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 20px', backgroundColor: 'white', borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
              textDecoration: 'none', color: C, fontWeight: '600', fontSize: '14px',
              transition: 'box-shadow 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
            onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
          >
            <span style={{ fontSize: '22px' }}>📊</span>
            <div>
              <div>Tableau de bord</div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400' }}>Statistiques RIUSC</div>
            </div>
          </a>

          <a
            href="/admin/inscriptions-camps"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 20px', backgroundColor: 'white', borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
              textDecoration: 'none', color: C, fontWeight: '600', fontSize: '14px',
              transition: 'box-shadow 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
            onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
          >
            <span style={{ fontSize: '22px' }}>🏕️</span>
            <div>
              <div>Inscriptions camps</div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400' }}>Participants et présences</div>
            </div>
          </a>

          <a
            href="/outils/transports"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 20px', backgroundColor: 'white', borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
              textDecoration: 'none', color: C, fontWeight: '600', fontSize: '14px',
              transition: 'box-shadow 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
            onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
          >
            <span style={{ fontSize: '22px' }}>🚌</span>
            <div>
              <div>Estimation transports</div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400' }}>Calculateur de couts et rotations</div>
            </div>
          </a>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '0' }}>
          {([
            { key: 'demandes',      label: `📋 Mes demandes (${demandes.length})` },
            { key: 'deploiements',  label: `🚁 Déploiements (${deploiements.length})` },
            { key: 'processus',     label: '📄 Soumettre une demande' },
          ] as const).map(o => (
            <button
              key={o.key}
              onClick={() => setOnglet(o.key)}
              style={{
                padding: '10px 18px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
                backgroundColor: onglet === o.key ? 'white' : 'transparent',
                color: onglet === o.key ? C : '#94a3b8',
                borderBottom: onglet === o.key ? `2px solid ${C}` : '2px solid transparent',
                marginBottom: '-2px',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Onglet Demandes */}
        {onglet === 'demandes' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {demandes.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                Aucune demande pour le moment.<br />
                <button onClick={() => setOnglet('processus')} style={{ marginTop: '12px', padding: '8px 18px', backgroundColor: C, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  Soumettre une première demande →
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    {['ID', 'Type de mission', 'Personnes', 'Date début', 'Statut', 'Soumis le'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((d, i) => {
                    const sc = STATUT_DEMANDE_COLORS[d.statut] || { bg: '#f1f5f9', color: '#64748b' }
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: C }}>{d.identifiant}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{d.type_mission}</td>
                        <td style={{ padding: '10px 14px', color: '#374151', textAlign: 'center' }}>{d.nb_personnes_requis}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{new Date(d.date_debut).toLocaleDateString('fr-CA')}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: sc.bg, color: sc.color }}>
                            {d.statut}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{new Date(d.created_at).toLocaleDateString('fr-CA')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Onglet Déploiements */}
        {onglet === 'deploiements' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {deploiements.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                Aucun déploiement en cours pour vos demandes.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    {['ID', 'Nom', 'Lieu', 'Date début', 'Personnes', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deploiements.map((d, i) => {
                    const sc = STATUT_DEP_COLORS[d.statut] || { bg: '#f1f5f9', color: '#64748b' }
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: C }}>{d.identifiant}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1e293b' }}>{d.nom}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{d.lieu}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{new Date(d.date_debut).toLocaleDateString('fr-CA')}</td>
                        <td style={{ padding: '10px 14px', color: '#374151', textAlign: 'center' }}>{d.nb_personnes_par_vague}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: sc.bg, color: sc.color }}>
                            {d.statut}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Onglet Processus de demande */}
        {onglet === 'processus' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '32px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: C }}>Soumettre une demande de mobilisation</h2>
            <p style={{ margin: '0 0 28px 0', fontSize: '13px', color: '#6b7280' }}>
              Les demandes de déploiement de réservistes RIUSC s&apos;effectuent via votre formulaire interne.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: C, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>1</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>Remplir votre formulaire de mobilisation</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>Complétez votre gabarit Excel interne (Numéro d&apos;intervention, lieu, dates, effectifs requis, tâches).</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: C, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>2</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>Transmettre le fichier à l&apos;AQBRS</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    Envoyez votre formulaire complété par courriel à&nbsp;
                    <a href="mailto:riusc@aqbrs.ca" style={{ color: C, fontWeight: '600' }}>riusc@aqbrs.ca</a>.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>3</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>L&apos;AQBRS traite et confirme la demande</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>Votre demande apparaîtra dans l&apos;onglet <strong>Mes demandes</strong> dès qu&apos;elle sera enregistrée dans notre système.</div>
                </div>
              </div>

            </div>

            <div style={{ marginTop: '24px', padding: '14px 18px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1e40af' }}>
              <strong>Délai de traitement habituel :</strong> 24 à 72 heures selon la date de rendez-vous demandée.
              Pour toute urgence, contactez-nous directement au <strong>(819) 555-0000</strong>.
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '24px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Portail RIUSC — AQBRS</span>
        </div>

      </main>
    </div>
  )
}
