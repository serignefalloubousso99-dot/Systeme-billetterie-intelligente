# Service Abonnements — Répartition des tâches et règles de travail

> **Ce document est le contrat de travail entre les deux développeurs.**
> Tant que les deux le respectent, il ne peut pas y avoir de conflit Git ni de
> divergence entre le frontend et le backend. Toute modification de ce document
> doit être validée par les deux.

| | |
|---|---|
| **Développeur A — Backend** | Fallou Bousso Mamoun |
| **Développeur B — Frontend** | alMuxtaarDev |
| Base de départ | branche `main` |
| Préfixe des branches | `feature/abo-*`, `fix/abo-*`, `test/abo-*`, `docs/abo-*` |

---

## 1. Décisions d'architecture (actées)

Le sujet impose que le Service Abonnements soit **indépendant** du Service
Utilisateurs. Nous partons donc sur un véritable microservice :

| Point | Décision |
|---|---|
| Emplacement | Nouveau dossier `service-abonnements/` à la racine |
| API | Node.js + Express, **propre serveur, propre port (5065)** |
| Base de données | **MySQL** (ORM : Sequelize) — distincte de MongoDB |
| Lien avec les utilisateurs | On ne stocke **que** `utilisateur_id`. Aucune donnée personnelle dupliquée |
| Authentification | Le même `JWT_SECRET` que le Service Utilisateurs, pour valider les jetons émis par lui |

**Conséquence importante :** le Service Abonnements ne fait **jamais** de requête
dans MongoDB. S'il a besoin du nom d'un client, c'est le **frontend** qui croise
les deux API. Le backend ne manipule que des identifiants.

### Arborescence cible

```
service-abonnements/
├── package.json                 ← propre au service
├── .env.example
└── src/
    ├── app.js                   ← application Express exportée (testable)
    ├── server.js                ← connexion BDD + écoute du port 5065
    ├── config/database.js       ← connexion Sequelize
    ├── models/                  ← Formule, Abonnement, Consommation
    ├── controllers/
    ├── routes/
    ├── middleware/
    └── utils/
tests/                           ← même organisation que le Service Utilisateurs
├── unitaires/
└── api/
```

---

## 2. Périmètre fonctionnel

Repris du cahier des charges, découpé en lots livrables.

| Lot | Contenu | Priorité |
|---|---|---|
| **L1** | Formules d'abonnement : créer, configurer tarifs et durées, lister, modifier, désactiver | 🔴 socle |
| **L2** | Souscription : associer un abonnement à un client, dates de début et d'expiration | 🔴 socle |
| **L3** | Suivi des voyages : autorisés, consommés, restants, historique | 🔴 socle |
| **L4** | Cycle de vie : suspendre, renouveler, résilier | 🟠 |
| **L5** | Vérification de validité (consommée par le futur Service Billetterie) | 🟠 |
| **L6** | Recherche et filtrage — *choix à justifier, voir §8* | 🟡 |
| **L7** | Tableau de bord et statistiques — *choix à justifier, voir §8* | 🟡 |

### Les trois types de titres

| Type | Voyages | Expiration | Règle de blocage |
|---|---|---|---|
| `TICKET_SIMPLE` | 1 | configurable | désactivé après la première validation |
| `LIMITE` | N configurable | date d'expiration | bloqué si solde = 0 **ou** date dépassée |
| `ILLIMITE` | aucun compteur | date d'expiration | bloqué uniquement après expiration |

> Pour l'illimité, on compte quand même les voyages — à des fins statistiques
> uniquement, **sans jamais bloquer** le client sur ce compteur.

---

## 3. Répartition des tâches

### Développeur A — Backend

| # | Tâche | Livrable |
|---|---|---|
| A1 | Initialiser le microservice (package.json, Express, Sequelize, `.env.example`) | `service-abonnements/` démarre sur le port 5065 |
| A2 | Modèles Sequelize : `Formule`, `Abonnement`, `Consommation` | Tables créées, relations posées |
| A3 | Middleware d'authentification (vérification du JWT, rôle administrateur) | Routes protégées |
| A4 | CRUD des formules | Endpoints §4.1 |
| A5 | Souscription et cycle de vie | Endpoints §4.2 |
| A6 | Consommation d'un voyage + historique | Endpoints §4.3 |
| A7 | Vérification de validité | Endpoint §4.4 |
| A8 | Recherche, filtrage et statistiques | Endpoints §4.5 |
| A9 | Tests unitaires + tests API | `npm test` vert |
| A10 | Jeu de données de démonstration (seed) | `npm run seed:formules` |

### Développeur B — Frontend

