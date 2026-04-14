# Portail RIUSC — Documentation Architecture

> Réserve d'Intervention d'Urgence en Sécurité Civile du Québec

## Vue d'ensemble

Application web pour gérer les réservistes bénévoles en sécurité civile : disponibilités, certifications, déploiements d'urgence et coordination avec les organismes partenaires. ~900+ réservistes actifs en production.

## Stack technique

- **Frontend** : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Base de données** : Supabase (PostgreSQL + Auth + Storage)
- **Automatisation** : n8n (self-hosted sur `n8n.aqbrs.ca`, VPS OVH)
- **SMS** : Twilio (via n8n)
- **IA** : Anthropic API (suggestions de rotation)
- **Géocodage** : Mapbox
- **Hébergement** : Vercel (frontend), OVH VPS (n8n)

## Rôles et permissions

| Rôle | Accès |
|------|-------|
| `admin` | Tout : gestion sinistres, déploiements, ciblage, certificats, impersonation |
| `coordonnateur` | Opérations, gestion réservistes, ciblage |
| `adjoint` | Accès limité coordonnateur, export réservistes |
| `reserviste` | Son profil, disponibilités, formations, communauté |
| `partenaire` | Lecture seule : demandes et déploiements de son organisme |

Le rôle est stocké dans `reservistes.role`. La logique est dans `utils/role.ts` (`getCurrentRole()`, `isAdmin()`, `isAdminOrCoord()`).

## Structure du projet

```
app/
├── admin/
│   ├── certificats/          # Validation des certificats soumis
│   ├── ciblage/              # Ciblage avancé de réservistes
│   ├── inscriptions-camps/   # Gestion inscriptions aux camps
│   ├── operations/           # Wizard 8 étapes (sinistre → mobilisation)
│   ├── reservistes/          # Liste réservistes (filtres, export CSV)
│   ├── sinistres/            # Gestion des sinistres
│   ├── utilisateurs/         # Gestion utilisateurs
│   └── page.tsx              # Dashboard admin
├── api/
│   ├── admin/                # Endpoints admin (reservistes, antecedents, bottes, ciblage)
│   ├── audit/                # Logging visites de pages
│   ├── camp/                 # Annulation et rappels SMS camps
│   ├── certificat/           # Upload/suppression certificats
│   ├── disponibilites/       # Confirmation/annulation disponibilités
│   ├── dashboard/stats/      # Statistiques dashboard
│   ├── operations/rotation-ia/ # Suggestions rotation via Anthropic
│   ├── geocode/              # Proxy Mapbox
│   ├── impersonate/          # Impersonation admin
│   ├── lms/                  # Proxy LMS formations en ligne
│   └── webhooks/twilio-reponse/ # Réponses SMS entrantes
├── communaute/               # Messages et réactions communautaires
├── dashboard/                # Dashboard public avec statistiques
├── deploiement/taches/       # 11 tâches SOPFEU/Croix-Rouge détaillées
├── disponibilites/           # Soumission et gestion disponibilités
├── dossier/                  # Dossier du réserviste
├── formation/                # Certifications et formations
├── formations-en-ligne/      # LMS intégré
├── inscription/              # Auto-inscription réserviste
├── login/                    # Connexion OAuth
├── missions/                 # Listings de missions
├── partenaire/               # Portail partenaire (lecture seule)
├── profil/                   # Profil détaillé (100+ champs)
├── stats/                    # Statistiques admin
├── tournee-camps/            # Inscription aux camps
├── components/               # Composants réutilisables
│   ├── ui/                   # Bibliothèque UI de base
│   │   ├── index.ts          # Barrel export
│   │   ├── StatusBadge.tsx   # Badge coloré selon statut (groupe, antécédents, etc.)
│   │   ├── Button.tsx        # Bouton avec variantes, loading, icônes
│   │   ├── Card.tsx          # Carte conteneur + SectionTitle
│   │   └── FormInput.tsx     # FormInput, FormSelect, FormTextarea
│   ├── PortailHeader.tsx     # En-tête avec menu, indicateurs statut
│   ├── CampInfoBlocs.tsx     # Blocs info camp (réutilisé sur 3 pages)
│   ├── GuidedTour.tsx        # Visite guidée Shepherd.js
│   ├── ImageCropper.tsx      # Upload/crop photo
│   ├── ImpersonateBanner.tsx # Bandeau impersonation
│   ├── ImpersonateModal.tsx  # Modal impersonation
│   └── ModalConfirmationCompetence.tsx
├── layout.tsx                # Layout racine
└── page.tsx                  # Page d'accueil (dashboard réserviste)

types/
├── index.ts                  # Types centralisés (Reserviste, Sinistre, etc.)
└── constants.ts              # Constantes métier (TYPES_INCIDENT, ORGANISMES, etc.)

hooks/
├── index.ts                  # Barrel export
├── useAsync.ts               # useAsync() + useAction() — gestion loading/error
└── useSupabaseQuery.ts       # useSupabaseQuery() + resolveStorageUrl()

utils/
├── supabase/client.ts        # Instance Supabase côté client
├── supabase/server.ts        # Instance Supabase côté serveur
├── competenceCertificatConfig.ts # Mapping compétence → certificat
├── competenceConfirmation.ts # Logique confirmation compétences
├── demoMode.ts               # Mode démo et données fictives
├── logEvent.ts               # Logging événements
├── n8n.ts                    # n8nUrl() — helper URLs webhooks
├── phone.ts                  # Formatage téléphone
├── role.ts                   # Contrôle d'accès par rôle
└── useAuth.ts                # Hook auth (normal + impersonation)

sql/                          # Scripts SQL (audit, RLS, requêtes)
n8n-workflows/                # Définitions workflows n8n (JSON)
```

