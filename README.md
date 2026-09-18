# Système de billetterie intelligente

Application de gestion pour un système de billetterie de transport, composée de trois microservices indépendants et communicants :
- **Service Utilisateurs** (`backend/`) : authentification, gestion des comptes (administrateurs, agents, clients), profil.
- **Service Abonnements** (`service-abonnements/`) : catalogue de formules, souscription, consommation des voyages, cycle de vie d'un abonnement. Base MySQL dédiée.
- **Service Billetterie** (`service-billetterie/`) : génération des titres numériques et QR Codes, validation en temps réel, gestion de la concurrence distribuée, journalisation technique et piste d'audit inviolable. Base PostgreSQL dédiée.

Les services ne partagent aucune base de données commune : la communication se fait exclusivement par API REST et le jeton JWT.

## Technologies

Backend — Service Utilisateurs
- Node.js, Express (port 5050)
- MongoDB, Mongoose
- bcryptjs — hachage des mots de passe
- jsonwebtoken — authentification par jeton
- multer — upload de fichiers (photo de profil, CSV)
- csv-parser — lecture des fichiers d'import
- nodemailer — envoi des e-mails d'activation
- node:test, supertest — tests unitaires et API

Backend — Service Abonnements
- Node.js, Express (port 5065)
- MySQL, Sequelize
- jsonwebtoken — vérification des jetons émis par le Service Utilisateurs
- node:test, supertest — tests unitaires et API

Backend — Service Billetterie
- Node.js, Express (port 5070)
- PostgreSQL, Sequelize (`pg`, `pg-hstore`)
- qrcode, uuid — génération de tokens cryptographiques et rendu QR Code
- express-rate-limit — protection contre les abus de validation
- winston — journalisation technique et traçabilité
- node:test, supertest — tests unitaires, API et concurrence

Frontend
- React 19, Vite
- React Router
- Jest, babel-jest — tests unitaires
- oxlint — analyse statique

Bases de données
- MongoDB (Service Utilisateurs)
- MySQL (Service Abonnements)
- PostgreSQL (Service Billetterie)

## Fonctionnalités

### Authentification & Profil
- Connexion et déconnexion par jeton JWT
- Écran dédié de changement de mot de passe obligatoire à la première connexion
- Profil du compte connecté, modification d'informations, upload photo

### Gestion des comptes (Administrateur)
- Création individuelle, import CSV avec rejet détaillé
- Recherche et filtres avancés (rôle, statut)
- Activation, blocage et suppression logique
- Correction de l'email d'un compte (identifiant de connexion), sous réserve d'unicité — le statut reste protégé par les routes d'activation dédiées

### Espace Client
- Consultation de ses propres titres de transport et de leur QR Code
- Consultation de son propre droit à voyager (abonnement en cours, voyages restants)

### Service Abonnements
- Catalogue de formules : ticket simple (1 voyage), limité, illimité
- Souscriptions avec calcul d'expiration et de solde
- Un seul abonnement actif par client (tickets cumulables)
- Suspension, réactivation, résiliation définitive, renouvellement
- Vérification du droit à voyager (`GET /api/abonnements/validite/:utilisateurId`)

### Service Billetterie (QR Code, Contrôle, Audit, Thèmes)
- **Génération de QR Codes** : tokens uniques non falsifiables sans exposition de données personnelles sensibles
- **Poste de scan & contrôle en temps réel** : grand retour visuel (VERT pour Autorisé, ROUGE pour Refusé) avec signal sonore et historique de session
- **Règles métier par type de titre** :
  - *Ticket simple* : consommation atomique au 1er passage, refus automatique au 2nd (`TICKET_DEJA_UTILISE`)
  - *Abonnements limité / illimité* : décompte via le Service Abonnements
- **Gestion de la concurrence** : Verrou transactionnel PostgreSQL (`LOCK.UPDATE`) empêchant deux validations simultanées du même titre ou dernier voyage
- **Piste d'audit inviolable** : journal append-only de toutes les actions sensibles (génération, activation/désactivation d'un titre, chaque scan — autorisé ou refusé), avec auteur, rôle, ressource concernée, horodatage et résultat
- **Thème clair et sombre** : Switch instantané avec persistance du choix utilisateur
- **Tableau de bord décisionnel** : KPIs, taux d'autorisation, typologie et analyse des motifs de refus

## API

### Service Utilisateurs (port 5050)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | /api/auth/login | public | connexion |
| POST | /api/auth/logout | public | déconnexion |
| GET | /api/users/profile | connecté | profil du compte connecté |
| PUT | /api/users/profile/password | connecté | changement de mot de passe |
| PUT | /api/users/profile | connecté, mot de passe changé | modification des informations personnelles |
| POST | /api/users/profile/photo | connecté, mot de passe changé | upload de la photo de profil |
| GET | /api/users/lookup | administrateur, agent | identité minimale (nom, prénom, téléphone) de comptes, sans champs sensibles |
| GET | /api/admin/dashboard/stats | administrateur | statistiques utilisateurs |
| POST | /api/admin/users | administrateur | création d'un compte |
| GET | /api/admin/users | administrateur | liste des comptes, recherche et filtres |
| GET | /api/admin/users/:id | administrateur | fiche d'un compte |
| PUT | /api/admin/users/:id | administrateur | modification d'un compte |
| DELETE | /api/admin/users/:id | administrateur | suppression |
| PATCH | /api/admin/users/:id/status | administrateur | changement de statut |
| PATCH | /api/admin/users/bulk-status | administrateur | action groupée |
| POST | /api/admin/users/import | administrateur | import CSV |

