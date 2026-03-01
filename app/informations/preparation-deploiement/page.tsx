'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PortailHeader from '@/app/components/PortailHeader'
import ImpersonateBanner from '@/app/components/ImpersonateBanner'
import { isDemoActive } from '@/utils/demoMode'
import { useAuth } from '@/utils/useAuth'
import { createClient } from '@/utils/supabase/client'
import { logPageVisit } from '@/utils/logEvent'

/* =============================
   DONNÉES DES SECTIONS
============================= */
const SECTIONS = [
  {
    id: 'avant',
    emoji: '📞',
    titre: 'Avant le déploiement — Dès la confirmation',
    items: [
      'Confirmer ta disponibilité auprès de ton employeur. Rappel : la Loi sur la sécurité civile te protège contre les mesures disciplinaires liées à ton absence pour un déploiement officiel.',
      'Prévenir tes proches et ton contact d\'urgence.',
      'Vérifier que ton profil sur le portail est à jour : allergies, contact d\'urgence, conditions médicales.',
      'Consulter le portail pour les détails du déploiement : lieu, durée prévue, organisme responsable.',
    ],
  },
  {
    id: 'apporter',
    emoji: '🎒',
    titre: 'Quoi apporter — Matériel personnel',
    subtitle: 'Vêtements et équipement de travail',
    items: [
      'Vêtements de travail en couches, adaptés à la météo (il peut faire froid le matin et chaud l\'après-midi).',
      'Bottes de travail conformes — déjà rodées, ce n\'est pas le moment de les essayer pour la première fois.',
      'Vêtements de rechange pour le travail.',
      'Bas de rechange en quantité suffisante — prévoyez au moins une paire par jour. Les pieds mouillés ou inconfortables, ça se paie vite sur le terrain.',
    ],
    subtitle2: 'Vêtements et articles pour vos temps libres',
    items2: [
      'Vêtements confortables et chaussures pour les moments hors service (repos, repas, soirée).',
      'Articles pour vos temps libres : livre, jeux de cartes, écouteurs, etc.',
    ],
    subtitle3: 'Essentiels personnels',
    items3: [
      'Un sac de voyage ou sac à dos suffisamment grand pour contenir tout votre matériel (volume recommandé à confirmer).',
      'Sac de couchage — optionnel mais recommandé. Les draps sont généralement fournis sur les sites d\'hébergement, mais comme réserviste on ne sait pas toujours à l\'avance où on sera logé.',
      'Oreiller compact (optionnel).',
      'Articles d\'hygiène personnelle (brosse à dents, savon, serviette, etc.).',
      'Médicaments personnels en quantité suffisante pour la durée du déploiement.',
      'Collations et bouteille d\'eau réutilisable.',
      'Lampe frontale et piles de rechange.',
      'Chargeur portatif pour téléphone.',
      'Pièce d\'identité.',
      'Carte d\'assurance maladie.',
    ],
  },
  {
    id: 'fourni',
    emoji: '🦺',
    titre: 'Ce qui est fourni sur place',
    items: [
      'Équipements de protection individuelle (ÉPI) de base : dossard haute visibilité, lunettes de protection, gants de travail — distribués à l\'inscription sur le site.',
      'ÉPI spécialisé selon la tâche assignée (casque, protection respiratoire, etc.).',
      'Repas pendant le déploiement.',
      'Hébergement (si applicable selon la durée et le lieu).',
    ],
  },
  {
    id: 'arrivee',
    emoji: '📍',
    titre: 'À votre arrivée sur le site',
    items: [
      'Se présenter au point d\'inscription désigné.',
      'Recevoir le briefing de sécurité et les consignes terrain.',
      'Recevoir vos ÉPI (équipements de protection individuelle) de base.',
      'Prendre connaissance de votre affectation : tâche, équipe et responsable terrain.',
      '⚠️ IMPORTANT — Vous devez signer le formulaire de présence à chaque jour, à l\'entrée ET à la sortie du site. C\'est obligatoire pour votre couverture d\'assurance et le suivi des effectifs sur le terrain. Ne l\'oubliez pas !',
    ],
  },
  {
    id: 'pendant',
    emoji: '⚠️',
    titre: 'Pendant le déploiement — Rappels importants',
    items: [
      'Respecter les rotations et les pauses prévues.',
      'S\'hydrater régulièrement, même si on n\'a pas soif.',
      'Signaler la fatigue tôt — ne pas attendre d\'être épuisé.',
      'Toujours travailler en binôme au minimum.',
      'En cas de doute ou de danger : arrêter et signaler immédiatement au responsable terrain.',
      'Respecter les zones de travail et les consignes de circulation.',
      'La dimension humaine : il est normal de ressentir du stress ou une charge émotionnelle face à certaines situations. Le débriefing d\'équipe est là pour ça — n\'hésitez pas à en parler.',
    ],
  },
  {
    id: 'retour',
    emoji: '🏠',
    titre: 'Au retour du déploiement',
    items: [
      'Participer au débriefing d\'équipe.',
      'Prendre soin de vous dans les jours qui suivent — le repos fait partie du processus.',
      'Si des situations vécues vous affectent, c\'est normal. Des ressources de soutien sont disponibles.',
      'N\'hésitez pas à en parler à un proche, à un collègue réserviste ou à contacter l\'équipe RIUSC.',
    ],
  },
]

