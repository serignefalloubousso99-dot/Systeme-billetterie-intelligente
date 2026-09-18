import React, { useState, useEffect } from 'react';
import { getStatsBilletterie } from '../services/apiBilletterie';

const TYPE_ROWS = [
  { key: 'TICKET_SIMPLE', label: 'Tickets simples', color: '#3b82f6' },
  { key: 'LIMITE', label: 'Abonnements limités', color: '#8b5cf6' },
  { key: 'ILLIMITE', label: 'Abonnements illimités', color: '#10b981' },
];

function BilletterieStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showJustifications, setShowJustifications] = useState(false);

  useEffect(() => {
    getStatsBilletterie()
      .then((res) => setStats(res.stats))
      .catch((err) => setError(err.message || 'Erreur lors du calcul des statistiques'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="main-content">
        <div className="loader-container">
          <span className="page-loader"></span>
          <p className="loader-text">Calcul des indicateurs...</p>
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="main-content">
        <div className="offline-notice">
          <span className="material-symbols-outlined offline-icon">cloud_off</span>
          <div>
            <div className="offline-title">Statistiques indisponibles</div>
            <div className="offline-text">{error || 'Impossible de récupérer les statistiques de billetterie.'}</div>
          </div>
        </div>
      </main>
    );
  }

  const maxHoraire = Math.max(...Object.values(stats.validationsParHeure || {}), 1);
  const tauxRejet = stats.totalValidations > 0 ? (100 - stats.tauxSucces).toFixed(1) : 0;

  return (
    <main className="main-content">
      <section className="page-header">
        <div>
          <h1 className="page-title">Statistiques de billetterie</h1>
          <p className="page-subtitle">Affluence, taux d'autorisation, typologie des titres et motifs de refus</p>
        </div>

        <button type="button" onClick={() => setShowJustifications((v) => !v)} className="btn-secondary">
          <span className="material-symbols-outlined btn-icon">help_outline</span>
          {showJustifications ? 'Masquer les justifications' : 'Pourquoi ces indicateurs ?'}
        </button>
      </section>

      {showJustifications && (
        <section className="table-card bts-justification">
          <h3 className="stats-card-title">Justification des indicateurs retenus</h3>
          <ul className="bts-justification-list">
            <li><strong>Titres émis et validations du jour</strong> — mesurent le volume et l'intensité du trafic en temps réel.</li>
            <li><strong>Taux d'autorisation / de refus</strong> — indicateur direct de l'efficacité du contrôle sur le terrain.</li>
            <li><strong>Répartition des motifs de refus</strong> — distingue la fraude (titre déjà utilisé) des relances commerciales (titre expiré ou épuisé) et des incidents techniques.</li>
            <li><strong>Affluence par heure</strong> — identifie les heures de pointe pour mieux répartir les agents.</li>
          </ul>
        </section>
      )}

      <section className="stats-grid">
        <div className="stats-card">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}>
              confirmation_number
            </span>
            <h3 className="stats-card-title">Titres émis</h3>
          </div>
          <span className="metric-value">{stats.totalTitres}</span>
          <div className="metric-detail">
            Actifs : {stats.titresParStatut.ACTIF} · Consommés : {stats.titresParStatut.CONSOMME}
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#eff6ff', color: '#1e40af' }}>
              qr_code_scanner
            </span>
            <h3 className="stats-card-title">Validations totales</h3>
          </div>
          <span className="metric-value">{stats.totalValidations}</span>
          <div className="metric-detail">Aujourd'hui : {stats.validationsAujourdhui} contrôle(s)</div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#f0fdf4', color: '#059669' }}>
              check_circle
            </span>
            <h3 className="stats-card-title">Voyages autorisés</h3>
          </div>
          <span className="metric-value status-actif">{stats.autorises}</span>
          <div className="metric-detail">Taux d'autorisation : {stats.tauxSucces}%</div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <span className="material-symbols-outlined stats-card-icon" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
              block
            </span>
            <h3 className="stats-card-title">Voyages refusés</h3>
          </div>
          <span className="metric-value status-supprime">{stats.refuses}</span>
          <div className="metric-detail">Taux de rejet : {tauxRejet}%</div>
        </div>
      </section>

      <section className="bts-two-col-grid">
        <div className="table-card">
          <h3 className="stats-card-title">Répartition par type de titre</h3>
          <div className="bts-progress-list">
            {TYPE_ROWS.map(({ key, label, color }) => (
              <div key={key} className="bts-progress-row">
                <div className="bts-progress-label">
                  <span>{label}</span>
                  <strong>{stats.titresParType[key]}</strong>
                </div>
                <div className="bts-progress-track">
                  <div
                    className="bts-progress-fill"
                    style={{
                      backgroundColor: color,
                      width: `${stats.totalTitres > 0 ? (stats.titresParType[key] / stats.totalTitres) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="table-card">
          <h3 className="stats-card-title">Motifs de refus</h3>
          {Object.keys(stats.refusParMotif).length === 0 ? (
            <p className="bts-empty-hint">Aucun voyage refusé à ce jour.</p>
          ) : (
            <div className="bts-progress-list">
              {Object.entries(stats.refusParMotif).map(([motif, count]) => (
                <div key={motif} className="bts-progress-row">
                  <div className="bts-progress-label">
                    <span className="validation-motif">{motif}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="bts-progress-track">
                    <div
                      className="bts-progress-fill"
                      style={{ backgroundColor: '#ef4444', width: `${(count / stats.refuses) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="table-card">
        <h3 className="stats-card-title">Activité par tranche horaire (aujourd'hui)</h3>
        <div className="bts-hourly-chart">
          {Object.entries(stats.validationsParHeure).map(([heure, count]) => {
            const pct = Math.max((count / maxHoraire) * 100, count > 0 ? 8 : 2);
            return (
              <div key={heure} className="bts-hourly-col">
                <div
                  className={`bts-hourly-bar${count > 0 ? ' active' : ''}`}
                  title={`${heure}h : ${count} validation(s)`}
                  style={{ height: `${pct}%` }}
                />
                <span className="bts-hourly-label">
                  {parseInt(heure, 10) % 3 === 0 ? `${heure}h` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default BilletterieStats;
