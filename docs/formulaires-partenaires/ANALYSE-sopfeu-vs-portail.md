# Analyse — Formulaire de mobilisation SOPFEU vs Portail RIUSC

> Fichier source : `sopfeu-mobilisation-reservistes_2026-04.xlsx`
> Schéma DB de référence : live Supabase (2026-04-24)
> Objectif : identifier quels champs du formulaire existent déjà dans le portail, lesquels sont partiellement capturés, lesquels manquent complètement — pour planifier l'intégration (upload/parsing demande + génération auto de la réponse effectifs).

Légende :
- `✓` présent dans le schéma, utilisable tel quel
- `⚠` partiel : existe mais forme différente (texte libre au lieu de structuré, champ global au lieu de par-rôle, etc.)
- `✗` absent : doit être ajouté si on veut le stocker

---

## Onglet 1 — Formulaire de mobilisation (SOPFEU → AQBRS)

### En-tête

| Champ SOPFEU | État | Mapping DB | Notes |
|---|---|---|---|
| Numéro d'intervention SOPFEU | ⚠ | `demandes.identifiant` (libre) ou `demandes.monday_id` | Aucune colonne dédiée « numero_externe_sopfeu ». Recyclage de `identifiant` pénalise la lisibilité — mieux ajouter `demandes.numero_partenaire` |
| Lieu de l'intervention | ✓ | `sinistres.lieu` + `demandes.lieu` | Doublon délibéré (le sinistre englobe plusieurs demandes) |
| Nature de la demande | ⚠ | `demandes.type_mission` (enum `TYPES_MISSION.SOPFEU`) | Les 4 valeurs actuelles (digues/débris/logistique/support) sont orientées tâche, pas « nature ». Nature SOPFEU est plus fine (ex : « renfort abattage post-tempête »). Préciser via `type_mission_detail` (texte libre) ou ajouter colonne `nature` |
| Contact SOPFEU (CPO) — Prénom | ⚠ | `demandes.contact_nom` | Un seul champ « nom » combine prénom + nom. Pour renvoyer proprement sur l'onglet 2, séparer en `contact_prenom` + `contact_nom_famille` |
| Contact SOPFEU — Nom | ⚠ | `demandes.contact_nom` | idem |
| Contact SOPFEU — Fonction | ✓ | `demandes.contact_titre` | |
| Contact SOPFEU — Téléphone 1 | ✓ | `demandes.contact_telephone` | |
| Contact SOPFEU — Téléphone 2 | ✗ | — | Ajouter `demandes.contact_telephone_2` |
| Contact SOPFEU — Courriel | ✓ | `demandes.contact_email` | |

### Section 1 — Mandat opérationnel

| Champ SOPFEU | État | Mapping DB | Notes |
|---|---|---|---|
| Description de l'événement | ✓ | `demandes.description` + `sinistres.type_incident` | Mixte texte libre + enum |
| Évolution attendue | ✗ | — | Ajouter `demandes.evolution_attendue` (text) |
| Au profit de qui (municipalité XY) | ✗ | — | Ajouter `demandes.beneficiaire` (text) ou lier à `municipalites_qc` |
| Principales tâches | ⚠ | `demandes.type_mission_detail` + `demandes.description` | Texte libre dilué. Pas de liste structurée. Ajouter `demandes.taches[]` si on veut des checkboxes |
| Autres précisions (mandat) | ⚠ | `demandes.description` | Fourre-tout |

### Section 2 — Conditions opérationnelles

Section entièrement absente du schéma actuel. Aucun champ ne capte la météo, les horaires, les risques SST ou la charge mentale.

| Champ SOPFEU | État | Mapping DB | Notes |
|---|---|---|---|
| Météorologie des jours à venir | ✗ | — | Ajouter `demandes.meteo_prevue` (text) |
| Amplitudes horaires périodes de travail | ✗ | — | Ajouter `demandes.amplitudes_horaires` (text). Possibilité future : structurer en `deployments.heure_debut_shift` + `heure_fin_shift` |
| Enjeux de santé/sécurité | ✗ | — | Ajouter `demandes.enjeux_sst` (text). Recommandation : afficher en badge rouge dans ciblage / mobilisation |
| Charge mentale | ✗ | — | Ajouter `demandes.charge_mentale` (text). **Important** : impact psychosocial, à remonter aux réservistes ciblés avec mention explicite dans le courriel de notification |
| Autres précisions (conditions) | ✗ | — | Peut être fusionné avec un `demandes.notes_conditions` |

### Section 3 — Effectifs requis (tableau 4 rôles)

Le schéma actuel a **un seul** `demandes.nb_personnes_requis` (entier global) et `demandes.competences_requises[]` (array texte global). **Aucune décomposition par rôle**.

