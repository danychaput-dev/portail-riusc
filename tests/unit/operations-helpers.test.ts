// tests/unit/operations-helpers.test.ts
//
// Tests unitaires des helpers du wizard Operations.
// En particulier tplNotif() après refonte 2026-04-25 (issue #16).
//
// Ce qu'on couvre :
//  1. Cas plage continue ouverte (dateDebut seul, dateFin NULL)
//  2. Cas plage continue fermée (dateDebut + dateFin distincts)
//  3. Cas jours individuels (mode_dates + joursProposes)
//  4. Présence du lieu (avec pin 📍)
//  5. Branding AQBRS vs RIUSC (signature)
//  6. Compatibilité ascendante (signature legacy avec string)
//  7. Absence de mentions à éviter (« sinistre », « SOPFEU », « Croix-Rouge »)
//  8. "plages" au pluriel (pas "disponibilité" singulier)
//
// Lance avec : npm test -- tests/unit/operations-helpers.test.ts

import { describe, it, expect } from 'vitest'
import { tplNotif, dateFr } from '@/app/admin/operations/helpers'

// Date d'envoi figée pour rendre les tests déterministes
// 2026-04-25 14:00 EDT (UTC-4) → 18:00 UTC
const DATE_ENVOI_FIXE = new Date('2026-04-25T18:00:00Z')

describe('dateFr', () => {
  it('formate ISO YYYY-MM-DD en DD/MM/YYYY', () => {
    expect(dateFr('2026-04-28')).toBe('28/04/2026')
  })

  it('retourne chaîne vide pour input vide ou null', () => {
    expect(dateFr('')).toBe('')
    expect(dateFr(null)).toBe('')
    expect(dateFr(undefined)).toBe('')
  })
})

describe('tplNotif - structure et contenu', () => {
  it('cas 1: plage ouverte (dateDebut seul, dateFin null)', () => {
    const out = tplNotif({
      sinNom: '[EXERCICE] Inondation Chicoutimi',
      depNom: '[EXERCICE] Soutien op. terrain - Inondation Chicoutimi',
      dateDebut: '2026-04-28',
      lieu: 'Boul. Saguenay Ouest, secteur Bassin',
      branding: 'AQBRS',
      heuresLimite: 8,
      modeDates: 'plage_continue',
      dateEnvoi: DATE_ENVOI_FIXE,
    })

    expect(out).toContain('Vous êtes sollicité(e) pour un déploiement')
    expect(out).toContain('[EXERCICE] Soutien op. terrain - Inondation Chicoutimi')
    expect(out).toContain('📍 Boul. Saguenay Ouest, secteur Bassin')
    expect(out).toContain('À partir du 28/04/2026')
    // PAS de "du X au Y" pour plage ouverte
    expect(out).not.toMatch(/Du \d+\/\d+\/\d+ au \d+\/\d+\/\d+/)
  })

  it('cas 2: plage fermée (dateDebut + dateFin)', () => {
    const out = tplNotif({
      sinNom: 'Sinistre X',
      depNom: 'Déploiement court SPF',
      dateDebut: '2026-04-28',
      dateFin: '2026-04-30',
      branding: 'RIUSC',
      heuresLimite: 8,
      modeDates: 'plage_continue',
      dateEnvoi: DATE_ENVOI_FIXE,
    })

    expect(out).toContain('Du 28/04/2026 au 30/04/2026')
    // PAS de "À partir du" pour plage fermée
    expect(out).not.toContain('À partir du')
  })

  it('cas 3: jours individuels avec joursProposes', () => {
    const out = tplNotif({
      sinNom: 'Camp test',
      depNom: 'Camp Cohorte 9',
      dateDebut: '2026-04-26',
      modeDates: 'jours_individuels',
      joursProposes: ['2026-04-26', '2026-04-27'],
      branding: 'AQBRS',
      heuresLimite: 8,
      dateEnvoi: DATE_ENVOI_FIXE,
    })

    expect(out).toContain('Jours proposés : 26/04/2026, 27/04/2026')
    // PAS de "À partir du" ni "Du X au Y" en mode jours individuels
    expect(out).not.toContain('À partir du')
    expect(out).not.toMatch(/Du \d+\/\d+\/\d+ au/)
  })

  it('cas 4: lieu absent — pas de ligne 📍', () => {
    const out = tplNotif({
      sinNom: 'X',
      depNom: 'Dep sans lieu',
      dateDebut: '2026-04-28',
      branding: 'AQBRS',
      dateEnvoi: DATE_ENVOI_FIXE,
    })

    expect(out).not.toContain('📍')
  })
})

