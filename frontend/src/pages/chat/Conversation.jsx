import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket, useSocketEvent } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { Avatar, Badge, Button, EmptyState } from '../../components/common';
import { formatDay, formatTime } from '../../utils/format';

const addUnique = (list, msg) => (list.some((m) => m._id === msg._id) ? list : [...list, msg]);

export default function Conversation({ dealId, thread, onRead }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | not-participant
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(null);
  const listRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  // history (REST) + room membership (socket); the server re-checks participation for both
  useEffect(() => {
    api
      .get(`/threads/${dealId}/messages`)
      .then(({ messages: history }) => {
        setMessages(history);
        setState('ready');
        api.post(`/threads/${dealId}/read`).then(onRead).catch(() => {});
      })
      .catch((err) => setState(err.status === 404 ? 'not-participant' : 'ready'));
  }, [dealId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket || !connected || state !== 'ready') return undefined;
    socket.emit('thread:join', { dealId }, () => {});
    return () => socket.emit('thread:leave', { dealId }, () => {});
  }, [socket, connected, dealId, state]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, typing]);

  useSocketEvent('chat:message', (msg) => {
    if (msg.dealId !== dealId) return;
    setMessages((list) => addUnique(list, msg));
    setTyping(null);
    if (msg.senderId !== user.id) api.post(`/threads/${dealId}/read`).then(onRead).catch(() => {});
  });

  useSocketEvent('chat:typing', (t) => {
    if (t.dealId !== dealId) return;
    setTyping(t.name);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(null), 2000);
  });

  const send = () => {
    const body = text.trim();
    if (!body) return;
    socket.emit('chat:send', { dealId, text: body }, (res) => {
      if (!res.ok) return toast.error(res.error);
      setText('');
      setState('ready'); // a first-time commenter has now joined the thread
      setMessages((list) => addUnique(list, res.message));
      onRead();
    });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (Date.now() - lastTypingSent.current > 1000) {
      lastTypingSent.current = Date.now();
      socket?.emit('chat:typing', { dealId });
    }
  };

  let lastDay = null;

  return (
    <section className="conversation">
      <div className="conv-head">
        <Button variant="ghost" icon="arrowLeft" className="chat-back" onClick={() => navigate('/chat')} aria-label="Back" />
        <Avatar name={thread?.deal?.title || 'Deal'} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{thread?.deal?.title || 'Deal thread'}</h3>
          <span className="faint">{thread ? `${thread.participantCount} participants` : 'You are not in this thread yet'}</span>
        </div>
        {thread?.deal?.status && <Badge tone="info">{thread.deal.status.replace('_', ' ')}</Badge>}
      </div>

      <div className="messages" ref={listRef}>
        {state === 'loading' && <div className="empty">Loading…</div>}
        {state === 'not-participant' && (
          <EmptyState icon="chat" title="You are not part of this thread">
            If you can see this deal, sending a message adds you as a participant.
          </EmptyState>
        )}
        {state === 'ready' && messages.length === 0 && <EmptyState icon="chat" title="No messages yet">Start the conversation about this deal.</EmptyState>}
        {messages.map((m) => {
          const day = formatDay(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.senderId === user.id;
          return (
            <Fragment key={m._id}>
              {showDay && <div className="day-divider">{day}</div>}
              <div className={`msg${mine ? ' mine' : ''}`}>
                <Avatar name={m.senderName} size={32} />
                <div className="msg-body">
                  <div className="msg-meta">
                    <b>{mine ? 'You' : m.senderName}</b>
                    <span className="faint">{formatTime(m.createdAt)}</span>
                  </div>
                  <div className="bubble">{m.text}</div>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="typing">{typing ? `${typing} is typing…` : ''}</div>
      <div className="composer">
        <textarea rows={1} placeholder="Write a message…" value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} />
        <Button variant="primary" iconRight="send" onClick={send} disabled={!text.trim() || !connected}>Send</Button>
      </div>
    </section>
  );
}
