import React, { useState, useEffect } from "react";
import { getMachines, startTransfer } from "../services/api";
import type { Machine, FileTransfer } from "../types";
import { MachineStatus } from "../types";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceMachineId: string;
  sourceHostname: string;
  sourcePath: string;
  isDirectory: boolean;
  onTransferStarted?: (transfer: FileTransfer) => void;
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  sourceMachineId,
  sourceHostname,
  sourcePath,
  isDirectory,
  onTransferStarted,
}) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [targetMachineId, setTargetMachineId] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoadingMachines(true);

      // Sugerir ruta destino similar por defecto
      if (sourcePath) {
        const lastPart = sourcePath.split(/[/\\]/).filter(Boolean).pop() || "transfer_data";
        setTargetPath(`/tmp/${lastPart}`);
      }

      getMachines()
        .then((data) => {
          const validTargets = data.filter((m) => m.externalMachineId !== sourceMachineId);
          setMachines(validTargets);
          const firstOnline = validTargets.find(
            (m) => m.status === MachineStatus.Online || (m.status as unknown) === 0 || (m.status as unknown) === "Online"
          );
          if (firstOnline) {
            setTargetMachineId(firstOnline.externalMachineId);
          } else if (validTargets.length > 0) {
            setTargetMachineId(validTargets[0].externalMachineId);
          }
        })
        .catch((err) => {
          setError("Error al cargar la lista de servidores destino: " + err.message);
        })
        .finally(() => setLoadingMachines(false));
    }
  }, [isOpen, sourceMachineId, sourcePath, isDirectory]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMachineId) {
      setError("Debes seleccionar un servidor de destino.");
      return;
    }
    if (!targetPath.trim()) {
      setError("Debes indicar la ruta de destino.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const transfer = await startTransfer({
        sourceMachineId,
        sourcePath,
        isDirectory,
        targetMachineId,
        targetPath: targetPath.trim(),
      });

      if (onTransferStarted) {
        onTransferStarted(transfer);
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al iniciar la transferencia.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc" }}>
              Transferir entre servidores
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
              Origen → almacenamiento → destino, con limpieza automática
            </p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="alert-box" style={{ marginBottom: 16 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Origen */}
          <div className="modal-section">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="badge badge-info">ORIGEN</span>
              <strong style={{ color: "#7dd3fc", fontSize: "0.85rem" }}>{sourceHostname || "Servidor actual"}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <code className="mono" style={{ fontSize: "0.78rem", color: "#cbd5e1", wordBreak: "break-all" }}>
                {sourcePath}
              </code>
              <span className="badge badge-mono" style={{ marginLeft: "auto", flexShrink: 0 }}>
                {isDirectory ? "Directorio (.tar.gz)" : "Archivo"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="4" x2="12" y2="20"></line>
              <polyline points="5 13 12 20 19 13"></polyline>
            </svg>
          </div>

          {/* Destino */}
          <div className="modal-section">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span className="badge badge-purple">DESTINO</span>
              <span style={{ fontSize: "0.82rem", color: "#e2e8f0", fontWeight: 600 }}>Servidor y ruta</span>
            </div>

            {loadingMachines ? (
              <div className="text-muted" style={{ fontSize: "0.82rem" }}>Cargando servidores disponibles…</div>
            ) : machines.length === 0 ? (
              <div style={{ color: "#fb7185", fontSize: "0.82rem" }}>
                No hay otros servidores registrados en el clúster.
              </div>
            ) : (
              <select
                id="targetMachineSelect"
                className="form-input"
                value={targetMachineId}
                onChange={(e) => setTargetMachineId(e.target.value)}
                disabled={isSubmitting}
                required
                style={{ marginBottom: 12 }}
              >
                <option value="">Selecciona un servidor…</option>
                {machines.map((m) => {
                  const isOnline = m.status === MachineStatus.Online || (m.status as unknown) === 0 || (m.status as unknown) === "Online";
                  return (
                    <option key={m.externalMachineId} value={m.externalMachineId}>
                      {m.hostname} ({m.ipAddress || m.publicIpAddress}) · {isOnline ? "en línea" : "offline"}
                    </option>
                  );
                })}
              </select>
            )}

            <label className="form-label" htmlFor="targetPathInput">Ruta de destino</label>
            <input
              id="targetPathInput"
              type="text"
              className="form-input mono"
              placeholder="/var/www/backup o /tmp/archivo"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span className="stat-label">Atajos</span>
              {["/tmp", "/var/www", "/home", "/root"].map((p) => (
                <button
                  key={p}
                  type="button"
                  className="shortcut-pill"
                  onClick={() => {
                    const lastPart = sourcePath.split(/[/\\]/).filter(Boolean).pop() || "data";
                    setTargetPath(`${p}/${lastPart}`);
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Nota */}
          <div
            className="modal-section"
            style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 14 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <div style={{ fontSize: "0.76rem", color: "#94a3b8", lineHeight: 1.45 }}>
              El origen envía el contenido de forma cifrada y el destino lo extrae automáticamente en la ruta indicada.
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || machines.length === 0 || !targetPath.trim()}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-small"></span>
                  Iniciando…
                </>
              ) : (
                "Iniciar transferencia"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
