'use client'

import { useEffect, useState } from 'react'
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'

interface GuidedTourProps {
  isApproved: boolean
  hasDeploiements: boolean
  hasCamp: boolean
}

export default function GuidedTour({ isApproved, hasDeploiements, hasCamp }: GuidedTourProps) {
  const [tourStarted, setTourStarted] = useState(false)

  useEffect(() => {
    // Vérifier si le tour a déjà été vu
    const tourDone = localStorage.getItem('riusc-tour-done')
    if (tourDone || tourStarted) return

    // Attendre que le DOM soit prêt
    const timer = setTimeout(() => {
      const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          classes: 'riusc-tour-step',
          scrollTo: { behavior: 'smooth', block: 'center' },
          cancelIcon: { enabled: true },
          modalOverlayOpeningPadding: 8,
          modalOverlayOpeningRadius: 12,
        }
      })

      // Étape 1 - Bienvenue
      tour.addStep({
        id: 'bienvenue',
        title: '👋 Bienvenue sur le portail RIUSC !',
        text: 'Voici un tour rapide pour vous familiariser avec votre espace réserviste. Vous y trouverez tout ce dont vous avez besoin pour gérer votre participation.',
        buttons: [
          { text: 'Passer le tour', action: tour.cancel, classes: 'shepherd-button-secondary' },
          { text: 'Commencer →', action: tour.next }
        ]
      })

      // Étape 2 - Menu utilisateur
      const menuEl = document.querySelector('[data-tour="menu-utilisateur"]')
      if (menuEl) {
        tour.addStep({
          id: 'menu',
          title: '👤 Votre menu',
          text: 'Accédez rapidement à votre profil, vos documents et vos paramètres depuis ce menu.',
          attachTo: { element: '[data-tour="menu-utilisateur"]', on: 'bottom' },
          buttons: [
            { text: '← Retour', action: tour.back, classes: 'shepherd-button-secondary' },
            { text: 'Suivant →', action: tour.next }
          ]
        })
      }

      // Étape 3 - Profil
      const profilEl = document.querySelector('[data-tour="card-profil"]')
      if (profilEl) {
        tour.addStep({
          id: 'profil',
          title: '📝 Mon Profil',
          text: 'Consultez et mettez à jour vos informations personnelles : coordonnées, adresse, contacts d\'urgence. Gardez votre profil à jour pour faciliter les communications.',
          attachTo: { element: '[data-tour="card-profil"]', on: 'bottom' },
          buttons: [
            { text: '← Retour', action: tour.back, classes: 'shepherd-button-secondary' },
            { text: 'Suivant →', action: tour.next }
          ]
        })
      }

      // Étape 4 - Dossier réserviste (si approuvé)
      if (isApproved) {
        const dossierEl = document.querySelector('[data-tour="card-dossier"]')
        if (dossierEl) {
          tour.addStep({
            id: 'dossier',
            title: '📋 Mon dossier réserviste',
            text: 'Votre dossier contient vos compétences, certifications et informations complémentaires. Ces données sont utilisées pour vous assigner aux missions les plus adaptées à votre profil.',
            attachTo: { element: '[data-tour="card-dossier"]', on: 'bottom' },
            buttons: [
              { text: '← Retour', action: tour.back, classes: 'shepherd-button-secondary' },
              { text: 'Suivant →', action: tour.next }
            ]
          })
        }
      }

      // Étape 5 - Déploiements
      const depEl = document.querySelector('[data-tour="section-deploiements"]')
      if (depEl) {
        tour.addStep({
          id: 'deploiements',
          title: '🚨 Sollicitations de déploiement',
          text: hasDeploiements
            ? 'Vous avez des sollicitations actives ! Consultez les détails et soumettez vos disponibilités. Vous recevrez un SMS et un courriel pour chaque nouvelle sollicitation.'
            : 'Lorsqu\'un déploiement nécessitera votre profil, une sollicitation apparaîtra ici avec les détails de la mission. Vous recevrez aussi un SMS et un courriel.',
          attachTo: { element: '[data-tour="section-deploiements"]', on: 'top' },
          buttons: [
            { text: '← Retour', action: tour.back, classes: 'shepherd-button-secondary' },
            { text: 'Suivant →', action: tour.next }
          ]
        })
      }

      // Étape 6 - Camp de qualification
      if (hasCamp) {
        const campEl = document.querySelector('[data-tour="section-camp"]')
        if (campEl) {
          tour.addStep({
            id: 'camp',
            title: '🏕️ Camp de qualification',
            text: 'Inscrivez-vous à un camp de qualification pour devenir réserviste certifié. Les camps sont organisés par région et durent deux jours.',
            attachTo: { element: '[data-tour="section-camp"]', on: 'top' },
            buttons: [
              { text: '← Retour', action: tour.back, classes: 'shepherd-button-secondary' },
              { text: 'Suivant →', action: tour.next }
            ]
          })
        }
      }

      // Étape 7 - Certificats
      const certEl = document.querySelector('[data-tour="section-certificats"]')
      if (certEl) {
        tour.addStep({
          id: 'certificats',
          title: '🎓 Formation et certificats',
          text: 'Déposez vos certificats de formation ici. La formation « S\'initier à la sécurité civile » est obligatoire pour compléter votre inscription.',
          attachTo: { element: '[data-tour="section-certificats"]', on: 'top' },
          buttons: [
            { text: '← Retour', action: tour.back, classes: 'shepherd-button-secondary' },
            { text: 'Terminer ✓', action: tour.next }
          ]
        })
      }

      // Étape finale
      tour.addStep({
        id: 'fin',
        title: '✅ Vous êtes prêt !',
        text: 'N\'hésitez pas à explorer le portail. Pour toute question, contactez-nous à riusc@aqbrs.ca. Vous pouvez relancer ce tour à tout moment depuis le menu.',
        buttons: [
          { text: 'C\'est parti !', action: tour.complete }
        ]
      })

      tour.on('complete', () => {
        localStorage.setItem('riusc-tour-done', 'true')
      })

      tour.on('cancel', () => {
        localStorage.setItem('riusc-tour-done', 'true')
      })

      tour.start()
      setTourStarted(true)
    }, 800)

    return () => clearTimeout(timer)
  }, [isApproved, hasDeploiements, hasCamp, tourStarted])

  return null
}