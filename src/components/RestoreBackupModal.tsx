import React, { useState, useEffect } from "react";
import { getMachines, restoreBackup } from "../services/api";
import type { Machine, BackupRecord } from "../types";

interface RestoreBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  backup: BackupRecord | null;
  onRestoreStarted?: () => void;
}

export const RestoreBackupModal: React.FC<RestoreBackupModalProps> = ({
  isOpen,
  onClose,
  backup,
  onRestoreStarted,
}) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [targetMachineId, setTargetMachineId] = useState<string>("");
  const [targetPath, setTargetPath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && backup) {
      setError(null);
      setSuccessMsg(null);
      setTargetMachineId(backup.machineId || "");
      setTargetPath(backup.sourcePath || "/var/www");

      getMachines()
        .then((data) => {
          setMachines(data);
          if (!targetMachineId && data.length > 0) {
            const match = data.find((m) => m.externalMachineId === backup.machineId);
            setTargetMachineId(match ? match.externalMachineId : data[0].externalMachineId);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, backup]);

  if (!isOpen || !backup) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMachineId) {
      setError("Debes seleccionar un servidor de destino.");
      return;
    }
    if (!targetPath.trim()) {
      setError("Debes especificar la ruta de destino.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await restoreBackup(backup.backupId, {
        targetMachineId,
        targetPath: targetPath.trim(),
      });

      setSuccessMsg(res.message || "¡Orden de restauración enviada al servidor!");
      if (onRestoreStarted) onRestoreStarted();

      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al enviar la restauración.");
      setLoading(false);
    }
  };

  const selectedMachine = machines.find((m) => m.externalMachineId === targetMachineId);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "24px" }}>🔄</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
                Restaurar / Cargar Copia de Seguridad
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                Descarga y extrae el respaldo directamente en el servidor seleccionado
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

          {/* Información del archivo */}
          <div style={{
            background: "#0c0d14",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            fontSize: "12px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>📦 Archivo a restaurar:</span>
              <span style={{ fontFamily: "monospace", color: "#f8fafc", fontWeight: 600 }}>
                {backup.fileName}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#94a3b8" }}>Tamaño:</span>
              <span style={{ color: "#34d399", fontFamily: "monospace" }}>{backup.sizeFormatted || "N/A"}</span>
              <span style={{ color: "#64748b", margin: "0 4px" }}>•</span>
              <span style={{ color: "#94a3b8" }}>Origen original:</span>
              <span style={{ color: "#cbd5e1", fontFamily: "monospace" }}>{backup.hostname} ({backup.sourcePath})</span>
            </div>
          </div>

          {/* Servidor Destino */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
              SERVIDOR DESTINO:
            </label>
            <select
              className="form-input"
              value={targetMachineId}
              onChange={(e) => setTargetMachineId(e.target.value)}
              disabled={loading}
            >
              {machines.map((m) => (
                <option key={m.externalMachineId} value={m.externalMachineId}>
                  {m.name || m.hostname} ({m.ipAddress}) - {m.status === "Online" || (m.status as unknown) === 0 || (m.status as unknown) === "Online" ? "🟢 En línea" : "🔴 Desconectado"}
                </option>
              ))}
            </select>
            {selectedMachine && selectedMachine.status !== "Online" && (selectedMachine.status as unknown) !== 0 && (
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#f87171" }}>
                ⚠️ Este servidor está fuera de línea. La orden se enviará cuando vuelva a conectarse.
              </p>
            )}
          </div>

          {/* Ruta Destino en el Servidor */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
              DIRECTORIO DE EXTRACCIÓN / DESTINO:
            </label>
            <input
              type="text"
              className="form-input"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="/var/www o /home/usuario/app"
              disabled={loading}
              required
            />
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b" }}>
              Los archivos contenidos en el .tar.gz se extraerán en esta ruta del servidor.
            </p>
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
              style={{ background: "#38bdf8", borderColor: "#38bdf8", color: "#000000", fontWeight: 700 }}
            >
              {loading ? (
                <>
                  <span className="spinner-small"></span>
                  Enviando orden...
                </>
              ) : (
                <>
                  <span>🔄</span> Restaurar Copia en Servidor
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
