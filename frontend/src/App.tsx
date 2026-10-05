import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AccountsPage } from './pages/AccountsPage';
import { CodesPage } from './pages/CodesPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { LogsPage } from './pages/LogsPage';
import { PublicCodesPage } from './pages/PublicCodesPage';
import { SalesPage } from './pages/SalesPage';

function AdminAuthBoundary() {
  return <AuthProvider><Outlet /></AuthProvider>;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/codigos" replace />} />
    <Route path="/codigos" element={<PublicCodesPage />} />
    <Route path="/admin" element={<AdminAuthBoundary />}>
      <Route path="login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="codes" element={<CodesPage />} />
        <Route path="logs" element={<LogsPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/codigos" replace />} />
  </Routes>;
}