| Rôle SOPFEU | État actuel | Gap |
|---|---|---|
| Réserviste / Réserviste avancé | ⚠ tronc commun | Rôle implicite (défaut) |
| Spécialiste abattage | ✗ | Pas de colonne, pas de valeur définie dans `competences_sauvetage[]`. À confirmer avec Laurence SOPFEU |
| Spécialiste Manœuvre de force | ✗ | Idem |
| Chef d'équipe | ⚠ | `reservistes.responsable_groupe` (bool groupe R&S) ≠ chef d'équipe sur déploiement. `assignations.role` (text) peut stocker « Chef d'équipe » lors de l'assignation |
| Capacités par rôle (3 slots) | ✗ | `demandes.competences_requises[]` global seulement |

**Recommandation** : créer une table enfant `demandes_effectifs` :

```
demandes_effectifs (
  id uuid PK,
  demande_id uuid FK,
  role text CHECK (role IN ('reserviste', 'reserviste_avance', 'specialiste_abattage',
                             'specialiste_manoeuvre_force', 'chef_equipe')),
  nombre integer NOT NULL,
  capacites text[] DEFAULT '{}',
  autres_precisions text
)
```

Plus flexible que d'ajouter 4 paires de colonnes sur `demandes`, et survivra si SOPFEU ajoute un rôle (ex : « spécialiste drone »).

### Section 4 — Date, heure et lieu de rendez-vous

| Champ SOPFEU | État | Mapping DB | Notes |
|---|---|---|---|
| Durée minimale de dispo requise | ✗ | — | Actuellement déduite de `deployments.date_fin - date_debut`. Ajouter `deployments.duree_min_jours` (int) si SOPFEU exige un minimum plus serré |
| Date de RDV | ✓ | `deployments.date_debut` (date seule) | |
| Heure de RDV | ✗ | — | `date_debut` est un `date`, pas un `timestamptz`. Ajouter `deployments.heure_rdv` (time) ou changer le type |
| Lieu de RDV | ✓ | `deployments.point_rassemblement` | |
| Stationnement véhicules personnels | ✗ | — | Ajouter `deployments.stationnement` (text) |
| Contact sur site — Prénom | ✗ | — | Ajouter `deployments.contact_site_prenom` |
| Contact sur site — Nom | ✗ | — | Ajouter `deployments.contact_site_nom` |
| Contact sur site — Fonction | ✗ | — | `deployments.contact_site_fonction` |
| Contact sur site — Tél 1 | ✗ | — | `deployments.contact_site_tel_1` |
| Contact sur site — Tél 2 | ✗ | — | `deployments.contact_site_tel_2` |
| Contact sur site — Courriel | ✗ | — | `deployments.contact_site_courriel` |
| Autres précisions (RDV) | ✓ | `deployments.notes_logistique` | Fourre-tout |

Note : `assignations.contact_responsable` + `contact_telephone` existent mais c'est le contact par-assignation (ex : chef de vague spécifique à un sous-groupe), pas le contact global du site.

### Section 5 — Services et installations sur place

| Champ SOPFEU | État | Mapping DB | Notes |
|---|---|---|---|
| Modalités d'hébergement | ✓ | `deployments.hebergement` (text libre) | |
| Alimentation | ✗ | — | Ajouter `deployments.alimentation` (text) |
| Installations | ✗ | — | Ajouter `deployments.installations` (text ou array) |
| Connectivité | ✗ | — | Ajouter `deployments.connectivite` (text, ex : « Wi-Fi disponible zone admin ») |
| Autres précisions (services) | ✓ | `deployments.notes_logistique` | |

---

## Onglet 2 — Effectifs AQBRS (AQBRS → SOPFEU)

C'est notre **output** : une fois le déploiement mobilisé, on retourne à SOPFEU la liste des réservistes affectés.

### En-tête

| Champ | État | Mapping DB | Notes |
|---|---|---|---|
| Date de RDV | ✓ | `deployments.date_debut` | Repris de l'onglet 1 |
| Heure de RDV | ✗ | — | cf section 4 onglet 1 |
| Lieu de RDV | ✓ | `deployments.point_rassemblement` | |
| Contact AQBRS — Prénom/Nom/Fonction/Tél/Courriel | ⚠ | User admin connecté (`auth.users` + `reservistes`) ou `admin_email_config` | À décider : contact par défaut = l'admin qui exporte, ou configurable dans `app_config` |

### Tableau des réservistes (colonnes)

