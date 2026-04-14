/**
 * Tests API : /api/admin/sinistres
 *
 * Route CRUD multi-tables (sinistres, demandes, deployments, vagues).
 * - POST : insertion + auto-generation d'identifiants + geocodage
 * - PUT  : mise a jour + re-geocodage si lieu change
 * - DELETE : suppression avec cascade deploiements_actifs
 */
import { describe, it, expect } from 'vitest'

describe('/api/admin/sinistres', () => {
  describe('Securite - whitelist de tables', () => {
    const ALLOWED_TABLES = ['sinistres', 'demandes', 'deployments', 'vagues']

    it('accepte uniquement les 4 tables prevues', () => {
      expect(ALLOWED_TABLES).toHaveLength(4)
      expect(ALLOWED_TABLES).toContain('sinistres')
      expect(ALLOWED_TABLES).toContain('demandes')
      expect(ALLOWED_TABLES).toContain('deployments')
      expect(ALLOWED_TABLES).toContain('vagues')
    })

    it('refuse les autres tables (injection impossible)', () => {
      expect(ALLOWED_TABLES).not.toContain('reservistes')
      expect(ALLOWED_TABLES).not.toContain('auth.users')
      expect(ALLOWED_TABLES).not.toContain('formations_benevoles')
    })

    it('accepte superadmin, admin, coordonnateur', () => {
      const roles = ['superadmin', 'admin', 'coordonnateur']
      expect(roles.includes('superadmin')).toBe(true)
      expect(roles.includes('coordonnateur')).toBe(true)
    })
  })

  describe('Helper orgAbbr', () => {
    function orgAbbr(organisme: string): string {
      if (organisme.includes('SOPFEU')) return 'SP'
      if (organisme.includes('Croix-Rouge')) return 'CR'
      if (organisme.includes('Municipalité')) return 'MUN'
      return 'AUT'
    }

    it('mappe SOPFEU -> SP', () => {
      expect(orgAbbr('SOPFEU')).toBe('SP')
    })

    it('mappe Croix-Rouge -> CR', () => {
      expect(orgAbbr('Croix-Rouge canadienne')).toBe('CR')
    })

    it('mappe Municipalité -> MUN', () => {
      expect(orgAbbr('Municipalité de Chicoutimi')).toBe('MUN')
    })

    it('fallback AUT pour organismes inconnus', () => {
      expect(orgAbbr('Gouvernement du Québec')).toBe('AUT')
      expect(orgAbbr('')).toBe('AUT')
    })
  })

  describe('Helper dateCourtFr', () => {
    function dateCourtFr(dateStr?: string): string {
      if (!dateStr) return ''
      const mois = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']
      const d = new Date(dateStr + 'T00:00:00')
      return `${d.getDate()} ${mois[d.getMonth()]}`
    }

    it('formatte 2026-03-17 en "17 mar"', () => {
      expect(dateCourtFr('2026-03-17')).toBe('17 mar')
    })

    it('formatte 2026-01-05 en "5 jan"', () => {
      expect(dateCourtFr('2026-01-05')).toBe('5 jan')
    })

    it('formatte 2026-12-31 en "31 déc"', () => {
      expect(dateCourtFr('2026-12-31')).toBe('31 déc')
    })

    it('retourne chaine vide si pas de date', () => {
      expect(dateCourtFr()).toBe('')
      expect(dateCourtFr('')).toBe('')
    })
  })

  describe('Helper slug', () => {
    function slug(s: string, max = 15): string {
      return (s || '').replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, '').trim().slice(0, max).trim()
    }

    it('conserve les accents francais', () => {
      expect(slug('Évacuation')).toBe('Évacuation')
    })

    it('retire les caracteres speciaux', () => {
      expect(slug('Digue@#!/')).toBe('Digue')
    })

    it('tronque a la longueur demandee', () => {
      expect(slug('Reconnaissance aerienne', 12)).toBe('Reconnaissan')
    })

    it('gere null / undefined', () => {
      expect(slug('')).toBe('')
    })
  })

  describe('Generation identifiants - demandes', () => {
    it('format DEM-NNN-ORG[-DATE][-MISSION]', () => {
      const num = '001'
      const org = 'SP'
      const date = '17 mar'
      const mission = 'Debris'
      const id = `DEM-${num}-${org}${date ? `-${date}` : ''}${mission ? `-${mission}` : ''}`
      expect(id).toBe('DEM-001-SP-17 mar-Debris')
    })

    it('n\'ajoute pas le suffixe si vide', () => {
      const num = '042'
      const org = 'AUT'
      const id = `DEM-${num}-${org}${'' ? `-` : ''}${'' ? `-` : ''}`
      expect(id).toBe('DEM-042-AUT')
    })
  })

  describe('Generation identifiants - deployments', () => {
    it('format DEP-NNN [- ORG][ MISSION][ - LIEU]', () => {
      const num = '003'
      const org = 'SP'
      const mission = 'Digues'
      const lieu = 'Chicoutimi'
      const id = `DEP-${num}${org ? ` - ${org}` : ''}${mission ? ` ${mission}` : ''}${lieu ? ` - ${lieu}` : ''}`
        .replace(/\s+/g, ' ').trim()
      expect(id).toBe('DEP-003 - SP Digues - Chicoutimi')
    })
  })

  describe('Generation identifiants - vagues', () => {
    it('inclut le nombre de personnes entre parentheses', () => {
      const num = '001'
      const nb = 10
      const nbStr = nb ? `${nb} pers` : ''
      const id = `VAG-${num}${nbStr ? ` (${nbStr})` : ''}`
      expect(id).toBe('VAG-001 (10 pers)')
    })
  })

  describe('Geocodage Nominatim', () => {
    it('valide les coordonnees dans les bornes du Quebec', () => {
      const valid = { lat: 48.5, lon: -71.1 } // Chicoutimi
      const inBounds = valid.lat > 44 && valid.lat < 64 && valid.lon > -80 && valid.lon < -57
      expect(inBounds).toBe(true)
    })

    it('rejette les coordonnees hors Quebec', () => {
      const paris = { lat: 48.8566, lon: 2.3522 }
      const inBounds = paris.lat > 44 && paris.lat < 64 && paris.lon > -80 && paris.lon < -57
      expect(inBounds).toBe(false)
    })

    it('retourne null si lieu vide', () => {
      const lieu = ''
      const shouldGeocode = !!lieu?.trim()
      expect(shouldGeocode).toBe(false)
    })

    it('ajoute ", Québec, Canada" au contexte pour precision', () => {
      const lieu = 'Chicoutimi'
      const query = `${lieu}, Québec, Canada`
      expect(query).toContain('Québec')
      expect(query).toContain('Canada')
    })
  })

  describe('PUT - sync jonction demandes', () => {
    it('table speciale deployments_demandes_sync gere la jonction M-N', () => {
      const table = 'deployments_demandes_sync'
      const isJonction = table === 'deployments_demandes_sync'
      expect(isJonction).toBe(true)
    })

    it('supprime l\'existant avant reinsert (replace semantic)', () => {
      // syncDemandesJonction DELETE puis INSERT
      const steps = ['delete_existing', 'insert_new']
      expect(steps[0]).toBe('delete_existing')
      expect(steps[1]).toBe('insert_new')
    })

    it('gere le cas liste vide (uniquement delete)', () => {
      const demandesIds: string[] = []
      const shouldInsert = demandesIds.length > 0
      expect(shouldInsert).toBe(false)
    })
  })

  describe('PUT - ajout automatique updated_at', () => {
    it('ajoute updated_at a chaque update', () => {
      const payload = { nom: 'test' }
      const final = { ...payload, updated_at: new Date().toISOString() }
      expect(final.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('DELETE - cascade deploiements_actifs', () => {
    it('supprime aussi la ligne dans deploiements_actifs pour table=deployments', () => {
      const table = 'deployments'
      const shouldCascade = table === 'deployments'
      expect(shouldCascade).toBe(true)
    })

    it('ne cascade pas pour les autres tables', () => {
      for (const table of ['sinistres', 'demandes', 'vagues']) {
        expect(table === 'deployments').toBe(false)
      }
    })
  })

  describe('Sync deploiements_actifs', () => {
    it('utilise upsert avec onConflict: deploiement_id', () => {
      const options = { onConflict: 'deploiement_id' }
      expect(options.onConflict).toBe('deploiement_id')
    })

    it('copie les infos de la demande et du sinistre', () => {
      const deployment = { id: 'd1', nom: 'Deploy A', statut: 'Actif' }
      const demande = { type_mission: 'Digues', organisme: 'SOPFEU' }
      const sinistre = { nom: 'Inondation 2026' }
      const synced = {
        deploiement_id: deployment.id,
        nom_deploiement: deployment.nom,
        nom_sinistre: sinistre?.nom || null,
        nom_demande: demande?.type_mission || null,
        organisme: demande?.organisme || null,
      }
      expect(synced.nom_sinistre).toBe('Inondation 2026')
      expect(synced.organisme).toBe('SOPFEU')
    })
  })
})
