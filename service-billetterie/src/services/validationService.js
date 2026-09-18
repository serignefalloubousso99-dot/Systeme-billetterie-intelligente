import { v4 as uuidv4 } from 'uuid';
import { sequelize, TitreTransport, Validation } from '../models/index.js';
import { extraireCodeUnique } from './qrCodeService.js';
import { consommerVoyageAbonnement } from './interServices.js';
import { enregistrerAudit as ecrireAudit } from './auditService.js';
import logger from '../config/logger.js';
import { MOTIFS_REFUS } from '../utils/constants.js';

/**
 * Génère un identifiant de validation unique et lisible.
 */
export const genererValidationId = () => {
  return `VAL-${Date.now()}-${uuidv4().substring(0, 8)}`;
};

/**
 * Mappe le message d'erreur du Service Abonnements vers les codes de motif normalisés.
 */
const mapperMotifServiceAbonnements = (message) => {
  const msg = (message || '').toLowerCase();
  if (msg.includes('épuisé') || msg.includes('solde')) return 'SOLDE_EPUISE';
  if (msg.includes('expiré')) return 'ABONNEMENT_EXPIRE';
  if (msg.includes('suspendu')) return 'ABONNEMENT_SUSPENDU';
  if (msg.includes('résilié')) return 'ABONNEMENT_RESILIE';
  if (msg.includes('pas encore')) return 'ABONNEMENT_PAS_ENCORE_VALIDE';
  return 'AUCUN_TITRE_VALIDE';
};

/**
 * Journalise CHAQUE tentative de scan (autorisée ou refusée) dans la piste
 * d'audit : qui, quelle action, sur quelle ressource, quand, avec quel
 * résultat — un refus (ex: ticket déjà utilisé) est un événement de sécurité
 * à part entière, pas seulement les succès.
 */
const enregistrerAudit = ({ agentId, agentRole, valId, resultat, motifRefus, details, ipAdresse }, transaction) =>
  ecrireAudit(
    {
      utilisateurId: agentId,
      role: agentRole || 'Agent',
      action: 'SCAN_VALIDATION',
      ressourceType: 'VALIDATION',
      ressourceId: valId,
      resultat: resultat === 'AUTORISE' ? 'SUCCES' : 'ECHEC',
      details: { ...details, resultatScan: resultat, motifRefus: motifRefus || null },
      ipAdresse,
    },
    transaction
  );

/**
 * Moteur central de validation d'un QR Code.
 *
 * Gère la concurrence par verrou pessimiste sur le titre (`LOCK.UPDATE`),
 * garantit l'idempotence des transactions et journalise l'historique complet
 * ainsi que la piste d'audit (succès et refus).
 */
