# Guide — installation, tests et démonstration

Commandes à exécuter, dans l'ordre, pour installer le projet, lancer les tests et faire une démonstration.

## 1. Prérequis

- Node.js 18 ou plus (vérifier avec `node -v`)
- MongoDB installé et lancé en local (Service Utilisateurs)
- MySQL installé et lancé en local (Service Abonnements — le front y est branché directement, plus de simulateur)

Si `npm` n'est pas reconnu dans le terminal, Node est probablement géré par `fnm` mais pas chargé dans cette session :

```bash
source ~/.zshrc
```

Si ça ne suffit pas, fermer le terminal et en ouvrir un nouveau.

## 2. Installation

Depuis la racine du projet :

```bash
npm run install-all
```

Installe les dépendances des trois services (backend, service-abonnements, frontend).

## 3. Configuration

Créer `backend/.env` à partir de `backend/.env.example` (au minimum `MONGO_URI` et `JWT_SECRET`).

Créer `service-abonnements/.env` à partir de `service-abonnements/.env.example` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` et **le même `JWT_SECRET` que `backend/.env`** — ce service ne réémet pas de jetons, il vérifie ceux du Service Utilisateurs).

## 4. Démarrer les bases de données

MongoDB :

```bash
sudo systemctl start mongod
ss -ltnp | grep 27017   # vérifier que ça écoute
```

MySQL : créer les bases `billetterie_abonnements` et `billetterie_abonnements_test` si elles n'existent pas encore.

```bash
mysql -h127.0.0.1 -uroot -p -e "CREATE DATABASE IF NOT EXISTS billetterie_abonnements; CREATE DATABASE IF NOT EXISTS billetterie_abonnements_test;"
```

## 5. Créer le compte administrateur et le catalogue de démo

```bash
cd backend
npm run seed:admin
```

Identifiants par défaut (sauf s'ils sont surchargés dans `.env`) :
- Email : `admin@billetterie.com`
- Mot de passe : `Admin1234`

```bash
cd service-abonnements
npm run seed:formules
```

Crée un catalogue de formules de démonstration (idempotent, ne duplique rien si rejoué).

## 6. Lancer le projet

Depuis la racine :

```bash
npm run dev
```

Démarre les trois services ensemble : l'API Express du Service Utilisateurs (port 5050), l'API Express du Service Abonnements (port 5065) et le frontend React (port 5173). Ouvrir `http://localhost:5173`.

## 7. Lancer les tests

Backend Service Utilisateurs (depuis `backend/`) :

```bash
npm test               # toute la suite : 80 tests
npm run test:unitaires # 14 tests, sans base de données
npm run test:api       # 66 tests, avec une base MongoDB de test
```

Backend Service Abonnements (depuis `service-abonnements/`) :

```bash
npm test               # toute la suite : 75 tests
npm run test:unitaires # 24 tests, sans base de données
npm run test:api       # 51 tests, avec une base MySQL de test
```

Frontend (depuis `frontend/`) :

```bash
npm test                # 34 tests (22 Service Utilisateurs + 12 Service Abonnements)
```

Les clients API (`services/api.js`, `services/apiAbonnements.js`) ne sont pas testés unitairement : ce sont de vrais clients HTTP, la logique qu'ils appellent est couverte côté serveur.

Autres commandes utiles côté frontend :

```bash
npm run lint    # analyse statique
npm run build   # build de production
```

## 8. Démonstration — Service Utilisateurs

1. Se connecter avec le compte administrateur (§5).
2. Aller sur **Gestion des Comptes** → **Importer CSV** → déposer `docs/exemples/utilisateurs-test.csv`.
3. Rechercher un compte par numéro de téléphone (ex. `+221771234501`).
4. Sélectionner plusieurs comptes → **Activer** dans la barre d'actions groupées.
5. Se déconnecter, se reconnecter avec un des comptes activés et son mot de passe temporaire (reçu par e-mail si `EMAIL_*` est configuré dans `.env`, sinon visible dans les logs du serveur).
6. Constater la redirection forcée vers l'écran de changement de mot de passe.
7. Changer le mot de passe, vérifier l'accès débloqué.
8. Revenir sur le compte administrateur, modifier un compte (nom, téléphone ou rôle) depuis le tableau.
9. Bloquer puis supprimer un compte, vérifier les compteurs du tableau de bord (total, actifs, bloqués, supprimés).

## 9. Démonstration — Service Abonnements

Nécessite `service-abonnements` démarré (§6) avec sa base MySQL et le catalogue de démo injecté (§5).

1. Se connecter avec le compte administrateur.
2. Aller sur **Formules** : le catalogue de démo est déjà là (Ticket simple, Carnet 10 voyages, Mensuel 20/40 voyages, Illimité mensuel/annuel). Créer une formule si besoin.
3. Activer un client sur **Gestion des Comptes** s'il n'y en a pas encore (la liste de la souscription ne montre que les clients `Actif`).
4. Aller sur **Abonnements** → **Nouvelle souscription**, choisir ce client et une formule.
5. Tenter de souscrire le même client à une autre formule Limitée : refusé (un seul abonnement Limité/Illimité en cours par client). Le souscrire à un Ticket simple : accepté, les tickets restent cumulables.
6. Ouvrir la fiche détail de l'abonnement, consulter le solde et l'historique. Pour un ticket simple, le QR Code s'affiche tant que le billet est actif.
7. Suspendre l'abonnement, vérifier qu'il n'apparaît plus "Actif" ; le réactiver.
8. Le résilier : constater que l'action devient définitive (plus de renouvellement ni de réactivation possible).
9. Consulter le **Tableau de bord** : total, répartition par statut/type, revenu, expirations sous 7 jours.

## 10. Problèmes fréquents

| Symptôme | Cause probable | Solution |
|---|---|---|
| `npm: command not found` | fnm pas chargé dans le terminal | `source ~/.zshrc` ou nouveau terminal |
| `Error connecting to MongoDB` | MongoDB pas démarré | `sudo systemctl start mongod` |
| Erreur CORS dans la console du navigateur | Le backend a crashé (souvent lié à MongoDB) | Vérifier les logs du terminal backend |
| `401 Unauthorized` au login | Base de données vide, pas d'admin créé | `npm run seed:admin` |
| `service-abonnements` ne démarre pas | MySQL pas démarré, ou `.env` manquant | Vérifier que MySQL écoute sur le port configuré, créer `service-abonnements/.env` |
| "NetworkError" ou "Impossible de récupérer..." sur les pages Formules/Abonnements/Tableau de bord | `service-abonnements` (port 5065) n'est pas démarré | `npm run dev` depuis la racine, ou `npm run dev --prefix service-abonnements` |
