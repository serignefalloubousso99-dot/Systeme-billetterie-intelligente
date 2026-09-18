import React, { useState } from 'react';

// Champ mot de passe avec icône œil pour basculer entre masqué et visible.
function PasswordInput({ id, value, onChange, className = 'form-input', ...rest }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrapper">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className={className}
        {...rest}
      />
      <button
        type="button"
        className="icon-btn password-toggle-btn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        tabIndex={-1}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#64748b' }}>
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
}

export default PasswordInput;
