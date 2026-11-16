import { useCallback, useEffect, useState } from "react";
import {
  createOracleBackup,
  deleteOracleBackup,
  discoverOracle,
  getOracleBackups,
  getOracleDatabases,
} from "../services/api";
import { signalRService } from "../services/signalr";
import type { OracleBackup, OracleDatabase } from "../types";
import { OracleBackupStatus } from "../types";
import { TableSkeleton } from "./Loading";
import { formatPyDateTime } from "../utils/datetime";

interface OraclePanelProps {
  machineId: string;
  hostname: string;
  isOnline: boolean;
}

const norm = (value: unknown) => String(value).toLowerCase();

const statusBadge = (status: string) => {
  const s = (status || "").toUpperCase();
  if (s === "OPEN") return <span className="badge badge-online">OPEN</span>;
  if (s === "MOUNTED") return <span className="badge badge-warning">MOUNTED</span>;
  if (s === "DOWN") return <span className="badge badge-offline">DOWN</span>;
  return <span className="badge badge-secondary">{status || "—"}</span>;
};

const backupBadge = (status: OracleBackupStatus) => {
  const s = norm(status);
  if (s === "completed" || s === "2") return <span className="badge badge-success">Completado</span>;
  if (s === "failed" || s === "3") return <span className="badge badge-danger">Fallido</span>;
  if (s === "running" || s === "1") {
    return (
      <span className="badge badge-info">
        <span className="spinner-small" style={{ width: 12, height: 12 }}></span>
        En curso
      </span>
    );
  }
  return (
    <span className="badge badge-warning">
      <span className="spinner-small" style={{ width: 12, height: 12 }}></span>
      En cola
    </span>
  );
};

