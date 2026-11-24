import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import useDismiss from '../../hooks/useDismiss';
import { Button, EmptyState, Icon } from '../common';
import { formatTime } from '../../utils/format';

const ICON = {
  'discount.requested': { name: 'approvals', tone: 'warning' },
  'discount.decided': { name: 'check', tone: 'success' },
  'invoice.status_changed': { name: 'invoices', tone: 'info' },
};

export default function NotificationBell() {
  const { notifications, unseen, markSeen, clearHighlight } = useSocket();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  // unread items stay highlighted while the panel is open, then settle
  useEffect(() => {
    if (open) markSeen();
    else clearHighlight();
  }, [open]); // runs on open/close only

  return (
    <div className="dropdown" ref={ref}>
      <Button variant="ghost" icon="bell" onClick={() => setOpen((v) => !v)} aria-label="Notifications" aria-expanded={open} />
      {unseen > 0 && <span className="count bell-count">{unseen}</span>}
      {open && (
        <div className="dropdown-panel">
          <div className="card-header"><span className="card-title">Notifications</span></div>
          {notifications.length === 0 ? (
            <EmptyState icon="bell" title="No notifications yet">Approval and invoice updates appear here.</EmptyState>
          ) : (
            notifications.map((n) => {
              const icon = ICON[n.type] || ICON['invoice.status_changed'];
              return (
                <div key={n.id} className={n.read ? 'notif' : 'notif is-unread'}>
                  <span className={`notif-icon tone-${icon.tone}`}><Icon name={icon.name} size={15} /></span>
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
