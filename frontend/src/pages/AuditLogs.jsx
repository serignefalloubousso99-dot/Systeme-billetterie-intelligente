import React, { useState, useEffect, useCallback } from 'react';
import { getAudits } from '../services/apiBilletterie';
import { api } from '../services/api';
import { formatDateFR, formatDateTimeFR } from '../utils/dates';

const ACTIONS_LABELS = {
  GENERATION_TITRE: 'Génération de titre',
  DESACTIVATION_TITRE: 'Désactivation de titre',
  ACTIVATION_TITRE: 'Réactivation de titre',
  SCAN_VALIDATION: 'Scan de validation',
  VALIDATION_MANUELLE: 'Validation manuelle',
};

const ROLE_COLORS = {
  Administrateur: { backgroundColor: '#eff6ff', color: '#1e40af' },
  Agent: { backgroundColor: '#f0fdf4', color: '#166534' },
};

function AuditLogs() {
  const [audits, setAudits] = useState([]);
  const [auteurs, setAuteurs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtres
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAudits({
        action: actionFilter,
        date: dateFilter,
        recherche: search,
      });
      const list = Array.isArray(data) ? data : [];
      setAudits(list);

      const ids = [...new Set(list.map((a) => a.utilisateurId).filter(Boolean))];
      if (ids.length > 0) {
        api.lookupUsers(ids)
          .then((res) => {
            const map = {};
            (res.users || []).forEach((u) => { map[u.id] = u; });
            setAuteurs(map);
          })
          .catch(() => {});
      }
    } catch (err) {
      setError(err.message || "Erreur lors du chargement des pistes d'audit");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFilter, search]);

  useEffect(() => {
    loadAudits();
  }, [loadAudits]);

  return (
    <main className="main-content">
      <section className="page-header">
        <div>
          <h1 className="page-title">Piste d'audit</h1>
          <p className="page-subtitle">Qui a fait quoi, quand, sur quelle ressource — réservé aux administrateurs</p>
        </div>
      </section>

      {error && (
        <div className="offline-notice">
          <span className="material-symbols-outlined offline-icon">error</span>
          <div>
            <div className="offline-title">Une erreur est survenue</div>
            <div className="offline-text">{error}</div>
          </div>
        </div>
      )}

      <section className="filter-toolbar">
        <div className="search-wrapper">
          <span className="material-symbols-outlined search-icon">search</span>
          <input
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par ID auteur ou ID ressource..."
          />
        </div>

        <div className="filter-dropdowns">
          <div className="filter-dropdown-item">
            <label className="filter-label">Action</label>
            <select className="filter-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="">Toutes les actions</option>
              {Object.entries(ACTIONS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="filter-dropdown-item">
            <label className="filter-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="table-card">
        {loading ? (
          <div className="loader-container">
            <span className="page-loader"></span>
            <p className="loader-text">Chargement de l'audit...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="user-table">
              <thead>
                <tr className="table-header-row">
                  <th className="table-header-th">Horodatage</th>
                  <th className="table-header-th">Auteur</th>
                  <th className="table-header-th">Action</th>
                  <th className="table-header-th">Ressource</th>
                  <th className="table-header-th">Résultat</th>
                  <th className="table-header-th">Adresse IP</th>
                </tr>
              </thead>
              <tbody>
                {audits.length > 0 ? (
                  audits.map((a) => {
                    const auteur = auteurs[a.utilisateurId];
                    return (
                      <tr key={a.id} className="table-row">
                        <td className="table-td">
                          <div>{formatDateFR(a.createdAt)}</div>
                          <div className="titre-meta">{formatDateTimeFR(a.createdAt).split(' ').slice(-1)[0]}</div>
                        </td>
                        <td className="table-td">
                          <div className="table-td-id">
                            {auteur ? `${auteur.prenom} ${auteur.nom}` : `${a.utilisateurId.substring(0, 10)}...`}
                          </div>
                          <span className="role-badge" style={ROLE_COLORS[a.role] || {}}>{a.role}</span>
                        </td>
                        <td className="table-td">{ACTIONS_LABELS[a.action] || a.action}</td>
                        <td className="table-td">
                          <span className="titre-meta">{a.ressourceType} : </span>
                          <span className="table-td-id">{a.ressourceId || '—'}</span>
                        </td>
                        <td className="table-td">
                          <span
                            className="role-badge"
                            style={{
                              backgroundColor: a.resultat === 'SUCCES' ? '#dcfce7' : '#fee2e2',
                              color: a.resultat === 'SUCCES' ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {a.resultat}
                          </span>
                        </td>
                        <td className="table-td-id">{a.ipAdresse || '—'}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="table-empty-cell">
                      {search || actionFilter || dateFilter
                        ? 'Aucune action ne correspond à ces critères.'
                        : "Aucune action sensible enregistrée pour l'instant — la génération d'un titre, son activation/désactivation et chaque scan (autorisé ou refusé) apparaîtront ici automatiquement."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default AuditLogs;
