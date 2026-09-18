import React from 'react';

// Popup de confirmation réutilisable pour toute action destructrice ou
// difficile à annuler (suppression, blocage, résiliation...). Reprend le
// même système visuel que les autres modales (`modal-overlay`/`modal-panel`).
function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-panel" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
        </div>
        <div className="modal-form">
          <p className="user-email-text">{message}</p>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className="btn-primary"
              style={danger ? { backgroundColor: '#ef4444' } : undefined}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