| # | Tâche | Livrable |
|---|---|---|
| B1 | Client API dédié `services/apiAbonnements.js` | Toutes les fonctions du §4 |
| B2 | Page « Formules » : liste, création, modification, désactivation | `pages/FormulesManagement.jsx` |
| B3 | Modales de formule (création / édition) | `components/FormuleModal.jsx` |
| B4 | Page « Abonnements » : liste, filtres, recherche | `pages/AbonnementsManagement.jsx` |
| B5 | Souscription d'un client (sélection client + formule) | `components/SouscriptionModal.jsx` |
| B6 | Fiche abonnement : solde, dates, historique des voyages | `components/AbonnementDetail.jsx` |
| B7 | Actions de cycle de vie (suspendre, renouveler, résilier) | Intégré aux pages |
| B8 | Tableau de bord des abonnements | `components/AbonnementStats.jsx` |
| B9 | Navigation et routes | `App.jsx`, `DashboardLayout.jsx` |
| B10 | Tests unitaires des validations | `utils/validatorsAbonnements.test.js` |

---

## 4. Contrat d'API — **à figer avant toute ligne de code**

> ⚠️ **C'est la section la plus importante du document.** Sur le Service
> Utilisateurs, ce contrat n'avait pas été écrit : nous avons découvert
> **7 divergences** une fois les deux côtés terminés (forme des réponses, nom du
> champ identifiant, valeurs des actions, route manquante…). Tout a dû être
> repris. On ne recommence pas.

**Base :** `http://localhost:5065/api/abonnements`
**Authentification :** en-tête `Authorization: Bearer <token>` sur **toutes** les routes.

### Conventions transverses (non négociables)

| Règle | Valeur |
|---|---|
| Identifiant | champ **`id`** (jamais `_id`) |
| Listes | renvoient un **tableau JSON simple**, pas un objet enveloppe |
| Objet unique | renvoyé sous la clé de la ressource : `{ formule: {...} }` |
| Dates | chaînes **ISO `AAAA-MM-JJ`** |
| Montants | nombres, en francs CFA, sans séparateur |
| Erreurs | `{ "message": "texte lisible" }` |
| Codes HTTP | 200 OK · 201 Créé · 400 saisie invalide · 401 non authentifié · 403 non autorisé · 404 introuvable · 409 conflit |

### 4.1 Formules

| Méthode | Route | Corps / Paramètres | Réponse |
|---|---|---|---|
| `POST` | `/formules` | `{ nom, description, type, tarif, dureeValiditeJours, nombreVoyages }` | `201` `{ formule }` |
| `GET` | `/formules` | `?type=&actif=` | `200` `[ formule, … ]` |
| `GET` | `/formules/:id` | — | `200` `{ formule }` |
| `PUT` | `/formules/:id` | `{ nom, description, tarif, dureeValiditeJours, nombreVoyages }` | `200` `{ formule }` |
| `PATCH` | `/formules/:id/actif` | `{ actif: true \| false }` | `200` `{ formule }` |

**Objet `formule` :**
```json
{
  "id": 1,
  "nom": "Abonnement mensuel 20 voyages",
  "description": "Valable 30 jours",
  "type": "LIMITE",
  "tarif": 15000,
  "dureeValiditeJours": 30,
  "nombreVoyages": 20,
  "actif": true,
  "creeLe": "2026-07-19"
}
```
`type` ∈ `TICKET_SIMPLE` · `LIMITE` · `ILLIMITE`
`nombreVoyages` vaut `1` pour un ticket simple et `null` pour un illimité.

> Une formule n'est **jamais supprimée** : on la désactive (`actif: false`).
> Sinon on casserait l'historique des abonnements déjà souscrits.

### 4.2 Souscriptions

| Méthode | Route | Corps / Paramètres | Réponse |
|---|---|---|---|
| `POST` | `/souscriptions` | `{ utilisateurId, formuleId, dateDebut }` | `201` `{ abonnement }` |
| `GET` | `/souscriptions` | `?utilisateurId=&statut=&type=&recherche=` | `200` `[ abonnement, … ]` |
| `GET` | `/souscriptions/:id` | — | `200` `{ abonnement }` |
| `PATCH` | `/souscriptions/:id/statut` | `{ statut: "SUSPENDU" \| "ACTIF" \| "RESILIE" }` | `200` `{ abonnement }` |
| `POST` | `/souscriptions/:id/renouveler` | `{ dateDebut }` | `200` `{ abonnement }` |

**Objet `abonnement` :**
```json
{
  "id": 42,
  "utilisateurId": "6a5b68fc8be4efac6e1a775e",
  "formule": { "id": 1, "nom": "…", "type": "LIMITE" },
  "dateDebut": "2026-07-19",
  "dateExpiration": "2026-08-18",
  "voyagesAutorises": 20,
  "voyagesConsommes": 3,
  "voyagesRestants": 17,
  "statut": "ACTIF",
  "creeLe": "2026-07-19"
}
```
`statut` ∈ `ACTIF` · `SUSPENDU` · `EXPIRE` · `EPUISE` · `RESILIE`

