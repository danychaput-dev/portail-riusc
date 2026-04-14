'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PersonneCourriel {
  nom: string
  email: string
  certificat: string
  dateCourriel: string
  note: string
}

interface ResultatMatch {
  personne: PersonneCourriel
  reservisteId: string | null
  benevoleId: string | null
  nomPortail: string | null
  formations: {
    id: string
    nom_formation: string
    resultat: string
    etat_validite: string | null
    date_reussite: string | null
    certificat_url: string | null
  }[]
  statut: 'trouve_avec_certif' | 'trouve_sans_certif' | 'introuvable'
}

// Les 22 personnes identifiees dans les courriels Gmail (A VERIFIER)
const PERSONNES_COURRIELS: PersonneCourriel[] = [
  { nom: 'Thierry Gaudron', email: 'formation@sauvetage02.org', certificat: "S'initier securite civile + autres", dateCourriel: '2026-03-30', note: 'Certificats PLURIEL - recuperer les PJ' },
  { nom: 'Olivier Theriault', email: 'olithe@gmail.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-02-09', note: '' },
  { nom: 'Pascal Savard', email: 'savard_pascal@hotmail.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-02-09', note: '' },
  { nom: 'Jean Huot', email: 'jeanhuotjh@gmail.com', certificat: "S'initier a la securite civile (PDF)", dateCourriel: '2026-02-09', note: 'Lien Google Drive dans le courriel' },
  { nom: 'Christian Mireault', email: 'christianmireault@hotmail.ca', certificat: "S'initier a la securite civile", dateCourriel: '2026-02-09', note: 'iPhone' },
  { nom: 'Catherine Renetane', email: 'renetane@hotmail.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-02-09', note: 'iPhone' },
  { nom: 'Jean-Francois Canciani', email: 'jf_canciani@hotmail.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-02-10', note: 'Aussi envoye via ERSGO' },
  { nom: 'Olivier Jolicoeur', email: 'oligym.jolicoeur@gmail.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-02-10', note: 'PJ confirmee' },
  { nom: 'Vendelin Clicques', email: 'vendelin.clicques@outlook.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-02-12', note: 'Attestation jointe' },
  { nom: 'M. Cormier', email: 'mcormier1@bell.net', certificat: "S'initier a la securite civile", dateCourriel: '2026-02-13', note: 'Dit avoir deja envoye' },
  { nom: 'Nelson Eddingfield', email: 'eddingfield@gmx.com', certificat: 'Certificat non specifie', dateCourriel: '2026-02-19', note: 'Verifier courriel Esther' },
  { nom: 'Anessa Kimball', email: 'anessa.kimball@gmail.com', certificat: 'Formation (ne pouvait telecharger)', dateCourriel: '2026-02-16', note: 'Esther a confirme import le 17 fev' },
  { nom: 'Marie-Eve Brousseau', email: 'brousseau.marieve@gmail.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-03-07', note: 'Aussi envoye a riusc@aqbrs.ca' },
  { nom: 'Rehan Mian', email: 'mian_r@hotmail.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-03-15', note: '' },
  { nom: 'Martin Sanfacon', email: 'martinsanfacon@outlook.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-03-12', note: 'Esther confirme ajout le 15 mars' },
  { nom: 'Vi-Hoan Wuong', email: 'vihoanwuong@gmail.com', certificat: 'Certificat de formation', dateCourriel: '2026-04-01', note: 'Forward a Esther' },
  { nom: 'Pierre Gagnon', email: 'pierrogagnon@hotmail.com', certificat: "Carte embarcation + S'initier (mauvais)", dateCourriel: '2026-04-08', note: "Carte importee. S'initier = mauvais certificat" },
  { nom: 'Jean-Guy Paris', email: 'parisjeanguy@gmail.com', certificat: "S'initier a la securite civile", dateCourriel: '2026-02-09', note: 'Dit avoir deja envoye avant' },
  { nom: 'Pierre Dubois', email: 'pierredubois57@hotmail.com', certificat: 'Certification Croix-Rouge', dateCourriel: '2026-01-29', note: 'Forward du courriel Croix-Rouge' },
  { nom: 'Jerry Drouin', email: 'jerrydrouin58@gmail.com', certificat: 'RIUSC + Scie a chaine + Premiers soins', dateCourriel: '2026-01-08', note: '3 certificats envoyes' },
  { nom: 'Mathieu Laporte', email: 'mlaporte@promutech.ca', certificat: 'AMU', dateCourriel: '2026-01-16', note: 'Esther confirme reception' },
  { nom: 'Victor Bonet', email: 'vct.bonet@gmail.com', certificat: 'Certificat non specifie', dateCourriel: '2026-01-05', note: "Dany demande a Esther d'ajouter dans Monday" },
]

