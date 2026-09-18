import jwt from 'jsonwebtoken';

/**
 * Middleware d'authentification partagé avec le Service Utilisateurs.
 * Vérifie la présence et la validité du jeton JWT.
 */
export const protect = (req, res, next) => {
  const entete = req.headers.authorization;

  if (!entete || !entete.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  const token = entete.split(' ')[1];

  try {
    const decode = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decode;
    req.token = entete;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Jeton expiré, veuillez vous reconnecter' });
    }
    return res.status(401).json({ message: 'Jeton invalide' });
  }
};

/**
 * Réserve l'accès aux administrateurs.
 */
export const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'Administrateur') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
};

/**
 * Autorise les agents et les administrateurs (ex: pour le scan et la consultation).
 */
export const isAgentOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (role !== 'Administrateur' && role !== 'Agent') {
    return res.status(403).json({ message: 'Accès réservé au personnel autorisé (Agents et Administrateurs)' });
  }
  next();
};

/**
 * Autorise les agents, les administrateurs, ET un client consultant SES
 * PROPRES titres uniquement (jamais ceux d'un autre passager).
 */
export const isSelfOrStaff = (req, res, next) => {
  const { id, role } = req.user || {};
  if (role === 'Administrateur' || role === 'Agent') {
    return next();
  }
  if (role === 'Client' && id === req.params.utilisateurId) {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé à son propre compte, aux agents et aux administrateurs' });
};
