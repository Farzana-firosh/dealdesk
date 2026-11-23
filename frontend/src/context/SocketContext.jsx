import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE, api } from '../api/client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext(null);

const describe = (n) => {
  const d = n.data;
  switch (n.type) {
    case 'discount.requested':
      return `Approval needed: ${d.dealTitle || 'a deal'} – ${d.discountPercent}% (step ${d.step}/${d.totalSteps})`;
    case 'discount.decided':
      return `Your discount request was ${d.action} at step ${d.step}${d.requestStatus === 'pending' ? ' – moving to next approver' : ''}`;
    case 'invoice.status_changed':
      return `Invoice ${d.number} is now ${d.status}`;
    default:
      return n.type;
  }
};

/** One socket per logged-in tab. Pages subscribe with useSocketEvent(). */
export function SocketProvider({ children }) {
  const { token } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unseen, setUnseen] = useState(0);

  useEffect(() => {
    if (!token) return undefined;
    // Same origin as the REST calls; without VITE_API_URL it connects to the page origin (dev proxy).
    const options = { auth: { token } };
    const s = API_BASE ? io(API_BASE, options) : io(options);

    // Notifications are stored, so every (re)connect reloads them: nothing is missed while offline.
    const load = () =>
      api
        .get('/notifications')
        .then((res) => {
          setNotifications(res.notifications.map((n) => ({ ...n, text: describe(n) })));
          setUnseen(res.unread);
        })
        .catch(() => {}); // the bell just stays as it was; live ones still arrive

    s.on('connect', () => {
      setConnected(true);
      load();
    });
    s.on('disconnect', () => setConnected(false));
    s.on('notification', (n) => {
      const item = { ...n, text: describe(n) };
      setNotifications((list) => [item, ...list.filter((x) => x.id !== n.id)].slice(0, 30));
      setUnseen((c) => c + 1);
      toast.show(item.text);
    });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setNotifications([]);
      setUnseen(0);
    };
  }, [token, toast]);

  // Opening the bell marks everything read. The list keeps its unread highlight until it closes.
  const markSeen = () => {
    if (unseen === 0) return;
    setUnseen(0);
    api.post('/notifications/read').catch(() => {});
  };

  const clearHighlight = () => setNotifications((list) => list.map((n) => (n.read ? n : { ...n, read: true })));

  const value = { socket, connected, notifications, unseen, markSeen, clearHighlight };
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Subscribe to a socket event for the lifetime of the component. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!socket) return undefined;
    const listener = (payload) => ref.current(payload);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [socket, event]);
}
