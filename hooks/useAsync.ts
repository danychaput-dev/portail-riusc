'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── useAsync — Remplace les patterns loading/error/data répétitifs ────────
//
// Avant (pattern répété 150+ fois dans le projet) :
//   const [data, setData] = useState(null)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState(null)
//   useEffect(() => {
//     setLoading(true)
//     fetchData().then(setData).catch(setError).finally(() => setLoading(false))
//   }, [])
//
// Après :
//   const { data, loading, error, retry } = useAsync(fetchData, [])

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

interface UseAsyncReturn<T> extends AsyncState<T> {
  /** Relancer la requête manuellement */
  retry: () => void
  /** Mettre à jour les données manuellement (optimistic update) */
  setData: (data: T | null) => void
}

/**
 * Hook générique pour gérer les appels asynchrones.
 *
 * @param fn - Fonction async qui retourne les données
 * @param deps - Dépendances (relance quand elles changent)
 * @param options.immediate - Lancer immédiatement (défaut: true)
 *
 * @example
 * const { data: reservistes, loading } = useAsync(
 *   () => supabase.from('reservistes').select('*').then(r => r.data),
 *   []
 * )
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList = [],
  options?: { immediate?: boolean }
): UseAsyncReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: options?.immediate !== false,
    error: null,
  })

  const fnRef = useRef(fn)
  fnRef.current = fn

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const result = await fnRef.current()
      setState({ data: result, loading: false, error: null })
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (options?.immediate !== false) {
      execute()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute])

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }))
  }, [])

  return {
    ...state,
    retry: execute,
    setData,
  }
}

// ─── useAction — Pour les mutations (POST, UPDATE, DELETE) ──────────────────
//
// Avant :
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState(null)
//   const handleSubmit = async () => {
//     setLoading(true)
//     try { await save() } catch(e) { setError(e) } finally { setLoading(false) }
//   }
//
// Après :
//   const { execute: handleSubmit, loading, error } = useAction(save)

interface UseActionReturn<T, Args extends unknown[]> {
  execute: (...args: Args) => Promise<T | null>
  loading: boolean
  error: Error | null
  reset: () => void
}

/**
 * Hook pour les actions / mutations avec état de chargement.
 *
 * @param fn - Fonction async à exécuter
 *
 * @example
 * const { execute: save, loading } = useAction(
 *   async (data) => {
 *     await supabase.from('reservistes').update(data).eq('id', id)
 *   }
 * )
 */
export function useAction<T, Args extends unknown[] = []>(
  fn: (...args: Args) => Promise<T>
): UseActionReturn<T, Args> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async (...args: Args): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn(...args)
      return result
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e)
      return null
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setLoading(false)
  }, [])

  return { execute, loading, error, reset }
}
