import { Readable } from 'stream';
import csv from 'csv-parser';
import User from '../models/User.js';
import { generateTempPassword } from '../utils/generatePassword.js';

const ROLES = ['Administrateur', 'Agent', 'Client'];
const EMAIL_REGEX = /\S+@\S+\.\S+/;

// Parse le buffer CSV en flux et retourne un tableau de lignes (objets)
const parseCsvBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

// Valide une ligne CSV ; retourne un message d'erreur ou null si valide
const validateRow = (row) => {
  if (!row.nom || !row.prenom || !row.email || !row.telephone) {
    return 'Champs obligatoires manquants (nom, prenom, email, telephone)';
  }
  if (!EMAIL_REGEX.test(row.email)) {
    return 'Email invalide';
  }
  if (row.role && !ROLES.includes(row.role)) {
    return `Rôle invalide (${ROLES.join(', ')})`;
  }
  return null;
};

// POST /api/admin/users/import — Importation en masse via fichier CSV
export const importUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier CSV fourni (champ "file")' });
    }

    const rows = await parseCsvBuffer(req.file.buffer);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Le fichier CSV est vide' });
    }

    const summary = { total: rows.length, imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ligne = i + 2; // +1 en-tête, +1 index base 1

      const validationError = validateRow(row);
      if (validationError) {
        summary.skipped++;
        summary.errors.push({ ligne, email: row.email || null, raison: validationError });
        continue;
      }

      const email = row.email.toLowerCase().trim();
      const existing = await User.findOne({ email });
      if (existing) {
        summary.skipped++;
        summary.errors.push({ ligne, email, raison: 'Email déjà existant' });
        continue;
      }

      // Le numéro doit être unique, y compris vis-à-vis des lignes déjà
      // importées lors de ce même fichier : la vérification interroge la base,
      // qui contient déjà les créations précédentes.
      const telephone = row.telephone.trim();
      const telephonePris = await User.findOne({ telephone });
      if (telephonePris) {
        summary.skipped++;
        summary.errors.push({ ligne, email, raison: 'Téléphone déjà utilisé' });
        continue;
      }

      try {
        await User.create({
          nom: row.nom.trim(),
          prenom: row.prenom.trim(),
          email,
          telephone,
          role: row.role || 'Client',
          password: generateTempPassword(),
          status: 'Bloqué', // activation ultérieure par l'administrateur
        });
        summary.imported++;
      } catch (err) {
        summary.skipped++;
        summary.errors.push({ ligne, email, raison: err.message });
      }
    }

    return res.status(200).json({
      message: `Importation terminée : ${summary.imported} créé(s), ${summary.skipped} ignoré(s)`,
      count: summary.imported, // champ attendu par le front
      summary,
    });
  } catch (error) {
    return res.status(500).json({ message: "Erreur lors de l'importation CSV", error: error.message });
  }
};
