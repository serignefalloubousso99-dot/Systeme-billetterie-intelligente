// Formate une date (chaîne 'AAAA-MM-JJ', ISO complet, ou objet Date) au
// format français JJ/MM/AAAA, utilisé partout dans l'interface.
export function formatDateFR(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

// Formate un horodatage complet (ex: date d'un voyage consommé) en
// JJ/MM/AAAA HH:mm, dans le fuseau horaire du navigateur.
export function formatDateTimeFR(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

// Les dates peuvent arriver au format 'AAAA-MM-JJ' ou en horodatage ISO complet
// (dateExpiration porte l'heure) : on ne garde que le jour, sinon le calcul donne NaN.
const jourUTC = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00Z`);
const joursEntre = (a, b) => Math.round((jourUTC(b) - jourUTC(a)) / MS_PAR_JOUR);

// Durée totale de validité (en jours) entre une date de début et
// d'expiration au format 'AAAA-MM-JJ'.
export function dureeValiditeJours(dateDebut, dateExpiration) {
  if (!dateDebut || !dateExpiration) return null;
  return joursEntre(dateDebut, dateExpiration);
}

// Temps restant avant expiration, à partir d'aujourd'hui, en texte lisible :
// "Expire dans N jours", "Expire aujourd'hui" ou "Expiré depuis N jours".
export function tempsRestant(dateExpiration) {
  if (!dateExpiration) return null;
  const aujourdHui = new Date().toISOString().split('T')[0];
  const jours = joursEntre(aujourdHui, dateExpiration);
  if (jours > 0) return `Expire dans ${jours} jour${jours > 1 ? 's' : ''}`;
  if (jours === 0) return "Expire aujourd'hui";
  return `Expiré depuis ${Math.abs(jours)} jour${Math.abs(jours) > 1 ? 's' : ''}`;
}
