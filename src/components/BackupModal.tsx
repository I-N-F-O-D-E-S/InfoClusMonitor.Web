import React, { useState, useEffect, useMemo } from "react";
import { getMachines, createBackup } from "../services/api";
import type { Machine, BackupRecord } from "../types";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMachineId?: string;
  initialPath?: string;
  onBackupStarted?: (backup: BackupRecord) => void;
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const ArchiveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="8.5" ry="3"></ellipse>
    <path d="M3.5 5v14c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3V5"></path>
    <path d="M3.5 12c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3"></path>
  </svg>
);

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  initialMachineId,
  initialPath = "/var/www",
  onBackupStarted,
}) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>(initialMachineId || "");
  const [sourcePath, setSourcePath] = useState<string>(initialPath);
  const [customName, setCustomName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      if (initialMachineId) setSelectedMachineId(initialMachineId);
      if (initialPath) setSourcePath(initialPath);

      // Extraer un nombre inicial razonable del path
      const baseName = initialPath.split("/").filter(Boolean).pop() || "backup";
      setCustomName(baseName);

      // Cargar lista de máquinas si no están cargadas
      getMachines()
        .then((data) => {
          setMachines(data);
          if (!selectedMachineId && data.length > 0) {
            const online = data.find((m) => m.status === "Online" || m.status === 0);
            setSelectedMachineId((online || data[0]).externalMachineId);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialMachineId, initialPath]);

  // Preview del nombre en tiempo real {FECHA}_{NOMBRE}.tar.gz
  const previewFileName = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const cleanName = (customName || "backup").replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${dateStr}_${cleanName}.tar.gz`;
  }, [customName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId) {
      setError("Debes seleccionar un servidor.");
      return;
    }
    if (!sourcePath.trim()) {
      setError("Debes especificar la ruta de origen en el servidor.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const backup = await createBackup({
        machineId: selectedMachineId,
        sourcePath: sourcePath.trim(),
        customName: customName.trim() || undefined,
      });

      setSuccessMsg(`Copia en segundo plano. Se guardará como ${backup.fileName}`);
      if (onBackupStarted) {
        onBackupStarted(backup);
      }

      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al iniciar la copia de seguridad.");
      setLoading(false);
    }
  };

  const quickPaths = [
    { label: "/var/www", path: "/var/www", name: "var_www" },
    { label: "/etc", path: "/etc", name: "etc_configs" },
    { label: "/home", path: "/home", name: "home_users" },
    { label: "/root", path: "/root", name: "root_backup" },
    { label: "/opt", path: "/opt", name: "opt_apps" },
    { label: "/var/lib/mysql", path: "/var/lib/mysql", name: "mysql_data" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc" }}>
              Nueva copia de seguridad
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
              Comprime y guarda una ruta del servidor en el almacenamiento central
            </p>
          </div>
          <button onClick={onClose} className="btn-close" disabled={loading} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div className="alert-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="alert-success">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            {/* Servidor */}
            <div>
              <label className="form-label" htmlFor="backup-server">Servidor origen</label>
              <select
                id="backup-server"
                className="form-input"
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                disabled={loading || Boolean(initialMachineId)}
              >
                <option value="">Selecciona un servidor…</option>
                {machines.map((m) => (
                  <option key={m.externalMachineId} value={m.externalMachineId}>
                    {m.name || m.hostname} ({m.ipAddress || m.publicIpAddress || "sin IP"})
                  </option>
                ))}
              </select>
            </div>

            {/* Ruta */}
            <div>
              <label className="form-label" htmlFor="backup-path">Ruta de carpeta o archivo a respaldar</label>
              <input
                id="backup-path"
                type="text"
                className="form-input mono"
                value={sourcePath}
                onChange={(e) => {
                  setSourcePath(e.target.value);
                  const autoName = e.target.value.split("/").filter(Boolean).pop() || "backup";
                  if (!customName || customName === "backup") {
                    setCustomName(autoName);
                  }
                }}
                placeholder="/var/www o /home/usuario/app"
                disabled={loading}
                required
              />
            </div>

            {/* Atajos */}
            <div>
              <span className="form-label">Rutas frecuentes</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {quickPaths.map((qp) => (
                  <button
                    type="button"
                    key={qp.path}
                    className={`shortcut-pill ${sourcePath === qp.path ? "active" : ""}`}
                    onClick={() => {
                      setSourcePath(qp.path);
                      setCustomName(qp.name);
                    }}
                    disabled={loading}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nombre */}
            <div>
              <label className="form-label" htmlFor="backup-name">Nombre identificador</label>
              <input
                id="backup-name"
                type="text"
                className="form-input"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="ej. var_www o produccion_sitio"
                disabled={loading}
              />
            </div>

            {/* Resumen */}
            <div className="modal-section">
              <div className="modal-section-title" style={{ marginBottom: 10 }}>
                <ArchiveIcon />
                Resumen
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span className="text-muted" style={{ fontSize: "0.78rem" }}>Destino</span>
                <span className="badge badge-info">Almacenamiento central</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <span className="text-muted" style={{ fontSize: "0.78rem" }}>Archivo resultante</span>
                <div className="mono" style={{ color: "#f8fafc", fontWeight: 600, wordBreak: "break-all", fontSize: "0.8rem", marginTop: 3 }}>
                  {previewFileName}
                </div>
              </div>
              <p className="text-muted" style={{ fontSize: "0.72rem", marginTop: 10, lineHeight: 1.45 }}>
                La copia se genera en segundo plano. Podrás descargarla o restaurarla al finalizar.
              </p>
            </div>

            <div className="modal-footer" style={{ marginTop: 0 }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-small"></span>
                    Iniciando…
                  </>
                ) : (
                  "Crear copia"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