## Concepts métier clés

### Statuts réserviste

- **Groupe** : `Intérêt` (en attente) → `Approuvé` (validé)
- **Statut** : `Actif`, `Inactif`, `Suspendu`
- **Antécédents** : `verifie`, `en_attente`, `refuse` (vérification criminelle)
- **Remboursement bottes** : date de remboursement trackée

### Workflow de déploiement (8 étapes)

Page `/admin/operations` — wizard séquentiel :

1. **Sinistre** — Créer/sélectionner un sinistre (inondation, incendie, tempête, etc.)
2. **Demandes** — Ajouter les demandes des organismes partenaires (SOPFEU, Croix-Rouge, municipalité)
3. **Déploiement** — Créer le plan (lieu, dates, personnes par vague)
4. **Ciblage** — Sélectionner les réservistes selon filtres (groupe, antécédents, bottes, région)
5. **Notification** — Envoyer via n8n → SMS + courriel aux ciblés
6. **Disponibilités** — Les réservistes soumettent via `/disponibilites/soumettre`
7. **Rotation** — IA (Anthropic) suggère les rotations optimales
8. **Mobilisation** — Envoyer confirmations via n8n → SMS + courriel

### Mapping compétence → certificat

Défini dans `utils/competenceCertificatConfig.ts`. Quand un réserviste met à jour son profil :

- **SATP Drone** → 1 certificat (validité 24 mois)
- **SCI/ICS 100/200/300/400** → 1 certificat par niveau
- **Premiers soins** → 1 certificat (validité 36 mois)
- **Navigation maritime** → 1 certificat (validité 60 mois)

L'admin approuve via `/api/admin/approuver-formation`.

### Camps

- Inscription via `/tournee-camps`
- Rappels SMS via `/api/camp/rappel-sms` → n8n → Twilio
- Annulation via `/api/camp/cancel` → webhook n8n

## Intégrations n8n

Base URL : `NEXT_PUBLIC_N8N_BASE_URL` (prod: `https://n8n.aqbrs.ca`)
Helper : `n8nUrl(path)` dans `utils/n8n.ts`

