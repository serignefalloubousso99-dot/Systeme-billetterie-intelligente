// Neutralise les caractères spéciaux d'une expression régulière pour obtenir
// une correspondance littérale.
// Indispensable pour la recherche par téléphone : nos numéros commencent par
// '+', un quantificateur invalide en tête de motif qui ferait échouer la requête.
export const escapeRegex = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default escapeRegex;
