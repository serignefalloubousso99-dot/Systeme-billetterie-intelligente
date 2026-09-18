/**
 * Crée un jeu de données de démonstration couvrant tous les statuts et
 * motifs de refus, sans jamais toucher aux données déjà en base (aucun
 * "force sync", uniquement des créations via les vraies API REST — comme
 * un administrateur le ferait depuis l'interface).
 *
 * Prérequis : les 3 services backend tournent déjà (npm run dev côté user).
 *
 * Usage : node scripts/seed-demo-scenarios.mjs
 */

const USERS_API = 'http://localhost:5050/api';
const ABOS_API = 'http://localhost:5065/api/abonnements';
const BILLETTERIE_API = 'http://localhost:5070/api/billetterie';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@billetterie.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234';

const todayISO = () => new Date().toISOString().split('T')[0];
const ajouterJours = (dateISO, jours) => {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().split('T')[0];
};

let token = null;

async function appel(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const corps = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${url} -> ${res.status} : ${corps.message || JSON.stringify(corps)}`);
  }
  return corps;
}

async function login() {
  const res = await appel(`${USERS_API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  token = res.token;
  console.log(`Connecté en tant qu'administrateur (${ADMIN_EMAIL}).`);
}

async function trouverClientsActifs() {
  const users = await appel(`${USERS_API}/admin/users?role=Client&limit=100`);
  const actifs = users.filter((u) => u.status === 'Actif');
  if (actifs.length < 4) {
    throw new Error(
      `Il faut au moins 4 clients au statut Actif pour ce jeu de démo (trouvé : ${actifs.length}). ` +
      'Activez quelques comptes clients depuis Gestion des Comptes puis relancez.'
    );
  }
  return actifs;
}

async function souscrire(utilisateurId, formuleId, dateDebut) {
  const res = await appel(`${ABOS_API}/souscriptions`, {
    method: 'POST',
    body: JSON.stringify({ utilisateurId, formuleId, dateDebut }),
  });
  return res.abonnement;
}

async function changerStatutAbonnement(id, statut) {
  await appel(`${ABOS_API}/souscriptions/${id}/statut`, {
    method: 'PATCH',
    body: JSON.stringify({ statut }),
  });
}

async function consommerVoyage(abonnementId, validationId) {
  await appel(`${ABOS_API}/souscriptions/${abonnementId}/consommer`, {
    method: 'POST',
    body: JSON.stringify({ validationId }),
  });
}

async function creerTitre({ utilisateurId, typeTitre, abonnementId, dateExpiration }) {
  const res = await appel(`${BILLETTERIE_API}/titres`, {
    method: 'POST',
    body: JSON.stringify({ utilisateurId, typeTitre, abonnementId, dateExpiration }),
  });
  return res.titre;
}

async function changerStatutTitre(id, statut) {
  await appel(`${BILLETTERIE_API}/titres/${id}/statut`, {
    method: 'PATCH',
    body: JSON.stringify({ statut }),
  });
}

async function scanner(code) {
  return appel(`${BILLETTERIE_API}/validations/scan`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

const resultats = [];
const noter = (scenario, titre, attendu) => {
  resultats.push({ scenario, code: titre.codeUnique, statutTitre: titre.statut, attendu });
};

async function main() {
  await login();
  const [clientA, clientB, clientC, clientD] = await trouverClientsActifs();
  console.log(
    `Clients utilisés : ${clientA.prenom} ${clientA.nom}, ${clientB.prenom} ${clientB.nom}, ` +
    `${clientC.prenom} ${clientC.nom}, ${clientD.prenom} ${clientD.nom}`
  );

  // --- 1. Tickets simples (client A) — cumulables, aucune contrainte ---
  console.log('\n1. Tickets simples...');

  const ticketActif = await creerTitre({ utilisateurId: clientA.id, typeTitre: 'TICKET_SIMPLE' });
  noter('Ticket simple valide (à scanner en live)', ticketActif, 'AUTORISE, puis consommé');

  const ticketAConsommer = await creerTitre({ utilisateurId: clientA.id, typeTitre: 'TICKET_SIMPLE' });
  await scanner(ticketAConsommer.codeUnique);
  noter('Ticket simple déjà utilisé', ticketAConsommer, 'REFUSE — TICKET_DEJA_UTILISE');

  const ticketADesactiver = await creerTitre({ utilisateurId: clientA.id, typeTitre: 'TICKET_SIMPLE' });
  await changerStatutTitre(ticketADesactiver.id, 'DESACTIVE');
  noter('Ticket simple désactivé', ticketADesactiver, 'REFUSE — QR_CODE_DESACTIVE');

  const ticketExpire = await creerTitre({
    utilisateurId: clientA.id,
    typeTitre: 'TICKET_SIMPLE',
    dateExpiration: ajouterJours(todayISO(), -1),
  });
  noter('Ticket simple expiré', ticketExpire, 'REFUSE — ABONNEMENT_EXPIRE (au 1er scan)');

  // --- 2. Abonnement épuisé (client B) ---
  console.log('2. Abonnement épuisé (10 voyages consommés)...');
  const aboEpuise = await souscrire(clientB.id, 2, todayISO()); // Carnet 10 voyages
  for (let i = 0; i < 10; i++) {
    await consommerVoyage(aboEpuise.id, `DEMO-EPUISE-${aboEpuise.id}-${i}`);
  }
  const titreEpuise = await creerTitre({ utilisateurId: clientB.id, typeTitre: 'LIMITE', abonnementId: aboEpuise.id });
  noter('Abonnement limité épuisé', titreEpuise, 'REFUSE — SOLDE_EPUISE');

  // --- 3. Abonnement résilié (client B, réutilisable après résiliation) ---
  console.log('3. Abonnement résilié...');
  const aboResilie = await souscrire(clientB.id, 5, todayISO()); // Illimité mensuel
  await changerStatutAbonnement(aboResilie.id, 'RESILIE');
  const titreResilie = await creerTitre({ utilisateurId: clientB.id, typeTitre: 'ILLIMITE', abonnementId: aboResilie.id });
  noter('Abonnement illimité résilié', titreResilie, 'REFUSE — ABONNEMENT_RESILIE');

  // --- 4. Abonnement expiré depuis la souscription (client B) ---
  console.log('4. Abonnement expiré (date de début antérieure)...');
  const aboExpire = await souscrire(clientB.id, 3, ajouterJours(todayISO(), -40)); // Mensuel 20 voyages, 30j
  const titreAboExpire = await creerTitre({ utilisateurId: clientB.id, typeTitre: 'LIMITE', abonnementId: aboExpire.id });
  noter('Abonnement limité expiré', titreAboExpire, 'REFUSE — ABONNEMENT_EXPIRE');

  // --- 5. Abonnement suspendu (client C) ---
  console.log('5. Abonnement suspendu...');
  const aboSuspendu = await souscrire(clientC.id, 3, todayISO()); // Mensuel 20 voyages
  await changerStatutAbonnement(aboSuspendu.id, 'SUSPENDU');
  const titreSuspendu = await creerTitre({ utilisateurId: clientC.id, typeTitre: 'LIMITE', abonnementId: aboSuspendu.id });
  noter('Abonnement limité suspendu', titreSuspendu, 'REFUSE — ABONNEMENT_SUSPENDU');

  // --- 6. Abonnement limité actif, à décompter en live (client D) ---
  console.log('6. Abonnement limité actif (décompte en direct)...');
  const aboActif = await souscrire(clientD.id, 3, todayISO()); // Mensuel 20 voyages
  const titreLimiteActif = await creerTitre({ utilisateurId: clientD.id, typeTitre: 'LIMITE', abonnementId: aboActif.id });
  noter('Abonnement limité actif (20 voyages)', titreLimiteActif, 'AUTORISE, décompte à chaque scan');

  // --- Récapitulatif ---
  console.log('\n=== Jeu de démonstration prêt ===');
  console.log('Code inconnu à tester : n\'importe quelle chaîne au hasard -> REFUSE (QR_CODE_INCONNU)\n');
  for (const r of resultats) {
    console.log(`- ${r.scenario}`);
    console.log(`    Code   : ${r.code}`);
    console.log(`    Attendu: ${r.attendu}`);
  }
  console.log(
    '\nRetrouvez chaque QR Code (image scannable) dans Titres & QR -> icône QR sur la ligne correspondante.'
  );
}

main().catch((err) => {
  console.error('\nÉchec du script :', err.message);
  process.exit(1);
});
