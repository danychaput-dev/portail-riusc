import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const DANY_BENEVOLE_ID = '8738174928' // Seul Dany peut emprunter

export async function POST(request: Request) {
  try {
    const { benevole_id } = await request.json()

    if (!benevole_id) {
      return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Vérifier que l'utilisateur connecté est Dany
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que c'est bien Dany
    const { data: currentReserviste } = await supabase
      .from('reservistes')
      .select('benevole_id')
      .eq('user_id', user.id)
      .single()

    if (!currentReserviste || currentReserviste.benevole_id !== DANY_BENEVOLE_ID) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // 2. Récupérer les infos du réserviste à emprunter
    const { data: targetReserviste, error } = await supabase
      .from('reservistes')
      .select('benevole_id, prenom, nom, email')
      .eq('benevole_id', benevole_id)
      .single()

    if (error || !targetReserviste) {
      return NextResponse.json({ error: 'Réserviste non trouvé' }, { status: 404 })
    }

    // 3. Créer le cookie d'emprunt (httpOnly pour sécurité)
    const impersonateData = {
      benevole_id: targetReserviste.benevole_id,
      prenom: targetReserviste.prenom,
      nom: targetReserviste.nom,
      email: targetReserviste.email,
      impersonatedBy: DANY_BENEVOLE_ID,
      timestamp: new Date().toISOString()
    }

    const cookieStore = await cookies()
    cookieStore.set('impersonate', JSON.stringify(impersonateData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 heures
      path: '/'
    })

    return NextResponse.json({ 
      success: true,
      reserviste: targetReserviste
    })

  } catch (error) {
    console.error('Erreur emprunt:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
