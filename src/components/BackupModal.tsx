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
    const cleanName = (customName || "backup").replace(/[^a-zA-Z0-9_\-]/g, "_");
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

      setSuccessMsg(`¡Copia de seguridad enviada a segundo plano! Se guardará como ${backup.fileName}`);
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
    { label: "🌐 /var/www", path: "/var/www", name: "var_www" },
    { label: "⚙️ /etc", path: "/etc", name: "etc_configs" },
    { label: "🏠 /home", path: "/home", name: "home_users" },
    { label: "👑 /root", path: "/root", name: "root_backup" },
    { label: "📦 /opt", path: "/opt", name: "opt_apps" },
    { label: "🗄️ /var/lib/mysql", path: "/var/lib/mysql", name: "mysql_data" },
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: 580 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "24px" }}>💾</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
                Crear Copia de Seguridad
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                Comprime y guarda la copia de seguridad de tu servidor de forma segura
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-close-modal" disabled={loading}>
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          {error && (
            <div className="alert-box">
              <span>⚠️ {error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid #10b981",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              color: "#34d399",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <span>✅</span>
              <strong>{successMsg}</strong>
            </div>
          )}

          {/* Servidor */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
              SERVIDOR ORIGEN:
            </label>
            <select
              className="form-input"
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              disabled={loading || Boolean(initialMachineId)}
            >
              {machines.map((m) => (
                <option key={m.externalMachineId} value={m.externalMachineId}>
                  {m.name || m.hostname} ({m.ipAddress}) - {m.status === "Online" || m.status === 0 ? "🟢 En línea" : "🔴 Desconectado"}
                </option>
              ))}
            </select>
          </div>

          {/* Ruta a respaldar */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
              RUTA DE CARPETA O ARCHIVO A RESPALDAR:
            </label>
            <input
              type="text"
              className="form-input"
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

          {/* Atajos de Rutas Rápidas */}
          <div>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Atajos Frecuentes:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {quickPaths.map((qp) => (
                <button
                  type="button"
                  key={qp.path}
                  className="shortcut-pill"
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

          {/* Nombre Identificador */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
              NOMBRE IDENTIFICADOR DEL RESPALDO:
            </label>
            <input
              type="text"
              className="form-input"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="ej. var_www o produccion_sitio"
              disabled={loading}
            />
          </div>

          {/* Banner de Previsualización */}
          <div style={{
            background: "rgba(30, 41, 59, 0.7)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            fontSize: "12px",
            color: "#cbd5e1"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>☁️ Almacenamiento:</span>
              <span className="badge badge-info">Copia Centralizada</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              <span style={{ color: "#34d399", fontWeight: 700 }}>📦 Archivo resultante:</span>
              <span style={{ fontFamily: "monospace", color: "#f8fafc", fontWeight: 600, wordBreak: "break-all" }}>
                {previewFileName}
              </span>
            </div>
            <div style={{ marginTop: 8, color: "#94a3b8", fontSize: "11px", lineHeight: "1.4" }}>
              ⚡ La tarea se ejecutará en <strong>segundo plano</strong> de forma segura. Podrás monitorear el estado y descargar o restaurar el respaldo cuando termine.
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ background: "#10b981", borderColor: "#10b981", color: "#ffffff", fontWeight: 600 }}
            >
              {loading ? (
                <>
                  <span className="spinner-small"></span>
                  Iniciando en segundo plano...
                </>
              ) : (
                <>
                  <span>💾</span> Crear Copia de Seguridad
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
