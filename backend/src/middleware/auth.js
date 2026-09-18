import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Vérifie le token JWT et attache l'utilisateur courant à req.user
export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Non autorisé : token manquant' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || user.status === 'Supprimé') {
      return res.status(401).json({ message: 'Non autorisé : utilisateur introuvable' });
    }
    if (user.status === 'Bloqué') {
      return res.status(403).json({ message: 'Compte bloqué' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Non autorisé : token invalide' });
  }
};

// Restreint l'accès aux administrateurs
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'Administrateur') {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
};

// Autorise les administrateurs ET les agents (ex : lecture d'identités
// minimales pour le contrôle sur le terrain).
export const isAdminOrAgent = (req, res, next) => {
  if (req.user && ['Administrateur', 'Agent'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé au personnel autorisé (agents et administrateurs)' });
};

// Bloque l'accès tant que le mot de passe temporaire n'a pas été remplacé.
// Le drapeau mustChangePassword permet au front de rediriger vers la page profil.
export const requirePasswordChanged = (req, res, next) => {
  if (req.user && req.user.mustChangePassword) {
    return res.status(403).json({
      message: 'Vous devez changer votre mot de passe temporaire avant de continuer',
      mustChangePassword: true,
    });
  }
  next();
};