| Webhook | Fonction |
|---------|----------|
| `/webhook/riusc-envoi-ciblage-portail` | Notification ciblage → SMS + courriel |
| `/webhook/riusc-envoi-mobilisation-portail` | Confirmation mobilisation → SMS + courriel |
| `/webhook/riusc-rappel-camp` | Rappels SMS camp → Twilio |
| `/webhook/camp-status` | Annulation inscription camp |
| `/webhook/alerte-reponse-sms` | Alertes réponses SMS non-standard |

## Tables Supabase (33 tables, RLS activé sur toutes)

### Entités principales

- `reservistes` — Réservistes (benevole_id, user_id, role, prenom, nom, email, groupe, statut)
- `sinistres` — Sinistres (nom, type_incident, lieu, date_debut, statut)
- `demandes` — Demandes des organismes partenaires
- `deployments` — Plans de déploiement
- `deploiements_actifs` — Vue déploiements actifs
- `vagues` — Rotations/vagues d'un déploiement

### Disponibilités et ciblage

- `disponibilites_v2` — Soumissions de disponibilité (benevole_id, deployment_id, date_jour, disponible, a_confirmer)
- `ciblages` — Réservistes ciblés pour un déploiement (statut: notifie/non_notifie)
- `assignations` — Assignations aux vagues

### Formations et camps

- `formations_benevoles` — Certifications (nom, catalogue, resultat, date_reussite, date_expiration, certificat_url)
- `inscriptions_camps` — Inscriptions aux camps
- `inscriptions_camps_logs` — Logs d'inscriptions
- `rappels_camps` — Rappels SMS envoyés

### Communauté

- `messages` — Posts communautaires (canal: general/prive)
- `message_reactions` — Réactions aux messages
- `community_last_seen` — Dernier passage dans la communauté

### Audit et logs

- `audit_connexions` — Connexions utilisateurs
- `audit_pages` — Visites de pages
- `auth_logs` — Logs d'authentification
- `agent_logs` — Logs agents IA

### Référentiels

- `organisations` — Organismes partenaires
- `langues` — Langues parlées
- `municipalites_qc` — Municipalités du Québec (lecture publique pour inscription)
- `reserviste_langues` — Table pivot réserviste ↔ langues
- `reserviste_organisations` — Table pivot réserviste ↔ organisations
- `reserviste_etat` — État du réserviste
- `dossier_reserviste` — Dossier complet
- `documents_officiels` — Documents officiels

### LMS

- `lms_modules` — Modules de formation en ligne
- `lms_progression` — Progression des réservistes

## Variables d'environnement

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Intégrations
NEXT_PUBLIC_N8N_BASE_URL=https://n8n.aqbrs.ca
NEXT_PUBLIC_TWILIO_PHONE=+14388033137
NEXT_PUBLIC_MAPBOX_TOKEN=pk...
ANTHROPIC_API_KEY=sk-ant-...

