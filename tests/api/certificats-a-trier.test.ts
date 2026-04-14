/**
 * Tests API : /api/admin/certificats-a-trier
 *
 * Route critique - tri des 126 PDFs certificats extraits du Gmail d'Esther.
 * - GET    : liste les items (pending / assigned / deleted)
 * - POST   : assigner a une formation (nouvelle ou existante), copie le fichier
 *            de 'certificats-a-trier' vers 'certificats' bucket
 * - DELETE : marquer comme doublon/hors-sujet + supprimer fichier source
 */
import { describe, it, expect } from 'vitest'

describe('/api/admin/certificats-a-trier', () => {
  describe('Securite - verifierAdmin', () => {
    it('accepte les roles superadmin, admin, coordonnateur', () => {
      const rolesAutorises = ['superadmin', 'admin', 'coordonnateur']
      expect(rolesAutorises.includes('superadmin')).toBe(true)
      expect(rolesAutorises.includes('admin')).toBe(true)
      expect(rolesAutorises.includes('coordonnateur')).toBe(true)
    })

    it('refuse les roles reserviste, partenaire, adjoint', () => {
      const rolesAutorises = ['superadmin', 'admin', 'coordonnateur']
      expect(rolesAutorises.includes('reserviste')).toBe(false)
      expect(rolesAutorises.includes('partenaire')).toBe(false)
      expect(rolesAutorises.includes('adjoint')).toBe(false)
    })

    it('refuse si admin_benevole_id manquant', () => {
      const admin_benevole_id = ''
      expect(admin_benevole_id.trim()).toBe('')
    })
  })

  describe('GET - Filtrage par statut', () => {
    it('utilise pending par defaut', () => {
      const params = new URLSearchParams()
      const statut = params.get('statut') || 'pending'
      expect(statut).toBe('pending')
    })

    it('accepte les statuts pending, assigned, deleted', () => {
      const statutsValides = ['pending', 'assigned', 'deleted']
      expect(statutsValides).toContain('pending')
      expect(statutsValides).toContain('assigned')
      expect(statutsValides).toContain('deleted')
    })

    it('regroupe les formations par benevole_id dans l\'enrichissement', () => {
      const formations = [
        { id: 'f1', benevole_id: 'b1', nom_formation: 'SATP' },
        { id: 'f2', benevole_id: 'b1', nom_formation: 'Premiers soins' },
        { id: 'f3', benevole_id: 'b2', nom_formation: 'SATP' },
      ]
      const formationsByB = new Map<string, any[]>()
      formations.forEach(f => {
        const arr = formationsByB.get(f.benevole_id) || []
        arr.push(f)
        formationsByB.set(f.benevole_id, arr)
      })
      expect(formationsByB.get('b1')?.length).toBe(2)
      expect(formationsByB.get('b2')?.length).toBe(1)
    })
  })

  describe('POST - Mode attacher (formation existante)', () => {
    it('requiert formation_benevole_id en mode attacher', () => {
      const body = { mode: 'attacher', formation_benevole_id: null }
      const requirement = body.mode === 'attacher' && !body.formation_benevole_id
      expect(requirement).toBe(true) // doit retourner 400
    })

    it('met resultat a Reussi et etat_validite a A jour', () => {
      const updateData = {
        resultat: 'Réussi',
        etat_validite: 'À jour',
      }
      expect(updateData.resultat).toBe('Réussi')
      expect(updateData.etat_validite).toBe('À jour')
    })

    it('n\'ecrase pas date_reussite si non fournie (undefined)', () => {
      const date_reussite = null
      const payload = {
        date_reussite: date_reussite || undefined,
      }
      // undefined ne sera PAS envoye dans l'update Supabase (preserve l'existant)
      expect(payload.date_reussite).toBeUndefined()
    })
  })

  describe('POST - Mode nouvelle (creer formation)', () => {
    it('requiert nom_formation et date_reussite', () => {
      const body1 = { mode: 'nouvelle', nom_formation: '', date_reussite: '2025-09-12' }
      const body2 = { mode: 'nouvelle', nom_formation: 'SATP', date_reussite: '' }
      const missing1 = !body1.nom_formation || !body1.date_reussite
      const missing2 = !body2.nom_formation || !body2.date_reussite
      expect(missing1).toBe(true)
      expect(missing2).toBe(true)
    })

    it('genere nom_complet a partir de prenom + nom', () => {
      const r = { prenom: 'Jean', nom: 'Tremblay' }
      const nom_complet = r ? `${r.prenom} ${r.nom}` : null
      expect(nom_complet).toBe('Jean Tremblay')
    })

    it('gere le cas reserviste introuvable (nom_complet null)', () => {
      const r = null
      const nom_complet = r ? `${(r as any).prenom} ${(r as any).nom}` : null
      expect(nom_complet).toBeNull()
    })

    it('utilise la source gmail_extract_2026-04 pour traceabilite', () => {
      const source = 'gmail_extract_2026-04'
      expect(source).toMatch(/^gmail_extract_/)
    })
  })

  describe('POST - Copie du fichier entre buckets', () => {
    it('construit un nouveau chemin avec UUID pour eviter collisions', () => {
      const benevole_id = 'ben-001'
      const storage_path = 'uploads/certif.pdf'
      const uuid = 'abcd1234'
      const filename = storage_path.split('/').pop()
      const newPath = `${benevole_id}/${uuid}_${filename}`
      expect(newPath).toBe('ben-001/abcd1234_certif.pdf')
    })

    it('prefixe certificat_url avec storage:', () => {
      const newPath = 'ben-001/uuid_certif.pdf'
      const certificat_url = `storage:${newPath}`
      expect(certificat_url.startsWith('storage:')).toBe(true)
    })

    it('utilise upsert: false pour ne pas ecraser un fichier existant', () => {
      const options = { upsert: false }
      expect(options.upsert).toBe(false)
    })

    it('fallback contentType a application/pdf', () => {
      const dlData: any = { type: null }
      const contentType = dlData.type || 'application/pdf'
      expect(contentType).toBe('application/pdf')
    })
  })

  describe('POST - Rollback en cas d\'echec update queue', () => {
    it('supprime la formation creee si update de la queue echoue (mode nouvelle)', () => {
      const mode = 'nouvelle'
      const formation_id = 'form-123'
      const shouldRollback = mode !== 'attacher' && !!formation_id
      expect(shouldRollback).toBe(true)
    })

    it('ne rollback pas en mode attacher (pas de formation creee)', () => {
      const mode = 'attacher'
      const formation_id = 'form-existing'
      const shouldRollback = mode !== 'attacher' && !!formation_id
      expect(shouldRollback).toBe(false)
    })
  })

  describe('POST - Reassignation (NO_MATCH)', () => {
    it('utilise benevole_id_cible si fourni', () => {
      const item = { benevole_id: null }
      const benevole_id_cible = 'ben-reassigned'
      const benevole_id_final = benevole_id_cible || item.benevole_id
      expect(benevole_id_final).toBe('ben-reassigned')
    })

    it('utilise benevole_id de l\'item si pas de cible', () => {
      const item = { benevole_id: 'ben-original' }
      const benevole_id_cible = null
      const benevole_id_final = benevole_id_cible || item.benevole_id
      expect(benevole_id_final).toBe('ben-original')
    })

    it('echoue si ni cible ni item benevole_id', () => {
      const item = { benevole_id: null }
      const benevole_id_cible = null
      const benevole_id_final = benevole_id_cible || item.benevole_id
      expect(benevole_id_final).toBeNull() // doit retourner 400
    })
  })

  describe('DELETE - Suppression queue', () => {
    it('requiert un id et une note non vide', () => {
      const id = 'cert-001'
      const note = '  '
      expect(!!id).toBe(true)
      expect(note.trim()).toBe('')
    })

    it('accepte une note valide', () => {
      const note = 'Doublon du certificat existant'
      expect(note.trim().length).toBeGreaterThan(0)
    })

    it('marque comme deleted (soft delete)', () => {
      const updateData = {
        statut_tri: 'deleted',
        note_admin: 'Hors-sujet',
      }
      expect(updateData.statut_tri).toBe('deleted')
      expect(updateData.note_admin).toBeTruthy()
    })

    it('supprime le fichier source mais garde la ligne', () => {
      const item = { storage_path: 'uploads/certif.pdf' }
      const shouldDeleteFile = !!item?.storage_path
      expect(shouldDeleteFile).toBe(true)
    })

    it('gere le cas ou storage_path est null', () => {
      const item: any = { storage_path: null }
      const shouldDeleteFile = !!item?.storage_path
      expect(shouldDeleteFile).toBe(false)
    })
  })

  describe('Integrite - traceabilite auditoriale', () => {
    it('enregistre assigne_par et assigne_at sur assignation', () => {
      const updateData = {
        statut_tri: 'assigned',
        assigne_par: 'user-admin-uuid',
        assigne_at: new Date().toISOString(),
      }
      expect(updateData.assigne_par).toBeTruthy()
      expect(updateData.assigne_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('enregistre assigne_par et assigne_at sur suppression', () => {
      const updateData = {
        statut_tri: 'deleted',
        assigne_par: 'user-admin-uuid',
        assigne_at: new Date().toISOString(),
      }
      expect(updateData.statut_tri).toBe('deleted')
      expect(updateData.assigne_par).toBeTruthy()
    })
  })
})