export const OraclePanel = ({ machineId, hostname, isOnline }: OraclePanelProps) => {
  const [databases, setDatabases] = useState<OracleDatabase[]>([]);
  const [backups, setBackups] = useState<OracleBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [busySid, setBusySid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dbs, bks] = await Promise.all([
        getOracleDatabases(machineId),
        getOracleBackups(machineId),
      ]);
      setDatabases(dbs);
      setBackups(bks);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "No se pudo cargar la información de Oracle.");
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    signalRService.onOracleDatabasesUpdated((dbs) => {
      setDatabases((dbs || []).filter((d) => d.machineId === machineId));
    });

    signalRService.onOracleBackupCreated((backup) => {
      if (backup.machineId !== machineId) return;
      setBackups((prev) => [backup, ...prev.filter((b) => b.backupId !== backup.backupId)]);
    });

    signalRService.onOracleBackupUpdated((backup) => {
      if (backup.machineId !== machineId) return;
      setBackups((prev) => {
        const exists = prev.some((b) => b.backupId === backup.backupId);
        return exists
          ? prev.map((b) => (b.backupId === backup.backupId ? { ...b, ...backup } : b))
          : [backup, ...prev];
      });
    });

    signalRService.onOracleBackupDeleted((backupId) => {
      setBackups((prev) => prev.filter((b) => b.backupId !== backupId));
    });
  }, [machineId]);

  // Polling de respaldo mientras haya backups activos (no depende de SignalR)
  const hasActiveBackups = backups.some((b) => {
    const s = norm(b.status);
    return s === "pending" || s === "running" || s === "0" || s === "1";
  });

  useEffect(() => {
    if (!hasActiveBackups) return;

    const timer = setInterval(async () => {
      try {
        const list = await getOracleBackups(machineId);
        setBackups(list);
      } catch {
        // se reintenta en el próximo ciclo
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [hasActiveBackups, machineId]);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 6000);
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setError(null);
    try {
      const dbs = await discoverOracle(machineId);
      setDatabases(dbs);
      flashSuccess(
        dbs.length === 0
          ? "No se detectaron bases Oracle en el nodo."
          : `Se detectaron ${dbs.length} instancia(s) Oracle.`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Falló la búsqueda de bases Oracle.");
    } finally {
      setDiscovering(false);
    }
  };

  const handleBackup = async (sid?: string) => {
    setBusySid(sid ?? "__all__");
    setError(null);
    try {
      const created = await createOracleBackup(machineId, sid);
      setBackups((prev) => [
        ...created,
        ...prev.filter((p) => !created.some((c) => c.backupId === p.backupId)),
      ]);
      flashSuccess(
        created.length === 1
          ? `Backup de ${created[0].sid} iniciado en segundo plano.`
          : `${created.length} backups iniciados en segundo plano.`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "No se pudo iniciar el backup Oracle.");
    } finally {
      setBusySid(null);
    }
  };

  const handleDelete = async (backup: OracleBackup) => {
    if (!window.confirm(`¿Eliminar el backup «${backup.fileName}»?`)) return;
    try {
      await deleteOracleBackup(backup.backupId);
      setBackups((prev) => prev.filter((b) => b.backupId !== backup.backupId));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "No se pudo eliminar el backup.");
    }
  };

  const completed = backups.filter((b) => norm(b.status) === "completed" || (b.status as unknown) === 2).length;

  return (
    <div>
      <div className="page-head" style={{ alignItems: "center" }}>
        <div>
          <h3 className="page-title" style={{ fontSize: "1.15rem" }}>Bases de datos Oracle</h3>
          <p className="page-sub">
            {databases.length} instancia(s) detectada(s) · {completed} backup(s) disponible(s) · {hostname}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={load}
            disabled={loading || discovering}
          >
            Actualizar
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleDiscover}
            disabled={!isOnline || discovering}
            title="Buscar instancias Oracle instaladas en el nodo"
          >
            {discovering ? (
              <>
                <span className="spinner-small"></span>
                Buscando…
              </>
            ) : (
              "Buscar bases Oracle"
            )}
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="alert-box" style={{ marginBottom: 16 }}>
          <span>El nodo está fuera de línea. No se puede buscar ni ejecutar backups ahora.</span>
        </div>
      )}

      {error && (
        <div className="alert-box" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert-success" style={{ marginBottom: 16 }}>
          <span>{success}</span>
        </div>
      )}

      {/* Instancias detectadas */}
      <div className="explorer-table-wrapper" style={{ marginBottom: 24 }}>
        {loading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : databases.length === 0 ? (
          <div className="explorer-empty-state">
            <h4 style={{ margin: "0 0 4px", color: "var(--text-primary)" }}>Sin bases Oracle detectadas</h4>
            <p style={{ margin: 0, fontSize: "0.85rem", maxWidth: 460 }}>
              Ejecutá «Buscar bases Oracle» para inspeccionar <code className="mono">/etc/oratab</code> y los procesos
              <code className="mono"> ora_pmon_*</code> del nodo.
            </p>
          </div>
        ) : (
          <table className="explorer-table">
            <thead>
              <tr>
                <th style={{ width: "110px" }}>SID</th>
                <th style={{ width: "90px" }}>ESTADO</th>
                <th style={{ width: "110px" }}>VERSIÓN</th>
                <th>ORACLE_HOME</th>
                <th style={{ width: "110px" }}>USUARIO</th>
                <th style={{ width: "170px", textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {databases.map((d) => (
                <tr key={`${d.machineId}:${d.sid}`} className="explorer-row">
                  <td>
                    <span className="mono" style={{ fontWeight: 700 }}>{d.sid}</span>
                  </td>
                  <td>{statusBadge(d.status)}</td>
                  <td className="mono cell-size">{d.version || "—"}</td>
                  <td className="mono" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                    {d.oracleHome || "—"}
                  </td>
                  <td className="mono cell-size">{d.osUser || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleBackup(d.sid)}
                      disabled={!isOnline || busySid !== null || (d.status || "").toUpperCase() === "DOWN"}
                      title={
                        (d.status || "").toUpperCase() === "DOWN"
                          ? "La base está DOWN: arrancala antes de respaldar"
                          : "Ejecutar Data Pump full"
                      }
                    >
                      {busySid === d.sid ? (
                        <>
                          <span className="spinner-small"></span>
                          Enviando…
                        </>
                      ) : (
                        "Backup full"
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Backups */}
      <div className="page-head" style={{ alignItems: "center", marginBottom: 14 }}>
        <div>
          <h3 className="page-title" style={{ fontSize: "1.05rem" }}>Backups Oracle</h3>
          <p className="page-sub">Data Pump full → MinIO (bucket de copias de seguridad)</p>
        </div>

        {databases.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleBackup()}
            disabled={!isOnline || busySid !== null}
          >
            {busySid === "__all__" ? (
              <>
                <span className="spinner-small"></span>
                Iniciando…
              </>
            ) : (
              "Backup de todas"
            )}
          </button>
        )}
      </div>

      <div className="explorer-table-wrapper">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : backups.length === 0 ? (
          <div className="explorer-empty-state">
            <p style={{ margin: 0, fontSize: "0.85rem" }}>
              Todavía no hay backups Oracle. Detectá las bases y lanzá un «Backup full».
            </p>
          </div>
        ) : (
          <table className="explorer-table">
            <thead>
              <tr>
                <th>ARCHIVO</th>
                <th style={{ width: "100px" }}>SID</th>
                <th style={{ width: "150px" }}>ESTADO</th>
                <th style={{ width: "110px" }}>TAMAÑO</th>
                <th style={{ width: "170px" }}>FECHA</th>
                <th style={{ width: "130px", textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.backupId} className="explorer-row">
                  <td>
                    <span className="mono" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>{b.fileName}</span>
                    {b.errorMessage && (
                      <div style={{ fontSize: "0.72rem", color: "var(--color-offline)", marginTop: 4 }}>
                        {b.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="mono cell-size">{b.sid}</td>
                  <td>{backupBadge(b.status)}</td>
                  <td className="mono cell-size">{b.sizeFormatted || "—"}</td>
                  <td className="cell-date mono">{formatPyDateTime(b.createdAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row-actions">
                      {b.downloadUrl && (
                        <button
                          type="button"
                          className="icon-btn is-success"
                          title="Descargar backup"
                          aria-label="Descargar backup"
                          onClick={() => window.open(b.downloadUrl!, "_blank")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3v12"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <path d="M5 21h14"></path>
                          </svg>
                        </button>
                      )}

                      <button
                        type="button"
                        className="icon-btn is-danger"
                        title="Eliminar backup"
                        aria-label="Eliminar backup"
                        onClick={() => handleDelete(b)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
