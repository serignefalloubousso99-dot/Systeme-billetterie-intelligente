import React, { useEffect, useState, useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getStoredUser, clearAuth, api, photoUrl } from '../services/api';
import CommandPalette from './CommandPalette';
import { useTheme } from '../context/ThemeContext.jsx';
import '../styles/dashboard.css';

// Restrictions d'accès selon le rôle
const AGENT_ALLOWED_PREFIXES = ['/scan', '/titres', '/validations', '/profile'];
const CLIENT_ALLOWED_PREFIXES = ['/mes-titres', '/profile'];

// Destinations de la palette de commandes (Ctrl+K), avec le rôle minimal
// requis pour chacune. 'Client' couvre tout le monde : profil accessible
// par n'importe quel compte authentifié.
const COMMAND_ENTRIES = [
  { to: '/stats', icon: 'bar_chart', label: 'Tableau de bord', role: 'Administrateur' },
  { to: '/scan', icon: 'qr_code_scanner', label: 'Scan', role: 'Agent', keywords: 'contrôle valider' },
  { to: '/titres', icon: 'confirmation_number', label: 'Titres & QR', role: 'Agent' },
  { to: '/validations', icon: 'history', label: 'Validations', role: 'Agent', keywords: 'historique' },
  { to: '/billetterie-stats', icon: 'monitoring', label: 'Stats Billetterie', role: 'Administrateur' },
  { to: '/abonnements', icon: 'card_membership', label: 'Abonnements', role: 'Administrateur', keywords: 'souscription' },
  { to: '/formules', icon: 'receipt_long', label: 'Formules', role: 'Administrateur' },
  { to: '/users', icon: 'group', label: 'Utilisateurs', role: 'Administrateur', keywords: 'comptes clients agents' },
  { to: '/audit', icon: 'shield', label: "Piste d'audit", role: 'Administrateur' },
  { to: '/mes-titres', icon: 'confirmation_number', label: 'Mes titres', role: 'Client', keywords: 'qr code voyage' },
  { to: '/profile', icon: 'account_circle', label: 'Mon profil', role: 'Client' },
];

const ROLE_RANK = { Client: 0, Agent: 1, Administrateur: 2 };

const getStoredCollapsed = () => localStorage.getItem('sidebarCollapsed') === 'true';

// Doit rester aligné avec le breakpoint mobile de dashboard.css (768px).
const MOBILE_QUERY = '(max-width: 768px)';

// Sous ce seuil, la sidebar devient un tiroir plein écran ouvert par un
// bouton hamburger, au lieu d'une colonne d'icônes qui mange la largeur.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

