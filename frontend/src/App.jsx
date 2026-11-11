import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DealsPage from './pages/deals/DealsPage';
import ChatPage from './pages/chat/ChatPage';
import ApprovalsPage from './pages/ApprovalsPage';
import InvoicesPage from './pages/InvoicesPage';
import ApprovalRulesPage from './pages/ApprovalRulesPage';

// Hides a route the user has no permission for. The API enforces the same rule.
function Guard({ permission, children }) {
  const { can } = useAuth();
  return can(permission) ? children : <Navigate to="/deals" replace />;
}

function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <SocketProvider>
      <AppLayout />
    </SocketProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedApp />}>
        <Route path="/deals" element={<Guard permission="deal.view"><DealsPage /></Guard>} />
        <Route path="/chat/:dealId?" element={<Guard permission="chat.send"><ChatPage /></Guard>} />
        <Route path="/approvals" element={<Guard permission="discount.approve"><ApprovalsPage /></Guard>} />
        <Route path="/invoices" element={<Guard permission="invoice.view"><InvoicesPage /></Guard>} />
        <Route path="/settings/approvals" element={<Guard permission="approval_config.manage"><ApprovalRulesPage /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/deals" replace />} />
    </Routes>
  );
}
