import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Import CSV -----------------------------------------------------------
// Stockage en mémoire : le buffer est parsé en flux, aucun fichier temporaire sur disque
const csvStorage = multer.memoryStorage();

const csvFilter = (req, file, cb) => {
  const isCsv =
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.originalname.toLowerCase().endsWith('.csv');
  if (isCsv) return cb(null, true);
  return cb(new Error('Seuls les fichiers CSV sont acceptés'));
};

export const uploadCsv = multer({
  storage: csvStorage,
  fileFilter: csvFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
}).single('file');

// --- Photo de profil ------------------------------------------------------
// Stockage sur disque dans backend/uploads/photos, servi en statique sur /uploads
export const PHOTO_DIR = path.join(__dirname, '../../uploads/photos');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    cb(null, PHOTO_DIR);
  },
  filename: (req, file, cb) => {
    // Nom unique : <idUtilisateur>-<timestamp>.<ext>
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.user._id}-${Date.now()}${ext}`);
  },
});

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const photoFilter = (req, file, cb) => {
  if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  return cb(new Error('Seules les images JPEG, PNG, WEBP ou GIF sont acceptées'));
};

export const uploadPhoto = multer({
  storage: photoStorage,
  fileFilter: photoFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo
}).single('photo');
