import React, { useState, useEffect } from "react";
import { getScheduledTaskExecutions } from "../services/api";
import type { ScheduledTask, ScheduledTaskExecution } from "../types";

interface ScheduledTaskHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ScheduledTask | null;
}

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
        style={{ maxWidth: 960, width: "95%", height: "85vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
              <span>📜</span> Historial de Ejecución: {task.name}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              Servidor: <strong>{task.hostname}</strong> | Frecuencia: <strong>{task.scheduleSummary}</strong> | Horario Paraguayo (PY)
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            ✕
          </button>
        </div>

        {error && (
          <div className="alert-box" style={{ margin: "0 20px 14px", flexShrink: 0 }}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Content split into list and terminal output */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: 16,
          padding: "0 20px 20px",
          flex: 1,
          minHeight: 0,
          overflow: "hidden"
        }}>
          {/* Lista de Ejecuciones */}
          <div style={{
            background: "#0c0f17",
            border: "1px solid #1e293b",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "10px 14px",
              background: "#111622",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8" }}>
                EJECUCIONES REGISTRADAS ({executions.length})
              </span>
              {loading && <span className="spinner-small"></span>}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {executions.length === 0 && !loading && (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b", fontSize: "13px" }}>
                  <span>⏳</span>
                  <p style={{ marginTop: 8 }}>Aún no hay ejecuciones registradas para esta tarea.</p>
                </div>
              )}

              {executions.map((exec) => {
                const isSelected = selectedExec?.executionId === exec.executionId;
                const isSuccess = exec.status === "Completed";
                const isFailed = exec.status === "Failed";

                return (
                  <div
                    key={exec.executionId}
                    onClick={() => setSelectedExec(exec)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "6px",
                      marginBottom: 6,
                      cursor: "pointer",
                      background: isSelected ? "rgba(56, 189, 248, 0.12)" : "rgba(30, 41, 59, 0.3)",
                      border: isSelected ? "1px solid #38bdf8" : "1px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          background: isSuccess ? "rgba(16, 185, 129, 0.15)" : isFailed ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: isSuccess ? "#34d399" : isFailed ? "#f87171" : "#fbbf24",
                          border: `1px solid ${isSuccess ? "rgba(16, 185, 129, 0.3)" : isFailed ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                        }}
                      >
                        {exec.status === "Completed" ? "Completado" : exec.status === "Failed" ? "Fallido" : "En ejecución"}
                      </span>
                      <span className="mono" style={{ fontSize: "11px", color: "#64748b" }}>
                        ⏱️ {exec.durationFormatted}
                      </span>
                    </div>

                    <div className="mono" style={{ fontSize: "11px", color: "#cbd5e1" }}>
                      📅 {exec.startedAtParaguayFormatted}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visor de Salida Terminal */}
          <div style={{
            background: "#080a0f",
            border: "1px solid #1e293b",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "10px 16px",
              background: "#0f141f",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="terminal-dots">
                  <div className="terminal-dot"></div>
                  <div className="terminal-dot"></div>
                  <div className="terminal-dot"></div>
                </div>
                <span className="mono" style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Salida de Consola {selectedExec ? `(Código: ${selectedExec.exitCode ?? 0})` : ""}
                </span>
              </div>

              {selectedExec?.result && (
                <button
                  type="button"
                  onClick={() => handleCopy(selectedExec.result || "", selectedExec.executionId)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: "3px 10px", fontSize: "11px" }}
                >
                  {copiedId === selectedExec.executionId ? "✓ Copiado" : "Copiar Salida"}
                </button>
              )}
            </div>

            <div style={{
              flex: 1,
              padding: "16px",
              overflowY: "auto",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "12px",
              lineHeight: 1.6,
              color: selectedExec?.status === "Failed" ? "#f87171" : "#34d399",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all"
            }}>
              {selectedExec ? (
                selectedExec.result || selectedExec.errorMessage || "(Ejecución completada sin salida en consola)"
              ) : (
                <span style={{ color: "#64748b" }}>Selecciona una ejecución de la lista para ver su salida bash.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
