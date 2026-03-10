const API_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ2NDY3NDUzNSwiYWFpIjoxMSwidWlkIjo3MDg2NTA0MywiaWFkIjoiMjAyNS0wMS0yOVQwMTo0NTozMi4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6Mjc0NTk4NTAsInJnbiI6InVzZTEifQ.U0ufF892D9vLZWIBlmSsVpVX_IwkTFSnlDAuyvMWn9U"; // Remplacez par votre token Monday.com
const BOARD_ID = 8252978837;
const COLUMN_ID = "date_mm1a9qdh";
const DATE_VALUE = "2026-02-18";

const EMAILS = [
  "alary.patrick@gmail.com","kinghck0@gmail.com","farsenault@videotron.ca","sami-bs@hotmail.com",
  "rosalind.bc@gmail.com","mbrse@icloud.com","richarebeaulieu@gmail.com","jbedard06@hotmail.com",
  "alexbelanger78@gmail.com","francis.bellegarde@infc.gc.ca","karoline.bergeron@gmail.com",
  "yoannbernet@gmail.com","bernierhelene@gmail.com","monday.overprice550@passinbox.com",
  "alanbesco@hotmail.com","mmechocolat@hotmail.com","genevieve-bisson@hotmail.com",
  "rubybissonnette@gmail.com","maita.blais@recherchesauvetage.ca","jacoboily@icloud.com",
  "sboisjoly@videotron.ca","saraboissonnault@hotmail.com","sebastien.bolduc@rsestrie.org",
  "vct.bonet@gmail.com","lysanne_b@hotmail.com","marypoppins1960@hotmail.com","Briss7959@gmail.com",
  "renetane@hotmail.com","brousseau.marieve@gmail.com","stephbrunet@icloud.com","sabureau@hotmail.com",
  "jf_canciani@hotmail.com","gwennyth.carroll@yahoo.ca","mcauchon@videotron.ca",
  "chabotguillaume@hotmail.com","miguelchalifoux.b@protonmail.com","chapdelainejason@hotmail.com",
  "chaptinimelissa@gmail.com","dany.chaput@aqbrs.ca","fchaput303@gmail.com","rongalf.3786@gmail.com",
  "daniellecha12@hotmail.com","martinchicoine1@outlook.com","chouine35@gmail.com",
  "cath.chouli@gmail.com","Claveaujean22@gmail.com","vendelin.clicques@outlook.com",
  "serge.coiteux@icloud.com","a.coquard@gmail.com","jeanmichel.coquillon@yahoo.ca",
  "mcormier1@bell.net","carole.corson@hotmail.com","tomcortado@outlook.fr","cotese04@cgocable.ca",
  "cote.marcel@hotmail.com","jackc623@hotmail.com","ypcote@me.com","super.louis@hotmail.com",
  "joey.courcelles@gmail.com","Hubert.Couture.rivard@gmail.com","fcarmo@gmail.com",
  "mcdaoust44@gmail.com","demers_frederick@hotmail.com",
  "stephaniedrechercheetsauvetage@gmail.com","desrivieres96@gmail.com","lesalain2010@hotmail.com",
  "yvesdesjardins23@gmail.com","c.desrosiers14@hotmail.com","entreprisedar@hotmail.com",
  "dion.gabriel100@gmail.com","m.djemel@laval.ca","relu-marius.dobre@msp.gouv.qc.ca",
  "heloise.dostie@gmail.com","jerrydrouin58@gmail.com","pierredubois57@hotmail.com",
  "cduguay19@gmail.com","jacquesdumont10@outlook.fr","jonathandupuis_61@hotmail.fr",
  "francisdurette@hotmail.com","edniescott@gmail.com","jimmy.emond@gmail.com",
  "ethier.marcel@gmail.com","gestionmarioferland@gmail.com","guy.fournier@videotron.ca",
  "pierrogagnon@hotmail.com","yvesgareau05@hotmail.com","formation@sauvetage02.org",
  "pasgau40@gmail.com","girard_andre@hotmail.com","algi62@hotmail.com","chris-girard@live.ca",
  "Sergegiroux69@gmail.com","clemence.godon@outlook.com","daniel-gosselin@hotmail.com",
  "manon.goudreau@hotmail.com","jacques.goulet66@outlook.com","sonialemire1@gmail.com",
  "b-ver@hotmail.com","Jacques.grondin@hotmail.ca","christophe.gleclerc@hotmail.com",
  "helenehamel8@sympatico.ca","Nat.hamel1970@gmail.com","heond@hotmail.com",
  "camilleheroux@outlook.com","jeanhuotjh@gmail.com","paulinjacques123@gmail.com",
  "cjolimax@hotmail.ca","oligym.jolicoeur@gmail.com","chloee.l.joly@gmail.com",
  "s.julien00@gmail.com","kalonjimarcesamuel@gmail.com","canard-caza@live.ca",
  "jeanlou.lapins@videotron.ca","josslabelle@hotmail.com","dlabranche@cooptel.qc.ca",
  "valerie_lacroix_@outlook.com","annie.lacroix@hotmail.com","rosedvents@hotmail.com",
  "guy.lapointe@aqbrs.ca","estlapointe@gmail.com","mlaporte@promutech.ca",
  "chafic.laro@gmail.com","ericlaviolette29@gmail.com","raynald.leclerc.siucq@gmail.com",
  "jeanlefebvre1@hotmail.ca","zach.lefebvre@live.fr","fred.leroux@hotmail.com",
  "vlessardca@Gmail.com","ric_levesque@hotmail.com","daniellortie3@gmail.com",
  "guillaume.r.louis@outlook.com","mccindy20@hotmail.com","mariannetremblay0@gmail.com",
  "fab.marier@gmail.com","Claudemarois4@gmail.com","d.martel@siucq.net",
  "danielmartin1@telus.net","Jeremie.martin.1@outlook.com","gmercier1963@gmail.com",
  "luc.mercier@hotmail.com","cmercure@uqac.ca","mian_r@hotmail.com","v.migabo@laval.ca",
  "felixmilot@hotmail.com","christianmireault@hotmail.ca","mongerf@videotron.ca",
  "lalisa33@yahoo.com","kevinmorin916@hotmail.com","celine.ouattara@gmail.com",
  "ouelletted03@gmail.com","cpageau61@gmail.com","parisjeanguy@gmail.com",
  "hugopel12345@hotmail.com","denis.perrier507@gmail.com","guillaumemarier@icloud.com",
  "vanessa.thomasp@gmail.com","juju99picotin@gmail.com","re.key@hotmail.com",
  "l450pr@gmail.com","lprevost87@gmail.com","jprov027@uottawa.ca","martpru72@hotmail.com",
  "jonathan.raymond@hotmail.com","beatrix.reid@gmail.com","margaretreid@bell.net",
  "preuter@live.ca","elisa.rietzschel@gmail.com","riouxkeven12@hotmail.com",
  "mariellerivard@gmail.com","catherinebw1997@outlook.com","irobert@sbo-ovsar.ca",
  "carlrodrigue29@hotmail.ca","alexis209@hotmail.com","roualain.michaud@gmail.com",
  "reneroy11@telus.net","martroy@live.ca","renaudesamson@hotmail.com",
  "savard_pascal@hotmail.com","d.schonne@gmail.com","pseguin@sbo-ovsar.ca",
  "s.seguin@me.com","martinsimard999@gmail.com","alexandra-tm@hotmail.com",
  "altess22@outlook.com","securitecrow@gmail.com","tessierd587@gmail.com",
  "jmarc.trenaud@gmail.com","dtheriault14@gmail.com","olithe@gmail.com",
  "therrienpa@gmail.com","tourville.claude@gmail.com","davidos101@hotmail.com",
  "jeanpierretremblay88@sympatico.ca","tremblayjacinthe@hotmail.com","dantruchon@yahoo.com",
  "francine.truong@hotmail.com","info.svineveld@gmail.com","felixvanier27@gmail.com",
  "wmarvin035@gmail.com","g.verret@videotron.ca","perceval9985@gmail.com",
  "mariejoseevouligny@gmail.com","audreywilli@icloud.com","Ryammine.csssl@ssss.gouv.qc.ca",
  "rsll303@hotmail.com","taperomeo12@gmail.com"
].map(e => e.toLowerCase().trim());

