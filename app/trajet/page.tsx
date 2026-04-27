'use client'

// app/trajet/page.tsx
//
// Page dediee a la declaration rapide d'un trajet depuis un lien partage
// (SMS ou courriel de mobilisation/confirmation). Le lien contient l'un des
// query params :
//   - ?dep=<deployment_id>  : deploiement pre-selectionne
//   - ?camp=<session_id>    : camp pre-selectionne
//
// Comportement :
//   - Si non connecte -> redirige vers /login avec redirect_to sur cette page
//   - Si trajet deja ouvert pour ce contexte -> modal "Je suis arrive" ou "Rentre"
//   - Sinon -> modal "Je demarre un aller/retour" avec le contexte pre-rempli
//
// Motivation : les reservistes mobilises sur un deploiement ou inscrits a un
// camp doivent pouvoir declarer leurs heures de trajet facilement. Un lien
// direct dans les SMS/courriels evite qu'ils aient a naviguer dans le portail.

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'
import { TrajetModal, type Trajet, type Deploiement, type Camp } from '@/app/components/TrajetButton'

const C = '#1e3a5f'
const MUTED = '#6b7280'

function TrajetPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const depParam = searchParams.get('dep')
  const campParam = searchParams.get('camp')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState(false)

  const [trajetOuvert, setTrajetOuvert] = useState<Trajet | null>(null)
  const [trajets, setTrajets] = useState<Trajet[]>([])
  const [deploiements, setDeploiements] = useState<Deploiement[]>([])
  const [camps, setCamps] = useState<Camp[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  // Calcul de la cle initiale de contexte selon les query params
  const initialContexteKey = depParam
    ? `dep:${depParam}`
    : campParam
      ? `camp:${campParam}`
      : ''

  const fetchState = async () => {
    try {
      const res = await fetch('/api/trajets/mes-trajets?limit=20', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          // Pas connecte -> redirection login avec retour ici
          const current = window.location.pathname + window.location.search
          router.push(`/login?redirect_to=${encodeURIComponent(current)}`)
          return
        }
        setError(`Erreur chargement (${res.status})`)
        setLoading(false)
        return
      }
      const data = await res.json()
      setTrajets(data.trajets || [])
      setTrajetOuvert(data.trajet_ouvert || null)
      setDeploiements(data.contextes?.deploiements || [])
      setCamps(data.contextes?.camps || [])
      setAuthorized(true)
      setLoading(false)
      // Ouvrir la modal automatiquement quand les donnees sont pretes
      setModalOpen(true)
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue')
      setLoading(false)
    }
  }

  useEffect(() => {
    // Auth check via supabase
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        const current = window.location.pathname + window.location.search
        router.push(`/login?redirect_to=${encodeURIComponent(current)}`)
        return
      }
      fetchState()
    })
  }, [])

  // Recherche du label du contexte pour l'affichage hors modal
  let contexteLabel = ''
  if (depParam) {
    const dep = deploiements.find(d => d.id === depParam)
    contexteLabel = dep ? `${dep.nom}${dep.lieu ? ' — ' + dep.lieu : ''}` : `Déploiement ${depParam}`
  } else if (campParam) {
    const camp = camps.find(c => c.session_id === campParam)
    contexteLabel = camp?.camp_nom || `Camp ${campParam}`
  }

  // Verif que le contexte du lien est bien dans la liste des contextes autorises
  // pour cet utilisateur (il pourrait cliquer un lien qui ne lui est pas destine)
  const contexteValide = initialContexteKey
    ? (depParam ? deploiements.some(d => d.id === depParam) : camps.some(c => c.session_id === campParam))
    : true // pas de param = pas de validation stricte

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader subtitle="Déclaration de trajet" />

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: 40 }}>
            Chargement…
          </div>
        )}

        {error && (
          <div style={{ padding: 14, borderRadius: 10, backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {authorized && !loading && !contexteValide && initialContexteKey && (
          <div style={{ padding: 16, borderRadius: 10, backgroundColor: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', fontSize: 14, marginBottom: 16 }}>
            <strong>Contexte introuvable.</strong> Le {depParam ? 'déploiement' : 'camp'}{' '}indiqué dans le lien n&apos;est pas dans ta liste de contextes actifs. Tu peux quand même déclarer un trajet sur un autre contexte ci-dessous.
          </div>
        )}

        {authorized && !loading && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C }}>
              🚗 Déclaration de trajet
            </h1>
            {contexteLabel && (
              <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
                Contexte : <strong>{contexteLabel}</strong>
              </div>
            )}
            <p style={{ fontSize: 13, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>
              Utilise ce formulaire à chaque aller-retour pour ton déploiement/camp.
              Tes heures de trajet comptent comme heures secondaires pour le crédit
              d&apos;impôt Québec.
            </p>
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  padding: '12px 24px', backgroundColor: C, color: 'white',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {trajetOuvert
                  ? (trajetOuvert.type === 'aller' ? '🅿️ Je suis arrivé à destination' : '🏠 Je suis rentré chez moi')
                  : '🚗 Démarrer un trajet'}
              </button>
            </div>
          </div>
        )}
      </main>

      {modalOpen && authorized && (
        <TrajetModal
          trajetOuvert={trajetOuvert}
          trajets={trajets}
          deploiements={deploiements}
          camps={camps}
          initialContexteKey={contexteValide ? initialContexteKey : undefined}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchState() }}
        />
      )}
    </div>
  )
}

export default function TrajetPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Chargement…</div>}>
      <TrajetPageContent />
    </Suspense>
  )
}
