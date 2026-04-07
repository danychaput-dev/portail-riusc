"""
Diagnostic : Explorer les updates/courriels du board Monday.com 8252978837
But : comprendre la structure des données avant de coder l'import
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

# ── 1. Info du board ──────────────────────────────────────────
print("=" * 60)
print("1. INFO DU BOARD")
print("=" * 60)

data = query_monday(f"""{{
  boards(ids: [{BOARD_ID}]) {{
    name
    items_count
    columns {{ id title type }}
  }}
}}""")

board = data.get("boards", [{}])[0]
print(f"Nom: {board.get('name')}")
print(f"Items: {board.get('items_count')}")
print(f"\nColonnes ({len(board.get('columns', []))}):")
for col in board.get("columns", []):
    print(f"  - {col['id']:30s} | {col['type']:20s} | {col['title']}")

# ── 2. Échantillon de 5 items avec leurs updates ─────────────
print("\n" + "=" * 60)
print("2. ÉCHANTILLON D'ITEMS AVEC UPDATES")
print("=" * 60)

data = query_monday(f"""{{
  boards(ids: [{BOARD_ID}]) {{
    items_page(limit: 5) {{
      items {{
        id
        name
        updates(limit: 10) {{
          id
          body
          text_body
          created_at
          updated_at
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
update_types = Counter()

for item in items:
    updates = item.get("updates", [])
    total_updates += len(updates)
    print(f"\n--- Item: {item['name']} (ID: {item['id']}) — {len(updates)} updates ---")
    for u in updates[:3]:  # Afficher les 3 premiers
        body = (u.get("text_body") or "")[:200]
        html_body = (u.get("body") or "")[:100]
        creator = u.get("creator") or {}

        # Détecter si c'est un email (Monday met souvent "email" dans le HTML)
        is_email = "email" in html_body.lower() or "@" in body[:50]
        update_types["email" if is_email else "note"] += 1

        print(f"  [{u['created_at'][:10]}] par {creator.get('name', '?')} ({'EMAIL?' if is_email else 'NOTE'})")
        print(f"    Text: {body[:150]}...")
        if html_body:
            print(f"    HTML: {html_body[:100]}...")

print(f"\nTotal updates dans échantillon: {total_updates}")
print(f"Types détectés: {dict(update_types)}")

# ── 3. Compter les updates totaux sur le board ────────────────
print("\n" + "=" * 60)
print("3. COMPTAGE TOTAL DES UPDATES (premiers 100 items)")
print("=" * 60)

data = query_monday(f"""{{
  boards(ids: [{BOARD_ID}]) {{
    items_page(limit: 100) {{
      items {{
        id
        name
        updates {{
          id
        }}
      }}
    }}
  }}
}}""")

items_all = data.get("boards", [{}])[0].get("items_page", {}).get("items", [])
counts = [(item["name"], item["id"], len(item.get("updates", []))) for item in items_all]
counts.sort(key=lambda x: x[2], reverse=True)

total = sum(c[2] for c in counts)
with_updates = sum(1 for c in counts if c[2] > 0)

print(f"Items analysés: {len(counts)}")
print(f"Items avec updates: {with_updates}")
print(f"Total updates: {total}")
print(f"\nTop 10 items par nombre d'updates:")
for name, item_id, count in counts[:10]:
    print(f"  {name:30s} (ID: {item_id}) — {count} updates")

# ── 4. Analyser la structure HTML d'un update en détail ───────
print("\n" + "=" * 60)
print("4. STRUCTURE DÉTAILLÉE D'UN UPDATE (premier trouvé)")
print("=" * 60)

for item in items:
    for u in item.get("updates", []):
        if u.get("body"):
            print(f"Item: {item['name']}")
            print(f"Creator: {(u.get('creator') or {}).get('name', '?')}")
            print(f"Date: {u['created_at']}")
            print(f"\nHTML body complet:\n{u['body'][:2000]}")
            print(f"\nText body complet:\n{u.get('text_body', '')[:1000]}")
            break
    else:
        continue
    break

print("\n✅ Diagnostic terminé!")
