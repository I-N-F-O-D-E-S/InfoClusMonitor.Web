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

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z"></path>
  </svg>
);

const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="7" y="5" width="3.5" height="14" rx="1"></rect>
    <rect x="13.5" y="5" width="3.5" height="14" rx="1"></rect>
  </svg>
);

const HistoryIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5"></path>
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
    <path d="M12 7v5l3.5 2"></path>
  </svg>
);

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const SpinnerDot = () => <span className="spinner-small" style={{ width: 14, height: 14 }}></span>;

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

  const openCreateModal = () => {
    setTaskToEdit(null);
    setIsCreateModalOpen(true);
  };

  const handleToggle = async (taskId: string) => {
    try {
      const updated = await toggleScheduledTask(taskId);
      setTasks((prev) => prev.map((t) => (t.taskId === taskId ? updated : t)));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al cambiar el estado de la tarea.");
    }
  };

  const handleRunNow = async (task: ScheduledTask) => {
    setRunningTaskId(task.taskId);
    setActionSuccessMsg(`Enviando ejecución inmediata de «${task.name}»…`);
    try {
      await runScheduledTaskNow(task.taskId);
      setActionSuccessMsg(`Orden enviada a ${task.hostname}. Se ejecuta en segundo plano.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al solicitar la ejecución inmediata.");
      setActionSuccessMsg(null);
    } finally {
      setTimeout(() => setRunningTaskId(null), 1000);
    }
  };

  const handleDelete = async (task: ScheduledTask) => {
    if (!window.confirm(`¿Eliminar la tarea programada «${task.name}»?`)) {
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
    <div>
      {showHeader && (
        <div className="page-head">
          <div>
            <h2 className="page-title">Tareas programadas</h2>
            <p className="page-sub">Automatizaciones en horario de Paraguay (GMT-3 / GMT-4)</p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={loadTasks}
              className="btn btn-secondary btn-sm"
              disabled={loading}
              title="Recargar tareas"
            >
              <RefreshIcon spinning={loading} />
              Actualizar
            </button>

            <button onClick={openCreateModal} className="btn btn-primary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Programar comando
            </button>
          </div>
        </div>
      )}

      {/* Alertas */}
      {actionSuccessMsg && (
        <div className="alert-success" style={{ marginBottom: 16 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>{actionSuccessMsg}</span>
        </div>
      )}

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

      {/* Filtros */}
      <div className="toolbar">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nombre, servidor o comando..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="badge badge-mono">{filteredTasks.length} tareas</span>
      </div>

      {/* Tabla */}
      <div className="explorer-table-wrapper">
        {loading && tasks.length === 0 ? (
          <div className="explorer-loading-state">
            <div className="auth-spinner"></div>
            <p>Cargando tareas programadas…</p>
          </div>
        ) : filteredTasks.length === 0 ? (
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <polyline points="12 7 12 12 15.5 14"></polyline>
              </svg>
            </div>
            <h4 style={{ color: "#f8fafc", margin: "6px 0 2px", fontWeight: 700 }}>
              {search ? "Ninguna tarea coincide" : "Todavía no hay tareas programadas"}
            </h4>
            <p style={{ color: "#64748b", margin: 0, fontSize: "0.85rem", maxWidth: 420 }}>
              {search
                ? "Prueba con otro nombre, servidor o comando."
                : "Programa un comando para ejecutarlo automáticamente cada X horas, ciertos días o en una fecha puntual."}
            </p>
            {!search && (
              <button onClick={openCreateModal} className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Programar comando
              </button>
            )}
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
                <th style={{ width: "180px", textAlign: "right" }}>ACCIONES</th>
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
                      <strong style={{ color: "#ffffff", fontSize: "0.9rem" }}>{t.name}</strong>
                      {t.description && (
                        <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                          {t.description}
                        </div>
                      )}
                    </td>

                    {/* Servidor */}
                    <td>
                      <span className="badge badge-mono">{t.hostname}</span>
                    </td>

                    {/* Comando */}
                    <td>
                      <div
                        className="mono"
                        title={t.command}
                        style={{
                          maxWidth: "340px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: "0.72rem",
                          color: "#6ee7b7",
                          background: "#0a0d14",
                          padding: "4px 8px",
                          borderRadius: "var(--radius-xs)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        $ {t.command}
                      </div>
                    </td>

                    {/* Frecuencia */}
                    <td>
                      <span style={{ fontSize: "0.82rem", color: "#e2e8f0", fontWeight: 600 }}>
                        {t.scheduleSummary}
                      </span>
                    </td>

                    {/* Próxima ejecución */}
                    <td>
                      <span className="mono" style={{ fontSize: "0.75rem", color: t.isEnabled ? "#7dd3fc" : "#64748b" }}>
                        {t.isEnabled ? t.nextRunParaguayFormatted : "Pausada"}
                      </span>
                    </td>

                    {/* Estado */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <span className={`badge ${t.isEnabled ? "badge-online" : "badge-secondary"}`}>
                          {t.isEnabled ? "Activa" : "Pausada"}
                        </span>
                        {t.lastStatus && (
                          <span
                            className="mono"
                            style={{
                              fontSize: "0.68rem",
                              color: isLastSuccess ? "#34d399" : isLastFailed ? "#fb7185" : "#fbbf24",
                            }}
                          >
                            Última: {t.lastStatus === "Completed" ? "éxito" : t.lastStatus === "Failed" ? "fallo" : "en curso"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Acciones */}
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => handleRunNow(t)}
                          className="icon-btn is-accent"
                          disabled={isRunning}
                          aria-label="Ejecutar ahora"
                          title="Ejecutar ahora mismo en segundo plano"
                        >
                          {isRunning ? <SpinnerDot /> : <PlayIcon />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggle(t.taskId)}
                          className="icon-btn is-warning"
                          aria-label={t.isEnabled ? "Pausar" : "Reanudar"}
                          title={t.isEnabled ? "Pausar ejecuciones automáticas" : "Reanudar ejecuciones automáticas"}
                        >
                          {t.isEnabled ? <PauseIcon /> : <PlayIcon />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setHistoryTask(t)}
                          className="icon-btn"
                          aria-label="Historial"
                          title="Ver historial de ejecuciones y salida de consola"
                        >
                          <HistoryIcon />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTaskToEdit(t);
                            setIsCreateModalOpen(true);
                          }}
                          className="icon-btn"
                          aria-label="Editar"
                          title="Editar configuración de la tarea"
                        >
                          <PencilIcon />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          className="icon-btn is-danger"
                          aria-label="Eliminar"
                          title="Eliminar tarea programada"
                        >
                          <TrashIcon />
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