function DashboardLayout() {
  const location = useLocation();
  const currentPath = location.pathname;
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Le repli en icônes n'a pas de sens dans le tiroir mobile : il reste
  // toujours déplié, avec les libellés complets.
  const isCollapsed = collapsed && !isMobile;
  const isDrawerOpen = drawerOpen && isMobile;

  // Ferme le tiroir dès qu'on change de page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [currentPath]);

  // Tiroir ouvert : on bloque le défilement de la page derrière, et Échap le ferme.
  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isDrawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      navigate('/login');
      return;
    }
    setUser(storedUser);

    if (storedUser.mustChangePassword) {
      navigate('/change-password', { replace: true });
      return;
    }

    // Contrôle d'accès RBAC
    if (storedUser.role === 'Agent') {
      const allowed = AGENT_ALLOWED_PREFIXES.some((prefix) => currentPath.startsWith(prefix));
      if (!allowed) {
        navigate('/scan', { replace: true });
      }
    } else if (storedUser.role !== 'Administrateur') {
      const allowed = CLIENT_ALLOWED_PREFIXES.some((prefix) => currentPath.startsWith(prefix));
      if (!allowed) {
        navigate('/mes-titres', { replace: true });
      }
    }
  }, [navigate, currentPath]);

  // Palette de commandes : Ctrl+K / Cmd+K depuis n'importe où dans le
  // tableau de bord, comme un vrai produit — pas juste un menu de plus.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isAdmin = user?.role === 'Administrateur';
  const isAgent = user?.role === 'Agent';
  const isClient = user?.role === 'Client';

  const paletteEntries = useMemo(() => {
    if (!user) return [];
    const rank = ROLE_RANK[user.role] ?? 0;
    return COMMAND_ENTRIES.filter((entry) => rank >= ROLE_RANK[entry.role]);
  }, [user]);

  const blockedForRole =
    !user ||
    (user.role === 'Agent' && !AGENT_ALLOWED_PREFIXES.some((p) => currentPath.startsWith(p))) ||
    (user.role !== 'Administrateur' &&
      user.role !== 'Agent' &&
      !CLIENT_ALLOWED_PREFIXES.some((p) => currentPath.startsWith(p)));

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error(e);
    }
    clearAuth();
    navigate('/login');
  };

  const NavLink = ({ to, icon, label, active }) => (
    <Link to={to} title={label} className={`sidebar-link${active ? ' active' : ''}`}>
      <span className="material-symbols-outlined sidebar-link-icon">{icon}</span>
      <span className="sidebar-link-text">{label}</span>
    </Link>
  );

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-topbar-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={isDrawerOpen}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="material-symbols-outlined nav-brand-icon">local_activity</span>
        <span className="mobile-topbar-title">Billetterie Intelligente</span>
        <button
          type="button"
          className="mobile-topbar-btn"
          onClick={() => setPaletteOpen(true)}
          aria-label="Rechercher"
        >
          <span className="material-symbols-outlined">search</span>
        </button>
      </header>

      {isDrawerOpen && <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} />}

      <aside className={`sidebar${isCollapsed ? ' collapsed' : ''}${isDrawerOpen ? ' drawer-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="material-symbols-outlined nav-brand-icon">local_activity</span>
          <span className="nav-brand-text">Billetterie Intelligente</span>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleCollapsed}
            title={isCollapsed ? 'Déplier le menu' : 'Replier le menu'}
            aria-label={isCollapsed ? 'Déplier le menu' : 'Replier le menu'}
          >
            <span className="material-symbols-outlined">
              {isCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fermer le menu"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <button type="button" className="sidebar-search-hint" onClick={() => { setDrawerOpen(false); setPaletteOpen(true); }} title="Rechercher (Ctrl+K)">
          <span className="material-symbols-outlined">search</span>
          <span className="sidebar-link-text">Rechercher</span>
          <kbd>Ctrl K</kbd>
        </button>

        <nav className="sidebar-nav">
          {isAdmin && (
            <div className="sidebar-section">
              <span className="sidebar-section-title">Vue d'ensemble</span>
              <NavLink to="/stats" icon="bar_chart" label="Tableau de bord" active={currentPath === '/stats'} />
            </div>
          )}

          {(isAdmin || isAgent) && (
            <div className="sidebar-section">
              <span className="sidebar-section-title">Billetterie</span>
              <NavLink to="/scan" icon="qr_code_scanner" label="Scan" active={currentPath === '/scan'} />
              <NavLink to="/titres" icon="confirmation_number" label="Titres & QR" active={currentPath === '/titres'} />
              <NavLink to="/validations" icon="history" label="Validations" active={currentPath === '/validations'} />
              {isAdmin && (
                <NavLink to="/billetterie-stats" icon="monitoring" label="Stats Billetterie" active={currentPath === '/billetterie-stats'} />
              )}
            </div>
          )}

          {isClient && (
            <div className="sidebar-section">
              <span className="sidebar-section-title">Mon espace</span>
              <NavLink to="/mes-titres" icon="confirmation_number" label="Mes titres" active={currentPath === '/mes-titres'} />
            </div>
          )}

          {isAdmin && (
            <>
              <div className="sidebar-section">
                <span className="sidebar-section-title">Abonnements</span>
                <NavLink to="/abonnements" icon="card_membership" label="Abonnements" active={currentPath.startsWith('/abonnements')} />
                <NavLink to="/formules" icon="receipt_long" label="Formules" active={currentPath === '/formules'} />
              </div>

              <div className="sidebar-section">
                <span className="sidebar-section-title">Administration</span>
                <NavLink to="/users" icon="group" label="Utilisateurs" active={currentPath === '/users'} />
                <NavLink to="/audit" icon="shield" label="Piste d'audit" active={currentPath === '/audit'} />
              </div>
            </>
          )}
        </nav>

        {user && (
          <div className="sidebar-footer">
            <Link to="/profile" className="nav-user-identity" title="Mon profil">
              <div className="nav-user-avatar">
                {user.photo ? (
                  <img
                    src={photoUrl(user.photo)}
                    alt=""
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  user.prenom ? user.prenom[0].toUpperCase() : 'U'
                )}
              </div>
              <span className="nav-user-name">{user.prenom} {user.nom}</span>
              <span className="material-symbols-outlined nav-user-chevron">chevron_right</span>
            </Link>

            <button
              onClick={toggleTheme}
              className="sidebar-theme-btn"
              title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
              aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
              <span className="sidebar-link-text">
                {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="sidebar-logout-btn"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="sidebar-link-text">Se déconnecter</span>
            </button>
          </div>
        )}
      </aside>

      <main className="app-content">
        {!blockedForRole && <Outlet />}
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} entries={paletteEntries} />
    </div>
  );
}

export default DashboardLayout;
