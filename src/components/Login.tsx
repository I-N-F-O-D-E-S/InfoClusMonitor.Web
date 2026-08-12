import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const Login = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError("Por favor ingresa tu usuario/correo y contraseña.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login({
        usernameOrEmail: usernameOrEmail.trim(),
        password: password.trim(),
      });
      navigate(from, { replace: true });
    } catch (err: any) {
      const message = err.response?.data?.message || "Credenciales inválidas. Verifica los datos e intenta nuevamente.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box" style={{ maxWidth: "440px" }}>
        <div className="auth-header" style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
            <img
              src="/logo_completo.png"
              alt="BuhoControl - Sistema de Gestión y Control Linux"
              style={{
                maxWidth: "100%",
                height: "auto",
                maxHeight: "140px",
                objectFit: "contain",
                borderRadius: "8px",
                filter: "drop-shadow(0 0 16px rgba(56, 189, 248, 0.25))"
              }}
            />
          </div>
          <p className="auth-subtitle" style={{ fontSize: "13px", color: "#94a3b8" }}>
            Acceso seguro a la consola de gestión de servidores Linux
          </p>
        </div>

        {error && (
          <div className="alert-box">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="usernameOrEmail">
              Usuario o Correo Electrónico
            </label>
            <input
              id="usernameOrEmail"
              type="text"
              className="form-input mono"
              placeholder="Ingresa tu usuario"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label" htmlFor="password">
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "11px", cursor: "pointer" }}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="form-input mono"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px", marginTop: "10px", fontSize: "0.95rem" }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="auth-spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                Autenticando...
              </>
            ) : (
              "Ingresar a la Consola"
            )}
          </button>
        </form>

        <div className="auth-security-footer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>Conexión Segura TLS 1.3 · Encriptación JWT 256-bit</span>
        </div>
      </div>
    </div>
  );
};