# Optionnel
NEXT_PUBLIC_MAINTENANCE=true  # Active la page maintenance
```

Toutes les clés sont dans `.env.local` (dev) et Vercel (prod). Plus aucune clé hardcodée dans le code (nettoyé avril 2026).

## Authentification

- **Provider** : Supabase Auth (OAuth)
- **Matching** : `auth.users.id` → `reservistes.user_id`
- **Middleware** (`middleware.ts`) : vérifie maintenance mode, log les visites de pages
- **Impersonation** : admin peut prendre l'identité d'un réserviste via cookie (`/api/impersonate`)
- **Hook** : `useAuth.ts` gère auth normale + impersonation + mode debug

## Valeurs hardcodées à connaître

### Organismes partenaires
SOPFEU, Croix-Rouge, Municipalité, Gouvernement du Québec, Autre

### Types d'incident
Inondation, Incendie, Glissement, Vague de froid, Vague de chaleur, Tempête, Accident industriel, Recherche & sauvetage, Vérification bien-être, Évacuation, Autre

### Tâches de déploiement (11)
Page `/deploiement/taches` — détails complets avec protocoles sécurité, ÉPI requis et formations nécessaires pour les tâches SOPFEU (digues, ébranchage, débris, reconnaissance) et Croix-Rouge (centre de services, hébergement, distribution, soutien psychosocial, inscription).

### Données Monday.com (legacy)
`/admin/certificats/page.tsx` contient 101+ entrées hardcodées (noms, courriels, URLs certificats) provenant de l'ancien système Monday.com. À migrer vers Supabase éventuellement.

### ID organisation AQBRS
`bb948f22-a29e-42db-bdd9-aabab8a95abd`

## Audit log + Soft-delete (avril 2026)

### Journal d'audit générique (`audit_log`)

Trigger Postgres `audit_capture()` capture automatiquement chaque INSERT/UPDATE/DELETE sur les tables surveillées. Une ligne par champ modifié pour les UPDATE. L'auteur est récupéré via `auth.uid()` (UI) ou via les variables de session `app.acting_user_id` / `app.acting_email` (API service_role).

- **Brancher sur une table** : `select audit_attach_table('nom_table', 'colonne_pk');`
- **Tables actuellement branchées** : `reservistes` (PK `benevole_id`)
- **API route service_role** : appeler `setActingUser(supabaseAdmin, user.id, user.email)` (`utils/audit.ts`) AVANT chaque mutation pour tracer l'auteur.
- **Rétention** : 6 mois via `audit_purge_old(p_months int default 6)` (purge manuelle, pas de cron auto).

### Soft-delete des réservistes

La table `reservistes` a 3 colonnes `deleted_at`, `deleted_reason`, `deleted_by_user_id`. Les réservistes "supprimés" via `/api/admin/reservistes/delete` sont en réalité marqués `deleted_at = now()` mais leurs données enfants (formations, disponibilités, etc.) sont conservées.

- **Vue `reservistes_actifs`** : utiliser cette vue dans toutes les requêtes qui doivent **exclure** la corbeille. La table brute `reservistes` reste utilisée pour : la corbeille, la restauration, la purge définitive, le delete soft-delete.
- **Page corbeille** : `/admin/corbeille` (superadmin) — bouton Restaurer + bouton Purger définitivement.
- **Restaurer** : `POST /api/admin/reservistes/restore` `{ benevole_id }`.
- **Purger définitivement (loi 25)** : `POST /api/admin/reservistes/hard-delete` `{ benevole_id, raison_purge, confirmation_nom }` — supprime cascade enfants + audit_log.

⚠️ **Migration progressive** : seules les requêtes les plus visibles utilisent `reservistes_actifs` (liste admin, dashboard stats, ciblage). Les autres pages voient encore les soft-deleted comme actifs. À migrer au fil de l'eau. La RPC `get_pool_ciblage` query directement `reservistes` et doit aussi être mise à jour.

## Sécurité (audit avril 2026)

- **RLS** : 33/33 tables avec Row Level Security activé
- **Faille corrigée** : `anon` ne peut plus lire `formations_benevoles`
- **10 policies doublons** nettoyées
- **Secrets** : toutes les clés API externalisées dans `.env.local` / Vercel
- **Principe** : utilisateur voit ses propres données, admin voit tout, service_role pour les écritures automatisées

## Points d'amélioration identifiés

1. ~~Audit RLS complet~~ ✅ (avril 2026)
2. ~~Documentation architecture~~ ✅ (ce fichier)
3. **Composants réutilisables** — Fichiers pages massifs (700+ lignes). Extraire boutons, modals, cartes, badges dans `/components`
4. **Séparation données/UI** — Requêtes Supabase dans `lib/` ou `hooks/` dédiés
5. **Tests** — Zéro test actuellement. Priorité : API routes admin
6. **Migrations SQL versionnées** — Dossier `supabase/migrations/` pour recréer la structure
7. **Interface création de camp** — Actuellement fait via SQL direct
8. **Migration données Monday.com** — 101 entrées certificats hardcodées à migrer en DB
9. **Nettoyage fichiers backup** — page - Dossier.tsx, page - soumettre.tsx, page - disponibilites.tsx
