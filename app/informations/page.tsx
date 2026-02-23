'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PortailHeader from '@/app/components/PortailHeader'

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  photo_url?: string;
  groupe?: string;
}

// === PDFs du camp — remplacer les "#" par les vrais liens quand hébergés ===
const PDFS_SAMEDI = [
  { titre: "Structure d'équipe d'intervention", url: "#" },
  { titre: "La synergie de la Réserve d'intervention d'urgence en sécurité civile (RIUSC)", url: "#" },
  { titre: "Introduction RIUSC & Sécurité civile", url: "#" },
  { titre: "Aide-mémoire — Savoir-agir et bonnes pratiques en présence de personnes sinistrées", url: "#" },
];

const PDFS_DIMANCHE = [
  { titre: "Atelier Croix-Rouge — Aide-mémoire lits et dortoirs", url: "#" },
  { titre: "Atelier SOPFEU — Gestion des débris", url: "#" },
  { titre: "Atelier AQBRS — Sac de sable et digue", url: "#" },
];

export default function InformationsPage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLoi, setShowLoi] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isApproved = reserviste?.groupe === 'Approuvé'

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      let reservisteData = null
      if (user.email) {
        const { data } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, photo_url, groupe')
          .ilike('email', user.email)
          .single()
        reservisteData = data
      }
      if (!reservisteData && user.phone) {
        const phoneDigits = user.phone.replace(/\D/g, '')
        const { data } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, photo_url, groupe')
          .eq('telephone', phoneDigits)
          .single()
        if (!data) {
          const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits
          const { data: data2 } = await supabase
            .from('reservistes')
            .select('benevole_id, prenom, nom, email, photo_url, groupe')
            .eq('telephone', phoneWithout1)
            .single()
          reservisteData = data2
        } else {
          reservisteData = data
        }
      }
      if (reservisteData) setReserviste(reservisteData)
      setLoading(false)
    }
    loadData()
  }, [])



  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Header */}
      <PortailHeader subtitle="Informations pratiques" />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '20px' }}>
          ← Retour à l&apos;accueil
        </a>

        <h2 style={{ color: '#1e3a5f', margin: '0 0 32px 0', fontSize: '24px', fontWeight: '700' }}>
          Ressources et documents
        </h2>

        {/* ========== SECTION 1 : Ressources générales ========== */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
            Ressources générales
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Volume de référence */}
            <a
              href="https://online.fliphtml5.com/wscbg/pato/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.backgroundColor = '#f0f4f8' }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '28px' }}>📖</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Volume de référence — Bénévole en sécurité civile</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Guide complet AQBRS — Consultation en ligne</div>
                </div>
              </div>
              <svg width="20" height="20" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>

            {/* Loi sur la sécurité civile — Accordéon */}
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <button
                onClick={() => setShowLoi(!showLoi)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f0f4f8' }}
                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '28px', flexShrink: 0 }}>⚖️</span>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Protection prévue à la Loi sur la sécurité civile</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                      Droits des réservistes face à leur employeur — cliquez pour en savoir plus
                    </div>
                  </div>
                </div>
                <svg
                  width="20" height="20" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"
                  style={{ flexShrink: 0, transform: showLoi ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showLoi && (
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '20px 20px 24px 54px', backgroundColor: '#fafbff' }}>
                  <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#374151', lineHeight: '1.75' }}>
                    La Loi sur la sécurité civile du Québec prévoit qu&apos;un employeur <strong>ne peut imposer de mesures disciplinaires</strong> à un employé pour le seul motif qu&apos;il s&apos;absente afin de participer à des mesures liées à un sinistre, pourvu qu&apos;il en ait avisé son employeur.
                  </p>
                  <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#374151', lineHeight: '1.75' }}>
                    Cette protection s&apos;applique lorsque les services du réserviste ont été requis ou acceptés dans le cadre d&apos;un déploiement officiel.
                  </p>
                  <a
                    href="https://www.legisquebec.gouv.qc.ca/fr/document/lc/S-2.4"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '7px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}
                  >
                    👉 Consulter la Loi sur la sécurité civile (RLRQ, c. S-2.4)
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                </div>
              )}
            </div>

            {/* Fiches de tâches */}
            <a
              href="/deploiement/taches"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.backgroundColor = '#f0f4f8' }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '28px' }}>📋</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Fiches de tâches RIUSC</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>11 tâches avec analyses de risques et mesures de prévention</div>
                </div>
              </div>
              <svg width="20" height="20" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </a>
          </div>
        </div>

        {/* ========== SECTION 1.5 : Documents personnels (Dany Chaput seulement) ========== */}
        {reserviste?.benevole_id === '8738174928' && (
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: '2px solid #059669' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '18px', fontWeight: '600' }}>
                📁 Mes documents personnels
              </h3>
              <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                Dany Chaput
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Certificat de formation */}
              <a
                href="/documents/dany-certificat.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', backgroundColor: '#f0f9ff', borderRadius: '8px',
                  border: '1px solid #bae6fd', textDecoration: 'none', transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.backgroundColor = '#e0f2fe' }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#bae6fd'; e.currentTarget.style.backgroundColor = '#f0f9ff' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '24px' }}>🎓</span>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>
                      Certificat de formation
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                      S'initier à la sécurité civile — 17 janvier 2026
                    </div>
                  </div>
                </div>
                <span style={{ padding: '6px 14px', backgroundColor: '#0ea5e9', color: 'white', borderRadius: '6px', fontSize: '13px', fontWeight: '500' }}>
                  📄 Voir PDF
                </span>
              </a>

              {/* Lettre d'attestation employeur */}
              <a
                href="/documents/dany-lettre-employeur.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', backgroundColor: '#fef3c7', borderRadius: '8px',
                  border: '1px solid #fde68a', textDecoration: 'none', transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.backgroundColor = '#fef08a' }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#fde68a'; e.currentTarget.style.backgroundColor = '#fef3c7' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '24px' }}>📨</span>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>
                      Lettre d'attestation employeur
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                      Attestation RIUSC — 25 janvier 2026
                    </div>
                  </div>
                </div>
                <span style={{ padding: '6px 14px', backgroundColor: '#f59e0b', color: 'white', borderRadius: '6px', fontSize: '13px', fontWeight: '500' }}>
                  📄 Voir PDF
                </span>
              </a>
            </div>

            <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#065f46', lineHeight: '1.6' }}>
                💡 <strong>Conseil :</strong> Télécharge ces documents et conserve-les dans un endroit sécurisé. La lettre d'attestation peut être remise à ton employeur.
              </p>
            </div>
          </div>
        )}

        {/* ========== SECTION 2 : Documents du camp (Approuvés seulement) ========== */}
        {isApproved && (
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Documents du camp de qualification
              </h3>
              <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                Réservistes approuvés
              </span>
            </div>

            {/* Samedi */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', paddingLeft: '4px' }}>
                Samedi — Formation théorique
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {PDFS_SAMEDI.map((pdf, i) => (
                  <a
                    key={i}
                    href={pdf.url}
                    target={pdf.url !== '#' ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    onClick={(e) => { if (pdf.url === '#') e.preventDefault() }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px',
                      border: '1px solid #e5e7eb', textDecoration: 'none', transition: 'all 0.2s',
                      opacity: pdf.url === '#' ? 0.5 : 1,
                      cursor: pdf.url === '#' ? 'default' : 'pointer'
                    }}
                    onMouseOver={(e) => { if (pdf.url !== '#') { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.backgroundColor = '#f0f4f8' } }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>📄</span>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{pdf.titre}</span>
                    </div>
                    {pdf.url !== '#' ? (
                      <span style={{ padding: '4px 12px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>Consulter</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Bientôt disponible</span>
                    )}
                  </a>
                ))}
              </div>
            </div>

            {/* Dimanche */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', paddingLeft: '4px' }}>
                Dimanche — Ateliers pratiques
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {PDFS_DIMANCHE.map((pdf, i) => (
                  <a
                    key={i}
                    href={pdf.url}
                    target={pdf.url !== '#' ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    onClick={(e) => { if (pdf.url === '#') e.preventDefault() }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px',
                      border: '1px solid #e5e7eb', textDecoration: 'none', transition: 'all 0.2s',
                      opacity: pdf.url === '#' ? 0.5 : 1,
                      cursor: pdf.url === '#' ? 'default' : 'pointer'
                    }}
                    onMouseOver={(e) => { if (pdf.url !== '#') { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.backgroundColor = '#f0f4f8' } }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>📄</span>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{pdf.titre}</span>
                    </div>
                    {pdf.url !== '#' ? (
                      <span style={{ padding: '4px 12px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>Consulter</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Bientôt disponible</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== SECTION 3 : Documents officiels (Approuvés seulement) ========== */}
        {isApproved && (
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Documents officiels
              </h3>
              <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                Réservistes approuvés
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '28px' }}>🎓</span>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Attestation de formation</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Certificat de réussite du camp de qualification</div>
                  </div>
                </div>
                <span style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Non disponible</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '28px' }}>✉️</span>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Lettre pour l&apos;employeur</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Lettre officielle confirmant votre rôle de réserviste</div>
                  </div>
                </div>
                <span style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Non disponible</span>
              </div>
            </div>

            <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
              Ces documents seront générés automatiquement après la complétion de votre camp de qualification.
            </p>
          </div>
        )}

        {/* Section contact */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
            Besoin d&apos;aide ?
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280', lineHeight: 1.6 }}>
            Pour toute question concernant votre rôle de réserviste, les déploiements ou les formations,
            n&apos;hésitez pas à nous contacter.
          </p>
          <a href="mailto:riusc@aqbrs.ca" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
            📧 riusc@aqbrs.ca
          </a>
        </div>
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
