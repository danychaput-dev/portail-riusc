// app/api/monday-proxy/route.ts
// Proxy pour afficher les fichiers Monday.com dans un iframe sans X-Frame-Options
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return new NextResponse('URL manquante', { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new NextResponse('URL invalide', { status: 400 })
  }

  if (!parsed.hostname.endsWith('monday.com')) {
    return new NextResponse('Source non autorisée', { status: 403 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.MONDAY_API_KEY}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,image/*,*/*;q=0.9',
        'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://aqbrs.monday.com/',
        'Origin': 'https://aqbrs.monday.com',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
      },
    })

    if (!response.ok) {
      return new NextResponse(`Erreur Monday: ${response.status}`, { status: response.status })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'

    // Rejeter si Monday retourne du HTML (page de login ou erreur)
    if (contentType.includes('text/html')) {
      return new NextResponse('Fichier non accessible', { status: 403 })
    }

    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('monday-proxy error:', err)
    return new NextResponse('Erreur lors du fetch', { status: 500 })
  }
}
