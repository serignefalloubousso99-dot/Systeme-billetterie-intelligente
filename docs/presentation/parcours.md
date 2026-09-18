---
marp: true
theme: default
paginate: true
---

# Système de billetterie intelligente
## Parcours du projet

Vue d'ensemble de ce qui a été fait, phase par phase.

*Makhtar WADE · Elhadj Fallou Bousso*

---

## Le projet

Application de gestion pour un système de billetterie de **transport**, construite comme plusieurs services indépendants :

- **Service Utilisateurs** — comptes et authentification
- **Service Abonnements** — formules et souscriptions
- Service Billetterie / QR Code — pas encore développé

Chaque service a sa propre base de données ; seul le jeton JWT est partagé entre eux.

---

## Phase 1 — Service Utilisateurs

Backend Node/Express/MongoDB + frontend React.

- Authentification, rôles (administrateur, agent, client)
- Création individuelle et import CSV en masse
- Activation de compte, mot de passe temporaire
- Recherche, filtres, actions groupées, statistiques
- Couvert par des tests backend et frontend

---

## Phase 2 — Service Abonnements

Backend Node/Express/MySQL, connecté au front existant.

- Catalogue de formules (ticket simple, limité, illimité)
- Souscription, calcul d'expiration et de solde de voyages
- Cycle de vie : suspension, réactivation, résiliation, renouvellement
- Couvert par des tests backend

Ne se connecte jamais à la base du Service Utilisateurs : authentification via le jeton JWT partagé.

---

## Où on en est

- Deux services développés, testés et branchés sur un même frontend
- Documentation et tests à jour pour les deux phases
- Reste à construire : le Service Billetterie / QR Code, qui permettra d'utiliser concrètement un abonnement lors d'un trajet

---

# Merci

*Makhtar WADE · Elhadj Fallou Bousso*
