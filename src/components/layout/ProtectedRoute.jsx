import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <LoadingSpinner message="Autenticando..." />
      </div>
    );
  }

  if (!user) {
    // Redireciona para o login guardando de onde veio para voltar depois (opcional)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
