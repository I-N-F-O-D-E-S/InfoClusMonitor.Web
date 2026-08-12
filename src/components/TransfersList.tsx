import React, { useState, useEffect, useCallback } from "react";
import { getTransfers, cancelTransfer } from "../services/api";
import { signalRService } from "../services/signalr";
import type { FileTransfer } from "../types";
import { TransferStatus } from "../types";

interface TransfersListProps {
  machineId?: string;
  showHeader?: boolean;
}

export const TransfersList: React.FC<TransfersListProps> = ({
  machineId,
  showHeader = true,
}) => {
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "completed" | "failed">("all");

  const loadTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTransfers(machineId);
      setTransfers(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al cargar transferencias.");
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Suscribir eventos SignalR en tiempo real
  useEffect(() => {
    const handleCreated = (transfer: FileTransfer) => {
      if (!machineId || transfer.sourceMachineId === machineId || transfer.targetMachineId === machineId) {
        setTransfers((prev) => [transfer, ...prev.filter((t) => t.transferId !== transfer.transferId)]);
      }
    };

    const handleUpdated = (transfer: FileTransfer) => {
      if (!machineId || transfer.sourceMachineId === machineId || transfer.targetMachineId === machineId) {
        setTransfers((prev) =>
          prev.map((t) => (t.transferId === transfer.transferId ? transfer : t))
        );
      }
    };

    signalRService.onTransferCreated(handleCreated);
    signalRService.onTransferUpdated(handleUpdated);
  }, [machineId]);

  const handleCancel = async (transferId: string) => {
    if (!confirm("¿Deseas cancelar esta transferencia?")) return;
    try {
      await cancelTransfer(transferId);
      loadTransfers();
    } catch (err: any) {
      alert("Error al cancelar: " + (err.response?.data?.error || err.message));
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    const s = String(status).toLowerCase();
    switch (s) {
      case "pending":
      case "0":
        return <span className="badge badge-warning">🟡 Pendiente</span>;
      case "uploading":
      case "1":
        return <span className="badge badge-info">🔵 Subiendo a MinIO...</span>;
      case "uploaded":
      case "2":
        return <span className="badge badge-info">📦 En MinIO Staging</span>;
      case "downloading":
      case "3":
        return <span className="badge badge-purple">🟣 Descargando en Destino...</span>;
      case "completed":
      case "4":
        return <span className="badge badge-success">✅ Completada (MinIO borrado)</span>;
      case "failed":
      case "5":
        return <span className="badge badge-danger">🔴 Fallida</span>;
      case "cancelled":
      case "6":
        return <span className="badge badge-secondary">⚪ Cancelada</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    const s = String(t.status).toLowerCase();
    if (activeFilter === "active") {
      return ["pending", "uploading", "uploaded", "downloading", "0", "1", "2", "3"].includes(s);
    }
    if (activeFilter === "completed") {
      return ["completed", "4"].includes(s);
    }
    if (activeFilter === "failed") {
      return ["failed", "cancelled", "5", "6"].includes(s);
    }
    return true;
  });

  return (
    <div className="transfers-container">
      {showHeader && (
        <div className="transfers-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "22px" }}>🔄</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#f8fafc" }}>
                Historial de Transferencias MinIO
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                Transferencia segura entre servidores con limpieza automática
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadTransfers}
              disabled={loading}
            >
              🔄 {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs Filter */}
      <div className="transfers-tabs">
        <button
          type="button"
          className={`tab-btn ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => setActiveFilter("all")}
        >
          Todas ({transfers.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeFilter === "active" ? "active" : ""}`}
          onClick={() => setActiveFilter("active")}
        >
          En Progreso ({transfers.filter((t) => ["pending", "uploading", "uploaded", "downloading", "0", "1", "2", "3"].includes(String(t.status).toLowerCase())).length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeFilter === "completed" ? "active" : ""}`}
          onClick={() => setActiveFilter("completed")}
        >
          Completadas ({transfers.filter((t) => ["completed", "4"].includes(String(t.status).toLowerCase())).length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeFilter === "failed" ? "active" : ""}`}
          onClick={() => setActiveFilter("failed")}
        >
          Fallidas / Canceladas ({transfers.filter((t) => ["failed", "cancelled", "5", "6"].includes(String(t.status).toLowerCase())).length})
        </button>
      </div>

      {error && (
        <div className="alert-error" style={{ margin: "16px 0" }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Transfers List Cards */}
      {loading ? (
        <div className="transfers-loading">
          <div className="spinner"></div>
          <p>Cargando transferencias...</p>
        </div>
      ) : filteredTransfers.length === 0 ? (
        <div className="transfers-empty">
          <span style={{ fontSize: "40px" }}>📦</span>
          <h4 style={{ margin: "12px 0 4px", color: "#f8fafc" }}>No hay transferencias registradas</h4>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
            Inicia una transferencia desde el Explorador de Archivos de cualquier servidor.
          </p>
        </div>
      ) : (
        <div className="transfers-cards-grid">
          {filteredTransfers.map((t) => {
            const isPendingOrActive = ["pending", "uploading", "uploaded", "downloading", "0", "1", "2", "3"].includes(String(t.status).toLowerCase());
            const isCompleted = ["completed", "4"].includes(String(t.status).toLowerCase());
            const isFailed = ["failed", "5"].includes(String(t.status).toLowerCase());

            return (
              <div key={t.transferId} className={`transfer-card ${isCompleted ? "completed" : isFailed ? "failed" : "active"}`}>
                <div className="transfer-card-top">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "16px" }}>{t.isDirectory ? "📁" : "📄"}</span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
                      Transferencia #{t.id}
                    </span>
                    <span className="font-mono text-muted" style={{ fontSize: "11px" }}>
                      ({t.transferId.substring(0, 8)}...)
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {getStatusBadge(t.status)}
                    {isPendingOrActive && (
                      <button
                        type="button"
                        className="btn-cancel-transfer"
                        onClick={() => handleCancel(t.transferId)}
                        title="Cancelar transferencia"
                      >
                        ✕ Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="transfer-progress-wrapper">
                  <div
                    className={`transfer-progress-bar ${isCompleted ? "completed" : isFailed ? "failed" : "active"}`}
                    style={{ width: `${t.progressPercent || (isCompleted ? 100 : 15)}%` }}
                  ></div>
                </div>

                {/* Routing information */}
                <div className="transfer-flow">
                  <div className="flow-node source">
                    <span className="flow-label">ORIGEN</span>
                    <strong className="node-host">{t.sourceHostname}</strong>
                    <code className="node-path" title={t.sourcePath}>{t.sourcePath}</code>
                  </div>

                  <div className="flow-indicator">
                    <span className="flow-arrow">➔</span>
                    <span className="flow-storage-tag">MinIO S3</span>
                  </div>

                  <div className="flow-node target">
                    <span className="flow-label">DESTINO</span>
                    <strong className="node-host">{t.targetHostname}</strong>
                    <code className="node-path" title={t.targetPath}>{t.targetPath}</code>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="transfer-card-footer">
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "12px", color: "#94a3b8" }}>
                    <span>
                      📊 Tamaño: <strong style={{ color: "#e2e8f0" }}>{t.sizeFormatted || "Calculando..."}</strong>
                    </span>
                    <span>
                      🕒 Iniciado:{" "}
                      <strong style={{ color: "#e2e8f0" }}>
                        {new Date(t.createdAt).toLocaleString("es-ES", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </strong>
                    </span>
                    {t.completedAt && (
                      <span>
                        🏁 Finalizado:{" "}
                        <strong style={{ color: "#e2e8f0" }}>
                          {new Date(t.completedAt).toLocaleString("es-ES", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </strong>
                      </span>
                    )}
                  </div>

                  {isCompleted && (
                    <div className="cleanup-badge">
                      <span>🧹 Buffer MinIO eliminado</span>
                    </div>
                  )}

                  {t.errorMessage && (
                    <div className="transfer-error-text">
                      <span>⚠️ {t.errorMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
