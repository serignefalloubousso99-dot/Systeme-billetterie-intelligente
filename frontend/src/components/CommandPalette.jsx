import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Palette de commandes (Ctrl+K / Cmd+K) : sauter directement sur une page
// sans naviguer dans la sidebar. Les entrées sont filtrées par rôle en amont
// (voir DashboardLayout), cette liste ne connaît que ce qu'on lui donne.
function CommandPalette({ open, onClose, entries }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Laisser le temps au modal de s'afficher avant de forcer le focus
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q) || e.keywords?.toLowerCase().includes(q));
  }, [query, entries]);

  const select = (entry) => {
    if (!entry) return;
    navigate(entry.to);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[activeIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-row">
          <span className="material-symbols-outlined">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Aller à... (utilisateurs, formules, scan...)"
            className="command-palette-input"
          />
          <kbd className="command-palette-kbd">Échap</kbd>
        </div>

        <ul className="command-palette-list">
          {results.length > 0 ? (
            results.map((entry, i) => (
              <li key={entry.to}>
                <button
                  type="button"
                  className={`command-palette-item${i === activeIndex ? ' active' : ''}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(entry)}
                >
                  <span className="material-symbols-outlined">{entry.icon}</span>
                  <span>{entry.label}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="command-palette-empty">Aucune page ne correspond à « {query} ».</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default CommandPalette;
