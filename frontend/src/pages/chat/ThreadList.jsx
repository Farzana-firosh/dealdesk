import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, EmptyState, Input } from '../../components/common';
import { formatShort } from '../../utils/format';

export default function ThreadList({ threads, activeId, loading }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const visible = threads.filter((t) => t.deal?.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <aside className="chat-list">
      <div className="chat-list-head">
        <div className="row">
          <b>Messages</b>
          <span className="spacer" />
          <span className="faint">{threads.length} thread{threads.length === 1 ? '' : 's'}</span>
        </div>
        <Input icon="search" placeholder="Search deals" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="chat-threads">
        {loading && <div className="empty">Loading…</div>}
        {!loading && visible.length === 0 && (
          <EmptyState icon="chat" title="No conversations">You only see threads you take part in.</EmptyState>
        )}
        {visible.map((t) => (
          <div
            key={t.dealId}
            className={`thread-item${t.dealId === activeId ? ' active' : ''}${t.unreadCount ? ' unread' : ''}`}
            onClick={() => navigate(`/chat/${t.dealId}`)}
          >
            <Avatar name={t.deal?.title} size={38} />
            <div className="thread-meta">
              <div className="thread-top">
                <b>{t.deal?.title}</b>
                <span className="faint">{formatShort(t.lastMessage?.createdAt)}</span>
              </div>
              <div className="thread-preview">
                <span>{t.lastMessage ? `${t.lastMessage.senderName.split(' ')[0]}: ${t.lastMessage.text}` : 'No messages yet'}</span>
                {t.unreadCount > 0 && <span className="count">{t.unreadCount}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
