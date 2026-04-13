#!/usr/bin/env python3
"""
Backup Monday.com cible - uniquement les boards contenant des donnees reservistes
et les fichiers attaches. Tout le reste est deja dans Supabase.

Usage:
    export MONDAY_API_KEY="eyJ..."
    python3 backup_monday_cible.py

Boards cibles:
  - Repertoire RIUSC (942)
  - Formations des benevoles (850)
  - Resultat de sondage JotForm (826)
  - Inscription & Presence (349)
  - Remboursement des bottes (117)
  - Camp de Qualification (28)
  - Session de formation (19)
  - Catalogue Formations (7)
"""

import json
import os
import sys
import time
import csv
from datetime import datetime
from pathlib import Path
import requests

API_KEY = os.environ.get("MONDAY_API_KEY")
if not API_KEY:
    print("ERREUR: exporter MONDAY_API_KEY avant de lancer le script")
    sys.exit(1)

API_URL = "https://api.monday.com/v2"
HEADERS = {
    "Authorization": API_KEY,
    "Content-Type": "application/json",
    "API-Version": "2024-10",
}

# Boards a sauvegarder (id, nom lisible)
TARGET_BOARDS = [
    ("8252978837",  "Repertoire_RIUSC"),
    ("18179394852", "Formations_des_benevoles"),
    ("18378406896", "Resultat_sondage_JotForm"),
    ("18272025168", "Inscription_Presence"),
    ("18391889634", "Remboursement_des_bottes"),
    ("18270191561", "Camp_de_Qualification"),
    ("18179369221", "Session_de_formation"),
    ("18179339545", "Catalogue_Formations"),
]

PAGE_SIZE = 20
REQUEST_DELAY = 1.2
MAX_RETRIES = 6

OUT_DIR = Path(__file__).parent / f"monday_cible_{datetime.now().strftime('%Y-%m-%d_%H%M')}"
OUT_DIR.mkdir(parents=True, exist_ok=True)
ERROR_LOG = OUT_DIR / "errors.log"


def log_err(msg):
    ts = datetime.now().isoformat(timespec="seconds")
    line = f"[{ts}] {msg}"
    print("  !", msg)
    with open(ERROR_LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def gql(query, variables=None):
    """Execute une query GraphQL avec retry sur rate limit."""
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.post(API_URL, headers=HEADERS,
                              json={"query": query, "variables": variables or {}},
                              timeout=60)
            data = r.json()
            if "errors" in data:
                err = str(data["errors"])
                if "ComplexityException" in err or "Rate" in err or "429" in err:
                    wait = 30 + attempt * 15
                    print(f"    rate limit, pause {wait}s (tentative {attempt+1}/{MAX_RETRIES})")
                    time.sleep(wait)
                    continue
                raise RuntimeError(err)
            time.sleep(REQUEST_DELAY)
            return data["data"]
        except requests.RequestException as e:
            log_err(f"Request error: {e}, retry dans 10s")
            time.sleep(10)
    raise RuntimeError(f"Echec apres {MAX_RETRIES} tentatives")


def fetch_items(board_id):
    """Recupere tous les items d'un board (2 phases: light + enrichissement)."""
    items = []
    cursor = None
    page = 0
    while True:
        page += 1
        if cursor:
            q = """query($cursor: String!, $limit: Int!) {
                next_items_page(cursor: $cursor, limit: $limit) {
                    cursor
                    items {
                        id name created_at updated_at
                        column_values { id column { title type } text value }
                    }
                }
            }"""
            data = gql(q, {"cursor": cursor, "limit": PAGE_SIZE})
            pg = data["next_items_page"]
        else:
            q = """query($bid: [ID!], $limit: Int!) {
                boards(ids: $bid) {
                    items_page(limit: $limit) {
                        cursor
                        items {
                            id name created_at updated_at
                            column_values { id column { title type } text value }
                        }
                    }
                }
            }"""
            data = gql(q, {"bid": [board_id], "limit": PAGE_SIZE})
            pg = data["boards"][0]["items_page"]

        items.extend(pg["items"])
        cursor = pg.get("cursor")
        print(f"    page {page}: +{len(pg['items'])} items (total {len(items)})")
        if not cursor:
            break
    return items


def fetch_assets_for_items(item_ids):
    """Recupere les assets pour un lot d'items."""
    if not item_ids:
        return {}
    q = """query($ids: [ID!]) {
        items(ids: $ids) {
            id
            assets { id name url file_extension file_size public_url }
        }
    }"""
    data = gql(q, {"ids": item_ids})
    return {it["id"]: it.get("assets", []) for it in data["items"]}


def download_file(url, dest):
    """Telecharge un fichier Monday avec headers appropries pour S3."""
    if dest.exists() and dest.stat().st_size > 0:
        return True, "deja present"
    # Pour les URLs S3 signees de Monday, ne PAS envoyer l'Authorization header
    s3_headers = {"User-Agent": "Mozilla/5.0 (Backup)"}
    try:
        with requests.get(url, headers=s3_headers, stream=True, timeout=120, allow_redirects=True) as r:
            if r.status_code != 200:
                return False, f"HTTP {r.status_code}"
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)
        return True, "OK"
    except Exception as e:
        return False, str(e)


