import React, { useState } from 'react';

function ImportCsvModal({ isOpen, onClose, onImport, successMessage, errors = [] }) {
  const [file, setFile] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) return;
    onImport(file, () => {
      setFile(null); // Clear input on successful upload callback
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Importer une liste d'utilisateurs</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <p className="modal-helper-text">
            Ajoutez plusieurs comptes d'un coup depuis un fichier CSV. Le fichier doit comporter les colonnes suivantes :
            <code> nom,prenom,email,telephone,role</code>
          </p>

          {successMessage && (
            <div 
              className="status-cell"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                backgroundColor: successMessage.includes("Succès") || successMessage.includes("succès") ? '#ecfdf5' : '#eff6ff',
                border: `1px solid ${successMessage.includes("Succès") || successMessage.includes("succès") ? '#a7f3d0' : '#bfdbfe'}`,
                color: successMessage.includes("Succès") || successMessage.includes("succès") ? '#047857' : '#1d4ed8',
                gap: '0.5rem'
              }}
            >
              <span className="material-symbols-outlined">info</span>
              <span>{successMessage}</span>
            </div>
          )}

          {errors.length > 0 && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                maxHeight: '160px',
                overflowY: 'auto',
              }}
            >
              <strong>{errors.length} ligne(s) ignorée(s) :</strong>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                {errors.map((err, i) => (
                  <li key={i}>
                    Ligne {err.ligne}{err.email ? ` (${err.email})` : ''} — {err.raison}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="dropzone">
            <span className="material-symbols-outlined dropzone-icon">
              cloud_upload
            </span>
            <p className="dropzone-text">
              {file ? `Fichier prêt : ${file.name}` : "Cliquez ou glissez-déposez le fichier CSV ici"}
            </p>
            <input
              type="file"
              accept=".csv"
              required
              onChange={(e) => setFile(e.target.files[0])}
              className="dropzone-input"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={!file}>
              Lancer l'importation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ImportCsvModal;
