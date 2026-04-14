import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }})
const { data, error } = await sb.from('formations_benevoles').select('*').not('monday_item_id', 'is', null).limit(2)
console.log('sample:', JSON.stringify(data || error, null, 2))
