import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const ADMIN_BENEVOLE_IDS = ['8738174928', '18239132668'] // Dany + Esther peuvent emprunter

export async function POST() {
  try {
    // Vérifier que c'est un admin qui fait la demande
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: currentReserviste } = await supabase
        .from('reservistes')
        .select('benevole_id')
        .eq('user_id', user.id)
        .single()

      if (!currentReserviste || !ADMIN_BENEVOLE_IDS.includes(currentReserviste.benevole_id)) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }
    
    const cookieStore = await cookies()
    cookieStore.delete('impersonate')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur arrêt emprunt:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
