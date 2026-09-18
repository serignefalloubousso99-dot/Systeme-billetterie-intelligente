import jwt from 'jsonwebtoken';

/**
 * Authentification du Service Abonnements.
 *
 * Les jetons ne sont PAS émis ici : ils viennent du Service Utilisateurs, qui
 * les signe avec `JWT_SECRET`. Ce service se contente de les vérifier avec la
 * même clé — d'où l'obligation que `JWT_SECRET` soit identique dans les deux
 * `.env` (PLAN-SERVICE-ABONNEMENTS.md §1).
 *
 * Le rôle est lu dans la charge utile du jeton, sans aucun appel au Service
 * Utilisateurs ni à MongoDB : c'est ce qui garde les deux services réellement
 * indépendants.
 *
 * Contrepartie assumée : si un compte est bloqué ou rétrogradé après l'émission
 * du jeton, ce service continue de l'accepter jusqu'à expiration. Les jetons
 * étant à durée limitée, l'écart reste borné.
 */

// Vérifie le jeton et attache l'identité à req.utilisateur
export const protect = (req, res, next) => {
  const entete = req.headers.authorization || '';

  if (!entete.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Non authentifié : jeton manquant' });
  }

  if (!process.env.JWT_SECRET) {
    // Erreur de configuration, pas une faute du client : on ne laisse
    // surtout pas passer la requête.
    return res.status(500).json({ message: 'JWT_SECRET non configuré sur le service' });
  }

  try {
    const charge = jwt.verify(entete.slice(7), process.env.JWT_SECRET);
    req.utilisateur = { id: charge.id, role: charge.role };
    next();
  } catch (error) {
    const expire = error.name === 'TokenExpiredError';
    return res.status(401).json({
      message: expire ? 'Session expirée, reconnectez-vous' : 'Non authentifié : jeton invalide',
    });
  }
};

// Réserve la route aux administrateurs
export const isAdmin = (req, res, next) => {
  if (req.utilisateur?.role === 'Administrateur') {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
};

/**
 * Autorise les administrateurs ET les agents.
 *
 * La vérification de validité est utilisée sur le terrain, au moment du
 * contrôle : c'est l'agent qui scanne, pas l'administrateur. La réserver aux
 * seuls administrateurs rendrait la fonctionnalité inutilisable.
 *
 * Les clients en restent exclus : interroger la validité d'un identifiant
 * quelconque reviendrait à exposer la situation d'autres passagers.
 */
export const isAdminOuAgent = (req, res, next) => {
  if (['Administrateur', 'Agent'].includes(req.utilisateur?.role)) {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé aux administrateurs et aux agents' });
};

/**
 * Autorise les administrateurs, les agents, ET un client consultant SON PROPRE
 * identifiant uniquement — jamais celui d'un autre passager, ce qui préserve
 * la raison d'être de la restriction ci-dessus (pas d'énumération de tiers).
 */
export const isSelfOuStaff = (req, res, next) => {
  const { id, role } = req.utilisateur || {};
  if (['Administrateur', 'Agent'].includes(role)) {
    return next();
  }
  if (role === 'Client' && id === req.params.utilisateurId) {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé à son propre compte, aux administrateurs et aux agents' });
};
