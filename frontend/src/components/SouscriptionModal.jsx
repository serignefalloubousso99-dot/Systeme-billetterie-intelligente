import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { getFormules } from '../services/apiAbonnements';
import { validateSouscriptionForm } from '../utils/validatorsAbonnements';

const EMPTY_FORM = { utilisateurId: '', formuleId: '', dateDebut: new Date().toISOString().slice(0, 10) };

// Souscrit un client actif a une formule active. Les deux listes viennent
// de deux services differents : les clients du Service Utilisateurs (Mongo),
// les formules du Service Abonnements (simule pour l'instant).
function SouscriptionModal({ isOpen, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [clients, setClients] = useState([]);
  const [formules, setFormules] = useState([]);
  const [error, setError] = useState(null);
  const [clientQuery, setClientQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setForm(EMPTY_FORM);
    setError(null);
    setClientQuery('');

    api.getUsers({ role: 'Client', status: 'Actif' })
      .then(setClients)
      .catch((err) => console.error('Impossible de récupérer les clients', err));

    getFormules({ actif: true })
      .then(setFormules)
      .catch((err) => console.error('Impossible de récupérer les formules', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedClient = clients.find((c) => c.id === form.utilisateurId) || null;

  const query = clientQuery.trim().toLowerCase();
  const digits = query.replace(/\D/g, '');
  const suggestions = query
    ? clients
        .filter((c) =>
          `${c.prenom} ${c.nom}`.toLowerCase().includes(query) ||
          `${c.nom} ${c.prenom}`.toLowerCase().includes(query) ||
          (c.email || '').toLowerCase().includes(query) ||
          (digits.length >= 2 && (c.telephone || '').replace(/\D/g, '').includes(digits))
        )
        .slice(0, 8)
    : [];

  const selectClient = (client) => {
    setForm({ ...form, utilisateurId: client.id });
    setClientQuery('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateSouscriptionForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    try {
      await onSave({ ...form, formuleId: Number(form.formuleId) });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Nouvelle souscription</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Client<span className="required-mark">*</span></label>

            {selectedClient ? (
              <div className="client-selected">
                <div className="client-avatar">
                  {selectedClient.prenom?.[0]?.toUpperCase()}{selectedClient.nom?.[0]?.toUpperCase()}
                </div>
                <div className="client-info">
                  <div className="client-name">{selectedClient.prenom} {selectedClient.nom}</div>
                  <div className="client-meta">{selectedClient.telephone} · {selectedClient.email}</div>
                </div>
                <button
                  type="button"
                  className="client-change-btn"
                  onClick={() => setForm({ ...form, utilisateurId: '' })}
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="client-search">
                <div className="search-wrapper">
                  <span className="material-symbols-outlined search-icon">search</span>
                  <input
                    type="text"
                    autoFocus
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    className="search-input"
                    placeholder="Nom, téléphone ou email du client"
                  />
                </div>

                {query && (
                  <ul className="client-suggestions">
                    {suggestions.length > 0 ? (
                      suggestions.map((client) => (
                        <li key={client.id}>
                          <button type="button" className="client-suggestion" onClick={() => selectClient(client)}>
                            <div className="client-avatar">
                              {client.prenom?.[0]?.toUpperCase()}{client.nom?.[0]?.toUpperCase()}
                            </div>
                            <div className="client-info">
                              <div className="client-name">{client.prenom} {client.nom}</div>
                              <div className="client-meta">{client.telephone} · {client.email}</div>
                            </div>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="client-no-result">Aucun client ne correspond à « {clientQuery} ».</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {clients.length === 0 && (
              <p className="form-hint">
                Aucun client actif trouvé. Un client doit être créé puis activé avant de pouvoir
                souscrire — depuis <Link to="/users" onClick={onClose}>Gestion des Comptes</Link>.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Formule<span className="required-mark">*</span></label>
            <select
              value={form.formuleId}
              onChange={(e) => setForm({ ...form, formuleId: e.target.value })}
              className="form-select"
            >
              <option value="">Sélectionner une formule</option>
              {formules.map((formule) => (
                <option key={formule.id} value={formule.id}>
                  {formule.nom} — {formule.tarif.toLocaleString('fr-FR')} FCFA
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date de début<span className="required-mark">*</span></label>
            <input
              type="date"
              value={form.dateDebut}
              onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              Souscrire
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SouscriptionModal;
