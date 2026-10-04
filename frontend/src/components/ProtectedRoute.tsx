import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center bg-ink"><Spinner label="Verificando sesión" /></div>;
  if (!user) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  return children;
}
