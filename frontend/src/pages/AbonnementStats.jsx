import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { getStatsAbonnements } from '../services/apiAbonnements';
import { getStatsBilletterie } from '../services/apiBilletterie';
import { motifLabel } from '../utils/motifsRefus';

const STATUT_ABO_LABELS = {
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  EXPIRE: 'Expiré',
  EPUISE: 'Épuisé',
  RESILIE: 'Résilié',
};

const STATUT_ABO_COLORS = {
  ACTIF: '#10b981',
  SUSPENDU: '#f59e0b',
  EXPIRE: '#64748b',
  EPUISE: '#ef4444',
  RESILIE: '#94a3b8',
};

const TYPE_LABELS = {
  TICKET_SIMPLE: 'Ticket simple',
  LIMITE: 'Limité',
  ILLIMITE: 'Illimité',
};

const ROLE_LABELS = { Administrateur: 'Administrateurs', Agent: 'Agents', Client: 'Clients' };
const ROLE_COLORS = { Administrateur: '#4f46e5', Agent: '#1e40af', Client: '#6b21a8' };

const TITRE_STATUT_LABELS = { ACTIF: 'Actif', DESACTIVE: 'Désactivé', CONSOMME: 'Consommé', EXPIRE: 'Expiré' };
const TITRE_STATUT_COLORS = { ACTIF: '#10b981', DESACTIVE: '#ef4444', CONSOMME: '#64748b', EXPIRE: '#f59e0b' };

