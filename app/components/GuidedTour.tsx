'use client'

import { useState, useEffect, useCallback } from 'react'

interface TourStep {
  target: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

interface GuidedTourProps {
  isApproved: boolean
  hasCertificat: boolean
  hasDeploiements: boolean
  hasCiblages: boolean
  forceStart?: boolean
  onTourEnd?: () => void
}

const newMemberSteps: TourStep[] = [
  {
    target: '[data-tour="welcome"]',
    title: 'Bienvenue sur le Portail RIUSC !',
    content: 'Voici votre espace personnel. Nous allons vous guider à travers les fonctionnalités principales.',
    position: 'bottom'
  },
  {
    target: '[data-tour="menu"]',
    title: 'Votre menu',
    content: 'Accédez à toutes les sections du portail et relancez cette visite guidée à tout moment.',
    position: 'bottom'
  },
  {
    target: '[data-tour="profil"]',
    title: 'Mon profil',
    content: 'Consultez et mettez à jour vos informations personnelles à tout moment.',
    position: 'bottom'
  },
  {
    target: '[data-tour="formation"]',
    title: 'Formation et parcours',
    content: 'C\'est votre priorité ! Suivez la formation en ligne, soumettez votre certificat et inscrivez-vous au camp de qualification.',
    position: 'bottom'
  },
  {
    target: '[data-tour="tournee"]',
    title: 'Tournée des camps',
    content: 'Consultez le calendrier des camps de qualification par région pour trouver celui qui vous convient.',
    position: 'top'
  },
  {
    target: '[data-tour="informations"]',
    title: 'Informations pratiques',
    content: 'Documents, ressources et références utiles pour votre rôle de réserviste.',
    position: 'top'
  },
  {
    target: '[data-tour="communaute"]',
    title: 'Communauté',
    content: 'Échangez avec les autres réservistes, posez vos questions et partagez vos expériences.',
    position: 'top'
  }
]

const approvedMemberSteps: TourStep[] = [
  {
    target: '[data-tour="welcome"]',
    title: 'Bienvenue sur le Portail RIUSC !',
    content: 'Voici votre espace personnel de réserviste. Découvrons ensemble les fonctionnalités disponibles.',
    position: 'bottom'
  },
  {
    target: '[data-tour="menu"]',
    title: 'Votre menu',
    content: 'Accédez à toutes les sections du portail et relancez cette visite guidée à tout moment.',
    position: 'bottom'
  },
  {
    target: '[data-tour="deploiements"]',
    title: 'Sollicitation de déploiement',
    content: 'Lorsqu\'un déploiement nécessitera votre profil, il apparaîtra ici. Vous pourrez soumettre votre disponibilité directement.',
    position: 'bottom'
  },
  {
    target: '[data-tour="profil"]',
    title: 'Mon profil',
    content: 'Consultez et mettez à jour vos informations personnelles.',
    position: 'bottom'
  },
  {
    target: '[data-tour="dossier"]',
    title: 'Mon dossier réserviste',
    content: 'Retrouvez vos compétences, certifications et informations complémentaires dans votre dossier.',
    position: 'bottom'
  },
  {
    target: '[data-tour="disponibilites"]',
    title: 'Mes disponibilités',
    content: 'Consultez l\'historique de vos disponibilités soumises pour les différents déploiements.',
    position: 'bottom'
  },
  {
    target: '[data-tour="formation"]',
    title: 'Formation et parcours',
    content: 'Retrouvez vos certificats, votre progression et les formations disponibles.',
    position: 'top'
  },
  {
    target: '[data-tour="informations"]',
    title: 'Informations pratiques',
    content: 'Documents, ressources et références utiles pour votre rôle de réserviste.',
    position: 'top'
  },
  {
    target: '[data-tour="communaute"]',
    title: 'Communauté',
    content: 'Échangez avec les autres réservistes, posez vos questions et partagez vos expériences.',
    position: 'top'
  }
]

const approvedWithDeploiementsSteps: TourStep[] = [
  {
    target: '[data-tour="welcome"]',
    title: 'Bienvenue sur le Portail RIUSC !',
    content: 'Voici votre espace personnel de réserviste. Découvrons ensemble les fonctionnalités disponibles.',
    position: 'bottom'
  },
  {
    target: '[data-tour="menu"]',
    title: 'Votre menu',
    content: 'Accédez à toutes les sections du portail et relancez cette visite guidée à tout moment.',
    position: 'bottom'
  },
  {
    target: '[data-tour="deploiements"]',
    title: 'Sollicitation de déploiement',
    content: 'Vous avez des déploiements actifs ! Cliquez sur « Soumettre ma disponibilité » pour indiquer si vous êtes disponible.',
    position: 'bottom'
  },
  {
    target: '[data-tour="profil"]',
    title: 'Mon profil',
    content: 'Consultez et mettez à jour vos informations personnelles.',
    position: 'bottom'
  },
  {
    target: '[data-tour="dossier"]',
    title: 'Mon dossier réserviste',
    content: 'Retrouvez vos compétences, certifications et informations complémentaires dans votre dossier.',
    position: 'bottom'
  },
  {
    target: '[data-tour="disponibilites"]',
    title: 'Mes disponibilités',
    content: 'Consultez l\'historique de vos disponibilités soumises pour les différents déploiements.',
    position: 'bottom'
  },
  {
    target: '[data-tour="formation"]',
    title: 'Formation et parcours',
    content: 'Retrouvez vos certificats, votre progression et les formations disponibles.',
    position: 'top'
  },
  {
    target: '[data-tour="informations"]',
    title: 'Informations pratiques',
    content: 'Documents, ressources et références utiles pour votre rôle de réserviste.',
    position: 'top'
  },
  {
    target: '[data-tour="communaute"]',
    title: 'Communauté',
    content: 'Échangez avec les autres réservistes, posez vos questions et partagez vos expériences.',
    position: 'top'
  }
]

export default function GuidedTour({ isApproved, hasCertificat, hasDeploiements, hasCiblages, forceStart, onTourEnd }: GuidedTourProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({})
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({})
  const [showStartModal, setShowStartModal] = useState(false)

  const getSteps = useCallback((): TourStep[] => {
    if (!isApproved || !hasCertificat) {
      return newMemberSteps
    }
    if (hasDeploiements || hasCiblages) {
      return approvedWithDeploiementsSteps
    }
    return approvedMemberSteps
  }, [isApproved, hasCertificat, hasDeploiements, hasCiblages])

  const steps = getSteps()

  useEffect(() => {
    if (forceStart) {
      setShowStartModal(true)
      return
    }
    const tourKey = isApproved ? 'riusc-tour-approved' : 'riusc-tour-new'
    const hasSeenTour = localStorage.getItem(tourKey)
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setShowStartModal(true)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isApproved, forceStart])

  const endTour = useCallback(() => {
    setIsActive(false)
    setCurrentStep(0)
    const tourKey = isApproved ? 'riusc-tour-approved' : 'riusc-tour-new'
    localStorage.setItem(tourKey, 'true')
    if (onTourEnd) onTourEnd()
  }, [isApproved, onTourEnd])

  const positionTooltip = useCallback((stepIndex: number) => {
    const step = steps[stepIndex]
    if (!step) return

    const element = document.querySelector(step.target)
    if (!element) {
      if (stepIndex < steps.length - 1) {
        setCurrentStep(stepIndex + 1)
      } else {
        endTour()
      }
      return
    }

    const rect = element.getBoundingClientRect()
    const padding = 12

    setHighlightStyle({
      position: 'fixed',
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      borderRadius: '12px',
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
      pointerEvents: 'none',
      zIndex: 10001,
      transition: 'all 0.4s ease'
    })

    const tooltipWidth = Math.min(380, window.innerWidth - 40)
    const position = step.position || 'bottom'

    let top = 0
    let left = 0
    let arrowTop = ''
    let arrowLeft = ''
    let arrowBorder = {}

    switch (position) {
      case 'bottom':
        top = rect.bottom + padding + 16
        left = Math.max(20, Math.min(
          rect.left + rect.width / 2 - tooltipWidth / 2,
          window.innerWidth - tooltipWidth - 20
        ))
        arrowTop = '-8px'
        arrowLeft = `${Math.min(Math.max(rect.left + rect.width / 2 - left, 20), tooltipWidth - 20)}px`
        arrowBorder = {
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '8px solid white'
        }
        break
      case 'top':
        top = rect.top - padding - 16 - 200
        left = Math.max(20, Math.min(
          rect.left + rect.width / 2 - tooltipWidth / 2,
          window.innerWidth - tooltipWidth - 20
        ))
        arrowTop = 'auto'
        arrowLeft = `${Math.min(Math.max(rect.left + rect.width / 2 - left, 20), tooltipWidth - 20)}px`
        arrowBorder = {
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid white',
          bottom: '-8px'
        }
        break
    }

    setTooltipStyle({
      position: 'fixed',
      top,
      left,
      width: tooltipWidth,
      zIndex: 10002,
      transition: 'all 0.4s ease'
    })

    setArrowStyle({
      position: 'absolute' as const,
      top: arrowTop,
      left: arrowLeft,
      width: 0,
      height: 0,
      ...arrowBorder
    })
  }, [steps, endTour])

  useEffect(() => {
    if (!isActive) return

    const step = steps[currentStep]
    if (!step) return

    const element = document.querySelector(step.target)
    if (!element) return

    element.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const timer = setTimeout(() => {
      positionTooltip(currentStep)
    }, 400)

    return () => clearTimeout(timer)
  }, [isActive, currentStep, steps, positionTooltip])

  useEffect(() => {
    if (!isActive) return

    const handleUpdate = () => positionTooltip(currentStep)
    window.addEventListener('resize', handleUpdate)
    window.addEventListener('scroll', handleUpdate, true)
    return () => {
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
    }
  }, [isActive, currentStep, positionTooltip])

  const startTour = () => {
    setShowStartModal(false)
    setCurrentStep(0)
    setIsActive(true)
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      endTour()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipTour = () => {
    setShowStartModal(false)
    const tourKey = isApproved ? 'riusc-tour-approved' : 'riusc-tour-new'
    localStorage.setItem(tourKey, 'true')
    if (onTourEnd) onTourEnd()
  }

  if (showStartModal) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '28px 24px',
          maxWidth: '360px',
          width: '85%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#f0f4f8',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '28px'
          }}>
            👋
          </div>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 12px 0', fontSize: '22px', fontWeight: '700' }}>
            {isApproved ? 'Découvrez votre portail !' : 'Bienvenue dans la RIUSC !'}
          </h3>
          <p style={{ color: '#6b7280', margin: '0 0 28px 0', fontSize: '15px', lineHeight: '1.6' }}>
            {isApproved
              ? 'Laissez-nous vous faire un tour rapide de votre espace réserviste.'
              : 'On vous guide en quelques étapes pour bien démarrer votre parcours de réserviste.'
            }
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={skipTour} style={{ padding: '12px 24px', backgroundColor: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>
              Plus tard
            </button>
            <button onClick={startTour} style={{ padding: '12px 24px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' }}>
              C&apos;est parti !
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isActive) return null

  const step = steps[currentStep]

  return (
    <>
      <div onClick={endTour} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }} />
      <div style={highlightStyle} />
      <div style={tooltipStyle}>
        <div style={{ position: 'relative' }}>
          <div style={arrowStyle} />
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ height: '4px', backgroundColor: '#e5e7eb', width: '100%' }}>
              <div style={{ height: '100%', backgroundColor: '#1e3a5f', width: `${((currentStep + 1) / steps.length) * 100}%`, transition: 'width 0.3s ease', borderRadius: '2px' }} />
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', fontWeight: '500' }}>
                Étape {currentStep + 1} de {steps.length}
              </div>
              <h4 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '17px', fontWeight: '700' }}>
                {step.title}
              </h4>
              <p style={{ color: '#4b5563', margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.6' }}>
                {step.content}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={endTour} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#9ca3af', border: 'none', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                  Passer le guide
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {currentStep > 0 && (
                    <button onClick={prevStep} style={{ padding: '8px 16px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                      ← Précédent
                    </button>
                  )}
                  <button onClick={nextStep} style={{ padding: '8px 16px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
                    {currentStep === steps.length - 1 ? 'Terminer ✓' : 'Suivant →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
