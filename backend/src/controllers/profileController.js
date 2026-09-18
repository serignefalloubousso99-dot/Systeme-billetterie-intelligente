import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import { PHOTO_DIR } from '../middleware/upload.js';

// GET /api/users/profile — Informations du compte connecté
export const getProfile = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

// PUT /api/users/profile — Mettre à jour nom, prénom, téléphone et photo
export const updateProfile = async (req, res) => {
  try {
    const { nom, prenom, telephone, photo } = req.body;
    const user = req.user;

    // Le numéro doit rester unique, sauf s'il s'agit déjà du sien.
    if (telephone !== undefined && telephone.trim() !== user.telephone) {
      const telephonePris = await User.findOne({ telephone: telephone.trim(), _id: { $ne: user._id } });
      if (telephonePris) {
        return res.status(409).json({ message: 'Ce numéro de téléphone est déjà utilisé' });
      }
    }

    if (nom !== undefined) user.nom = nom;
    if (prenom !== undefined) user.prenom = prenom;
    if (telephone !== undefined) user.telephone = telephone;
    if (photo !== undefined) user.photo = photo;

    await user.save();
    return res.status(200).json({ message: 'Profil mis à jour', user });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error: error.message });
  }
};

// PUT /api/users/profile/password — Modifier le mot de passe après confirmation de l'ancien
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = req.user;

    // Mot de passe temporaire : la connexion avec ce mot de passe a déjà
    // prouvé l'identité, on ne fait pas retaper l'utilisateur. Ce
    // contournement ne s'applique qu'à ce cas précis (mustChangePassword),
    // jamais à un changement de mot de passe volontaire depuis le profil.
    const skipOldPasswordCheck = user.mustChangePassword;

    if (!newPassword || (!skipOldPasswordCheck && !oldPassword)) {
      return res.status(400).json({ message: 'Ancien et nouveau mot de passe requis' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }

    if (!skipOldPasswordCheck && !(await user.comparePassword(oldPassword))) {
      return res.status(401).json({ message: 'Ancien mot de passe incorrect' });
    }
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({ message: "Le nouveau mot de passe doit être différent de l'ancien" });
    }

    user.password = newPassword; // haché par le hook pre('save')
    user.mustChangePassword = false; // le mot de passe temporaire est remplacé
    await user.save();

    // Un mot de passe choisi par l'utilisateur neutralise tout lien de
    // confirmation encore en circulation. Sans cela, l'e-mail d'activation
    // permettait de reprendre le compte pendant 48 h, même après que son
    // propriétaire avait défini son propre mot de passe.
    // $unset direct : les champs sont `select: false` et absents de req.user,
    // une assignation sur le document ne serait pas persistée.
    await User.updateOne(
      { _id: user._id },
      { $unset: { confirmationToken: 1, confirmationTokenExpire: 1 } }
    );

    return res.status(200).json({ message: 'Mot de passe modifié', user });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors du changement de mot de passe', error: error.message });
  }
};

// POST /api/users/profile/photo — Téléverser une photo de profil
export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucune image fournie (champ "photo")' });
    }

    const user = req.user;
    const ancienne = user.photo;

    // Chemin public servi en statique par Express
    user.photo = `/uploads/photos/${req.file.filename}`;
    await user.save();

    // Supprime l'ancienne photo pour ne pas accumuler de fichiers orphelins
    if (ancienne && ancienne.startsWith('/uploads/photos/')) {
      const ancienChemin = path.join(PHOTO_DIR, path.basename(ancienne));
      fs.promises.unlink(ancienChemin).catch(() => {});
    }

    return res.status(200).json({ message: 'Photo mise à jour', photo: user.photo, user });
  } catch (error) {
    return res.status(500).json({ message: "Erreur lors du téléversement de la photo", error: error.message });
  }
};