def sanitize(name):
    return "".join(c if c.isalnum() or c in "._- " else "_" for c in name)[:150]


def items_to_csv(items, csv_path):
    """Export CSV avec colonnes par titre."""
    if not items:
        return
    col_titles = []
    for it in items:
        for cv in it.get("column_values", []):
            t = cv.get("column", {}).get("title", cv["id"])
            if t not in col_titles:
                col_titles.append(t)
    header = ["id", "name", "created_at", "updated_at"] + col_titles
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        for it in items:
            row = [it["id"], it["name"], it.get("created_at", ""), it.get("updated_at", "")]
            bycol = {}
            for cv in it.get("column_values", []):
                t = cv.get("column", {}).get("title", cv["id"])
                bycol[t] = cv.get("text", "") or ""
            row.extend(bycol.get(t, "") for t in col_titles)
            w.writerow(row)


def backup_board(board_id, nice_name):
    print(f"\n=== Board {board_id} - {nice_name} ===")
    board_dir = OUT_DIR / nice_name
    board_dir.mkdir(parents=True, exist_ok=True)

    # Phase 1 - items
    try:
        items = fetch_items(board_id)
    except Exception as e:
        log_err(f"Board {nice_name}: echec fetch items: {e}")
        return

    # Sauvegarde brute
    with open(board_dir / "items.json", "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    items_to_csv(items, board_dir / "items.csv")
    print(f"  {len(items)} items sauvegardes (json + csv)")

    # Phase 2 - assets par lots de 20
    assets_dir = board_dir / "files"
    all_assets = {}
    batch_size = 20
    for i in range(0, len(items), batch_size):
        batch_ids = [it["id"] for it in items[i:i+batch_size]]
        try:
            result = fetch_assets_for_items(batch_ids)
            all_assets.update(result)
        except Exception as e:
            log_err(f"Assets batch {i}: {e}")
            continue

    # Telechargement
    total_files = sum(len(a) for a in all_assets.values())
    if total_files:
        print(f"  {total_files} fichiers a telecharger")
        ok = fail = 0
        for item_id, assets in all_assets.items():
            for a in assets:
                fname = sanitize(f"{item_id}_{a['name']}")
                dest = assets_dir / fname
                url = a.get("public_url") or a.get("url")
                if not url:
                    continue
                success, msg = download_file(url, dest)
                if success:
                    ok += 1
                else:
                    fail += 1
                    log_err(f"File {fname}: {msg}")
        print(f"  fichiers: {ok} OK, {fail} echecs")

    # Manifest du board
    with open(board_dir / "assets_manifest.json", "w", encoding="utf-8") as f:
        json.dump(all_assets, f, ensure_ascii=False, indent=2)


def main():
    print(f"Backup Monday cible -> {OUT_DIR}")
    print(f"{len(TARGET_BOARDS)} boards a traiter\n")
    for board_id, nice_name in TARGET_BOARDS:
        backup_board(board_id, nice_name)
    print(f"\nTermine. Sortie: {OUT_DIR}")


if __name__ == "__main__":
    main()
