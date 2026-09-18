import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { getSouscriptions, createSouscription } from '../services/apiAbonnements';
import SouscriptionModal from '../components/SouscriptionModal';
import { formatDateFR, dureeValiditeJours, tempsRestant } from '../utils/dates';
import './UserManagement.css';

const TYPE_LABELS = {
  TICKET_SIMPLE: 'Ticket simple',
  LIMITE: 'Limité',
  ILLIMITE: 'Illimité',
};

const STATUT_LABELS = {
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  EXPIRE: 'Expiré',
  EPUISE: 'Épuisé',
  RESILIE: 'Résilié',
};

const STATUT_COLORS = {
  ACTIF: '#10b981',
  SUSPENDU: '#f59e0b',
  EXPIRE: '#64748b',
  EPUISE: '#ef4444',
  RESILIE: '#94a3b8',
};

function AbonnementsManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const expireSous = searchParams.get('expireSous');
  const [abonnements, setAbonnements] = useState([]);
  const [clientsById, setClientsById] = useState({});
  const [isLoadingList, setIsLoadingList] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('Tous');
  const [statutFilter, setStatutFilter] = useState('Tous');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = "Abonnements - Système de Billetterie";
  }, []);

  useEffect(() => {
    api.getUsers({ role: 'Client' })
      .then((users) => {
        const map = {};
        users.forEach((u) => { map[u.id] = u; });
        setClientsById(map);
      })
      .catch((err) => console.error('Impossible de récupérer les clients', err));
  }, []);

  const fetchAbonnements = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const params = {};
      if (typeFilter !== 'Tous') params.type = typeFilter;
      if (statutFilter !== 'Tous') params.statut = statutFilter;
      if (expireSous) params.expireSous = expireSous;
      const data = await getSouscriptions(params);
      setAbonnements(data);
    } catch (err) {
      console.error('Impossible de récupérer les abonnements', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [typeFilter, statutFilter, expireSous]);

  useEffect(() => {
    fetchAbonnements();
  }, [fetchAbonnements]);

  const clientLabel = (utilisateurId) => {
    const client = clientsById[utilisateurId];
    return client ? `${client.prenom} ${client.nom}` : utilisateurId;
  };

  const filteredAbonnements = abonnements.filter((a) => {
    const q = searchQuery.toLowerCase();
    const client = clientsById[a.utilisateurId];
    return (
      a.utilisateurId.toLowerCase().includes(q) ||
      a.formule.nom.toLowerCase().includes(q) ||
      (client && `${client.prenom} ${client.nom} ${client.email}`.toLowerCase().includes(q))
    );
  });

  const handleCreateSouscription = async (payload) => {
    // L'erreur doit s'afficher dans la modale (là où l'admin agit), pas dans
    // la bannière de page : on laisse SouscriptionModal l'attraper.
    await createSouscription(payload);
    setIsCreateModalOpen(false);
    setError(null);
    fetchAbonnements();
  };

  return (
    <>
      <main className="main-content">
        <section className="page-header">
          <div>
            <h1 className="page-title">Abonnements</h1>
            <p className="page-subtitle">Consulter les souscriptions et abonner un client à une formule</p>
          </div>
          <div className="action-button-group">
            <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
              <span className="material-symbols-outlined btn-icon">add</span>
              Nouvelle souscription
            </button>
          </div>
        </section>

        {expireSous && (
          <div className="offline-notice">
            <span className="material-symbols-outlined offline-icon">schedule</span>
            <div>
              <div className="offline-title">Abonnements expirant sous {expireSous} jours</div>
              <div className="offline-text">Filtre actif depuis le tableau de bord.</div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginLeft: 'auto' }}
              onClick={() => setSearchParams({})}
            >
              Retirer le filtre
            </button>
          </div>
        )}

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
              placeholder="Rechercher par client ou formule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-dropdowns">
            <div className="filter-chip-group" role="group" aria-label="Filtrer par type">
              {[
                { value: 'Tous', label: 'Tous les types' },
                { value: 'TICKET_SIMPLE', label: 'Ticket simple' },
                { value: 'LIMITE', label: 'Limité' },
                { value: 'ILLIMITE', label: 'Illimité' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`filter-chip${typeFilter === option.value ? ' selected' : ''}`}
                  onClick={() => setTypeFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="filter-dropdown-item">
              <label className="filter-label">Statut</label>
              <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="filter-select">
                <option value="Tous">Tous les statuts</option>
                <option value="ACTIF">Actif</option>
                <option value="SUSPENDU">Suspendu</option>
                <option value="EXPIRE">Expiré</option>
                <option value="EPUISE">Épuisé</option>
                <option value="RESILIE">Résilié</option>
              </select>
            </div>
          </div>
        </section>

        <section className="table-card">
          <div className="table-responsive">
            {isLoadingList ? (
              <div className="loader-container">
                <span className="page-loader"></span>
                <p className="loader-text">Chargement des abonnements...</p>
              </div>
            ) : (
              <table className="user-table">
                <thead>
                  <tr className="table-header-row">
                    <th className="table-header-th">Client</th>
                    <th className="table-header-th">Formule</th>
                    <th className="table-header-th">Validité</th>
                    <th className="table-header-th">Solde</th>
                    <th className="table-header-th">Statut</th>
                    <th className="table-header-th-action">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAbonnements.length > 0 ? (
                    filteredAbonnements.map((abo) => (
                      <tr key={abo.id} className="table-row">
                        <td className="table-td-user">
                          <div className="user-name-text">{clientLabel(abo.utilisateurId)}</div>
                          <div className="user-email-text">{clientsById[abo.utilisateurId]?.email || abo.utilisateurId}</div>
                        </td>
                        <td className="table-td">
                          {abo.formule.nom}
                          <div className="user-email-text">{TYPE_LABELS[abo.formule.type] || abo.formule.type}</div>
                        </td>
                        <td className="table-td">
                          <div>{formatDateFR(abo.dateDebut)} → {formatDateFR(abo.dateExpiration)}</div>
                          <div className="user-email-text">
                            {dureeValiditeJours(abo.dateDebut, abo.dateExpiration)} jours au total · {tempsRestant(abo.dateExpiration)}
                          </div>
                        </td>
                        <td className="table-td">
                          {abo.voyagesRestants === null
                            ? `${abo.voyagesConsommes} voyage(s)`
                            : `${abo.voyagesRestants} / ${abo.voyagesAutorises} restants`}
                        </td>
                        <td className="table-td">
                          <div className="status-cell">
                            <span
                              className="status-dot"
                              style={{ backgroundColor: STATUT_COLORS[abo.statut] }}
                            ></span>
                            <span className="status-text">{STATUT_LABELS[abo.statut] || abo.statut}</span>
                          </div>
                        </td>
                        <td className="table-td-action">
                          <div className="action-cell">
                            <button
                              className="icon-btn"
                              onClick={() => navigate(`/abonnements/${abo.id}`)}
                              title="Voir le détail"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#475569' }}>
                                visibility
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="table-empty-cell">
                        {searchQuery || typeFilter !== 'Tous' || statutFilter !== 'Tous'
                          ? 'Aucun abonnement ne correspond à ces critères.'
                          : 'Aucun abonnement souscrit pour l\'instant — cliquez sur "Nouvelle souscription" pour créer le premier.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      <SouscriptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateSouscription}
      />
    </>
  );
}

export default AbonnementsManagement;
