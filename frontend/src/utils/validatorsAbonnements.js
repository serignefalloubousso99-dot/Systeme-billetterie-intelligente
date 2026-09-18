// Règles de validation du formulaire de formule d'abonnement.
// Voir PLAN-SERVICE-ABONNEMENTS.md §4.1 pour le contrat.

export const TYPES_FORMULE = ['TICKET_SIMPLE', 'LIMITE', 'ILLIMITE'];

export function validateFormuleForm({ nom, type, tarif, dureeValiditeJours, nombreVoyages }) {
  if (!nom || !nom.trim()) {
    return 'Le nom est obligatoire.';
  }
  if (!TYPES_FORMULE.includes(type)) {
    return 'Le type de formule est obligatoire.';
  }
  if (tarif === '' || tarif === null || tarif === undefined || Number(tarif) < 0) {
    return 'Le tarif doit être un nombre positif.';
  }
  if (!dureeValiditeJours || Number(dureeValiditeJours) <= 0) {
    return 'La durée de validité doit être supérieure à 0 jour.';
  }
  if (type === 'LIMITE' && (!nombreVoyages || Number(nombreVoyages) <= 0)) {
    return 'Le nombre de voyages est obligatoire pour une formule limitée.';
  }
  return null;
}

export function validateSouscriptionForm({ utilisateurId, formuleId, dateDebut }) {
  if (!utilisateurId) {
    return 'Le client est obligatoire.';
  }
  if (!formuleId) {
    return 'La formule est obligatoire.';
  }
  if (!dateDebut) {
    return 'La date de début est obligatoire.';
  }
  return null;
}
