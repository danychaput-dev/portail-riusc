===== FILE: user_profile.md =====
---
name: User profile
description: Profil de Dany, propriétaire/dev principal du Portail RIUSC
type: user
originSessionId: 11ec3985-4419-4af8-95d6-82893ed7fa4d
---
Dany Chaput (chaputdany@gmail.com) travaille sur le Portail RIUSC — application Next.js 16/Supabase pour la Réserve d'Intervention d'Urgence en Sécurité Civile du Québec (~900 réservistes en prod).

Communique en français. Préfère des réponses concises et orientées action.

Stack qu'il manipule au quotidien : Next.js App Router, React 19, TypeScript, Supabase (PostgreSQL + Auth + Storage), n8n self-hosted, Twilio (via n8n), Anthropic API, Vercel.

===== FILE: project_working_tree_noise.md =====
---
name: Working tree noise portail-riusc
description: Le working tree portail-riusc montre systématiquement des centaines de fichiers modifiés qui sont en fait du bruit de fins de ligne
type: project
originSessionId: 11ec3985-4419-4af8-95d6-82893ed7fa4d
---
Sur `/sessions/festive-beautiful-brahmagupta/mnt/portail-riusc`, `git status` affiche typiquement 300+ fichiers modifiés avec un `git diff --shortstat` quasi-symétrique (ex: +83012/−83026).

**Why:** Le repo est édité depuis Windows et un environnement Unix en parallèle, les fins de ligne CRLF/LF bougent entre les deux. Ce n'est pas du vrai travail en cours.

**How to apply:** Ne pas interpréter un gros diff comme du travail non commité. Avant d'en tirer des conclusions, vérifier avec `git diff --stat` et regarder un fichier au hasard (`git diff <fichier>`) pour confirmer si c'est du fond ou du CRLF. Ne jamais proposer de commit "en masse" sans avoir vérifié.

===== FILE: project_cloudflare_n8n_validation.md =====
---
name: Cloudflare bloque workflow n8n validation-donnees
description: Le workflow n8n "RIUSC - validation-données" plante sur un managed challenge Cloudflare. À régler plus tard.
type: project
originSessionId: 11ec3985-4419-4af8-95d6-82893ed7fa4d
---
Le workflow n8n `RIUSC - validation-données` (schedule trigger hebdomadaire, lundi 8h) appelle `https://portail.riusc.ca/api/admin/validation-donnees?envoyer=true` mais se fait bloquer par un Cloudflare managed challenge (page "Just a moment...").

**Why:** L'endpoint n'a aucune auth (public). Cloudflare compense en challengant tous les bots, y compris n8n.

**How to apply:** Quand Dany reviendra sur le sujet, proposer :
- Solution A (rapide) : whitelister l'IP du VPS OVH (`dig +short n8n.aqbrs.ca`) dans Cloudflare → WAF → IP Access Rules → Allow
- Solution B (propre) : ajouter un `Authorization: Bearer $VALIDATION_CRON_SECRET` dans l'endpoint, ajouter le secret dans `.env.local` + Vercel, et configurer le HTTP Request node n8n avec ce header

L'endpoint est `app/api/admin/validation-donnees/route.ts` — seul GET `envoyer=true` déclenche l'envoi courriel à chaputdany@gmail.com + Esther.Lapointe@aqbrs.ca.

===== FILE: project_credit_impot_heures.md =====
---
name: Crédit d'impôt QC bénévoles — règles heures
description: Règles de qualification pour le crédit d'impôt Québec des bénévoles RIUSC — logique primaires/secondaires pour le rapport heures-benevoles
type: project
originSessionId: 11ec3985-4419-4af8-95d6-82893ed7fa4d
---
Règle du crédit d'impôt QC pour les bénévoles en recherche et sauvetage :

- **Plancher obligatoire** : ≥ 101h PRIMAIRES (temps sur site via QR scan). Pas négociable — pas de compensation possible via secondaires.
- **Total requis** : primaires + secondaires ≥ 200h
- **Secondaires = bonus** pour combler jusqu'à 200h quand primaires < 200h. Pas un minimum séparé.
- Si primaires ≥ 200h → 100% qualifié, secondaires inutiles pour le seuil.

**Éligibilité** : le crédit d'impôt QC ne s'applique **qu'aux bénévoles Recherche et Sauvetage et aux pompiers**. Les réservistes RIUSC « génériques » ne sont **pas éligibles** pour le moment. Ne PAS afficher le badge « Qualifié » à tout le monde — filtrer par groupe/qualification R&S ou pompier.

