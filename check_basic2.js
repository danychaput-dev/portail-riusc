const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  'https://jtzwkmcfarxptpcoaxxl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4'
)
async function main() {
  const { data, error, count } = await supabase.from('reservistes').select('prenom, nom, email', { count: 'exact' }).limit(3)
  console.log('error:', error)
  console.log('count:', count)
  console.log('data:', data)
}
main()