async function mondayQuery(query) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": API_TOKEN,
      "API-Version": "2024-01"
    },
    body: JSON.stringify({ query })
  });
  return res.json();
}

async function getAllItems() {
  let items = [];
  let cursor = null;

  do {
    const cursorParam = cursor ? `, cursor: "${cursor}"` : "";
    const query = `
      query {
        boards(ids: [${BOARD_ID}]) {
          items_page(limit: 100${cursorParam}) {
            cursor
            items {
              id
              name
              column_values {
                id
                text
              }
            }
          }
        }
      }`;

    const data = await mondayQuery(query);
    const page = data.data.boards[0].items_page;
    items = items.concat(page.items);
    cursor = page.cursor;
    console.log(`Récupéré ${items.length} items...`);
  } while (cursor);

  return items;
}

async function updateDate(itemId) {
  const value = JSON.stringify({ date: DATE_VALUE });
  const query = `
    mutation {
      change_column_value(
        board_id: ${BOARD_ID},
        item_id: ${itemId},
        column_id: "${COLUMN_ID}",
        value: ${JSON.stringify(value)}
      ) { id }
    }`;
  return mondayQuery(query);
}

async function main() {
  console.log("📋 Récupération des items du board...");
  const allItems = await getAllItems();
  console.log(`✅ Total items: ${allItems.length}`);

  // Trouver la colonne email
  const emailColumnIds = ["email", "email4", "texte", "text"];
  let matched = [];
  let notFound = [];

  for (const item of allItems) {
    // Chercher l'email dans toutes les colonnes
    const itemEmails = item.column_values
      .map(cv => cv.text?.toLowerCase().trim())
      .filter(Boolean);

    const nameAsEmail = item.name?.toLowerCase().trim();
    const allValues = [...itemEmails, nameAsEmail];

    const found = EMAILS.some(e => allValues.includes(e));
    if (found) {
      matched.push(item);
    }
  }

  console.log(`\n🎯 ${matched.length} items trouvés sur ${EMAILS.length} emails`);

  // Mise à jour
  let success = 0, errors = 0;
  for (const item of matched) {
    try {
      await updateDate(item.id);
      console.log(`✅ Mis à jour: ${item.name} (ID: ${item.id})`);
      success++;
      await new Promise(r => setTimeout(r, 200)); // rate limit
    } catch (e) {
      console.error(`❌ Erreur pour ${item.name}: ${e.message}`);
      errors++;
    }
  }

  // Rapport
  const matchedEmails = matched.flatMap(item =>
    item.column_values.map(cv => cv.text?.toLowerCase().trim()).filter(Boolean)
  );
  notFound = EMAILS.filter(e => !matchedEmails.includes(e));

  console.log(`\n📊 RÉSUMÉ:`);
  console.log(`  ✅ Mis à jour: ${success}`);
  console.log(`  ❌ Erreurs: ${errors}`);
  console.log(`  ⚠️  Emails non trouvés (${notFound.length}):`);
  notFound.forEach(e => console.log(`    - ${e}`));
}

main().catch(console.error);
