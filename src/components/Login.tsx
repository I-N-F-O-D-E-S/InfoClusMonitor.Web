import { useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const Login = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError("Ingresa tu usuario y contraseña para continuar.");
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
      const message = err.response?.data?.message || "Usuario o contraseña incorrectos.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Un detalle invisible: avisar cuando Bloq Mayús está activo en la contraseña.
  const handlePasswordKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside-mark">
          <img src="/logo_simple.png" alt="" />
          <span>BuhoControl</span>
        </div>

        <div className="auth-aside-copy">
          <h2>Control de servidores Linux</h2>
          <p>Telemetría en vivo, consola remota y copias de seguridad desde un único panel.</p>
        </div>

        <div className="auth-aside-foot">Acceso restringido a personal autorizado.</div>
      </aside>

      <main className="auth-main">
        <form className="auth-box" onSubmit={handleSubmit} noValidate>
          <div className="auth-box-brand">
            <img src="/logo_simple.png" alt="" />
            <span>BuhoControl</span>
          </div>

          <header className="auth-heading">
            <h1 className="auth-title">Iniciar sesión</h1>
            <p className="auth-hint">Ingresa tus credenciales para continuar.</p>
          </header>

          {error && (
            <div className="alert-box auth-alert" id="auth-error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="usernameOrEmail">
              Usuario o correo
            </label>
            <input
              id="usernameOrEmail"
              type="text"
              className="form-input"
              placeholder="usuario@servidor"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="username"
              autoFocus
              spellCheck={false}
              autoCapitalize="none"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "auth-error" : undefined}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Contraseña
            </label>
            <div className="auth-input-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={handlePasswordKey}
                onKeyDown={handlePasswordKey}
                onBlur={() => setCapsLockOn(false)}
                disabled={isSubmitting}
                autoComplete="current-password"
                aria-invalid={Boolean(error)}
                aria-describedby={capsLockOn ? "auth-caps" : error ? "auth-error" : undefined}
              />
              <button
                type="button"
                className="auth-reveal"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61"></path>
                    <line x1="2" y1="2" x2="22" y2="22"></line>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>

            {capsLockOn && (
              <p className="auth-caps" id="auth-caps">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 8 6-6 6 6"></path>
                  <path d="M12 2v12"></path>
                  <path d="M6 16h12"></path>
                  <path d="M8 20h8"></path>
                </svg>
                Bloq Mayús está activado.
              </p>
            )}
          </div>

          <button type="submit" className="btn btn-primary auth-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="auth-spinner" />
                Verificando…
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </main>
    </div>
  );
};
