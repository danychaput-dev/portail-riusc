"""
Diagnostic : Chercher les courriels dans l'Activity Log et E-mails & Activities
pour les personnes avec beaucoup d'historique
"""

import json
import requests

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
        print("ERREURS API:", json.dumps(data["errors"], indent=2, ensure_ascii=False))
    return data.get("data", {})

# Personnes à chercher (depuis le screenshot)
PERSONNES = [
    "Bolduc Sebastien",
    "Bisson Nancy",
    "Charest Danielle",
    "Cortado Tom",
    "Lambert Philippe",
    "Lacroix Valérie",
    "Déragon Stéphanie",
    "Marcotte Marianne",
    "Morin Lisa",
    "Laviolette Éric",
    "Fournier Guy",
]

# ── 1. Chercher ces personnes par nom ─────────────────────────
print("=" * 60)
print("1. RECHERCHE DES PERSONNES AVEC BEAUCOUP D'HISTORIQUE")
print("=" * 60)

found_items = []
for nom in PERSONNES:
    # Chercher par nom de l'item
    parts = nom.split()
    search = parts[0]  # Chercher par nom de famille
    data = query_monday(f"""{{
      boards(ids: [{BOARD_ID}]) {{
        items_page(limit: 5, query_params: {{rules: [{{column_id: "name", compare_value: ["{search}"], operator: contains_text}}]}}) {{
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
    items = data.get("boards", [{}])[0].get("items_page", {}).get("items", [])
    for item in items:
        nb = len(item.get("updates", []))
        print(f"  {item['name']:35s} (ID: {item['id']}) — {nb} updates API")
        found_items.append(item)

# ── 2. Activity Logs du board ─────────────────────────────────
print("\n" + "=" * 60)
print("2. ACTIVITY LOGS DU BOARD (derniers 50)")
print("=" * 60)

data = query_monday(f"""{{
  boards(ids: [{BOARD_ID}]) {{
    activity_logs(limit: 50) {{
      id
      event
      data
      created_at
      user_id
      entity
    }}
  }}
}}""")

logs = data.get("boards", [{}])[0].get("activity_logs", [])
print(f"Logs retournés: {len(logs)}")

event_types = {}
for log in logs:
    evt = log.get("event", "?")
    event_types[evt] = event_types.get(evt, 0) + 1

print(f"\nTypes d'événements:")
for evt, count in sorted(event_types.items(), key=lambda x: -x[1]):
    print(f"  {evt}: {count}")

# Afficher les 5 premiers logs en détail
print(f"\nDétail des 5 premiers logs:")
for log in logs[:5]:
    print(f"\n  Event: {log['event']}")
    print(f"  Entity: {log.get('entity')}")
    print(f"  Date: {log['created_at']}")
    data_str = log.get("data", "")
    try:
        d = json.loads(data_str) if isinstance(data_str, str) else data_str
        print(f"  Data: {json.dumps(d, ensure_ascii=False)[:300]}")
    except:
        print(f"  Data: {str(data_str)[:300]}")

# ── 3. Chercher un item spécifique avec TOUT ──────────────────
print("\n" + "=" * 60)
print("3. ITEM BOLDUC SEBASTIEN — DÉTAIL COMPLET")
print("=" * 60)

# Chercher Bolduc
data = query_monday(f"""{{
  boards(ids: [{BOARD_ID}]) {{
    items_page(limit: 3, query_params: {{rules: [{{column_id: "name", compare_value: ["Bolduc"], operator: contains_text}}]}}) {{
      items {{
        id
        name
        column_values {{
          id
          type
          text
          value
        }}
        updates(limit: 20) {{
          id
          text_body
          body
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
for item in items:
    if "Bolduc" in item["name"]:
        print(f"Item: {item['name']} (ID: {item['id']})")
        print(f"Updates: {len(item.get('updates', []))}")

        # Afficher les colonnes non-vides
        print(f"\nColonnes avec valeur:")
        for col in item.get("column_values", []):
            if col.get("text") and col["text"].strip():
                print(f"  {col['id']:40s} | {col['type']:15s} | {col['text'][:80]}")

        # Afficher les updates
        print(f"\nUpdates:")
        for u in item.get("updates", []):
            creator = (u.get("creator") or {}).get("name", "?")
            text = (u.get("text_body") or "")[:200]
            print(f"  [{u['created_at'][:10]}] par {creator}")
            print(f"    {text[:180]}")
        break

# ── 4. Tester les emails via items_by_column_values ───────────
print("\n" + "=" * 60)
print("4. TESTER L'ACCÈS AUX EMAILS & ACTIVITÉS")
print("=" * 60)

# La colonne custom_mknwfddm est de type "unsupported" (Échéancier E-mails et activités)
# Essayons de la lire autrement
if items:
    item_id = items[0]["id"]

    # Essayer activity_logs filtré par item
    data = query_monday(f"""{{
      boards(ids: [{BOARD_ID}]) {{
        activity_logs(limit: 50, item_ids: [{item_id}]) {{
          id
          event
          data
          created_at
        }}
      }}
    }}""")

    logs = data.get("boards", [{}])[0].get("activity_logs", [])
    print(f"Activity logs pour Bolduc: {len(logs)}")

    evt_types = {}
    for log in logs:
        evt = log.get("event", "?")
        evt_types[evt] = evt_types.get(evt, 0) + 1

    print(f"Types d'événements:")
    for evt, count in sorted(evt_types.items(), key=lambda x: -x[1]):
        print(f"  {evt}: {count}")

    # Afficher quelques logs
    for log in logs[:5]:
        print(f"\n  Event: {log['event']} | Date: {log['created_at'][:10]}")
        data_str = log.get("data", "")
        try:
            d = json.loads(data_str) if isinstance(data_str, str) else data_str
            print(f"  Data: {json.dumps(d, ensure_ascii=False)[:400]}")
        except:
            print(f"  Data: {str(data_str)[:400]}")

print("\n✅ Diagnostic activités terminé!")
