import React, { useState, useEffect, useCallback, useMemo } from "react";
import { browseFiles, requestFileDownload } from "../services/api";
import { signalRService } from "../services/signalr";
import type { DirectoryContent, FileItem } from "../types";
import { BackupModal } from "./BackupModal";

interface FileExplorerProps {
  machineId: string;
  hostname: string;
  isOnline: boolean;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  machineId,
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
        ? `Empaquetando ${multiplePaths.length} elementos seleccionados en .tar.gz...`
        : isDirectory
        ? `Comprimiendo carpeta '${targetPath}' en .tar.gz...`
        : `Preparando descarga de '${targetPath}'...`
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

      setDownloadingMsg(`¡Archivo listo! Iniciando descarga de ${res.fileName}...`);

      // Crear enlace temporal invisible y disparar la descarga
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

  const getFileIcon = (item: FileItem) => {
    if (item.isDirectory) return "📁";
    const ext = item.extension?.toLowerCase() || "";
    if ([".zip", ".tar", ".gz", ".rar", ".7z", ".bz2"].includes(ext)) return "📦";
    if ([".sql", ".db", ".sqlite"].includes(ext)) return "🗄️";
    if ([".js", ".ts", ".jsx", ".tsx", ".py", ".cs", ".php", ".html", ".css", ".json", ".yaml", ".yml"].includes(ext)) return "⚙️";
    if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) return "🖼️";
    if ([".log", ".txt", ".md", ".env", ".conf", ".cfg", ".ini"].includes(ext)) return "📝";
    if ([".sh", ".bash", ".bin"].includes(ext)) return "⚡";
    return "📄";
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "24px" }}>📂</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
                Explorador de Archivos y Carpetas
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                Navegación en tiempo real, descargas directas y generación de copias de seguridad
              </p>
            </div>
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

          {/* Botón Crear Copia de Seguridad */}
          <button
            onClick={() => setBackupTarget({ path: currentPath })}
            className="btn btn-primary btn-sm"
            disabled={loading || isDownloading || !isOnline}
            title="Crear copia de seguridad de esta carpeta"
            style={{ background: "#10b981", borderColor: "#10b981", color: "#ffffff", fontWeight: 600 }}
          >
            <span>💾</span> Hacer Copia de Seguridad
          </button>

          {/* Botón Descargar Carpeta Actual Completa */}
          <button
            onClick={() => triggerBrowserDownload(currentPath, true)}
            className="btn btn-secondary btn-sm"
            disabled={loading || isDownloading || !isOnline}
            title="Descargar toda la carpeta actual comprimida en .tar.gz a tu equipo"
            style={{ color: "#34d399", borderColor: "rgba(52, 211, 153, 0.3)" }}
          >
            <span>⬇️</span> Descargar Carpeta
          </button>
        </div>
      </div>

      {/* Barra de progreso de descarga */}
      {isDownloading && (
        <div style={{
          background: "rgba(56, 189, 248, 0.12)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "var(--radius-md)",
          padding: "10px 14px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#38bdf8",
          fontSize: "13px"
        }}>
          <span className="spinner-small" style={{ borderColor: "rgba(56, 189, 248, 0.3)", borderTopColor: "#38bdf8" }}></span>
          <strong>{downloadingMsg || "Procesando descarga..."}</strong>
        </div>
      )}

      {/* Atajos Rápidos */}
      <div className="explorer-shortcuts">
        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
          Atajos Rápidos:
        </span>
        {[
          { label: "Raíz (/)", path: "/" },
          { label: "🌐 /var/www", path: "/var/www" },
          { label: "🏠 /home", path: "/home" },
          { label: "👑 /root", path: "/root" },
          { label: "⚙️ /etc", path: "/etc" },
          { label: "📦 /opt", path: "/opt" },
          { label: "🧹 /tmp", path: "/tmp" },
          { label: "📋 /var/log", path: "/var/log" },
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

      {/* Barra de Navegación y Breadcrumbs */}
      <div className="explorer-path-bar">
        <button
          onClick={() => parentPath && handleNavigate(parentPath)}
          disabled={!parentPath || parentPath === currentPath || loading || isDownloading}
          className="btn-nav-up"
          title="Subir un nivel de directorio"
        >
          ⬆️ Subir
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
            placeholder="Ir a ruta... (/var/www)"
            disabled={loading || isDownloading}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={loading || isDownloading}>
            Ir
          </button>
        </form>
      </div>

      {/* Barra de Filtro de Búsqueda y Multi-selección */}
      <div className="explorer-filter-bar">
        <input
          type="text"
          className="form-input search-input"
          placeholder="🔍 Filtrar archivos o carpetas en este directorio..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
        {searchFilter && (
          <button onClick={() => setSearchFilter("")} className="btn-clear-search">
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* BARRA FLOTANTE DE ACCIONES PARA ELEMENTOS SELECCIONADOS */}
      {selectedCount > 0 && (
        <div style={{
          background: "#161b26",
          border: "1px solid #38bdf8",
          borderRadius: "var(--radius-md)",
          padding: "10px 16px",
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          boxShadow: "0 0 16px rgba(56, 189, 248, 0.15)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "16px" }}>☑️</span>
            <span style={{ color: "#ffffff", fontWeight: 600, fontSize: "13px" }}>
              {selectedCount} {selectedCount === 1 ? "elemento seleccionado" : "elementos seleccionados"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => triggerBrowserDownload(currentPath, true, Array.from(selectedPaths))}
              className="btn btn-sm"
              disabled={isDownloading}
              style={{ background: "#10b981", color: "#ffffff", fontWeight: 600, gap: 6, display: "flex", alignItems: "center" }}
              title="Descargar los elementos seleccionados comprimidos en .tar.gz a tu equipo"
            >
              <span>⬇️</span> Descargar Selección ({selectedCount})
            </button>

            <button
              onClick={() => setSelectedPaths(new Set())}
              className="btn btn-secondary btn-sm"
            >
              ✕ Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Alerta de Error */}
      {error && (
        <div className="alert-box" style={{ marginBottom: 16 }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Tabla de Archivos */}
      <div className="explorer-table-wrapper">
        {loading ? (
          <div className="explorer-loading-state">
            <div className="auth-spinner"></div>
            <p>Consultando servidor en tiempo real...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="explorer-empty-state">
            <span style={{ fontSize: "32px" }}>📂</span>
            <p>No se encontraron archivos en este directorio o con el filtro aplicado.</p>
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
                <th style={{ width: "230px", textAlign: "right" }}>ACCIONES</th>
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
                    {/* Checkbox de selección */}
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.path)}
                      />
                    </td>

                    {/* Nombre e Icono */}
                    <td onClick={() => item.isDirectory && handleNavigate(item.path)}>
                      <div className="cell-name">
                        <span className="file-icon">{getFileIcon(item)}</span>
                        <span className="file-name-text">{item.name}</span>
                        {item.isDirectory && <span className="dir-tag">DIR</span>}
                      </div>
                    </td>

                    {/* Tamaño */}
                    <td className="cell-size mono">
                      {item.isDirectory ? "-" : item.sizeFormatted}
                    </td>

                    {/* Permisos */}
                    <td className="cell-permissions mono">
                      <code>{item.permissions || "-"}</code>
                    </td>

                    {/* Fecha de Modificación */}
                    <td className="cell-date mono">
                      {item.modifiedAt ? new Date(item.modifiedAt).toLocaleString() : "-"}
                    </td>

                    {/* Acciones por fila */}
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {/* Botón Copia de Seguridad */}
                        <button
                          onClick={() => setBackupTarget({ path: item.path })}
                          className="btn-transfer-row"
                          style={{
                            background: "rgba(16, 185, 129, 0.12)",
                            borderColor: "rgba(16, 185, 129, 0.35)",
                            color: "#34d399",
                            fontWeight: 600,
                          }}
                          title="Crear copia de seguridad de este elemento"
                        >
                          <span>💾</span> Crear Copia
                        </button>

                        {/* Botón Descarga directa al navegador */}
                        <button
                          onClick={() => triggerBrowserDownload(item.path, item.isDirectory)}
                          className="btn-transfer-row"
                          style={{
                            background: "rgba(56, 189, 248, 0.12)",
                            borderColor: "rgba(56, 189, 248, 0.35)",
                            color: "#38bdf8"
                          }}
                          disabled={isDownloading}
                          title={item.isDirectory ? "Descargar esta carpeta comprimida en .tar.gz" : "Descargar este archivo a tu equipo"}
                        >
                          <span>⬇️</span> Descargar
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

      {/* Modal de Copia de Seguridad */}
      {backupTarget && (
        <BackupModal
          isOpen={backupTarget !== null}
          onClose={() => setBackupTarget(null)}
          initialMachineId={machineId}
          initialPath={backupTarget.path}
        />
      )}
    </div>
  );
};
