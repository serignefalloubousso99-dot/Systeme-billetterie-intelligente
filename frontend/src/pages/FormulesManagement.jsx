import React, { useState, useEffect, useCallback } from 'react';
import { getFormules, createFormule, updateFormule, setFormuleActive } from '../services/apiAbonnements';
import FormuleModal from '../components/FormuleModal';
import ConfirmDialog from '../components/ConfirmDialog';
import './UserManagement.css';

const TYPE_LABELS = {
  TICKET_SIMPLE: 'Ticket simple',
  LIMITE: 'Limité',
  ILLIMITE: 'Illimité',
};

function FormulesManagement() {
  const [formules, setFormules] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('Tous');
  const [statusFilter, setStatusFilter] = useState('Tous');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingFormule, setEditingFormule] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    document.title = 'Formules d\'abonnement - Système de Billetterie';
  }, []);

  const fetchFormules = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const params = {};
      if (typeFilter !== 'Tous') params.type = typeFilter;
      if (statusFilter !== 'Tous') params.actif = statusFilter === 'Actif';
      const data = await getFormules(params);
      setFormules(data);
    } catch (err) {
      console.error('Impossible de récupérer les formules', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchFormules();
  }, [fetchFormules]);

  const filteredFormules = formules.filter((f) =>
    f.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // L'erreur doit s'afficher dans la modale (là où l'admin agit), pas dans
  // la bannière de page : on laisse FormuleModal l'attraper.
  const handleCreateFormule = async (payload) => {
    await createFormule(payload);
    setIsCreateModalOpen(false);
    setError(null);
    fetchFormules();
  };

  const handleUpdateFormule = async (payload) => {
    await updateFormule(editingFormule.id, payload);
    setEditingFormule(null);
    setError(null);
    fetchFormules();
  };

  const runToggleActive = async (formule) => {
    try {
      await setFormuleActive(formule.id, !formule.actif);
      fetchFormules();
    } catch (err) {
      console.error('Échec du changement de statut de la formule', err);
    }
  };

  const handleToggleActive = (formule) => {
    if (formule.actif) {
      setConfirmDialog({
        title: 'Retirer cette formule du catalogue ?',
        message: `"${formule.nom}" ne sera plus proposée aux nouveaux clients. Les abonnements déjà souscrits ne sont pas affectés.`,
        confirmLabel: 'Désactiver',
        danger: true,
        onConfirm: () => runToggleActive(formule),
      });
      return;
    }
    runToggleActive(formule);
  };

  return (
    <>
      <main className="main-content">
        <section className="page-header">
          <div>
            <h1 className="page-title">Formules d'abonnement</h1>
            <p className="page-subtitle">Consulter et administrer les formules proposées aux voyageurs</p>
          </div>
          <div className="action-button-group">
            <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
              <span className="material-symbols-outlined btn-icon">add</span>
              Créer une formule
            </button>
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
              placeholder="Rechercher par nom ou description..."
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
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
                <option value="Tous">Tous les statuts</option>
                <option value="Actif">Actives</option>
                <option value="Inactif">Inactives</option>
              </select>
            </div>
          </div>
        </section>

        <section className="table-card">
          <div className="table-responsive">
            {isLoadingList ? (
              <div className="loader-container">
                <span className="page-loader"></span>
                <p className="loader-text">Chargement des formules...</p>
              </div>
            ) : (
              <table className="user-table">
                <thead>
                  <tr className="table-header-row">
                    <th className="table-header-th">Nom</th>
                    <th className="table-header-th">Type</th>
                    <th className="table-header-th">Tarif</th>
                    <th className="table-header-th">Durée</th>
                    <th className="table-header-th">Voyages</th>
                    <th className="table-header-th">Statut</th>
                    <th className="table-header-th-action">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFormules.length > 0 ? (
                    filteredFormules.map((formule) => (
                      <tr key={formule.id} className="table-row">
                        <td className="table-td-user">
                          <div className="user-name-text">{formule.nom}</div>
                          {formule.description && (
                            <div className="user-email-text">{formule.description}</div>
                          )}
                        </td>
                        <td className="table-td">{TYPE_LABELS[formule.type] || formule.type}</td>
                        <td className="table-td">{formule.tarif.toLocaleString('fr-FR')} FCFA</td>
                        <td className="table-td">{formule.dureeValiditeJours} jours</td>
                        <td className="table-td">{formule.type === 'LIMITE' ? formule.nombreVoyages : '—'}</td>
                        <td className="table-td">
                          <div className="status-cell">
                            <span
                              className="status-dot"
                              style={{ backgroundColor: formule.actif ? '#10b981' : '#ef4444' }}
                            ></span>
                            <span className="status-text">{formule.actif ? 'Active' : 'Inactive'}</span>
                          </div>
                        </td>
                        <td className="table-td-action">
                          <div className="action-cell">
                            <button
                              className="icon-btn"
                              onClick={() => setEditingFormule(formule)}
                              title="Modifier la formule"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#475569' }}>
                                edit
                              </span>
                            </button>
                            <button
                              className="icon-btn"
                              onClick={() => handleToggleActive(formule)}
                              title={formule.actif ? 'Désactiver la formule' : 'Activer la formule'}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#475569' }}>
                                {formule.actif ? 'block' : 'check_circle'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="table-empty-cell">
                        {searchQuery || typeFilter !== 'Tous' || statusFilter !== 'Tous'
                          ? 'Aucune formule ne correspond à ces critères.'
                          : 'Aucune formule créée pour l\'instant — cliquez sur "Créer une formule" pour démarrer le catalogue.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      <FormuleModal
        isOpen={isCreateModalOpen}
        formule={null}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateFormule}
      />

      <FormuleModal
        isOpen={!!editingFormule}
        formule={editingFormule}
        onClose={() => setEditingFormule(null)}
        onSave={handleUpdateFormule}
      />

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        danger={confirmDialog?.danger}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
      />
    </>
  );
}

export default FormulesManagement;
