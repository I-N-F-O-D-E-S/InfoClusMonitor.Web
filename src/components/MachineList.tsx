import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMachines } from "../services/api";
import { signalRService } from "../services/signalr";
import type { Machine } from "../types";
import { MachineStatus } from "../types";

const statusColors: Record<string, string> = {
  [MachineStatus.Online]: "#22c55e",
  [MachineStatus.Offline]: "#6b7280",
  [MachineStatus.Maintenance]: "#eab308",
  [MachineStatus.Error]: "#ef4444",
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

export default function MachineList() {
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    getMachines().then(setMachines);
    signalRService.connect().then(() => {
      signalRService.onMachineCreated((m) =>
        setMachines((prev) => [m, ...prev])
      );
      signalRService.onMachineUpdated((m) =>
        setMachines((prev) => prev.map((x) => (x.id === m.id ? m : x)))
      );
      signalRService.onMachineDeleted((id) =>
        setMachines((prev) => prev.filter((x) => x.id !== id))
      );
    });
    return () => signalRService.disconnect();
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Machines ({machines.length})</h2>
      </div>

      <div className="grid">
        {machines.map((m) => (
          <Link to={`/machines/${m.id}`} key={m.id} className="card machine-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>{m.hostname || m.name}</h3>
              <span className="badge" style={{ backgroundColor: statusColors[m.status] }}>
                {m.status}
              </span>
            </div>
            <div className="info-row">
              <span>{m.ipAddress}</span>
              <span>{m.os}</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <span className="badge" style={{ background: "#6366f1" }}>CPU {m.cpuPercent}%</span>
              <span className="badge" style={{ background: "#8b5cf6" }}>RAM {m.memoryPercent}%</span>
              <span className="badge" style={{ background: "#ec4899" }}>DISK {m.diskPercent}%</span>
            </div>

            <div className="info-row" style={{ marginTop: 8 }}>
              <span className="text-muted">{formatUptime(m.uptime)} up</span>
              <span className="text-muted">{new Date(m.lastHeartbeat).toLocaleString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
