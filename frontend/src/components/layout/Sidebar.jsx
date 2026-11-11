import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import { api } from '../../api/client';
import useAsync from '../../hooks/useAsync';
import { Avatar, Button, Icon } from '../common';

// Navigation is filtered by permission, mirroring what the API allows.
const NAV = [
  { to: '/deals', label: 'Deals', icon: 'deals', permission: 'deal.view' },
  { to: '/chat', label: 'Deal chat', icon: 'chat', permission: 'chat.send', badge: 'unread' },
  { to: '/approvals', label: 'Approvals', icon: 'approvals', permission: 'discount.approve', badge: 'pending' },
  { to: '/invoices', label: 'Invoices', icon: 'invoices', permission: 'invoice.view' },
];
const ADMIN_NAV = [{ to: '/settings/approvals', label: 'Approval rules', icon: 'settings', permission: 'approval_config.manage' }];

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

export default function Sidebar({ open, onNavigate }) {
  const { user, can, logout } = useAuth();
  const counts = useCounts(can);

  const renderLink = (item) =>
    can(item.permission) && (
      <NavLink key={item.to} to={item.to} className="nav-link" onClick={onNavigate}>
        <Icon name={item.icon} />
        {item.label}
        {item.badge && counts[item.badge] > 0 && <span className="count">{counts[item.badge]}</span>}
      </NavLink>
    );

  const adminLinks = ADMIN_NAV.map(renderLink).filter(Boolean);

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="brand">
        <span className="brand-mark">D</span>
        DealDesk
      </div>
      <div className="nav-section">Workspace</div>
      {NAV.map(renderLink)}
      {adminLinks.length > 0 && <div className="nav-section">Admin</div>}
      {adminLinks}

      <div className="sidebar-footer">
        <Avatar name={user.name} size={34} />
        <div className="sidebar-user">
          <b>{user.name}</b>
          <span className="faint">{user.role.name.replace('_', ' ')}</span>
        </div>
        <Button variant="ghost" icon="logout" onClick={logout} title="Sign out" aria-label="Sign out" />
      </div>
    </aside>
  );
}
