import { NextRequest, NextResponse } from 'next/server'
import { n8nUrl } from '@/utils/n8n'
import { requireAuth, isAuthError } from '@/utils/auth-api'

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const { searchParams } = new URL(request.url)
  const benevoleId = searchParams.get('benevole_id')

  if (!benevoleId) {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }

  // Un reserviste ne peut annuler que sa propre inscription
  if (auth.role === 'reserviste' && auth.benevole_id !== benevoleId) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
  }

  try {
    const response = await fetch(
      n8nUrl(`/webhook/camp-status?benevole_id=${benevoleId}&action=cancel`),
      { method: 'POST' }
    )

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erreur appel n8n:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
