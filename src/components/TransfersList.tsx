import React, { useState, useEffect, useCallback } from "react";
import { getTransfers, cancelTransfer } from "../services/api";
import { signalRService } from "../services/signalr";
import type { FileTransfer } from "../types";
import { TransferStatus } from "../types";

interface TransfersListProps {
  machineId?: string;
  showHeader?: boolean;
}

const ACTIVE_STATUSES = ["pending", "uploading", "uploaded", "downloading", "0", "1", "2", "3"];
const COMPLETED_STATUSES = ["completed", "4"];
const FAILED_STATUSES = ["failed", "cancelled", "5", "6"];

const norm = (status: unknown) => String(status).toLowerCase();

const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: spinning ? "spin 0.8s linear infinite" : undefined }}
  >
    <path d="M21 2v6h-6"></path>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
    <path d="M3 22v-6h6"></path>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const progressColor = (isCompleted: boolean, isFailed: boolean) =>
  isCompleted ? "#10b981" : isFailed ? "#f43f5e" : "#38bdf8";

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

  // Eventos SignalR en tiempo real
  useEffect(() => {
    const handleCreated = (transfer: FileTransfer) => {
      if (!machineId || transfer.sourceMachineId === machineId || transfer.targetMachineId === machineId) {
        setTransfers((prev) => [transfer, ...prev.filter((t) => t.transferId !== transfer.transferId)]);
      }
    };

    const handleUpdated = (transfer: FileTransfer) => {
      if (!machineId || transfer.sourceMachineId === machineId || transfer.targetMachineId === machineId) {
        setTransfers((prev) => prev.map((t) => (t.transferId === transfer.transferId ? transfer : t)));
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
    switch (norm(status)) {
      case "pending":
      case "0":
        return <span className="badge badge-warning">En cola</span>;
      case "uploading":
      case "1":
        return <span className="badge badge-info">Subiendo</span>;
      case "uploaded":
      case "2":
        return <span className="badge badge-info">En almacenamiento</span>;
      case "downloading":
      case "3":
        return (
          <span className="badge badge-info" style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8" }}>
            <span
              className="spinner-small"
              style={{ width: 12, height: 12, borderColor: "rgba(56, 189, 248, 0.3)", borderTopColor: "#38bdf8" }}
            ></span>
            Extrayendo
          </span>
        );
      case "completed":
      case "4":
        return <span className="badge badge-success">Completada</span>;
      case "failed":
      case "5":
        return <span className="badge badge-danger">Fallida</span>;
      case "cancelled":
      case "6":
        return <span className="badge badge-secondary">Cancelada</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const activeCount = transfers.filter((t) => ACTIVE_STATUSES.includes(norm(t.status))).length;
  const completedCount = transfers.filter((t) => COMPLETED_STATUSES.includes(norm(t.status))).length;
  const failedCount = transfers.filter((t) => FAILED_STATUSES.includes(norm(t.status))).length;

  const filteredTransfers = transfers.filter((t) => {
    const s = norm(t.status);
    if (activeFilter === "active") return ACTIVE_STATUSES.includes(s);
    if (activeFilter === "completed") return COMPLETED_STATUSES.includes(s);
    if (activeFilter === "failed") return FAILED_STATUSES.includes(s);
    return true;
  });

  return (
    <div>
      {showHeader && (
        <div className="page-head">
          <div>
            <h2 className="page-title">Transferencias</h2>
            <p className="page-sub">Movimiento de datos entre nodos con limpieza automática</p>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={loadTransfers} disabled={loading}>
            <RefreshIcon spinning={loading} />
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtrar transferencias">
          <button
            type="button"
            className={`segment ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            Todas <span className="segment-count">{transfers.length}</span>
          </button>
          <button
            type="button"
            className={`segment ${activeFilter === "active" ? "active" : ""}`}
            onClick={() => setActiveFilter("active")}
          >
            En progreso <span className="segment-count">{activeCount}</span>
          </button>
          <button
            type="button"
            className={`segment ${activeFilter === "completed" ? "active" : ""}`}
            onClick={() => setActiveFilter("completed")}
          >
            Completadas <span className="segment-count">{completedCount}</span>
          </button>
          <button
            type="button"
            className={`segment ${activeFilter === "failed" ? "active" : ""}`}
            onClick={() => setActiveFilter("failed")}
          >
            Fallidas <span className="segment-count">{failedCount}</span>
          </button>
        </div>
      </div>

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

      <div className="explorer-table-wrapper">
        {loading ? (
          <div className="explorer-loading-state">
            <div className="auth-spinner"></div>
            <p>Cargando transferencias…</p>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="explorer-empty-state">
            <div
              style={{
                width: 52,
                height: 52,
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--radius-md)",
                background: "rgba(56, 189, 248, 0.08)",
                border: "1px solid rgba(56, 189, 248, 0.22)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12h13"></path>
                <polyline points="11 6 17 12 11 18"></polyline>
                <path d="M20 4v16"></path>
              </svg>
            </div>
            <h4 style={{ color: "#f8fafc", margin: "6px 0 2px", fontWeight: 700 }}>
              {transfers.length === 0 ? "No hay transferencias" : "Ninguna coincide con el filtro"}
            </h4>
            <p style={{ color: "#64748b", margin: 0, fontSize: "0.82rem", maxWidth: 420 }}>
              Inicia una transferencia desde el explorador de archivos de cualquier nodo.
            </p>
          </div>
        ) : (
          <table className="explorer-table">
            <thead>
              <tr>
                <th style={{ width: "170px" }}>ESTADO</th>
                <th>RUTA (ORIGEN → DESTINO)</th>
                <th style={{ width: "110px" }}>TAMAÑO</th>
                <th style={{ width: "170px" }}>PROGRESO</th>
                <th style={{ width: "170px" }}>CREADA</th>
                <th style={{ width: "90px", textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map((t) => {
                const s = norm(t.status);
                const isCompleted = COMPLETED_STATUSES.includes(s);
                const isFailed = FAILED_STATUSES.includes(s);
                const isActive = ACTIVE_STATUSES.includes(s);
                const pct = Math.min(100, Math.max(0, t.progressPercent || (isCompleted ? 100 : 10)));

                return (
                  <tr key={t.transferId} className="explorer-row">
                    {/* Estado */}
                    <td>
                      {getStatusBadge(t.status)}
                      {isFailed && t.errorMessage && (
                        <div style={{ fontSize: "0.7rem", color: "#fb7185", marginTop: 4, maxWidth: 200 }}>
                          {t.errorMessage}
                        </div>
                      )}
                    </td>

                    {/* Ruta origen → destino */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div className="mono" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                          <span style={{ color: "#7dd3fc" }}>{t.sourceHostname}</span>
                          <span className="text-muted"> {t.sourcePath}</span>
                        </div>
                        <div className="mono" style={{ fontSize: "0.75rem", wordBreak: "break-all", display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "#64748b", display: "inline-flex" }}>
                            <ArrowRightIcon />
                          </span>
                          <span>
                            <span style={{ color: "#c4b5fd" }}>{t.targetHostname}</span>
                            <span className="text-muted"> {t.targetPath}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Tamaño */}
                    <td className="cell-size mono">{t.sizeFormatted || "—"}</td>

                    {/* Progreso */}
                    <td>
                      <div className="mini-bar-wrapper" style={{ minWidth: 130 }}>
                        <span className="mono" style={{ fontSize: "0.75rem", width: 36, fontWeight: 600 }}>
                          {pct}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{ width: `${pct}%`, background: progressColor(isCompleted, isFailed) }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Fecha */}
                    <td className="cell-date mono">
                      {t.createdAt ? new Date(t.createdAt).toLocaleString() : "—"}
                    </td>

                    {/* Acciones */}
                    <td style={{ textAlign: "right" }}>
                      {isActive && (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn is-danger"
                            onClick={() => handleCancel(t.transferId)}
                            title="Cancelar transferencia"
                            aria-label="Cancelar transferencia"
                          >
                            <XIcon />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
