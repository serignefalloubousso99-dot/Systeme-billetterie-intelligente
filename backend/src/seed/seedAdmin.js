import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';

dotenv.config();

// Crée (ou réactive) un administrateur initial pour amorcer le système.
// Identifiants configurables via ADMIN_EMAIL / ADMIN_PASSWORD.
const seedAdmin = async () => {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || 'admin@billetterie.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin1234';

  let admin = await User.findOne({ email });
  if (admin) {
    admin.password = password; // re-haché par le hook pre('save')
    admin.status = 'Actif';
    admin.role = 'Administrateur';
    admin.mustChangePassword = false;
    await admin.save();
    console.log(`Admin existant réinitialisé : ${email}`);
  } else {
    admin = await User.create({
      nom: 'Admin',
      prenom: 'Super',
      email,
      telephone: '+221770000000',
      role: 'Administrateur',
      status: 'Actif',
      password,
      mustChangePassword: false,
    });
    console.log(`Admin créé : ${email}`);
  }

  console.log(`  Mot de passe : ${password}`);
  await mongoose.disconnect();
  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error('Échec du seed admin :', err.message);
  process.exit(1);
});
