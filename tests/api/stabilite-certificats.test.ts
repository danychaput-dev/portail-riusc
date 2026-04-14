/**
 * Tests anti-regression : stabilite des donnees certificats
 *
 * Historique douloureux : des certificats ont deja ete perdus par des
 * suppressions accidentelles. Ces tests empechent qu'un futur changement
 * reintroduise un DELETE physique ou un storage.remove() sur un certificat.
 *
 * Ils valident par analyse statique du code. C'est volontaire : on veut
 * une barriere qui detecte TOUT changement regression, pas un mock qui
 * teste un comportement specifique.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8')
}

describe('Stabilite certificats - protections anti-perte', () => {
  describe('profil/page.tsx - suppression via uncheck compétence', () => {
    const profil = read('app/profil/page.tsx')

    it('utilise RPC formations_soft_delete (pas DELETE physique)', () => {
      expect(profil).toContain("rpc('formations_soft_delete'")
    })

    it("n'appelle plus formations_benevoles.delete() dans la branche removedFormations", () => {
      // Recherche le bloc pendingSave -> ne doit pas contenir .from('formations_benevoles').delete()
      const match = profil.match(/pendingSave: async[\s\S]*?setSaveMessage/)
      expect(match).toBeTruthy()
      expect(match?.[0]).not.toMatch(/from\(['"]formations_benevoles['"]\)\.delete\(\)/)
    })

    it("filtre deleted_at dans les exists-checks avant re-insertion", () => {
      // Si un user decoche puis recoche, on doit detecter la ligne existante soft-deleted
      // et ne pas re-inserer une nouvelle ligne (sinon doublons).
      const existsChecks = profil.match(/from\(['"]formations_benevoles['"]\)\.select\(['"]id['"]\)[^;]+maybeSingle\(\)/g) || []
      expect(existsChecks.length).toBeGreaterThan(0)
      for (const check of existsChecks) {
        expect(check).toMatch(/is\(['"]deleted_at['"],\s*null\)/)
      }
    })
  })

  describe('api/certificat/supprimer - suppression URL par reserviste', () => {
    const route = read('app/api/certificat/supprimer/route.ts')

    it("NE supprime PAS le fichier du Storage (protection anti-perte)", () => {
      // storage.from('certificats').remove() supprimerait irreversiblement le PDF
      expect(route).not.toMatch(/storage\.from\(['"]certificats['"]\)\.remove\(/)
    })

    it('archive certificat_url dans certificat_url_archive avant null', () => {
      expect(route).toContain('certificat_url_archive')
    })

    it('met certificat_url a null (dissocie sans perdre le fichier)', () => {
      expect(route).toContain('certificat_url: null')
    })
  })

  describe('SQL - infrastructure soft-delete + audit', () => {
    it('soft-delete-formations.sql existe et cree la vue active', () => {
      const sql = read('sql/soft-delete-formations.sql')
      expect(sql).toContain('formations_benevoles_actives')
      expect(sql).toContain('formations_soft_delete')
      expect(sql).toContain('formations_restore')
    })

    it('audit-attach-formations.sql attache audit sur les 5 tables critiques', () => {
      const sql = read('sql/audit-attach-formations.sql')
      expect(sql).toContain("audit_attach_table('formations_benevoles'")
      expect(sql).toContain("audit_attach_table('reserviste_organisations'")
      expect(sql).toContain("audit_attach_table('reserviste_langues'")
      expect(sql).toContain("audit_attach_table('reserviste_etat'")
      expect(sql).toContain("audit_attach_table('dossier_reserviste'")
    })

    it('formations_soft_delete exige une raison non-vide', () => {
      const sql = read('sql/soft-delete-formations.sql')
      expect(sql).toMatch(/Raison obligatoire/)
    })
  })
})
