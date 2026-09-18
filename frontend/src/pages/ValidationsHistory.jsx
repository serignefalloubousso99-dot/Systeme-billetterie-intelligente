import React, { useState, useEffect, useCallback } from 'react';
import { getValidations } from '../services/apiBilletterie';
import { api } from '../services/api';
import { motifLabel, motifColors } from '../utils/motifsRefus';
import { formatDateFR } from '../utils/dates';

const MOTIFS_OPTIONS = [
  { val: 'QR_CODE_INCONNU', label: 'QR Code inconnu' },
  { val: 'QR_CODE_DESACTIVE', label: 'QR Code désactivé' },
  { val: 'TICKET_DEJA_UTILISE', label: 'Ticket déjà utilisé' },
  { val: 'SOLDE_EPUISE', label: 'Solde de voyages épuisé' },
  { val: 'ABONNEMENT_EXPIRE', label: 'Abonnement expiré' },
  { val: 'ABONNEMENT_SUSPENDU', label: 'Abonnement suspendu' },
  { val: 'ABONNEMENT_RESILIE', label: 'Abonnement résilié' },
  { val: 'ABONNEMENT_PAS_ENCORE_VALIDE', label: 'Abonnement pas encore valide' },
  { val: 'AUCUN_TITRE_VALIDE', label: 'Aucun titre valide' },
  { val: 'SERVICE_INDISPONIBLE', label: 'Service indisponible' },
];

function ValidationsHistory() {
  const [validations, setValidations] = useState([]);
  const [agents, setAgents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtres
  const [resultatFilter, setResultatFilter] = useState('');
  const [motifFilter, setMotifFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadValidations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getValidations({
        resultat: resultatFilter,
        motifRefus: motifFilter,
        date: dateFilter,
        recherche: search,
      });
      const list = Array.isArray(data) ? data : [];
      setValidations(list);

      const ids = [...new Set(list.map((v) => v.agentId).filter(Boolean))];
      if (ids.length > 0) {
        api.lookupUsers(ids)
          .then((res) => {
            const map = {};
            (res.users || []).forEach((a) => { map[a.id] = a; });
            setAgents(map);
          })
          .catch(() => {});
      }
    } catch (err) {
      setError(err.message || "Erreur lors de la récupération de l'historique");
    } finally {
      setLoading(false);
    }
  }, [resultatFilter, motifFilter, dateFilter, search]);

  useEffect(() => {
    loadValidations();
  }, [loadValidations]);

  return (
    <main className="main-content">
      <section className="page-header">
        <div>
          <h1 className="page-title">Historique des validations</h1>
          <p className="page-subtitle">Traçabilité des contrôles autorisés et des tentatives refusées</p>
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
            placeholder="Rechercher par ID validation, code ou ID client..."
          />
        </div>

        <div className="filter-dropdowns">
          <div className="filter-dropdown-item">
            <label className="filter-label">Résultat</label>
            <select className="filter-select" value={resultatFilter} onChange={(e) => setResultatFilter(e.target.value)}>
              <option value="">Tous les résultats</option>
              <option value="AUTORISE">Autorisé</option>
              <option value="REFUSE">Refusé</option>
            </select>
          </div>

          <div className="filter-dropdown-item">
            <label className="filter-label">Motif de refus</label>
            <select className="filter-select" value={motifFilter} onChange={(e) => setMotifFilter(e.target.value)}>
              <option value="">Tous les motifs</option>
              {MOTIFS_OPTIONS.map((m) => (
                <option key={m.val} value={m.val}>{m.label}</option>
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
            <p className="loader-text">Chargement de l'historique...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="user-table">
              <thead>
                <tr className="table-header-row">
                  <th className="table-header-th">ID validation</th>
                  <th className="table-header-th">Date &amp; heure</th>
                  <th className="table-header-th">Résultat</th>
                  <th className="table-header-th">Code scanné</th>
                  <th className="table-header-th">Motif du refus</th>
                  <th className="table-header-th">Agent</th>
                </tr>
              </thead>
              <tbody>
                {validations.length > 0 ? (
                  validations.map((v) => (
                    <tr key={v.id} className="table-row">
                      <td className="table-td-id">{v.id}</td>
                      <td className="table-td">
                        <div>{formatDateFR(v.dateValidation)}</div>
                        <div className="titre-meta">{v.heureValidation}</div>
                      </td>
                      <td className="table-td">
                        <span
                          className="role-badge"
                          style={{
                            backgroundColor: v.resultat === 'AUTORISE' ? '#dcfce7' : '#fee2e2',
                            color: v.resultat === 'AUTORISE' ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {v.resultat === 'AUTORISE' ? 'Autorisé' : 'Refusé'}
                        </span>
                      </td>
                      <td className="table-td-id">{v.codeScanne}</td>
                      <td className="table-td">
                        {v.motifRefus ? (
                          <span className="role-badge" style={motifColors(v.motifRefus)}>
                            {motifLabel(v.motifRefus)}
                          </span>
                        ) : (
                          <span className="titre-meta">—</span>
                        )}
                      </td>
                      <td className="table-td">
                        {agents[v.agentId] ? (
                          `${agents[v.agentId].prenom} ${agents[v.agentId].nom}`
                        ) : (
                          <span className="table-td-id">{v.agentId.substring(0, 10)}...</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="table-empty-cell">
                      {search || resultatFilter || motifFilter || dateFilter
                        ? 'Aucune validation ne correspond à ces critères.'
                        : 'Aucune validation enregistrée — les contrôles effectués depuis la page Scan apparaîtront ici.'}
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

export default ValidationsHistory;