function AbonnementStats() {
  const navigate = useNavigate();
  const [statsUsers, setStatsUsers] = useState(null);
  const [statsAbo, setStatsAbo] = useState(null);
  const [statsBillet, setStatsBillet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = "Tableau de bord - Système de Billetterie";
    Promise.allSettled([api.getStats(), getStatsAbonnements(), getStatsBilletterie()])
      .then(([users, abo, billet]) => {
        if (users.status === 'fulfilled') setStatsUsers(users.value.stats);
        if (abo.status === 'fulfilled') setStatsAbo(abo.value.stats);
        if (billet.status === 'fulfilled') setStatsBillet(billet.value.stats);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <main className="main-content">
        <div className="loader-container">
          <span className="page-loader"></span>
          <p className="loader-text">Chargement des statistiques...</p>
        </div>
      </main>
    );
  }

  if (!statsUsers && !statsAbo && !statsBillet) {
    return (
      <main className="main-content">
        <div className="offline-notice">
          <span className="material-symbols-outlined offline-icon">cloud_off</span>
          <div>
            <div className="offline-title">Statistiques indisponibles</div>
            <div className="offline-text">Impossible de contacter les services pour récupérer les statistiques.</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <section className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Vue d'ensemble des comptes, abonnements et de la billetterie</p>
        </div>
        <div className="action-button-group">
          <button className="btn-secondary" onClick={() => navigate('/users')}>
            <span className="material-symbols-outlined btn-icon">person_add</span>
            Ajouter un utilisateur
          </button>
          <button className="btn-secondary" onClick={() => navigate('/formules')}>
            <span className="material-symbols-outlined btn-icon">add</span>
            Créer une formule
          </button>
          <button className="btn-primary" onClick={() => navigate('/abonnements')}>
            <span className="material-symbols-outlined btn-icon">card_membership</span>
            Nouvelle souscription
          </button>
        </div>
      </section>

      {/* KPIs transversaux */}
      <section className="stats-grid">
        <Link to="/users" className="stats-card stats-card-link">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}>
              group
            </span>
            <h3 className="stats-card-title">Comptes utilisateurs</h3>
          </div>
          <span className="metric-value">{statsUsers?.total ?? '—'}</span>
        </Link>

        <Link to="/abonnements" className="stats-card stats-card-link">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#f0fdf4', color: '#059669' }}>
              card_membership
            </span>
            <h3 className="stats-card-title">Abonnements actifs</h3>
          </div>
          <span className="metric-value">{statsAbo?.parStatut?.ACTIF ?? '—'}</span>
          <div className="metric-detail">{statsAbo?.total ?? 0} au total</div>
        </Link>

        <Link to="/titres" className="stats-card stats-card-link">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#eff6ff', color: '#1e40af' }}>
              confirmation_number
            </span>
            <h3 className="stats-card-title">Titres émis</h3>
          </div>
          <span className="metric-value">{statsBillet?.totalTitres ?? '—'}</span>
        </Link>

        <Link to="/billetterie-stats" className="stats-card stats-card-link">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>
              qr_code_scanner
            </span>
            <h3 className="stats-card-title">Taux d'autorisation</h3>
          </div>
          <span className="metric-value">{statsBillet ? `${statsBillet.tauxSucces}%` : '—'}</span>
          <div className="metric-detail">{statsBillet?.totalValidations ?? 0} scans au total</div>
        </Link>
      </section>

      {statsUsers && (
        <section className="table-card" style={{ padding: '1.5rem 2rem' }}>
          <h3 className="stats-card-title" style={{ marginBottom: '1rem' }}>Comptes par rôle</h3>
          <div className="modal-grid">
            {Object.entries(statsUsers.byRole).map(([role, data]) => (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="status-dot" style={{ backgroundColor: ROLE_COLORS[role] }}></span>
                <span className="status-text">{ROLE_LABELS[role] || role}</span>
                <span className="metric-value" style={{ fontSize: '1rem', marginLeft: 'auto' }}>{data.total}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {statsAbo && (
        <div className="bts-two-col-grid">
          <section className="table-card" style={{ padding: '1.5rem 2rem' }}>
            <h3 className="stats-card-title" style={{ marginBottom: '1rem' }}>Abonnements par statut</h3>
            <div className="modal-grid">
              {Object.entries(statsAbo.parStatut).map(([statut, count]) => (
                <div key={statut} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="status-dot" style={{ backgroundColor: STATUT_ABO_COLORS[statut] }}></span>
                  <span className="status-text">{STATUT_ABO_LABELS[statut] || statut}</span>
                  <span className="metric-value" style={{ fontSize: '1rem', marginLeft: 'auto' }}>{count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="table-card" style={{ padding: '1.5rem 2rem' }}>
            <h3 className="stats-card-title" style={{ marginBottom: '1rem' }}>Abonnements par type</h3>
            <div className="modal-grid">
              {Object.entries(statsAbo.parType).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="status-text">{TYPE_LABELS[type] || type}</span>
                  <span className="metric-value" style={{ fontSize: '1rem', marginLeft: 'auto' }}>{count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="stats-grid">
        {statsAbo && (
          <div className="stats-card">
            <div className="stats-card-header">
              <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#f0fdf4', color: '#059669' }}>
                payments
              </span>
              <h3 className="stats-card-title">Revenu total</h3>
            </div>
            <span className="metric-value">{statsAbo.revenuTotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
        )}

        {statsAbo && (
          <div className="stats-card">
            <div className="stats-card-header">
              <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#eff6ff', color: '#1e40af' }}>
                directions_bus
              </span>
              <h3 className="stats-card-title">Voyages consommés</h3>
            </div>
            <span className="metric-value">{statsAbo.voyagesConsommesTotal}</span>
          </div>
        )}

        {statsAbo && (
          <Link to="/abonnements" className="stats-card stats-card-link">
            <div className="stats-card-header">
              <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>
                schedule
              </span>
              <h3 className="stats-card-title">Expirent sous 7 jours</h3>
            </div>
            <span className="metric-value">{statsAbo.expirentSous7Jours}</span>
          </Link>
        )}

        {statsBillet && (
          <Link to="/validations" className="stats-card stats-card-link">
            <div className="stats-card-header">
              <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                block
              </span>
              <h3 className="stats-card-title">Voyages refusés</h3>
            </div>
            <span className="metric-value">{statsBillet.refuses}</span>
          </Link>
        )}
      </section>

      {statsBillet && (
        <div className="bts-two-col-grid">
          <section className="table-card" style={{ padding: '1.5rem 2rem' }}>
            <h3 className="stats-card-title" style={{ marginBottom: '1rem' }}>Titres par statut</h3>
            <div className="modal-grid">
              {Object.entries(statsBillet.titresParStatut).map(([statut, count]) => (
                <div key={statut} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="status-dot" style={{ backgroundColor: TITRE_STATUT_COLORS[statut] }}></span>
                  <span className="status-text">{TITRE_STATUT_LABELS[statut] || statut}</span>
                  <span className="metric-value" style={{ fontSize: '1rem', marginLeft: 'auto' }}>{count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="table-card" style={{ padding: '1.5rem 2rem' }}>
            <h3 className="stats-card-title" style={{ marginBottom: '1rem' }}>Motifs de refus</h3>
            {Object.keys(statsBillet.refusParMotif).length === 0 ? (
              <p className="bts-empty-hint">Aucun voyage refusé à ce jour.</p>
            ) : (
              <div className="modal-grid">
                {Object.entries(statsBillet.refusParMotif).map(([motif, count]) => (
                  <div key={motif} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="status-text">{motifLabel(motif)}</span>
                    <span className="metric-value" style={{ fontSize: '1rem', marginLeft: 'auto' }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default AbonnementStats;
