import React, { useState, useEffect } from "react";
import { createScheduledTask, updateScheduledTask, getMachines } from "../services/api";
import type { ScheduledTask, CreateScheduledTaskDto, UpdateScheduledTaskDto, Machine } from "../types";

interface ScheduledTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: ScheduledTask | null;
  initialMachineId?: string;
  onTaskSaved?: (task: ScheduledTask) => void;
}

const PRESET_COMMANDS = [
  {
    label: "Oracle: Directorio COPYBD",
    cmd: `export ORACLE_HOME=/opt/oracle/product/21c/dbhome_1 && \\
export PATH=$ORACLE_HOME/bin:$PATH && \\
echo "SELECT directory_path FROM dba_directories WHERE directory_name = 'COPYBD';" \\
| sqlplus system/'Maca*2023'@localhost:1521/orclpdb2`,
  },
  {
    label: "Oracle: Estado de instancia",
    cmd: `export ORACLE_HOME=/opt/oracle/product/21c/dbhome_1 && \\
export PATH=$ORACLE_HOME/bin:$PATH && \\
echo "SELECT name, open_mode FROM v\\$pdbs;" \\
| sqlplus -s / as sysdba`,
  },
  {
    label: "Limpieza de logs y temporales",
    cmd: `find /tmp -type f -mtime +7 -delete 2>/dev/null
journalctl --vacuum-time=7d 2>/dev/null
echo "Limpieza de mantenimiento finalizada con éxito."`,
  },
  {
    label: "MySQL: backup de base de datos",
    cmd: `mkdir -p /var/backups/mysql
mysqldump -u root -p'PASSWORD' --all-databases | gzip > /var/backups/mysql/db_$(date +%F_%H-%M).sql.gz
ls -lh /var/backups/mysql/ | tail -n 5`,
  },
  {
    label: "Docker: limpiar huérfanos",
    cmd: `docker system prune -f
docker stats --no-stream`,
  },
];

const DAYS_OF_WEEK = [
  { id: "Monday", label: "Lun" },
  { id: "Tuesday", label: "Mar" },
  { id: "Wednesday", label: "Mié" },
  { id: "Thursday", label: "Jue" },
  { id: "Friday", label: "Vie" },
  { id: "Saturday", label: "Sáb" },
  { id: "Sunday", label: "Dom" },
];

