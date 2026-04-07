"""
Import des updates Monday.com → Supabase
- Courriels (Outgoing/Incoming Email) → table courriels
- Notes manuelles → table notes_reservistes

Board: 8252978837 (Répertoire RIUSC)
Mapping: Monday item ID = benevole_id dans Supabase

⚠️  MODE DRY-RUN par défaut — change DRY_RUN = False pour exécuter
"""

import json
import re
import requests
import uuid
from datetime import datetime

# ── Config ────────────────────────────────────────────────────
DRY_RUN = False  # 🚀 Mode insertion réelle

MONDAY_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ2NDY3NDUzNSwiYWFpIjoxMSwidWlkIjo3MDg2NTA0MywiaWFkIjoiMjAyNS0wMS0yOVQwMTo0NTozMi4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6Mjc0NTk4NTAsInJnbiI6InVzZTEifQ.U0ufF892D9vLZWIBlmSsVpVX_IwkTFSnlDAuyvMWn9U"
BOARD_ID = "8252978837"

SUPABASE_URL = "https://jtzwkmcfarxptpcoaxxl.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4"

MONDAY_URL = "https://api.monday.com/v2"
MONDAY_HEADERS = {
    "Authorization": f"Bearer {MONDAY_API_KEY}",
    "Content-Type": "application/json",
    "API-Version": "2024-10"
}

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# ── Helpers ───────────────────────────────────────────────────

def query_monday(q):
    r = requests.post(MONDAY_URL, json={"query": q}, headers=MONDAY_HEADERS)
    r.raise_for_status()
    data = r.json()
    if "errors" in data:
        print(f"  ⚠️  Erreur Monday API: {data['errors']}")
        return {}
    return data.get("data", {})


def supabase_insert(table, rows):
    """Insert des lignes dans Supabase via REST API"""
    if not rows:
        return 0
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        json=rows,
        headers=SUPABASE_HEADERS
    )
    if r.status_code in (200, 201):
        return len(rows)
    else:
        print(f"  ❌ Erreur Supabase ({table}): {r.status_code} — {r.text[:300]}")
        return 0


def is_email_update(text):
    return "Outgoing Email" in text or "Incoming Email" in text


def parse_email_update(text_body, html_body, created_at):
    """Parse un update de type email pour extraire from, to, subject, body"""
    result = {
        "from_email": "",
        "to_email": "",
        "subject": "",
        "body_text": "",
        "body_html": html_body or "",
        "sent_at": created_at,
        "direction": "outgoing",
    }

    if "Incoming Email" in text_body:
        result["direction"] = "incoming"

    # Extraire From:
    m = re.search(r'From:\s*(.+?)(?:\n|$)', text_body)
    if m:
        result["from_email"] = m.group(1).strip()

    # Extraire To:
    m = re.search(r'To:\s*(.+?)(?:\n|$)', text_body)
    if m:
        result["to_email"] = m.group(1).strip()

    # Extraire Sent At:
    m = re.search(r'Sent At:\s*(.+?)(?:\n|$)', text_body)
    if m:
        try:
            sent_str = m.group(1).strip()
            # Monday format: "Tuesday, October 7th 2025, 10:23:30 UTC"
            # Nettoyer les suffixes ordinaux
            clean = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', sent_str)
            clean = clean.replace(" UTC", "")
            dt = datetime.strptime(clean, "%A, %B %d %Y, %H:%M:%S")
            result["sent_at"] = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            pass  # Garder created_at comme fallback

    # Extraire le sujet et le corps
    # Le contenu après "Sent At: ..." est le sujet puis le body
    lines = text_body.split("\n")
    content_start = 0
    for i, line in enumerate(lines):
        if line.startswith("Sent At:"):
            content_start = i + 1
            break

    content_lines = [l for l in lines[content_start:] if l.strip()]
    if content_lines:
        result["subject"] = content_lines[0].strip()
        result["body_text"] = "\n".join(content_lines[1:]).strip()
    else:
        result["subject"] = "(sans sujet)"

    return result


# ── Étape 0 : Fetch les benevole_ids valides et le user_id Dany ──
print("=" * 60)
print("IMPORT MONDAY → SUPABASE")
print(f"Mode: {'🔍 DRY-RUN (pas d\'insertion)' if DRY_RUN else '🚀 INSERTION RÉELLE'}")
print("=" * 60)

print("\nChargement des benevole_id valides depuis Supabase...")
valid_ids = set()
offset = 0
while True:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/reservistes?select=benevole_id&offset={offset}&limit=1000",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    )
    rows = r.json()
    if not rows:
        break
    for row in rows:
        valid_ids.add(str(row["benevole_id"]))
    offset += len(rows)
print(f"  ✅ {len(valid_ids)} benevole_id valides chargés")

# Trouver le user_id de Dany Chaput
print("Recherche du user_id de Dany Chaput...")
r = requests.get(
    f"{SUPABASE_URL}/rest/v1/reservistes?select=user_id&email=eq.dany.chaput@aqbrs.ca&limit=1",
    headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
)
dany_rows = r.json()
if not dany_rows or not dany_rows[0].get("user_id"):
    # Fallback: chercher par nom
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/reservistes?select=user_id&nom=eq.Chaput&prenom=eq.Dany&limit=1",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    )
    dany_rows = r.json()

