// Catégorisation des motifs de refus d'un scan, pour un repérage visuel
// immédiat par l'agent/l'administrateur plutôt qu'un texte brut à lire :
//   - fraude   : usage suspect d'un titre (rouge)
//   - client   : situation normale du titre du client (orange)
//   - technique: panne d'un service, rien à voir avec le titre (gris)
export const MOTIFS_INFO = {
  QR_CODE_INCONNU: { label: 'QR Code inconnu', categorie: 'fraude' },
  TICKET_DEJA_UTILISE: { label: 'Ticket déjà utilisé', categorie: 'fraude' },
  QR_CODE_DESACTIVE: { label: 'QR Code désactivé', categorie: 'client' },
  SOLDE_EPUISE: { label: 'Solde de voyages épuisé', categorie: 'client' },
  ABONNEMENT_EXPIRE: { label: 'Abonnement expiré', categorie: 'client' },
  ABONNEMENT_SUSPENDU: { label: 'Abonnement suspendu', categorie: 'client' },
  ABONNEMENT_RESILIE: { label: 'Abonnement résilié', categorie: 'client' },
  ABONNEMENT_PAS_ENCORE_VALIDE: { label: 'Abonnement pas encore valide', categorie: 'client' },
  AUCUN_TITRE_VALIDE: { label: 'Aucun titre valide', categorie: 'client' },
  SERVICE_INDISPONIBLE: { label: 'Service indisponible', categorie: 'technique' },
};

export const CATEGORIE_COLORS = {
  fraude: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  client: { backgroundColor: '#fef3c7', color: '#92400e' },
  technique: { backgroundColor: '#f1f5f9', color: '#475569' },
};

export function motifLabel(motif) {
  return MOTIFS_INFO[motif]?.label || motif;
}

export function motifColors(motif) {
  const categorie = MOTIFS_INFO[motif]?.categorie || 'technique';
  return CATEGORIE_COLORS[categorie];
}
