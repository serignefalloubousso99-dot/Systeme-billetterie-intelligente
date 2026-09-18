import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';

dotenv.config();

/**
 * Prépare la base à l'index unique sur le numéro de téléphone.
 *
 * MongoDB refuse de créer un index unique tant que des doublons subsistent.
 * Ce script les repère et attribue un numéro distinct à chaque compte
 * surnuméraire, en conservant le numéro d'origine au plus ancien.
 *
 *   npm run fix:telephones           → simple diagnostic, aucune écriture
 *   npm run fix:telephones -- --appliquer → applique les corrections
 *
 * Aucun compte n'est supprimé : seuls des numéros sont réattribués.
 */

// Numéro de remplacement lisible, dérivé du rang du compte.
// Le préfixe 09 signale clairement une valeur corrigée automatiquement.
const numeroDeRemplacement = (index) => `+2210900${String(index).padStart(5, '0')}`;

const dedoublonner = async () => {
  const appliquer = process.argv.includes('--appliquer');
  await connectDB();

  const groupes = await User.aggregate([
    { $group: { _id: '$telephone', comptes: { $push: { id: '$_id', email: '$email', creeLe: '$createdAt' } } } },
    { $match: { 'comptes.1': { $exists: true } } },
  ]);

  if (groupes.length === 0) {
    console.log('Aucun doublon : la base est prête pour l’index unique.');
    await mongoose.disconnect();
    return;
  }

  console.log(`${groupes.length} numéro(s) partagé(s) par plusieurs comptes :\n`);
  let rang = 0;

  for (const groupe of groupes) {
    console.log(`  ${groupe._id}`);
    // Le compte le plus ancien garde le numéro d'origine.
    const tries = groupe.comptes.sort((a, b) => new Date(a.creeLe) - new Date(b.creeLe));

    for (const [position, compte] of tries.entries()) {
      if (position === 0) {
        console.log(`    conserve  ${compte.email}`);
        continue;
      }
      rang++;
      const nouveau = numeroDeRemplacement(rang);
      console.log(`    ${appliquer ? 'corrige ' : 'à corriger'}  ${compte.email} → ${nouveau}`);
      if (appliquer) {
        await User.updateOne({ _id: compte.id }, { $set: { telephone: nouveau } });
      }
    }
  }

  console.log('');
  if (appliquer) {
    console.log('Corrections appliquées. La base accepte désormais l’index unique.');
  } else {
    console.log('Diagnostic uniquement. Relancez avec --appliquer pour corriger.');
  }

  await mongoose.disconnect();
};

dedoublonner().catch(async (error) => {
  console.error(`Échec : ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
