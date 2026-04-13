'use client'

// Journal des suppressions de reservistes.
// Lecture seule, accessible aux superadmins uniquement.
// Conforme loi 25: donnees minimales, conservees pour tracabilite.

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface Suppression {
  id: string
  benevole_id: string
  prenom: string
  nom: string
  role: string | null
  groupe_au_moment: string | null
  raison: string
  demande_par_reserviste: boolean
  supprime_par_user_id: string | null
  supprime_par_email: string | null
  supprime_le: string
}

export default function HistoriqueSuppressionsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rows, setRows] = useState<Suppression[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: me } = await supabase
        .from('reservistes')
        .select('role')
        .eq('user_id', user.id)
        .single()
      if (!me || me.role !== 'superadmin') {
        setErreur('Acces reserve aux superadmins.')
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('reservistes_suppressions')
        .select('*')
        .order('supprime_le', { ascending: false })
      if (error) {
        setErreur(error.message)
      } else {
        setRows(data || [])
      }
      setLoading(false)
    })()
  }, [])

  const filtre = recherche.trim().toLowerCase()
  const rowsAffichees = filtre
    ? rows.filter(r =>
        `${r.prenom} ${r.nom}`.toLowerCase().includes(filtre) ||
        (r.raison || '').toLowerCase().includes(filtre) ||
        (r.supprime_par_email || '').toLowerCase().includes(filtre)
      )
    : rows

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Journal des suppressions de reservistes
        </h1>
        <button
          onClick={() => router.push('/admin/reservistes')}
          style={{
            padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db',
            backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Retour aux reservistes
        </button>
      </div>

      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
        Liste des comptes reservistes supprimes. Conformement a la loi 25, seules les donnees minimales
        necessaires a la tracabilite sont conservees (nom, role, groupe, raison, auteur, date).
      </p>

      <input
        type="text"
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        placeholder="Rechercher par nom, raison ou auteur..."
        style={{
          width: '100%', maxWidth: '400px', padding: '8px 12px',
          border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px',
          marginBottom: '14px', boxSizing: 'border-box',
        }}
      />

      {loading && <div style={{ color: '#6b7280' }}>Chargement...</div>}
      {erreur && (
        <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
          {erreur}
        </div>
      )}

      {!loading && !erreur && (
        <>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
            {rowsAffichees.length} suppression{rowsAffichees.length > 1 ? 's' : ''}
            {filtre && ` (filtre sur ${rows.length})`}
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Nom</th>
                  <th style={th}>Role</th>
                  <th style={th}>Groupe</th>
                  <th style={th}>Raison</th>
                  <th style={th}>Demande</th>
                  <th style={th}>Supprime par</th>
                </tr>
              </thead>
              <tbody>
                {rowsAffichees.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={td}>
                      {new Date(r.supprime_le).toLocaleString('fr-CA', {
                        dateStyle: 'short', timeStyle: 'short',
                      })}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {r.prenom} {r.nom}
                    </td>
                    <td style={td}>{r.role || '-'}</td>
                    <td style={td}>{r.groupe_au_moment || '-'}</td>
                    <td style={{ ...td, maxWidth: '320px', whiteSpace: 'normal' }}>{r.raison}</td>
                    <td style={td}>
                      {r.demande_par_reserviste ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Oui</span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>Non</span>
                      )}
                    </td>
                    <td style={td}>{r.supprime_par_email || '-'}</td>
                  </tr>
                ))}
                {rowsAffichees.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ ...td, textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                      Aucune suppression enregistree.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 600,
  color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '10px 12px', color: '#1f2937', verticalAlign: 'top',
}
