/**
 * Utilitaires partagés par toutes les suites de tests.
 *
 * Trois garanties sont assurées ici, et elles conditionnent la fiabilité de
 * l'ensemble des tests :
 *
 *   1. ISOLATION DES DONNÉES — les tests n'écrivent jamais dans la base de
 *      développement, mais dans une base dédiée supprimée à la fin.
 *   2. ISOLATION ENTRE FICHIERS — le lanceur exécute chaque fichier dans son
 *      propre processus, en parallèle. Le nom de la base est donc suffixé par
 *      le PID : sans cela, un fichier supprimait la base pendant qu'un autre
 *      l'utilisait encore (erreur « collection dropped » rencontrée en pratique).
 *   3. AUCUN E-MAIL RÉEL — la configuration SMTP est vidée, ce qui place le
 *      service d'envoi en mode dégradé : il journalise au lieu d'expédier.
 *
 * Sans la garantie 3, faire tourner la suite enverrait de vrais messages aux
 * adresses présentes dans les jeux de données.
 */
import mongoose from 'mongoose';
import User from '../src/models/User.js';

// Base dédiée aux tests : jamais celle de développement.
// Le lanceur exécute chaque fichier de test dans son propre processus, en
// parallèle. On suffixe donc le nom de la base par le PID : sans cela, un
// fichier supprimerait la base pendant qu'un autre l'utilise encore.
const BASE_MONGO_URI =
  process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/billetterie_test';
const TEST_MONGO_URI = `${BASE_MONGO_URI}_${process.pid}`;

// Secret fixe pour que les jetons soient vérifiables pendant les tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test';

// Neutralise l'envoi d'e-mails : aucun message réel ne doit partir en test.
process.env.EMAIL_HOST = '';
process.env.EMAIL_USER = '';
process.env.EMAIL_PASS = '';

export const connectTestDb = async () => {
  await mongoose.connect(TEST_MONGO_URI);
};

export const clearTestDb = async () => {
  await User.deleteMany({});
};

export const disconnectTestDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

// Compteur de numéros : l'e-mail ET le téléphone portent un index unique,
// une fixture à valeur fixe ferait échouer toute création multiple.
let compteurTelephone = 0;
const telephoneUnique = () => `+2217${String(10000000 + compteurTelephone++).slice(0, 8)}`;

// Crée un utilisateur directement en base (contourne l'API)
export const creerUtilisateur = async (surcharges = {}) => {
  return User.create({
    nom: 'Diop',
    prenom: 'Awa',
    email: `user${Date.now()}${Math.random().toString(36).slice(2, 7)}@test.com`,
    telephone: telephoneUnique(),
    role: 'Client',
    status: 'Actif',
    password: 'MotDePasse1',
    mustChangePassword: false,
    ...surcharges,
  });
};

// Crée un administrateur actif et renvoie l'en-tête d'authentification prêt à l'emploi
export const creerAdminEtToken = async (request, app) => {
  const motDePasse = 'AdminTest1';
  const admin = await creerUtilisateur({
    role: 'Administrateur',
    status: 'Actif',
    password: motDePasse,
  });

  const reponse = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password: motDePasse });

  return { admin, motDePasse, token: reponse.body.token, header: `Bearer ${reponse.body.token}` };
};
