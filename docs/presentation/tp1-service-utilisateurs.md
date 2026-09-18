---
marp: true
theme: default
paginate: true
style: |
  :root {
    --blue: #2563EB;
    --blue-dark: #1D4ED8;
    --navy: #1E3A8A;
    --ink: #1E293B;
    --muted: #64748B;
    --sky: #DBEAFE;
    --pale: #EFF6FF;
  }
  section {
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
    background: linear-gradient(160deg, #FFFFFF 55%, #EFF6FF 100%);
    color: var(--ink);
    font-size: 23px;
    line-height: 1.5;
    padding: 50px 68px;
  }
  h1 {
    color: var(--navy);
    font-size: 1.3em;
    line-height: 1.25;
    letter-spacing: -0.01em;
    margin-bottom: 0.5em;
  }
  h2 { color: var(--ink); font-size: 1.15em; }
  h6 {
    display: inline-block;
    background: var(--sky);
    color: var(--blue-dark);
    padding: 0.3em 1em;
    border-radius: 999px;
    font-size: 0.54em;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
    margin: 0 0 0.55em;
  }
  strong { color: var(--blue-dark); }
  em { color: var(--muted); }
  code {
    background: #E0EAFF;
    color: var(--navy);
    border-radius: 5px;
    padding: 0.08em 0.35em;
  }
  pre {
    background: #0F172A;
    border: 1px solid var(--sky);
    border-radius: 14px;
    padding: 0.65em 1em;
  }
  pre code {
    background: transparent;
    color: #E2E8F0;
    font-size: 0.85em;
  }
  blockquote {
    background: #F0F6FF;
    border-left: 5px solid var(--blue);
    border-radius: 0 14px 14px 0;
    padding: 0.5em 1em;
    color: var(--muted);
    font-size: 0.82em;
    margin-top: 0.6em;
  }
  table { font-size: 0.72em; }
  th {
    background: var(--blue);
    color: #FFFFFF;
    border: 1px solid #3B82F6;
    padding: 0.5em 0.8em;
  }
  td {
    background: #FFFFFF;
    border: 1px solid var(--sky);
    padding: 0.5em 0.8em;
  }
  section.lead {
    text-align: center;
    background: linear-gradient(180deg, #EFF6FF 0%, #DBEAFE 100%);
  }
  section.lead h1 { font-size: 1.85em; }
  section.lead h2 { color: var(--blue-dark); font-weight: 500; }
  section::after, footer { color: var(--muted); }
---

<!-- _paginate: false -->

![bg right:40%](assets/hero-users.svg)

###### Mini-TP

# Service Utilisateurs — Système de billetterie intelligente

**Fonctionnalités critiques, plan de tests, CRUD complet et scénario de bout en bout**, sur le périmètre gestion des comptes (front React + back Node/Express/MongoDB).

Présenté par :
**Makhtar WADE** · **Elhadj Fallou Bousso**

*Juillet 2026*

---

###### 1 · Le périmètre

# Service Utilisateurs

Gestion des comptes : administrateurs, agents, clients.

Livrables du Mini-TP :

- fonctionnalités critiques du service ;
- plan de tests, tableau de synthèse ;
- tests unitaires, tests API ;
- scénario fonctionnel complet ;
- branches dédiées, PR documentées, relecture croisée.

Travail réparti en binôme : front d'un côté, back de l'autre.

---

###### 1 · Le périmètre

# Qui gère quoi

- **Front (Makhtar)** : login, page profil, gestion des comptes (liste, filtres, création, import CSV, actions groupées), extraction des règles de validation en fonctions testables.
- **Back (Elhadj Fallou)** : routes Express, contrôleurs, modèle Mongoose, infrastructure de tests (`node:test` + `supertest`), 59 tests.

---

###### 2 · Fonctionnalités critiques

# Fonctionnalités critiques

**Sécurité des comptes :**
- Connexion et contrôle d'accès (seul un administrateur gère les comptes)
- Mot de passe jamais stocké en clair (haché avec bcrypt)
- Activation de compte avec mot de passe temporaire
- Modification du rôle d'un compte
- Changement de mot de passe obligatoire à la première connexion

**Actions sur plusieurs comptes à la fois :**
- Import CSV, actions groupées (activer/bloquer/supprimer)
- Suppression : le compte est marqué "Supprimé", pas effacé de la base

---

###### 3 · Plan de tests

# Deux outillages, un par côté

| | Back | Front |
|---|---|---|
| Outil | `node:test` + `supertest` | Jest |
| Cible | routes, contrôleurs, modèle | règles de validation (`utils/validators.js`) |
| Base | MongoDB dédiée par processus de test | — |
| E-mail | neutralisé pendant les tests | — |

```bash
npm test              # backend : toute la suite
npm test --prefix frontend   # frontend : 22 tests Jest
```

Rendu visuel des pages vérifié manuellement.

---

###### 4 · Tableau de synthèse

# 59 tests back, 0 échec

| Bloc | Cas | Exemple |
|---|---|---|
| Auth & accès | 8 | login, jeton invalide, 403 non-admin |
| Gestion comptes | 11 | création, recherche email/tél/id, filtres |
| CRUD unitaire | 11 | fiche, modification, garde-fous rôle/email/statut |
| Activation/suppression | 8 | activer, bloquer, supprimer, groupé |
| Import CSV | 6 | doublon ignoré, ligne invalide, sans fichier |
| Unitaires (mdp, regex, modèle) | 14 | 8 caractères, échappement, validation |

**Total : 59 tests, 45 API + 14 unitaires — tous verts.**

---

###### 4 · Tableau de synthèse

# Et côté front : 22 tests Jest

| Fonction | Cas couverts |
|---|---|
| `isValidEmail` | email valide, sans `@`, vide |
| `isValidPhone` | 9 chiffres, préfixé `+221`, préfixé `221`, trop court, trop long, caractères non numériques, vide |
| `validateUserForm` | formulaire valide, champ manquant, email invalide, téléphone invalide, email facultatif en édition, aucun champ |
| `validateLoginForm` | email vide, mot de passe trop court, cas valide |
| `validateNewPassword` | trop court, confirmation différente, cas valide |

Règles extraites de `Login.jsx`, `CreateUserModal.jsx`, `EditUserModal.jsx` et `ProfileSettings.jsx` vers `utils/validators.js`.

---

###### 5 · Scénario fonctionnel

# De l'import CSV à la première connexion

1. L'admin se connecte, importe un CSV de 10 agents (avec un doublon et deux lignes invalides volontaires) → l'import continue, chaque rejet est détaillé.
2. Il filtre sur le rôle `Agent`, recherche un numéro `+221…` → l'agent est trouvé.
3. Il active 3 agents en groupé → mot de passe temporaire généré, e-mail envoyé, compteurs mis à jour à l'écran.
4. Un agent se connecte avec ce mot de passe → redirigé de force vers son profil, bloqué tant qu'il n'a pas changé de mot de passe.
5. Il change son mot de passe → accès débloqué.
6. L'admin modifie le téléphone d'un agent, bloque puis supprime un autre compte → tableau de bord à jour.

Un compte n'est jamais utilisable avant activation explicite ; un mot de passe temporaire ne donne accès à rien.

---

###### 6 · CRUD complet

# Gestion d'un compte

```
PUT /api/admin/users/:id
```
- modifie nom, prénom, téléphone, rôle
- **email et statut protégés** : ignorés même si envoyés dans la requête
- rôle hors énumération → 400, pas de 500

---

###### 7 · Anomalies trouvées

# Quatre bugs réels, pas théoriques

**Recherche par téléphone (500).** La regex de recherche était construite directement depuis la saisie. Un numéro commençant par `+` casse une regex (quantificateur invalide). Corrigé par échappement (`escapeRegex`).

**Champ CSV hors zone.** L'`input[type=file]` de la modale d'import était positionné en absolu sans ancrage, invisible, recouvrait tout l'écran et interceptait les clics.

**Rôle invalide → 500 au lieu de 400.** Une saisie invalide doit remonter une erreur client, pas une erreur serveur.

**Compteurs "Supprimés" invisibles.** Le back les renvoyait, mais aucune des 4 cartes de stats ne les affichait à l'écran.

---

###### 7 · Anomalies trouvées

# Le point commun

Les quatre étaient masqués par l'interface elle-même : le filtre front recalcule ses propres stats en repli si l'API échoue, et personne ne tape un numéro avec `+` en cliquant vite dans l'app pour vérifier à l'œil.

---

###### 8 · Git & revue de code

# Une branche par sujet, pas une par personne

9 Pull Requests, chacune sur un seul changement : le fix des stats, l'édition CRUD, le détail des erreurs CSV, la conformité back, les deux livrables de tests, la fusion des docs...

- commits au format `type(scope): description`
- PR avec résumé + plan de test avant de demander la relecture
- relecture croisée front ↔ back avant fusion
- une branche fermée sans fusion quand son contenu faisait doublon avec une autre

---

<!-- _class: lead -->
<!-- _paginate: false -->

![bg left:38%](assets/hero-users.svg)

# Merci

## Service Utilisateurs — Mini-TP

**Makhtar WADE** · **Elhadj Fallou Bousso**

*Juillet 2026*
