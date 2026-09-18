import React from 'react';

// Carte de statistiques réutilisable pour le tableau de bord (Global,
// Administrateurs, Agents, Clients). `accent` pilote la couleur via des
// classes CSS (stats-card--global|admin|agent|client) — aucune couleur en
// dur ici, cohérent avec les badges de rôle déjà utilisés dans le tableau.
function StatCard({ title, icon, accent = 'global', stats }) {
  const { total = 0, actif = 0, bloque = 0, supprime = 0 } = stats || {};

  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className={`stats-card stats-card--${accent}`}>
      <div className="stats-card-header">
        <span className="stats-card-icon material-symbols-outlined">{icon}</span>
        <h3 className="stats-card-title">{title}</h3>
      </div>

      <div className="stats-metrics-row">
        <div className="metric-item">
          <span className="metric-value">{total}</span>
          <span className="metric-label">Total</span>
        </div>
        <div className="metric-item">
          <span className="metric-value status-actif">{actif}</span>
          <span className="metric-label">Actifs</span>
        </div>
        <div className="metric-item">
          <span className="metric-value status-bloque">{bloque}</span>
          <span className="metric-label">Bloqués</span>
        </div>
        <div className="metric-item">
          <span className="metric-value status-supprime">{supprime}</span>
          <span className="metric-label">Supprimés</span>
        </div>
      </div>

      <div
        className="stats-ratio-bar"
        title={`${pct(actif)}% actifs, ${pct(bloque)}% bloqués, ${pct(supprime)}% supprimés`}
      >
        <span className="ratio-segment ratio-actif" style={{ width: `${pct(actif)}%` }} />
        <span className="ratio-segment ratio-bloque" style={{ width: `${pct(bloque)}%` }} />
        <span className="ratio-segment ratio-supprime" style={{ width: `${pct(supprime)}%` }} />
      </div>
    </div>
  );
}

export default StatCard;
