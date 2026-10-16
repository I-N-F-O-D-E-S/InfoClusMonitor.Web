import React, { useState, useEffect } from "react";
import { getScheduledTaskExecutions } from "../services/api";
import type { ScheduledTask, ScheduledTaskExecution } from "../types";

interface ScheduledTaskHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ScheduledTask | null;
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const ClockIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"></circle>
    <polyline points="12 7 12 12 15.5 14"></polyline>
  </svg>
);

const CalendarIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

export const ScheduledTaskHistoryModal: React.FC<ScheduledTaskHistoryModalProps> = ({
  isOpen,
  onClose,
  task,
}) => {
  const [executions, setExecutions] = useState<ScheduledTaskExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExec, setSelectedExec] = useState<ScheduledTaskExecution | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !task) return;

    setLoading(true);
    setError(null);
    setSelectedExec(null);

    getScheduledTaskExecutions(task.taskId, 50)
      .then((res) => {
        setExecutions(res);
        if (res.length > 0) setSelectedExec(res[0]);
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Error al cargar historial de ejecuciones.");
      })
      .finally(() => setLoading(false));
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 960, width: "95%", height: "85vh" }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700, color: "#f8fafc" }}>
              Historial · {task.name}
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "#94a3b8" }}>
              {task.hostname} · {task.scheduleSummary} · horario Paraguay
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>

        {error && (
          <div className="alert-box" style={{ margin: "0 20px 14px", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Contenido: lista + salida */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "340px 1fr",
            gap: 16,
            padding: "0 20px 20px",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Lista de ejecuciones */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span className="stat-label">Ejecuciones registradas ({executions.length})</span>
              {loading && <span className="spinner-small"></span>}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {executions.length === 0 && !loading && (
                <div className="explorer-empty-state" style={{ padding: "40px 16px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"></circle>
                    <polyline points="12 7 12 12 15.5 14"></polyline>
                  </svg>
                  <p style={{ marginTop: 4, fontSize: "0.8rem" }}>Sin ejecuciones registradas todavía.</p>
                </div>
              )}

              {executions.map((exec) => {
                const isSelected = selectedExec?.executionId === exec.executionId;
                const isSuccess = exec.status === "Completed";
                const isFailed = exec.status === "Failed";

                return (
                  <button
                    key={exec.executionId}
                    type="button"
                    onClick={() => setSelectedExec(exec)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: 6,
                      cursor: "pointer",
                      background: isSelected ? "rgba(56, 189, 248, 0.12)" : "rgba(255, 255, 255, 0.025)",
                      border: isSelected ? "1px solid rgba(56, 189, 248, 0.5)" : "1px solid transparent",
                      transition:
                        "background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span className={`badge ${isSuccess ? "badge-online" : isFailed ? "badge-offline" : "badge-warning"}`}>
                        {exec.status === "Completed" ? "Completado" : exec.status === "Failed" ? "Fallido" : "En ejecución"}
                      </span>
                      <span className="mono" style={{ fontSize: "0.7rem", color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ClockIcon />
                        {exec.durationFormatted}
                      </span>
                    </div>

                    <div className="mono" style={{ fontSize: "0.72rem", color: "#cbd5e1", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <CalendarIcon />
                      {exec.startedAtParaguayFormatted}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Salida de consola */}
          <div
            style={{
              background: "#08080c",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="terminal-dots">
                  <div className="terminal-dot"></div>
                  <div className="terminal-dot"></div>
                  <div className="terminal-dot"></div>
                </div>
                <span className="mono" style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                  Salida de consola{selectedExec ? ` · código ${selectedExec.exitCode ?? 0}` : ""}
                </span>
              </div>

              {selectedExec?.result && (
                <button
                  type="button"
                  onClick={() => handleCopy(selectedExec.result || "", selectedExec.executionId)}
                  className="btn btn-secondary btn-sm"
                >
                  {copiedId === selectedExec.executionId ? "Copiado" : "Copiar salida"}
                </button>
              )}
            </div>

            <div
              style={{
                flex: 1,
                padding: "16px",
                overflowY: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                lineHeight: 1.6,
                color: selectedExec?.status === "Failed" ? "#fb7185" : "#6ee7b7",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {selectedExec ? (
                selectedExec.result || selectedExec.errorMessage || "(Ejecución completada sin salida en consola)"
              ) : (
                <span style={{ color: "#64748b" }}>Selecciona una ejecución para ver su salida bash.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
