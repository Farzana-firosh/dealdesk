import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { useSocket } from '../../context/SocketContext';
import { Button } from '../common';

const TITLES = {
  '/deals': 'Deals',
  '/chat': 'Deal chat',
  '/approvals': 'Approvals',
  '/invoices': 'Invoices',
  '/settings/approvals': 'Approval rules',
};

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { connected } = useSocket();
  const { pathname } = useLocation();
  const title = Object.entries(TITLES).find(([path]) => pathname.startsWith(path))?.[1] || 'DealDesk';
  const isChat = pathname.startsWith('/chat');

  return (
    <div className="app">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div className={`sidebar-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />

      <div className="main">
        <header className="topbar">
          <Button variant="ghost" icon="menu" className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu" />
          <h1>{title}</h1>
          <span className="spacer" />
          <span className={`live-dot${connected ? ' on' : ''}`}>{connected ? 'Live' : 'Offline'}</span>
          <NotificationBell />
        </header>
        <main className={`content${isChat ? ' flush' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
