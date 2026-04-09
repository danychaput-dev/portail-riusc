import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Verifier que l'utilisateur est connecte
async function verifierAuth() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  const user = await verifierAuth()
  if (!user) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { texte, objet } = await req.json()
  if (!texte && !objet) {
    return NextResponse.json({ error: 'Aucun texte a corriger' }, { status: 400 })
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configuree' }, { status: 500 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Tu es un correcteur de texte en francais quebecois professionnel. Corrige les fautes d'orthographe, de grammaire et de syntaxe dans le texte suivant. Garde le meme ton, le meme style et la meme longueur. Ne change PAS le sens. Ne reformule PAS les phrases sauf si necessaire pour la grammaire. Garde les variables {{ prenom }} et {{ nom }} telles quelles. Ne JAMAIS utiliser de tiret long (—). Retourne UNIQUEMENT le texte corrige, sans explication ni commentaire.

${objet ? `OBJET DU COURRIEL:\n${objet}\n\n` : ''}CORPS DU COURRIEL:\n${texte}`
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic correction error:', response.status, err)
      return NextResponse.json({ error: `Erreur API Anthropic (${response.status})`, details: err }, { status: 500 })
    }

    const data = await response.json()
    const corrected = data.content?.[0]?.text || ''

    // Separer objet et corps si les deux ont ete envoyes
    let objetCorrige = objet || ''
    let texteCorrige = corrected

    if (objet && corrected.includes('CORPS DU COURRIEL:')) {
      const parts = corrected.split('CORPS DU COURRIEL:')
      objetCorrige = parts[0].replace('OBJET DU COURRIEL:', '').trim()
      texteCorrige = parts[1].trim()
    } else if (objet && corrected.includes('\n\n')) {
      // Fallback: premiere ligne = objet, reste = corps
      const idx = corrected.indexOf('\n\n')
      if (idx > 0 && idx < 200) {
        objetCorrige = corrected.substring(0, idx).trim()
        texteCorrige = corrected.substring(idx + 2).trim()
      }
    }

    return NextResponse.json({ objet: objetCorrige, texte: texteCorrige })
  } catch (err: any) {
    return NextResponse.json({ error: 'Erreur correction', details: err.message }, { status: 500 })
  }
}
