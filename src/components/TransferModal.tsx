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
        setTargetPath(isDirectory ? `/tmp/${lastPart}` : `/tmp/${lastPart}`);
      }

      getMachines()
        .then((data) => {
          const validTargets = data.filter((m) => m.externalMachineId !== sourceMachineId);
          setMachines(validTargets);
          // Seleccionar primer servidor online por defecto si existe
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
      <div className="modal-content transfer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "22px" }}>🚀</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#f8fafc" }}>
                Transferir entre Servidores
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                Transferencia directa, segura y cifrada entre nodos del cluster
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="alert-error" style={{ marginBottom: 16 }}>
              <span>⚠️ {error}</span>
            </div>
          )}

          {/* Origen */}
          <div className="transfer-node-card">
            <div className="node-card-header">
              <span className="badge badge-source">ORIGEN</span>
              <strong style={{ color: "#38bdf8" }}>{sourceHostname || "Servidor Actual"}</strong>
            </div>
            <div className="node-card-body">
              <div className="path-display">
                <span style={{ marginRight: 6 }}>{isDirectory ? "📁" : "📄"}</span>
                <code className="path-code">{sourcePath}</code>
                <span className="badge badge-subtle" style={{ marginLeft: "auto" }}>
                  {isDirectory ? "Directorio (.tar.gz)" : "Archivo individual"}
                </span>
              </div>
            </div>
          </div>

          <div className="transfer-arrow-separator">
            <span>⬇️</span>
          </div>

          {/* Destino */}
          <div className="transfer-node-card target-card">
            <div className="node-card-header">
              <span className="badge badge-target">DESTINO</span>
              <label htmlFor="targetMachineSelect" style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: 600 }}>
                Seleccionar Servidor de Destino:
              </label>
            </div>
            <div className="node-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loadingMachines ? (
                <div style={{ color: "#94a3b8", fontSize: "13px" }}>Cargando servidores disponibles...</div>
              ) : machines.length === 0 ? (
                <div style={{ color: "#ef4444", fontSize: "13px" }}>
                  No hay otros servidores registrados en el cluster para transferir.
                </div>
              ) : (
                <select
                  id="targetMachineSelect"
                  className="form-input custom-select"
                  value={targetMachineId}
                  onChange={(e) => setTargetMachineId(e.target.value)}
                  disabled={isSubmitting}
                  required
                >
                  {machines.map((m) => {
                    const isOnline = m.status === MachineStatus.Online || (m.status as unknown) === 0 || (m.status as unknown) === "Online";
                    return (
                      <option key={m.externalMachineId} value={m.externalMachineId}>
                        {m.hostname} ({m.ipAddress}) {isOnline ? "🟢 [En Línea]" : "🔴 [Desconectado]"}
                      </option>
                    );
                  })}
                </select>
              )}

              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                  Ruta de Destino en el Servidor:
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="/var/www/backup o /tmp/archivo"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <div className="quick-paths" style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", alignSelf: "center" }}>Atajos:</span>
                  {["/tmp", "/var/www", "/home", "/root"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="btn-quick-path"
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
            </div>
          </div>

          {/* Transfer Info */}
          <div className="minio-info-banner">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: "18px" }}>🛡️</span>
              <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.4 }}>
                <strong>Transferencia Segura y Automática:</strong> El servidor de origen envía el contenido de manera cifrada. El servidor de destino lo recibe y extrae automáticamente en la ruta especificada.
              </div>
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
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-small"></span>
                  Iniciando Transferencia...
                </>
              ) : (
                <>
                  <span>🚀</span> Iniciar Transferencia
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
