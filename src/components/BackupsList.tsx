import React, { useEffect, useState, useMemo } from "react";
import { getBackups, deleteBackup } from "../services/api";
import { signalRService } from "../services/signalr";
import type { BackupRecord } from "../types";
import { BackupModal } from "./BackupModal";
import { RestoreBackupModal } from "./RestoreBackupModal";

interface BackupsListProps {
  machineId?: string;
  showHeader?: boolean;
}

const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: spinning ? "spin 0.8s linear infinite" : undefined }}
  >
    <path d="M21 2v6h-6"></path>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
    <path d="M3 22v-6h6"></path>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
  </svg>
);

const RestoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5"></path>
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <path d="M5 21h14"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

export const BackupsList: React.FC<BackupsListProps> = ({ machineId, showHeader = true }) => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [restoreModalBackup, setRestoreModalBackup] = useState<BackupRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBackups(machineId);
      setBackups(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al cargar copias de seguridad.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [machineId]);

  // Suscribir eventos SignalR en tiempo real
  useEffect(() => {
    const handleCreated = (backup: BackupRecord) => {
      if (!machineId || backup.machineId === machineId) {
        setBackups((prev) => [backup, ...prev.filter((b) => b.backupId !== backup.backupId)]);
      }
    };

    const handleUpdated = (backup: BackupRecord) => {
      if (!machineId || backup.machineId === machineId) {
        setBackups((prev) =>
          prev.map((b) => (b.backupId === backup.backupId ? { ...b, ...backup } : b))
        );
      }
    };

    const handleDeleted = (deletedId: string) => {
      setBackups((prev) => prev.filter((b) => b.backupId !== deletedId));
    };

    signalRService.onBackupCreated(handleCreated);
    signalRService.onBackupUpdated(handleUpdated);
    signalRService.onBackupDeleted(handleDeleted);
  }, [machineId]);

  const handleDelete = async (backupId: string, fileName: string) => {
    if (!window.confirm(`¿Eliminar permanentemente la copia «${fileName}»?`)) {
      return;
    }

    setDeletingId(backupId);
    try {
      await deleteBackup(backupId);
      setBackups((prev) => prev.filter((b) => b.backupId !== backupId));
    } catch (err: any) {
      alert("Error al eliminar la copia de seguridad: " + (err.response?.data?.error || err.message));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (backup: BackupRecord) => {
    if (!backup.downloadUrl) {
      alert("La URL de descarga no está disponible aún. Intenta recargar la página.");
      return;
    }
    const link = document.createElement("a");
    link.href = backup.downloadUrl;
    link.download = backup.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredBackups = useMemo(() => {
    return backups.filter((b) =>
      b.fileName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      b.hostname.toLowerCase().includes(searchFilter.toLowerCase()) ||
      b.sourcePath.toLowerCase().includes(searchFilter.toLowerCase()) ||
      b.customName.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [backups, searchFilter]);

  const completedCount = backups.filter(
    (b) => String(b.status).toLowerCase() === "completed" || b.status === 3
  ).length;

  const renderStatusBadge = (status: any, errorMsg?: string) => {
    const s = String(status).toLowerCase();
    if (s === "pending" || s === "0") {
      return (
        <span className="badge badge-info">
          <span className="spinner-small" style={{ width: 12, height: 12 }}></span>
          En cola
        </span>
      );
    }
    if (s === "compressing" || s === "1" || s === "uploading" || s === "2") {
      return (
        <span className="badge badge-info" style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8" }}>
          <span
            className="spinner-small"
            style={{ width: 12, height: 12, borderColor: "rgba(56, 189, 248, 0.3)", borderTopColor: "#38bdf8" }}
          ></span>
          Procesando
        </span>
      );
    }
    if (s === "completed" || s === "3") {
      return <span className="badge badge-success">Completado</span>;
    }
    return (
      <span className="badge badge-danger" title={errorMsg || "Error en copia"}>
        Fallido
      </span>
    );
  };

  return (
    <div>
      {showHeader && (
        <div className="page-head">
          <div>
            <h2 className="page-title">Copias de seguridad</h2>
            <p className="page-sub">
              {completedCount} {completedCount === 1 ? "respaldo disponible" : "respaldos disponibles"} · formato{" "}
              <code className="mono">{"{FECHA}_{NOMBRE}.tar.gz"}</code>
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={fetchBackups} className="btn btn-secondary btn-sm" disabled={loading}>
              <RefreshIcon spinning={loading} />
              Actualizar
            </button>

            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nueva copia
            </button>
          </div>
        </div>
      )}

      {/* Alerta de error */}
      {error && (
        <div className="alert-box" style={{ marginBottom: 16 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>{error}</span>
        </div>
      )}

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
            placeholder="Buscar por archivo, servidor o ruta..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <span className="badge badge-mono">{filteredBackups.length} copias</span>
      </div>

      {/* Tabla */}
      <div className="explorer-table-wrapper">
        {loading ? (
          <div className="explorer-loading-state">
            <div className="auth-spinner"></div>
            <p>Cargando copias de seguridad…</p>
          </div>
        ) : filteredBackups.length === 0 ? (
          <div className="explorer-empty-state">
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="8.5" ry="3"></ellipse>
                <path d="M3.5 5v14c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3V5"></path>
                <path d="M3.5 12c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3"></path>
              </svg>
            </div>
            <h4 style={{ color: "#f8fafc", margin: "6px 0 2px", fontWeight: 700 }}>
              {searchFilter ? "Ninguna copia coincide" : "Todavía no hay copias de seguridad"}
            </h4>
            <p style={{ color: "#64748b", margin: 0, fontSize: "0.85rem", maxWidth: 420 }}>
              {searchFilter
                ? "Prueba con otro nombre de archivo, servidor o ruta."
                : "Crea la primera copia para respaldar una ruta de tus servidores."}
            </p>
            {!searchFilter && (
              <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Crear copia
              </button>
            )}
          </div>
        ) : (
          <table className="explorer-table">
            <thead>
              <tr>
                <th>ARCHIVO</th>
                <th>SERVIDOR</th>
                <th>RUTA RESPALDADA</th>
                <th style={{ width: "120px" }}>TAMAÑO</th>
                <th style={{ width: "200px" }}>ESTADO</th>
                <th style={{ width: "170px" }}>FECHA</th>
                <th style={{ width: "150px", textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredBackups.map((b) => {
                const isCompleted = String(b.status).toLowerCase() === "completed" || b.status === 3;
                const isDeleting = deletingId === b.backupId;

                return (
                  <tr key={b.backupId} className="explorer-row">
                    {/* Archivo */}
                    <td>
                      <div className="cell-name">
                        <span className="file-icon" aria-hidden="true">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </span>
                        <div>
                          <span className="file-name-text" style={{ fontWeight: 600, color: "#f8fafc" }}>
                            {b.fileName}
                          </span>
                          {b.customName && (
                            <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                              {b.customName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Servidor */}
                    <td>
                      <span className="badge badge-mono">{b.hostname}</span>
                    </td>

                    {/* Ruta */}
                    <td>
                      <code className="mono" style={{ fontSize: "0.78rem", color: "#7dd3fc" }}>
                        {b.sourcePath}
                      </code>
                    </td>

                    {/* Tamaño */}
                    <td className="cell-size mono">{b.sizeFormatted || "—"}</td>

                    {/* Estado */}
                    <td>
                      {renderStatusBadge(b.status, b.errorMessage)}
                      {b.errorMessage && (
                        <div style={{ fontSize: "0.72rem", color: "#fb7185", marginTop: 4 }}>{b.errorMessage}</div>
                      )}
                    </td>

                    {/* Fecha */}
                    <td className="cell-date mono">
                      {b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"}
                    </td>

                    {/* Acciones */}
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        {isCompleted && (
                          <>
                            <button
                              onClick={() => setRestoreModalBackup(b)}
                              className="icon-btn is-accent"
                              aria-label="Restaurar"
                              title="Restaurar esta copia en un servidor Linux"
                            >
                              <RestoreIcon />
                            </button>

                            <button
                              onClick={() => handleDownload(b)}
                              className="icon-btn is-success"
                              aria-label="Descargar"
                              title="Descargar el archivo .tar.gz a tu equipo"
                            >
                              <DownloadIcon />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleDelete(b.backupId, b.fileName)}
                          className="icon-btn is-danger"
                          disabled={isDeleting}
                          aria-label="Eliminar"
                          title="Eliminar copia de seguridad"
                        >
                          {isDeleting ? <span className="spinner-small" style={{ width: 14, height: 14 }}></span> : <TrashIcon />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal para crear nuevo backup */}
      <BackupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialMachineId={machineId}
        onBackupStarted={() => fetchBackups()}
      />

      {/* Modal para restaurar / cargar backup en servidor */}
      <RestoreBackupModal
        isOpen={Boolean(restoreModalBackup)}
        onClose={() => setRestoreModalBackup(null)}
        backup={restoreModalBackup}
        onRestoreStarted={() => fetchBackups()}
      />
    </div>
  );
};
