import { NextRequest, NextResponse } from 'next/server'

const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_BASE_URL || 'https://n8n.aqbrs.ca'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Ajouter la cle service_role au body avant d'envoyer a n8n
    const n8nBody = {
      ...body,
      supabase_service_key: SUPABASE_SERVICE_ROLE_KEY
    }

    const response = await fetch(`${N8N_BASE_URL}/webhook/riusc-inscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nBody)
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.ok ? 200 : 500 })
  } catch (error: any) {
    console.error('Erreur proxy inscription:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
