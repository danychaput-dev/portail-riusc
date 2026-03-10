const API_TOKEN = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ2NDY3NDUzNSwiYWFpIjoxMSwidWlkIjo3MDg2NTA0MywiaWFkIjoiMjAyNS0wMS0yOVQwMTo0NTozMi4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6Mjc0NTk4NTAsInJnbiI6InVzZTEifQ.U0ufF892D9vLZWIBlmSsVpVX_IwkTFSnlDAuyvMWn9U";
const BOARD_ID = 8252978837;
const DATE_COLUMN_ID = "date_mm1a7c49";
const EMAIL_COLUMN_ID = "e_mail_mkmch8yp";

const MOIS_FR = {
  'janv': '01', 'févr': '02', 'mars': '03', 'avr': '04',
  'mai': '05', 'juin': '06', 'juil': '07', 'août': '08',
  'sept': '09', 'oct': '10', 'nov': '11', 'déc': '12'
};

function convertDate(dateFr) {
  const clean = dateFr.replace('.', '').trim();
  const parts = clean.split(/[\s,]+/);
  const mois = MOIS_FR[parts[0].toLowerCase()];
  const jour = parts[1].padStart(2, '0');
  const annee = parts[2];
  return `${annee}-${mois}-${jour}`;
}

const CSV_DATA = [
  ["mars 9, 2026", "audreywilli@icloud.com"],
  ["févr. 23, 2026", "camilleheroux@outlook.com"],
  ["mars 5, 2026", "crenate@icloud.com"],
  ["mars 6, 2026", "cduguay19@gmail.com"],
  ["févr. 25, 2026", "cjolimax@hotmail.ca"],
  ["déc. 11, 2025", "chaputdany@gmail.com"],
  ["févr. 23, 2026", "chaputdany@gmail.com"],
  ["mars 5, 2026", "heond@hotmail.com"],
  ["févr. 28, 2026", "elisa.rietzschel@gmail.com"],
  ["mars 10, 2026", "ericlaviolette29@gmail.com"],
  ["févr. 25, 2026", "farsenault@videotron.ca"],
  ["mars 9, 2026", "fbisson7@gmail.com"],
  ["févr. 23, 2026", "demers_frederick@hotmail.com"],
  ["mars 10, 2026", "genevieve-bisson@hotmail.com"],
  ["mars 6, 2026", "jerrydrouin58@gmail.com"],
  ["mars 1, 2026", "hubert.couture.rivard@gmail.com"],
  ["mars 8, 2026", "heloise.dostie@gmail.cm"],
  ["févr. 24, 2026", "bernierhelene@gmail.com"],
  ["févr. 26, 2026", "irobert@sbo-ovsar.ca"],
  ["févr. 26, 2026", "jbedard06@hotmail.com"],
  ["févr. 23, 2026", "jacques.grondin@hotmail.ca"],
  ["févr. 23, 2026", "cj.roy@bell.net"],
  ["févr. 25, 2026", "chapdelainejason@hotmail.com"],
  ["mars 9, 2026", "claveaujean22@gmail.com"],
  ["févr. 27, 2026", "jeanhuotjh@gmail.com"],
  ["févr. 26, 2026", "parisjeanguy@gmail.com"],
  ["févr. 28, 2026", "jeanpierretremblay88@sympatico.ca"],
  ["févr. 25, 2026", "jonathandupuis_61@hotmail.fr"],
  ["mars 7, 2026", "luc.mercier@hotmail.com"],
  ["févr. 23, 2026", "manon.goudreau@hotmail.com"],
  ["févr. 28, 2026", "mcauchon@videotron.ca"],
  ["mars 6, 2026", "mbrse@icloud.com"],
  ["mars 7, 2026", "mcormier1@bell.net"],
  ["févr. 28, 2026", "paulinjacques123@gmail.com"],
  ["mars 8, 2026", "plambert.contact@gmail.com"],
  ["mars 6, 2026", "pierrogagnon@hotmail.com"],
  ["févr. 25, 2026", "pierredubois57@hotmail.com"],
  ["mars 5, 2026", "reneroy11@telus.net"],
  ["mars 8, 2026", "rubybissonnette@gmail.com"],
  ["févr. 24, 2026", "edniescott@gmail.com"],
  ["févr. 27, 2026", "cotese04@cgocable.ca"],
  ["mars 8, 2026", "valerie_lacroix_@outlook.com"],
  ["mars 6, 2026", "yvesgareau05@hotmail.com"],
];

const emailDateMap = {};
for (const [dateFr, email] of CSV_DATA) {
  const emailLower = email.toLowerCase().trim();
  const dateConverted = convertDate(dateFr);
  if (!emailDateMap[emailLower] || dateConverted > emailDateMap[emailLower]) {
    emailDateMap[emailLower] = dateConverted;
  }
}
console.log(`📋 ${Object.keys(emailDateMap).length} emails uniques à mettre à jour`);

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

  const json = await res.json();

  if (json.errors) {
    console.error("❌ Erreur API Monday:", JSON.stringify(json.errors, null, 2));
    throw new Error("Erreur API Monday");
  }

  if (!json.data) {
    console.error("❌ Réponse inattendue:", JSON.stringify(json, null, 2));
    throw new Error("Réponse vide — vérifiez votre token");
  }

  return json;
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
              column_values(ids: ["${EMAIL_COLUMN_ID}"]) {
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
    console.log(`  Récupéré ${items.length} items...`);
  } while (cursor);
  return items;
}

async function updateDate(itemId, dateValue) {
  const value = JSON.stringify({ date: dateValue });
  const query = `
    mutation {
      change_column_value(
        board_id: ${BOARD_ID},
        item_id: ${itemId},
        column_id: "${DATE_COLUMN_ID}",
        value: ${JSON.stringify(value)}
      ) { id }
    }`;
  return mondayQuery(query);
}

async function main() {
  console.log("📋 Récupération des items du board...");
  const allItems = await getAllItems();
  console.log(`✅ Total items: ${allItems.length}\n`);

  let success = 0, notFound = [], errors = 0;

  for (const [email, dateValue] of Object.entries(emailDateMap)) {
    const item = allItems.find(i => {
      const itemEmail = i.column_values[0]?.text?.toLowerCase().trim();
      return itemEmail === email;
    });

    if (!item) {
      notFound.push(email);
      continue;
    }

    try {
      await updateDate(item.id, dateValue);
      console.log(`✅ ${email} → ${dateValue} (${item.name})`);
      success++;
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`❌ Erreur pour ${email}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n📊 RÉSUMÉ:`);
  console.log(`  ✅ Mis à jour: ${success}`);
  console.log(`  ❌ Erreurs: ${errors}`);
  console.log(`  ⚠️  Emails non trouvés (${notFound.length}):`);
  notFound.forEach(e => console.log(`    - ${e}`));
}

main().catch(console.error);