### Service Abonnements (port 5065)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | /api/abonnements/formules | administrateur | création d'une formule |
| GET | /api/abonnements/formules | administrateur | catalogue, filtres type/actif |
| GET | /api/abonnements/formules/:id | administrateur | fiche d'une formule |
| PUT | /api/abonnements/formules/:id | administrateur | modification (figée si déjà souscrite) |
| PATCH | /api/abonnements/formules/:id/actif | administrateur | activation/désactivation |
| POST | /api/abonnements/souscriptions | administrateur | souscription d'un client |
| GET | /api/abonnements/souscriptions | administrateur | liste, filtres statut/type/client/expiration |
| GET | /api/abonnements/souscriptions/:id | administrateur | fiche d'un abonnement |
| PATCH | /api/abonnements/souscriptions/:id/statut | administrateur | suspendre / réactiver / résilier |
| POST | /api/abonnements/souscriptions/:id/renouveler | administrateur | renouvellement |
| POST | /api/abonnements/souscriptions/:id/consommer | administrateur, agent | validation d'un voyage |
| GET | /api/abonnements/souscriptions/:id/historique | administrateur | historique des voyages |
| GET | /api/abonnements/validite/:utilisateurId | administrateur, agent, client (son propre compte) | droit à voyager |
| GET | /api/abonnements/dashboard/stats | administrateur | statistiques abonnements |

### Service Billetterie (port 5070)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | /api/billetterie/titres | administrateur | génération d'un titre de transport et QR Code |
| GET | /api/billetterie/titres | administrateur, agent | liste des titres, filtres et recherche |
| GET | /api/billetterie/titres/:id | administrateur, agent | fiche détail et QR code d'un titre |
| PATCH | /api/billetterie/titres/:id/statut | administrateur | activation ou désactivation d'un titre |
| GET | /api/billetterie/titres/client/:utilisateurId | administrateur, agent, client (son propre compte) | titres d'un client |
| POST | /api/billetterie/validations/scan | administrateur, agent | scan et validation en temps réel d'un QR code |
| GET | /api/billetterie/validations | administrateur, agent | historique des passages autorisés et refusés |
| GET | /api/billetterie/validations/:id | administrateur, agent | fiche d'une validation |
| GET | /api/billetterie/audit | administrateur | consultation de la piste d'audit |
| GET | /api/billetterie/dashboard/stats | administrateur | indicateurs d'affluence et statistiques |

## Tests

- Backend Service Utilisateurs : 85 tests, `node --test`
- Backend Service Abonnements : 75 tests, `node --test`
- Backend Service Billetterie : 36 tests, `node --test` (incluant test de concurrence et audit)
- Frontend : 43 tests unitaires, `jest`

Total : **239 tests automatisés**, tous passants.

```bash
# Lancer tous les tests du projet :
npm test --prefix backend && npm test --prefix service-abonnements && npm test --prefix service-billetterie && npm test --prefix frontend
```

## Installation et démarrage

Prérequis : Node.js 18 ou plus, MongoDB en local, MySQL en local, PostgreSQL en local (ou via Docker).

```bash
# 1. Installation de toutes les dépendances
npm run install-all

# 2. Configuration des variables d'environnement
# Créer backend/.env, service-abonnements/.env et service-billetterie/.env 
# sur le modèle de leurs fichiers .env.example respectifs (même JWT_SECRET).

# 3. Démarrer PostgreSQL (si conteneur Docker)
docker run -d --name billetterie-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=billetterie_db -p 5432:5432 postgres:17-alpine

# 4. Lancement global de l'application
npm run dev
```

Démarre simultanément les 4 services :
- Service Utilisateurs (port 5050)
- Service Abonnements (port 5065)
- Service Billetterie (port 5070)
- Application Frontend React (port 5173)

## Documentation

- [PLAN-SERVICE-BILLETTERIE.md](PLAN-SERVICE-BILLETTERIE.md) — contrat d'API, modèle PostgreSQL, concurrence, audit et règles du Service Billetterie
- [PLAN-SERVICE-ABONNEMENTS.md](PLAN-SERVICE-ABONNEMENTS.md) — contrat d'API et architecture du Service Abonnements
- [docs/service-billetterie.md](docs/service-billetterie.md) — livrable Service Billetterie : fonctionnalités critiques, plan de tests, tableau de synthèse, justifications
- [docs/service-abonnements.md](docs/service-abonnements.md) — livrable Service Abonnements
- [docs/TP1-service-utilisateurs.md](docs/TP1-service-utilisateurs.md) — livrable Service Utilisateurs
