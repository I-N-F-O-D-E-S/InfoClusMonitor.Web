import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getMachine, getCommands, deleteMachine, updateMachineName, createCommand, refreshMachineTelemetry } from "../services/api";
import { signalRService } from "../services/signalr";
import { FileExplorer } from "./FileExplorer";
import { BackupsList } from "./BackupsList";
import { ScheduledTasksList } from "./ScheduledTasksList";
import { AgentUpdateModal } from "./AgentUpdateModal";
import type { Machine, Command } from "../types";
import { MachineStatus, CommandStatus } from "../types";

interface CommandItem {
  label: string;
  cmd: string;
  category: "general" | "backup" | "docker" | "diag";
}

const COMMAND_PRESETS: CommandItem[] = [
  // Generales
  { label: "uptime", cmd: "uptime", category: "general" },
  { label: "df -h (disco)", cmd: "df -h", category: "general" },
  { label: "free -m (RAM)", cmd: "free -m", category: "general" },
  { label: "uname -a", cmd: "uname -a", category: "general" },

  // Backups
  { label: "Crear backup /var/www", cmd: "tar -czvf /backup-$(date +%F).tar.gz /var/www /etc", category: "backup" },
  { label: "Listar backups", cmd: "ls -lh /backup* /var/backups 2>/dev/null || ls -lh /", category: "backup" },
  { label: "Tamaño de backups", cmd: "du -sh /var/backups /backup* 2>/dev/null", category: "backup" },
  { label: "Backup MySQL full", cmd: "mysqldump -u root -p --all-databases > /backup-db.sql", category: "backup" },

  // Docker & Servicios
  { label: "docker ps", cmd: "docker ps", category: "docker" },
  { label: "docker stats", cmd: "docker stats --no-stream", category: "docker" },
  { label: "servicios fallidos", cmd: "systemctl --failed", category: "docker" },

  // Diagnóstico
  { label: "Top 10 CPU", cmd: "ps aux --sort=-%cpu | head -n 10", category: "diag" },
  { label: "Top 10 RAM", cmd: "ps aux --sort=-%mem | head -n 10", category: "diag" },
  { label: "Puertos en escucha", cmd: "netstat -tuln 2>/dev/null || ss -tuln", category: "diag" },
];

const statusLabels: Record<string, string> = {
  [CommandStatus.Completed]: "Completado",
  [CommandStatus.Failed]: "Fallido",
  [CommandStatus.Running]: "En ejecución",
  [CommandStatus.Pending]: "Pendiente",
  [CommandStatus.Sent]: "Enviado",
};

const CATEGORY_LABELS: Record<string, string> = {
  all: "Todos",
  general: "Básicos",
  backup: "Backups",
  docker: "Docker",
  diag: "Diagnóstico",
};

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "N/A";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function isMachineOnline(m: Machine): boolean {
  if (!m) return false;
  if (m.status === MachineStatus.Online || (m.status as unknown) === 0 || (m.status as unknown) === "Online") {
    return true;
  }
  if (m.lastHeartbeat) {
    const diffMs = Date.now() - new Date(m.lastHeartbeat).getTime();
    if (diffMs >= 0 && diffMs < 60000) {
      return true;
    }
  }
  return false;
}

