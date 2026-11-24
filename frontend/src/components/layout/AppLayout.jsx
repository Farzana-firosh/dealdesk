import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

const COLLAPSED_KEY = 'dealdesk.sidebar.collapsed';

// A per-browser preference; storage can be unavailable (private mode), so failures are ignored.
function useStoredFlag(key) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  const update = (next) => {
    setValue(next);
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      /* keep it for this session only */
    }
  };
  return [value, update];
}

/** Fixed header on top; below it the floating sidebar and the scrolling page. */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useStoredFlag(COLLAPSED_KEY);
  const { pathname } = useLocation();
  const isChat = pathname.startsWith('/chat');

  // the mobile drawer closes itself on navigation (including back/forward) and on Escape
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className={`app${collapsed ? ' is-collapsed' : ''}`}>
      <Header onOpenMenu={() => setMenuOpen(true)} />
      <div className="shell">
        <Sidebar open={menuOpen} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} onNavigate={() => setMenuOpen(false)} />
        <div className={`sidebar-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
        <main className={`content${isChat ? ' flush' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
