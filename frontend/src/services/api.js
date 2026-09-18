// Se déduit de l'hôte utilisé pour charger la page (localhost, 127.0.0.1, ou
// une IP réseau pour un accès depuis un autre appareil) : évite de figer une
// IP en dur, qui change à chaque reconnexion Wi-Fi/redémarrage.
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5050/api`;

// Origine du serveur (sans le /api), pour les fichiers servis en statique
const SERVER_ORIGIN = API_URL.replace(/\/api\/?$/, '');

// Construit l'URL complète d'une photo de profil ('' si aucune photo)
export function photoUrl(photo) {
  if (!photo) return '';
  if (/^https?:\/\//i.test(photo)) return photo;
  return `${SERVER_ORIGIN}${photo}`;
}

function getToken() {
  return localStorage.getItem('token');
}

export function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getStoredUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

// Met à jour l'utilisateur stocké sans toucher au token
export function setStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function isAuthenticated() {
  return !!getToken();
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // Le serveur du Service Utilisateurs ne répond pas (arrêté, ou pas
    // encore démarré) : le message du navigateur ("Failed to fetch",
    // "NetworkError...") n'a aucun sens pour l'utilisateur.
    throw new Error("Impossible de contacter le serveur. Vérifiez qu'il est démarré.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || 'Erreur serveur');
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  // --- Confirmation de compte par lien (public, pas de session) ---
  verifyConfirmationToken: (token) => request(`/auth/confirmation/${token}`),

  confirmAccount: (token, motDePasse) =>
    request(`/auth/confirmation/${token}`, {
      method: 'POST',
      body: JSON.stringify({ motDePasse }),
    }),

  resendConfirmationLink: (userId) =>
    request(`/admin/users/${userId}/confirmation/renvoyer`, { method: 'POST' }),

  getUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/users${query ? `?${query}` : ''}`);
  },

  // Identité minimale (nom, prénom, téléphone), accessible aux agents —
  // contrairement à getUsers ci-dessus, réservé aux administrateurs.
  lookupUsers: (ids = []) => {
    if (ids.length === 0) return Promise.resolve({ users: [] });
    return request(`/users/lookup?ids=${ids.join(',')}`);
  },

  createUser: (userData) =>
    request('/admin/users', { method: 'POST', body: JSON.stringify(userData) }),

  updateUser: (id, userData) =>
    request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) }),

  importUsers: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/admin/users/import', { method: 'POST', body: formData });
  },

  bulkStatus: (userIds, action) =>
    request('/admin/users/bulk-status', {
      method: 'PATCH',
      body: JSON.stringify({ userIds, action }),
    }),

  updateUserStatus: (id, status) =>
    request(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),

  getStats: () => request('/admin/dashboard/stats'),

  // --- Profil du compte connecté ---
  getProfile: () => request('/users/profile'),

  updateProfile: (data) =>
    request('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),

  changePassword: (oldPassword, newPassword) =>
    request('/users/profile/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),

  uploadPhoto: (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return request('/users/profile/photo', { method: 'POST', body: formData });
  },
};
