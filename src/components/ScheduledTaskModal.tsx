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
    label: "Oracle: Consultar Directorio COPYBD",
    cmd: `export ORACLE_HOME=/opt/oracle/product/21c/dbhome_1 && \\
export PATH=$ORACLE_HOME/bin:$PATH && \\
echo "SELECT directory_path FROM dba_directories WHERE directory_name = 'COPYBD';" \\
| sqlplus system/'Maca*2023'@localhost:1521/orclpdb2`,
  },
  {
    label: "Oracle: Verificar Estado de Instancia / PDBs",
    cmd: `export ORACLE_HOME=/opt/oracle/product/21c/dbhome_1 && \\
export PATH=$ORACLE_HOME/bin:$PATH && \\
echo "SELECT name, open_mode FROM v\\$pdbs;" \\
| sqlplus -s / as sysdba`,
  },
  {
    label: "Mantenimiento: Limpieza de Logs y Temporales",
    cmd: `find /tmp -type f -mtime +7 -delete 2>/dev/null
journalctl --vacuum-time=7d 2>/dev/null
echo "Limpieza de mantenimiento finalizada con éxito."`,
  },
  {
    label: "MySQL: Backup Base de Datos",
    cmd: `mkdir -p /var/backups/mysql
mysqldump -u root -p'PASSWORD' --all-databases | gzip > /var/backups/mysql/db_$(date +%F_%H-%M).sql.gz
ls -lh /var/backups/mysql/ | tail -n 5`,
  },
  {
    label: "Docker: Limpiar Imágenes y Contenedores Huérfanos",
    cmd: `docker system prune -f
docker stats --no-stream`,
  },
];

const DAYS_OF_WEEK = [
  { id: "Monday", label: "Lunes" },
  { id: "Tuesday", label: "Martes" },
  { id: "Wednesday", label: "Miércoles" },
  { id: "Thursday", label: "Jueves" },
  { id: "Friday", label: "Viernes" },
  { id: "Saturday", label: "Sábado" },
  { id: "Sunday", label: "Domingo" },
];

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
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 760, width: "95%" }}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
              <span>⏰</span> {taskToEdit ? "Editar Tarea Programada" : "Programar Ejecución de Comando"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              Automatiza la ejecución de scripts bash en segundo plano con control de frecuencia y registro histórico
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" disabled={saving}>
            ✕
          </button>
        </div>

        {error && (
          <div className="alert-box" style={{ margin: "0 20px 16px" }}>
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Servidor Destino y Nombre */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="form-label" style={{ fontSize: "12px", fontWeight: 600, color: "#cbd5e1" }}>
                Servidor de Ejecución:
              </label>
              <select
                className="form-input"
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                disabled={saving || Boolean(taskToEdit)}
                required
              >
                <option value="">-- Selecciona un servidor --</option>
                {machines.map((m) => (
                  <option key={m.externalMachineId} value={m.externalMachineId}>
                    {m.name || m.hostname} ({m.ipAddress || m.publicIpAddress || "En línea"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: "12px", fontWeight: 600, color: "#cbd5e1" }}>
                Nombre Descriptivo:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Consulta Oracle COPYBD, Backup Diario..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                required
              />
            </div>
          </div>

          {/* Plantillas Rápidas */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "#cbd5e1" }}>
                Plantillas sugeridas:
              </label>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESET_COMMANDS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleApplyPreset(p.cmd, p.label)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "11px", padding: "3px 8px" }}
                >
                  ⚡ {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Editor de Comando Bash */}
          <div>
            <label className="form-label" style={{ fontSize: "12px", fontWeight: 600, color: "#cbd5e1", display: "flex", justifyContent: "space-between" }}>
              <span>Comando / Script Bash a Ejecutar:</span>
              <span style={{ fontSize: "11px", color: "#38bdf8" }}>Soporta variables de entorno, pipes (|), sqlplus y scripts multilínea</span>
            </label>
            <textarea
              className="form-input mono"
              rows={6}
              style={{
                background: "#0a0d14",
                color: "#34d399",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "12px",
                lineHeight: 1.5,
                border: "1px solid #1e293b",
                borderRadius: "var(--radius-md)",
                resize: "vertical"
              }}
              placeholder={`# Ejemplo de comando con variables de entorno Oracle y consulta sqlplus:
export ORACLE_HOME=/opt/oracle/product/21c/dbhome_1 && \\
export PATH=$ORACLE_HOME/bin:$PATH && \\
echo "SELECT directory_path FROM dba_directories WHERE directory_name = 'COPYBD';" \\
| sqlplus system/'Maca*2023'@localhost:1521/orclpdb2`}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={saving}
              required
            />
          </div>

          {/* Configuración de Frecuencia y Horario */}
          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🕒</span> Frecuencia y Programación
              </label>
              <span className="badge badge-mono" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontSize: "11px" }}>
                Zona Horaria: Paraguay (Asunción GMT-3 / GMT-4)
              </span>
            </div>

            {/* Selector de tipo */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 14 }}>
              {[
                { id: "EveryHours", label: "Cada X Horas", icon: "⏳" },
                { id: "EveryDays", label: "Cada X Días", icon: "📅" },
                { id: "SpecificDays", label: "Días de Semana", icon: "🗓️" },
                { id: "Once", label: "Una Sola Vez", icon: "🎯" },
                { id: "CustomCron", label: "Expresión Cron", icon: "⚙️" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setScheduleType(st.id)}
                  className={`btn btn-sm ${scheduleType === st.id ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    padding: "8px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <span>{st.icon}</span> {st.label}
                </button>
              ))}
            </div>

            {/* Configuración específica según el tipo */}
            {scheduleType === "EveryHours" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "#e2e8f0" }}>Ejecutar cada:</span>
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="form-input"
                  style={{ width: 90, textAlign: "center" }}
                  value={intervalHours}
                  onChange={(e) => setIntervalHours(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={saving}
                />
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>horas de forma continua</span>
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
                  <span style={{ fontSize: "13px", color: "#e2e8f0" }}>Cada:</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="form-input"
                    style={{ width: 80, textAlign: "center" }}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={saving}
                  />
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>día(s)</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "13px", color: "#e2e8f0" }}>A la hora (PY):</span>
                  <input
                    type="time"
                    className="form-input"
                    style={{ width: 130 }}
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
                        style={{
                          padding: "6px 12px",
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      >
                        {isSelected ? "✓ " : ""}{d.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "13px", color: "#e2e8f0" }}>Hora de ejecución en Paraguay:</span>
                  <input
                    type="time"
                    className="form-input"
                    style={{ width: 130 }}
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            {scheduleType === "Once" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "#e2e8f0" }}>Fecha y hora exacta:</span>
                <input
                  type="datetime-local"
                  className="form-input"
                  style={{ width: 240 }}
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  disabled={saving}
                  required
                />
              </div>
            )}

            {scheduleType === "CustomCron" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "#e2e8f0" }}>Expresión Cron:</span>
                <input
                  type="text"
                  className="form-input mono"
                  style={{ width: 180 }}
                  placeholder="0 3 * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  disabled={saving}
                />
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>Ej: "0 3 * * *" (Todos los días a las 3 AM)</span>
              </div>
            )}
          </div>

          {/* Botones de Acción */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
              style={{ fontWeight: 700, padding: "8px 18px" }}
            >
              {saving ? "Guardando..." : taskToEdit ? "Guardar Cambios" : "Crear Tarea Programada"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
