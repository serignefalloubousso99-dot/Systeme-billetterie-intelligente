import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/api';
import { getSouscriptionById, getHistorique, setSouscriptionStatut, renouvelerSouscription } from '../services/apiAbonnements';
import { formatDateFR, formatDateTimeFR, dureeValiditeJours, tempsRestant } from '../utils/dates';

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

function AbonnementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [abonnement, setAbonnement] = useState(null);
  const [client, setClient] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewDate, setRenewDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ abonnement: abo }, hist] = await Promise.all([
        getSouscriptionById(id),
        getHistorique(id),
      ]);
      setAbonnement(abo);
      setHistorique(hist);
      setError(null);

      try {
        const users = await api.getUsers({ role: 'Client' });
        setClient(users.find((u) => u.id === abo.utilisateurId) || null);
      } catch (err) {
        console.warn('Impossible de récupérer les informations du client', err);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    document.title = "Détail abonnement - Système de Billetterie";
    fetchDetail();
  }, [fetchDetail]);

  const handleToggleSuspend = async () => {
    try {
      const nextStatut = abonnement.statut === 'SUSPENDU' ? 'ACTIF' : 'SUSPENDU';
      await setSouscriptionStatut(id, nextStatut);
      setActionError(null);
      fetchDetail();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleResilier = async () => {
    if (!window.confirm("Résilier cet abonnement ? Cette action est définitive.")) return;
    try {
      await setSouscriptionStatut(id, 'RESILIE');
      setActionError(null);
      fetchDetail();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleRenouveler = async (e) => {
    e.preventDefault();
    try {
      await renouvelerSouscription(id, renewDate);
      setActionError(null);
      setIsRenewing(false);
      fetchDetail();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (isLoading) {
    return (
      <main className="main-content">
        <div className="loader-container">
          <span className="page-loader"></span>
          <p className="loader-text">Chargement de l'abonnement...</p>
        </div>
      </main>
    );
  }

  if (error || !abonnement) {
    return (
      <main className="main-content">
        <div className="offline-notice">
          <span className="material-symbols-outlined offline-icon">error</span>
          <div>
            <div className="offline-title">Abonnement introuvable</div>
            <div className="offline-text">{error || "Cet abonnement n'existe pas."}</div>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/abonnements')} style={{ marginTop: '1rem' }}>
          Retour à la liste
        </button>
      </main>
    );
  }

  return (
    <main className="main-content">
      <section className="page-header">
        <div>
          <button className="btn-secondary" onClick={() => navigate('/abonnements')}>
            <span className="material-symbols-outlined btn-icon">arrow_back</span>
            Retour
          </button>
          <h1 className="page-title" style={{ marginTop: '0.75rem' }}>
            {client ? `${client.prenom} ${client.nom}` : abonnement.utilisateurId}
          </h1>
          <p className="page-subtitle">{abonnement.formule.nom} — {TYPE_LABELS[abonnement.formule.type] || abonnement.formule.type}</p>
        </div>
        {abonnement.statut !== 'RESILIE' && (
          <div className="action-button-group">
            <button className="btn-secondary" onClick={() => setIsRenewing((v) => !v)}>
              <span className="material-symbols-outlined btn-icon">autorenew</span>
              Renouveler
            </button>
            <button className="btn-secondary" onClick={handleToggleSuspend}>
              <span className="material-symbols-outlined btn-icon">
                {abonnement.statut === 'SUSPENDU' ? 'play_circle' : 'pause_circle'}
              </span>
              {abonnement.statut === 'SUSPENDU' ? 'Réactiver' : 'Suspendre'}
            </button>
            <button
              className="btn-secondary"
              onClick={handleResilier}
              style={{ color: '#ef4444', borderColor: '#fecaca' }}
            >
              <span className="material-symbols-outlined btn-icon">cancel</span>
              Résilier
            </button>
          </div>
        )}
      </section>

      {actionError && (
        <div className="offline-notice">
          <span className="material-symbols-outlined offline-icon">error</span>
          <div>
            <div className="offline-title">Action impossible</div>
            <div className="offline-text">{actionError}</div>
          </div>
        </div>
      )}

      {isRenewing && (
        <section className="table-card" style={{ padding: '1.5rem 2rem' }}>
          <form onSubmit={handleRenouveler} className="modal-grid">
            <div className="form-group">
              <label className="form-label">Nouvelle date de début<span className="required-mark">*</span></label>
              <input
                type="date"
                value={renewDate}
                onChange={(e) => setRenewDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end', flexDirection: 'row', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setIsRenewing(false)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary">
                Confirmer le renouvellement
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="table-card" style={{ padding: '1.5rem 2rem' }}>
        <div className="modal-grid">
          <div className="form-group">
            <label className="form-label">Statut</label>
            <div className="status-cell">
              <span className="status-dot" style={{ backgroundColor: STATUT_COLORS[abonnement.statut] }}></span>
              <span className="status-text">{STATUT_LABELS[abonnement.statut] || abonnement.statut}</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Client</label>
            <div className="user-email-text">{client ? client.email : abonnement.utilisateurId}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Date de début</label>
            <div className="user-email-text">{formatDateFR(abonnement.dateDebut)}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Date d'expiration</label>
            <div className="user-email-text">{formatDateFR(abonnement.dateExpiration)}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Durée de validité</label>
            <div className="user-email-text">
              {dureeValiditeJours(abonnement.dateDebut, abonnement.dateExpiration)} jours au total — {tempsRestant(abonnement.dateExpiration)}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Voyages</label>
            <div className="user-email-text">
              {abonnement.voyagesRestants === null
                ? `${abonnement.voyagesConsommes} voyage(s) consommé(s) (illimité)`
                : `${abonnement.voyagesConsommes} consommé(s) / ${abonnement.voyagesRestants} restant(s) sur ${abonnement.voyagesAutorises}`}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Créé le</label>
            <div className="user-email-text">
              {abonnement.createdAt ? formatDateTimeFR(abonnement.createdAt) : formatDateFR(abonnement.creeLe)}
            </div>
          </div>
        </div>
      </section>

      {abonnement.formule.type === 'TICKET_SIMPLE' && (
        <section className="table-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 className="stats-card-title" style={{ marginBottom: '1rem' }}>Billet QR Code</h3>
          {abonnement.statut === 'ACTIF' ? (
            <>
              <div
                style={{
                  display: 'inline-block',
                  padding: '1rem',
                  background: '#fff',
                  borderRadius: '1rem',
                  border: '1px solid #DBEAFE',
                }}
              >
                <QRCodeSVG
                  value={JSON.stringify({ type: 'TICKET_SIMPLE', abonnementId: abonnement.id })}
                  size={180}
                />
              </div>
              <p className="user-email-text" style={{ marginTop: '1rem' }}>
                Code unique à présenter à la validation — à usage unique, se désactive automatiquement après le voyage.
              </p>
            </>
          ) : (
            <p className="user-email-text">
              {abonnement.statut === 'EPUISE'
                ? 'Billet déjà utilisé.'
                : `Billet indisponible (${STATUT_LABELS[abonnement.statut] || abonnement.statut}).`}
            </p>
          )}
        </section>
      )}

      <section className="table-card">
        <div className="table-responsive">
          <table className="user-table">
            <thead>
              <tr className="table-header-row">
                <th className="table-header-th">Date du voyage</th>
                <th className="table-header-th">Référence de validation</th>
              </tr>
            </thead>
            <tbody>
              {historique.length > 0 ? (
                historique.map((h) => (
                  <tr key={h.id} className="table-row">
                    <td className="table-td">{formatDateTimeFR(h.dateVoyage)}</td>
                    <td className="table-td-id">{h.validationId}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="table-empty-cell">
                    Aucun voyage enregistré pour cet abonnement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default AbonnementDetail;
