'use client'

/**
 * ─────────────────────────────────────────────────────────────────
 * Page soumettre — dynamique (2026-04-22)
 * Lit deployments.mode_dates + jours_proposes + date_debut/fin pour
 * générer les jours à proposer. Applique le branding RIUSC ou AQBRS.
 * Affiche le countdown jusqu'à date_limite_reponse (désactive après).
 * ─────────────────────────────────────────────────────────────────
 */

import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import Image from 'next/image'
import { logPageVisit } from '@/utils/logEvent'
import { isDemoActive, DEMO_RESERVISTE, DEMO_DEPLOIEMENTS } from '@/utils/demoMode'
import { n8nUrl } from '@/utils/n8n'
import { brandingConfig, type Branding } from '@/utils/branding'
import { formatDateLimite } from '@/utils/formatDateLimite'

interface DeploiementInfo {
  deploiement_id: string;
  nom_deploiement: string;
  nom_sinistre?: string | null;
  type_incident?: string | null;
  lieu?: string | null;
  date_debut: string;
  date_fin?: string | null;
  organisme?: string | null;
  date_limite_reponse?: string | null;
  mode_dates?: 'plage_continue' | 'jours_individuels';
  jours_proposes?: string[] | null;
  branding?: Branding;
  heures_limite_reponse?: number;
}

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string | null;
}

type ReponseType = 'disponible' | 'non_disponible' | 'a_confirmer';

