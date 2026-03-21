import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const lieu = req.nextUrl.searchParams.get('lieu')
  if (!lieu) return NextResponse.json({ error: 'lieu manquant' }, { status: 400 })

  const q = encodeURIComponent(`${lieu}, Québec, Canada`)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      {
        headers: {
          'Accept-Language': 'fr',
          'User-Agent': 'portail.riusc.ca (contact@aqbrs.ca)',
        },
      }
    )
    const data = await res.json()
    if (data?.[0]) {
      return NextResponse.json({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
    }
    return NextResponse.json({ error: 'lieu non trouvé' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'erreur réseau' }, { status: 500 })
  }
}
