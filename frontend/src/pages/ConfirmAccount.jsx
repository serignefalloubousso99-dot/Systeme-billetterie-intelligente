import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { validateNewPassword } from '../utils/validators';
import './Login.css';

// Page publique (hors DashboardLayout, aucune session requise) ouverte depuis
// le lien de confirmation envoyé par e-mail à la création d'un compte.
function ConfirmAccount() {
  const { token } = useParams();
  const navigate = useNavigate();

  // 'chargement' | 'valide' | 'expire' | 'invalide' | 'erreur'
  const [etat, setEtat] = useState('chargement');
  const [email, setEmail] = useState('');

  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.title = 'Confirmer mon compte - Système de Billetterie';

    api
      .verifyConfirmationToken(token)
      .then((data) => {
        setEmail(data.email);
        setEtat('valide');
      })
      .catch((err) => {
        if (err.status === 410) setEtat('expire');
        else if (err.status === 404) setEtat('invalide');
        else setEtat('erreur');
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateNewPassword(motDePasse, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      await api.confirmAccount(token, motDePasse);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true, state: { message: 'Mot de passe défini, vous pouvez vous connecter.' } });
      }, 1200);
    } catch (err) {
      setError(err.message || 'Échec de la confirmation du compte');
    } finally {
      setIsLoading(false);
    }
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
            <span className="material-symbols-outlined logo-icon">mark_email_read</span>
          </div>
          <h1 className="login-title">Confirmer mon compte</h1>
          {etat === 'valide' && (
            <p className="login-subtitle">Compte {email} — choisissez votre mot de passe pour activer l'accès.</p>
          )}
        </div>

        {etat === 'chargement' && (
          <div className="loader-container">
            <span className="page-loader"></span>
          </div>
        )}

        {etat === 'expire' && (
          <div className="login-error-alert">
            <span className="material-symbols-outlined login-alert-icon">error</span>
            <span className="login-alert-text">Lien expiré, demandez un nouveau lien à votre administrateur.</span>
          </div>
        )}

        {etat === 'invalide' && (
          <div className="login-error-alert">
            <span className="material-symbols-outlined login-alert-icon">error</span>
            <span className="login-alert-text">Lien invalide.</span>
          </div>
        )}

        {etat === 'erreur' && (
          <div className="login-error-alert">
            <span className="material-symbols-outlined login-alert-icon">error</span>
            <span className="login-alert-text">Impossible de vérifier ce lien pour le moment.</span>
          </div>
        )}

        {(etat === 'expire' || etat === 'invalide' || etat === 'erreur') && (
          <div className="login-footer">
            <Link to="/login" className="login-forgot-link">Retour à la connexion</Link>
          </div>
        )}

        {etat === 'valide' && (
          <>
            {error && (
              <div className="login-error-alert">
                <span className="material-symbols-outlined login-alert-icon">error</span>
                <span className="login-alert-text">{error}</span>
              </div>
            )}

            {success && (
              <div className="login-success-alert">
                <span className="material-symbols-outlined login-alert-icon">check_circle</span>
                <span className="login-alert-text">Mot de passe défini. Redirection vers la connexion...</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form" noValidate>
              <div className="login-input-group">
                <label htmlFor="confirm-new-password" className="form-label">Mot de passe<span className="required-mark">*</span></label>
                <div className={`login-input-wrapper ${focusedField === 'new' ? 'focused' : ''}`}>
                  <span className="material-symbols-outlined login-input-icon">lock_reset</span>
                  <input
                    id="confirm-new-password"
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    onFocus={() => setFocusedField('new')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading || success}
                    className="login-input-field"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="login-eye-btn"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    disabled={isLoading || success}
                  >
                    <span className="material-symbols-outlined login-eye-icon">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="login-input-group">
                <label htmlFor="confirm-password-repeat" className="form-label">Confirmer le mot de passe<span className="required-mark">*</span></label>
                <div className={`login-input-wrapper ${focusedField === 'confirm' ? 'focused' : ''}`}>
                  <span className="material-symbols-outlined login-input-icon">lock_reset</span>
                  <input
                    id="confirm-password-repeat"
                    type={showConfirm ? 'text' : 'password'}
                    minLength={8}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
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
                    Activer mon compte
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ConfirmAccount;
