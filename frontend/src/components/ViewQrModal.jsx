import React, { useState } from 'react';
import { formatDateFR } from '../utils/dates';

const TYPE_LABELS = {
  TICKET_SIMPLE: 'Ticket simple',
  LIMITE: 'Abonnement limité',
  ILLIMITE: 'Abonnement illimité',
};

const TYPE_COLORS = {
  TICKET_SIMPLE: { backgroundColor: '#eff6ff', color: '#1e40af' },
  LIMITE: { backgroundColor: '#faf5ff', color: '#6b21a8' },
  ILLIMITE: { backgroundColor: '#f0fdf4', color: '#166534' },
};

const STATUT_COLORS = {
  ACTIF: { backgroundColor: '#dcfce7', color: '#15803d' },
  DESACTIVE: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  CONSOMME: { backgroundColor: '#f1f5f9', color: '#475569' },
  EXPIRE: { backgroundColor: '#fef3c7', color: '#92400e' },
};

function ViewQrModal({ titre, client, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!titre) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(titre.codeUnique);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadImage = () => {
    const link = document.createElement('a');
    link.href = titre.qrCodeData;
    link.download = `QR-${titre.codeUnique}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Titre de transport numérique</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fermer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="qr-card-printable">
          <div className="qr-badges-row">
            <span className="role-badge" style={TYPE_COLORS[titre.typeTitre]}>
              {TYPE_LABELS[titre.typeTitre] || titre.typeTitre}
            </span>
            <span className="role-badge" style={STATUT_COLORS[titre.statut]}>
              {titre.statut}
            </span>
          </div>

          <div className="qr-image-frame">
            <img src={titre.qrCodeData} alt={`QR Code ${titre.codeUnique}`} className="qr-image" />
          </div>

          <div className="qr-code-block">
            <span className="qr-code-label">Code de validation</span>
            <div className="qr-code-value">{titre.codeUnique}</div>
          </div>

          {client && (
            <div className="qr-client-card">
              <span className="material-symbols-outlined">person</span>
              <div>
                <div className="qr-client-name">{client.prenom} {client.nom}</div>
                <div className="titre-meta">{client.telephone}</div>
              </div>
            </div>
          )}

          {titre.dateExpiration && (
            <div className="qr-expiration">
              Valable jusqu'au : <strong>{formatDateFR(titre.dateExpiration)}</strong>
            </div>
          )}
        </div>

        <div className="modal-footer qr-modal-footer">
          <button type="button" className="btn-secondary" onClick={handleCopyCode}>
            <span className="material-symbols-outlined btn-icon">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copié !' : 'Copier'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleDownloadImage}>
            <span className="material-symbols-outlined btn-icon">download</span>
            Télécharger
          </button>
          <button type="button" className="btn-primary" onClick={handlePrint}>
            <span className="material-symbols-outlined btn-icon">print</span>
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}

export default ViewQrModal;
