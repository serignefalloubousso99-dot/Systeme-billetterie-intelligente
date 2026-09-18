import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { getSouscriptions } from '../services/apiAbonnements';
import { creerTitre } from '../services/apiBilletterie';
import { formatDateFR } from '../utils/dates';

function CreateTitreModal({ isOpen, onClose, onCreated }) {
  const [clients, setClients] = useState([]);
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [abonnementsClient, setAbonnementsClient] = useState([]);

  const [typeTitre, setTypeTitre] = useState('TICKET_SIMPLE');
  const [abonnementId, setAbonnementId] = useState('');
  const [dateExpiration, setDateExpiration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Charger les clients actifs
  useEffect(() => {
    if (!isOpen) return;
    api.getUsers({ role: 'Client' })
      .then((res) => {
        const list = res.users || res;
        setClients(Array.isArray(list) ? list.filter((u) => u.status === 'Actif') : []);
      })
      .catch((e) => console.error(e));
  }, [isOpen]);

  // Charger les abonnements quand un client est sélectionné
  useEffect(() => {
    if (!selectedClient) {
      setAbonnementsClient([]);
      setAbonnementId('');
      return;
    }

    getSouscriptions({ utilisateurId: selectedClient.id })
      .then((list) => {
        const activeList = Array.isArray(list) ? list.filter((a) => a.statut === 'ACTIF') : [];
        setAbonnementsClient(activeList);
        if (activeList.length > 0) {
          setAbonnementId(activeList[0].id);
          setDateExpiration(activeList[0].dateExpiration ? activeList[0].dateExpiration.split('T')[0] : '');
          if (activeList[0].formule?.type) {
            setTypeTitre(activeList[0].formule.type);
          }
        }
      })
      .catch(() => setAbonnementsClient([]));
  }, [selectedClient]);

  if (!isOpen) return null;

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

  const handleSelectClient = (c) => {
    setSelectedClient(c);
    setClientQuery('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) {
      setError('Veuillez sélectionner un client.');
      return;
    }

    if (typeTitre !== 'TICKET_SIMPLE' && !abonnementId) {
      setError('Veuillez associer un abonnement actif.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        utilisateurId: selectedClient.id,
        typeTitre,
        abonnementId: abonnementId ? Number(abonnementId) : null,
        dateExpiration: dateExpiration || null,
      };

      const res = await creerTitre(payload);
      onCreated(res.titre);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la génération du titre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Générer un titre de transport</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fermer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Sélection du client */}
          <div className="form-group">
            <label className="form-label">Client bénéficiaire <span className="required-mark">*</span></label>
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
                  onClick={() => setSelectedClient(null)}
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
                          <button
                            type="button"
                            className="client-suggestion"
                            onClick={() => handleSelectClient(client)}
                          >
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
                      <li className="client-no-result">Aucun client actif ne correspond.</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Type de titre */}
          <div className="form-group">
            <label className="form-label">Type de titre <span className="required-mark">*</span></label>
            <select
              value={typeTitre}
              onChange={(e) => setTypeTitre(e.target.value)}
              className="form-select"
            >
              <option value="TICKET_SIMPLE">Ticket Simple (1 voyage unique)</option>
              <option value="LIMITE">Abonnement Limité (nombre de voyages)</option>
              <option value="ILLIMITE">Abonnement Illimité</option>
            </select>
          </div>

          {/* Association à un abonnement si type LIMITE ou ILLIMITE */}
          {typeTitre !== 'TICKET_SIMPLE' && (
            <div className="form-group">
              <label className="form-label">Abonnement associé <span className="required-mark">*</span></label>
              {abonnementsClient.length > 0 ? (
                <select
                  value={abonnementId}
                  onChange={(e) => {
                    setAbonnementId(e.target.value);
                    const abo = abonnementsClient.find((a) => String(a.id) === e.target.value);
                    if (abo?.dateExpiration) setDateExpiration(abo.dateExpiration.split('T')[0]);
                  }}
                  className="form-select"
                >
                  {abonnementsClient.map((abo) => (
                    <option key={abo.id} value={abo.id}>
                      #{abo.id} — {abo.formule?.nom || 'Abonnement'} (Expire le {formatDateFR(abo.dateExpiration)})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="form-hint" style={{ color: '#ef4444' }}>
                  Ce client ne possède aucun abonnement actif. Créez d'abord une souscription dans l'onglet Abonnements, ou choisissez "Ticket Simple".
                </p>
              )}
            </div>
          )}

          {/* Date d'expiration optionnelle */}
          <div className="form-group">
            <label className="form-label">Date d'expiration</label>
            <input
              type="date"
              value={dateExpiration}
              onChange={(e) => setDateExpiration(e.target.value)}
              className="form-input"
            />
            <span className="form-hint">Laisser vide pour un ticket sans date limite</span>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !selectedClient || (typeTitre !== 'TICKET_SIMPLE' && !abonnementId)}
            >
              {loading ? 'Génération...' : 'Générer le QR Code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTitreModal;
