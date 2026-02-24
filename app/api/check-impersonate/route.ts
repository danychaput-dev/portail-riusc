import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const impersonateCookie = cookieStore.get('impersonate')

  if (!impersonateCookie) {
    return NextResponse.json({ isImpersonating: false })
  }

  try {
    const impersonateData = JSON.parse(impersonateCookie.value)
    return NextResponse.json({
      isImpersonating: true,
      benevole_id: impersonateData.benevole_id,
      email: impersonateData.email,
      prenom: impersonateData.prenom,
      nom: impersonateData.nom
    })
  } catch (error) {
    return NextResponse.json({ isImpersonating: false })
  }
}
