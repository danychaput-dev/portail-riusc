import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock Next.js headers (pour les API routes)
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Map(),
}))

// Mock Supabase client
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

// Mock Supabase server
vi.mock('@/utils/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}))

// Supabase mock reutilisable
export const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  insert: vi.fn(() => mockSupabaseClient),
  update: vi.fn(() => mockSupabaseClient),
  delete: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  neq: vi.fn(() => mockSupabaseClient),
  in: vi.fn(() => mockSupabaseClient),
  not: vi.fn(() => mockSupabaseClient),
  is: vi.fn(() => mockSupabaseClient),
  ilike: vi.fn(() => mockSupabaseClient),
  or: vi.fn(() => mockSupabaseClient),
  gte: vi.fn(() => mockSupabaseClient),
  lte: vi.fn(() => mockSupabaseClient),
  order: vi.fn(() => mockSupabaseClient),
  range: vi.fn(() => mockSupabaseClient),
  limit: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  then: undefined, // Empeche la resolution automatique de Promise
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: { path: 'test.pdf' }, error: null })),
      remove: vi.fn(() => Promise.resolve({ error: null })),
      createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'https://test.url' }, error: null })),
    })),
  },
}

// Reset tous les mocks entre les tests
beforeEach(() => {
  vi.clearAllMocks()
})
