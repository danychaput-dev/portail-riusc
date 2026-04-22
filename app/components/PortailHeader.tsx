'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import ImpersonateBanner from './ImpersonateBanner'
import ImpersonateModal from './ImpersonateModal'
import QRScannerButton from './QRScannerButton'
import TrajetButton from './TrajetButton'
import { useAuth } from '@/utils/useAuth'
import { isDemoActive, getDemoGroupe, DEMO_RESERVISTE, DEMO_USER } from '@/utils/demoMode'
import { n8nUrl } from '@/utils/n8n'

interface Reserviste {
  benevole_id: string
  role: string
  prenom: string
  nom: string
  email: string
  telephone?: string | null
  photo_url?: string | null
  groupe: string
  date_naissance?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  region?: string | null
  contact_urgence_nom?: string | null
  contact_urgence_telephone?: string | null
  antecedents_statut?: string | null
  antecedents_date_expiration?: string | null
}

interface CampStatus {
  is_certified: boolean
}

interface PortailHeaderProps {
  subtitle?: string
  // Pour les pages qui ont déjà chargé le réserviste, on peut le passer en prop
  // pour éviter un double fetch — sinon le composant le charge lui-même
  reservisteOverride?: Reserviste | null
}


export default function PortailHeader({ subtitle = 'Portail RIUSC', reservisteOverride }: PortailHeaderProps) {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(reservisteOverride ?? null)
  const [campStatus, setCampStatus] = useState<CampStatus | null>(null)
  const [hasCertificats, setHasCertificats] = useState(false)
  const [certifsManquants, setCertifsManquants] = useState(0)
  const [certifsEnAttente, setCertifsEnAttente] = useState(0)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [isApproved, setIsApproved] = useState(false)
  const [hasCiblages, setHasCiblages] = useState(false)
  const [isResponsableGroupe, setIsResponsableGroupe] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showImpersonateModal, setShowImpersonateModal] = useState(false)
  const [showStatusTooltip, setShowStatusTooltip] = useState(false)
  const [showSupportTooltip, setShowSupportTooltip] = useState(false)
  const [supportCopied, setSupportCopied] = useState(false)
  const [unreadCommunaute, setUnreadCommunaute] = useState(0)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Hook d'authentification avec support emprunt
  const { user: authUser, loading: authLoading } = useAuth()
  const isImpersonating = !!(authUser && 'isImpersonated' in authUser && authUser.isImpersonated)

  // Champs nécessaires pour vérifier la complétude du profil + header
  const selectFields = 'benevole_id, role, prenom, nom, email, telephone, photo_url, groupe, date_naissance, adresse, ville, region, contact_urgence_nom, contact_urgence_telephone, antecedents_statut, antecedents_date_expiration'

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const load = async () => {
      // 🎯 MODE DÉMO
      if (isDemoActive()) {
        const groupe = getDemoGroupe()
        const isAppr = groupe === 'Approuvé'
        const demoRes = { ...DEMO_RESERVISTE, groupe } as any
        setUser(DEMO_USER)
        setReserviste(demoRes)
        // Intérêt → isApproved=true mais conditions manquantes → affiche "Non déployable"
        // Approuvé → toutes conditions remplies → affiche "Déployable"
        setIsApproved(true)
        if (isAppr) {
          setCampStatus({ is_certified: true })
          setHasCertificats(true)
          setHasCiblages(true)
        } else {
          setCampStatus({ is_certified: false })
          setHasCertificats(false)
          setHasCiblages(false)
          setCertifsManquants(2) // Démo : 2 certificats manquants
        }
        setLoadingStatus(false)
        return
      }

      // Attendre que l'auth soit chargée
      if (authLoading) return
      
      if (!authUser) return
      
      setUser(authUser)

      // Charger réserviste seulement si pas passé en prop
      let res = reservisteOverride ?? null
      if (!res) {
        // CAS 0 : Mode debug (localStorage)
        if ('isDebug' in authUser && authUser.isDebug) {
          const { data: rpcData } = await supabase
            .rpc('get_reserviste_by_benevole_id', { target_benevole_id: authUser.benevole_id })
          res = rpcData?.[0] || null
        // CAS 1 : Emprunt d'identité (via fonction sécurisée car profil d'un autre user)
        } else if ('isImpersonated' in authUser && authUser.isImpersonated) {
          const { data: rpcData } = await supabase
            .rpc('get_reserviste_by_benevole_id', { target_benevole_id: authUser.benevole_id })
          res = rpcData?.[0] || null
        } else {
          // CAS 2 : Auth normale
          // 1. D'abord chercher par user_id (le plus fiable)
          if ('id' in authUser) {
            const { data: dataByUserId } = await supabase
              .from('reservistes')
              .select(selectFields)
              .eq('user_id', authUser.id)
              .single()
            
            if (dataByUserId) {
              res = dataByUserId as unknown as Reserviste
            }
          }
          
          // 2. Sinon chercher par email
          if (!res && 'email' in authUser && authUser.email) {
            const { data } = await supabase
              .from('reservistes')
              .select(selectFields)
              .ilike('email', authUser.email)
              .single()
            
            // Si trouvé, mettre à jour le user_id pour la prochaine fois
            if (data && 'id' in authUser) {
              await supabase
                .from('reservistes')
                .update({ user_id: authUser.id })
                .eq('benevole_id', data.benevole_id)
              res = data
            }
          }
          
          // 3. Sinon chercher par téléphone
          if (!res && 'phone' in authUser && authUser.phone) {
            const phoneDigits = authUser.phone.replace(/\D/g, '')
            const { data } = await supabase
              .from('reservistes')
              .select(selectFields)
              .eq('telephone', phoneDigits)
              .single()
            
            if (!data && phoneDigits.startsWith('1')) {
              const phoneWithout1 = phoneDigits.slice(1)
              const { data: data2 } = await supabase
                .from('reservistes')
                .select(selectFields)
                .eq('telephone', phoneWithout1)
                .single()
              
              if (data2 && 'id' in authUser) {
                await supabase
                  .from('reservistes')
                  .update({ user_id: authUser.id })
                  .eq('benevole_id', data2.benevole_id)
                res = data2
              }
            } else if (data && 'id' in authUser) {
              await supabase
                .from('reservistes')
                .update({ user_id: authUser.id })
                .eq('benevole_id', data.benevole_id)
              res = data
            }
          }
        }
        
        if (res) setReserviste(res)
      }

      const approved = res?.groupe === 'Approuvé'
      setIsApproved(approved)

      if (res) {
        // Une seule requête Supabase pour tout — remplace les 2 webhooks n8n Monday
        const { data: formations } = await supabase
          .from('formations_benevoles')
          .select('resultat, source, nom_formation')
          .eq('benevole_id', res.benevole_id)
          .eq('resultat', 'Réussi')
          .is('deleted_at', null)

        if (formations) {
          // S'initier = même logique que page formation — cherche par nom_formation
          const hasCert = formations.some(f => (f.nom_formation || '').toLowerCase().includes('initier'))
          setHasCertificats(hasCert)

          // Camp — vérifier Supabase (toutes cohortes « Camp de qualification »)
          const campReussiSupabase = formations.some(f => f.nom_formation?.toLowerCase().includes('camp de qualification') && f.resultat === 'Réussi')
          setCampStatus({ is_certified: campReussiSupabase })
        }

        // Certificats manquants / en attente d'approbation
        const { data: certifsPending } = await supabase
          .from('formations_benevoles')
          .select('certificat_url')
          .eq('benevole_id', res.benevole_id)
          .eq('resultat', 'En attente')
          .is('deleted_at', null)
        if (certifsPending) {
          const manquants = certifsPending.filter(f => !f.certificat_url).length
          const enAttente = certifsPending.filter(f => !!f.certificat_url).length
          setCertifsManquants(manquants)
          setCertifsEnAttente(enAttente)
        }

        // Ciblages actifs (seulement pertinent pour Approuvé)
        if (approved) {
          const { data: ciblages } = await supabase
            .from('ciblages')
            .select('id')
            .eq('benevole_id', res.benevole_id)
            .limit(1)
          setHasCiblages((ciblages ?? []).length > 0)
        }

        // Badge communauté — utilise le user_id réel du réserviste (fonctionne en debug aussi)
        const realUserId = (res as any).user_id
        if (realUserId) {
          const { data: lastSeen } = await supabase
            .from('community_last_seen')
            .select('last_seen_at')
            .eq('user_id', realUserId)
            .maybeSingle()

          const lastSeenAt = lastSeen?.last_seen_at || '1970-01-01'

          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('is_deleted', false)
            .gt('created_at', lastSeenAt)

          setUnreadCommunaute(count ?? 0)
        }
      }

      // Vérifier si l'utilisateur est responsable d'au moins un groupe R&S.
      // On s'appuie sur la RLS (le réserviste voit uniquement ses propres
      // lignes dans groupes_recherche_responsables), donc count > 0 ⇒ responsable.
      if (res) {
        try {
          const { count } = await (supabase as any)
            .from('groupes_recherche_responsables')
            .select('*', { count: 'exact', head: true })
          setIsResponsableGroupe((count || 0) > 0)
        } catch {
          setIsResponsableGroupe(false)
        }
      }

      setLoadingStatus(false)
    }
    load()
      .catch(err => {
        console.error('PortailHeader load error:', err)
        setLoadingStatus(false)
      })
  }, [authUser, authLoading, reservisteOverride])

  const handleSignOut = async () => {
    // Nettoyer le mode debug si actif
    localStorage.removeItem('debug_mode')
    localStorage.removeItem('debug_user')
    localStorage.removeItem('debug_email')
    // Nettoyer le mode démo si actif
    localStorage.removeItem('demo_mode')
    localStorage.removeItem('demo_groupe')
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleImpersonate = async (benevole_id: string) => {
    try {
      const response = await fetch('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id }),
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        const role = data.reserviste?.role
        setShowImpersonateModal(false)
        // Rediriger selon le role de la personne empruntee
        if (role === 'partenaire') {
          window.location.href = '/partenaire'
        } else if (role === 'adjoint') {
          window.location.href = '/admin/reservistes'
        } else if (['superadmin', 'admin', 'coordonnateur'].includes(role)) {
          window.location.href = '/admin'
        } else {
          window.location.href = '/'
        }
      } else {
        console.error('Erreur emprunt')
      }
    } catch (error) {
      console.error('Erreur emprunt:', error)
    }
  }

  const getInitials = () => {
    if (reserviste) return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase()
    return user?.email?.charAt(0).toUpperCase() || 'U'
  }

  // ========================================================
  // LOGIQUE DÉPLOYABLE — même 3 conditions que page Formation
  // ========================================================
  const isProfilComplet = !!(
    reserviste &&
    reserviste.prenom && reserviste.nom && reserviste.email && reserviste.telephone &&
    reserviste.date_naissance && reserviste.adresse && reserviste.ville && reserviste.region &&
    reserviste.contact_urgence_nom && reserviste.contact_urgence_telephone
  )

  // 4e condition : antécédents vérifiés et non expirés
  const isAntecedentsOk = !!(
    (reserviste as any)?.antecedents_statut === 'verifie' &&
    (!(reserviste as any)?.antecedents_date_expiration || new Date((reserviste as any).antecedents_date_expiration) > new Date())
  )

  const isDeployable = isProfilComplet && hasCertificats && (campStatus?.is_certified === true) && isAntecedentsOk

  // Compteur pour le sous-texte (ex: "4/4 étapes complétées")
  const completedSteps = [isProfilComplet, hasCertificats, campStatus?.is_certified === true, isAntecedentsOk].filter(Boolean).length

  // Roles
  const realRole = reserviste?.role
  const isRealAdmin = realRole === 'superadmin' || realRole === 'admin' || realRole === 'coordonnateur'
  const isAdmin = isRealAdmin
  const isSuperadmin = realRole === 'superadmin'
  const isAdjoint = realRole === 'adjoint'
  const isPartenaire = realRole === 'partenaire' || realRole === 'partenaire_lect'

  return (
    <>
      <ImpersonateBanner />
      
      <header data-impersonate-ignore style={{ backgroundColor: isImpersonating ? '#fef3c7' : 'white', borderBottom: `1px solid ${isImpersonating ? '#f59e0b' : '#e5e7eb'}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo + titre */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} priority style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                {subtitle}
              </p>
            </div>
          </a>

          {/* Boutons trajet (heures secondaires) + scanner QR (heures primaires) */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <TrajetButton />
            <QRScannerButton />
          </div>

          {/* Bouton support */}
          <div style={{ position: 'relative', marginRight: '16px' }}>
            <button
              onClick={() => setShowSupportTooltip(v => !v)}
              title="Aide et support"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #d1d5db', backgroundColor: showSupportTooltip ? '#f3f4f6' : 'white', cursor: 'pointer', color: '#6b7280', fontSize: '15px', fontWeight: '700', transition: 'all 0.15s' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = showSupportTooltip ? '#f3f4f6' : 'white'}
            >
              ?
            </button>
            {showSupportTooltip && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setShowSupportTooltip(false)} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', padding: '16px', minWidth: '260px', zIndex: 200 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '6px' }}>Aide et support</div>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px 0', lineHeight: '1.5' }}>Un problème avec le portail ? Écrivez-nous :</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px' }}>
                    <span style={{ fontSize: '13px', color: '#111827', flex: 1, fontFamily: 'monospace' }}>support@riusc.ca</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText('support@riusc.ca'); setSupportCopied(true); setTimeout(() => setSupportCopied(false), 2000) }}
                      style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: supportCopied ? '#d1fae5' : '#1e3a5f', color: supportCopied ? '#065f46' : 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                    >
                      {supportCopied ? '✓ Copié' : 'Copier'}
                    </button>
                  </div>
                  <a
                    href="mailto:support@riusc.ca?subject=Aide%20-%20Portail%20RIUSC"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', marginTop: '10px', textAlign: 'center', fontSize: '13px', color: '#2563eb', textDecoration: 'none', padding: '7px', borderRadius: '6px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                  >
                    ✉️ Ouvrir dans mon client courriel
                  </a>
                </div>
              </>
            )}
          </div>

          {/* Menu utilisateur */}
          <div ref={userMenuRef} data-tour="menu" style={{ position: 'relative' }}>
            {!loadingStatus && (reserviste || user) ? (
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = showUserMenu ? '#f3f4f6' : 'transparent'}
            >
              {/* Nom + statut */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                  {reserviste ? `${reserviste.prenom} ${reserviste.nom}` : user?.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '12px', position: 'relative' }}>
                  {loadingStatus ? (
                    <span style={{ color: '#6b7280' }}>...</span>
                  ) : isPartenaire ? (
                    <span style={{ color: '#0891b2', fontWeight: '600' }}>Partenaire</span>
                  ) : isDeployable ? (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'default' }}
                      onMouseEnter={() => setShowStatusTooltip(true)}
                      onMouseLeave={() => setShowStatusTooltip(false)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span style={{ color: '#059669', fontWeight: '600' }}>Déployable</span>
                      {showStatusTooltip && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: '#111827', color: 'white', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap', zIndex: 300, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                          <div style={{ fontWeight: '600', marginBottom: '6px', color: '#6ee7b7' }}>✓ Toutes les étapes complétées</div>
                          <div>✓ Profil complet</div>
                          <div>✓ Certificat S&apos;initier</div>
                          <div>✓ Camp de qualification réussi</div>
                          <div>✓ Antécédents judiciaires vérifiés</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <a
                      href="/formation"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                      onMouseEnter={() => setShowStatusTooltip(true)}
                      onMouseLeave={() => setShowStatusTooltip(false)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span style={{ color: '#dc2626', fontWeight: '600' }}>Non déployable</span>
                      {showStatusTooltip && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: '#111827', color: 'white', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap', zIndex: 300, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                          <div style={{ fontWeight: '600', marginBottom: '6px', color: '#fca5a5' }}>Étapes manquantes :</div>
                          <div>{isProfilComplet ? '✓' : '✗'} Profil complet</div>
                          <div>{hasCertificats ? '✓' : '✗'} Certificat S&apos;initier</div>
                          <div>{campStatus?.is_certified ? '✓' : '✗'} Camp de qualification réussi</div>
                          <div>{isAntecedentsOk ? '✓' : '✗'} Antécédents judiciaires vérifiés</div>
                          <div style={{ marginTop: '8px', color: '#93c5fd', fontSize: '11px' }}>Cliquer pour voir Formation et parcours →</div>
                        </div>
                      )}
                    </a>
                  )}
                </div>
                {/* Indicateur certificats manquants / en attente */}
                {!loadingStatus && !isPartenaire && (certifsManquants > 0 || certifsEnAttente > 0) && (
                  <a
                    href="/formation"
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '11px', textDecoration: 'none', marginTop: '1px' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={certifsManquants > 0 ? '#d97706' : '#6b7280'} strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span style={{ color: certifsManquants > 0 ? '#d97706' : '#6b7280', fontWeight: '500' }}>
                      {certifsManquants > 0 && `${certifsManquants} certificat${certifsManquants > 1 ? 's' : ''} a televerser`}
                      {certifsManquants > 0 && certifsEnAttente > 0 && ' · '}
                      {certifsEnAttente > 0 && `${certifsEnAttente} en attente`}
                    </span>
                  </a>
                )}
              </div>

              {/* Avatar */}
              {reserviste?.photo_url ? (
                <img src={reserviste.photo_url} alt="Photo de profil" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px' }}>{getInitials()}</div>
              )}

              {/* Chevron */}
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            ) : (
              <div style={{ width: '40px', height: '40px' }} />
            )}

            {/* Dropdown */}
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', minWidth: '210px', overflow: 'hidden', zIndex: 200 }}>

                <a href="/profil" style={menuItemStyle}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <span style={iconBoxStyle}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </span>
                  Mon profil
                </a>

                {isApproved && hasCiblages && (
                  <a href="/disponibilites" style={menuItemStyle}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                    <span style={iconBoxStyle}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </span>
                    Mes déploiements
                  </a>
                )}

                {/* Menu réservé aux responsables de groupe R&S */}
                {isResponsableGroupe && (
                  <a href="/mon-groupe" style={menuItemStyle}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                    <span style={iconBoxStyle}>🎖️</span>
                    Mon groupe R&amp;S
                  </a>
                )}

                <a href="/informations" style={menuItemStyle}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <span style={iconBoxStyle}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </span>
                  Informations pratiques
                </a>

                <a href="/formation" style={menuItemStyle}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <span style={iconBoxStyle}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
                  </span>
                  Formation et parcours
                </a>

                <a href="/formations-en-ligne" style={menuItemStyle}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <span style={iconBoxStyle}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </span>
                  Formations en ligne
                </a>

                <a href="/communaute" style={menuItemStyle}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <span style={iconBoxStyle}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </span>
                  <span style={{ flex: 1 }}>Communauté</span>
                  {unreadCommunaute > 0 && (
                    <span style={{ backgroundColor: '#dc2626', color: 'white', borderRadius: '10px', padding: '2px 7px', fontSize: '11px', fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>
                      {unreadCommunaute > 99 ? '99+' : unreadCommunaute}
                    </span>
                  )}
                </a>

                {isAdjoint && (
                  <>
                    <a href="/admin/reservistes" style={menuItemStyle}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                      <span style={iconBoxStyle}>👥</span>
                      Annuaire réservistes
                    </a>
                  </>
                )}

                {isAdmin && (
                  <>
                    {/* Raccourci vers l'espace admin (tous les autres items sont dans le sidebar) */}
                    <a href="/admin/reservistes" style={menuItemStyle}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <span style={iconBoxStyle}>🛡️</span>
                      Espace admin →
                    </a>
                    {/* Emprunt d'identité — fonction admin-seule, gardée dans le header pour accès rapide */}
                    <button
                      onClick={() => { setShowUserMenu(false); setShowImpersonateModal(true) }}
                      style={menuButtonStyle}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <span style={iconBoxStyle}>🎭</span>
                      Emprunt d{"'"}identité
                    </button>
                  </>
                )}


                {(isAdmin || isAdjoint || isPartenaire) && (
                  <a href="/outils/transports" style={menuItemStyle}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                    <span style={iconBoxStyle}>🚌</span>
                    Estimation transports
                  </a>
                )}

                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    if (window.location.pathname !== '/') {
                      window.location.href = '/?tour=1'
                    } else {
                      window.dispatchEvent(new Event('restart-guided-tour'))
                    }
                  }}
                  style={menuButtonStyle}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <span style={iconBoxStyle}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  </span>
                  Visite guidée
                </button>

                {isImpersonating && (
                  <button
                    onClick={async () => {
                      setShowUserMenu(false)
                      try {
                        const response = await fetch('/api/stop-impersonate', { method: 'POST', credentials: 'include' })
                        if (response.ok) window.location.href = '/'
                      } catch {}
                    }}
                    style={menuButtonStyle}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <span style={iconBoxStyle}>🎭</span>
                    Retour a mon compte
                  </button>
                )}

                <button onClick={handleSignOut}
                  style={{ ...menuButtonStyle, borderBottom: 'none' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <span style={iconBoxStyle}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </span>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {showImpersonateModal && (
        <ImpersonateModal
          onClose={() => setShowImpersonateModal(false)}
          onImpersonate={handleImpersonate}
        />
      )}
    </>
  )
}

// Styles partagés pour le dropdown du menu utilisateur — uniforme et neutre
const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  color: '#374151',
  textDecoration: 'none',
  fontSize: '14px',
  borderBottom: '1px solid #f3f4f6',
  fontWeight: 'normal',
}

const menuButtonStyle: React.CSSProperties = {
  ...menuItemStyle,
  backgroundColor: 'white',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
}

// Boîte à largeur fixe pour l'icône : garantit que le texte démarre toujours
// au même endroit, peu importe si l'icône est un SVG ou un emoji.
const iconBoxStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  flexShrink: 0,
}

