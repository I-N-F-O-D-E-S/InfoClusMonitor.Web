import React, { useState, useEffect, useCallback, useMemo } from "react";
import { browseFiles, requestFileDownload } from "../services/api";
import { signalRService } from "../services/signalr";
import type { DirectoryContent, FileItem } from "../types";
import { BackupModal } from "./BackupModal";
import { TransferModal } from "./TransferModal";

interface FileExplorerProps {
  machineId: string;
  hostname: string;
  isOnline: boolean;
}

const ARCHIVE_EXT = [".zip", ".tar", ".gz", ".rar", ".7z", ".bz2"];
const DB_EXT = [".sql", ".db", ".sqlite"];
const CODE_EXT = [".js", ".ts", ".jsx", ".tsx", ".py", ".cs", ".php", ".html", ".css", ".json", ".yaml", ".yml"];
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
const TEXT_EXT = [".log", ".txt", ".md", ".env", ".conf", ".cfg", ".ini"];
const SCRIPT_EXT = [".sh", ".bash", ".bin"];

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function FileTypeIcon({ item }: { item: FileItem }) {
  const ext = item.extension?.toLowerCase() || "";

  if (item.isDirectory) {
    return (
      <svg {...ICON_PROPS} stroke="#7dd3fc">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      </svg>
    );
  }
  if (ARCHIVE_EXT.includes(ext)) {
    return (
      <svg {...ICON_PROPS} stroke="#94a3b8">
        <rect x="3" y="4" width="18" height="4" rx="1"></rect>
        <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"></path>
        <path d="M10 12h4"></path>
      </svg>
    );
  }
  if (DB_EXT.includes(ext)) {
    return (
      <svg {...ICON_PROPS} stroke="#94a3b8">
        <ellipse cx="12" cy="5" rx="8" ry="3"></ellipse>
        <path d="M4 5v14c0 1.66 3.6 3 8 3s8-1.34 8-3V5"></path>
        <path d="M4 12c0 1.66 3.6 3 8 3s8-1.34 8-3"></path>
      </svg>
    );
  }
  if (CODE_EXT.includes(ext)) {
    return (
      <svg {...ICON_PROPS} stroke="#94a3b8">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    );
  }
  if (IMAGE_EXT.includes(ext)) {
    return (
      <svg {...ICON_PROPS} stroke="#94a3b8">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <circle cx="9" cy="9" r="2"></circle>
        <path d="m21 15-5-5L5 21"></path>
      </svg>
    );
  }
  if (TEXT_EXT.includes(ext)) {
    return (
      <svg {...ICON_PROPS} stroke="#94a3b8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
    );
  }
  if (SCRIPT_EXT.includes(ext)) {
    return (
      <svg {...ICON_PROPS} stroke="#94a3b8">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </svg>
    );
  }
  return (
    <svg {...ICON_PROPS} stroke="#94a3b8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  );
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

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <path d="M5 21h14"></path>
  </svg>
);

const BackupIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="8.5" ry="3"></ellipse>
    <path d="M3.5 5v14c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3V5"></path>
    <path d="M3.5 12c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3"></path>
  </svg>
);

const TransferIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"></polyline>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
    <polyline points="7 23 3 19 7 15"></polyline>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
  </svg>
);

