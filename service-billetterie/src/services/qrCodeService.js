import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service de génération et de manipulation des QR Codes et des tokens sécurisés.
 */

// Génère un token unique et difficile à falsifier
export const genererTokenUnique = () => {
  return `TKT-${uuidv4()}`;
};

/**
 * Génère le rendu visuel du QR Code au format Data URL (base64 PNG).
 * Le QR code encode le token unique, évitant de stocker directement des données
 * personnelles sensibles dans l'image.
 */
export const genererQRCodeImage = async (token) => {
  try {
    const dataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 300,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    return dataUrl;
  } catch (error) {
    throw new Error(`Échec de la génération de l'image QR Code : ${error.message}`);
  }
};

/**
 * Valide et normalise la chaîne lue par le scanner.
 */
export const extraireCodeUnique = (rawCode) => {
  if (!rawCode || typeof rawCode !== 'string') {
    return null;
  }
  const clean = rawCode.trim();
  return clean.length > 0 ? clean : null;
};
