# Service Billetterie (QR Code, Sécurité, Audit, Thèmes)

Projet : Système de billetterie intelligente avec QR Code et abonnements.  
Périmètre : **Service Billetterie** — génération, gestion et validation des titres de transport numériques (QR Codes), sécurisation des contrôles, gestion de la concurrence, journalisation technique, piste d'audit inviolable et support des thèmes clair/sombre. Troisième phase du projet, complétant le Service Utilisateurs (`backend/`) et le Service Abonnements (`service-abonnements/`).

Microservice indépendant (`service-billetterie/`, Node/Express/PostgreSQL, port 5070) qui ne touche jamais aux bases MongoDB du Service Utilisateurs ni MySQL du Service Abonnements. Il ne stocke que les identifiants nécessaires (`utilisateurId`, `abonnementId`) et communique exclusivement par API REST. Le contrat d'API et les règles d'architecture sont détaillés dans [PLAN-SERVICE-BILLETTERIE.md](../PLAN-SERVICE-BILLETTERIE.md).

---

## 1. Fonctionnalités critiques

**Intégrité des titres de transport et gestion des QR Codes :**
- Génération d'un QR Code unique non prédictible (token cryptographique `TKT-...`), évitant de stocker directement des informations personnelles sensibles dans l'image.
- Rendu de l'image QR Code en Data URL (base64 PNG) visualisable, téléchargeable et imprimable sur le guichet.
- Association stricte d'un titre à un client (`utilisateurId`), et le cas échéant à un abonnement actif (`abonnementId`).
- Cycle de vie : activation et désactivation administrative (traçable dans l'audit).
- Ticket simple : utilisable une seule fois. Dès le voyage autorisé, le ticket passe de manière atomique au statut `CONSOMME`. Toute nouvelle tentative est rejetée avec le motif `TICKET_DEJA_UTILISE`.

**Sécurité et Concurrence distribuée :**
- **Gestion des validations simultanées** : Transaction PostgreSQL avec verrou de ligne (`LOCK.UPDATE` / `SELECT ... FOR UPDATE`). Deux agents scannant le même ticket simple ou le dernier voyage d'un abonnement ne peuvent jamais autoriser deux voyages : exactement un scan réussit, l'autre est rejeté immédiatement.
- **Contrôle d'accès RBAC** : Rôles `Administrateur` et `Agent`. Les agents peuvent scanner les QR Codes et consulter l'historique de passage. Les actions de génération, désactivation, consultation d'audit et statistiques sont réservées aux administrateurs.
- **Protection contre les abus** : Rate-limiting limitant les tentatives abusives ou répétitives de validation.
- **Gestion des pannes inter-services** : Gestion propre des indisponibilités réseau (`SERVICE_INDISPONIBLE`) sans crash ni fuite technique.

**Journalisation et Piste d'audit :**
- **Séparation stricte** entre :
  1. *Logs techniques* (`logs/combined.log`, `logs/error.log`) avec masquage automatique des secrets et tokens.
  2. *Historique métier des validations* (`validations`), accessible pour le suivi des passages voyageurs.
  3. *Piste d'audit inviolable* (`audit_logs`), en écriture seule (append-only), traçant qui a fait quoi, sur quelle ressource et à quel moment.

**Confort d'utilisation et Thèmes clair / sombre :**
- Bascule fluide entre thème clair et thème sombre, avec persistance dans `localStorage`.
- Écran de scan optimisé avec contraste fort et immédiat : bannière géante verte pour `AUTORISÉ`, bannière géante rouge pour `REFUSÉ` avec motif explicite et bips sonores synthétisés Web Audio.
- Recherche et filtrage justifiés selon les besoins du terrain (statut, résultat, motif de refus, date, agent, client).
- Tableau de bord et statistiques décisionnelles (taux de succès, motifs fréquents, affluence par tranche horaire).

---

## 2. Plan de tests

- **Backend (`service-billetterie/`)** :
  - `node:test` + `supertest` sur une base PostgreSQL dédiée (`billetterie_db_test`).
  - Tests unitaires des fonctions pures (tokens, rendu QR, modèles) et tests d'intégration API.
  - Test spécifique de concurrence avec `Promise.all` simulant deux scans strictement simultanés sur le même titre.
- **Frontend (`frontend/`)** :
  - Jest pour les fonctions de validation et formateurs métier (`validatorsBilletterie.test.js`).
  - Vérification de la compilation et absence d'erreurs statiques via `vite build`.

```bash
# Tests du Service Billetterie (29 tests)
cd service-billetterie
npm test

# Tests Frontend (43 tests unitaires)
cd frontend
npm test

# Ensemble complet du projet (185 tests back + 43 tests front)
npm test --prefix backend && npm test --prefix service-abonnements && npm test --prefix service-billetterie && npm test --prefix frontend
```

---

## 3. Tableau de synthèse des tests

### Backend Service Billetterie — 29 tests, tous passants

| Suite de test | Cas couverts | Nb | Résultat |
|---|---|---|---|
| **Service QR Code (Unitaires)** | Génération de token unique `TKT-...`, rendu Data URL PNG base64, normalisation du code | 3 | Passant |
| **Modèle TitreTransport (Unitaires)** | Méthode `estValide()` : actif, expiration future, rejet si désactivé/consommé/expiré | 4 | Passant |
| **Gestion des Titres (API)** | Création, exigence utilisateurId/type/abonnementId, RBAC (admin vs agent/client), consultation, filtres, activation/désactivation, audit | 9 | Passant |
| **Scan et Validation (API)** | Premier passage ticket simple autorisé, refus second passage (`TICKET_DEJA_UTILISE`), code inconnu, code désactivé, titre expiré, contrôle d'accès agent/admin, consultation historique avec filtre résultat | 8 | Passant |
| **Concurrence & Scans simultanés (API)** | Deux scans en parallèle avec `Promise.all` : 1 seul autorisé, 1 refusé, cohérence en base PostgreSQL | 1 | Passant |
| **Audit et Tableau de bord (API)** | Enregistrement audit sur actions sensibles, réservation aux administrateurs, calcul de tous les KPIs et distribution horaire | 4 | Passant |

Total : 29 tests (7 unitaires, 22 API).

---

## 4. Scénario fonctionnel complet (Parcours de démonstration)

1. **Connexion Administrateur & Choix du thème** :
   - L'administrateur se connecte et bascule l'interface en **mode sombre**. Le choix est conservé au rafraîchissement de la page.
2. **Génération d'un titre de transport** :
   - Dans **Titres & QR**, clic sur « Générer un titre ».
   - Sélection d'un client et d'un type de titre (Ticket simple ou Abonnement associé).
   - Génération instantanée : le QR Code apparaît avec son token unique `TKT-...`.
   - Clic sur l'icône QR code pour afficher la fiche imprimable ou télécharger l'image PNG.
3. **Poste de scan par un Agent** :
   - Connexion sous le compte Agent. L'agent accède directement à l'écran **Scan**.
   - Scan du QR Code : grand écran **VERT** éclatant « VOYAGE AUTORISÉ », signal sonore de validation, compteur de session incrémenté.
4. **Test de la fraude / réutilisation** :
   - Immédiatement après, tentative de rescanner le même ticket simple :
   - Grand écran **ROUGE** vif « VOYAGE REFUSÉ : Ticket déjà utilisé (voyage unique) », double bip sonore d'alerte.
5. **Désactivation administrative** :
   - L'administrateur désactive un titre actif. Le statut passe en rouge `DESACTIVE`.
   - Au scan suivant, le voyage est refusé avec le motif « Titre ou QR Code désactivé ».
6. **Historique des validations** :
   - Dans **Validations**, consultation des contrôles effectués.
   - Filtrage par statut (Autorisé vs Refusé) ou par motif (Ticket déjà utilisé, QR Code inconnu).
7. **Piste d'audit et Statistiques** :
   - Dans **Audit**, visualisation des opérations sensibles (génération, désactivation, scan) avec identité de l'auteur, horodatage et adresse IP.
   - Dans **Stats Billetterie**, visualisation de l'affluence du jour, du taux de réussite global et des motifs de refus dominants.

---

## 5. Justifications des choix (Exigence notée)

### 5.1 Recherche et filtrage

| Fonctionnalité | Cible | Justification métier |
|---|---|---|
| **Filtre par Résultat (Autorisé / Refusé)** | Agents & Admins | Permet à l'agent de comprendre immédiatement pourquoi un passager vient d'être bloqué, et à l'admin de cibler les rejets |
| **Filtre par Motif de refus** | Admins | Isole instantanément les cas de fraude (tickets réutilisés) des cas commerciaux (abonnements à renouveler) ou techniques |
| **Recherche par Identifiant Client / Code** | Agents & Admins | Permet de retrouver le titre ou l'historique lors d'une réclamation d'un voyageur au guichet |
| **Filtre par Date de validation** | Admins | Permet l'audit des flux par journée d'exploitation |

### 5.2 Tableau de bord et statistiques

| Indicateur | Justification métier |
|---|---|
| **Validations totales & Validations du jour** | Mesure le volume et l'intensité d'affluence en temps réel |
| **Taux d'autorisation vs Rejet (%)** | Baromètre de la fluidité aux tourniquets et de la régularité des usagers |
| **Analyse des motifs de refus** | Permet de déclencher les bonnes actions (actions antifraude vs relances commerciales) |
| **Affluence par tranche horaire (00h-23h)** | Dimensionne les équipes de contrôle et la cadence des rames aux heures de pointe |
