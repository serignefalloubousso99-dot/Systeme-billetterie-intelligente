// Client API du Service Abonnements — voir PLAN-SERVICE-ABONNEMENTS.md §4 pour le contrat.
//
// Branché sur le vrai service (service-abonnements/, port 5065, MySQL).
// A tourné en simulation en mémoire le temps que le backend soit prêt (voir
// l'historique git de ce fichier) ; signatures et formes de réponse inchangées
// pour les composants qui le consomment.
//
// Port 5065, pas 5060 : 5060/5061 (SIP) sont sur la liste des ports "unsafe"
// des navigateurs Chromium, qui refusent toute requête HTTP dessus
// (ERR_UNSAFE_PORT) quel que soit le serveur en face.
export const USING_SIMULATION = false;

// Se déduit de l'hôte utilisé pour charger la page — voir api.js.
const API_URL = import.meta.env.VITE_ABONNEMENTS_API_URL || `http://${window.location.hostname}:5065/api/abonnements`;

export class ApiAbonnementsError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  return localStorage.getItem('token');
}

// Le jeton vient du Service Utilisateurs (même JWT_SECRET des deux côtés,
// PLAN-SERVICE-ABONNEMENTS.md §1) : pas d'authentification propre ici.
async function request(path, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // Le Service Abonnements ne répond pas (arrêté, ou pas encore démarré) :
    // le message du navigateur n'a aucun sens pour l'utilisateur.
    throw new ApiAbonnementsError("Impossible de contacter le service Abonnements. Vérifiez qu'il est démarré.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiAbonnementsError(data.message || 'Erreur serveur', res.status);
  }
  return data;
}

// Construit une query string en ignorant les paramètres non fournis.
function toQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

// --- 4.1 Formules ---

export async function createFormule(payload) {
  return request('/formules', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getFormules(params = {}) {
  return request(`/formules${toQueryString(params)}`);
}

export async function getFormuleById(id) {
  return request(`/formules/${id}`);
}

export async function updateFormule(id, payload) {
  return request(`/formules/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function setFormuleActive(id, actif) {
  return request(`/formules/${id}/actif`, { method: 'PATCH', body: JSON.stringify({ actif }) });
}

// --- 4.2 Souscriptions ---

export async function createSouscription(payload) {
  return request('/souscriptions', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getSouscriptions(params = {}) {
  return request(`/souscriptions${toQueryString(params)}`);
}

export async function getSouscriptionById(id) {
  return request(`/souscriptions/${id}`);
}

export async function setSouscriptionStatut(id, statut) {
  return request(`/souscriptions/${id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut }) });
}

export async function renouvelerSouscription(id, dateDebut) {
  return request(`/souscriptions/${id}/renouveler`, {
    method: 'POST',
    body: JSON.stringify({ dateDebut }),
  });
}

// --- 4.3 Consommation et historique ---

export async function consommerVoyage(id, validationId) {
  return request(`/souscriptions/${id}/consommer`, {
    method: 'POST',
    body: JSON.stringify({ validationId }),
  });
}

export async function getHistorique(id) {
  return request(`/souscriptions/${id}/historique`);
}

// --- 4.4 Vérification de validité ---

export async function verifierValidite(utilisateurId) {
  return request(`/validite/${utilisateurId}`);
}

// --- 4.5 Statistiques ---

export async function getStatsAbonnements() {
  return request('/dashboard/stats');
}
