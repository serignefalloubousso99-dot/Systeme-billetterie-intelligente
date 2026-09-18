import React, { useState } from 'react';
import { validateUserForm } from '../utils/validators';

function CreateUserModal({ isOpen, onClose, onCreate }) {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [role, setRole] = useState('Client');
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateUserForm({ nom, prenom, email, telephone });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    try {
      await onCreate({ nom, prenom, email, telephone, role });

      // Reset Form — seulement si la création a réussi
      setNom('');
      setPrenom('');
      setEmail('');
      setTelephone('');
      setRole('Client');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Créer un Utilisateur</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">Prénom<span className="required-mark">*</span></label>
              <input
                type="text"
                required
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                className="form-input"
                placeholder="Ex: Jean"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nom<span className="required-mark">*</span></label>
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="form-input"
                placeholder="Ex: Dupont"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Adresse email<span className="required-mark">*</span></label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="jean.dupont@entreprise.com"
            />
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">Téléphone<span className="required-mark">*</span></label>
              <input
                type="tel"
                required
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className="form-input"
                placeholder="771234567"
                pattern="^(\+?221)?\d{9}$"
                title="9 chiffres, avec ou sans indicatif +221, ex. 771234567"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Rôle</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="form-select"
              >
                <option value="Client">Client</option>
                <option value="Agent">Agent</option>
                <option value="Administrateur">Administrateur</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateUserModal;
