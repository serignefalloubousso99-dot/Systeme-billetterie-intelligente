import rateLimit from 'express-rate-limit';

/**
 * Limiteur de requêtes pour protéger les endpoints de validation contre les abus,
 * les attaques par force brute ou les scans frénétiques en boucle.
 */
export const validationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // Fenêtre de 1 minute
  max: process.env.NODE_ENV === 'test' ? 10000 : 120, // 120 requêtes par minute par IP en production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Trop de tentatives de validation en peu de temps, veuillez patienter un instant.',
  },
  skip: () => process.env.NODE_ENV === 'test', // Pas de restriction pendant l'exécution des tests
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 1000,
  message: {
    message: 'Trop de requêtes adressées au service de billetterie.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});