Mapping DB :
- Primaires = `pointages.duree_minutes` (sessions QR sur place)
- Secondaires = `trajets.duree_minutes` (déplacements aller/retour vers sites de bénévolat)
- Vue cumulée : `heures_benevoles_par_benevole` (sql/trajets.sql)

**Why:** Règle fiscale provinciale (crédit d'impôt 2025+ pour bénévoles SAR). Dany (trésorier AQBRS) veut un rapport par bénévole montrant sa progression vers la qualification.

**How to apply:**
- UI rapport fiscal : afficher 2 jauges indépendantes
  - Jauge 1 : Primaires / 101h (seuil obligatoire)
  - Jauge 2 : Total (P+S) / 200h (seuil global)
- PAS de jauge "Secondaires / 99h" — c'est trompeur, 99h n'est pas un minimum
- Statut qualifié = (primaires ≥ 101) AND (primaires + secondaires ≥ 200)
- Seul `statut = 'approuve'` compte dans le rapport final (les `complete` en attente d'approbation à montrer séparément)

===== FILE: reference_schema_db.md =====
---
name: Schéma DB Supabase — Portail RIUSC
description: Types de colonnes clés et relations des tables Portail RIUSC (source de vérité fournie par Dany le 2026-04-22)
type: reference
originSessionId: 11ec3985-4419-4af8-95d6-82893ed7fa4d
---
**Localisation** : projet Supabase prod du Portail RIUSC. Voir `types/supabase.ts` dans le repo pour la version générée automatiquement.

**Points clés à retenir** (pour ne pas se tromper dans les FK SQL) :

### Identifiants des entités principales
- `reservistes.id` : **int8 (bigint) Identity** — PK auto-incrémenté
- `reservistes.benevole_id` : **TEXT Unique** — c'est l'identifiant métier utilisé partout comme FK dans les autres tables. PAS la PK mais la « clé métier ».
- `reservistes.user_id` : uuid Unique — lien vers `auth.users.id`

### Enums Postgres custom à connaître
- `presence_status` sur `inscriptions_camps.presence` → cast obligatoire `::presence_status` dans les UPDATE
- `sync_status` sur `inscriptions_camps.sync_status`

### Tables qui ont un `benevole_id` (TEXT, FK vers reservistes.benevole_id)
reservistes, inscriptions_camps, inscriptions_camps_logs, rappels_camps, pointages, pointage_sessions (cree_par, approuveur_id), pointage_logs, assignations, ciblages, disponibilites, disponibilites_v2, dossier_reserviste, formations_benevoles, groupes_recherche_responsables, lms_progression, message_reactions, messages, notes_reservistes, reserviste_etat, reserviste_langues, reserviste_organisations, trajets, courriel_reponses, courriels, reservistes_suppressions

### Tables avec audit / soft-delete
- `audit_log` : journal générique, une ligne par champ modifié (UPDATE). Attaché via `audit_attach_table('nom_table', 'colonne_pk')`.
- `reservistes` : colonnes `deleted_at`, `deleted_reason`, `deleted_by_user_id` (soft-delete)
- `formations_benevoles` : mêmes colonnes soft-delete + table `formations_benevoles_audit`
- `reservistes_suppressions` : archivage complet pour hard-delete (loi 25)
- `retraits_temporaires` : retrait temporaire avec historique

### Inscriptions camps / rappels SMS
- `inscriptions_camps.session_id` : TEXT (format `CAMP_XXX_YYY` ou ancien id Monday numérique)
- `inscriptions_camps.telephone` : TEXT Nullable — format variable (parfois 10 digits `5145551234`, parfois 11 `15145551234`, parfois avec `+1`)
- `rappels_camps.session_id` : TEXT — doit matcher `inscriptions_camps.session_id`
- `rappels_camps.inscription_id` : uuid Nullable — FK vers inscriptions_camps.id
- `rappels_camps.telephone` : TEXT — toujours en E.164 `+1XXXXXXXXXX`
- `rappels_camps.reponse`, `reponse_confirmee`, `reponse_at` : alimentés par le webhook `/api/webhooks/twilio-reponse` OU par scripts SQL manuels
- `rappels_camps.twilio_message_sid` : optionnel, pour lier au message Twilio

### Heures bénévolat (crédit impôt QC)
- `pointages.duree_minutes` : colonne calculée STORED (`depart - arrivee`). Change automatiquement quand admin édite les heures.
- `trajets.duree_minutes` : idem
- Vue `heures_benevoles_par_benevole` (dans sql/eligibilite-credit-impot.sql) agrège les deux avec flag `eligible_credit_impot` (basé sur `organisations.eligible_credit_impot`)
- AQBRS et « Pompiers volontaires » ont `eligible_credit_impot = true`

### Ciblage / déploiements
- `ciblages.niveau` : TEXT, valeurs 'deploiement' (et d'autres niveaux historiques)
- `ciblages.reference_id` : uuid — id du déploiement quand niveau='deploiement'
- `ciblages.statut` : TEXT — 'cible', 'notifie', 'mobilise', 'retire', etc.
- `deployments.id` : uuid — PK
- `deployments_demandes` : pivot N-N deployments ↔ demandes

### Courriels sortants
- `courriels` : 1 ligne par courriel envoyé à 1 destinataire (multi-destinataires = plusieurs rows)
- `courriel_campagnes` : 1 ligne par campagne (groupe de courriels)
- `courriel_reponses` : inbound replies via webhook Resend + replies admin (statut='sortant')
- `courriel_events` : opens/clics Resend tracking

### Pointage QR (présences)
- `pointage_sessions` : 1 QR = 1 session (camp ou déploiement, peut avoir shift et date_shift)
- `pointages` : 1 ligne par scan de réserviste. Peut avoir plusieurs par (benevole_id, session_id) si rescan.
- `pointage_logs` : audit des modifs d'un pointage

### Groupes & orgas
- `organisations` : partenaires (AQBRS = id `bb948f22-a29e-42db-bdd9-aabab8a95abd`, Pompiers volontaires)
  - colonne `eligible_credit_impot BOOLEAN`
- `groupes_recherche` : groupes R&S (district + nom)
- `groupes_recherche_responsables` : N-N benevole_id ↔ groupe_id, avec `recoit_cc_courriels`

### Valeurs possibles de `reservistes.groupe`
'Approuvé', 'Intérêt', 'Partenaires', 'Partenaires RS', 'Retrait temporaire', 'Formation incomplète'
(Configuré dans `GROUPES_OPTIONS` dans `app/admin/reservistes/page.tsx`)

===== FILE: project_etat_workstation_handoff.md =====
---
name: État pour transition workstation — 2026-04-22
description: Résumé de la session du 22 avril pour reprendre sur la workstation — ce qui est en DB, ce qui a été pushé, ce qui reste à faire
type: project
originSessionId: 11ec3985-4419-4af8-95d6-82893ed7fa4d
---
Dany a travaillé sur son portable et doit continuer sur sa workstation. Au moment de la transition :

## 🔑 Ce qui a été fait aujourd'hui (2026-04-22)

### 1. Fix RLS critique — `rappels_camps`
La page `/admin/inscriptions-camps` (colonne Rappel SMS) retournait toujours vide en prod. Cause : policies SELECT/UPDATE/INSERT oubliaient le rôle **`superadmin`**. Fix appliqué en SQL direct dans Supabase prod (pas dans un fichier du repo — voir `sql/fix-security-advisor.sql` qui n'inclut toujours pas `superadmin`).

**Why:** Le rôle superadmin a été créé après les policies de `fix-security-advisor.sql`, jamais rétro-ajouté.

**How to apply:** Pour toute nouvelle RLS policy qui check `role IN (...)`, TOUJOURS inclure `'superadmin'` dans la liste. Probablement à faire sur **d'autres tables** (le script de diag était prêt mais pas exécuté) :
```sql
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE (qual::text LIKE '%role%' OR with_check::text LIKE '%role%')
  AND qual::text NOT LIKE '%superadmin%'
  AND with_check::text NOT LIKE '%superadmin%';
```

### 2. Source unique du téléphone — `reservistes.telephone`
Refactor : `inscriptions_camps.telephone` est maintenant ignoré dans le code. On prend toujours `reservistes.telephone` via join sur `benevole_id`.

**Why:** Dany a trouvé Laurie Simard marquée « sans téléphone » alors que son tel était dans son dossier — cause de la redondance. Son verdict : « un seul numéro de téléphone peu importe où on l'affiche, point barre ».

**How to apply:**
- `/api/camp/rappel-sms/route.ts` : charge reservistes + utilise r.telephone
- `/admin/inscriptions-camps/page.tsx` : remplace `row.telephone` par `res?.telephone` dans le mapping flat
- Ne plus utiliser `inscriptions_camps.telephone` nulle part (la colonne existe toujours mais obsolète)

### 3. Nouvelles features UI inscriptions-camps
- Menu contextuel **⋮ kebab** par ligne (remplace la flèche `→` qui bugguait) avec : 👤 Voir profil · 🎭 Emprunt d'identité · ⛺ Changer de camp
- **Colonnes triables** : Nom, Présence, Inscrit le, District, Rappel SMS
- **Shift+clic** sur les checkboxes pour sélection multi
- Mailto sur la colonne courriel → ouvre `ModalComposeCourriel` (plus de `mailto:`)
- Filtre dropdown SMS : Tous / Sans rappel / Envoyé pas répondu / A répondu
- Envoi SMS respecte la sélection : si sélection active, n'envoie qu'aux cochés (vs tous les confirmé/incertain)
- Sidebar camps réductible sur desktop (◀/☰ persistant via localStorage)

### 4. Colonne « Rappel SMS » dans le tableau
Badge par inscrit : 📤 Envoyé / ✅ OUI / ❌ NON / ❓ Autre. Se rafraîchit via bouton « 🔄 Réponses » ou au changement de camp.

### 5. Récupération manuelle des réponses SMS d'aujourd'hui
72 rappels envoyés ce matin via /api/camp/rappel-sms. Le webhook ne mettait pas à jour `rappels_camps` à cause du RLS → réponses traitées manuellement via scripts SQL en parsant les logs Twilio :
- 53 avec réponse enregistrée (50 via CSV 9h40 + nos scripts, +3 via webhook après fix RLS)
- 19 sans réponse → à relancer

**Ambigu à traiter manuellement** : +14185440349 (Gaetan Laflamme) a envoyé « Oui » puis « Impossible d'y être Non » — a été mis à `confirme` par défaut, à valider avec lui.

## 📦 État du repo git

**Pushé sur main** : fix RLS (SQL direct en DB pas dans repo), refactor téléphone unique, menu kebab, tri, shift-clic, filtre SMS, envoi SMS ciblé, sidebar réductible, colonne Rappel SMS.

**Peut-être pas pushé** (à vérifier sur workstation via `git log origin/main..HEAD`) :
- Les derniers commits autour du menu kebab + sélection multi SMS + source unique tel
- Le `sql/recupere-rappels-chicoutimi-2026-04-21.sql` (script de récupération d'aujourd'hui)

**À NE PAS COMMITTER** (bruit CRLF/LF Windows) : tous les `.md`, `.tsx`, `.ts` qui apparaissent modifiés mais sans diff réel. Déjà documenté dans `project_working_tree_noise.md`.

## 🚀 Sur la workstation — premières actions

```powershell
cd ~/Documents/GitHub/portail-riusc
git fetch origin
git pull origin main   # récupérer ce qui a été pushé du portable
git status --short     # voir ce qui reste en local non pushé (bruit CRLF ou vrais fichiers)
git log origin/main..HEAD --oneline   # commits locaux pas pushés (il ne devrait pas y en avoir si tout est sync)
```

Si tout est clean → continuer normalement.

## 📋 TODO restant quand la workstation sera prête

1. **Relancer les 19 sans réponse** de Cohorte 9 Chicoutimi via le nouveau flow (filtre SMS « Envoyé pas répondu » → Shift+clic → 📱 Envoyer SMS (19))
2. **Audit des RLS superadmin** sur autres tables (script diag dans ma memoire)
3. **Phase 2 trajets** : admin peut éditer/approuver trajets, alertes cron
4. **Rotation clé `SUPABASE_SERVICE_ROLE_KEY`** (flag Vercel "Need to Rotate") — pas urgent
5. **Nettoyage `inscriptions_camps.telephone`** : à terme, DROP COLUMN ou au moins arrêt d'insertion

===== FILE: MEMORY.md =====
- [User profile](user_profile.md) — Dany travaille sur le Portail RIUSC, communique en français
- [Working tree noise](project_working_tree_noise.md) — le diff massif sur portail-riusc est du bruit CRLF/LF, pas du vrai changement
- [Cloudflare bloque n8n validation](project_cloudflare_n8n_validation.md) — workflow validation-donnees bloqué par CF, à régler (whitelist IP ou bearer token)
- [Crédit impôt QC — règles heures](project_credit_impot_heures.md) — 101h primaires obligatoire + total ≥ 200h (secondaires = complément, pas un min)
- [Schéma DB Portail RIUSC](reference_schema_db.md) — types clés, enums custom, relations entre tables (fourni par Dany 2026-04-22)
- [État transition workstation 2026-04-22](project_etat_workstation_handoff.md) — résumé session portable → reprise sur workstation (TODO : 19 SMS à relancer, audit RLS superadmin)

