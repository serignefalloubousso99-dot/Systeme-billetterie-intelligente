import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Assurer l'existence du dossier de logs
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Nettoyage des données sensibles : masquage des mots de passe et tokens complets
const sanitizeSensitiveData = winston.format((info) => {
  const mask = (val) => (typeof val === 'string' && val.length > 8 ? `${val.substring(0, 4)}...${val.substring(val.length - 4)}` : '***');

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const key of Object.keys(sanitized)) {
      const lower = key.toLowerCase();
      if (lower.includes('password') || lower.includes('motdepasse') || lower.includes('secret')) {
        sanitized[key] = '***';
      } else if (lower.includes('token') || lower.includes('authorization')) {
        sanitized[key] = mask(sanitized[key]);
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeObject(sanitized[key]);
      }
    }
    return sanitized;
  };

  return sanitizeObject(info);
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'test' ? 'error' : 'info',
  format: winston.format.combine(
    sanitizeSensitiveData(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
  ],
});

// En développement ou test, afficher aussi sur la console de manière lisible
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] [${level}]: ${message}${metaStr}`;
        })
      ),
    })
  );
}

export default logger;
