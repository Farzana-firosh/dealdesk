import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useSocketEvent } from '../../context/SocketContext';
import useAsync from '../../hooks/useAsync';
import ThreadList from './ThreadList';
import Conversation from './Conversation';
import DealDetailsPanel from './DealDetailsPanel';
import { EmptyState } from '../../components/common';

export default function ChatPage() {
  const { dealId } = useParams();
  const { data, reload } = useAsync(() => api.get('/threads'), []);
  useSocketEvent('thread:updated', reload); // new message anywhere → refresh previews and unread badges

  const threads = data?.threads || [];
  const active = threads.find((t) => t.dealId === dealId);

  return (
    <div className={`chat${dealId ? ' has-thread' : ''}`}>
      <ThreadList threads={threads} activeId={dealId} loading={!data} />
      {dealId ? (
        <Conversation key={dealId} dealId={dealId} thread={active} onRead={reload} />
      ) : (
        <div className="conversation">
          <EmptyState icon="chat" title="Select a conversation">Pick a deal thread on the left to start chatting.</EmptyState>
        </div>
      )}
      {dealId ? <DealDetailsPanel key={`d-${dealId}`} dealId={dealId} /> : <aside className="chat-details" />}
    </div>
  );
}
