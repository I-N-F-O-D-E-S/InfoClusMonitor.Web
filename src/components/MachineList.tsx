import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { getMachines } from "../services/api";
import { signalRService } from "../services/signalr";
import { AgentUpdateModal } from "./AgentUpdateModal";
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

export default function MachineList() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [isLoading, setIsLoading] = useState(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [updateModalTarget, setUpdateModalTarget] = useState<Machine | null | undefined>(undefined);

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
    ? Number((machines.reduce((acc, m) => acc + (m.cpuPercent || 0), 0) / machines.length).toFixed(1))
    : 0;
  const avgRam = machines.length
    ? Number((machines.reduce((acc, m) => acc + (m.memoryPercent || 0), 0) / machines.length).toFixed(1))
    : 0;

  return (
    <div>
      {/* Encabezado */}
      <div className="page-head">
        <div>
          <h2 className="page-title">Nodos</h2>
          <p className="page-sub">
            {machines.length} {machines.length === 1 ? "servidor" : "servidores"} ·{" "}
            <span className={onlineCount > 0 ? "text-online" : ""}>{onlineCount} en línea</span>
            {offlineCount > 0 && (
              <>
                {" · "}
                <span className="text-offline">{offlineCount} offline</span>
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setUpdateModalTarget(null)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Instalar agente
        </button>
      </div>

      {/* Telemetría del cluster */}
      <div className="cluster-panel">
        <div className="cluster-cell">
          <span className="cluster-cell-label">Total</span>
          <span className="cluster-cell-value">{machines.length}</span>
        </div>
        <div className="cluster-cell">
          <span className="cluster-cell-label">En línea</span>
          <span className="cluster-cell-value is-online">{onlineCount}</span>
        </div>
        <div className="cluster-cell">
          <span className="cluster-cell-label">CPU promedio</span>
          <span className={`cluster-cell-value ${avgCpu > 80 ? "is-critical" : ""}`}>{avgCpu}%</span>
        </div>
        <div className="cluster-cell">
          <span className="cluster-cell-label">RAM promedio</span>
          <span className={`cluster-cell-value ${avgRam > 85 ? "is-critical" : ""}`}>{avgRam}%</span>
        </div>
      </div>

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
            placeholder="Buscar por nombre, hostname, IP, SO o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="segmented" role="group" aria-label="Filtrar por estado">
          <button
            type="button"
            className={`segment ${statusFilter === "TODOS" ? "active" : ""}`}
            onClick={() => setStatusFilter("TODOS")}
          >
            Todos <span className="segment-count">{machines.length}</span>
          </button>
          <button
            type="button"
            className={`segment ${statusFilter === "EN LÍNEA" ? "active" : ""}`}
            onClick={() => setStatusFilter("EN LÍNEA")}
          >
            En línea <span className="segment-count">{onlineCount}</span>
          </button>
          <button
            type="button"
            className={`segment ${statusFilter === "OFFLINE" ? "active" : ""}`}
            onClick={() => setStatusFilter("OFFLINE")}
          >
            Offline <span className="segment-count">{offlineCount}</span>
          </button>
        </div>
      </div>

      {/* Cargando */}
      {isLoading && (
        <div className="state-block">
          <div className="auth-spinner"></div>
          <p className="mono text-muted">Sincronizando nodos del clúster…</p>
        </div>
      )}

      {/* Vacío */}
      {!isLoading && filteredMachines.length === 0 && (
        <div className="card state-block" style={{ padding: "56px 24px" }}>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
            </svg>
          </div>
          <h3 style={{ color: "#ffffff", fontSize: "1.15rem", fontWeight: 700 }}>
            {search || statusFilter !== "TODOS" ? "Ningún servidor coincide" : "Todavía no hay nodos"}
          </h3>
          <p className="text-muted" style={{ maxWidth: 420, fontSize: "0.9rem" }}>
            {search || statusFilter !== "TODOS"
              ? "Ajusta la búsqueda o el filtro de estado para ver otros nodos."
              : "Instala el agente en cualquier servidor Linux y aparecerá aquí automáticamente."}
          </p>
          {(search || statusFilter !== "TODOS") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("TODOS");
              }}
              className="btn btn-secondary btn-sm"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      )}

      {/* Tabla */}
      {!isLoading && filteredMachines.length > 0 && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ESTADO</th>
                <th>SERVIDOR</th>
                <th>IP PÚBLICA</th>
                <th>IP PRIVADA</th>
                <th>SO</th>
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
                const cpu = m.cpuPercent || 0;
                const ram = m.memoryPercent || 0;
                const disk = m.diskPercent || 0;

                return (
                  <tr key={m.id || m.externalMachineId}>
                    {/* Estado */}
                    <td>
                      <span className={`badge ${online ? "badge-online" : "badge-offline"}`}>
                        <span className={`pulse-dot ${online ? "" : "disconnected"}`}></span>
                        {online ? "EN LÍNEA" : "OFFLINE"}
                      </span>
                    </td>

                    {/* Nombre y hostname */}
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

                    {/* IP pública */}
                    <td>
                      <button
                        type="button"
                        className="ip-cell is-public"
                        onClick={(e) => handleCopyIp(publicIp, e)}
                        title="Copiar IP pública"
                      >
                        <span>{publicIp}</span>
                        <span className={`ip-copy ${copiedIp === publicIp ? "copied" : ""}`}>
                          {copiedIp === publicIp ? <CheckIcon /> : <CopyIcon />}
                        </span>
                      </button>
                    </td>

                    {/* IP privada */}
                    <td>
                      <button
                        type="button"
                        className="ip-cell"
                        onClick={(e) => handleCopyIp(privateIp, e)}
                        title="Copiar IP privada"
                      >
                        <span>{privateIp}</span>
                        <span className={`ip-copy ${copiedIp === privateIp ? "copied" : ""}`}>
                          {copiedIp === privateIp ? <CheckIcon /> : <CopyIcon />}
                        </span>
                      </button>
                    </td>

                    {/* Sistema operativo */}
                    <td>
                      <span className="badge badge-mono" style={{ fontSize: "11px" }}>
                        {m.os || "Linux"}
                      </span>
                    </td>

                    {/* CPU */}
                    <td>
                      <div className="mini-bar-wrapper">
                        <span className="mono" style={{ fontSize: "0.8rem", width: 44, fontWeight: 600 }}>
                          {cpu.toFixed(1)}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{ width: `${Math.min(100, Math.max(0, cpu))}%`, background: getProgressColor(cpu) }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* RAM */}
                    <td>
                      <div className="mini-bar-wrapper">
                        <span className="mono" style={{ fontSize: "0.8rem", width: 44, fontWeight: 600 }}>
                          {ram.toFixed(1)}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{ width: `${Math.min(100, Math.max(0, ram))}%`, background: getProgressColor(ram) }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Disco */}
                    <td>
                      <div className="mini-bar-wrapper">
                        <span className="mono" style={{ fontSize: "0.8rem", width: 44, fontWeight: 600 }}>
                          {disk.toFixed(1)}%
                        </span>
                        <div className="mini-bar-bg">
                          <div
                            className="mini-bar-fill"
                            style={{ width: `${Math.min(100, Math.max(0, disk))}%`, background: getProgressColor(disk) }}
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
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUpdateModalTarget(m);
                          }}
                          title={`Actualizar el agente en ${m.hostname}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 2v6h-6"></path>
                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                            <path d="M3 22v-6h6"></path>
                            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                          </svg>
                          Actualizar
                        </button>
                        <Link
                          to={`/machines/${targetId}`}
                          className="btn btn-secondary btn-sm"
                        >
                          Terminal
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de actualización de agente */}
      {updateModalTarget !== undefined && (
        <AgentUpdateModal
          isOpen={updateModalTarget !== undefined}
          onClose={() => setUpdateModalTarget(undefined)}
          targetMachine={updateModalTarget}
        />
      )}
    </div>
  );
}
