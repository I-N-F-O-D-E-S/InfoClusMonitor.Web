import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMachine, deleteMachine, createCommand } from "../services/api";
import { signalRService } from "../services/signalr";
import type { Machine, Command } from "../types";
import { MachineStatus, CommandStatus } from "../types";

const statusColors: Record<string, string> = {
  [MachineStatus.Online]: "#22c55e",
  [MachineStatus.Offline]: "#6b7280",
  [MachineStatus.Maintenance]: "#eab308",
  [MachineStatus.Error]: "#ef4444",
};

const commandStatusColors: Record<string, string> = {
  [CommandStatus.Pending]: "#8b5cf6",
  [CommandStatus.Sent]: "#3b82f6",
  [CommandStatus.Running]: "#f59e0b",
  [CommandStatus.Completed]: "#22c55e",
  [CommandStatus.Failed]: "#ef4444",
};

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "N/A";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function MachineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [linuxCommand, setLinuxCommand] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMachine(id).then(setMachine);
    signalRService.connect().then(() => {
      signalRService.subscribeToMachine(id);
      signalRService.onMachineUpdated((m) => {
        if (m.id === id) setMachine((prev) => ({ ...prev!, ...m, commands: prev?.commands }));
      });
      signalRService.onCommandCreated((cmd) => {
        if (cmd.machineId === id)
          setMachine((prev) =>
            prev ? { ...prev, commands: [cmd, ...(prev.commands || [])] } : prev
          );
      });
      signalRService.onCommandUpdated((cmd) => {
        if (cmd.machineId === id)
          setMachine((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              commands: (prev.commands || []).map((c) =>
                c.id === cmd.id ? cmd : c
              ),
            };
          });
      });
    });
    return () => {
      if (id) signalRService.unsubscribeFromMachine(id);
      signalRService.disconnect();
    };
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    await deleteMachine(id);
    navigate("/");
  };

  const handleSendCommand = async () => {
    if (!id || !linuxCommand.trim()) return;
    setSending(true);
    try {
      await createCommand({ machineId: id, parameters: linuxCommand.trim() });
      setLinuxCommand("");
    } finally {
      setSending(false);
    }
  };

  if (!machine) return <div className="card">Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => navigate("/")} className="btn-secondary">
          &larr; Back
        </button>
        <button onClick={() => setShowDelete(!showDelete)} className="btn-danger">
          Delete
        </button>
      </div>

      {showDelete && (
        <div className="card" style={{ borderColor: "#ef4444", marginBottom: 16 }}>
          <p>Delete machine {machine.hostname}?</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleDelete} className="btn-danger">Confirm</button>
            <button onClick={() => setShowDelete(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>{machine.hostname || machine.name}</h2>
          <span className="badge" style={{ backgroundColor: statusColors[machine.status] }}>
            {machine.status}
          </span>
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          <div><strong>ID:</strong> <code style={{ fontSize: 11 }}>{machine.id}</code></div>
          <div><strong>IP:</strong> {machine.ipAddress}</div>
          <div><strong>OS:</strong> {machine.os}</div>
          <div><strong>Agent:</strong> {machine.agentVersion || "N/A"}</div>
          <div><strong>Uptime:</strong> {formatUptime(machine.uptime)}</div>
          <div><strong>Last Heartbeat:</strong> {new Date(machine.lastHeartbeat).toLocaleString()}</div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div className="card" style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 24, color: "#6366f1" }}>{machine.cpuPercent}%</div>
            <div className="text-muted">CPU</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 24, color: "#8b5cf6" }}>{machine.memoryPercent}%</div>
            <div className="text-muted">RAM</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 24, color: "#ec4899" }}>{machine.diskPercent}%</div>
            <div className="text-muted">DISK</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Send Linux Command</h3>
        <textarea
          placeholder="apt update && apt upgrade -y"
          value={linuxCommand}
          onChange={(e) => setLinuxCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendCommand();
            }
          }}
          style={{
            width: "100%",
            minHeight: 60,
            background: "#0f0f1a",
            border: "1px solid #2a2a3e",
            color: "#e0e0e0",
            padding: "8px 12px",
            borderRadius: 8,
            fontFamily: "monospace",
            fontSize: 14,
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <button
            onClick={handleSendCommand}
            className="btn-primary"
            disabled={sending || !linuxCommand.trim() || machine.status !== MachineStatus.Online}
          >
            {sending ? "Sending..." : "Execute"}
          </button>
          {machine.status !== MachineStatus.Online && (
            <span className="text-muted">Machine is offline</span>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Command History</h3>
        {(!machine.commands || machine.commands.length === 0) && (
          <p className="text-muted">No commands sent yet</p>
        )}
        {machine.commands?.map((cmd) => (
          <div key={cmd.id} className="command-row">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div>
                <code style={{ fontSize: 12, wordBreak: "break-all" }}>{cmd.parameters}</code>
                <span
                  className="badge"
                  style={{ backgroundColor: commandStatusColors[cmd.status], marginLeft: 8 }}
                >
                  {cmd.status}
                </span>
              </div>
              <span className="text-muted">{new Date(cmd.createdAt).toLocaleString()}</span>
            </div>
            {cmd.result && (
              <pre style={{ background: "#1e1e2e", padding: 8, borderRadius: 4, marginTop: 8, fontSize: 12, maxHeight: 300, overflowY: "auto" }}>
                {cmd.result}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
