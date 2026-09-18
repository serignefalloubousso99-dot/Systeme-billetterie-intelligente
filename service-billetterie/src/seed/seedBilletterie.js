import 'dotenv/config';
import { sequelize, TitreTransport, Validation, AuditLog } from '../models/index.js';
import { genererTokenUnique, genererQRCodeImage } from '../services/qrCodeService.js';
import logger from '../config/logger.js';

const seedBilletterie = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
    logger.info('Connexion PostgreSQL établie et tables synchronisées.');

    // Nettoyage préalable pour seed propre
    await Validation.destroy({ where: {}, truncate: true, cascade: true });
    await AuditLog.destroy({ where: {}, truncate: true, cascade: true });
    await TitreTransport.destroy({ where: {}, truncate: true, cascade: true });

    logger.info('Tables réinitialisées. Génération des données de démonstration...');

    const adminId = '6a5b68fc8be4efac6e1a775e';
    const agentId = '6a5b68fc8be4efac6e1a7799';
    const client1 = '6a5b68fc8be4efac6e1a7001';
    const client2 = '6a5b68fc8be4efac6e1a7002';

    // 1. Création de tickets simples
    const code1 = genererTokenUnique();
    const qr1 = await genererQRCodeImage(code1);
    const ticket1 = await TitreTransport.create({
      codeUnique: code1,
      qrCodeData: qr1,
      utilisateurId: client1,
      typeTitre: 'TICKET_SIMPLE',
      abonnementId: null,
      statut: 'ACTIF',
      dateCreation: new Date(),
    });

    const code2 = genererTokenUnique();
    const qr2 = await genererQRCodeImage(code2);
    const ticket2 = await TitreTransport.create({
      codeUnique: code2,
      qrCodeData: qr2,
      utilisateurId: client2,
      typeTitre: 'TICKET_SIMPLE',
      abonnementId: null,
      statut: 'CONSOMME',
      consommeLe: new Date(),
    });

    // 2. Création de titres abonnements
    const code3 = genererTokenUnique();
    const qr3 = await genererQRCodeImage(code3);
    const titreAbo1 = await TitreTransport.create({
      codeUnique: code3,
      qrCodeData: qr3,
      utilisateurId: client1,
      typeTitre: 'LIMITE',
      abonnementId: 1,
      statut: 'ACTIF',
      dateExpiration: '2026-12-31',
    });

    const code4 = genererTokenUnique();
    const qr4 = await genererQRCodeImage(code4);
    const titreAbo2 = await TitreTransport.create({
      codeUnique: code4,
      qrCodeData: qr4,
      utilisateurId: client2,
      typeTitre: 'ILLIMITE',
      abonnementId: 2,
      statut: 'DESACTIVE',
      dateExpiration: '2026-12-31',
    });

    // 3. Validations de démonstration
    const todayStr = new Date().toISOString().split('T')[0];
    await Validation.create({
      id: `VAL-${Date.now()}-0001`,
      titreId: ticket2.id,
      codeScanne: code2,
      utilisateurId: client2,
      abonnementId: null,
      agentId,
      resultat: 'AUTORISE',
      motifRefus: null,
      dateValidation: todayStr,
      heureValidation: '08:15:30',
    });

    await Validation.create({
      id: `VAL-${Date.now()}-0002`,
      titreId: titreAbo1.id,
      codeScanne: code3,
      utilisateurId: client1,
      abonnementId: 1,
      agentId,
      resultat: 'AUTORISE',
      motifRefus: null,
      dateValidation: todayStr,
      heureValidation: '08:45:12',
    });

    await Validation.create({
      id: `VAL-${Date.now()}-0003`,
      titreId: titreAbo2.id,
      codeScanne: code4,
      utilisateurId: client2,
      abonnementId: 2,
      agentId,
      resultat: 'REFUSE',
      motifRefus: 'QR_CODE_DESACTIVE',
      dateValidation: todayStr,
      heureValidation: '09:20:05',
    });

    // 4. Audits de démonstration
    await AuditLog.create({
      utilisateurId: adminId,
      role: 'Administrateur',
      action: 'GENERATION_TITRE',
      ressourceType: 'TITRE',
      ressourceId: ticket1.id,
      resultat: 'SUCCES',
      details: { typeTitre: 'TICKET_SIMPLE', utilisateurId: client1 },
      ipAdresse: '127.0.0.1',
    });

    await AuditLog.create({
      utilisateurId: adminId,
      role: 'Administrateur',
      action: 'DESACTIVATION_TITRE',
      ressourceType: 'TITRE',
      ressourceId: titreAbo2.id,
      resultat: 'SUCCES',
      details: { ancienStatut: 'ACTIF', nouveauStatut: 'DESACTIVE' },
      ipAdresse: '127.0.0.1',
    });

    await AuditLog.create({
      utilisateurId: agentId,
      role: 'Agent',
      action: 'SCAN_VALIDATION',
      ressourceType: 'VALIDATION',
      ressourceId: `VAL-${Date.now()}-0002`,
      resultat: 'SUCCES',
      details: { typeTitre: 'LIMITE', statut: 'AUTORISE' },
      ipAdresse: '127.0.0.1',
    });

    logger.info('Seed Billetterie complété avec succès !');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    logger.error(`Erreur seed billetterie : ${error.message}`);
    process.exit(1);
  }
};

seedBilletterie();
