import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signalRService } from "../services/signalr";
import { AgentUpdateModal } from "./AgentUpdateModal";

export const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

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

  const nodesActive =
    location.pathname === "/" ||
    (location.pathname.startsWith("/machines") && !location.pathname.includes("/scheduled-tasks"));

  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link to="/" className="navbar-brand">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img
                  src="/logo_simple.png"
                  alt="BuhoControl"
                  style={{ width: "34px", height: "34px", objectFit: "contain" }}
                />
                <span className="brand-name" style={{ letterSpacing: "-0.5px", fontWeight: 800 }}>
                  BuhoControl
                </span>
              </div>
            </Link>

            {/* Navegación */}
            <nav className="navbar-links">
              <Link to="/" className={`nav-link ${nodesActive ? "active" : ""}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="7" rx="2"></rect>
                  <rect x="2" y="14" width="20" height="7" rx="2"></rect>
                  <line x1="6" y1="6.5" x2="6.01" y2="6.5"></line>
                  <line x1="6" y1="17.5" x2="6.01" y2="17.5"></line>
                </svg>
                Nodos
              </Link>

              <Link to="/scheduled-tasks" className={`nav-link ${location.pathname === "/scheduled-tasks" ? "active" : ""}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"></circle>
                  <polyline points="12 7 12 12 15.5 14"></polyline>
                </svg>
                Tareas
              </Link>

              <Link to="/backups" className={`nav-link ${location.pathname === "/backups" ? "active" : ""}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="8.5" ry="3"></ellipse>
                  <path d="M3.5 5v14c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3V5"></path>
                  <path d="M3.5 12c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3"></path>
                </svg>
                Copias
              </Link>

              <Link to="/transfers" className={`nav-link ${location.pathname === "/transfers" ? "active" : ""}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9"></polyline>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                  <polyline points="7 23 3 19 7 15"></polyline>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                </svg>
                Transferencias
              </Link>
            </nav>
          </div>

          <div className="navbar-actions">
            <button
              onClick={() => setShowInstallModal(true)}
              className="btn btn-secondary btn-sm"
              title="Comando de una línea para instalar o actualizar el agente en cualquier máquina"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <path d="M5 21h14"></path>
              </svg>
              Instalar agente
            </button>

            <div className="connection-pill" title={isConnected ? "Transmisión en tiempo real activa" : "Reconectando…"}>
              <span className={`pulse-dot ${isConnected ? "" : "disconnected"}`}></span>
              <span>{isConnected ? "En vivo" : "Reconectando"}</span>
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

            <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Cerrar sesión">
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

      {showInstallModal && (
        <AgentUpdateModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
      )}
    </>
  );
};