export const validerScanQRCode = async ({ rawCode, agentId, agentRole, ipAdresse, token }) => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const heureStr = now.toTimeString().split(' ')[0];
  const codeUnique = extraireCodeUnique(rawCode);

  // 1. Code illisible ou absent
  if (!codeUnique) {
    const valId = genererValidationId();
    const val = await Validation.create({
      id: valId,
      titreId: null,
      codeScanne: rawCode || '',
      utilisateurId: null,
      abonnementId: null,
      agentId,
      resultat: 'REFUSE',
      motifRefus: 'QR_CODE_INCONNU',
      dateValidation: dateStr,
      heureValidation: heureStr,
    });

    await enregistrerAudit({
      agentId, agentRole, valId, resultat: 'REFUSE', motifRefus: 'QR_CODE_INCONNU',
      details: { codeScanne: rawCode || '' }, ipAdresse,
    });

    logger.warn(`Scan refusé : QR code vide ou invalide (Validation: ${valId})`);
    return {
      autorise: false,
      message: MOTIFS_REFUS.QR_CODE_INCONNU,
      motifRefus: 'QR_CODE_INCONNU',
      validation: val,
    };
  }

  // 2. Recherche du titre avec gestion de la concurrence via transaction PostgreSQL
  const resultatScan = await sequelize.transaction(async (t) => {
    // Verrouillage de la ligne pour bloquer les scans simultanés du même titre
    const titre = await TitreTransport.findOne({
      where: { codeUnique },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    // 2.1 Titre introuvable dans la base du Service Billetterie
    if (!titre) {
      const valId = genererValidationId();
      const val = await Validation.create(
        {
          id: valId,
          titreId: null,
          codeScanne: codeUnique,
          utilisateurId: null,
          abonnementId: null,
          agentId,
          resultat: 'REFUSE',
          motifRefus: 'QR_CODE_INCONNU',
          dateValidation: dateStr,
          heureValidation: heureStr,
        },
        { transaction: t }
      );

      await enregistrerAudit({
        agentId, agentRole, valId, resultat: 'REFUSE', motifRefus: 'QR_CODE_INCONNU',
        details: { codeScanne: codeUnique }, ipAdresse,
      }, t);

      logger.warn(`Scan refusé : Titre introuvable pour code ${codeUnique}`);
      return {
        autorise: false,
        message: MOTIFS_REFUS.QR_CODE_INCONNU,
        motifRefus: 'QR_CODE_INCONNU',
        validation: val,
      };
    }

    // 2.2 Vérification de la désactivation administrative
    if (titre.statut === 'DESACTIVE') {
      const valId = genererValidationId();
      const val = await Validation.create(
        {
          id: valId,
          titreId: titre.id,
          codeScanne: codeUnique,
          utilisateurId: titre.utilisateurId,
          abonnementId: titre.abonnementId,
          agentId,
          resultat: 'REFUSE',
          motifRefus: 'QR_CODE_DESACTIVE',
          dateValidation: dateStr,
          heureValidation: heureStr,
        },
        { transaction: t }
      );

      await enregistrerAudit({
        agentId, agentRole, valId, resultat: 'REFUSE', motifRefus: 'QR_CODE_DESACTIVE',
        details: { titreId: titre.id }, ipAdresse,
      }, t);

      logger.warn(`Scan refusé : Titre désactivé (Titre: ${titre.id})`);
      return {
        autorise: false,
        message: MOTIFS_REFUS.QR_CODE_DESACTIVE,
        motifRefus: 'QR_CODE_DESACTIVE',
        validation: val,
      };
    }

    // 2.3 Vérification de la date ET de l'heure d'expiration du titre
    if (titre.dateExpiration && now > new Date(titre.dateExpiration)) {
      if (titre.statut !== 'EXPIRE') {
        titre.statut = 'EXPIRE';
        await titre.save({ transaction: t });
      }

      const valId = genererValidationId();
      const val = await Validation.create(
        {
          id: valId,
          titreId: titre.id,
          codeScanne: codeUnique,
          utilisateurId: titre.utilisateurId,
          abonnementId: titre.abonnementId,
          agentId,
          resultat: 'REFUSE',
          motifRefus: 'ABONNEMENT_EXPIRE',
          dateValidation: dateStr,
          heureValidation: heureStr,
        },
        { transaction: t }
      );

      await enregistrerAudit({
        agentId, agentRole, valId, resultat: 'REFUSE', motifRefus: 'ABONNEMENT_EXPIRE',
        details: { titreId: titre.id, dateExpiration: titre.dateExpiration }, ipAdresse,
      }, t);

      logger.warn(`Scan refusé : Titre expiré le ${titre.dateExpiration} (Titre: ${titre.id})`);
      return {
        autorise: false,
        message: MOTIFS_REFUS.ABONNEMENT_EXPIRE,
        motifRefus: 'ABONNEMENT_EXPIRE',
        validation: val,
      };
    }

    // 3. Traitement selon le TYPE de titre
    // ===================================

    // CAS A : TICKET SIMPLE (1 seul voyage)
    if (titre.typeTitre === 'TICKET_SIMPLE') {
      if (titre.statut === 'CONSOMME' || titre.consommeLe !== null) {
        const valId = genererValidationId();
        const val = await Validation.create(
          {
            id: valId,
            titreId: titre.id,
            codeScanne: codeUnique,
            utilisateurId: titre.utilisateurId,
            abonnementId: null,
            agentId,
            resultat: 'REFUSE',
            motifRefus: 'TICKET_DEJA_UTILISE',
            dateValidation: dateStr,
            heureValidation: heureStr,
          },
          { transaction: t }
        );

        await enregistrerAudit({
          agentId, agentRole, valId, resultat: 'REFUSE', motifRefus: 'TICKET_DEJA_UTILISE',
          details: { titreId: titre.id, consommeLe: titre.consommeLe }, ipAdresse,
        }, t);

        logger.warn(`Scan refusé : Ticket déjà utilisé (Titre: ${titre.id}, consommé le: ${titre.consommeLe})`);
        return {
          autorise: false,
          message: MOTIFS_REFUS.TICKET_DEJA_UTILISE,
          motifRefus: 'TICKET_DEJA_UTILISE',
          validation: val,
        };
      }

      // Consommation immédiate et atomique du ticket simple
      titre.statut = 'CONSOMME';
      titre.consommeLe = now;
      await titre.save({ transaction: t });

      const valId = genererValidationId();
      const val = await Validation.create(
        {
          id: valId,
          titreId: titre.id,
          codeScanne: codeUnique,
          utilisateurId: titre.utilisateurId,
          abonnementId: null,
          agentId,
          resultat: 'AUTORISE',
          motifRefus: null,
          dateValidation: dateStr,
          heureValidation: heureStr,
        },
        { transaction: t }
      );

      await enregistrerAudit({
        agentId, agentRole, valId, resultat: 'AUTORISE',
        details: { typeTitre: 'TICKET_SIMPLE', titreId: titre.id }, ipAdresse,
      }, t);

      logger.info(`Scan autorisé : Ticket simple ${titre.id} consommé par agent ${agentId}`);
      return {
        autorise: true,
        message: 'Voyage autorisé (Ticket simple consommé)',
        validation: val,
        titre: {
          id: titre.id,
          typeTitre: titre.typeTitre,
          statut: titre.statut,
        },
      };
    }

    // CAS B : ABONNEMENT (LIMITE ou ILLIMITE)
    if (titre.typeTitre === 'LIMITE' || titre.typeTitre === 'ILLIMITE') {
      if (!titre.abonnementId) {
        const valId = genererValidationId();
        const val = await Validation.create(
          {
            id: valId,
            titreId: titre.id,
            codeScanne: codeUnique,
            utilisateurId: titre.utilisateurId,
            abonnementId: null,
            agentId,
            resultat: 'REFUSE',
            motifRefus: 'AUCUN_TITRE_VALIDE',
            dateValidation: dateStr,
            heureValidation: heureStr,
          },
          { transaction: t }
        );

        await enregistrerAudit({
          agentId, agentRole, valId, resultat: 'REFUSE', motifRefus: 'AUCUN_TITRE_VALIDE',
          details: { titreId: titre.id }, ipAdresse,
        }, t);

        return {
          autorise: false,
          message: 'Aucun abonnement associé à ce titre',
          motifRefus: 'AUCUN_TITRE_VALIDE',
          validation: val,
        };
      }

      const valId = genererValidationId();

      // Interrogation du Service Abonnements pour décompte atomique
      const reponseAbo = await consommerVoyageAbonnement(titre.abonnementId, valId, token);

      if (!reponseAbo.succes) {
        const motifRefus = reponseAbo.indisponible
          ? 'SERVICE_INDISPONIBLE'
          : mapperMotifServiceAbonnements(reponseAbo.message);

        const val = await Validation.create(
          {
            id: valId,
            titreId: titre.id,
            codeScanne: codeUnique,
            utilisateurId: titre.utilisateurId,
            abonnementId: titre.abonnementId,
            agentId,
            resultat: 'REFUSE',
            motifRefus,
            dateValidation: dateStr,
            heureValidation: heureStr,
          },
          { transaction: t }
        );

        await enregistrerAudit({
          agentId, agentRole, valId, resultat: 'REFUSE', motifRefus,
          details: { titreId: titre.id, abonnementId: titre.abonnementId, messageAbonnements: reponseAbo.message },
          ipAdresse,
        }, t);

        logger.warn(`Scan refusé (Abonnement #${titre.abonnementId}) : ${reponseAbo.message} -> Motif: ${motifRefus}`);
        return {
          autorise: false,
          message: reponseAbo.message || MOTIFS_REFUS[motifRefus],
          motifRefus,
          validation: val,
        };
      }

      // Décompte accepté par le Service Abonnements
      const val = await Validation.create(
        {
          id: valId,
          titreId: titre.id,
          codeScanne: codeUnique,
          utilisateurId: titre.utilisateurId,
          abonnementId: titre.abonnementId,
          agentId,
          resultat: 'AUTORISE',
          motifRefus: null,
          dateValidation: dateStr,
          heureValidation: heureStr,
        },
        { transaction: t }
      );

      await enregistrerAudit({
        agentId, agentRole, valId, resultat: 'AUTORISE',
        details: { typeTitre: titre.typeTitre, titreId: titre.id, abonnementId: titre.abonnementId },
        ipAdresse,
      }, t);

      const aboData = reponseAbo.donnees?.abonnement;
      logger.info(`Scan autorisé : Abonnement #${titre.abonnementId} validé (Restants: ${aboData?.voyagesRestants ?? 'Illimité'})`);

      return {
        autorise: true,
        message: 'Voyage autorisé',
        validation: val,
        titre: {
          id: titre.id,
          typeTitre: titre.typeTitre,
          statut: titre.statut,
        },
        abonnement: aboData,
      };
    }

    // Type non reconnu
    return {
      autorise: false,
      message: 'Type de titre non reconnu',
      motifRefus: 'AUCUN_TITRE_VALIDE',
    };
  });

  return resultatScan;
};
