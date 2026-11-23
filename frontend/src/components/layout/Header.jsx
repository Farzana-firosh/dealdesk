import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import useDismiss from '../../hooks/useDismiss';
import { Avatar, Button, Icon } from '../common';
import { roleLabel } from '../../utils/format';
import NotificationBell from './NotificationBell';

function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="profile-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={user.name} size={34} />
        <span className="profile-text">
          <b>{user.name}</b>
          <span>{roleLabel(user.role.name)}</span>
        </span>
        <Icon name="caret" size={14} />
      </button>
      {open && (
        <div className="dropdown-panel profile-panel" role="menu">
          <div className="profile-card">
            <Avatar name={user.name} size={44} />
            <div>
              <b>{user.name}</b>
              <div className="cell-sub">{user.email}</div>
              <span className="badge badge-primary" style={{ marginTop: 6 }}>{roleLabel(user.role.name)}</span>
            </div>
          </div>
          <button type="button" className="menu-item danger" role="menuitem" onClick={logout}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Fixed top bar: brand on the left; live status, notifications and the profile menu on the right. */
export default function Header({ onOpenMenu }) {
  const { connected } = useSocket();
  return (
    <header className="header">
      <Button variant="ghost" icon="menu" className="menu-toggle" onClick={onOpenMenu} aria-label="Open menu" />
      <div className="brand">
        <span className="brand-mark">D</span>
        <span className="brand-name">DealDesk</span>
      </div>
      <span className="spacer" />
      <span className={`live-dot${connected ? ' on' : ''}`} title={connected ? 'Live updates on' : 'Reconnecting'}>
        <span>{connected ? 'Live' : 'Offline'}</span>
      </span>
      <NotificationBell />
      <ProfileMenu />
    </header>
  );
}