describe('tplNotif - branding', () => {
  it('AQBRS : signature "L\'équipe AQBRS"', () => {
    const out = tplNotif({
      sinNom: 'X', depNom: 'Y',
      branding: 'AQBRS',
      dateEnvoi: DATE_ENVOI_FIXE,
    })
    expect(out).toContain("L'équipe AQBRS")
    expect(out).not.toContain("L'équipe RIUSC")
  })

  it('RIUSC : signature "L\'équipe RIUSC"', () => {
    const out = tplNotif({
      sinNom: 'X', depNom: 'Y',
      branding: 'RIUSC',
      dateEnvoi: DATE_ENVOI_FIXE,
    })
    expect(out).toContain("L'équipe RIUSC")
    expect(out).not.toContain("L'équipe AQBRS")
  })

  it('branding par défaut = RIUSC', () => {
    const out = tplNotif({
      sinNom: 'X', depNom: 'Y',
      dateEnvoi: DATE_ENVOI_FIXE,
    })
    expect(out).toContain("L'équipe RIUSC")
  })
})

describe('tplNotif - compat ascendante', () => {
  it('signature legacy avec string fonctionne encore', () => {
    const out = tplNotif('Sinistre Legacy', 'Dep Legacy', '2026-04-28')
    expect(out).toContain('Dep Legacy')
    expect(out).toContain('À partir du 28/04/2026')
  })
})

describe('tplNotif - règles éditoriales (anti-régression)', () => {
  const sample = tplNotif({
    sinNom: 'Inondation Chicoutimi',
    depNom: '[EXERCICE] Soutien op. terrain - Inondation Chicoutimi',
    dateDebut: '2026-04-28',
    lieu: 'Boul. Saguenay Ouest',
    branding: 'AQBRS',
    heuresLimite: 8,
    dateEnvoi: DATE_ENVOI_FIXE,
  })

  it('aucune mention SOPFEU dans le template', () => {
    expect(sample).not.toMatch(/SOPFEU/i)
  })

  it('aucune mention Croix-Rouge dans le template', () => {
    expect(sample).not.toMatch(/Croix-Rouge/i)
  })

  it('aucune mention "sinistre" lourde au début (le mot peut être dans depNom mais pas en intro)', () => {
    // Le mot "sinistre" peut apparaître si le depNom le contient (cas légitime).
    // Mais l'INTRO ne doit plus dire "Dans le cadre du sinistre « ... »"
    expect(sample).not.toMatch(/Dans le cadre du sinistre/)
  })

  it('utilise "plages de disponibilités" au pluriel', () => {
    expect(sample).toContain('plages de disponibilités')
  })

  it('ne dit pas "déploiement [nom]" (redondance avec préfixe Déploiement)', () => {
    // Pas du genre "le déploiement Déploiement X"
    expect(sample).not.toMatch(/le déploiement \[?[Dd]éploiement/)
  })

  it('contient le lien vers le portail', () => {
    expect(sample).toContain('portail.riusc.ca/disponibilites')
  })

  it('contient une date limite formatée', () => {
    // Avec heuresLimite=8 et envoi 14h00 EDT, limite = 22h00 même jour
    expect(sample).toMatch(/avant \d{2}h\d{2}/)
  })
})
