import React, { useState, useEffect } from 'react';
import { getStoredUser } from '../services/api';
import { getTitresClient } from '../services/apiBilletterie';
import { verifierValidite } from '../services/apiAbonnements';
import ViewQrModal from '../components/ViewQrModal';
import { formatDateFR, tempsRestant } from '../utils/dates';

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

function EspaceClient() {
  const user = getStoredUser();
  const [titres, setTitres] = useState([]);
  const [validite, setValidite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTitre, setSelectedTitre] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([getTitresClient(user.id), verifierValidite(user.id)])
      .then(([mesTitres, statutValidite]) => {
        setTitres(Array.isArray(mesTitres) ? mesTitres : []);
        setValidite(statutValidite);
      })
      .catch((err) => setError(err.message || 'Erreur lors du chargement de vos titres'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <main className="main-content">
        <div className="loader-container">
          <span className="page-loader"></span>
          <p className="loader-text">Chargement de vos titres...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content">
        <div className="offline-notice">
          <span className="material-symbols-outlined offline-icon">cloud_off</span>
          <div>
            <div className="offline-title">Espace indisponible</div>
            <div className="offline-text">{error}</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <section className="page-header">
        <div>
          <h1 className="page-title">Mes titres de transport</h1>
          <p className="page-subtitle">Vos titres de transport, vos QR Codes et votre droit à voyager</p>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stats-card">
          <div className="stats-card-header">
            <span
              className="material-symbols-outlined stats-card-icon"
              style={validite?.valide ? { backgroundColor: '#f0fdf4', color: '#059669' } : { backgroundColor: '#fef2f2', color: '#b91c1c' }}
            >
              {validite?.valide ? 'check_circle' : 'block'}
            </span>
            <h3 className="stats-card-title">Droit à voyager</h3>
          </div>
          <span className="metric-value">{validite?.valide ? 'Valide' : 'Aucun titre valide'}</span>
          {validite?.valide && validite.abonnement && (
            <div className="metric-detail">
              {validite.abonnement.voyagesRestants !== null && validite.abonnement.voyagesRestants !== undefined
                ? `Voyages restants : ${validite.abonnement.voyagesRestants}`
                : 'Voyages illimités'}
              {' · '}Expire le {formatDateFR(validite.abonnement.dateExpiration)} ({tempsRestant(validite.abonnement.dateExpiration)})
            </div>
          )}
        </div>
      </section>

      <section className="table-card">
        <h3 className="stats-card-title">Mes titres</h3>
        {titres.length === 0 ? (
          <p className="bts-empty-hint">Vous n'avez aucun titre de transport pour le moment.</p>
        ) : (
          <div className="table-responsive">
            <table className="user-table">
              <thead>
                <tr className="table-header-row">
                  <th className="table-header-th">Type</th>
                  <th className="table-header-th">Statut</th>
                  <th className="table-header-th">Expiration</th>
                  <th className="table-header-th-action">Actions</th>
                </tr>
              </thead>
              <tbody>
                {titres.map((t) => (
                  <tr key={t.id} className="table-row">
                    <td className="table-td">
                      <span className="role-badge" style={TYPE_COLORS[t.typeTitre]}>
                        {TYPE_LABELS[t.typeTitre] || t.typeTitre}
                      </span>
                    </td>
                    <td className="table-td">
                      <span className="role-badge" style={STATUT_COLORS[t.statut]}>{t.statut}</span>
                    </td>
                    <td className="table-td">
                      {t.dateExpiration ? (
                        <>
                          <div>{formatDateFR(t.dateExpiration)}</div>
                          <div className="titre-meta">{tempsRestant(t.dateExpiration)}</div>
                        </>
                      ) : (
                        'Illimitée'
                      )}
                    </td>
                    <td className="table-td-action">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setSelectedTitre(t)}
                      >
                        <span className="material-symbols-outlined btn-icon">qr_code_2</span>
                        Voir le QR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ViewQrModal titre={selectedTitre} onClose={() => setSelectedTitre(null)} />
    </main>
  );
}

export default EspaceClient;
