"""
Diagnostic complet : Board 8252978837 — classification emails vs notes
+ scan des 200 premiers items avec détail
"""

import json
import requests
from collections import Counter

API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ2NDY3NDUzNSwiYWFpIjoxMSwidWlkIjo3MDg2NTA0MywiaWFkIjoiMjAyNS0wMS0yOVQwMTo0NTozMi4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6Mjc0NTk4NTAsInJnbiI6InVzZTEifQ.U0ufF892D9vLZWIBlmSsVpVX_IwkTFSnlDAuyvMWn9U"
BOARD_ID = "8252978837"
URL = "https://api.monday.com/v2"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "API-Version": "2024-10"
}

def query_monday(q):
    r = requests.post(URL, json={"query": q}, headers=HEADERS)
    r.raise_for_status()
    data = r.json()
    if "errors" in data:
        print("ERREURS API:", json.dumps(data["errors"], indent=2))
    return data.get("data", {})

def is_email(text):
    return "Outgoing Email" in text or "Incoming Email" in text or ("From:" in text[:150] and "To:" in text[:300])

# ── Fetch 200 items avec tous les updates ─────────────────────
print("=" * 60)
print("SCAN COMPLET — Board 8252978837 (200 premiers items)")
print("=" * 60)

all_items = []
cursor = None

for page in range(2):
    if cursor:
        q = f'{{ boards(ids: [{BOARD_ID}]) {{ items_page(limit: 100, cursor: "{cursor}") {{ cursor items {{ id name updates {{ id text_body body created_at creator {{ name email }} }} }} }} }} }}'
    else:
        q = f'{{ boards(ids: [{BOARD_ID}]) {{ items_page(limit: 100) {{ cursor items {{ id name updates {{ id text_body body created_at creator {{ name email }} }} }} }} }} }}'

    data = query_monday(q)
    page_data = data.get("boards", [{}])[0].get("items_page", {})
    items_batch = page_data.get("items", [])
    cursor = page_data.get("cursor")
    all_items.extend(items_batch)
    print(f"  Page {page+1}: {len(items_batch)} items")
    if not cursor:
        break

# ── Classification ────────────────────────────────────────────
print("\n" + "=" * 60)
print("CLASSIFICATION DES UPDATES")
print("=" * 60)

email_count = 0
note_count = 0
items_with_notes = []
note_examples = []

for item in all_items:
    item_emails = 0
    item_notes = 0
    for u in item.get("updates", []):
        text = u.get("text_body") or ""
        if is_email(text):
            item_emails += 1
        else:
            item_notes += 1
            if len(note_examples) < 5:
                creator = (u.get("creator") or {}).get("name", "?")
                note_examples.append({
                    "item": item["name"],
                    "item_id": item["id"],
                    "creator": creator,
                    "date": u["created_at"][:10],
                    "text": text[:400],
                    "html": (u.get("body") or "")[:300],
                })
    email_count += item_emails
    note_count += item_notes
    if item_notes > 0:
        items_with_notes.append((item["name"], item["id"], item_notes, item_emails))

total = email_count + note_count
print(f"Items analysés: {len(all_items)}")
print(f"Total updates: {total}")
print(f"  Courriels: {email_count}")
print(f"  Notes: {note_count}")
print(f"Items avec au moins 1 note: {len(items_with_notes)}")

# ── Top items par updates ─────────────────────────────────────
print("\n" + "=" * 60)
print("TOP 15 ITEMS PAR NOMBRE D'UPDATES")
print("=" * 60)

all_counts = []
for item in all_items:
    updates = item.get("updates", [])
    emails = sum(1 for u in updates if is_email(u.get("text_body") or ""))
    notes = len(updates) - emails
    all_counts.append((item["name"], item["id"], len(updates), emails, notes))

all_counts.sort(key=lambda x: x[2], reverse=True)
for name, item_id, total, emails, notes in all_counts[:15]:
    print(f"  {name:35s} (ID: {item_id}) — {total} total ({emails}E / {notes}N)")

# ── Exemples de NOTES ─────────────────────────────────────────
if note_examples:
    print("\n" + "=" * 60)
    print(f"EXEMPLES DE NOTES ({len(note_examples)} trouvées)")
    print("=" * 60)
    for i, ex in enumerate(note_examples, 1):
        print(f"\n--- Note {i}: {ex['item']} (ID: {ex['item_id']}) ---")
        print(f"  Par: {ex['creator']} | Date: {ex['date']}")
        print(f"  Texte: {ex['text'][:300]}")
        if ex['html']:
            print(f"  HTML: {ex['html'][:200]}")
else:
    print("\nAucune note trouvée — tous les updates sont des courriels.")

# ── Exemples de COURRIELS (structure détaillée) ───────────────
print("\n" + "=" * 60)
print("EXEMPLE DE COURRIEL (structure détaillée)")
print("=" * 60)

for item in all_items:
    for u in item.get("updates", []):
        text = u.get("text_body") or ""
        if is_email(text):
            print(f"Item: {item['name']} (ID: {item['id']})")
            print(f"Creator: {(u.get('creator') or {}).get('name', '?')}")
            print(f"Date API: {u['created_at']}")
            print(f"\nTEXT_BODY complet:\n{text[:800]}")
            print(f"\nBODY HTML complet:\n{(u.get('body') or '')[:800]}")
            break
    else:
        continue
    break

print("\n✅ Diagnostic complet terminé!")
