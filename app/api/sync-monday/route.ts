import { NextRequest, NextResponse } from 'next/server'

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN
const BOARD_ID = '8252978837'

// Mapping des champs Supabase vers les colonnes Monday
const COLUMN_MAPPING: Record<string, string> = {
  prenom: 'pr_nom_mkm8sqmy',
  nom: 'nom_de_famille_mkm84fst',
  email: 'e_mail_mkmch8yp',
  date_naissance: 'date_mkm95g0m',
  telephone: 'phone_mkm97s6e',
  telephone_secondaire: '__t_l_phone_secondaire_mkm8c602',
  contact_urgence_telephone: 't_l_phone_urgence_mkm8mbd0',
  contact_urgence_nom: 'contact_d_urgence_mkm85qxk',
  adresse: 'location_mkm8w8vx',
  ville: 'text_mkvvz29k',
  region: 'dropdown_mkvtqzs3'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { benevole_id, ...fields } = body

    if (!benevole_id) {
      return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
    }

    if (!MONDAY_API_TOKEN) {
      console.error('MONDAY_API_TOKEN non configuré')
      return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
    }

    // Construire l'objet column_values pour Monday
    const columnValues: Record<string, any> = {}

    for (const [field, value] of Object.entries(fields)) {
      const columnId = COLUMN_MAPPING[field]
      if (!columnId || value === undefined || value === null || value === '') continue

      switch (field) {
        case 'email':
          columnValues[columnId] = { email: value, text: value }
          break
        case 'telephone':
        case 'telephone_secondaire':
        case 'contact_urgence_telephone':
          // Format téléphone pour Monday
          if (value) {
            const phoneDigits = String(value).replace(/\D/g, '')
            columnValues[columnId] = { phone: phoneDigits, countryShortName: 'CA' }
          }
          break
        case 'date_naissance':
          // Format date pour Monday (YYYY-MM-DD)
          if (value) {
            columnValues[columnId] = { date: value }
          }
          break
        case 'adresse':
          // Format location pour Monday
          if (value) {
            columnValues[columnId] = { address: value }
          }
          break
        case 'region':
          // Dropdown - Monday attend les labels
          if (value) {
            columnValues[columnId] = { labels: [value] }
          }
          break
        default:
          // Champs texte simples
          columnValues[columnId] = String(value)
      }
    }

    // Mutation GraphQL pour Monday
    const mutation = `
      mutation {
        change_multiple_column_values(
          board_id: ${BOARD_ID},
          item_id: ${benevole_id},
          column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) {
          id
        }
      }
    `

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_TOKEN
      },
      body: JSON.stringify({ query: mutation })
    })

    const result = await response.json()

    if (result.errors) {
      console.error('Monday API errors:', result.errors)
      return NextResponse.json({ error: 'Erreur Monday API', details: result.errors }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result.data })

  } catch (error) {
    console.error('Erreur sync Monday:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