> `voyagesRestants` est **calculé par le backend** et renvoyé tel quel.
> Le frontend ne recalcule jamais cette valeur — c'est une règle métier.
> Pour un illimité, `voyagesAutorises` et `voyagesRestants` valent `null`.

### 4.3 Consommation et historique

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| `POST` | `/souscriptions/:id/consommer` | `{ validationId }` | `200` `{ abonnement, consommation }` · `409` si non valide |
| `GET` | `/souscriptions/:id/historique` | — | `200` `[ consommation, … ]` |

**Objet `consommation` :** `{ "id": 7, "dateVoyage": "2026-07-19", "validationId": "VAL-001" }`

En cas de refus, le `409` précise la cause :
`{ "message": "Solde de voyages épuisé" }` · `"Abonnement expiré"` · `"Abonnement suspendu"`

### 4.4 Vérification de validité

| Méthode | Route | Réponse |
|---|---|---|
| `GET` | `/validite/:utilisateurId` | `200` `{ valide, abonnement }` |

```json
{ "valide": true, "abonnement": { "id": 42, "voyagesRestants": 17, "dateExpiration": "2026-08-18" } }
```
Si aucun abonnement exploitable : `{ "valide": false, "abonnement": null }`.
C'est l'endpoint que consommera le futur Service Billetterie.

### 4.5 Statistiques

| Méthode | Route | Réponse |
|---|---|---|
| `GET` | `/dashboard/stats` | `200` `{ stats }` |

```json
{
  "stats": {
    "total": 120,
    "parStatut": { "ACTIF": 80, "SUSPENDU": 5, "EXPIRE": 20, "EPUISE": 10, "RESILIE": 5 },
    "parType": { "TICKET_SIMPLE": 40, "LIMITE": 60, "ILLIMITE": 20 },
    "voyagesConsommesTotal": 1540,
    "expirentSous7Jours": 12,
    "revenuTotal": 1800000
  }
}
```

---

## 5. Règles anti-conflit

### 5.1 Chacun sa zone — la règle d'or

| Zone | Propriétaire | L'autre peut… |
|---|---|---|
| `service-abonnements/**` | **Dév. A** | lire, jamais modifier |
| `frontend/src/**` | **Dév. B** | lire, jamais modifier |
| `docs/plan-service-abonnements.md` | **les deux** | modifier uniquement après accord |

> Sur le Service Utilisateurs, `UserManagement.jsx` a été modifié par **11 branches**
> et `App.jsx` par **10**, parce que les deux développeurs touchaient au frontend.
> Avec cette séparation stricte, ce type de conflit devient **impossible**.

### 5.2 Si tu as besoin d'un changement chez l'autre

**Ne le fais pas toi-même.** Ouvre une demande (issue GitHub ou message) en
précisant : le fichier, le besoin, et pourquoi. Celui qui possède la zone le fait.

### 5.3 Le contrat d'API ne se modifie pas unilatéralement

Un besoin de changement au §4 → **on en discute avant**, on met le document à jour,
**puis** on code. Un endpoint ajouté en cachette est exactement ce qui a produit
les 7 divergences précédentes.

### 5.4 Pendant que le backend n'est pas prêt

Le frontend ne reste pas bloqué : il code contre le contrat du §4 avec des données
simulées dans `apiAbonnements.js`. Le jour où le backend est disponible, on
remplace la simulation par les vrais appels — **sans toucher aux composants**.

---

## 6. Workflow Git

1. **Toujours partir de `main` à jour**
   ```bash
   git checkout main && git pull
   git checkout -b feature/abo-formules-crud
   ```
2. **Une branche = une tâche** du §3 (`A4`, `B2`…). Jamais deux à la fois.
3. **Commits atomiques**, format *Conventional Commits* :
   `feat(abo): créer le modèle Formule` · `fix(abo): …` · `test(abo): …` · `docs(abo): …`
4. **Pull Request obligatoire**, avec description : contexte, ce qui change, comment tester.
5. **Relecture croisée** avant fusion. Celui qui relit vérifie surtout la **conformité au §4**.
6. **Fusionner vite.** Une branche qui vit plus de 2 jours diverge et devient pénible.
7. **Jamais de commit direct sur `main`.** Jamais de `.env` commité.

---

## 7. Definition of Done

Une tâche n'est terminée que si **tout** est vrai :

