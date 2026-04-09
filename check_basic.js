const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  'https://jtzwkmcfarxptpcoaxxl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4'
)
async function main() {
  // Total reservistes
  const { count } = await supabase.from('reservistes').select('id', { count: 'exact', head: true })
  console.log('Total reservistes:', count)
  
  // Quelques noms au hasard
  const { data: sample } = await supabase.from('reservistes').select('prenom, nom, email').limit(5)
  console.log('Exemples:', sample?.map(r => `${r.prenom} ${r.nom} <${r.email}>`))

  // Chercher Savard - nom commun
  const { data: savards } = await supabase.from('reservistes').select('prenom, nom, email').ilike('nom', '%savard%')
  console.log('Savard:', savards?.length, savards?.map(r => `${r.prenom} ${r.nom}`))
  
  // Chercher Dubois
  const { data: dubois } = await supabase.from('reservistes').select('prenom, nom, email').ilike('nom', '%dubois%')
  console.log('Dubois:', dubois?.length, dubois?.map(r => `${r.prenom} ${r.nom}`))

  // Chercher Drouin
  const { data: drouin } = await supabase.from('reservistes').select('prenom, nom, email').ilike('nom', '%drouin%')
  console.log('Drouin:', drouin?.length, drouin?.map(r => `${r.prenom} ${r.nom}`))
}
main()
