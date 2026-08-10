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

export default function MachineList() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [isLoading, setIsLoading] = useState(true);

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

  // Servidores filtrados
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
        (statusFilter === "DESCONECTADOS" && !online);

      return matchSearch && matchStatus;
    });
  }, [machines, search, statusFilter]);

  // Estadísticas agregadas
  const onlineCount = machines.filter((m) => isMachineOnline(m)).length;
  const avgCpu = machines.length
    ? (machines.reduce((acc, m) => acc + (m.cpuPercent || 0), 0) / machines.length).toFixed(1)
    : "0";
  const avgRam = machines.length
    ? (machines.reduce((acc, m) => acc + (m.memoryPercent || 0), 0) / machines.length).toFixed(1)
    : "0";

  return (
    <div>
      {/* Encabezado de página */}
      <div className="section-header">
        <div className="section-title">
          <h2>Servidores y Nodos Linux</h2>
          <p className="section-subtitle">Telemetría en tiempo real y orquestación remota de nodos</p>
        </div>
      </div>

      {/* Barra de métricas generales del cluster */}
      <div className="cluster-stats-bar">
        <div className="stat-box">
          <div className="stat-label">Total de Nodos</div>
          <div className="stat-value">{machines.length}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Activos en Línea</div>
          <div className="stat-value" style={{ color: "#34d399" }}>{onlineCount}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Uso de CPU Cluster</div>
          <div className="stat-value">{avgCpu}%</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Uso de RAM Cluster</div>
          <div className="stat-value">{avgRam}%</div>
        </div>
      </div>

      {/* Barra de herramientas y filtros */}
      <div className="toolbar">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input mono"
            placeholder="Buscar por nombre, hostname, IP pública/privada, SO o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {(["TODOS", "EN LÍNEA", "DESCONECTADOS"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`btn btn-sm ${statusFilter === filter ? "btn-primary" : "btn-secondary"}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Estado de carga */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div className="auth-spinner" style={{ margin: "0 auto 16px" }}></div>
          <p className="mono text-muted">Consultando nodos del cluster...</p>
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && filteredMachines.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="brand-logo" style={{ margin: "0 auto 16px", width: 48, height: 48, fontSize: 22 }}>IC</div>
          <h3 style={{ color: "#ffffff", marginBottom: 6 }}>No se encontraron servidores</h3>
          <p className="text-muted" style={{ maxWidth: 460, margin: "0 auto 16px" }}>
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

      {/* LISTADO EN FORMATO TABLA (LIST VIEW) */}
      {!isLoading && filteredMachines.length > 0 && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ESTADO</th>
                <th>NOMBRE / HOSTNAME</th>
                <th>IP PÚBLICA</th>
                <th>IP PRIVADA</th>
                <th>SISTEMA</th>
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
                        <span className={`pulse-dot ${online ? "" : "disconnected"}`} style={{ width: 6, height: 6 }}></span>
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
                          <div className="mono text-muted" style={{ fontSize: "0.75rem" }}>
                            {m.hostname}
                          </div>
                        )}
                      </Link>
                    </td>

                    {/* IP Pública */}
                    <td>
                      <span className="mono" style={{ color: "#38bdf8", fontSize: "0.85rem", fontWeight: 500 }}>
                        {publicIp}
                      </span>
                    </td>

                    {/* IP Privada */}
                    <td>
                      <span className="mono text-muted" style={{ fontSize: "0.85rem" }}>
                        {privateIp}
                      </span>
                    </td>

                    {/* Sistema Operativo */}
                    <td>
                      <span className="badge badge-mono" style={{ fontSize: "11px" }}>
                        {m.os || "Linux"}
                      </span>
                    </td>

                    {/* CPU */}
                    <td>
                      <div className="mini-bar-wrapper">
                        <span className="mono" style={{ fontSize: "0.8rem", width: 42 }}>
                          {m.cpuPercent?.toFixed(1) || 0}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, m.cpuPercent || 0))}%`,
                              background: (m.cpuPercent || 0) > 85 ? "#ef4444" : "#ffffff",
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* RAM */}
                    <td>
                      <div className="mini-bar-wrapper">
                        <span className="mono" style={{ fontSize: "0.8rem", width: 42 }}>
                          {m.memoryPercent?.toFixed(1) || 0}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, m.memoryPercent || 0))}%`,
                              background: (m.memoryPercent || 0) > 85 ? "#ef4444" : "#ffffff",
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Disco */}
                    <td>
                      <div className="mini-bar-wrapper">
                        <span className="mono" style={{ fontSize: "0.8rem", width: 42 }}>
                          {m.diskPercent?.toFixed(1) || 0}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, m.diskPercent || 0))}%`,
                              background: (m.diskPercent || 0) > 90 ? "#ef4444" : "#ffffff",
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
                      <Link to={`/machines/${targetId}`} className="btn btn-secondary btn-sm" style={{ padding: "4px 10px", fontSize: "11px" }}>
                        Terminal &gt;
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
