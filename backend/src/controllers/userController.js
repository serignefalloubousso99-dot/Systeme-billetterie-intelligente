import mongoose from 'mongoose';
import User from '../models/User.js';
import { generateTempPassword } from '../utils/generatePassword.js';
import { sendActivationEmail } from '../utils/sendEmail.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { genererConfirmationToken, dateExpirationToken } from '../utils/confirmationToken.js';

// Rôles acceptés par le service (doit rester aligné sur l'énumération du modèle)
const ROLES = ['Administrateur', 'Agent', 'Client'];

// GET /api/users/lookup?ids=id1,id2 — identité minimale (nom, prénom,
// téléphone) de plusieurs comptes, pour affichage lisible côté Billetterie
// (ex: nom du client sur un titre). Réservé au personnel (Admin/Agent) via
// le middleware de route ; volontairement dépourvu des champs sensibles
// (email, rôle, statut) exposés par GET /api/admin/users.
export const lookupUsers = async (req, res) => {
  try {
    const ids = (req.query.ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (ids.length === 0) {
      return res.status(200).json({ users: [] });
    }

    const users = await User.find({ _id: { $in: ids } }).select('nom prenom telephone');
    return res.status(200).json({ users });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la recherche des identités', error: error.message });
  }
};

// Construit le filtre Mongo à partir des query params (role, status, search)
const buildUserFilter = ({ role, status, search }) => {
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;

  if (search) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    const or = [{ email: regex }, { telephone: regex }, { nom: regex }, { prenom: regex }];
    // Recherche par identifiant unique si la chaîne est un ObjectId valide
    if (mongoose.Types.ObjectId.isValid(search)) {
      or.push({ _id: search });
    }
    filter.$or = or;
  }
  return filter;
};

// POST /api/admin/users — Créer un utilisateur individuel
export const createUser = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, role } = req.body;

    if (!nom || !prenom || !email || !telephone) {
      return res.status(400).json({ message: 'Champs obligatoires manquants (nom, prénom, email, téléphone)' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà' });
    }

    const telephonePris = await User.findOne({ telephone: telephone.trim() });
    if (telephonePris) {
      return res.status(409).json({ message: 'Ce numéro de téléphone est déjà utilisé' });
    }

    // Mot de passe temporaire ; le compte reste 'Bloqué' jusqu'à activation
    const tempPassword = generateTempPassword();
    const user = await User.create({
      nom,
      prenom,
      email,
      telephone,
      role: role || 'Client',
      password: tempPassword,
      status: 'Bloqué',
    });

    return res.status(201).json({ message: 'Utilisateur créé', user });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la création', error: error.message });
  }
};

// GET /api/admin/users — Liste filtrée / recherchable (renvoie un tableau)
export const getUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const filter = buildUserFilter({ role, status, search });

    const users = await User.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération', error: error.message });
  }
};

// GET /api/admin/users/:id — Détail d'un utilisateur
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// PUT /api/admin/users/:id — Mettre à jour un utilisateur
export const updateUser = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, role, photo } = req.body;

    // Une saisie invalide doit renvoyer 400, jamais une erreur serveur.
    if (role !== undefined && !ROLES.includes(role)) {
      return res.status(400).json({ message: `Rôle invalide. Valeurs autorisées : ${ROLES.join(', ')}` });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // Le numéro doit rester unique, sauf s'il s'agit du sien : renvoyer sa
    // fiche inchangée depuis le formulaire ne doit pas provoquer un refus.
    if (telephone !== undefined && telephone.trim() !== user.telephone) {
      const telephonePris = await User.findOne({ telephone: telephone.trim(), _id: { $ne: user._id } });
      if (telephonePris) {
        return res.status(409).json({ message: 'Ce numéro de téléphone est déjà utilisé' });
      }
    }

    // L'email reste l'identifiant de connexion : on autorise la correction
    // d'une erreur de saisie, avec le même garde-fou d'unicité que le
    // téléphone. Le JWT ne porte que l'id et le rôle (jamais l'email), donc
    // le changer n'invalide aucune session en cours.
    let emailNormalise;
    if (email !== undefined) {
      emailNormalise = email.trim().toLowerCase();
      if (!/\S+@\S+\.\S+/.test(emailNormalise)) {
        return res.status(400).json({ message: 'Adresse email invalide' });
      }
      if (emailNormalise !== user.email) {
        const emailPris = await User.findOne({ email: emailNormalise, _id: { $ne: user._id } });
        if (emailPris) {
          return res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà' });
        }
      }
    }

    if (nom !== undefined) user.nom = nom;
    if (prenom !== undefined) user.prenom = prenom;
    if (emailNormalise !== undefined) user.email = emailNormalise;
    if (telephone !== undefined) user.telephone = telephone;
    if (role !== undefined) user.role = role;
    if (photo !== undefined) user.photo = photo;

    await user.save();
    return res.status(200).json({ message: 'Utilisateur mis à jour', user });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la mise à jour', error: error.message });
  }
};

