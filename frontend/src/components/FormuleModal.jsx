import React, { useState, useEffect } from 'react';
import { validateFormuleForm } from '../utils/validatorsAbonnements';

const EMPTY_FORM = { nom: '', description: '', type: 'LIMITE', tarif: '', dureeValiditeJours: '', nombreVoyages: '' };

// Cree une formule, ou modifie une formule existante. Le type n'est pas
// modifiable une fois la formule creee (hors contrat PUT /formules/:id,
// §4.1 du plan) : le selecteur est desactive en edition.
function FormuleModal({ isOpen, formule, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);

  const isEditing = Boolean(formule);

  useEffect(() => {
    if (formule) {
      setForm({
        nom: formule.nom || '',
        description: formule.description || '',
        type: formule.type || 'LIMITE',
        tarif: formule.tarif ?? '',
        dureeValiditeJours: formule.dureeValiditeJours ?? '',
        nombreVoyages: formule.nombreVoyages ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [formule, isOpen]);

  if (!isOpen) return null;

  const handleTypeChange = (type) => {
    setForm((f) => ({
      ...f,
      type,
      nombreVoyages: type === 'TICKET_SIMPLE' ? 1 : type === 'ILLIMITE' ? '' : f.nombreVoyages,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      nom: form.nom,
      description: form.description,
      type: form.type,
      tarif: form.tarif === '' ? '' : Number(form.tarif),
      dureeValiditeJours: form.dureeValiditeJours === '' ? '' : Number(form.dureeValiditeJours),
      nombreVoyages: form.type === 'LIMITE' ? Number(form.nombreVoyages) : undefined,
    };

    const validationError = validateFormuleForm(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    try {
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? 'Modifier la formule' : 'Créer une formule'}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Nom<span className="required-mark">*</span></label>
            <input
              type="text"
              required
              autoFocus
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="form-input"
              placeholder="Ex: Abonnement mensuel 20 voyages"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Type<span className="required-mark">*</span></label>
            <div className="choice-group" role="group" aria-label="Type de formule">
              {[
                { value: 'TICKET_SIMPLE', label: 'Ticket simple' },
                { value: 'LIMITE', label: 'Nombre de voyages' },
                { value: 'ILLIMITE', label: 'Illimité' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`choice-btn${form.type === option.value ? ' selected' : ''}`}
                  onClick={() => handleTypeChange(option.value)}
                  disabled={isEditing}
                  title={isEditing ? 'Le type ne peut pas être modifié après création' : undefined}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">Tarif (FCFA)<span className="required-mark">*</span></label>
              <input
                type="number"
                required
                min="0"
                value={form.tarif}
                onChange={(e) => setForm({ ...form, tarif: e.target.value })}
                className="form-input"
                placeholder="15000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Durée de validité (jours)<span className="required-mark">*</span></label>
              <input
                type="number"
                required
                min="1"
                value={form.dureeValiditeJours}
                onChange={(e) => setForm({ ...form, dureeValiditeJours: e.target.value })}
                className="form-input"
                placeholder="30"
              />
            </div>
            {form.type === 'LIMITE' && (
              <div className="form-group">
                <label className="form-label">Nombre de voyages<span className="required-mark">*</span></label>
                <input
                  type="number"
                  required
                  min="1"
                  value={form.nombreVoyages}
                  onChange={(e) => setForm({ ...form, nombreVoyages: e.target.value })}
                  className="form-input"
                  placeholder="20"
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="form-input"
                placeholder="Ex: Valable 30 jours"
              />
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

export default FormuleModal;
