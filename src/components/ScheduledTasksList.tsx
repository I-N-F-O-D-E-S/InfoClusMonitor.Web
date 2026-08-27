import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getScheduledTasks, toggleScheduledTask, runScheduledTaskNow, deleteScheduledTask } from "../services/api";
import { signalRService } from "../services/signalr";
import type { ScheduledTask } from "../types";
import { ScheduledTaskModal } from "./ScheduledTaskModal";
import { ScheduledTaskHistoryModal } from "./ScheduledTaskHistoryModal";

interface ScheduledTasksListProps {
  machineId?: string;
  showHeader?: boolean;
}

export const ScheduledTasksList: React.FC<ScheduledTasksListProps> = ({
  machineId,
  showHeader = true,
}) => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<ScheduledTask | null>(null);
  const [historyTask, setHistoryTask] = useState<ScheduledTask | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getScheduledTasks(machineId);
      setTasks(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al cargar las tareas programadas.");
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Suscripción a eventos SignalR en tiempo real
  useEffect(() => {
    const handleCreated = (task: ScheduledTask) => {
      if (!machineId || task.machineId === machineId) {
        setTasks((prev) => [task, ...prev.filter((t) => t.taskId !== task.taskId)]);
      }
    };

    const handleUpdated = (task: ScheduledTask) => {
      if (!machineId || task.machineId === machineId) {
        setTasks((prev) => {
          const exists = prev.some((t) => t.taskId === task.taskId);
          if (exists) return prev.map((t) => (t.taskId === task.taskId ? task : t));
          return [task, ...prev];
        });
      }
    };

    const handleDeleted = (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    };

    signalRService.onScheduledTaskCreated(handleCreated);
    signalRService.onScheduledTaskUpdated(handleUpdated);
    signalRService.onScheduledTaskDeleted(handleDeleted);
  }, [machineId]);

  const handleToggle = async (taskId: string) => {
    try {
      const updated = await toggleScheduledTask(taskId);
      setTasks((prev) => prev.map((t) => (t.taskId === taskId ? updated : t)));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al cambiar estado de la tarea.");
    }
  };

  const handleRunNow = async (task: ScheduledTask) => {
    setRunningTaskId(task.taskId);
    setActionSuccessMsg(`Enviando ejecución inmediata de '${task.name}'...`);
    try {
      await runScheduledTaskNow(task.taskId);
      setActionSuccessMsg(`¡Orden enviada exitosamente a ${task.hostname}! Ejecutándose en segundo plano.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al solicitar ejecución inmediata.");
      setActionSuccessMsg(null);
    } finally {
      setTimeout(() => setRunningTaskId(null), 1000);
    }
  };

  const handleDelete = async (task: ScheduledTask) => {
    if (!window.confirm(`¿Estás seguro de eliminar la tarea programada '${task.name}'?`)) {
      return;
    }

    try {
      await deleteScheduledTask(task.taskId);
      setTasks((prev) => prev.filter((t) => t.taskId !== task.taskId));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al eliminar la tarea.");
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.hostname.toLowerCase().includes(search.toLowerCase()) ||
      t.command.toLowerCase().includes(search.toLowerCase())
    );
  }, [tasks, search]);

  return (
    <div className="backups-container">
      {/* Header */}
      {showHeader && (
        <div className="section-header" style={{ marginBottom: 20 }}>
          <div className="section-title">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "24px" }}>⏰</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#f8fafc" }}>
                  Tareas Programadas y Automatizaciones
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                  Ejecución automática de comandos y scripts bash en segundo plano (Horario Paraguayo GMT-3 / GMT-4)
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={loadTasks}
              className="btn btn-secondary btn-sm"
              disabled={loading}
              title="Recargar tareas"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
              Actualizar
            </button>

            <button
              onClick={() => {
                setTaskToEdit(null);
                setIsCreateModalOpen(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>➕</span> Programar Comando
            </button>
          </div>
        </div>
      )}

      {/* Alertas */}
      {actionSuccessMsg && (
        <div style={{
          background: "rgba(16, 185, 129, 0.12)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          borderRadius: "var(--radius-md)",
          padding: "10px 14px",
          marginBottom: 16,
          color: "#34d399",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          <span>✓</span>
          <strong>{actionSuccessMsg}</strong>
        </div>
      )}

      {error && (
        <div className="alert-box" style={{ marginBottom: 16 }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Barra de Filtro */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          className="form-input search-input"
          placeholder="🔍 Buscar por nombre, servidor o comando..."
          style={{ maxWidth: 360 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-mono">{filteredTasks.length} tareas</span>
          <span className="badge badge-mono" style={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.3)" }}>
            🕒 Horario Paraguay (PY)
          </span>
        </div>
      </div>

      {/* Tabla de Tareas Programadas */}
      <div className="explorer-table-wrapper">
        {loading && tasks.length === 0 ? (
          <div className="explorer-loading-state">
            <div className="auth-spinner"></div>
            <p>Cargando tareas programadas...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="explorer-empty-state" style={{ padding: "48px 16px" }}>
            <span style={{ fontSize: "36px" }}>⏰</span>
            <h4 style={{ color: "#f8fafc", margin: "10px 0 4px" }}>No hay tareas programadas</h4>
            <p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>
              Crea una tarea programada para ejecutar scripts bash automáticamente cada X horas, días o en horarios específicos.
            </p>
            <button
              onClick={() => {
                setTaskToEdit(null);
                setIsCreateModalOpen(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ marginTop: 14 }}
            >
              <span>➕</span> Programar Comando Ahora
            </button>
          </div>
        ) : (
          <table className="explorer-table">
            <thead>
              <tr>
                <th style={{ width: "200px" }}>TAREA</th>
                <th style={{ width: "140px" }}>SERVIDOR</th>
                <th>COMANDO</th>
                <th style={{ width: "160px" }}>FRECUENCIA</th>
                <th style={{ width: "170px" }}>PRÓXIMA EJECUCIÓN (PY)</th>
                <th style={{ width: "120px" }}>ESTADO</th>
                <th style={{ width: "220px", textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                const isRunning = runningTaskId === t.taskId || t.lastStatus === "Running";
                const isLastSuccess = t.lastStatus === "Completed";
                const isLastFailed = t.lastStatus === "Failed";

                return (
                  <tr key={t.taskId} className="explorer-row">
                    {/* Tarea */}
                    <td>
                      <div>
                        <strong style={{ color: "#ffffff", fontSize: "13px" }}>{t.name}</strong>
                        {t.description && (
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: 2 }}>
                            {t.description}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Servidor */}
                    <td>
                      <span className="badge badge-mono" style={{ color: "#38bdf8" }}>
                        🖥️ {t.hostname}
                      </span>
                    </td>

                    {/* Comando */}
                    <td>
                      <div className="mono" style={{
                        maxWidth: "340px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "11px",
                        color: "#a7f3d0",
                        background: "#0c0f17",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "1px solid #1e293b"
                      }} title={t.command}>
                        $ {t.command}
                      </div>
                    </td>

                    {/* Frecuencia */}
                    <td>
                      <span style={{ fontSize: "12px", color: "#e2e8f0", fontWeight: 600 }}>
                        {t.scheduleSummary}
                      </span>
                    </td>

                    {/* Próxima Ejecución */}
                    <td>
                      <div className="mono" style={{ fontSize: "11px", color: t.isEnabled ? "#38bdf8" : "#64748b" }}>
                        {t.isEnabled ? t.nextRunParaguayFormatted : "Pausada"}
                      </div>
                    </td>

                    {/* Estado */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            background: t.isEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                            color: t.isEnabled ? "#34d399" : "#94a3b8",
                            border: `1px solid ${t.isEnabled ? "rgba(16, 185, 129, 0.3)" : "rgba(100, 116, 139, 0.3)"}`,
                          }}
                        >
                          {t.isEnabled ? "🟢 ACTIVA" : "⏸️ PAUSADA"}
                        </span>

                        {t.lastStatus && (
                          <span
                            className="mono"
                            style={{
                              fontSize: "9px",
                              color: isLastSuccess ? "#34d399" : isLastFailed ? "#f87171" : "#fbbf24",
                            }}
                          >
                            Últ: {t.lastStatus === "Completed" ? "Éxito" : t.lastStatus === "Failed" ? "Fallo" : "Corriendo"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Acciones */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        {/* Ejecutar Ahora */}
                        <button
                          type="button"
                          onClick={() => handleRunNow(t)}
                          className="btn-transfer-row"
                          disabled={isRunning}
                          style={{
                            background: "rgba(56, 189, 248, 0.12)",
                            borderColor: "rgba(56, 189, 248, 0.35)",
                            color: "#38bdf8",
                            fontWeight: 600,
                          }}
                          title="Lanzar ejecución manual ahora mismo en segundo plano"
                        >
                          {isRunning ? "⏳" : "▶"} Ejecutar
                        </button>

                        {/* Pausar / Reanudar */}
                        <button
                          type="button"
                          onClick={() => handleToggle(t.taskId)}
                          className="btn-transfer-row"
                          style={{
                            background: t.isEnabled ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                            borderColor: t.isEnabled ? "rgba(245, 158, 11, 0.35)" : "rgba(16, 185, 129, 0.35)",
                            color: t.isEnabled ? "#fbbf24" : "#34d399",
                          }}
                          title={t.isEnabled ? "Pausar ejecuciones automáticas" : "Reanudar ejecuciones automáticas"}
                        >
                          {t.isEnabled ? "⏸️" : "▶ Reanudar"}
                        </button>

                        {/* Ver Historial */}
                        <button
                          type="button"
                          onClick={() => setHistoryTask(t)}
                          className="btn-transfer-row"
                          title="Ver historial de ejecuciones y salidas de consola"
                        >
                          📜 Historial
                        </button>

                        {/* Editar */}
                        <button
                          type="button"
                          onClick={() => {
                            setTaskToEdit(t);
                            setIsCreateModalOpen(true);
                          }}
                          className="btn-transfer-row"
                          title="Editar configuración de tarea"
                        >
                          ✏️
                        </button>

                        {/* Eliminar */}
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          className="btn-transfer-row"
                          style={{
                            background: "rgba(239, 68, 68, 0.12)",
                            borderColor: "rgba(239, 68, 68, 0.35)",
                            color: "#f87171",
                          }}
                          title="Eliminar tarea programada"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {isCreateModalOpen && (
        <ScheduledTaskModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setTaskToEdit(null);
          }}
          taskToEdit={taskToEdit}
          initialMachineId={machineId}
          onTaskSaved={() => loadTasks()}
        />
      )}

      {/* Modal Historial */}
      {historyTask && (
        <ScheduledTaskHistoryModal
          isOpen={historyTask !== null}
          onClose={() => setHistoryTask(null)}
          task={historyTask}
        />
      )}
    </div>
  );
};
