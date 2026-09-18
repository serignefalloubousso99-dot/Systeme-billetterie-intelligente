import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getStoredUser, setStoredUser, clearAuth } from '../services/api';
import { validateNewPassword } from '../utils/validators';
import './Login.css';

// Écran plein dédié au changement de mot de passe temporaire, imposé à la
// première connexion pour des raisons de sécurité (cf. cahier des charges).
// Volontairement en dehors de DashboardLayout : rien d'autre que ce formulaire
// n'est accessible tant que ce n'est pas fait.
function ForcePasswordChange() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.title = 'Changement de mot de passe requis - Système de Billetterie';

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (!user.mustChangePassword) {
      navigate('/', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user || !user.mustChangePassword) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateNewPassword(newPassword, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.changePassword(null, newPassword);
      setStoredUser(data.user);
      setSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 1000);
    } catch (err) {
      setError(err.message || 'Échec du changement de mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <div className="login-container">
      <div className="gemini-bg" />
      <div className="gemini-aura">
        <div className="aura-spot spot-1" />
        <div className="aura-spot spot-2" />
        <div className="aura-spot spot-3" />
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="logo-badge">
            <span className="material-symbols-outlined logo-icon">lock_reset</span>
          </div>
          <h1 className="login-title">Choisissez votre mot de passe</h1>
          <p className="login-subtitle">
            Bonjour {user.prenom}. Définissez votre mot de passe pour continuer.
          </p>
        </div>

        {error && (
          <div className="login-error-alert">
            <span className="material-symbols-outlined login-alert-icon">error</span>
            <span className="login-alert-text">{error}</span>
          </div>
        )}

        {success && (
          <div className="login-success-alert">
            <span className="material-symbols-outlined login-alert-icon">check_circle</span>
            <span className="login-alert-text">Mot de passe modifié. Redirection...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-input-group">
            <label htmlFor="new-password" className="form-label">Nouveau mot de passe<span className="required-mark">*</span></label>
            <div className={`login-input-wrapper ${focusedField === 'new' ? 'focused' : ''}`}>
              <span className="material-symbols-outlined login-input-icon">lock_reset</span>
              <input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setFocusedField('new')}
                onBlur={() => setFocusedField(null)}
                disabled={isLoading || success}
                className="login-input-field"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="login-eye-btn"
                aria-label={showNew ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                disabled={isLoading || success}
              >
                <span className="material-symbols-outlined login-eye-icon">
                  {showNew ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="login-input-group">
            <label htmlFor="confirm-password" className="form-label">Confirmer le nouveau mot de passe<span className="required-mark">*</span></label>
            <div className={`login-input-wrapper ${focusedField === 'confirm' ? 'focused' : ''}`}>
              <span className="material-symbols-outlined login-input-icon">lock_reset</span>
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField(null)}
                disabled={isLoading || success}
                className="login-input-field"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="login-eye-btn"
                aria-label={showConfirm ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                disabled={isLoading || success}
              >
                <span className="material-symbols-outlined login-eye-icon">
                  {showConfirm ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <p className="login-subtitle" style={{ textAlign: 'left' }}>
            8 caractères minimum.
          </p>

          <button type="submit" disabled={isLoading || success} className="login-submit-btn">
            {isLoading ? (
              <span className="login-loader"></span>
            ) : (
              <>
                Valider
                <span className="material-symbols-outlined">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <button type="button" onClick={handleLogout} className="login-forgot-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForcePasswordChange;
