export const TYPES_TITRE = ['TICKET_SIMPLE', 'LIMITE', 'ILLIMITE'];

export const STATUTS_TITRE = ['ACTIF', 'DESACTIVE', 'CONSOMME', 'EXPIRE'];

export const RESULTATS_VALIDATION = ['AUTORISE', 'REFUSE'];

export const MOTIFS_REFUS = {
  QR_CODE_INCONNU: 'QR Code inconnu',
  QR_CODE_DESACTIVE: 'QR Code désactivé',
  TICKET_DEJA_UTILISE: 'Ticket déjà utilisé',
  ABONNEMENT_PAS_ENCORE_VALIDE: 'Abonnement pas encore valide',
  ABONNEMENT_EXPIRE: 'Abonnement expiré',
  ABONNEMENT_SUSPENDU: 'Abonnement suspendu',
  ABONNEMENT_RESILIE: 'Abonnement résilié',
  SOLDE_EPUISE: 'Solde de voyages épuisé',
  AUCUN_TITRE_VALIDE: 'Aucun titre de transport valide',
  SERVICE_INDISPONIBLE: 'Service de validation indisponible',
};

export const ACTIONS_AUDIT = [
  'GENERATION_TITRE',
  'DESACTIVATION_TITRE',
  'ACTIVATION_TITRE',
  'SCAN_VALIDATION',
  'VALIDATION_MANUELLE',
];

export const RESSOURCES_AUDIT = ['TITRE', 'QR_CODE', 'VALIDATION'];