DANY_USER_ID = dany_rows[0]["user_id"] if dany_rows and dany_rows[0].get("user_id") else None
print(f"  ✅ user_id Dany: {DANY_USER_ID}")

if not DANY_USER_ID:
    print("  ❌ Impossible de trouver le user_id de Dany. Abandon.")
    exit(1)

# ── Étape 1 : Fetch tous les items avec updates ──────────────

all_items = []
cursor = None
page = 0

while True:
    page += 1
    if cursor:
        q = f'{{ boards(ids: [{BOARD_ID}]) {{ items_page(limit: 100, cursor: "{cursor}") {{ cursor items {{ id name updates {{ id text_body body created_at creator {{ name email }} }} }} }} }} }}'
    else:
        q = f'{{ boards(ids: [{BOARD_ID}]) {{ items_page(limit: 100) {{ cursor items {{ id name updates {{ id text_body body created_at creator {{ name email }} }} }} }} }} }}'

    data = query_monday(q)
    page_data = data.get("boards", [{}])[0].get("items_page", {})
    items_batch = page_data.get("items", [])
    cursor = page_data.get("cursor")
    all_items.extend(items_batch)
    print(f"  Page {page}: {len(items_batch)} items (total: {len(all_items)})")

    if not cursor or not items_batch:
        break

print(f"\n✅ {len(all_items)} items récupérés du board Monday\n")

# ── Étape 2 : Classifier et préparer les inserts ─────────────
print("Traitement des updates...")

courriels_to_insert = []
notes_to_insert = []
skipped_self_notif = 0
skipped_invalid_id = 0

for item in all_items:
    benevole_id = str(item["id"])  # Monday item ID = benevole_id
    item_name = item.get("name", "?")

    # Skip si le benevole_id n'existe pas dans Supabase
    if benevole_id not in valid_ids:
        skipped_invalid_id += 1
        continue

    for u in item.get("updates", []):
        text = u.get("text_body") or ""
        html = u.get("body") or ""
        created_at = u.get("created_at", "")
        creator = u.get("creator") or {}

        if is_email_update(text):
            # ── COURRIEL ──
            parsed = parse_email_update(text, html, created_at)

            # Skip les notifications admin-to-admin (dany → dany)
            if parsed["to_email"] == parsed["from_email"]:
                skipped_self_notif += 1
                continue

            courriel = {
                "id": str(uuid.uuid4()),
                "benevole_id": benevole_id,
                "from_email": parsed["from_email"],
                "from_name": "AQBRS (Monday.com)",
                "to_email": parsed["to_email"],
                "subject": parsed["subject"][:500] if parsed["subject"] else "(sans sujet)",
                "body_html": parsed["body_html"],
                "statut": "delivered",
                "envoye_par": DANY_USER_ID,
                "created_at": parsed["sent_at"],
            }
            courriels_to_insert.append(courriel)

        else:
            # ── NOTE ──
            if not text.strip():
                continue

            note = {
                "id": str(uuid.uuid4()),
                "benevole_id": benevole_id,
                "auteur_id": DANY_USER_ID,
                "auteur_nom": creator.get("name") or "Import Monday",
                "contenu": text.strip(),
                "created_at": created_at,
            }
            notes_to_insert.append(note)

# ── Rapport ───────────────────────────────────────────────────
print("\n" + "=" * 60)
print("RAPPORT")
print("=" * 60)
print(f"Items scannés: {len(all_items)}")
print(f"Courriels à importer: {len(courriels_to_insert)}")
print(f"  (notifications self ignorées: {skipped_self_notif})")
print(f"  (items sans benevole_id valide: {skipped_invalid_id})")
print(f"Notes à importer: {len(notes_to_insert)}")

# Aperçu courriels
if courriels_to_insert:
    print(f"\n📧 Aperçu des 5 premiers courriels:")
    for c in courriels_to_insert[:5]:
        print(f"  [{c['created_at'][:10]}] {c['from_email']} → {c['to_email']}")
        print(f"    Sujet: {c['subject'][:80]}")

# Aperçu notes
if notes_to_insert:
    print(f"\n📝 Aperçu des 5 premières notes:")
    for n in notes_to_insert[:5]:
        print(f"  [{n['created_at'][:10]}] par {n['auteur_nom']}")
        print(f"    {n['contenu'][:100]}")

# ── Étape 3 : Insertion Supabase ──────────────────────────────
if DRY_RUN:
    print(f"\n🔍 DRY-RUN terminé. Pour insérer, change DRY_RUN = False dans le script.")
else:
    print(f"\n🚀 Insertion dans Supabase...")

    # Insérer par batch de 50
    batch_size = 50

    inserted_courriels = 0
    for i in range(0, len(courriels_to_insert), batch_size):
        batch = courriels_to_insert[i:i+batch_size]
        n = supabase_insert("courriels", batch)
        inserted_courriels += n
        print(f"  📧 Courriels: {inserted_courriels}/{len(courriels_to_insert)}")

    # Notes déjà insérées au run précédent — skip
    print(f"  📝 Notes: déjà insérées (443) — skip")
    inserted_notes = 0

    print(f"\n✅ Import terminé!")
    print(f"  Courriels insérés: {inserted_courriels}")
    print(f"  Notes insérées: {inserted_notes}")

print("\n✅ Script terminé!")
