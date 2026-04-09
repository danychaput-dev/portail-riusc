const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  'https://jtzwkmcfarxptpcoaxxl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4'
)
async function main() {
  const noms = ['Gaudron','Theriault','Savard','Canciani','Jolicoeur','Clicques','Eddingfield','Kimball','Brousseau','Sanfacon','Drouin','Laporte','Bonet','Djemel','Mireault','Dubois','Paris','Mian','Wuong','Cormier','Huot','Renetane']
  for (const n of noms) {
    const { data } = await supabase.from('reservistes').select('prenom, nom, email, groupe, statut').ilike('nom', `%${n}%`).limit(3)
    if (data && data.length > 0) {
      console.log(`${n}: ${data.map(r => `${r.prenom} ${r.nom} <${r.email}> [${r.groupe}/${r.statut}]`).join(', ')}`)
    } else {
      console.log(`${n}: AUCUN RESULTAT`)
    }
  }
}
main()
