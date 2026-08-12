import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signalRService } from "../services/signalr";

export const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const unsubscribe = signalRService.onConnectionState(setIsConnected);
      return () => {
        unsubscribe();
      };
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!isAuthenticated) return null;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link to="/" className="navbar-brand">
            <div className="brand-icon-wrapper">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="brand-name">InfodesCluster</span>
                <span className="brand-tag">ENTERPRISE</span>
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="navbar-links" style={{ display: "flex", gap: 12 }}>
            <Link
              to="/"
              className={`nav-link ${location.pathname === "/" || location.pathname.startsWith("/machines") ? "active" : ""}`}
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: location.pathname === "/" || location.pathname.startsWith("/machines") ? "#38bdf8" : "#94a3b8",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: "6px",
                background: location.pathname === "/" || location.pathname.startsWith("/machines") ? "rgba(56, 189, 248, 0.1)" : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              <span>🖥️</span> Nodos
            </Link>

            <Link
              to="/transfers"
              className={`nav-link ${location.pathname === "/transfers" ? "active" : ""}`}
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: location.pathname === "/transfers" ? "#38bdf8" : "#94a3b8",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: "6px",
                background: location.pathname === "/transfers" ? "rgba(56, 189, 248, 0.1)" : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              <span>🔄</span> Transferencias MinIO
            </Link>
          </nav>
        </div>

        <div className="navbar-actions">
          <div className="connection-pill" title={isConnected ? "Transmisión en tiempo real activa" : "Conectando al stream..."}>
            <span className={`pulse-dot ${isConnected ? "" : "disconnected"}`}></span>
            <span>{isConnected ? "STREAM EN VIVO" : "RECONECTANDO"}</span>
          </div>

          <div className="user-badge">
            <div className="user-avatar">
              {user?.username ? user.username.substring(0, 2).toUpperCase() : "AD"}
            </div>
            <span style={{ fontWeight: 600, color: "#ffffff" }}>{user?.username || "Admin"}</span>
            <span className="badge badge-mono" style={{ fontSize: "10px", padding: "1px 6px" }}>
              {user?.role || "Admin"}
            </span>
          </div>

          <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Cerrar sesión segura">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Salir
          </button>
        </div>
      </div>
    </header>
  );
};
