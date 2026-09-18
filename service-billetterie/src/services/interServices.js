import logger from '../config/logger.js';

const SERVICE_UTILISATEURS_URL =
  process.env.SERVICE_UTILISATEURS_URL || 'http://localhost:5050';
const SERVICE_ABONNEMENTS_URL =
  process.env.SERVICE_ABONNEMENTS_URL || 'http://localhost:5065';

const TIMEOUT_MS = 5000;

/**
 * Helper d'appel HTTP avec timeout et gestion d'erreurs réseau.
 */
async function fetchAvecTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Interroge le Service Abonnements pour consommer un voyage sur un abonnement.
 * Endpoint cible : POST /api/abonnements/souscriptions/:id/consommer
 */
export const consommerVoyageAbonnement = async (abonnementId, validationId, token) => {
  const url = `${SERVICE_ABONNEMENTS_URL}/api/abonnements/souscriptions/${abonnementId}/consommer`;
  logger.info(`Appel inter-service : Consommation abonnement #${abonnementId} (Validation ${validationId})`);

  try {
    const res = await fetchAvecTimeout(url, {
      method: 'POST',
      headers: token ? { Authorization: token } : {},
      body: JSON.stringify({ validationId }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      logger.info(`Réponse Service Abonnements : Voyage consommé avec succès pour #${abonnementId}`);
      return {
        succes: true,
        statutHttp: res.status,
        donnees: data,
      };
    } else {
      logger.warn(`Réponse Service Abonnements : Refus HTTP ${res.status} - ${data.message || 'Erreur'}`);
      return {
        succes: false,
        statutHttp: res.status,
        message: data.message || 'Refus du voyage par le service abonnements',
      };
    }
  } catch (error) {
    logger.error(`Erreur réseau inter-service vers Service Abonnements : ${error.message}`);
    return {
      succes: false,
      statutHttp: 503,
      indisponible: true,
      message: 'Service Abonnements indisponible',
    };
  }
};

/**
 * Vérifie la validité d'un utilisateur auprès du Service Abonnements.
 * Endpoint cible : GET /api/abonnements/validite/:utilisateurId
 */
export const verifierValiditeAbonnementClient = async (utilisateurId, token) => {
  const url = `${SERVICE_ABONNEMENTS_URL}/api/abonnements/validite/${utilisateurId}`;
  logger.info(`Appel inter-service : Vérification validité pour client ${utilisateurId}`);

  try {
    const res = await fetchAvecTimeout(url, {
      method: 'GET',
      headers: token ? { Authorization: token } : {},
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { succes: true, data };
    }
    return { succes: false, statutHttp: res.status, message: data.message };
  } catch (error) {
    logger.error(`Erreur réseau inter-service (validité) : ${error.message}`);
    return { succes: false, indisponible: true, message: 'Service Abonnements indisponible' };
  }
};

/**
 * Vérifie l'existence d'un abonnement auprès du Service Abonnements.
 * Endpoint cible : GET /api/abonnements/souscriptions/:id
 */
export const verifierAbonnementExiste = async (abonnementId, token) => {
  const url = `${SERVICE_ABONNEMENTS_URL}/api/abonnements/souscriptions/${abonnementId}`;
  logger.info(`Appel inter-service : Vérification abonnement #${abonnementId}`);

  try {
    const res = await fetchAvecTimeout(url, {
      method: 'GET',
      headers: token ? { Authorization: token } : {},
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { succes: true, abonnement: data.abonnement || data };
    }
    return { succes: false, statutHttp: res.status, message: data.message };
  } catch (error) {
    logger.error(`Erreur réseau inter-service (abonnement) : ${error.message}`);
    return { succes: false, indisponible: true, message: 'Service Abonnements indisponible' };
  }
};

/**
 * Vérifie l'existence et l'état d'un compte client ou agent auprès du Service Utilisateurs.
 */
export const verifierUtilisateurExiste = async (utilisateurId, token) => {
  const url = `${SERVICE_UTILISATEURS_URL}/api/admin/users/${utilisateurId}`;
  logger.info(`Appel inter-service : Vérification utilisateur ${utilisateurId}`);

  try {
    const res = await fetchAvecTimeout(url, {
      method: 'GET',
      headers: token ? { Authorization: token } : {},
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { succes: true, user: data.user || data };
    }
    return { succes: false, statutHttp: res.status, message: data.message };
  } catch (error) {
    logger.error(`Erreur réseau inter-service (utilisateur) : ${error.message}`);
    return { succes: false, indisponible: true, message: 'Service Utilisateurs indisponible' };
  }
};