// Formate une date ISO (YYYY-MM-DD) en "Samedi 19 avril 2026"
const JOURS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
function labelJour(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${JOURS_FR[date.getDay()]} ${d} ${MOIS_FR[m - 1]} ${y}`
}

// Durée minimum recommandée par engagement (rotation typique).
// MVP: hardcode 5 jours, à remplacer par lecture deployment.duree_min_rotation_jours
// quand la colonne DB sera créée (voir tâche #15). Cohérent avec la valeur passée
// par défaut au wizard étape 5 (tplNotif dureeMinRotationJours: 5).
const DUREE_MIN_ROTATION_JOURS = 5

// Calcule l'ISO d'une date + N jours
function ajouterJours(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Génère toutes les dates entre debut et fin inclusivement (YYYY-MM-DD)
function genererPlage(debut: string, fin: string): string[] {
  const dates: string[] = []
  const [ya, ma, da] = debut.split('-').map(Number)
  const [yb, mb, db] = fin.split('-').map(Number)
  const cur = new Date(ya, ma - 1, da)
  const end = new Date(yb, mb - 1, db)
  while (cur.getTime() <= end.getTime()) {
    const yyyy = cur.getFullYear()
    const mm = String(cur.getMonth() + 1).padStart(2, '0')
    const dd = String(cur.getDate()).padStart(2, '0')
    dates.push(`${yyyy}-${mm}-${dd}`)
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function SoumettreContent() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [deploiement, setDeploiement] = useState<DeploiementInfo | null>(null)
  const [showAide, setShowAide] = useState(true)

  const [reponse, setReponse] = useState<ReponseType | null>(null)
  const [datesCochees, setDatesCochees] = useState<Set<string>>(new Set())
  // En mode plage_continue (MVP restauré 2026-04-26): le réserviste saisit
  // sa propre plage via 2 inputs date_debut + date_fin. Au submit on expand
  // ces 2 dates en N entrées de datesCochees pour réutiliser le flow d'envoi
  // existant (1 POST par jour vers le webhook n8n).
  const [plageDebut, setPlageDebut] = useState('')
  const [plageFin, setPlageFin] = useState('')
  // Mode "modification d'une plage existante": l'utilisateur arrive depuis le
  // bouton ✏️ Modifier de /disponibilites avec ?date_debut=...&date_fin=...
  // dans l'URL. On pré-remplit plageDebut/plageFin avec ces valeurs ET on les
  // mémorise dans original* pour pouvoir DELETE l'ancienne plage au submit
  // (sinon création de doublons).
  const [originalDebut, setOriginalDebut] = useState('')
  const [originalFin, setOriginalFin] = useState('')
  const [transport, setTransport] = useState('')
  const [commentaires, setCommentaires] = useState('')
  const [engagementAccepte, setEngagementAccepte] = useState(false)
  const [aptitudeAcceptee, setAptitudeAcceptee] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const deploiementId = searchParams.get('deploiement') ?? ''

  // Mode modification: lit les dates + transport + commentaire de l'URL au
  // montage et pré-remplit le formulaire complet. Auto-sélectionne "Disponible"
  // et pré-coche engagement/aptitude (l'utilisateur les a déjà acceptés la 1re
  // fois, on évite de les forcer à cocher à chaque modif).
  useEffect(() => {
    const dDebut = searchParams.get('date_debut')
    const dFin = searchParams.get('date_fin')
    const tParam = searchParams.get('transport')
    const cParam = searchParams.get('commentaire')
    if (dDebut && dFin) {
      setOriginalDebut(dDebut)
      setOriginalFin(dFin)
      setPlageDebut(dDebut)
      setPlageFin(dFin)
      setReponse('disponible')
      // Pré-cocher les acceptations (déjà acceptées lors de la 1re soumission)
      setEngagementAccepte(true)
      setAptitudeAcceptee(true)
    }
    if (tParam) setTransport(tParam)
    if (cParam) setCommentaires(cParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ref vers la section formulaire (qui apparaît après choix d'une option)
  // Permet de scroller automatiquement la page vers la suite du formulaire
  // quand le réserviste clique sur "Je suis dispo", "À confirmer" ou "Non disponible".
  const formSectionRef = useRef<HTMLDivElement>(null)

  // Auto-scroll vers le formulaire dès que l'utilisateur sélectionne une option.
  // On attend la prochaine frame pour que le DOM ait le temps de monter la section.
  useEffect(() => {
    if (!reponse) return
    const id = requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(id)
  }, [reponse])

  // Bouton "Envoyer" — cible du scroll automatique quand le formulaire devient valide.
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  // Liste des jours proposés au réserviste, calculée depuis la config du déploiement.
  // - mode_dates = 'jours_individuels' : utilise jours_proposes tel quel
  // - mode_dates = 'plage_continue'    : génère tous les jours entre date_debut et date_fin
  const joursDisponibles = useMemo<{ iso: string; label: string }[]>(() => {
    if (!deploiement) return []
    if (deploiement.mode_dates === 'jours_individuels' && deploiement.jours_proposes?.length) {
      return deploiement.jours_proposes
        .filter(d => d && d.trim())
        .sort()
        .map(iso => ({ iso, label: labelJour(iso) }))
    }
    // Plage continue : date_debut → date_fin inclusivement
    if (deploiement.date_debut) {
      const fin = deploiement.date_fin || deploiement.date_debut
      return genererPlage(deploiement.date_debut, fin).map(iso => ({ iso, label: labelJour(iso) }))
    }
    return []
  }, [deploiement])

  // Note: pas de pré-cochage en plage_continue depuis la restauration MVP plages
  // multiples. Le réserviste saisit ses propres dates via plageDebut/plageFin,
  // qui sont expandées en datesCochees au moment du submit.

  // Formulaire verrouillé si date_limite_reponse dépassée
  const estExpire = useMemo(() => {
    if (!deploiement?.date_limite_reponse) return false
    return new Date(deploiement.date_limite_reponse).getTime() < Date.now()
  }, [deploiement])

  // Configuration de branding (logo + nom portail)
  const branding = useMemo(() => brandingConfig(deploiement?.branding), [deploiement?.branding])

  // Validité du formulaire (sans tenir compte de l'état submitting).
  // Pour 'non_disponible', le bouton est toujours dispo donc on n'a pas besoin de scroller.
  const isReadyToSubmit = useMemo(() => {
    if (estExpire) return false
    if (!reponse || reponse === 'non_disponible') return false
    if (!transport) return false
    if (reponse === 'disponible' && (!engagementAccepte || !aptitudeAcceptee)) return false
    // Mode plage_continue : valider que les 2 dates de la plage sont saisies et cohérentes
    if (deploiement?.mode_dates === 'plage_continue') {
      if (!plageDebut || !plageFin) return false
      if (plageDebut > plageFin) return false
      // Borne basse : pas avant la date_debut du déploiement
      if (deploiement.date_debut && plageDebut < deploiement.date_debut) return false
      // Borne haute : si date_fin du déploiement set, ne pas dépasser
      if (deploiement.date_fin && plageFin > deploiement.date_fin) return false
      // Durée minimum: rotation typique
      if (genererPlage(plageDebut, plageFin).length < DUREE_MIN_ROTATION_JOURS) return false
      return true
    }
    // Mode jours_individuels : au moins une case cochée
    if (datesCochees.size === 0) return false
    return true
  }, [reponse, datesCochees, transport, engagementAccepte, aptitudeAcceptee, estExpire, deploiement, plageDebut, plageFin])

  // Détecte la transition invalide → valide pour scroller UNE SEULE FOIS vers le bouton.
  // Si l'utilisateur décoche puis recoche, ça re-déclenche un scroll, ce qui est attendu.
  const wasReadyRef = useRef(false)
  useEffect(() => {
    if (isReadyToSubmit && !wasReadyRef.current) {
      const id = requestAnimationFrame(() => {
        submitButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      wasReadyRef.current = true
      return () => cancelAnimationFrame(id)
    }
    if (!isReadyToSubmit) wasReadyRef.current = false
  }, [isReadyToSubmit])

  function formatDate(dateString: string): string {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const toggleDate = (iso: string) => {
    setDatesCochees(prev => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
    setError('')
  }

  useEffect(() => {
    const loadData = async () => {
      // Mode démo
      if (isDemoActive()) {
        setReserviste({ benevole_id: DEMO_RESERVISTE.benevole_id, prenom: DEMO_RESERVISTE.prenom, nom: DEMO_RESERVISTE.nom, email: DEMO_RESERVISTE.email, telephone: DEMO_RESERVISTE.telephone })
        const demoDep = DEMO_DEPLOIEMENTS.find(d => d.deploiement_id === deploiementId) || DEMO_DEPLOIEMENTS[0]
        setDeploiement(demoDep as any)
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Préserver l'URL courante (avec ?deploiement=...) pour revenir ici après OTP
        const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/disponibilites'
        router.push(`/login?redirect=${encodeURIComponent(returnTo)}`)
        return
      }
      if (!deploiementId) { setError('Aucun déploiement spécifié.'); setLoading(false); return }

      if (user.email) {
        const { data: res } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, telephone')
          .ilike('email', user.email)
          .single()
        if (res) setReserviste(res)
      }

      const { data: depRaw } = await supabase
        .from('deployments')
        .select('id, identifiant, nom, lieu, date_debut, date_fin, statut, notes_logistique, mode_dates, jours_proposes, branding, heures_limite_reponse, date_limite_reponse')
        .eq('id', deploiementId)
        .single()

      const dep = depRaw ? {
        deploiement_id: depRaw.id,
        nom_deploiement: depRaw.nom,
        nom_sinistre: undefined,
        type_incident: undefined,
        lieu: depRaw.lieu,
        date_debut: depRaw.date_debut,
        date_fin: depRaw.date_fin,
        organisme: undefined,
        date_limite_reponse: depRaw.date_limite_reponse,
        mode_dates: (depRaw.mode_dates || 'plage_continue') as 'plage_continue' | 'jours_individuels',
        jours_proposes: depRaw.jours_proposes,
        branding: (depRaw.branding || 'RIUSC') as Branding,
        heures_limite_reponse: depRaw.heures_limite_reponse ?? 8,
      } : null

      if (dep) {
        setDeploiement(dep)
      } else {
        setError('Déploiement introuvable.')
      }
      logPageVisit('/disponibilites/soumettre')
      setLoading(false)
    }
    loadData()
  }, [])

  const handleSubmit = async () => {
    // Validation
    if (!reserviste) { setError('Profil de réserviste non chargé. Reconnectez-vous et réessayez.'); return }
    if (!deploiement) { setError('Aucun déploiement sélectionné. Retournez à la liste.'); return }
    if (!reponse) { setError('Sélectionnez d\'abord une des 3 options : Disponible, À confirmer ou Non disponible.'); return }

    // datesAEnvoyer = source de vérité pour la boucle d'envoi plus bas.
    // - jours_individuels: contient les cases cochées (datesCochees)
    // - plage_continue: contient les jours expandés depuis [plageDebut, plageFin]
    let datesAEnvoyer: Set<string> = datesCochees

    if (reponse !== 'non_disponible') {
      if (deploiement?.mode_dates === 'plage_continue') {
        if (!plageDebut || !plageFin) { setError('Indiquez votre date de début et votre date de fin de disponibilité.'); return }
        if (plageDebut > plageFin) { setError('La date de fin doit être après la date de début.'); return }
        if (deploiement.date_debut && plageDebut < deploiement.date_debut) { setError(`La date de début ne peut pas être avant le ${formatDate(deploiement.date_debut)}.`); return }
        if (deploiement.date_fin && plageFin > deploiement.date_fin) { setError(`La date de fin ne peut pas être après le ${formatDate(deploiement.date_fin)}.`); return }
        const nbJoursPlage = genererPlage(plageDebut, plageFin).length
        if (nbJoursPlage < DUREE_MIN_ROTATION_JOURS) { setError(`La rotation minimale pour ce déploiement est de ${DUREE_MIN_ROTATION_JOURS} jours. Votre plage actuelle ne dure que ${nbJoursPlage} jour${nbJoursPlage > 1 ? 's' : ''}.`); return }
        datesAEnvoyer = new Set(genererPlage(plageDebut, plageFin))
        // Mémoriser pour l'écran de confirmation (qui lit datesCochees)
        setDatesCochees(datesAEnvoyer)
      } else {
        if (datesCochees.size === 0) { setError('Cochez au moins une date où vous êtes disponible.'); return }
      }
      if (!transport) { setError('Veuillez indiquer votre situation de transport.'); return }
      if (reponse === 'disponible' && !engagementAccepte) { setError('Veuillez cocher la case d\'engagement de disponibilité.'); return }
      if (reponse === 'disponible' && !aptitudeAcceptee) { setError('Veuillez cocher la case d\'aptitude physique et mentale.'); return }
    }

    setSubmitting(true)
    setError('')

    // Mode démo
    if (isDemoActive()) {
      setTimeout(() => { setSubmitting(false); setSubmitted(true) }, 1000)
      return
    }

    try {
      // Cas NON DISPONIBLE : un seul appel sans dates
      if (reponse === 'non_disponible') {
        const response = await fetch(n8nUrl('/webhook/riusc-disponibilite'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benevole_id: reserviste.benevole_id,
            deployment_id: deploiement.deploiement_id,
            date_debut: null,
            date_fin: null,
            transport: null,
            commentaire: commentaires || null,
            disponible: false,
            a_confirmer: false,
          })
        })
        if (response.ok) {
          setSubmitted(true)
        } else {
          const data = await response.json().catch(() => ({}))
          setError(data.error || 'Erreur lors de la soumission. Veuillez réessayer.')
        }
        setSubmitting(false)
        return
      }

      // Mode plage_continue: AVANT d'insérer la nouvelle plage, on supprime
      // toutes les plages existantes qui chevauchent (chacune entièrement, pas
      // tronquée — règle métier articulée par Dany). Couvre les 2 cas:
      //   - Modification via bouton ✏️ Modifier (l'ancienne plage chevauche par défaut)
      //   - Ajout d'une plage qui chevauche accidentellement une plage déjà soumise
      // Le mode jours_individuels n'a pas besoin de cleanup car les jours sont distincts.
      if (deploiement?.mode_dates === 'plage_continue' && plageDebut && plageFin) {
        try {
          await fetch('/api/disponibilites/cleanup-chevauchement', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              benevole_id: reserviste.benevole_id,
              deployment_id: deploiement.deploiement_id,
              date_debut: plageDebut,
              date_fin: plageFin,
            }),
          })
        } catch (e) {
          console.warn('Cleanup chevauchement échoué (continue avec INSERT):', e)
        }
      }

      // Cas DISPONIBLE / À CONFIRMER : un appel par date.
      // En plage_continue, datesAEnvoyer a été remplie depuis [plageDebut, plageFin]
      // au moment de la validation. En jours_individuels, c'est datesCochees.
      const datesTriees = Array.from(datesAEnvoyer).sort()
      const erreurs: string[] = []
      for (const date of datesTriees) {
        const response = await fetch(n8nUrl('/webhook/riusc-disponibilite'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benevole_id: reserviste.benevole_id,
            deployment_id: deploiement.deploiement_id,
            date_debut: date,
            date_fin: date,
            transport,
            commentaire: commentaires || null,
            disponible: reponse === 'disponible',
            a_confirmer: reponse === 'a_confirmer',
          })
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          erreurs.push(`${date}: ${data.error || response.status}`)
        }
      }

      if (erreurs.length === 0) {
        setSubmitted(true)
      } else if (erreurs.length < datesTriees.length) {
        setError(`Certaines dates ont échoué : ${erreurs.join(', ')}. Les autres sont bien enregistrées.`)
      } else {
        setError(`Erreur lors de la soumission : ${erreurs.join(', ')}`)
      }
    } catch (err) {
      console.error('Erreur soumission:', err)
      setError('Erreur de connexion. Veuillez réessayer.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>
        Chargement...
      </div>
    )
  }

  // ── Écran de confirmation ─────────────────────────────────────────────────
  if (submitted && reponse) {
    type MsgConfig = { titre: string; icon: string; bg: string; texte: string; note: string }
    const prenom = reserviste?.prenom ?? ''
    const contact = reserviste?.telephone ? 'SMS' : 'courriel'

    // En plage_continue, afficher la plage globale (compacte) plutôt que la
    // liste exhaustive des N jours qui devient illisible au-delà de 5-6 dates.
    // En jours_individuels, lister les jours cochés (utile pour vérifier sa sélection).
    const datesTriees = Array.from(datesCochees).sort()
    const isPlageContinue = deploiement?.mode_dates === 'plage_continue'
    const datesChoisies = isPlageContinue && datesTriees.length > 0
      ? `du ${labelJour(datesTriees[0])} au ${labelJour(datesTriees[datesTriees.length - 1])} (${datesTriees.length} jour${datesTriees.length > 1 ? 's' : ''})`
      : datesTriees
          .map(d => joursDisponibles.find(x => x.iso === d)?.label || labelJour(d))
          .join(', ')

    // Note d'après-soumission : adaptée au mode plage_continue qui est ouvert
    // (le réserviste peut revenir soumettre d'autres plages plus tard).
    const noteRevenirOuPlanif = isPlageContinue
      ? `Vous pouvez revenir à tout moment ajouter d'autres plages de disponibilité. Si vous êtes sélectionné(e) pour ce déploiement, vous en serez informé(e) par ${contact}.`
      : `La planification débute rapidement après la fermeture des disponibilités. Si vous êtes sélectionné pour ce déploiement, vous en serez informé par ${contact}.`

    const messages: Record<ReponseType, MsgConfig> = {
      disponible: {
        titre: 'Disponibilité enregistrée',
        icon: '✅',
        bg: '#d1fae5',
        texte: `Merci, ${prenom} ! Votre plage a bien été reçue : ${datesChoisies}.`,
        note: noteRevenirOuPlanif,
      },
      non_disponible: {
        titre: 'Réponse enregistrée',
        icon: '📋',
        bg: '#fee2e2',
        texte: `Merci, ${prenom}. Votre indisponibilité a été enregistrée.`,
        note: 'Nous espérons pouvoir compter sur vous lors d\'un prochain déploiement.',
      },
      a_confirmer: {
        titre: 'Dates soumises',
        icon: '⏳',
        bg: '#fef3c7',
        texte: `Merci, ${prenom} ! Votre plage a été reçue sous réserve de confirmation : ${datesChoisies}.`,
        note: isPlageContinue
          ? 'Un suivi sera fait dans les 48 prochaines heures pour confirmer votre disponibilité. Vous pouvez aussi revenir ajouter d\'autres plages.'
          : 'Un suivi sera fait dans les 48 prochaines heures pour confirmer votre disponibilité.',
      },
    }

    const msg = messages[reponse]

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
        <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Image src={branding.logoPath} alt={`Logo ${branding.nomCourt}`} width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>{branding.nomPortail}</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Soumission de disponibilité</p>
            </div>
          </div>
        </header>
        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
          <div style={{ backgroundColor: 'white', padding: '48px 32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', backgroundColor: msg.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px' }}>
              {msg.icon}
            </div>
            <h2 style={{ color: '#1e3a5f', margin: '0 0 12px 0', fontSize: '24px' }}>{msg.titre}</h2>
            <p style={{ color: '#4b5563', margin: '0 0 12px 0', fontSize: '16px' }}>{msg.texte}</p>
            <p style={{ color: '#6b7280', margin: '0 0 32px 0', fontSize: '14px', lineHeight: '1.6', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
              {msg.note}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              {/* Bouton "+ Ajouter une autre plage" — seulement en mode plage_continue
                  et seulement si la réponse est positive (pas pour les non disponibles) */}
              {reponse !== 'non_disponible' && deploiement?.mode_dates === 'plage_continue' && (
                <button
                  onClick={() => {
                    // Reset du formulaire pour saisir une 2e plage. On garde
                    // la réponse (Disponible / À confirmer) et le transport — ce
                    // sont des préférences globales qui ne changent pas d'une plage
                    // à l'autre. Les dates sont remises à zéro pour la nouvelle saisie.
                    setSubmitted(false)
                    setPlageDebut('')
                    setPlageFin('')
                    setDatesCochees(new Set())
                    setError('')
                  }}
                  style={{
                    display: 'inline-block', padding: '12px 28px', backgroundColor: '#f0f4f8',
                    color: '#1e3a5f', border: '1px solid #1e3a5f', borderRadius: '8px',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  + Ajouter une autre plage de disponibilité
                </button>
              )}
              <a
                href="/disponibilites"
                style={{ display: 'inline-block', padding: '12px 32px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}
              >
                Voir mes disponibilités
              </a>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Formulaire principal ──────────────────────────────────────────────────

  // Étapes de l'indicateur de progression (haut de page).
  // Étape 2 est considérée 'done' soit si le formulaire est valide (disponible/à confirmer),
  // soit si la personne a choisi 'non disponible' (aucun détail à remplir).
  const progressSteps = [
    { n: 1, label: 'Votre choix', done: !!reponse },
    { n: 2, label: 'Détails', done: !!reponse && (reponse === 'non_disponible' || isReadyToSubmit) },
    { n: 3, label: 'Envoi', done: false },
  ]
  const activeStepIndex = progressSteps.findIndex(s => !s.done)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      {/* Animation du flash visuel sur la section formulaire */}
      <style>{`
        @keyframes pulseFormHighlight {
          0%   { box-shadow: 0 0 0 0 rgba(30, 58, 95, 0.35), 0 1px 3px rgba(0,0,0,0.1); }
          60%  { box-shadow: 0 0 0 12px rgba(30, 58, 95, 0), 0 1px 3px rgba(0,0,0,0.1); }
          100% { box-shadow: 0 0 0 0 rgba(30, 58, 95, 0), 0 1px 3px rgba(0,0,0,0.1); }
        }
      `}</style>
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src={branding.logoPath} alt={`Logo ${branding.nomCourt}`} width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>{branding.nomPortail}</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Soumission de disponibilité</p>
            </div>
          </a>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/disponibilites" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour aux disponibilités</a>
        </div>

        {/* Carte déploiement */}
        {deploiement && (
          <div style={{ backgroundColor: '#1e3a5f', padding: '24px 28px', borderRadius: '12px', marginBottom: '24px', color: 'white' }}>
            {deploiement.nom_sinistre && (
              <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, marginBottom: '6px' }}>
                {deploiement.nom_sinistre}
              </div>
            )}
            {/* Titre + date à droite (alignés verticalement au centre, wrap sur mobile).
                Lieu volontairement retiré ici: risque opérationnel de déplacement
                avant mobilisation. Le lieu est révélé uniquement à l'étape 8 via tplMobil(). */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', flex: '1 1 auto', lineHeight: 1.3 }}>{deploiement.nom_deploiement}</h2>
              {deploiement.date_debut && (
                <div style={{ fontSize: '14px', opacity: 0.95, whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1.3 }}>
                  📅 {formatDate(deploiement.date_debut)}{deploiement.date_fin ? ` au ${formatDate(deploiement.date_fin)}` : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', opacity: 0.9 }}>
              {deploiement.type_incident && <div>🔥 {deploiement.type_incident}</div>}
              {deploiement.organisme && <div>🏢 {deploiement.organisme}</div>}
              {deploiement.date_limite_reponse && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: estExpire ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
                  🕐 {estExpire ? 'Délai expiré' : 'Répondre ' + formatDateLimite(new Date(deploiement.date_limite_reponse))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bloc d'aide accordéon */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', overflow: 'hidden', border: '1px solid #e0e7ef' }}>
          <button
            onClick={() => setShowAide(!showAide)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>💡</span>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a5f' }}>Comment fonctionne la soumission de disponibilité ?</span>
            </div>
            <svg width="16" height="16" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transform: showAide ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAide && (
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '20px 24px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>✅</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>
                      {deploiement?.mode_dates === 'jours_individuels'
                        ? 'Cochez les jours où vous êtes disponible'
                        : 'Indiquez les plages où vous êtes disponible'}
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      {deploiement?.mode_dates === 'jours_individuels'
                        ? 'Cochez vos journées disponibles. Idéalement, regroupez vos jours en blocs consécutifs pour faciliter la planification des rotations.'
                        : 'Soumettez toutes les plages de dates où vous êtes disponible pour ce déploiement. Vous pourrez ajouter d\'autres plages après votre première soumission.'}
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb' }} />

                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>⚡</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Planification rapide</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      La planification débute peu après la fermeture des disponibilités. Indiquez des dates où vous seriez <strong>réellement disponible</strong>.
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb' }} />

                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>📣</span>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Vous serez informé dans tous les cas</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                      Que vous soyez sélectionné pour ce déploiement ou non, vous recevrez une réponse.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {estExpire && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', lineHeight: 1.6 }}>
            ⛔ <strong>Le délai pour soumettre vos disponibilités est expiré.</strong><br/>
            Si vous souhaitez tout de même vous rendre disponible, contactez-nous à <a href="mailto:riusc@aqbrs.ca" style={{ color: '#991b1b', textDecoration: 'underline' }}>riusc@aqbrs.ca</a>.
          </div>
        )}

        {/* Indicateur de progression — 3 étapes Choix → Détails → Envoi */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 18px', backgroundColor: 'white', borderRadius: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          {progressSteps.map((s, i) => {
            const active = i === activeStepIndex
            const done = s.done
            return (
              <Fragment key={s.n}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '26px', height: '26px', borderRadius: '50%',
                    backgroundColor: done ? '#059669' : active ? '#1e3a5f' : '#e5e7eb',
                    color: (done || active) ? 'white' : '#6b7280',
                    fontSize: '13px', fontWeight: 700, flexShrink: 0,
                    transition: 'background-color 0.3s, color 0.3s'
                  }}>
                    {done ? '✓' : s.n}
                  </span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: active ? 600 : 500,
                    color: done ? '#059669' : active ? '#1e3a5f' : '#9ca3af'
                  }}>{s.label}</span>
                </div>
                {i < progressSteps.length - 1 && (
                  <span style={{ color: s.done ? '#059669' : '#d1d5db', fontSize: '14px' }}>→</span>
                )}
              </Fragment>
            )
          })}
        </div>

        {/* Choix de réponse */}
        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Quelle est votre disponibilité ?</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <button onClick={() => { setReponse('disponible'); setError(''); setEngagementAccepte(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', border: reponse === 'disponible' ? '2px solid #059669' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: reponse === 'disponible' ? '#ecfdf5' : 'white', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>✅</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#065f46' }}>Je suis disponible</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Cochez les jours où vous pouvez vous déplacer</div>
              </div>
            </button>

            <button onClick={() => { setReponse('a_confirmer'); setError(''); setEngagementAccepte(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', border: reponse === 'a_confirmer' ? '2px solid #d97706' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: reponse === 'a_confirmer' ? '#fffbeb' : 'white', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>⏳</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#92400e' }}>Je dois confirmer avec mon employeur</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Cochez les jours souhaités, un suivi sera fait dans les 48h</div>
              </div>
            </button>

            <button onClick={() => { setReponse('non_disponible'); setError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', border: reponse === 'non_disponible' ? '2px solid #dc2626' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: reponse === 'non_disponible' ? '#fef2f2' : 'white', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>❌</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#991b1b' }}>Je ne suis pas disponible</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Vous pourrez ajouter un commentaire si vous le souhaitez</div>
              </div>
            </button>
          </div>
        </div>

        {/* Formulaire disponible / à confirmer */}
        {reponse && reponse !== 'non_disponible' && (
          <div key={reponse} ref={formSectionRef} style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', scrollMarginTop: '24px', animation: 'pulseFormHighlight 1.2s ease-out' }}>

            {reponse === 'disponible' && (
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>💡</span>
                  <p style={{ margin: 0, color: '#0369a1', fontSize: '14px', lineHeight: '1.7' }}>
                    Cochez les jours où vous êtes réellement disponible. Si vous êtes sélectionné, nous vous contacterons.
                  </p>
                </div>
              </div>
            )}

            {reponse === 'a_confirmer' && (
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>⏳</span>
                  <p style={{ margin: 0, color: '#78350f', fontSize: '14px', lineHeight: '1.7' }}>
                    Cochez les jours souhaités. Un suivi sera fait dans les <strong>48 heures</strong> pour confirmer ou ajuster votre disponibilité.
                  </p>
                </div>
              </div>
            )}

            {/* Jours disponibles — UI varie selon mode_dates */}
            <div style={{ marginBottom: '28px' }}>
              {deploiement?.mode_dates === 'plage_continue' ? (
                <>
                  <h3 style={{ color: '#1e3a5f', margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
                    Vos dates de disponibilité
                  </h3>
                  {originalDebut && originalFin && (
                    <div style={{
                      backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
                      padding: '12px 16px', marginBottom: '14px', fontSize: '13px', color: '#1e40af',
                    }}>
                      ✏️ <strong>Modification de votre plage existante</strong> du {formatDate(originalDebut)} au {formatDate(originalFin)}.
                      Saisissez les nouvelles dates ci-dessous pour remplacer cette plage.
                    </div>
                  )}
                  <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                    Indiquez la plage de dates où vous êtes disponible pour ce déploiement.
                    {deploiement.date_debut && (
                      <> Le déploiement débute le <strong>{formatDate(deploiement.date_debut)}</strong>{deploiement.date_fin ? <> et se termine au plus tard le <strong>{formatDate(deploiement.date_fin)}</strong></> : <> et n'a pas de date de fin déterminée</>}.</>
                    )}
                  </p>
                  <div style={{
                    backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '10px',
                    padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e3a5f', marginBottom: '6px' }}>
                        📅 Date de début
                      </label>
                      <input
                        type="date"
                        value={plageDebut}
                        min={deploiement.date_debut || undefined}
                        max={deploiement.date_fin || undefined}
                        onChange={(e) => {
                          setPlageDebut(e.target.value)
                          setError('')
                          // Si la plageFin précédente devient invalide (< plageDebut + DUREE_MIN), on la reset.
                          // L'utilisateur la choisira librement à l'ouverture du picker (le min du picker
                          // l'empêchera de choisir trop court).
                          if (e.target.value && plageFin) {
                            const minFin = ajouterJours(e.target.value, DUREE_MIN_ROTATION_JOURS - 1)
                            if (plageFin < minFin) setPlageFin('')
                          }
                        }}
                        style={{
                          width: '100%', padding: '10px 12px', fontSize: '14px',
                          border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e3a5f', marginBottom: '6px' }}>
                        📅 Date de fin <span style={{ fontWeight: 400, color: '#9ca3af' }}>(min. {DUREE_MIN_ROTATION_JOURS}j)</span>
                      </label>
                      <input
                        type="date"
                        value={plageFin}
                        min={plageDebut ? ajouterJours(plageDebut, DUREE_MIN_ROTATION_JOURS - 1) : (deploiement.date_debut || undefined)}
                        max={deploiement.date_fin || undefined}
                        onChange={(e) => { setPlageFin(e.target.value); setError('') }}
                        style={{
                          width: '100%', padding: '10px 12px', fontSize: '14px',
                          border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {plageDebut && plageFin && plageDebut <= plageFin && (() => {
                      const nbJours = genererPlage(plageDebut, plageFin).length
                      const trop_court = nbJours < DUREE_MIN_ROTATION_JOURS
                      return (
                        <div style={{
                          gridColumn: '1 / -1',
                          backgroundColor: trop_court ? '#fef2f2' : '#ecfdf5',
                          border: `1px solid ${trop_court ? '#dc2626' : '#059669'}`,
                          borderRadius: '8px', padding: '10px 14px', fontSize: '13px',
                          color: trop_court ? '#991b1b' : '#065f46',
                        }}>
                          {trop_court
                            ? <>⚠️ Cette plage de <strong>{nbJours} jour{nbJours > 1 ? 's' : ''}</strong> est trop courte. La rotation minimale est de <strong>{DUREE_MIN_ROTATION_JOURS} jours</strong> pour ce déploiement.</>
                            : <>✓ Vous serez disponible pendant <strong>{nbJours} jour{nbJours > 1 ? 's' : ''}</strong>, du {formatDate(plageDebut)} au {formatDate(plageFin)}.</>}
                        </div>
                      )
                    })()}
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                    Êtes-vous disponible ces journées ?
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {joursDisponibles.map(({ iso, label }) => {
                      const checked = datesCochees.has(iso)
                      return (
                        <label key={iso} style={{
                          display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px',
                          border: checked ? '2px solid #059669' : '1px solid #e5e7eb',
                          borderRadius: '10px', cursor: 'pointer',
                          backgroundColor: checked ? '#ecfdf5' : 'white',
                          transition: 'all 0.2s'
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDate(iso)}
                            style={{ accentColor: '#059669', width: '22px', height: '22px', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: '15px', color: '#111827', fontWeight: checked ? '600' : '500' }}>
                            {label}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6b7280' }}>Cochez au moins une date.</p>
                </>
              )}
            </div>

            {/* Transport */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Transport *</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { value: 'autonome', label: 'Je suis autonome (véhicule personnel)' },
                  { value: 'covoiturage_offre', label: "Je peux offrir du covoiturage à d'autres réservistes" },
                  { value: 'covoiturage_recherche', label: 'Je recherche du covoiturage' },
                  { value: 'besoin_transport', label: "J'ai besoin d'un transport (pas de véhicule)" },
                ].map((option) => (
                  <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: transport === option.value ? '2px solid #1e3a5f' : '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', backgroundColor: transport === option.value ? '#f0f4f8' : 'white', transition: 'all 0.2s' }}>
                    <input type="radio" name="transport" value={option.value} checked={transport === option.value} onChange={(e) => setTransport(e.target.value)}
                      style={{ accentColor: '#1e3a5f', width: '18px', height: '18px' }} />
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: transport === option.value ? '500' : '400' }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Commentaires */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Commentaires</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>Informations supplémentaires pertinentes (limitations, compétences particulières, etc.)</p>
              <textarea value={commentaires} onChange={(e) => setCommentaires(e.target.value)} placeholder="Optionnel" rows={3}
                style={{ width: '100%', padding: '12px 14px', fontSize: '14px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical', color: '#111827', fontFamily: 'inherit' }} />
            </div>

            {/* Engagement */}
            {reponse === 'disponible' && (
              <div style={{ backgroundColor: '#f9fafb', padding: '16px 20px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e5e7eb' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={engagementAccepte} onChange={(e) => setEngagementAccepte(e.target.checked)}
                    style={{ accentColor: '#1e3a5f', width: '20px', height: '20px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                    Je confirme que les dates cochées reflètent ma <strong>disponibilité réelle</strong> au moment de la soumission.
                  </span>
                </label>
              </div>
            )}

            {/* Aptitude */}
            {reponse === 'disponible' && (
              <div style={{ backgroundColor: '#f9fafb', padding: '16px 20px', borderRadius: '8px', marginBottom: '28px', border: '1px solid #e5e7eb' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aptitudeAcceptee} onChange={(e) => setAptitudeAcceptee(e.target.checked)}
                    style={{ accentColor: '#1e3a5f', width: '20px', height: '20px', marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                    Je confirme être apte, tant physiquement que mentalement, à participer à un déploiement de la RIUSC et à effectuer les tâches pouvant inclure du travail physique en conditions opérationnelles. Je m&apos;engage à signaler toute condition pouvant limiter ma capacité à accomplir ces tâches en toute sécurité.
                  </span>
                </label>
              </div>
            )}

            {/* Calcul du nombre de jours pour le label du bouton — fonctionne pour les 2 modes:
                en plage_continue, datesCochees est vide jusqu'au submit, donc on utilise plageDebut/plageFin */}
            {(() => {
              const nbJoursLabel = deploiement?.mode_dates === 'plage_continue' && plageDebut && plageFin && plageDebut <= plageFin
                ? genererPlage(plageDebut, plageFin).length
                : datesCochees.size
              const isDisabled = submitting || !isReadyToSubmit
              return (
                <button
                  ref={submitButtonRef}
                  onClick={handleSubmit}
                  disabled={isDisabled}
                  style={{
                    width: '100%', padding: '16px 24px', scrollMarginTop: '24px',
                    backgroundColor: isDisabled
                      ? '#9ca3af' : reponse === 'disponible' ? '#059669' : '#d97706',
                    color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}>
                  {submitting ? 'Soumission en cours...' : reponse === 'disponible' ? `Envoyer mes disponibilités (${nbJoursLabel} jour${nbJoursLabel > 1 ? 's' : ''})` : `Soumettre mes dates à confirmer (${nbJoursLabel} jour${nbJoursLabel > 1 ? 's' : ''})`}
                </button>
              )
            })()}
          </div>
        )}

        {/* Formulaire non disponible */}
        {reponse === 'non_disponible' && (
          <div ref={formSectionRef} style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', scrollMarginTop: '24px', animation: 'pulseFormHighlight 1.2s ease-out' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Commentaire (optionnel)</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>Vous pouvez indiquer la raison de votre indisponibilité si vous le souhaitez.</p>
              <textarea value={commentaires} onChange={(e) => setCommentaires(e.target.value)} placeholder="Optionnel" rows={3}
                style={{ width: '100%', padding: '12px 14px', fontSize: '14px', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical', color: '#111827', fontFamily: 'inherit' }} />
            </div>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ width: '100%', padding: '16px 24px', backgroundColor: submitting ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}>
              {submitting ? 'Enregistrement...' : 'Confirmer mon indisponibilité'}
            </button>
          </div>
        )}
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}

export default function SoumettrePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Chargement...</div>}>
      <SoumettreContent />
    </Suspense>
  )
}