| Colonne formulaire | État | Mapping DB | Notes |
|---|---|---|---|
| Nom | ✓ | `reservistes.nom` | |
| Prénom | ✓ | `reservistes.prenom` | |
| Région | ✓ | `reservistes.region` | |
| **Sexe (M / F / autre)** | **✗** | — | **Colonne absente**. À ajouter `reservistes.sexe` CHECK IN ('M', 'F', 'autre', 'prefere_ne_pas_dire'). Utile aussi pour logistique hébergement (dortoir mixte ou séparé) |
| Fonction (réserviste ou chef d'équipe) | ⚠ | `assignations.role` (text libre) | Standardiser : `role IN ('reserviste', 'chef_equipe')`. `reservistes.responsable_groupe` est R&S, pas terrain |
| Spécialité | ⚠ | Concat de `competences_sauvetage[]`, `competences_securite[]`, `competence_rs[]`, etc. | Pas de champ unique « spécialité principale ». Règle à définir : prendre la 1re compétence matchant la demande SOPFEU, ou colonne dédiée `reservistes.specialite_principale` |
| Nombre de jours disponibles | ✓ | Calcul : COUNT(`disponibilites_v2.disponible=true`) ou `assignations.date_fin - date_debut` | Dépend d'où on se situe dans le workflow (avant mobilisation = dispos, après = assignation) |
| Allergies alimentaires | ✓ | `reservistes.allergies_alimentaires` + `allergies_autres` | |
| **Diète alimentaire** | **✗** | — | **Colonne absente**. À ajouter `reservistes.diete_alimentaire` (text ou enum : végétarien / végan / halal / casher / sans gluten / autre). Distinct des allergies (préférence vs contrainte médicale) |

---

## Récapitulatif des gaps

### Colonnes à ajouter — priorité HAUTE (bloque la génération onglet 2)

Sur `reservistes` :
- `sexe` text CHECK
- `diete_alimentaire` text

### Colonnes à ajouter — priorité MOYENNE (améliore l'onglet 1 reçu)

Sur `demandes` :
- `numero_partenaire` text (numéro SOPFEU)
- `contact_prenom` text + `contact_nom_famille` text (split de `contact_nom`)
- `contact_telephone_2` text
- `evolution_attendue` text
- `beneficiaire` text (ou FK `municipalites_qc`)
- `meteo_prevue` text
- `amplitudes_horaires` text
- `enjeux_sst` text
- `charge_mentale` text

Sur `deployments` :
- `heure_rdv` time (ou convertir `date_debut` en timestamptz)
- `duree_min_jours` int
- `stationnement` text
- `contact_site_prenom`, `contact_site_nom`, `contact_site_fonction`, `contact_site_tel_1`, `contact_site_tel_2`, `contact_site_courriel`
- `alimentation` text
- `installations` text
- `connectivite` text

### Nouvelle table — priorité MOYENNE (effectifs par rôle)

```
demandes_effectifs (
  id, demande_id FK, role enum, nombre int, capacites text[], autres_precisions text
)
```

### Colonnes déjà présentes — pas d'action requise

Sur `reservistes` : nom, prénom, email, téléphone, adresse, code_postal, ville, région, date_naissance, profession, allergies_alimentaires, contact_urgence_*, competences_*, responsable_groupe, niveau_ressource.

Sur `demandes` : lieu, description, date_debut, date_fin_estimee, organisme, type_mission, contact_nom/titre/telephone/email, nb_personnes_requis, competences_requises, priorite.

Sur `deployments` : lieu, date_debut, point_rassemblement, hebergement, transport, notes_logistique.

---

## Prochaines étapes proposées

1. **Valider les colonnes critiques avec Steve / Laurence** : en particulier `sexe` (sensibilité RGPD/Charte québécoise), liste exhaustive des « rôles SOPFEU » (abattage / manœuvre de force / autres ?), et liste des « capacités » qu'ils utilisent dans leurs demandes.
2. **Migration SQL** des colonnes haute priorité (`reservistes.sexe`, `reservistes.diete_alimentaire`) — migration legère, peut rouler tout de suite pour commencer à collecter la donnée.
3. **Migration SQL** moyenne priorité + table `demandes_effectifs` — plus lourd, à planifier avec le wizard opérations.
4. **UI profil** : ajouter champs `sexe` et `diete_alimentaire` dans `/profil` (idéalement aussi dans `/inscription`) et flagger les profils existants comme « à compléter ».
5. **Parser XLSX SOPFEU** (import onglet 1) : page `/admin/demandes/importer-sopfeu` qui prend un `.xlsx`, parse avec `openpyxl`/`xlsx` JS, pré-remplit le wizard opérations (sinistre + demande).
6. **Générateur XLSX AQBRS** (export onglet 2) : bouton « Exporter effectifs SOPFEU » sur `/admin/operations/[sinistre_id]/deployments/[id]`, génère le fichier prêt à retourner.

L'étape 5 et 6 peuvent être livrées sans attendre toutes les migrations — on laisse vides les colonnes manquantes dans le XLSX exporté jusqu'à ce que la DB soit enrichie.
