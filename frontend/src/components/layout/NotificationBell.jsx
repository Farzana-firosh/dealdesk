import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { Button, EmptyState, Icon } from '../common';
import { formatTime } from '../../utils/format';

const ICON = {
  'discount.requested': { name: 'approvals', bg: 'var(--warning-soft)', color: 'var(--warning)' },
  'discount.decided': { name: 'check', bg: 'var(--success-soft)', color: 'var(--success)' },
  'invoice.status_changed': { name: 'invoices', bg: 'var(--info-soft)', color: 'var(--info)' },
};

export default function NotificationBell() {
  const { notifications, unseen, markSeen } = useSocket();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = () => {
    setOpen((v) => !v);
    markSeen();
  };

  return (
    <div className="dropdown" ref={ref}>
      <Button variant="ghost" icon="bell" onClick={toggle} aria-label="Notifications" />
      {unseen > 0 && <span className="count bell-count">{unseen}</span>}
      {open && (
        <div className="dropdown-panel">
          <div className="card-header"><span className="card-title">Notifications</span></div>
          {notifications.length === 0 ? (
            <EmptyState icon="bell" title="No notifications yet">Live updates appear here.</EmptyState>
          ) : (
            notifications.map((n) => {
              const icon = ICON[n.type] || ICON['invoice.status_changed'];
              return (
                <div key={n.id} className="notif">
                  <span className="notif-icon" style={{ background: icon.bg, color: icon.color }}>
                    <Icon name={icon.name} size={15} />
                  </span>
                  <div>
                    <div>{n.text}</div>
                    <span className="faint">{formatTime(n.at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
