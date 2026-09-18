import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Génère un token JWT pour un utilisateur
const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/login — Authentifie un utilisateur et retourne un JWT
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    if (user.status !== 'Actif') {
      return res.status(403).json({ message: 'Compte non actif. Contactez un administrateur.' });
    }

    const token = signToken(user);
    return res.status(200).json({ token, user });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message });
  }
};

// POST /api/auth/logout — Déconnexion (JWT stateless : invalidation côté client)
export const logout = async (req, res) => {
  return res.status(200).json({ message: 'Déconnexion réussie' });
};
