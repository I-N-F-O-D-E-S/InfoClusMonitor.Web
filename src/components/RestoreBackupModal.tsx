import React, { useState, useEffect } from "react";
import { getMachines, restoreBackup } from "../services/api";
import type { Machine, BackupRecord } from "../types";

interface RestoreBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  backup: BackupRecord | null;
  onRestoreStarted?: () => void;
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

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

      setSuccessMsg(res.message || "Orden de restauración enviada al servidor.");
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
  const isTargetOffline =
    selectedMachine &&
    selectedMachine.status !== "Online" &&
    (selectedMachine.status as unknown) !== 0 &&
    (selectedMachine.status as unknown) !== "Online";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc" }}>
              Restaurar copia de seguridad
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
              Descarga y extrae el respaldo en el servidor de destino
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

            {/* Archivo */}
            <div className="modal-section">
              <div className="modal-section-title" style={{ marginBottom: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2z"></path>
                </svg>
                Archivo a restaurar
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="mono" style={{ color: "#f8fafc", fontWeight: 600, wordBreak: "break-all", fontSize: "0.82rem" }}>
                  {backup.fileName}
                </div>
                <div className="mono" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {backup.sizeFormatted || "—"} · origen {backup.hostname} ({backup.sourcePath})
                </div>
              </div>
            </div>

            {/* Servidor destino */}
            <div>
              <label className="form-label" htmlFor="restore-server">Servidor destino</label>
              <select
                id="restore-server"
                className="form-input"
                value={targetMachineId}
                onChange={(e) => setTargetMachineId(e.target.value)}
                disabled={loading}
              >
                <option value="">Selecciona un servidor…</option>
                {machines.map((m) => (
                  <option key={m.externalMachineId} value={m.externalMachineId}>
                    {m.name || m.hostname} ({m.ipAddress || m.publicIpAddress || "sin IP"})
                  </option>
                ))}
              </select>
              {isTargetOffline && (
                <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#fb7185" }}>
                  Este servidor está fuera de línea. La orden se enviará cuando vuelva a conectarse.
                </p>
              )}
            </div>

            {/* Ruta destino */}
            <div>
              <label className="form-label" htmlFor="restore-path">Directorio de extracción</label>
              <input
                id="restore-path"
                type="text"
                className="form-input mono"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="/var/www o /home/usuario/app"
                disabled={loading}
                required
              />
              <p className="text-muted" style={{ marginTop: 6, fontSize: "0.72rem" }}>
                Los archivos del .tar.gz se extraen en esta ruta del servidor.
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
                    Enviando…
                  </>
                ) : (
                  "Restaurar copia"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