- [ ] Le code respecte le contrat d'API du §4, **au champ près**
- [ ] Les cas d'erreur renvoient le bon code HTTP (400 / 401 / 403 / 404 / 409)
- [ ] Des tests couvrent le cas passant **et** au moins un cas d'échec
- [ ] `npm test` est vert des deux côtés
- [ ] Aucun fichier hors de ma zone (§5.1) n'a été modifié
- [ ] La PR est relue et fusionnée dans `main`

---

## 8. Choix à identifier et justifier

> Le sujet demande explicitement : *« Chaque groupe devra identifier et définir les
> fonctionnalités les plus pertinentes à intégrer dans les modules Recherche et
> filtrage ainsi que Tableau de bord et statistiques. Les choix devront être
> justifiés. »*
>
> **C'est une exigence notée.** Voici notre proposition — à valider ensemble.

### 8.1 Recherche et filtrage

| Fonctionnalité | Justification |
|---|---|
| Filtre par **statut** | L'administrateur doit repérer immédiatement les abonnements suspendus ou épuisés pour agir |
| Filtre par **type de titre** | Les règles métier diffèrent (solde vs date) ; on ne traite pas un ticket simple comme un illimité |
| Recherche par **identifiant client** | Cas d'usage le plus fréquent : un client se présente, on veut son historique |
| Filtre **« expire sous 7 jours »** | Permet d'anticiper les renouvellements — c'est de la valeur commerciale, pas seulement de la consultation |

*Écartés volontairement :* recherche par tarif ou par date de création — aucun
usage métier réel, cela alourdirait l'interface sans bénéfice.

### 8.2 Tableau de bord

| Indicateur | Justification |
|---|---|
| Répartition **par statut** | Vision immédiate de la santé du parc d'abonnements |
| Répartition **par type** | Aide à décider quelles formules promouvoir ou retirer |
| **Voyages consommés** (total) | Mesure l'usage réel du réseau, utile au dimensionnement |
| **Expirations sous 7 jours** | Indicateur d'action : c'est le seul qui déclenche une décision |
| **Revenu total** | Rattache le service à un objectif d'entreprise |

*Écartés :* nombre d'abonnements créés par jour, moyenne de voyages par client —
intéressants sur le papier, mais sans décision associée à ce stade du projet.

---

## 9. Planning proposé

| Phase | Dév. A (back) | Dév. B (front) | Jalon commun |
|---|---|---|---|
| **0** | — | — | **Valider ce document ensemble** |
| **1** | A1, A2 — service et modèles | B1 — client API simulé | Le service démarre |
| **2** | A3, A4 — auth et formules | B2, B3 — pages formules | **Premier branchement réel** |
| **3** | A5, A6 — souscription, voyages | B4, B5, B6 — abonnements | Parcours complet |
| **4** | A7, A8 — validité, stats | B7, B8 — actions, tableau de bord | Fonctionnalités complètes |
| **5** | A9, A10 — tests, seed | B9, B10 — navigation, tests | **Recette commune** |

**La phase 0 n'est pas optionnelle.** Un désaccord sur le §4 coûte dix minutes
maintenant, et plusieurs heures une fois les deux côtés écrits.

---

## 10. Ce qu'on corrige par rapport au Service Utilisateurs

| Ce qui s'est mal passé | Ce qu'on change |
|---|---|
| Le contrat d'API n'était pas écrit → **7 divergences** découvertes à la fin | Le §4 est figé **avant** de coder |
| Deux personnes ont écrit le service d'authentification → doublon à trancher | §5.1 : chacun sa zone, aucun recouvrement |
| Le même fichier mort supprimé par deux branches | Idem — ownership explicite |
| Conflits à répétition sur `ProfileSettings.jsx` et `dashboard.css` | Le backend ne touche plus **jamais** au frontend |
| Endpoint retiré alors que le front en dépendait | §5.3 : aucune modification unilatérale du contrat |
| Branches accumulées, fusionnées tardivement | §6.6 : fusionner sous 2 jours |
| `npm install` oublié après ajout d'une dépendance | Toute nouvelle dépendance est **signalée** dans la PR |

---

## 11. Points encore ouverts

- [x] **MySQL** : local, port 3306, identifiants dans `service-abonnements/.env` (non versionné)
- [x] Un abonnement **actif** empêche-t-il d'en souscrire un second ? Tranché : oui pour LIMITE et ILLIMITE (409), non pour les tickets simples, qui restent cumulables.
- [x] Le passage automatique à `EXPIRE` : calculé à la lecture, ou via une tâche planifiée ? Tranché : à la lecture, comme proposé.
- [x] Les tarifs sont-ils modifiables sur une formule déjà souscrite ? Tranché différemment de la proposition initiale : pas de nouvelle formule créée — le tarif, la durée et le nombre de voyages sont figés (409) sur la formule existante, mais le nom et la description restent modifiables.

*Chaque point tranché est reporté dans ce document, daté, et signalé à l'autre développeur.*
