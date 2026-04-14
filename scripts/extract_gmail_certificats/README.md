# Extraction des certificats depuis Gmail Esther

Extrait tous les courriels avec pièces jointes envoyés par les réservistes à Esther Lapointe (esther.lapointe@aqbrs.ca) pour soumettre leur certificat de formation.

## Setup (une seule fois)

1. Vérifier que `credentials.json` est présent dans ce dossier (OAuth Desktop App, projet riusc-portail).
2. Installer les dépendances (depuis la racine du repo):

   ```bash
   npm install googleapis @supabase/supabase-js dotenv
   ```

   Note: `googleapis` est un gros paquet; c'est normal.

## Utilisation

### Dry run (liste + match Supabase, pas de téléchargement)

```bash
node scripts/extract_gmail_certificats/extract.mjs
```

### Exécution complète (téléchargement + CSV)

```bash
node scripts/extract_gmail_certificats/extract.mjs --execute
```

Au premier run, un navigateur s'ouvre pour le consentement OAuth. Se connecter avec **esther.lapointe@aqbrs.ca**. Le `token.json` est ensuite sauvegardé localement et réutilisé.

### Options

- `--execute` : télécharge les pièces jointes (sinon dry run)
- `--limit=N` : limite à N threads (pour tester)
- `--query="..."` : surcharge la requête Gmail par défaut

## Sortie

- `files/{sender_slug}_{message_id}_{filename}` : pièces jointes téléchargées
- `rapport.csv` : une ligne par pièce jointe avec thread_id, message_id, date, expéditeur, match Supabase (benevole_id, prenom, nom), nom du fichier, taille, chemin local

## Sécurité

Les fichiers `credentials.json`, `token.json` et `files/` sont dans `.gitignore`. Ne jamais les commiter.
