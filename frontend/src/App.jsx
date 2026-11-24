import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import AppLayout from './components/layout/AppLayout';
import { homePath } from './components/layout/nav';
import { EmptyState } from './components/common';
import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import DealsPage from './pages/deals/DealsPage';
import ChatPage from './pages/chat/ChatPage';
import ApprovalsPage from './pages/ApprovalsPage';
import InvoicesPage from './pages/InvoicesPage';
import ApprovalRulesPage from './pages/ApprovalRulesPage';
import UsersPage from './pages/users/UsersPage';
import RolesPage from './pages/roles/RolesPage';
import IntegrationsPage from './pages/IntegrationsPage';

// Hides a route the user has no permission for. The API enforces the same rule.
function Guard({ permission, children }) {
  const { can } = useAuth();
  return can(permission) ? children : <Navigate to={homePath(can)} replace />;
}

function Home() {
  const { can } = useAuth();
  return <Navigate to={homePath(can)} replace />;
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
        <Route path="/dashboard" element={<Guard permission="deal.view"><DashboardPage /></Guard>} />
        <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
        <Route path="/deals" element={<Guard permission="deal.view"><DealsPage /></Guard>} />
        <Route path="/chat/:dealId?" element={<Guard permission="chat.send"><ChatPage /></Guard>} />
        <Route path="/approvals" element={<Guard permission="discount.approve"><ApprovalsPage /></Guard>} />
        <Route path="/invoices" element={<Guard permission="invoice.view"><InvoicesPage /></Guard>} />
        <Route path="/settings/users" element={<Guard permission="user.manage"><UsersPage /></Guard>} />
        <Route path="/settings/roles" element={<Guard permission="role.manage"><RolesPage /></Guard>} />
        <Route path="/settings/approvals" element={<Guard permission="approval_config.manage"><ApprovalRulesPage /></Guard>} />
        <Route path="/settings/integrations" element={<Guard permission="integration.view"><IntegrationsPage /></Guard>} />
        <Route path="/no-access" element={<EmptyState icon="lock" title="No access yet">Your role has no permissions. Ask an administrator to give you access.</EmptyState>} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