export const FileExplorer: React.FC<FileExplorerProps> = ({
  machineId,
  hostname,
  isOnline,
}) => {
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [inputPath, setInputPath] = useState<string>("/");
  const [items, setItems] = useState<FileItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  // Selección múltiple
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Backup & Descarga
  const [backupTarget, setBackupTarget] = useState<{ path: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingMsg, setDownloadingMsg] = useState<string | null>(null);

  // Transferencia nodo → nodo
  const [transferTarget, setTransferTarget] = useState<{ path: string; isDirectory: boolean } | null>(null);
  const [transferMsg, setTransferMsg] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    if (!isOnline) {
      setError("El servidor no se encuentra en línea para explorar archivos.");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedPaths(new Set()); // Resetear selección al cambiar de directorio

    try {
      const data: DirectoryContent = await browseFiles(machineId, path);
      if (data.error) {
        setError(data.error);
      } else {
        setCurrentPath(data.currentPath);
        setInputPath(data.currentPath);
        setParentPath(data.parentPath ?? null);
        setItems(data.items || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al explorar archivos en el servidor.");
    } finally {
      setLoading(false);
    }
  }, [machineId, isOnline]);

  useEffect(() => {
    loadDirectory("/");
  }, [loadDirectory]);

  // Escuchar eventos en vivo de exploración de directorios vía SignalR
  useEffect(() => {
    const handleDirLoaded = (content: DirectoryContent) => {
      if (content.currentPath === currentPath) {
        setItems(content.items || []);
        setParentPath(content.parentPath ?? null);
        if (content.error) setError(content.error);
      }
    };

    signalRService.onDirectoryLoaded(handleDirLoaded);
  }, [currentPath]);

  const handleNavigate = (path: string) => {
    loadDirectory(path);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPath.trim()) {
      loadDirectory(inputPath.trim());
    }
  };

  // Manejo de Selección Múltiple
  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedPaths.size === filteredItems.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredItems.map((x) => x.path)));
    }
  };

  // Descarga directa al navegador
  const triggerBrowserDownload = async (targetPath: string, isDirectory: boolean, multiplePaths?: string[]) => {
    setIsDownloading(true);
    setError(null);
    setDownloadingMsg(
      multiplePaths && multiplePaths.length > 1
        ? `Empaquetando ${multiplePaths.length} elementos seleccionados en .tar.gz…`
        : isDirectory
        ? `Comprimiendo la carpeta '${targetPath}' en .tar.gz…`
        : `Preparando la descarga de '${targetPath}'…`
    );

    try {
      const res = await requestFileDownload({
        machineId,
        path: targetPath,
        isDirectory,
        selectedPaths: multiplePaths,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      setDownloadingMsg(`Listo. Iniciando descarga de ${res.fileName}…`);

      const link = document.createElement("a");
      link.href = res.downloadUrl;
      link.download = res.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        setIsDownloading(false);
        setDownloadingMsg(null);
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al preparar la descarga.");
      setIsDownloading(false);
      setDownloadingMsg(null);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.name.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [items, searchFilter]);

  const pathParts = currentPath.split("/").filter(Boolean);

  const selectedCount = selectedPaths.size;

  return (
    <div className="file-explorer-container">
      {/* Header */}
      <div className="explorer-header">
        <div className="explorer-title-group">
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#f8fafc" }}>
              Archivos y carpetas
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
              Navegación, descargas y copias de seguridad
            </p>
          </div>
          <span className="badge badge-mono">{filteredItems.length} elementos</span>
        </div>

        <div className="explorer-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => loadDirectory(currentPath)}
            className="btn btn-secondary btn-sm"
            disabled={loading || isDownloading}
            title="Recargar directorio actual"
          >
            <RefreshIcon spinning={loading} />
            Actualizar
          </button>

          <button
            onClick={() => setBackupTarget({ path: currentPath })}
            className="btn btn-secondary btn-sm"
            disabled={loading || isDownloading || !isOnline}
            title="Crear copia de seguridad de esta carpeta"
          >
            <BackupIcon />
            Copia de seguridad
          </button>

          <button
            onClick={() => triggerBrowserDownload(currentPath, true)}
            className="btn btn-secondary btn-sm"
            disabled={loading || isDownloading || !isOnline}
            title="Descargar toda la carpeta actual comprimida en .tar.gz"
          >
            <DownloadIcon />
            Descargar carpeta
          </button>

          <button
            onClick={() => setTransferTarget({ path: currentPath, isDirectory: true })}
            className="btn btn-secondary btn-sm"
            disabled={loading || isDownloading || !isOnline}
            title="Transferir esta carpeta a otro nodo"
          >
            <TransferIcon />
            Transferir
          </button>
        </div>
      </div>

      {/* Progreso de descarga */}
      {isDownloading && (
        <div className="alert-box" style={{ borderColor: "rgba(56, 189, 248, 0.3)", background: "rgba(56, 189, 248, 0.1)", color: "#7dd3fc" }}>
          <span className="spinner-small" style={{ borderColor: "rgba(56, 189, 248, 0.3)", borderTopColor: "#38bdf8" }}></span>
          <span>{downloadingMsg || "Procesando descarga…"}</span>
        </div>
      )}

      {/* Aviso de transferencia */}
      {transferMsg && (
        <div className="alert-success" style={{ marginBottom: 16 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>{transferMsg}</span>
        </div>
      )}

      {/* Atajos */}
      <div className="explorer-shortcuts">
        <span className="stat-label">Rutas frecuentes</span>
        {[
          { label: "/", path: "/" },
          { label: "/var/www", path: "/var/www" },
          { label: "/home", path: "/home" },
          { label: "/root", path: "/root" },
          { label: "/etc", path: "/etc" },
          { label: "/opt", path: "/opt" },
          { label: "/tmp", path: "/tmp" },
          { label: "/var/log", path: "/var/log" },
        ].map((sc) => (
          <button
            key={sc.path}
            onClick={() => handleNavigate(sc.path)}
            className={`shortcut-pill ${currentPath === sc.path ? "active" : ""}`}
            disabled={loading || isDownloading}
          >
            {sc.label}
          </button>
        ))}
      </div>

      {/* Barra de ruta */}
      <div className="explorer-path-bar">
        <button
          onClick={() => parentPath && handleNavigate(parentPath)}
          disabled={!parentPath || parentPath === currentPath || loading || isDownloading}
          className="btn-nav-up"
          title="Subir un nivel de directorio"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
          Subir
        </button>

        <div className="breadcrumbs-wrapper">
          <span className="breadcrumb-root" onClick={() => handleNavigate("/")}>
            /
          </span>
          {pathParts.map((part, index) => {
            const pathUpToHere = "/" + pathParts.slice(0, index + 1).join("/");
            const isLast = index === pathParts.length - 1;
            return (
              <React.Fragment key={pathUpToHere}>
                <span className="breadcrumb-separator">/</span>
                <span
                  className={isLast ? "breadcrumb-current" : "breadcrumb-item"}
                  onClick={() => !isLast && handleNavigate(pathUpToHere)}
                >
                  {part}
                </span>
              </React.Fragment>
            );
          })}
        </div>

        <form onSubmit={handleInputSubmit} className="path-input-form">
          <input
            type="text"
            className="form-input path-text-input"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            placeholder="Ir a ruta… (/var/www)"
            disabled={loading || isDownloading}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={loading || isDownloading}>
            Ir
          </button>
        </form>
      </div>

      {/* Filtro */}
      <div className="explorer-filter-bar">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            style={{ paddingRight: 40 }}
            placeholder="Filtrar archivos o carpetas en este directorio..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
          {searchFilter && (
            <button type="button" onClick={() => setSearchFilter("")} className="btn-clear-search" aria-label="Limpiar filtro">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Barra de selección */}
      {selectedCount > 0 && (
        <div
          style={{
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "var(--radius-md)",
            padding: "10px 16px",
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span style={{ color: "#ffffff", fontWeight: 600, fontSize: "0.82rem" }}>
            {selectedCount} {selectedCount === 1 ? "elemento seleccionado" : "elementos seleccionados"}
          </span>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => triggerBrowserDownload(currentPath, true, Array.from(selectedPaths))}
              className="btn btn-primary btn-sm"
              disabled={isDownloading}
              title="Descargar los elementos seleccionados comprimidos en .tar.gz"
            >
              <DownloadIcon />
              Descargar selección
            </button>

            <button onClick={() => setSelectedPaths(new Set())} className="btn btn-secondary btn-sm">
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Error */}
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

      {/* Tabla */}
      <div className="explorer-table-wrapper">
        {loading ? (
          <div className="explorer-loading-state">
            <div className="auth-spinner"></div>
            <p>Consultando el servidor…</p>
          </div>
        ) : filteredItems.length === 0 ? (
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              </svg>
            </div>
            <p>No hay archivos en este directorio o con el filtro aplicado.</p>
          </div>
        ) : (
          <table className="explorer-table">
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedCount > 0 && selectedCount === filteredItems.length}
                    onChange={selectAll}
                    title="Seleccionar todo"
                  />
                </th>
                <th>NOMBRE</th>
                <th style={{ width: "110px" }}>TAMAÑO</th>
                <th style={{ width: "100px" }}>PERMISOS</th>
                <th style={{ width: "170px" }}>MODIFICADO</th>
                <th style={{ width: "190px", textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isSelected = selectedPaths.has(item.path);
                return (
                  <tr
                    key={item.path}
                    className={`explorer-row ${item.isDirectory ? "table-row-folder" : "table-row-file"} ${isSelected ? "selected-row" : ""}`}
                    style={{ background: isSelected ? "rgba(56, 189, 248, 0.08)" : undefined }}
                  >
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.path)}
                      />
                    </td>

                    <td onClick={() => item.isDirectory && handleNavigate(item.path)}>
                      <div className="cell-name">
                        <span className="file-icon">
                          <FileTypeIcon item={item} />
                        </span>
                        <span className="file-name-text">{item.name}</span>
                        {item.isDirectory && <span className="dir-tag">DIR</span>}
                      </div>
                    </td>

                    <td className="cell-size mono">{item.isDirectory ? "—" : item.sizeFormatted}</td>

                    <td className="cell-permissions mono">
                      <code>{item.permissions || "—"}</code>
                    </td>

                    <td className="cell-date mono">
                      {item.modifiedAt ? new Date(item.modifiedAt).toLocaleString() : "—"}
                    </td>

                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button
                          onClick={() => setBackupTarget({ path: item.path })}
                          className="icon-btn is-success"
                          aria-label="Crear copia"
                          title="Crear copia de seguridad de este elemento"
                        >
                          <BackupIcon />
                        </button>

                        <button
                          onClick={() => triggerBrowserDownload(item.path, item.isDirectory)}
                          className="icon-btn is-accent"
                          disabled={isDownloading}
                          aria-label="Descargar"
                          title={item.isDirectory ? "Descargar esta carpeta en .tar.gz" : "Descargar este archivo"}
                        >
                          <DownloadIcon />
                        </button>

                        <button
                          onClick={() => setTransferTarget({ path: item.path, isDirectory: item.isDirectory })}
                          className="icon-btn"
                          disabled={isDownloading || !isOnline}
                          aria-label="Transferir"
                          title={item.isDirectory ? "Transferir esta carpeta a otro nodo" : "Transferir este archivo a otro nodo"}
                        >
                          <TransferIcon />
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

      {/* Modal de copia de seguridad */}
      {backupTarget && (
        <BackupModal
          isOpen={backupTarget !== null}
          onClose={() => setBackupTarget(null)}
          initialMachineId={machineId}
          initialPath={backupTarget.path}
        />
      )}

      {/* Modal de transferencia entre nodos */}
      {transferTarget && (
        <TransferModal
          isOpen={transferTarget !== null}
          onClose={() => setTransferTarget(null)}
          sourceMachineId={machineId}
          sourceHostname={hostname}
          sourcePath={transferTarget.path}
          isDirectory={transferTarget.isDirectory}
          onTransferStarted={() => {
            setTransferMsg("Transferencia iniciada en segundo plano. Síguela en «Transferencias».");
            setTimeout(() => setTransferMsg(null), 6000);
          }}
        />
      )}
    </div>
  );
};