const SCHEDULE_TYPES = [
  {
    id: "EveryHours",
    label: "Cada X horas",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <polyline points="12 7 12 12 15.5 14"></polyline>
      </svg>
    ),
  },
  {
    id: "EveryDays",
    label: "Cada X días",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
  },
  {
    id: "SpecificDays",
    label: "Días de semana",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
        <line x1="9" y1="15" x2="9.01" y2="15"></line>
        <line x1="12" y1="15" x2="12.01" y2="15"></line>
        <line x1="15" y1="15" x2="15.01" y2="15"></line>
      </svg>
    ),
  },
  {
    id: "Once",
    label: "Una sola vez",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <circle cx="12" cy="12" r="4"></circle>
        <circle cx="12" cy="12" r="1" fill="currentColor"></circle>
      </svg>
    ),
  },
  {
    id: "CustomCron",
    label: "Expresión cron",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14"></line>
        <line x1="4" y1="10" x2="4" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12" y2="3"></line>
        <line x1="20" y1="21" x2="20" y2="16"></line>
        <line x1="20" y1="12" x2="20" y2="3"></line>
        <line x1="1" y1="14" x2="7" y2="14"></line>
        <line x1="9" y1="8" x2="15" y2="8"></line>
        <line x1="17" y1="16" x2="23" y2="16"></line>
      </svg>
    ),
  },
];

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const BoltIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export const ScheduledTaskModal: React.FC<ScheduledTaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  initialMachineId,
  onTaskSaved,
}) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [command, setCommand] = useState<string>("");

  // Schedule options
  const [scheduleType, setScheduleType] = useState<string>("EveryHours");
  const [intervalHours, setIntervalHours] = useState<number>(6);
  const [intervalDays, setIntervalDays] = useState<number>(1);
  const [scheduledTime, setScheduledTime] = useState<string>("03:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Monday", "Wednesday", "Friday"]);
  const [specificDate, setSpecificDate] = useState<string>("");
  const [cronExpression, setCronExpression] = useState<string>("0 3 * * *");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    getMachines()
      .then((res) => {
        setMachines(res);
        if (!selectedMachineId) {
          setSelectedMachineId(initialMachineId || res[0]?.externalMachineId || "");
        }
      })
      .catch((err) => console.error("Error al cargar máquinas:", err));

    if (taskToEdit) {
      setSelectedMachineId(taskToEdit.machineId);
      setName(taskToEdit.name);
      setDescription(taskToEdit.description || "");
      setCommand(taskToEdit.command);
      setScheduleType(taskToEdit.scheduleType || "EveryHours");

      if (taskToEdit.scheduleType === "EveryHours") {
        setIntervalHours(taskToEdit.intervalValue || 6);
      } else if (taskToEdit.scheduleType === "EveryDays") {
        setIntervalDays(taskToEdit.intervalValue || 1);
        setScheduledTime(taskToEdit.scheduledTime || "03:00");
      } else if (taskToEdit.scheduleType === "SpecificDays") {
        setScheduledTime(taskToEdit.scheduledTime || "03:00");
        setSelectedDays(taskToEdit.daysOfWeek ? taskToEdit.daysOfWeek.split(",") : ["Monday"]);
      } else if (taskToEdit.scheduleType === "Once" && taskToEdit.specificDate) {
        setSpecificDate(new Date(taskToEdit.specificDate).toISOString().slice(0, 16));
      } else if (taskToEdit.scheduleType === "CustomCron") {
        setCronExpression(taskToEdit.cronExpression || "0 3 * * *");
      }
    } else {
      setSelectedMachineId(initialMachineId || "");
      setName("");
      setDescription("");
      setCommand("");
      setScheduleType("EveryHours");
      setIntervalHours(6);
      setIntervalDays(1);
      setScheduledTime("03:00");
      setSelectedDays(["Monday", "Wednesday", "Friday"]);
      setSpecificDate("");
      setCronExpression("0 3 * * *");
    }
    setError(null);
  }, [isOpen, taskToEdit, initialMachineId]);

  if (!isOpen) return null;

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayId)) {
        if (prev.length === 1) return prev; // Mantener al menos un día
        return prev.filter((d) => d !== dayId);
      } else {
        return [...prev, dayId];
      }
    });
  };

  const handleApplyPreset = (cmdText: string, label: string) => {
    setCommand(cmdText);
    if (!name) setName(label);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId) {
      setError("Debes seleccionar un servidor.");
      return;
    }
    if (!name.trim()) {
      setError("El nombre de la tarea es obligatorio.");
      return;
    }
    if (!command.trim()) {
      setError("El comando bash a ejecutar no puede estar vacío.");
      return;
    }

    setSaving(true);
    setError(null);

    let intervalValue: number | undefined = undefined;
    let scheduledTimeVal: string | undefined = undefined;
    let daysOfWeekVal: string | undefined = undefined;
    let specificDateVal: string | undefined = undefined;
    let cronVal: string | undefined = undefined;

    if (scheduleType === "EveryHours") {
      intervalValue = Math.max(1, Number(intervalHours) || 1);
    } else if (scheduleType === "EveryDays") {
      intervalValue = Math.max(1, Number(intervalDays) || 1);
      scheduledTimeVal = scheduledTime || "03:00";
    } else if (scheduleType === "SpecificDays") {
      scheduledTimeVal = scheduledTime || "03:00";
      daysOfWeekVal = selectedDays.join(",");
    } else if (scheduleType === "Once") {
      if (!specificDate) {
        setError("Debes seleccionar la fecha y hora de ejecución.");
        setSaving(false);
        return;
      }
      specificDateVal = new Date(specificDate).toISOString();
    } else if (scheduleType === "CustomCron") {
      cronVal = cronExpression || "0 3 * * *";
    }

    try {
      if (taskToEdit) {
        const updateDto: UpdateScheduledTaskDto = {
          name: name.trim(),
          description: description.trim(),
          command: command.trim(),
          scheduleType,
          intervalValue,
          scheduledTime: scheduledTimeVal,
          daysOfWeek: daysOfWeekVal,
          specificDate: specificDateVal,
          cronExpression: cronVal,
          timezone: "America/Asuncion",
        };
        const updated = await updateScheduledTask(taskToEdit.taskId, updateDto);
        onTaskSaved?.(updated);
      } else {
        const createDto: CreateScheduledTaskDto = {
          machineId: selectedMachineId,
          name: name.trim(),
          description: description.trim(),
          command: command.trim(),
          scheduleType,
          intervalValue,
          scheduledTime: scheduledTimeVal,
          daysOfWeek: daysOfWeekVal,
          specificDate: specificDateVal,
          cronExpression: cronVal,
          timezone: "America/Asuncion",
        };
        const created = await createScheduledTask(createDto);
        onTaskSaved?.(created);
      }

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al guardar la tarea programada.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760, width: "95%" }}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc" }}>
              {taskToEdit ? "Editar tarea programada" : "Programar ejecución de comando"}
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
              Scripts bash en segundo plano con control de frecuencia e historial
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" disabled={saving} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>

        {error && (
          <div className="alert-box" style={{ margin: "0 20px 16px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="modal-scroll-body"
          style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}
        >
          {/* Destino y nombre */}
          <div className="field-grid">
            <div>
              <label className="form-label" htmlFor="task-server">
                Servidor de ejecución
              </label>
              <select
                id="task-server"
                className="form-input"
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                disabled={saving || Boolean(taskToEdit)}
                required
              >
                <option value="">Selecciona un servidor…</option>
                {machines.map((m) => (
                  <option key={m.externalMachineId} value={m.externalMachineId}>
                    {m.name || m.hostname} ({m.ipAddress || m.publicIpAddress || "En línea"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="task-name">
                Nombre descriptivo
              </label>
              <input
                id="task-name"
                type="text"
                className="form-input"
                placeholder="Ej. Consulta Oracle COPYBD, backup diario…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                required
              />
            </div>
          </div>

          {/* Plantillas */}
          <div>
            <label className="form-label">Plantillas sugeridas</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESET_COMMANDS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleApplyPreset(p.cmd, p.label)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                >
                  <BoltIcon />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Editor de comando */}
          <div>
            <label className="form-label" htmlFor="task-command" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span>Comando / script bash</span>
              <span style={{ fontWeight: 400, color: "#64748b", fontSize: "0.72rem" }}>
                Admite variables, pipes, sqlplus y multilínea
              </span>
            </label>
            <textarea
              id="task-command"
              className="form-input mono"
              rows={6}
              style={{
                background: "#0a0d14",
                color: "#6ee7b7",
                fontSize: "0.78rem",
                lineHeight: 1.55,
                borderRadius: "var(--radius-md)",
                resize: "vertical",
              }}
              placeholder={`# Ejemplo: variables de entorno Oracle + sqlplus\n export ORACLE_HOME=/opt/oracle/product/21c/dbhome_1 && \\\n export PATH=$ORACLE_HOME/bin:$PATH && \\\n echo "SELECT directory_path FROM dba_directories WHERE directory_name = 'COPYBD';" \\\n | sqlplus system/'Maca*2023'@localhost:1521/orclpdb2`}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={saving}
              required
            />
          </div>

          {/* Frecuencia */}
          <div className="modal-section">
            <div className="modal-section-head">
              <span className="modal-section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"></circle>
                  <polyline points="12 7 12 12 15.5 14"></polyline>
                </svg>
                Frecuencia y programación
              </span>
              <span className="badge badge-mono">Zona horaria: Paraguay (GMT-3 / GMT-4)</span>
            </div>

            <div className="option-grid" style={{ marginBottom: 14 }}>
              {SCHEDULE_TYPES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setScheduleType(st.id)}
                  className={`option-chip ${scheduleType === st.id ? "active" : ""}`}
                >
                  {st.icon}
                  {st.label}
                </button>
              ))}
            </div>

            {scheduleType === "EveryHours" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>Ejecutar cada</span>
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="form-input mono"
                  style={{ width: 84, textAlign: "center" }}
                  value={intervalHours}
                  onChange={(e) => setIntervalHours(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={saving}
                />
                <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>horas de forma continua</span>
                <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  {[1, 2, 4, 6, 12, 24].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setIntervalHours(h)}
                      className={`shortcut-pill ${intervalHours === h ? "active" : ""}`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            )}

            {scheduleType === "EveryDays" && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>Cada</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="form-input mono"
                    style={{ width: 76, textAlign: "center" }}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={saving}
                  />
                  <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>día(s)</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>A la hora (PY)</span>
                  <input
                    type="time"
                    className="form-input mono"
                    style={{ width: 124 }}
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            {scheduleType === "SpecificDays" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DAYS_OF_WEEK.map((d) => {
                    const isSelected = selectedDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`shortcut-pill ${isSelected ? "active" : ""}`}
                        style={{ padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 5 }}
                      >
                        {isSelected && <CheckIcon />}
                        {d.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>Hora de ejecución en Paraguay</span>
                  <input
                    type="time"
                    className="form-input mono"
                    style={{ width: 124 }}
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            {scheduleType === "Once" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>Fecha y hora exacta</span>
                <input
                  type="datetime-local"
                  className="form-input mono"
                  style={{ width: 230 }}
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  disabled={saving}
                  required
                />
              </div>
            )}

            {scheduleType === "CustomCron" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>Expresión cron</span>
                <input
                  type="text"
                  className="form-input mono"
                  style={{ width: 170 }}
                  placeholder="0 3 * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  disabled={saving}
                />
                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Ej. «0 3 * * *» = todos los días a las 3 AM</span>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 2 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner-small"></span>
                  Guardando…
                </>
              ) : taskToEdit ? (
                "Guardar cambios"
              ) : (
                "Crear tarea"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