/* =============================
   COMPOSANT SECTION
============================= */
interface SectionData {
  id: string
  emoji: string
  titre: string
  items: string[]
  subtitle?: string
  subtitle2?: string
  items2?: string[]
  subtitle3?: string
  items3?: string[]
}

function ItemList({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#374151', lineHeight: '1.7' }}>
          <span style={{ color: '#1e3a5f', fontSize: '8px', marginTop: '8px', flexShrink: 0 }}>●</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}

function SubtitleLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', paddingLeft: '4px' }}>
      {text}
    </div>
  )
}

function SectionCard({ section }: { section: SectionData }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontSize: '28px' }}>{section.emoji}</span>
        <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '17px', fontWeight: '700' }}>{section.titre}</h3>
      </div>

      {section.subtitle && <SubtitleLabel text={section.subtitle} />}
      <div style={{ marginBottom: section.subtitle2 ? '20px' : '0' }}>
        <ItemList items={section.items} />
      </div>

      {section.subtitle2 && section.items2 && (
        <div style={{ marginBottom: section.subtitle3 ? '20px' : '0' }}>
          <SubtitleLabel text={section.subtitle2} />
          <ItemList items={section.items2} />
        </div>
      )}

      {section.subtitle3 && section.items3 && (
        <div>
          <SubtitleLabel text={section.subtitle3} />
          <ItemList items={section.items3} />
        </div>
      )}
    </div>
  )
}

/* =============================
   PAGE PRINCIPALE
============================= */
export default function PreparationDeploiementPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { user: authUser, loading: authLoading } = useAuth()

  useEffect(() => {
    const load = async () => {
      if (isDemoActive()) {
        logPageVisit('/informations/preparation-deploiement')
        setLoading(false)
        return
      }
      if (authLoading) return
      if (!authUser) { router.push('/login'); return }
      logPageVisit('/informations/preparation-deploiement')
      setLoading(false)
    }
    load()
  }, [authUser, authLoading])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader subtitle="Préparation au déploiement" />
      <ImpersonateBanner />

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <a href="/informations" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '20px' }}>
          ← Retour aux informations pratiques
        </a>

        <h2 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700' }}>
          Comment se préparer pour un déploiement
        </h2>
        <p style={{ color: '#6b7280', margin: '0 0 28px 0', fontSize: '15px', lineHeight: '1.7' }}>
          Ce guide vous accompagne de la confirmation de votre participation jusqu&apos;à votre retour.
          Les consignes officielles sont toujours transmises au briefing terrain.
        </p>

        {/* Bandeau révision en cours */}
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>🔄</span>
          <p style={{ margin: 0, fontSize: '14px', color: '#92400e', lineHeight: '1.7' }}>
            <strong>Page en cours de révision</strong> — Ce guide est présentement revu par des réservistes expérimentés
            afin de compléter et valider les recommandations. Certaines informations (ex. : volume de sac recommandé)
            seront précisées sous peu.
          </p>
        </div>

        {/* Bandeau info */}
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>💡</span>
          <p style={{ margin: 0, fontSize: '14px', color: '#1e40af', lineHeight: '1.7' }}>
            <strong>Rappel :</strong> Lorsque vous arrivez sur le site de déploiement, présentez-vous au point d&apos;inscription désigné.
            Vous y recevrez toutes les informations pertinentes ainsi que vos équipements de protection individuelle (ÉPI) de base.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <SectionCard key={section.id} section={section as SectionData} />
        ))}

        {/* Section contact */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '24px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#374151' }}>
            Des questions sur la préparation ? N&apos;hésitez pas à nous écrire.
          </p>
          <a
            href="mailto:riusc@aqbrs.ca"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}
          >
            📧 riusc@aqbrs.ca
          </a>
        </div>

        <div style={{ textAlign: 'center' }}>
          <a
            href="/informations"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2d4a6f')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#1e3a5f')}
          >
            ← Retour aux informations pratiques
          </a>
        </div>
      </main>

      <ImpersonateBanner position="bottom" />

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
