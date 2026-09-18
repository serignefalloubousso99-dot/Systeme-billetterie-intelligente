import './setupEnv.js';
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { sequelize, TitreTransport, Validation, AuditLog } from '../src/models/index.js';
import { genererTokenUnique, genererQRCodeImage } from '../src/services/qrCodeService.js';

export { sequelize, TitreTransport, Validation, AuditLog };

export const preparerBase = async () => {
  await sequelize.sync({ force: true });
};

export const viderBase = async () => {
  await Validation.destroy({ where: {}, truncate: true, cascade: true });
  await AuditLog.destroy({ where: {}, truncate: true, cascade: true });
  await TitreTransport.destroy({ where: {}, truncate: true, cascade: true });
};

export const fermerBase = async () => {
  await sequelize.close();
};

export const jetonPour = (role = 'Administrateur', id = '6a5b68fc8be4efac6e1a775e') =>
  `Bearer ${jwt.sign({ id, role }, process.env.JWT_SECRET)}`;

export const enteteAdmin = () => ({ Authorization: jetonPour('Administrateur') });
export const enteteAgent = () => ({ Authorization: jetonPour('Agent', '6a5b68fc8be4efac6e1a7799') });
export const enteteClient = () => ({ Authorization: jetonPour('Client', '6a5b68fc8be4efac6e1a7001') });

export const creerTitreSimpleTest = async (surcharges = {}) => {
  const codeUnique = surcharges.codeUnique || genererTokenUnique();
  const qrCodeData = surcharges.qrCodeData || (await genererQRCodeImage(codeUnique));

  return TitreTransport.create({
    codeUnique,
    qrCodeData,
    utilisateurId: '6a5b68fc8be4efac6e1a7001',
    typeTitre: 'TICKET_SIMPLE',
    abonnementId: null,
    statut: 'ACTIF',
    ...surcharges,
  });
};

export const creerTitreAbonnementTest = async (surcharges = {}) => {
  const codeUnique = surcharges.codeUnique || genererTokenUnique();
  const qrCodeData = surcharges.qrCodeData || (await genererQRCodeImage(codeUnique));

  return TitreTransport.create({
    codeUnique,
    qrCodeData,
    utilisateurId: '6a5b68fc8be4efac6e1a7001',
    typeTitre: 'LIMITE',
    abonnementId: 42,
    statut: 'ACTIF',
    ...surcharges,
  });
};
