import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: [true, 'Le nom est obligatoire'],
      trim: true,
    },
    prenom: {
      type: String,
      required: [true, 'Le prénom est obligatoire'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "L'adresse email est obligatoire"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Veuillez entrer un email valide'],
    },
    telephone: {
      type: String,
      required: [true, 'Le numéro de téléphone est obligatoire'],
      // Un numéro identifie une personne : deux comptes ne peuvent pas le partager.
      // Les doublons existants doivent être traités avant la création de l'index
      // (voir `npm run fix:telephones`).
      unique: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['Administrateur', 'Agent', 'Client'],
      default: 'Client',
    },
    status: {
      type: String,
      enum: ['Actif', 'Bloqué', 'Supprimé'],
      // Les comptes créés attendent l'activation pour passer à 'Actif'
      default: 'Bloqué',
    },
    photo: {
      type: String, // URL ou chemin de l'image de profil
      default: '',
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire'],
    },
    mustChangePassword: {
      type: Boolean,
      // Force le changement au premier login si créé/activé par l'admin
      default: false,
    },
    // Lien de confirmation envoyé à l'activation. Il permet à l'utilisateur de
    // choisir lui-même son mot de passe, au lieu de se connecter avec celui
    // généré automatiquement. Les deux voies restent ouvertes.
    confirmationToken: {
      type: String,
      // `sparse` : l'unicité ne s'applique qu'aux documents qui portent
      // réellement un jeton. Sans cela, tous les comptes sans jeton
      // entreraient en collision sur la valeur nulle.
      unique: true,
      sparse: true,
      select: false,
    },
    confirmationTokenExpire: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true, // Génère createdAt et updatedAt
  }
);

// Hachage du mot de passe avant chaque sauvegarde (si modifié)
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Comparaison du mot de passe fourni avec le hash stocké
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Champ "date" (date de création formatée AAAA-MM-JJ) attendu par le front
UserSchema.virtual('date').get(function () {
  return this.createdAt ? this.createdAt.toISOString().split('T')[0] : '';
});

// Sérialisation JSON : inclut les virtuals (id, date) et masque le mot de passe
UserSchema.set('toJSON', {
  virtuals: true, // expose "id" (string) et "date" en plus de "_id"
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    // `select: false` ne protège que les requêtes : un document dont on vient
    // d'assigner le jeton en mémoire l'exposerait dans la réponse. Or il ne
    // doit circuler que par e-mail, vers son seul destinataire.
    delete ret.confirmationToken;
    delete ret.confirmationTokenExpire;
    return ret;
  },
});

export default mongoose.model('User', UserSchema);