// DELETE /api/admin/users/:id — Suppression logique (status = 'Supprimé')
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    user.status = 'Supprimé';
    await user.save();
    return res.status(200).json({ message: 'Utilisateur supprimé', user });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la suppression', error: error.message });
  }
};

// Statuts valides et mapping des verbes d'action vers un statut cible.
// Le front envoie directement le statut ('Actif' | 'Bloqué' | 'Supprimé') ;
// on accepte aussi les verbes ('Activer' | 'Bloquer' | 'Supprimer') par robustesse.
const STATUTS = ['Actif', 'Bloqué', 'Supprimé'];
const VERBE_VERS_STATUT = { Activer: 'Actif', Bloquer: 'Bloqué', Supprimer: 'Supprimé' };

const normaliserStatutCible = (valeur) => VERBE_VERS_STATUT[valeur] || valeur;

// Applique un statut cible à un utilisateur.
// Passer à 'Actif' déclenche l'activation : mot de passe temporaire + email.
const setUserStatus = async (user, targetStatus) => {
  if (targetStatus === 'Actif') {
    const tempPassword = generateTempPassword();
    user.password = tempPassword; // le hook pre('save') s'occupe du hachage
    user.status = 'Actif';
    user.mustChangePassword = true;

    // Lien de confirmation, valable 48 h : il offre à l'utilisateur une
    // seconde voie, choisir son propre mot de passe plutôt qu'utiliser
    // le mot de passe temporaire.
    const token = genererConfirmationToken();
    user.confirmationToken = token;
    user.confirmationTokenExpire = dateExpirationToken();
    await user.save();

    const emailResult = await sendActivationEmail(user, tempPassword, token);
    return { id: user.id, status: user.status, emailSent: emailResult.sent };
  }

  user.status = targetStatus;
  await user.save();
  return { id: user.id, status: user.status };
};

// PATCH /api/admin/users/bulk-status — Actions groupées
export const bulkUpdateStatus = async (req, res) => {
  try {
    const { userIds, action } = req.body;
    const targetStatus = normaliserStatutCible(action);

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds doit être un tableau non vide' });
    }
    if (!STATUTS.includes(targetStatus)) {
      return res.status(400).json({ message: `Action invalide. Valeurs autorisées : ${STATUTS.join(', ')}` });
    }

    const users = await User.find({ _id: { $in: userIds } });
    const results = [];
    for (const user of users) {
      results.push(await setUserStatus(user, targetStatus));
    }

    return res.status(200).json({
      message: `Statut "${targetStatus}" appliqué à ${results.length} utilisateur(s)`,
      results,
    });
  } catch (error) {
    return res.status(500).json({ message: "Erreur lors de l'action groupée", error: error.message });
  }
};

// PATCH /api/admin/users/:id/status — Modifier le statut d'un utilisateur
export const updateUserStatus = async (req, res) => {
  try {
    const targetStatus = normaliserStatutCible(req.body.status);
    if (!STATUTS.includes(targetStatus)) {
      return res.status(400).json({ message: `Statut invalide. Valeurs autorisées : ${STATUTS.join(', ')}` });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const result = await setUserStatus(user, targetStatus);
    return res.status(200).json({ message: 'Statut mis à jour', ...result, user });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la mise à jour du statut', error: error.message });
  }
};

// GET /api/admin/dashboard/stats — Statistiques par rôle et par statut
export const getDashboardStats = async (req, res) => {
  try {
    const byRoleStatus = await User.aggregate([
      { $group: { _id: { role: '$role', status: '$status' }, count: { $sum: 1 } } },
    ]);

    const stats = { total: 0, byRole: {}, byStatus: { Actif: 0, Bloqué: 0, Supprimé: 0 } };
    for (const { _id, count } of byRoleStatus) {
      stats.total += count;
      stats.byRole[_id.role] = stats.byRole[_id.role] || { total: 0, Actif: 0, Bloqué: 0, Supprimé: 0 };
      stats.byRole[_id.role].total += count;
      stats.byRole[_id.role][_id.status] += count;
      stats.byStatus[_id.status] += count;
    }

    return res.status(200).json({ stats });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors du calcul des statistiques', error: error.message });
  }
};
