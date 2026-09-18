// Génère un mot de passe temporaire alphanumérique de 8 caractères
export const generateTempPassword = () => {
  return Math.random().toString(36).slice(-8);
};
