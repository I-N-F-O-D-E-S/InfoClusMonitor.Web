import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getMachine, getCommands, deleteMachine, updateMachineName, createCommand, refreshMachineTelemetry } from "../services/api";
import { signalRService } from "../services/signalr";
import type { Machine, Command } from "../types";
import { MachineStatus, CommandStatus } from "../types";

const QUICK_COMMANDS = [
  { label: "uptime", cmd: "uptime" },
  { label: "df -h", cmd: "df -h" },
  { label: "free -m", cmd: "free -m" },
  { label: "docker ps", cmd: "docker ps" },
  { label: "uname -a", cmd: "uname -a" },
  { label: "📦 Crear Backup", cmd: "tar -czvf /backup-$(date +%F).tar.gz /var/www /etc" },
  { label: "📂 Listar Backups", cmd: "ls -lh /backup* /var/backups" },
  { label: "📊 Tamaño Backups", cmd: "du -sh /var/backups /backup*" },
  { label: "🗄️ Backup MySQL", cmd: "mysqldump -u root -p --all-databases > /backup-db.sql" },
  { label: "ps CPU Top 10", cmd: "ps aux --sort=-%cpu | head -n 10" },
  { label: "netstat", cmd: "netstat -tuln" },
];

const statusLabels: Record<string, string> = {
  [CommandStatus.Completed]: "Completado",
  [CommandStatus.Failed]: "Fallido",
  [CommandStatus.Running]: "En ejecución",
  [CommandStatus.Pending]: "Pendiente",
  [CommandStatus.Sent]: "Enviado",
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

  // Estados para el editor de comandos
  const [isExpanded, setIsExpanded] = useState(false);

  // Estados para renombrar
  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    if (!id) return;

    // Cargar datos de la máquina y comandos anteriores
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
      <div style={{ textAlign: "center", padding: "64px 0" }}>
        <div className="auth-spinner" style={{ margin: "0 auto 16px" }}></div>
        <p className="mono text-muted">Cargando telemetría del servidor...</p>
      </div>
    );
  }

  const isOnline = isMachineOnline(machine);
  const displayMachineId = machine.externalMachineId || String(machine.id);
  const publicIp = machine.publicIpAddress || machine.ipAddress || "N/A";
  const privateIp = machine.privateIpAddress || machine.ipAddress || "127.0.0.1";

  return (
    <div>
      {/* Breadcrumb de navegación */}
      <div className="breadcrumb mono">
        <Link to="/">Servidores</Link>
        <span>/</span>
        <span style={{ color: "#ffffff" }}>{machine.name || machine.hostname}</span>
      </div>

      {/* Encabezado superior con edición de nombre */}
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {!isEditingName ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2>{machine.name || machine.hostname}</h2>
              <button
                onClick={() => {
                  setCustomName(machine.name || machine.hostname);
                  setIsEditingName(true);
                }}
                className="btn btn-secondary btn-sm"
                style={{ padding: "4px 8px", fontSize: "11px" }}
                title="Cambiar nombre del servidor"
              >
                ✏️ Renombrar
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="text"
                className="search-input mono"
                style={{ height: 36, padding: "4px 10px", fontSize: "0.95rem" }}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
              />
              <button
                onClick={handleSaveName}
                className="btn btn-primary btn-sm"
                disabled={isSavingName || !customName.trim()}
              >
                {isSavingName ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancelar
              </button>
            </div>
          )}

          <span className={`badge ${isOnline ? "badge-online" : "badge-offline"}`}>
            <span className={`pulse-dot ${isOnline ? "" : "disconnected"}`} style={{ width: 6, height: 6 }}></span>
            {isOnline ? "EN LÍNEA" : "DESCONECTADO"}
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
              style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
            </svg>
            {refreshing ? "Solicitando..." : "Actualizar"}
          </button>
          <button onClick={() => setShowDelete(!showDelete)} className="btn btn-danger btn-sm">
            Eliminar Servidor
          </button>
        </div>
      </div>

      {/* Caja de confirmación de eliminación */}
      {showDelete && (
        <div className="card" style={{ borderColor: "#ef4444", marginBottom: 24, background: "#1c1013" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h4 style={{ color: "#f87171" }}>¿Eliminar este servidor?</h4>
              <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 2 }}>
                Esto eliminará a <strong>{machine.hostname}</strong> del registro de InfodesCluster.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDelete} className="btn btn-danger btn-sm">Confirmar Eliminación</button>
              <button onClick={() => setShowDelete(false)} className="btn btn-secondary btn-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Especificaciones de Hardware y Red (IP Pública y Privada) */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          <div>
            <div className="stat-label">HOSTNAME NATIVO</div>
            <div className="mono" style={{ fontSize: "0.85rem", color: "#ffffff", marginTop: 4 }}>
              {machine.hostname}
            </div>
          </div>

          <div>
            <div className="stat-label">IP PÚBLICA (INTERNET)</div>
            <div
              className="mono"
              style={{ fontSize: "0.9rem", fontWeight: 600, color: "#38bdf8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
              onClick={() => handleCopy(publicIp, "pubIp")}
              title="Clic para copiar IP pública"
            >
              <span>{publicIp}</span>
              <span className="badge badge-mono" style={{ fontSize: "9px" }}>
                {copiedText === "pubIp" ? "COPIADO" : "COPIAR"}
              </span>
            </div>
          </div>

          <div>
            <div className="stat-label">IP PRIVADA (LAN / LOCAL)</div>
            <div
              className="mono"
              style={{ fontSize: "0.9rem", fontWeight: 600, color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
              onClick={() => handleCopy(privateIp, "privIp")}
              title="Clic para copiar IP privada"
            >
              <span>{privateIp}</span>
              <span className="badge badge-mono" style={{ fontSize: "9px" }}>
                {copiedText === "privIp" ? "COPIADO" : "COPIAR"}
              </span>
            </div>
          </div>

          <div>
            <div className="stat-label">TIEMPO ACTIVO (UPTIME)</div>
            <div className="mono" style={{ fontSize: "0.9rem", color: "#ffffff", marginTop: 4 }}>
              {formatUptime(machine.uptime)}
            </div>
          </div>

          <div>
            <div className="stat-label">EXTERNAL MACHINE ID</div>
            <div
              className="mono"
              style={{ fontSize: "0.75rem", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
              onClick={() => handleCopy(displayMachineId, "id")}
              title="Clic para copiar"
            >
              <span>{displayMachineId.length > 16 ? `${displayMachineId.substring(0, 14)}...` : displayMachineId}</span>
              <span className="badge badge-mono" style={{ fontSize: "8px" }}>
                {copiedText === "id" ? "COPIADO" : "COPIAR"}
              </span>
            </div>
          </div>
        </div>

        {/* Medidores de Telemetría en Tiempo Real */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 24 }}>
          <div className="card" style={{ background: "#0c0c10", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-label">USO DE CPU</span>
              <span className="mono" style={{ fontSize: "1.2rem", fontWeight: 700 }}>{machine.cpuPercent?.toFixed(1) || 0}%</span>
            </div>
            <div className="metric-bar-bg" style={{ marginTop: 10, height: 6 }}>
              <div
                className="metric-bar-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, machine.cpuPercent || 0))}%`,
                  background: (machine.cpuPercent || 0) > 85 ? "#ef4444" : "#ffffff",
                }}
              ></div>
            </div>
          </div>

          <div className="card" style={{ background: "#0c0c10", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-label">USO DE MEMORIA RAM</span>
              <span className="mono" style={{ fontSize: "1.2rem", fontWeight: 700 }}>{machine.memoryPercent?.toFixed(1) || 0}%</span>
            </div>
            <div className="metric-bar-bg" style={{ marginTop: 10, height: 6 }}>
              <div
                className="metric-bar-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, machine.memoryPercent || 0))}%`,
                  background: (machine.memoryPercent || 0) > 85 ? "#ef4444" : "#ffffff",
                }}
              ></div>
            </div>
          </div>

          <div className="card" style={{ background: "#0c0c10", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-label">CAPACIDAD DE DISCO</span>
              <span className="mono" style={{ fontSize: "1.2rem", fontWeight: 700 }}>{machine.diskPercent?.toFixed(1) || 0}%</span>
            </div>
            <div className="metric-bar-bg" style={{ marginTop: 10, height: 6 }}>
              <div
                className="metric-bar-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, machine.diskPercent || 0))}%`,
                  background: (machine.diskPercent || 0) > 90 ? "#ef4444" : "#ffffff",
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Web Linux & Ejecución Remota de Comandos */}
      <div className="terminal-card">
        <div className="terminal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="terminal-dots">
              <div className="terminal-dot"></div>
              <div className="terminal-dot"></div>
              <div className="terminal-dot"></div>
            </div>
            <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              bash — {machine.name || machine.hostname} (IP: {publicIp})
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: "2px 8px", fontSize: "11px" }}
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Cambiar a modo una línea" : "Expandir a editor multilínea"}
            >
              {isExpanded ? "⤡ Modo Normal" : "⤢ Modo Script"}
            </button>
            <span className="badge badge-mono" style={{ fontSize: "10px" }}>EJECUCIÓN REMOTA</span>
          </div>
        </div>

        <div className="terminal-body">
          {/* Comandos rápidos sugeridos y copias de seguridad */}
          <div className="stat-label" style={{ marginBottom: 6 }}>Comandos sugeridos y Copias de Seguridad:</div>
          <div className="command-chips">
            {QUICK_COMMANDS.map((item) => (
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

          {/* Prompt de entrada de comandos (Modo Normal o Modo Multilínea Expandido) */}
          {!isExpanded ? (
            <div className="terminal-input-wrapper">
              <span className="terminal-prompt">$</span>
              <input
                type="text"
                className="terminal-input"
                placeholder="Escribe un comando Linux (ej. uptime, df -h, docker ps, tar -czvf backup.tar.gz /var/www)..."
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
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    title="Limpiar comando escrito"
                  >
                    🧹 Limpiar
                  </button>
                )}
                <button
                  onClick={() => handleSendCommand()}
                  className="btn btn-primary btn-sm"
                  disabled={sending || !linuxCommand.trim()}
                >
                  {sending ? "Ejecutando..." : "Ejecutar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="terminal-expanded-wrapper">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="mono text-muted" style={{ fontSize: "0.75rem" }}>
                  Editor de script bash (Presiona <strong>Ctrl + Enter</strong> para ejecutar):
                </span>
                {linuxCommand && (
                  <button
                    type="button"
                    onClick={handleClearCommand}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "2px 8px", fontSize: "11px" }}
                    title="Limpiar editor"
                  >
                    🧹 Limpiar
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
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cerrar Editor
                </button>
                <button
                  onClick={() => handleSendCommand()}
                  className="btn btn-primary btn-sm"
                  disabled={sending || !linuxCommand.trim()}
                >
                  {sending ? "Ejecutando script..." : "▶ Ejecutar Script"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historial de Ejecución */}
      <div style={{ marginTop: 24 }}>
        <div className="section-header" style={{ marginBottom: 12 }}>
          <div className="section-title">
            <h3 style={{ fontSize: "1.15rem" }}>Historial y Actividad de Comandos ({commands.length})</h3>
            <p className="section-subtitle">Flujo de comandos ejecutados y resultados en tiempo real</p>
          </div>
        </div>

        {commands.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "32px 16px" }}>
            <p className="mono text-muted">Aún no se han ejecutado comandos en este servidor.</p>
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
                  <span className="mono" style={{ fontWeight: 600, color: "#ffffff" }}>
                    $ {cmd.parameters}
                  </span>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: isCompleted ? "#12281c" : isFailed ? "#261114" : isRunning ? "#281e0e" : "#1c1c24",
                      color: isCompleted ? "#34d399" : isFailed ? "#f87171" : isRunning ? "#fbbf24" : "#a1a1aa",
                      border: `1px solid ${isCompleted ? "#1c4530" : isFailed ? "#4c1d24" : isRunning ? "#523c14" : "#2e2e38"}`,
                    }}
                  >
                    {statusLabels[cmd.status] || cmd.status}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="mono text-muted">{new Date(cmd.createdAt).toLocaleTimeString()}</span>
                  {cmd.result && (
                    <button
                      onClick={() => handleCopy(cmd.result, String(cmd.id))}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: "2px 8px", fontSize: "10px" }}
                    >
                      {copiedText === String(cmd.id) ? "Copiado" : "Copiar Salida"}
                    </button>
                  )}
                </div>
              </div>

              {cmd.result && (
                <div className="command-output mono">
                  {cmd.result}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