function getMetricColor(percent: number): string {
  if (percent >= 85) return "#ef4444";
  if (percent >= 65) return "#f59e0b";
  return "#38bdf8";
}

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export default function MachineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [linuxCommand, setLinuxCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<"all" | "general" | "backup" | "docker" | "diag">("all");

  // Tabs principales
  const [activeMainTab, setActiveMainTab] = useState<"terminal" | "files" | "backups" | "scheduled">("terminal");

  // Editor multilínea
  const [isExpanded, setIsExpanded] = useState(false);

  // Renombrado
  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    if (!id) return;

    getMachine(id)
      .then((m) => {
        setMachine(m);
        setCustomName(m.name || m.hostname);
        const machineExternalId = m.externalMachineId || id;
        getCommands(machineExternalId)
          .then((cmds) => {
            setCommands(cmds);
          })
          .catch((err) => console.error("Error al cargar historial de comandos:", err));
      })
      .catch(console.error);

    signalRService.connect().then(() => {
      signalRService.subscribeToMachine(id);

      signalRService.onMachineUpdated((m) => {
        setMachine((prev) => {
          if (!prev) return prev;
          if (m.externalMachineId === prev.externalMachineId || String(m.id) === String(prev.id) || m.externalMachineId === id || String(m.id) === id) {
            return { ...prev, ...m };
          }
          return prev;
        });
      });

      signalRService.onCommandCreated((cmd) => {
        setCommands((prev) => {
          const exists = prev.some((c) => c.id === cmd.id);
          if (exists) return prev.map((c) => (c.id === cmd.id ? cmd : c));
          return [cmd, ...prev];
        });
      });

      signalRService.onCommandUpdated((cmd) => {
        setCommands((prev) => {
          const exists = prev.some((c) => c.id === cmd.id);
          if (exists) {
            return prev.map((c) => (c.id === cmd.id ? cmd : c));
          }
          return [cmd, ...prev];
        });
      });
    });

    return () => {
      if (id) signalRService.unsubscribeFromMachine(id);
    };
  }, [id]);

  const handleRefreshTelemetry = async () => {
    const targetId = machine?.externalMachineId || id;
    if (!targetId) return;
    setRefreshing(true);
    try {
      await refreshMachineTelemetry(targetId);
      const [m, cmds] = await Promise.all([
        getMachine(targetId),
        getCommands(targetId),
      ]);
      setMachine((prev) => (prev ? { ...prev, ...m } : m));
      setCommands(cmds);
    } catch (err) {
      console.error("Error al solicitar telemetría:", err);
    } finally {
      setTimeout(() => setRefreshing(false), 800);
    }
  };

  const handleSaveName = async () => {
    const targetId = machine?.externalMachineId || id;
    if (!targetId || !customName.trim()) return;
    setIsSavingName(true);
    try {
      const updated = await updateMachineName(targetId, customName.trim());
      setMachine((prev) => (prev ? { ...prev, name: updated.name } : updated));
      setIsEditingName(false);
    } catch (err) {
      console.error("Error al actualizar el nombre del servidor:", err);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDelete = async () => {
    const targetId = machine?.externalMachineId || id;
    if (!targetId) return;
    try {
      await deleteMachine(targetId);
      navigate("/");
    } catch (err) {
      console.error("Error al eliminar el servidor:", err);
    }
  };

  const handleSendCommand = async (cmdText?: string) => {
    const toSend = cmdText || linuxCommand;
    const targetId = machine?.externalMachineId || id;
    if (!targetId || !toSend.trim()) return;
    setSending(true);
    try {
      const created = await createCommand({ machineId: targetId, parameters: toSend.trim() });
      if (created) {
        setCommands((prev) => {
          const exists = prev.some((c) => c.id === created.id);
          return exists ? prev : [created, ...prev];
        });
      }
      if (!cmdText) setLinuxCommand("");
    } catch (err) {
      console.error("Error al ejecutar el comando:", err);
    } finally {
      setSending(false);
    }
  };

  const handleClearCommand = () => {
    setLinuxCommand("");
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (!machine) {
    return (
      <div className="state-block">
        <div className="auth-spinner"></div>
        <p className="mono text-muted">Cargando telemetría del servidor…</p>
      </div>
    );
  }

  const isOnline = isMachineOnline(machine);
  const displayMachineId = machine.externalMachineId || String(machine.id);
  const publicIp = machine.publicIpAddress || machine.ipAddress || "N/A";
  const privateIp = machine.privateIpAddress || machine.ipAddress || "127.0.0.1";

  const visiblePresets = activeCategory === "all"
    ? COMMAND_PRESETS
    : COMMAND_PRESETS.filter((c) => c.category === activeCategory);

  const metrics = [
    { label: "Uso de CPU", value: machine.cpuPercent || 0 },
    { label: "Memoria RAM", value: machine.memoryPercent || 0 },
    { label: "Disco principal", value: machine.diskPercent || 0 },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb mono">
        <Link to="/">Nodos</Link>
        <span>/</span>
        <span style={{ color: "#ffffff" }}>{machine.name || machine.hostname}</span>
      </div>

      {/* Encabezado */}
      <div className="page-head" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {!isEditingName ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 className="page-title">{machine.name || machine.hostname}</h2>
              <button
                onClick={() => {
                  setCustomName(machine.name || machine.hostname);
                  setIsEditingName(true);
                }}
                className="icon-btn"
                title="Cambiar el nombre del servidor"
                aria-label="Renombrar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path>
                </svg>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="text"
                className="form-input mono"
                style={{ height: 38, fontSize: "0.95rem", width: 220 }}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
              />
              <button onClick={handleSaveName} className="btn btn-primary btn-sm" disabled={isSavingName || !customName.trim()}>
                {isSavingName ? "Guardando…" : "Guardar"}
              </button>
              <button onClick={() => setIsEditingName(false)} className="btn btn-secondary btn-sm">
                Cancelar
              </button>
            </div>
          )}

          <span className={`badge ${isOnline ? "badge-online" : "badge-offline"}`}>
            <span className={`pulse-dot ${isOnline ? "" : "disconnected"}`}></span>
            {isOnline ? "EN LÍNEA" : "OFFLINE"}
          </span>
          <span className="badge badge-mono">{machine.os || "Linux"}</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleRefreshTelemetry}
            className="btn btn-secondary btn-sm"
            disabled={refreshing}
            title="Solicitar telemetría instantánea al nodo"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: refreshing ? "spin 0.8s linear infinite" : undefined }}
            >
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
            {refreshing ? "Solicitando…" : "Telemetría"}
          </button>
          <button
            onClick={() => setShowUpdateModal(true)}
            className="btn btn-secondary btn-sm"
            title="Actualizar el agente en este servidor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <path d="M5 21h14"></path>
            </svg>
            Agente
          </button>
          <button onClick={() => setShowDelete(!showDelete)} className="btn btn-danger btn-sm">
            Eliminar
          </button>
        </div>
      </div>

      {/* Confirmación de eliminación */}
      {showDelete && (
        <div
          className="modal-section"
          style={{ borderColor: "rgba(244, 63, 94, 0.35)", background: "rgba(244, 63, 94, 0.06)", marginBottom: 22 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h4 style={{ color: "#fb7185", fontSize: "0.95rem" }}>¿Eliminar este servidor del clúster?</h4>
              <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: 2 }}>
                Quitará a <strong>{machine.hostname}</strong> de la consola de control.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDelete} className="btn btn-danger btn-sm">Confirmar</button>
              <button onClick={() => setShowDelete(false)} className="btn btn-secondary btn-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Red y hardware */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 18 }}>
          <div>
            <div className="stat-label">Hostname nativo</div>
            <div className="mono" style={{ fontSize: "0.88rem", color: "#ffffff", marginTop: 5, fontWeight: 600 }}>
              {machine.hostname}
            </div>
          </div>

          <div>
            <div className="stat-label">IP pública</div>
            <button
              className="ip-cell is-public"
              style={{ marginTop: 5 }}
              onClick={() => handleCopy(publicIp, "pubIp")}
              title="Copiar IP pública"
            >
              <span>{publicIp}</span>
              <span className={`ip-copy ${copiedText === "pubIp" ? "copied" : ""}`}>
                {copiedText === "pubIp" ? <CheckIcon /> : <CopyIcon />}
              </span>
            </button>
          </div>

          <div>
            <div className="stat-label">IP privada</div>
            <button
              className="ip-cell"
              style={{ marginTop: 5 }}
              onClick={() => handleCopy(privateIp, "privIp")}
              title="Copiar IP privada"
            >
              <span>{privateIp}</span>
              <span className={`ip-copy ${copiedText === "privIp" ? "copied" : ""}`}>
                {copiedText === "privIp" ? <CheckIcon /> : <CopyIcon />}
              </span>
            </button>
          </div>

          <div>
            <div className="stat-label">Tiempo activo</div>
            <div className="mono" style={{ fontSize: "0.9rem", color: "#ffffff", marginTop: 5, fontWeight: 600 }}>
              {formatUptime(machine.uptime)}
            </div>
          </div>

          <div>
            <div className="stat-label">Machine ID</div>
            <button
              className="ip-cell"
              style={{ marginTop: 5 }}
              onClick={() => handleCopy(displayMachineId, "id")}
              title="Copiar ID"
            >
              <span style={{ fontSize: "0.78rem" }}>
                {displayMachineId.length > 18 ? `${displayMachineId.substring(0, 16)}…` : displayMachineId}
              </span>
              <span className={`ip-copy ${copiedText === "id" ? "copied" : ""}`}>
                {copiedText === "id" ? <CheckIcon /> : <CopyIcon />}
              </span>
            </button>
          </div>
        </div>

        {/* Medidores */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 22 }}>
          {metrics.map((mt) => (
            <div key={mt.label} style={{ background: "#0c0c12", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="stat-label">{mt.label}</span>
                <span className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: getMetricColor(mt.value), lineHeight: 1 }}>
                  {mt.value.toFixed(1)}%
                </span>
              </div>
              <div className="metric-bar-bg" style={{ marginTop: 10, height: 6 }}>
                <div
                  className="metric-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(0, mt.value))}%`, background: getMetricColor(mt.value) }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="main-tabs-nav" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`main-tab-btn ${activeMainTab === "terminal" ? "active" : ""}`}
          onClick={() => setActiveMainTab("terminal")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          Consola
        </button>
        <button
          type="button"
          className={`main-tab-btn ${activeMainTab === "files" ? "active" : ""}`}
          onClick={() => setActiveMainTab("files")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          </svg>
          Archivos
        </button>
        <button
          type="button"
          className={`main-tab-btn ${activeMainTab === "backups" ? "active" : ""}`}
          onClick={() => setActiveMainTab("backups")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="8.5" ry="3"></ellipse>
            <path d="M3.5 5v14c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3V5"></path>
            <path d="M3.5 12c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3"></path>
          </svg>
          Copias
        </button>
        <button
          type="button"
          className={`main-tab-btn ${activeMainTab === "scheduled" ? "active" : ""}`}
          onClick={() => setActiveMainTab("scheduled")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"></circle>
            <polyline points="12 7 12 12 15.5 14"></polyline>
          </svg>
          Tareas
        </button>
      </div>

      {activeMainTab === "files" && (
        <FileExplorer
          machineId={machine.externalMachineId || id || ""}
          hostname={machine.hostname}
          isOnline={isOnline}
        />
      )}

      {activeMainTab === "backups" && (
        <div className="card">
          <BackupsList machineId={machine.externalMachineId || id || ""} showHeader={true} />
        </div>
      )}

      {activeMainTab === "scheduled" && (
        <div className="card">
          <ScheduledTasksList machineId={machine.externalMachineId || id || ""} showHeader={true} />
        </div>
      )}

      {activeMainTab === "terminal" && (
        <>
          <div className="terminal-card" style={{ marginTop: 0 }}>
            <div className="terminal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="terminal-dots">
                  <div className="terminal-dot"></div>
                  <div className="terminal-dot"></div>
                  <div className="terminal-dot"></div>
                </div>
                <span className="mono" style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  bash — {machine.name || machine.hostname} ({publicIp})
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? "Cambiar a modo de una línea" : "Expandir a editor multilínea"}
                >
                  {isExpanded ? "Modo línea" : "Modo script"}
                </button>
              </div>
            </div>

            <div className="terminal-body">
              {/* Categorías */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <span className="stat-label">Comandos sugeridos</span>
                <div className="segmented">
                  {(["all", "general", "backup", "docker", "diag"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`segment ${activeCategory === cat ? "active" : ""}`}
                      style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chips */}
              <div className="command-chips" style={{ marginTop: 6 }}>
                {visiblePresets.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="command-chip"
                    onClick={() => setLinuxCommand(item.cmd)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Entrada */}
              {!isExpanded ? (
                <div className="terminal-input-wrapper">
                  <span className="terminal-prompt">$</span>
                  <input
                    type="text"
                    className="terminal-input"
                    placeholder="Escribe un comando Linux (uptime, df -h, docker ps…)"
                    value={linuxCommand}
                    onChange={(e) => setLinuxCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendCommand();
                      }
                    }}
                    disabled={sending}
                  />
                  <div className="terminal-actions">
                    {linuxCommand && (
                      <button
                        type="button"
                        onClick={handleClearCommand}
                        className="btn btn-secondary btn-sm"
                        title="Limpiar comando"
                      >
                        Limpiar
                      </button>
                    )}
                    <button
                      onClick={() => handleSendCommand()}
                      className="btn btn-primary btn-sm"
                      disabled={sending || !linuxCommand.trim()}
                    >
                      {sending ? "Ejecutando…" : "Ejecutar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="terminal-expanded-wrapper">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono text-muted" style={{ fontSize: "0.72rem" }}>
                      Editor de script bash · <strong>Ctrl + Enter</strong> para ejecutar
                    </span>
                    {linuxCommand && (
                      <button
                        type="button"
                        onClick={handleClearCommand}
                        className="btn btn-secondary btn-sm"
                        title="Limpiar editor"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  <textarea
                    className="terminal-textarea"
                    rows={6}
                    placeholder={`# Escribe o pega tu script bash aquí\necho "Iniciando mantenimiento..."\nuptime\ndf -h\nfree -m`}
                    value={linuxCommand}
                    onChange={(e) => setLinuxCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        handleSendCommand();
                      }
                    }}
                    disabled={sending}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
                    <button type="button" onClick={() => setIsExpanded(false)} className="btn btn-secondary btn-sm">
                      Cerrar editor
                    </button>
                    <button
                      onClick={() => handleSendCommand()}
                      className="btn btn-primary btn-sm"
                      disabled={sending || !linuxCommand.trim()}
                    >
                      {sending ? "Ejecutando…" : "Ejecutar script"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Historial */}
          <div style={{ marginTop: 26 }}>
            <div className="page-head" style={{ marginBottom: 14 }}>
              <div>
                <h3 className="page-title" style={{ fontSize: "1.15rem" }}>
                  Historial de ejecución ({commands.length})
                </h3>
                <p className="page-sub">Comandos ejecutados y su salida, en tiempo real</p>
              </div>
            </div>

            {commands.length === 0 && (
              <div className="card state-block" style={{ padding: "36px 16px" }}>
                <p className="mono text-muted">Todavía no se han ejecutado comandos en este servidor.</p>
              </div>
            )}

            {commands.map((cmd) => {
              const isCompleted = cmd.status === CommandStatus.Completed || (cmd.status as unknown) === "Completed" || (cmd.status as unknown) === 3;
              const isFailed = cmd.status === CommandStatus.Failed || (cmd.status as unknown) === "Failed" || (cmd.status as unknown) === 4;
              const isRunning = cmd.status === CommandStatus.Running || (cmd.status as unknown) === "Running" || (cmd.status as unknown) === 2;

              return (
                <div key={cmd.id} className="command-history-item">
                  <div className="command-history-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span className="mono" style={{ fontWeight: 600, color: "#ffffff", fontSize: "0.82rem" }}>
                        $ {cmd.parameters}
                      </span>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: isCompleted ? "rgba(16, 185, 129, 0.12)" : isFailed ? "rgba(244, 63, 94, 0.12)" : isRunning ? "rgba(245, 158, 11, 0.12)" : "#181822",
                          color: isCompleted ? "#34d399" : isFailed ? "#fb7185" : isRunning ? "#fbbf24" : "#a1a1aa",
                          border: `1px solid ${isCompleted ? "rgba(16, 185, 129, 0.25)" : isFailed ? "rgba(244, 63, 94, 0.25)" : isRunning ? "rgba(245, 158, 11, 0.25)" : "#272738"}`,
                        }}
                      >
                        {statusLabels[cmd.status] || cmd.status}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="mono text-muted" style={{ fontSize: "0.72rem" }}>
                        {new Date(cmd.createdAt).toLocaleTimeString()}
                      </span>
                      {cmd.result && (
                        <button
                          onClick={() => handleCopy(cmd.result, String(cmd.id))}
                          className="icon-btn"
                          title="Copiar salida"
                          aria-label="Copiar salida"
                        >
                          {copiedText === String(cmd.id) ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      )}
                    </div>
                  </div>

                  {cmd.result && <div className="command-output mono">{cmd.result}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal de agente */}
      {showUpdateModal && (
        <AgentUpdateModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          targetMachine={machine}
        />
      )}
    </div>
  );
}
