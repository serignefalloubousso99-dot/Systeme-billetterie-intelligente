// Client API du Service Billetterie — voir PLAN-SERVICE-BILLETTERIE.md §4 pour le contrat.
// Branché sur le service billetterie (service-billetterie/, port 5070, PostgreSQL).

// Se déduit de l'hôte utilisé pour charger la page — voir api.js.
const API_URL = import.meta.env.VITE_BILLETTERIE_API_URL || `http://${window.location.hostname}:5070/api/billetterie`;

export class ApiBilletterieError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  return localStorage.getItem('token');
}

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
    // Le Service Billetterie ne répond pas (arrêté, ou pas encore démarré) :
    // le message du navigateur n'a aucun sens pour l'utilisateur.
    throw new ApiBilletterieError("Impossible de contacter le service Billetterie. Vérifiez qu'il est démarré.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiBilletterieError(data.message || 'Erreur serveur', res.status);
  }
  return data;
}

function toQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

// --- Titres de transport et QR Codes ---

export async function creerTitre(payload) {
  return request('/titres', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getTitres(params = {}) {
  return request(`/titres${toQueryString(params)}`);
}

export async function getTitre(id) {
  return request(`/titres/${id}`);
}

export async function changerStatutTitre(id, statut) {
  return request(`/titres/${id}/statut`, {
    method: 'PATCH',
    body: JSON.stringify({ statut }),
  });
}

export async function getTitresClient(utilisateurId) {
  return request(`/titres/client/${utilisateurId}`);
}

// --- Scan et Validations ---

export async function scannerValidation(code) {
  return request('/validations/scan', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function getValidations(params = {}) {
  return request(`/validations${toQueryString(params)}`);
}

export async function getValidation(id) {
  return request(`/validations/${id}`);
}

// --- Piste d'audit ---

export async function getAudits(params = {}) {
  return request(`/audit${toQueryString(params)}`);
}

// --- Tableau de bord et Statistiques ---

export async function getStatsBilletterie() {
  return request('/dashboard/stats');
}