export default function MatchingCertificats() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [resultats, setResultats] = useState<ResultatMatch[]>([])
  const [filtre, setFiltre] = useState<'tous' | 'manquant' | 'present' | 'introuvable'>('tous')

  useEffect(() => {
    checkAccess()
  }, [])

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: r } = await supabase
      .from('reservistes')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (!r || !['superadmin', 'admin'].includes(r.role)) { router.push('/'); return }
    setRole('admin')
    await lancerVerification()
  }

  async function lancerVerification() {
    setLoading(true)
    const results: ResultatMatch[] = []

    // Chercher tous les reservistes par email en une seule requete
    const emails = PERSONNES_COURRIELS.map(p => p.email.toLowerCase())
    const { data: reservistes } = await supabase
      .from('reservistes')
      .select('id, benevole_id, prenom, nom, email')
      .in('email', emails)

    // Creer un map email -> reserviste
    const mapReserviste = new Map<string, any>()
    if (reservistes) {
      for (const r of reservistes) {
        mapReserviste.set(r.email?.toLowerCase(), r)
      }
    }

    // Chercher les formations pour tous les benevole_ids trouves
    const benevoleIds = reservistes?.map(r => r.benevole_id).filter(Boolean) || []
    const { data: formations } = benevoleIds.length > 0
      ? await supabase
          .from('formations_benevoles')
          .select('id, benevole_id, nom_formation, resultat, etat_validite, date_reussite, certificat_url')
          .in('benevole_id', benevoleIds)
          .is('deleted_at', null)
      : { data: [] }

    // Map benevole_id -> formations
    const mapFormations = new Map<string, any[]>()
    if (formations) {
      for (const f of formations) {
        const existing = mapFormations.get(f.benevole_id) || []
        existing.push(f)
        mapFormations.set(f.benevole_id, existing)
      }
    }

    // Construire les resultats
    for (const personne of PERSONNES_COURRIELS) {
      const reserviste = mapReserviste.get(personne.email.toLowerCase())
      if (!reserviste) {
        results.push({
          personne,
          reservisteId: null,
          benevoleId: null,
          nomPortail: null,
          formations: [],
          statut: 'introuvable',
        })
        continue
      }

      const formationsReserviste = mapFormations.get(reserviste.benevole_id) || []
      results.push({
        personne,
        reservisteId: reserviste.id,
        benevoleId: reserviste.benevole_id,
        nomPortail: `${reserviste.prenom} ${reserviste.nom}`,
        formations: formationsReserviste,
        statut: formationsReserviste.length > 0 ? 'trouve_avec_certif' : 'trouve_sans_certif',
      })
    }

    setResultats(results)
    setLoading(false)
  }

  const filtres = resultats.filter(r => {
    if (filtre === 'manquant') return r.statut === 'trouve_sans_certif'
    if (filtre === 'present') return r.statut === 'trouve_avec_certif'
    if (filtre === 'introuvable') return r.statut === 'introuvable'
    return true
  })

  const stats = {
    total: resultats.length,
    avecCertif: resultats.filter(r => r.statut === 'trouve_avec_certif').length,
    sansCertif: resultats.filter(r => r.statut === 'trouve_sans_certif').length,
    introuvable: resultats.filter(r => r.statut === 'introuvable').length,
  }

  if (!role) return null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => router.push('/admin/certificats')}
          style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
        >
          ← Retour
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Croisement certificats courriels vs portail
        </h1>
      </div>

      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        22 personnes ont envoye des certificats par courriel entre janvier et avril 2026.
        Cette page verifie si leurs certificats sont dans le portail.
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 18 }}>Verification en cours...</div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div
              onClick={() => setFiltre('tous')}
              style={{
                padding: 16, borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                background: filtre === 'tous' ? '#eff6ff' : '#f9fafb',
                border: filtre === 'tous' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.total}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Total</div>
            </div>
            <div
              onClick={() => setFiltre('present')}
              style={{
                padding: 16, borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                background: filtre === 'present' ? '#f0fdf4' : '#f9fafb',
                border: filtre === 'present' ? '2px solid #22c55e' : '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: '#16a34a' }}>{stats.avecCertif}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Deja dans le portail</div>
            </div>
            <div
              onClick={() => setFiltre('manquant')}
              style={{
                padding: 16, borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                background: filtre === 'manquant' ? '#fef2f2' : '#f9fafb',
                border: filtre === 'manquant' ? '2px solid #ef4444' : '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: '#dc2626' }}>{stats.sansCertif}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Certificat manquant</div>
            </div>
            <div
              onClick={() => setFiltre('introuvable')}
              style={{
                padding: 16, borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                background: filtre === 'introuvable' ? '#fffbeb' : '#f9fafb',
                border: filtre === 'introuvable' ? '2px solid #f59e0b' : '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: '#d97706' }}>{stats.introuvable}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Email introuvable</div>
            </div>
          </div>

          {/* Tableau */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Nom (courriel)</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Certificat envoye</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date courriel</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Nom portail</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Formations dans le portail</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtres.map((r, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      background: r.statut === 'trouve_sans_certif' ? '#fef2f2'
                        : r.statut === 'introuvable' ? '#fffbeb'
                        : i % 2 === 0 ? '#fff' : '#f9fafb',
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                      {r.personne.nom}
                      {r.personne.note && (
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{r.personne.note}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#6b7280' }}>{r.personne.email}</td>
                    <td style={{ padding: '10px 12px' }}>{r.personne.certificat}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{r.personne.dateCourriel}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.nomPortail ? (
                        <span>{r.nomPortail}</span>
                      ) : (
                        <span style={{ color: '#d97706', fontStyle: 'italic' }}>Non trouve</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.formations.length === 0 ? (
                        <span style={{ color: '#dc2626', fontStyle: 'italic' }}>
                          {r.statut === 'introuvable' ? '-' : 'Aucune formation'}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.formations.map((f, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                  background: f.resultat === 'Reussi' || f.resultat === 'Réussi' ? '#22c55e'
                                    : f.resultat === 'En attente' ? '#f59e0b'
                                    : f.resultat === 'Refuse' || f.resultat === 'Refusé' ? '#ef4444'
                                    : '#9ca3af',
                                }}
                              />
                              <span style={{ fontSize: 13 }}>
                                {f.nom_formation}
                                {f.date_reussite && <span style={{ color: '#9ca3af' }}> ({f.date_reussite})</span>}
                                {f.certificat_url && <span style={{ color: '#22c55e' }}> [PDF]</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {r.statut === 'trouve_avec_certif' && (
                        <span style={{
                          background: '#dcfce7', color: '#166534', padding: '4px 10px',
                          borderRadius: 20, fontSize: 12, fontWeight: 600,
                        }}>OK</span>
                      )}
                      {r.statut === 'trouve_sans_certif' && (
                        <span style={{
                          background: '#fee2e2', color: '#991b1b', padding: '4px 10px',
                          borderRadius: 20, fontSize: 12, fontWeight: 600,
                        }}>MANQUANT</span>
                      )}
                      {r.statut === 'introuvable' && (
                        <span style={{
                          background: '#fef3c7', color: '#92400e', padding: '4px 10px',
                          borderRadius: 20, fontSize: 12, fontWeight: 600,
                        }}>EMAIL?</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legende */}
          <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#6b7280' }}>
            <strong>Legende :</strong>
            <span style={{ marginLeft: 16 }}>
              <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 10, marginRight: 8 }}>OK</span>
              Le reserviste a au moins une formation dans le portail
            </span>
            <span style={{ marginLeft: 16 }}>
              <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 10, marginRight: 8 }}>MANQUANT</span>
              Reserviste trouve mais aucune formation enregistree
            </span>
            <span style={{ marginLeft: 16 }}>
              <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, marginRight: 8 }}>EMAIL?</span>
              Email du courriel ne correspond a aucun reserviste
            </span>
          </div>

          <div style={{ marginTop: 16, padding: 16, background: '#eff6ff', borderRadius: 8, fontSize: 13 }}>
            <strong>Note :</strong> Les personnes marquees "OK" ont <em>au moins une</em> formation dans le portail,
            mais pas necessairement celle mentionnee dans le courriel. Verifie la colonne "Formations dans le portail"
            pour confirmer que le certificat specifique est present.
            <br /><br />
            Pour les "MANQUANT", il faut aller sur la page du reserviste, ouvrir le courriel correspondant pour
            recuperer la piece jointe, puis ajouter le certificat via la page d'approbation.
          </div>

          <button
            onClick={() => lancerVerification()}
            style={{
              marginTop: 16, background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600,
            }}
          >
            Reverifier
          </button>
        </>
      )}
    </div>
  )
}
