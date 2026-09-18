# Guide de Contribution 🤝

Merci de contribuer au **Système de Billetterie Intelligente**. Afin de maintenir la qualité du code et la cohérence de l'architecture, tous les contributeurs doivent respecter les directives suivantes.

---

## 🌿 Gestion des Branches & Git Flow

Nous suivons un flux Git simplifié. Toute modification doit faire l'objet d'une branche dédiée avant d'être fusionnée dans la branche principale `main`.

### 1. Nommage des branches
Nommez vos branches de manière explicite en utilisant des préfixes en minuscules :
* `feature/nom-de-la-fonctionnalite` (ex: `feature/auth-jwt`)
* `bugfix/nom-du-bug` (ex: `bugfix/fix-csv-import`)
* `docs/type-de-documentation` (ex: `docs/update-readme`)
* `refactor/nom-de-la-refacto` (ex: `refactor/cleanup-express-routes`)

### 2. Style des Commits (Conventional Commits)
Vos messages de commit doivent être clairs, rédigés en français ou en anglais, et respecter le format suivant :
`type: description courte`

Les types autorisés sont :
* **feat** : Ajout d'une nouvelle fonctionnalité.
* **fix** : Correction d'un bug.
* **docs** : Modifications de la documentation.
* **style** : Modifications de mise en forme du code (espaces, virgules, etc. sans impact fonctionnel).
* **refactor** : Restructuration du code sans changement de comportement.
* **test** : Ajout ou modification de tests.

*Exemple : `feat: ajouter la validation par QR Code`*

---

## 💻 Normes de Codage & Bonnes Pratiques

### Frontend (ReactJS)
* **Composants fonctionnels** : Utilisez exclusivement des composants fonctionnels avec des React Hooks.
* **Structure des dossiers** : Séparez les pages, les composants réutilisables, et les services d'appel API.
* **Nommage** : Les fichiers de composants doivent être en PascalCase (ex: `DashboardStats.jsx`) et les styles ou utilitaires en camelCase.
* **CSS** : Utilisez des variables CSS globales pour respecter la palette de couleurs et la charte graphique de l'application.

### Backend (Node.js & Express)
* **Modularité (MVC)** : Séparez clairement les Modèles (Mongoose), les Routes (Express), et les Contrôleurs.
* **Gestion des erreurs** : Enveloppez vos appels asynchrones dans des blocs `try/catch` ou utilisez un middleware global de gestion d'erreurs pour éviter les crashs du serveur.
* **Statuts HTTP** : Renvoyez toujours les codes de statut HTTP appropriés (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`, `500 Server Error`).

---

## 🔒 Sécurité et Base de données (MongoDB)

* **Variables d'environnement** : Ne commitez **jamais** de données sensibles (clés secrètes JWT, mots de passe de base de données). Utilisez le fichier `.env` qui est local et ignoré par Git. Documentez les nouvelles variables dans `.env.example`.
* **Mongoose** : Définissez toujours des schémas stricts avec validation des types et valeurs requises.

---

## 🧪 Tests locaux avant soumission

Avant de pousser vos modifications ou de créer une Pull Request, vous devez :
1. Vous assurer que le projet démarre correctement sans erreur de dépendance avec `npm run dev`.
2. Vérifier que la console frontend et les logs backend ne contiennent aucun avertissement ou erreur critique.
3. Vérifier que votre code respecte la structure globale du projet sans créer de fichiers superflus à la racine.
