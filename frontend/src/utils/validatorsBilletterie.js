/**
 * Utilitaires de validation et de formatage pour le Service Billetterie.
 */

export const MOTIFS_REFUS_LISIBLES = {
  QR_CODE_INCONNU: 'QR Code inconnu du système',
  QR_CODE_DESACTIVE: 'Titre ou QR Code désactivé administrativement',
  TICKET_DEJA_UTILISE: 'Ticket simple déjà utilisé (voyage unique)',
  SOLDE_EPUISE: 'Solde de voyages épuisé sur cet abonnement',
  ABONNEMENT_EXPIRE: "Période de validité de l'abonnement dépassée",
  ABONNEMENT_SUSPENDU: 'Abonnement temporairement suspendu',
  ABONNEMENT_RESILIE: 'Abonnement définitivement résilié',
  ABONNEMENT_PAS_ENCORE_VALIDE: "La date de début de l'abonnement n'est pas encore atteinte",
  AUCUN_TITRE_VALIDE: 'Aucun titre de transport valide associé',
  SERVICE_INDISPONIBLE: 'Service de validation distant momentanément indisponible',
};

export function validerFormatCodeTitre(code) {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim();
  return clean.startsWith('TKT-') && clean.length >= 20;
}

export function estCodeScannable(code) {
  if (!code || typeof code !== 'string') return false;
  return code.trim().length > 0;
}

export function formaterMotifRefus(codeMotif) {
  if (!codeMotif) return null;
  return MOTIFS_REFUS_LISIBLES[codeMotif] || codeMotif;
}

export function badgeClasseStatutTitre(statut) {
  switch (statut) {
    case 'ACTIF':
      return 'badge-status-actif';
    case 'DESACTIVE':
      return 'badge-status-desactive';
    case 'CONSOMME':
      return 'badge-status-consomme';
    case 'EXPIRE':
      return 'badge-status-expire';
    default:
      return 'badge-status-default';
  }
}
