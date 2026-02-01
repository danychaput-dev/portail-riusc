import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const benevoleId = searchParams.get('benevole_id')

  if (!benevoleId) {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${benevoleId}&action=cancel`,
      { method: 'POST' }
    )

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erreur appel n8n:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
