import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import { api } from '../../api/client';
import useAsync from '../../hooks/useAsync';
import { Icon } from '../common';
import { NAV_SECTIONS } from './nav';

function useCounts(can) {
  const { data, reload } = useAsync(async () => {
    const [threads, pending] = await Promise.all([
      can('chat.send') ? api.get('/threads') : null,
      can('discount.approve') ? api.get('/approvals/pending') : null,
    ]);
    return {
      unread: threads?.threads.reduce((sum, t) => sum + t.unreadCount, 0) || 0,
      pending: pending?.count || 0,
    };
  }, [can]);

  useSocketEvent('thread:updated', reload);
  useSocketEvent('notification', reload);
  return data || {};
}

/** Floating navigation panel under the header. Desktop: full or icon rail. Mobile: a drawer. */
export default function Sidebar({ open, collapsed, onToggleCollapsed, onNavigate }) {
  const { can } = useAuth();
  const counts = useCounts(can);

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => can(item.permission));
          if (!items.length) return null;
          return (
            <div key={section.label} className="nav-group">
              <div className="nav-section">{section.label}</div>
              {items.map((item) => {
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <NavLink key={item.to} to={item.to} onClick={onNavigate} data-label={item.label}
                    className={({ isActive }) => ['nav-link', isActive && 'active', count > 0 && 'has-badge'].filter(Boolean).join(' ')}>
                    <Icon name={item.icon} />
                    <span className="nav-label">{item.label}</span>
                    {count > 0 && <span className="count">{count}</span>}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <button type="button" className="sidebar-toggle" onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} data-label={collapsed ? 'Expand' : 'Collapse'}>
        <Icon name={collapsed ? 'arrowRight' : 'arrowLeft'} size={16} />
        <span className="nav-label">Collapse</span>
      </button>
    </aside>
  );
}
