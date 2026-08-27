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
    if (!window.confirm(`¿Estás seguro de eliminar permanentemente la copia de seguridad '${fileName}'?`)) {
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

  const renderStatusBadge = (status: any, errorMsg?: string) => {
    const s = String(status).toLowerCase();
    if (s === "pending" || s === "0") {
      return (
        <span className="badge badge-info" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="spinner-small" style={{ width: 12, height: 12 }}></span>
          ⏳ En Cola / Iniciando...
        </span>
      );
    }
    if (s === "compressing" || s === "1" || s === "uploading" || s === "2") {
      return (
        <span className="badge badge-info" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8" }}>
          <span className="spinner-small" style={{ width: 12, height: 12, borderColor: "rgba(56, 189, 248, 0.3)", borderTopColor: "#38bdf8" }}></span>
          🔵 Procesando / Generando copia...
        </span>
      );
    }
    if (s === "completed" || s === "3") {
      return (
        <span className="badge badge-success" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
          ✅ Guardado en Almacenamiento Seguro
        </span>
      );
    }
    return (
      <span className="badge badge-danger" title={errorMsg || "Error en copia"}>
        ❌ Fallido
      </span>
    );
  };

  return (
    <div className="backups-container">
      {showHeader && (
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "28px" }}>💾</span>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#f8fafc" }}>
                  Copias de Seguridad
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                  Respaldos y copias de seguridad de tus servidores con ejecución en segundo plano y restauración 1-clic
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={fetchBackups} className="btn btn-secondary btn-sm" disabled={loading}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
              Actualizar
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ background: "#10b981", borderColor: "#10b981", color: "#ffffff", fontWeight: 600 }}
            >
              <span>➕</span> Nueva Copia de Seguridad
            </button>
          </div>
        </div>
      )}

      {/* Banner de información de almacenamiento */}
      <div style={{
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid rgba(56, 189, 248, 0.2)",
        borderRadius: "var(--radius-md)",
        padding: "12px 18px",
        marginBottom: 16,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "20px" }}>☁️</span>
          <div>
            <div style={{ fontSize: "13px", color: "#f8fafc", fontWeight: 600 }}>
              Almacenamiento Seguro de Respaldos
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
              Formato estandarizado: <code>{"{FECHA}_{NOMBRE}.tar.gz"}</code> — Descarga directa protegida y restauración 1-clic a cualquier nodo.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <span className="badge badge-mono">
            {backups.filter((b) => String(b.status).toLowerCase() === "completed" || b.status === 3).length} Respaldos Disponibles
          </span>
        </div>
      </div>

      {/* Barra de Filtro de Búsqueda */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Buscar por nombre de archivo {FECHA}_{NOMBRE}, servidor o ruta..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="alert-box" style={{ marginBottom: 16 }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Tabla de Copias de Seguridad */}
      <div className="explorer-table-wrapper">
        {loading ? (
          <div className="explorer-loading-state">
            <div className="auth-spinner"></div>
            <p>Cargando lista de copias de seguridad...</p>
          </div>
        ) : filteredBackups.length === 0 ? (
          <div className="explorer-empty-state">
            <span style={{ fontSize: "36px" }}>💾</span>
            <p>No se encontraron copias de seguridad registradas.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12, background: "#10b981", borderColor: "#10b981" }}
            >
              <span>💾</span> Crear Primera Copia de Seguridad
            </button>
          </div>
        ) : (
          <table className="explorer-table">
            <thead>
              <tr>
                <th>ARCHIVO DE RESPALDO</th>
                <th>SERVIDOR ORIGEN</th>
                <th>RUTA RESPALDADA</th>
                <th style={{ width: "120px" }}>TAMAÑO</th>
                <th style={{ width: "240px" }}>ESTADO</th>
                <th style={{ width: "160px" }}>FECHA</th>
                <th style={{ width: "220px", textAlign: "right" }}>ACCIONES</th>
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
                        <span className="file-icon">📦</span>
                        <div>
                          <span className="file-name-text" style={{ fontWeight: 700, color: "#f8fafc" }}>
                            {b.fileName}
                          </span>
                          {b.customName && (
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              Identificador: {b.customName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Servidor */}
                    <td>
                      <span className="badge badge-mono">
                        🖥️ {b.hostname}
                      </span>
                    </td>

                    {/* Ruta */}
                    <td>
                      <code style={{ fontSize: "12px", color: "#38bdf8" }}>{b.sourcePath}</code>
                    </td>

                    {/* Tamaño */}
                    <td className="cell-size mono">
                      {b.sizeFormatted || "-"}
                    </td>

                    {/* Estado */}
                    <td>
                      {renderStatusBadge(b.status, b.errorMessage)}
                      {b.errorMessage && (
                        <div style={{ fontSize: "11px", color: "#f87171", marginTop: 4 }}>
                          {b.errorMessage}
                        </div>
                      )}
                    </td>

                    {/* Fecha */}
                    <td className="cell-date mono">
                      {b.createdAt ? new Date(b.createdAt).toLocaleString() : "-"}
                    </td>

                    {/* Acciones */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {isCompleted && (
                          <>
                            <button
                              onClick={() => setRestoreModalBackup(b)}
                              className="btn-transfer-row"
                              style={{
                                background: "rgba(56, 189, 248, 0.12)",
                                borderColor: "rgba(56, 189, 248, 0.35)",
                                color: "#38bdf8",
                              }}
                              title="Restaurar / Cargar esta copia de seguridad en un servidor Linux"
                            >
                              <span>🔄</span> Restaurar
                            </button>
                            <button
                              onClick={() => handleDownload(b)}
                              className="btn-transfer-row"
                              style={{
                                background: "rgba(16, 185, 129, 0.12)",
                                borderColor: "rgba(16, 185, 129, 0.35)",
                                color: "#34d399",
                              }}
                              title="Descargar archivo de respaldo .tar.gz a tu equipo"
                            >
                              <span>⬇️</span> Descargar
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleDelete(b.backupId, b.fileName)}
                          className="btn-transfer-row"
                          style={{
                            background: "rgba(239, 68, 68, 0.12)",
                            borderColor: "rgba(239, 68, 68, 0.3)",
                            color: "#f87171",
                          }}
                          disabled={isDeleting}
                          title="Eliminar copia de seguridad permanentemente"
                        >
                          {isDeleting ? "..." : "🗑️"}
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
