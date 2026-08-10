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
      const message = err.response?.data?.message || "Credenciales inválidas. Por favor verifica e intenta nuevamente.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-header">
          <div className="auth-logo">IC</div>
          <h1 className="auth-title">InfodesCluster</h1>
          <p className="auth-subtitle">Inicia sesión en tu panel de control de servidores</p>
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
              placeholder="Ingresa tu usuario o correo"
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
            style={{ width: "100%", padding: "12px", marginTop: "12px" }}
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
      </div>
    </div>
  );
};
