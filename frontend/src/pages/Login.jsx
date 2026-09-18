import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, setAuth } from '../services/api';
import { validateLoginForm } from '../utils/validators';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Message affiché après une redirection (ex: confirmation de compte réussie)
  const [infoMessage, setInfoMessage] = useState(location.state?.message || '');
  
  // Track input focus states for premium Figma-like active rings
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // SEO Optimization - Title and Meta Description
  useEffect(() => {
    document.title = "Connexion - Système de Billetterie Intelligente";
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = "Portail de connexion sécurisé pour le Système de Billetterie Intelligente. Gérer vos voyages, tickets et abonnements.";
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setInfoMessage('');

    const validationError = validateLoginForm({ email, password });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.login(email, password);
      setAuth(res.token, res.user);
      setSuccess(true);
      setTimeout(() => {
        // Mot de passe temporaire : on impose d'abord son remplacement
        navigate(res.user.mustChangePassword ? '/change-password' : '/');
      }, 1000);
    } catch (err) {
      setError(err.message || 'Échec de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Gemini Background Depth */}
      <div className="gemini-bg" />
      <div className="gemini-aura">
        <div className="aura-spot spot-1" />
        <div className="aura-spot spot-2" />
        <div className="aura-spot spot-3" />
      </div>

      <div className="login-card">
        {/* Brand & Logo Section */}
        <div className="login-header">
          <div className="logo-badge">
            <span className="material-symbols-outlined logo-icon">
              local_activity
            </span>
          </div>
          <h1 id="login-title" className="login-title">Billetterie Intelligente</h1>
          <p className="login-subtitle">Connectez-vous pour accéder à votre tableau de bord</p>
        </div>

        {/* Action Alerts */}
        {infoMessage && !error && (
          <div className="login-success-alert">
            <span className="material-symbols-outlined login-alert-icon">
              check_circle
            </span>
            <span className="login-alert-text">{infoMessage}</span>
          </div>
        )}

        {error && (
          <div id="login-error" className="login-error-alert">
            <span className="material-symbols-outlined login-alert-icon">
              error
            </span>
            <span className="login-alert-text">{error}</span>
          </div>
        )}

        {success && (
          <div id="login-success" className="login-success-alert">
            <span className="material-symbols-outlined login-alert-icon">
              check_circle
            </span>
            <span className="login-alert-text">Authentification réussie. Redirection...</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-input-group">
            <label htmlFor="login-email" className="form-label">Adresse email ou Identifiant<span className="required-mark">*</span></label>
            <div className={`login-input-wrapper ${isEmailFocused ? 'focused' : ''}`}>
              <span className="material-symbols-outlined login-input-icon">
                alternate_email
              </span>
              <input
                id="login-email"
                type="email"
                placeholder="nom@entreprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsEmailFocused(true)}
                onBlur={() => setIsEmailFocused(false)}
                disabled={isLoading || success}
                className="login-input-field"
                required
              />
            </div>
          </div>

          <div className="login-input-group">
            <div className="login-label-row">
              <label htmlFor="login-password" className="form-label">Mot de passe<span className="required-mark">*</span></label>
              <a href="#forgot-password" className="login-forgot-link">Oublié ?</a>
            </div>
            <div className={`login-input-wrapper ${isPasswordFocused ? 'focused' : ''}`}>
              <span className="material-symbols-outlined login-input-icon">
                lock
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                disabled={isLoading || success}
                className="login-input-field"
                required
              />
              <button
                id="toggle-password-btn"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="login-eye-btn"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                disabled={isLoading || success}
              >
                <span className="material-symbols-outlined login-eye-icon">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isLoading || success}
            className="login-submit-btn"
          >
            {isLoading ? (
              <span className="login-loader"></span>
            ) : (
              <>
                Se connecter
                <span className="material-symbols-outlined">
                  arrow_forward
                </span>
              </>
            )}
          </button>
        </form>

        {/* Footer Branding */}
        <div className="login-footer">
          <p className="login-footer-text">
            Plateforme Sécurisée de Billetterie & Transport 
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
