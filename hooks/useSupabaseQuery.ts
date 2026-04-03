'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

// ─── useSupabaseQuery — Remplace les requêtes Supabase répétitives ──────────
//
// Avant :
//   const [data, setData] = useState([])
//   const [loading, setLoading] = useState(true)
//   useEffect(() => {
//     const supabase = createClient()
//     supabase.from('reservistes').select('*').eq('user_id', userId)
//       .then(({ data }) => setData(data || []))
//       .finally(() => setLoading(false))
//   }, [userId])
//
// Après :
//   const { data, loading } = useSupabaseQuery('reservistes', {
//     select: '*',
//     filters: { user_id: userId },
//   }, [userId])

interface QueryOptions {
  /** Colonnes à sélectionner (défaut: '*') */
  select?: string
  /** Filtres .eq() simples */
  filters?: Record<string, string | number | boolean>
  /** Tri (colonne, ascending) */
  orderBy?: { column: string; ascending?: boolean }
  /** Limite de résultats */
  limit?: number
  /** Ne pas exécuter tout de suite */
  enabled?: boolean
  /** Requête en mode single (retourne un seul objet au lieu d'un array) */
  single?: boolean
}

interface UseSupabaseQueryReturn<T> {
  data: T | null
  loading: boolean
  error: Error | null
  retry: () => void
}

/**
 * Hook pour les requêtes SELECT Supabase.
 *
 * @param table - Nom de la table
 * @param options - Options de requête
 * @param deps - Dépendances supplémentaires
 *
 * @example
 * // Requête simple
 * const { data: langues, loading } = useSupabaseQuery('langues')
 *
 * // Avec filtres
 * const { data: reserviste } = useSupabaseQuery('reservistes', {
 *   filters: { user_id: userId },
 *   single: true,
 * }, [userId])
 *
 * // Avec tri et limite
 * const { data: messages } = useSupabaseQuery('messages', {
 *   orderBy: { column: 'created_at', ascending: false },
 *   limit: 50,
 * })
 */
export function useSupabaseQuery<T = any>(
  table: string,
  options: QueryOptions = {},
  deps: React.DependencyList = []
): UseSupabaseQueryReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(options.enabled !== false)
  const [error, setError] = useState<Error | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const execute = useCallback(async () => {
    const opts = optionsRef.current
    if (opts.enabled === false) return

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      let query = supabase.from(table).select(opts.select || '*')

      // Appliquer les filtres
      if (opts.filters) {
        for (const [key, value] of Object.entries(opts.filters)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value)
          }
        }
      }

      // Tri
      if (opts.orderBy) {
        query = query.order(opts.orderBy.column, {
          ascending: opts.orderBy.ascending ?? true,
        })
      }

      // Limite
      if (opts.limit) {
        query = query.limit(opts.limit)
      }

      // Exécuter (single ou multiple)
      const { data: result, error: queryError } = opts.single
        ? await query.single()
        : await query

      if (queryError) throw new Error(queryError.message)
      setData(result as T)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, ...deps])

  useEffect(() => {
    execute()
  }, [execute])

  return { data, loading, error, retry: execute }
}

// ─── useSignedUrl — Génère une signed URL pour Supabase Storage ─────────────
//
// Pattern répété dans formation.tsx, formulaires.tsx, page.tsx :
//   if (certUrl && certUrl.startsWith('storage:')) {
//     const path = certUrl.replace('storage:', '')
//     const { data: signed } = await supabase.storage.from('certificats').createSignedUrl(path, 3600)
//     certUrl = signed?.signedUrl || null
//   }

/**
 * Résout une URL de certificat (storage: → signed URL, sinon retourne tel quel)
 */
export async function resolveStorageUrl(
  rawUrl: string | null | undefined,
  bucket: string = 'certificats',
  expiresIn: number = 3600
): Promise<string | null> {
  if (!rawUrl) return null
  if (!rawUrl.startsWith('storage:')) return rawUrl

  const supabase = createClient()
  const path = rawUrl.replace('storage:', '')
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  return data?.signedUrl || null
}

/**
 * Résout les signed URLs pour un array d'enregistrements avec un champ URL.
 *
 * @example
 * const formations = await resolveStorageUrls(rawFormations, 'certificat_url')
 */
export async function resolveStorageUrls<T extends Record<string, any>>(
  records: T[],
  urlField: keyof T,
  bucket: string = 'certificats'
): Promise<T[]> {
  return Promise.all(
    records.map(async (record) => {
      const resolved = await resolveStorageUrl(record[urlField] as string, bucket)
      return { ...record, [urlField]: resolved }
    })
  )
}
