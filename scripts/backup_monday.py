"""
Backup complet Monday.com

Exporte tous les boards, items, sous-items, et fichiers attaches
d'un compte Monday.com vers un dossier local organise.

Structure produite:
  backup_monday_YYYY-MM-DD/
    boards.json                   # Liste complete des boards
    workspaces.json               # Liste des workspaces
    manifest.json                 # Manifeste du backup (statistiques)
    errors.log                    # Erreurs rencontrees
    <workspace_name>/
      <board_name>_<board_id>/
        board.json                # Metadata + colonnes du board
        items.json                # Tous les items (JSON complet)
        items.csv                 # Items en format tabulaire lisible
        updates.json              # Commentaires/updates des items
        files/
          <item_id>_<filename>    # Fichiers attaches telecharges

Usage:
  python backup_monday.py --token "VOTRE_TOKEN"
  python backup_monday.py --token "VOTRE_TOKEN" --output ./mon_backup
  python backup_monday.py --token "VOTRE_TOKEN" --board 1234567890

Pour obtenir un token:
  Monday > Profil (avatar en bas a gauche) > Developer > My access tokens

Dependances:
  pip install requests
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

API_URL = "https://api.monday.com/v2"
API_VERSION = "2024-10"
PAGE_SIZE = 25  # Reduit pour eviter le ComplexityException
MAX_RETRIES = 5
RETRY_DELAY = 5
REQUEST_DELAY = 1.0  # Pause entre chaque requete pour menager le budget complexity


class MondayBackup:
    def __init__(self, token: str, output_dir: Path):
        self.token = token
        self.output_dir = output_dir
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": token,
            "API-Version": API_VERSION,
            "Content-Type": "application/json",
        })
        self.errors = []
        self.stats = {
            "boards": 0,
            "items": 0,
            "subitems": 0,
            "updates": 0,
            "files_downloaded": 0,
            "files_failed": 0,
            "bytes_downloaded": 0,
        }

    def query(self, query_str: str, variables: dict = None) -> dict:
        """Execute une requete GraphQL avec retry automatique."""
        payload = {"query": query_str}
        if variables:
            payload["variables"] = variables

        for attempt in range(MAX_RETRIES):
            try:
                r = self.session.post(API_URL, json=payload, timeout=60)
                if r.status_code == 429:
                    wait = int(r.headers.get("Retry-After", 60))
                    print(f"  Rate limit atteint, pause de {wait}s...")
                    time.sleep(wait)
                    continue
                r.raise_for_status()
                data = r.json()
                if "errors" in data:
                    msg = json.dumps(data["errors"])
                    if attempt < MAX_RETRIES - 1 and "ComplexityException" in msg:
                        print(f"  Complexity limit, pause de {RETRY_DELAY}s...")
                        time.sleep(RETRY_DELAY)
                        continue
                    raise RuntimeError(f"GraphQL errors: {msg}")
                return data["data"]
            except requests.exceptions.RequestException as e:
                if attempt < MAX_RETRIES - 1:
                    print(f"  Erreur reseau ({e}), retry dans {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY)
                else:
                    raise
        raise RuntimeError("Max retries depasses")

    def log_error(self, context: str, err: Exception):
        msg = f"[{datetime.now().isoformat()}] {context}: {err}"
        self.errors.append(msg)
        print(f"  ERREUR: {msg}")

    @staticmethod
    def safe_name(name: str, max_len: int = 80) -> str:
        """Nettoie un nom pour utilisation comme nom de fichier."""
        name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
        name = name.strip(". ")
        return name[:max_len] if len(name) > max_len else name or "sans_nom"

    def get_workspaces(self) -> list:
        """Liste tous les workspaces."""
        print("Recuperation des workspaces...")
        q = """
        query { workspaces(limit: 100) {
          id name kind description state created_at
        } }
        """
        data = self.query(q)
        return data.get("workspaces") or []

    def get_boards(self) -> list:
        """Liste tous les boards (avec pagination)."""
        print("Recuperation de la liste des boards...")
        all_boards = []
        page = 1
        while True:
            q = """
            query ($page: Int!, $limit: Int!) {
              boards(limit: $limit, page: $page, state: all) {
                id name description state board_kind board_folder_id
                workspace_id workspace { id name }
                items_count
                columns { id title type settings_str archived }
                groups { id title color archived }
                tags { id name color }
                owners { id name email }
                updated_at
              }
            }
            """
            data = self.query(q, {"page": page, "limit": 50})
            boards = data.get("boards") or []
            if not boards:
                break
            all_boards.extend(boards)
            print(f"  Page {page}: {len(boards)} boards (total: {len(all_boards)})")
            if len(boards) < 50:
                break
            page += 1
        return all_boards

    def get_items_for_board(self, board_id: str, board_name: str) -> tuple:
        """Recupere tous les items d'un board avec pagination cursor.
        Requete legere d'abord, puis details en batches separes."""
        items = []
        cursor = None
        page_num = 0

        # Phase 1: items + column_values (sans assets/subitems/updates)
        while True:
            page_num += 1
            if cursor is None:
                q = """
                query ($board_id: ID!, $limit: Int!) {
                  boards(ids: [$board_id]) {
                    items_page(limit: $limit) {
                      cursor
                      items {
                        id name state created_at updated_at
                        creator { id name email }
                        group { id title }
                        column_values {
                          id type text value
                        }
                      }
                    }
                  }
                }
                """
                variables = {"board_id": board_id, "limit": PAGE_SIZE}
            else:
                q = """
                query ($cursor: String!, $limit: Int!) {
                  next_items_page(cursor: $cursor, limit: $limit) {
                    cursor
                    items {
                      id name state created_at updated_at
                      creator { id name email }
                      group { id title }
                      column_values {
                        id type text value
                      }
                    }
                  }
                }
                """
                variables = {"cursor": cursor, "limit": PAGE_SIZE}

            time.sleep(REQUEST_DELAY)
            try:
                data = self.query(q, variables)
            except Exception as e:
                self.log_error(f"Items board {board_name} ({board_id}) page {page_num}", e)
                break

            if cursor is None:
                page_data = (data.get("boards") or [{}])[0].get("items_page") or {}
            else:
                page_data = data.get("next_items_page") or {}

            batch = page_data.get("items") or []
            items.extend(batch)
            print(f"    Page {page_num}: {len(batch)} items (total: {len(items)})")

            cursor = page_data.get("cursor")
            if not cursor or not batch:
                break

        # Phase 2: recuperer assets / subitems / updates par batch d'IDs
        if items:
            print(f"    Recuperation des details (assets/subitems/updates)...")
            updates = self.enrich_items_with_details(items, board_name)
        else:
            updates = []

        return items, updates

    def enrich_items_with_details(self, items: list, board_name: str) -> list:
        """Enrichit les items avec assets/subitems/updates par batch."""
        updates = []
        batch_size = 10  # Petit batch pour eviter le rate limit

        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            ids = [it["id"] for it in batch]

            q = """
            query ($ids: [ID!]!) {
              items(ids: $ids) {
                id
                assets { id name public_url file_extension file_size }
                subitems {
                  id name state created_at
                  column_values { id type text value }
                  assets { id name public_url file_extension file_size }
                }
                updates (limit: 50) {
                  id body text_body created_at
                  creator { id name email }
                  assets { id name public_url file_extension file_size }
                  replies { id body text_body created_at creator { id name } }
                }
              }
            }
            """
            time.sleep(REQUEST_DELAY)
            try:
                data = self.query(q, {"ids": ids})
            except Exception as e:
                self.log_error(f"Details batch {board_name} items {ids}", e)
                continue

            details_map = {str(d["id"]): d for d in (data.get("items") or [])}
            for it in batch:
                d = details_map.get(str(it["id"])) or {}
                it["assets"] = d.get("assets") or []
                it["subitems"] = d.get("subitems") or []
                it["updates"] = d.get("updates") or []
                for u in it["updates"]:
                    u["_item_id"] = it["id"]
                    u["_item_name"] = it["name"]
                    updates.append(u)

            if (i + batch_size) % 50 == 0 or i + batch_size >= len(items):
                print(f"      Details: {min(i + batch_size, len(items))}/{len(items)} items enrichis")

        return updates

    def download_asset(self, asset: dict, dest_dir: Path, item_id: str) -> bool:
        """Telecharge un fichier attache."""
        try:
            url = asset.get("public_url")
            if not url:
                return False
            filename = self.safe_name(asset.get("name") or f"file_{asset['id']}")
            ext = asset.get("file_extension") or ""
            if ext and not filename.endswith(f".{ext}"):
                filename = f"{filename}.{ext}"
            dest = dest_dir / f"{item_id}_{filename}"

            if dest.exists() and dest.stat().st_size == (asset.get("file_size") or 0):
                return True  # Deja telecharge

            r = self.session.get(url, stream=True, timeout=120)
            r.raise_for_status()
            total = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 64):
                    if chunk:
                        f.write(chunk)
                        total += len(chunk)
            self.stats["bytes_downloaded"] += total
            self.stats["files_downloaded"] += 1
            return True
        except Exception as e:
            self.log_error(f"Asset {asset.get('id')} / {asset.get('name')}", e)
            self.stats["files_failed"] += 1
            return False

    def export_items_to_csv(self, items: list, columns: list, dest: Path):
        """Export items en CSV lisible."""
        if not items:
            dest.write_text("", encoding="utf-8")
            return

        col_map = {c["id"]: c["title"] for c in columns}
        headers = ["item_id", "item_name", "group", "created_at", "updated_at", "state"]
        headers.extend([col_map.get(c["id"], c["id"]) for c in columns])

        with open(dest, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(headers)
            for it in items:
                row = [
                    it.get("id", ""),
                    it.get("name", ""),
                    (it.get("group") or {}).get("title", ""),
                    it.get("created_at", ""),
                    it.get("updated_at", ""),
                    it.get("state", ""),
                ]
                cv_map = {cv["id"]: cv.get("text") or "" for cv in (it.get("column_values") or [])}
                for c in columns:
                    row.append(cv_map.get(c["id"], ""))
                w.writerow(row)

    def backup_board(self, board: dict, workspace_dir: Path):
        """Backup complet d'un board."""
        board_id = board["id"]
        board_name = self.safe_name(board["name"])
        board_dir = workspace_dir / f"{board_name}_{board_id}"
        files_dir = board_dir / "files"
        board_dir.mkdir(parents=True, exist_ok=True)
        files_dir.mkdir(exist_ok=True)

        items_count = board.get("items_count") or 0
        print(f"\nBoard: {board['name']} (id={board_id}, items prevus={items_count})")

        # Metadata board
        (board_dir / "board.json").write_text(
            json.dumps(board, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        # Skip les boards vides pour ne pas gaspiller le budget API
        if items_count == 0:
            print("  Board vide, on passe.")
            (board_dir / "items.json").write_text("[]", encoding="utf-8")
            (board_dir / "updates.json").write_text("[]", encoding="utf-8")
            (board_dir / "items.csv").write_text("", encoding="utf-8")
            return

        # Recuperer les items
        items, updates = self.get_items_for_board(board_id, board["name"])

        # Sauvegarder JSON complet
        (board_dir / "items.json").write_text(
            json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        (board_dir / "updates.json").write_text(
            json.dumps(updates, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        # Export CSV lisible
        self.export_items_to_csv(items, board.get("columns") or [], board_dir / "items.csv")

        # Stats
        self.stats["items"] += len(items)
        self.stats["updates"] += len(updates)
        subitems_count = sum(len(it.get("subitems") or []) for it in items)
        self.stats["subitems"] += subitems_count

        # Telecharger les fichiers
        assets_to_download = []
        for it in items:
            for a in (it.get("assets") or []):
                assets_to_download.append((a, it["id"]))
            for sub in (it.get("subitems") or []):
                for a in (sub.get("assets") or []):
                    assets_to_download.append((a, f"{it['id']}_sub_{sub['id']}"))
            for u in (it.get("updates") or []):
                for a in (u.get("assets") or []):
                    assets_to_download.append((a, f"{it['id']}_upd_{u['id']}"))

        if assets_to_download:
            print(f"  Telechargement de {len(assets_to_download)} fichiers...")
            for i, (asset, item_id) in enumerate(assets_to_download, 1):
                if i % 10 == 0:
                    print(f"    Progres: {i}/{len(assets_to_download)}")
                self.download_asset(asset, files_dir, item_id)

        print(f"  Board termine: {len(items)} items, {subitems_count} subitems, {len(updates)} updates")

    def run(self, filter_board_id: str = None):
        """Execute le backup complet."""
        print(f"Demarrage du backup Monday.com")
        print(f"Destination: {self.output_dir}")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Workspaces
        try:
            workspaces = self.get_workspaces()
            (self.output_dir / "workspaces.json").write_text(
                json.dumps(workspaces, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            ws_map = {str(w["id"]): w for w in workspaces}
        except Exception as e:
            self.log_error("Workspaces", e)
            ws_map = {}

        # Boards
        try:
            boards = self.get_boards()
        except Exception as e:
            self.log_error("Liste des boards", e)
            return

        if filter_board_id:
            boards = [b for b in boards if str(b["id"]) == str(filter_board_id)]
            print(f"Filtre applique: {len(boards)} board(s)")

        (self.output_dir / "boards.json").write_text(
            json.dumps(boards, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        self.stats["boards"] = len(boards)

        print(f"\n{len(boards)} boards a sauvegarder")

        for i, board in enumerate(boards, 1):
            print(f"\n[{i}/{len(boards)}]", end=" ")
            ws_id = str(board.get("workspace_id") or "no_workspace")
            ws_name = self.safe_name(
                (ws_map.get(ws_id) or {}).get("name") or f"workspace_{ws_id}"
            )
            workspace_dir = self.output_dir / ws_name
            try:
                self.backup_board(board, workspace_dir)
            except Exception as e:
                self.log_error(f"Board {board.get('name')} ({board.get('id')})", e)

        # Manifeste et log erreurs
        manifest = {
            "backup_date": datetime.now().isoformat(),
            "api_version": API_VERSION,
            "stats": self.stats,
            "errors_count": len(self.errors),
        }
        (self.output_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        if self.errors:
            (self.output_dir / "errors.log").write_text(
                "\n".join(self.errors), encoding="utf-8"
            )

        # Rapport final
        mb = self.stats["bytes_downloaded"] / (1024 * 1024)
        print("\n" + "=" * 60)
        print("BACKUP TERMINE")
        print("=" * 60)
        print(f"  Boards:       {self.stats['boards']}")
        print(f"  Items:        {self.stats['items']}")
        print(f"  Sous-items:   {self.stats['subitems']}")
        print(f"  Updates:      {self.stats['updates']}")
        print(f"  Fichiers OK:  {self.stats['files_downloaded']}")
        print(f"  Fichiers KO:  {self.stats['files_failed']}")
        print(f"  Volume:       {mb:.1f} Mo")
        print(f"  Erreurs:      {len(self.errors)}")
        print(f"\nDossier: {self.output_dir.absolute()}")
        if self.errors:
            print(f"Details erreurs: {self.output_dir / 'errors.log'}")


def main():
    ap = argparse.ArgumentParser(description="Backup complet Monday.com")
    ap.add_argument("--token", required=True, help="Token API Monday")
    ap.add_argument("--output", default=None, help="Dossier de destination")
    ap.add_argument("--board", default=None, help="ID d'un board specifique (optionnel)")
    args = ap.parse_args()

    if not args.output:
        args.output = f"backup_monday_{datetime.now().strftime('%Y-%m-%d_%H%M')}"

    backup = MondayBackup(args.token, Path(args.output))
    try:
        backup.run(filter_board_id=args.board)
    except KeyboardInterrupt:
        print("\n\nInterruption utilisateur. Backup partiel dans:", backup.output_dir)
        sys.exit(1)


if __name__ == "__main__":
    main()
