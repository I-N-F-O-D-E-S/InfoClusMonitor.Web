import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { getMachines } from "../services/api";
import { signalRService } from "../services/signalr";
import type { Machine } from "../types";
import { MachineStatus } from "../types";

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

function getProgressColor(percent: number): string {
  if (percent >= 85) return "#ef4444";
  if (percent >= 65) return "#f59e0b";
  return "#38bdf8";
}

export default function MachineList() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [isLoading, setIsLoading] = useState(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getMachines()
      .then((data) => {
        if (isMounted) {
          setMachines(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error al cargar los servidores:", err);
        if (isMounted) setIsLoading(false);
      });

    signalRService.connect().then(() => {
      signalRService.onMachineCreated((m) => {
        setMachines((prev) => {
          const exists = prev.some((x) => x.id === m.id || (x.externalMachineId && x.externalMachineId === m.externalMachineId));
          return exists ? prev.map((x) => (x.id === m.id || x.externalMachineId === m.externalMachineId ? m : x)) : [m, ...prev];
        });
      });

      signalRService.onMachineUpdated((m) => {
        setMachines((prev) => {
          const exists = prev.some((x) => x.id === m.id || (x.externalMachineId && x.externalMachineId === m.externalMachineId));
          return exists ? prev.map((x) => (x.id === m.id || x.externalMachineId === m.externalMachineId ? m : x)) : [m, ...prev];
        });
      });

      signalRService.onMachineDeleted((delId) => {
        setMachines((prev) => prev.filter((x) => x.externalMachineId !== delId && String(x.id) !== delId));
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyIp = (ip: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1800);
  };

  // Filtrado reactivo
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const matchSearch =
        m.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.hostname?.toLowerCase().includes(search.toLowerCase()) ||
        m.ipAddress?.includes(search) ||
        m.publicIpAddress?.includes(search) ||
        m.privateIpAddress?.includes(search) ||
        m.externalMachineId?.toLowerCase().includes(search.toLowerCase()) ||
        String(m.id).includes(search) ||
        m.os?.toLowerCase().includes(search.toLowerCase());

      const online = isMachineOnline(m);
      const matchStatus =
        statusFilter === "TODOS" ||
        (statusFilter === "EN LÍNEA" && online) ||
        (statusFilter === "OFFLINE" && !online);

      return matchSearch && matchStatus;
    });
  }, [machines, search, statusFilter]);

  // Métricas agregadas
  const onlineCount = machines.filter((m) => isMachineOnline(m)).length;
  const offlineCount = machines.length - onlineCount;
  const avgCpu = machines.length
    ? (machines.reduce((acc, m) => acc + (m.cpuPercent || 0), 0) / machines.length).toFixed(1)
    : "0";
  const avgRam = machines.length
    ? (machines.reduce((acc, m) => acc + (m.memoryPercent || 0), 0) / machines.length).toFixed(1)
    : "0";

  return (
    <div>
      {/* Encabezado Principal */}
      <div className="section-header">
        <div className="section-title">
          <h2>Servidores y Nodos Cloud</h2>
          <p className="section-subtitle">Supervisión centralizada, telemetría y ejecución remota en tiempo real</p>
        </div>
      </div>

      {/* Tarjetas de Métricas Globales del Cluster */}
      <div className="cluster-stats-bar">
        <div className="stat-box">
          <div className="stat-label">Total de Nodos</div>
          <div className="stat-value">{machines.length}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Nodos en Línea</div>
          <div className="stat-value" style={{ color: "#10b981" }}>{onlineCount}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Carga CPU Promedio</div>
          <div className="stat-value" style={{ color: Number(avgCpu) > 80 ? "#ef4444" : "#ffffff" }}>{avgCpu}%</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Memoria RAM Global</div>
          <div className="stat-value" style={{ color: Number(avgRam) > 85 ? "#ef4444" : "#ffffff" }}>{avgRam}%</div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="toolbar">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input mono"
            placeholder="Buscar por nombre, hostname, IP, SO o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setStatusFilter("TODOS")}
            className={`btn btn-sm ${statusFilter === "TODOS" ? "btn-primary" : "btn-secondary"}`}
          >
            Todos ({machines.length})
          </button>
          <button
            onClick={() => setStatusFilter("EN LÍNEA")}
            className={`btn btn-sm ${statusFilter === "EN LÍNEA" ? "btn-primary" : "btn-secondary"}`}
          >
            <span className="pulse-dot" style={{ width: 6, height: 6 }}></span>
            En Línea ({onlineCount})
          </button>
          <button
            onClick={() => setStatusFilter("OFFLINE")}
            className={`btn btn-sm ${statusFilter === "OFFLINE" ? "btn-primary" : "btn-secondary"}`}
          >
            <span className="pulse-dot disconnected" style={{ width: 6, height: 6 }}></span>
            Offline ({offlineCount})
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div className="auth-spinner" style={{ margin: "0 auto 16px" }}></div>
          <p className="mono text-muted">Sincronizando nodos del cluster...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredMachines.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "56px 24px" }}>
          <div className="brand-icon-wrapper" style={{ margin: "0 auto 16px", width: 52, height: 52 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
            </svg>
          </div>
          <h3 style={{ color: "#ffffff", marginBottom: 8, fontSize: "1.2rem" }}>No se encontraron servidores</h3>
          <p className="text-muted" style={{ maxWidth: 480, margin: "0 auto 20px", fontSize: "0.9rem" }}>
            {search || statusFilter !== "TODOS"
              ? "No hay servidores que coincidan con los filtros de búsqueda aplicados."
              : "Ejecuta el instalador del agente en cualquier servidor Linux para conectarlo automáticamente al cluster."}
          </p>
          {(search || statusFilter !== "TODOS") && (
            <button onClick={() => { setSearch(""); setStatusFilter("TODOS"); }} className="btn btn-secondary btn-sm">
              Restablecer filtros
            </button>
          )}
        </div>
      )}

      {/* TABLA DE SERVIDORES (HIGH-DENSITY LIST VIEW) */}
      {!isLoading && filteredMachines.length > 0 && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ESTADO</th>
                <th>SERVIDOR / NODO</th>
                <th>IP PÚBLICA</th>
                <th>IP PRIVADA</th>
                <th>SISTEMA OPERATIVO</th>
                <th>CPU</th>
                <th>RAM</th>
                <th>DISCO</th>
                <th>UPTIME</th>
                <th style={{ textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredMachines.map((m) => {
                const online = isMachineOnline(m);
                const targetId = m.externalMachineId || String(m.id);
                const publicIp = m.publicIpAddress || m.ipAddress || "N/A";
                const privateIp = m.privateIpAddress || m.ipAddress || "127.0.0.1";

                return (
                  <tr key={m.id || m.externalMachineId}>
                    {/* Estado */}
                    <td>
                      <span className={`badge ${online ? "badge-online" : "badge-offline"}`}>
                        <span className={`pulse-dot ${online ? "" : "disconnected"}`}></span>
                        {online ? "EN LÍNEA" : "OFFLINE"}
                      </span>
                    </td>

                    {/* Nombre y Hostname */}
                    <td>
                      <Link to={`/machines/${targetId}`} style={{ textDecoration: "none" }}>
                        <div style={{ fontWeight: 600, color: "#ffffff", fontSize: "0.95rem" }}>
                          {m.name || m.hostname}
                        </div>
                        {m.name && m.name !== m.hostname && (
                          <div className="mono text-muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                            {m.hostname}
                          </div>
                        )}
                      </Link>
                    </td>

                    {/* IP Pública */}
                    <td>
                      <span
                        className="mono"
                        onClick={(e) => handleCopyIp(publicIp, e)}
                        title="Clic para copiar IP pública"
                        style={{
                          color: "#38bdf8",
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span>{publicIp}</span>
                        <span className="badge badge-mono" style={{ fontSize: "8px", padding: "1px 4px" }}>
                          {copiedIp === publicIp ? "✓" : "COPY"}
                        </span>
                      </span>
                    </td>

                    {/* IP Privada */}
                    <td>
                      <span
                        className="mono text-muted"
                        onClick={(e) => handleCopyIp(privateIp, e)}
                        title="Clic para copiar IP privada"
                        style={{
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span>{privateIp}</span>
                        <span className="badge badge-mono" style={{ fontSize: "8px", padding: "1px 4px" }}>
                          {copiedIp === privateIp ? "✓" : "COPY"}
                        </span>
                      </span>
                    </td>

                    {/* Sistema Operativo */}
                    <td>
                      <span className="badge badge-mono" style={{ fontSize: "11px" }}>
                        {m.os || "Linux"}
                      </span>
                    </td>

                    {/* CPU Meter */}
                    <td>
                      <div className="mini-bar-wrapper">
                        <span className="mono" style={{ fontSize: "0.8rem", width: 44, fontWeight: 600 }}>
                          {m.cpuPercent?.toFixed(1) || 0}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, m.cpuPercent || 0))}%`,
                              background: getProgressColor(m.cpuPercent || 0),
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* RAM Meter */}
                    <td>
                      <div className="mini-bar-wrapper">
                        <span className="mono" style={{ fontSize: "0.8rem", width: 44, fontWeight: 600 }}>
                          {m.memoryPercent?.toFixed(1) || 0}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, m.memoryPercent || 0))}%`,
                              background: getProgressColor(m.memoryPercent || 0),
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Disco Meter */}
                    <td>
                      <div className="mini-bar-wrapper">
                        <span className="mono" style={{ fontSize: "0.8rem", width: 44, fontWeight: 600 }}>
                          {m.diskPercent?.toFixed(1) || 0}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, m.diskPercent || 0))}%`,
                              background: getProgressColor(m.diskPercent || 0),
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Uptime */}
                    <td>
                      <span className="mono text-muted" style={{ fontSize: "0.8rem" }}>
                        {formatUptime(m.uptime)}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td style={{ textAlign: "right" }}>
                      <Link
                        to={`/machines/${targetId}`}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "5px 12px", fontSize: "12px", gap: 4 }}
                      >
                        <span>Terminal</span>
                        <span>&gt;</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
