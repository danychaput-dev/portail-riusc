"""
Diagnostic : Explorer les updates du board Monday.com 8216698203 (Répertoire original)
"""

import json
import requests
from collections import Counter

API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ2NDY3NDUzNSwiYWFpIjoxMSwidWlkIjo3MDg2NTA0MywiaWFkIjoiMjAyNS0wMS0yOVQwMTo0NTozMi4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6Mjc0NTk4NTAsInJnbiI6InVzZTEifQ.U0ufF892D9vLZWIBlmSsVpVX_IwkTFSnlDAuyvMWn9U"
BOARD_ID = "8216698203"
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

# ── 1. Info du board ──────────────────────────────────────────
print("=" * 60)
print(f"BOARD {BOARD_ID}")
print("=" * 60)

data = query_monday(f"""{{
  boards(ids: [{BOARD_ID}]) {{
    name
    items_count
  }}
}}""")

board = data.get("boards", [{}])[0]
print(f"Nom: {board.get('name')}")
print(f"Items: {board.get('items_count')}")

# ── 2. Échantillon de 10 items avec updates ───────────────────
print("\n" + "=" * 60)
print("ÉCHANTILLON D'ITEMS AVEC UPDATES")
print("=" * 60)

data = query_monday(f"""{{
  boards(ids: [{BOARD_ID}]) {{
    items_page(limit: 10) {{
      items {{
        id
        name
        updates(limit: 5) {{
          id
          body
          text_body
          created_at
          creator {{
            name
            email
          }}
        }}
      }}
    }}
  }}
}}""")

items = data.get("boards", [{}])[0].get("items_page", {}).get("items", [])
total_updates = 0
type_counts = Counter()

for item in items:
    updates = item.get("updates", [])
    total_updates += len(updates)
    print(f"\n--- {item['name']} (ID: {item['id']}) — {len(updates)} updates ---")
    for u in updates[:3]:
        text = (u.get("text_body") or "")[:300]
        html = (u.get("body") or "")[:150]
        creator = (u.get("creator") or {}).get("name", "?")

        # Classifier
        if "Outgoing Email" in text or "Incoming Email" in text:
            utype = "EMAIL"
        elif "email" in html.lower() and ("From:" in text or "To:" in text):
            utype = "EMAIL"
        else:
            utype = "NOTE"
        type_counts[utype] += 1

        print(f"  [{u['created_at'][:10]}] par {creator} ({utype})")
        print(f"    {text[:200]}")

print(f"\nTotal updates échantillon: {total_updates}")
print(f"Types: {dict(type_counts)}")

# ── 3. Comptage sur 200 items ─────────────────────────────────
print("\n" + "=" * 60)
print("COMPTAGE TOTAL (premiers 200 items)")
print("=" * 60)

all_items = []
cursor = None

for page in range(2):  # 2 pages de 100
    if cursor:
        q = f"""{{ boards(ids: [{BOARD_ID}]) {{ items_page(limit: 100, cursor: "{cursor}") {{ cursor items {{ id name updates {{ id text_body }} }} }} }} }}"""
    else:
        q = f"""{{ boards(ids: [{BOARD_ID}]) {{ items_page(limit: 100) {{ cursor items {{ id name updates {{ id text_body }} }} }} }} }}"""

    data = query_monday(q)
    page_data = data.get("boards", [{}])[0].get("items_page", {})
    items_batch = page_data.get("items", [])
    cursor = page_data.get("cursor")
    all_items.extend(items_batch)
    print(f"  Page {page+1}: {len(items_batch)} items fetched")
    if not cursor:
        break

# Classifier tous les updates
email_count = 0
note_count = 0
items_with_notes = []

for item in all_items:
    item_emails = 0
    item_notes = 0
    for u in item.get("updates", []):
        text = u.get("text_body") or ""
        if "Outgoing Email" in text or "Incoming Email" in text or ("From:" in text[:100] and "To:" in text[:200]):
            item_emails += 1
        else:
            item_notes += 1
    email_count += item_emails
    note_count += item_notes
    if item_notes > 0:
        items_with_notes.append((item["name"], item["id"], item_notes, item_emails))

total = email_count + note_count
print(f"\nItems analysés: {len(all_items)}")
print(f"Total updates: {total}")
print(f"  Courriels: {email_count}")
print(f"  Notes: {note_count}")

if items_with_notes:
    items_with_notes.sort(key=lambda x: x[2], reverse=True)
    print(f"\nItems avec NOTES (pas des emails) — top 15:")
    for name, item_id, notes, emails in items_with_notes[:15]:
        print(f"  {name:35s} (ID: {item_id}) — {notes} notes, {emails} emails")

# ── 4. Exemple d'une NOTE (pas email) ─────────────────────────
print("\n" + "=" * 60)
print("EXEMPLE DE NOTE (pas un email)")
print("=" * 60)

found = False
for item in all_items:
    for u in item.get("updates", []):
        text = u.get("text_body") or ""
        if "Outgoing Email" not in text and "Incoming Email" not in text and len(text) > 10:
            print(f"Item: {item['name']} (ID: {item['id']})")
            print(f"Text complet:\n{text[:500]}")
            found = True
            break
    if found:
        break

if not found:
    print("Aucune note trouvée dans l'échantillon")

print("\n✅ Diagnostic board 2 terminé!")
