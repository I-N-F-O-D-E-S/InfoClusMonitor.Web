import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-inner">
          <img src="/logo_simple.png" alt="" className="app-loading-mark" />
          <span className="app-loading-name">BuhoControl</span>
          <div className="app-loading-track" role="progressbar" aria-label="Verificando sesión" />
          <span className="app-loading-text">Verificando sesión…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
