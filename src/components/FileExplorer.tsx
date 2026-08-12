import React, { useState, useEffect, useCallback } from "react";
import { browseFiles } from "../services/api";
import { signalRService } from "../services/signalr";
import type { DirectoryContent, FileItem } from "../types";
import { TransferModal } from "./TransferModal";

interface FileExplorerProps {
  machineId: string;
  hostname: string;
  isOnline: boolean;
}

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
  const [transferTarget, setTransferTarget] = useState<{ path: string; isDirectory: boolean } | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    if (!isOnline) {
      setError("El servidor no se encuentra en línea para explorar archivos.");
      return;
    }

    setLoading(true);
    setError(null);

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

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="file-explorer-container">
      {/* Header Bar */}
      <div className="explorer-header">
        <div className="explorer-title-group">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "20px" }}>📂</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
              Explorador de Archivos y Carpetas
            </h3>
          </div>
          <span className="badge badge-mono" style={{ fontSize: "11px" }}>
            {items.length} elementos
          </span>
        </div>

        <div className="explorer-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadDirectory(currentPath)}
            disabled={loading || !isOnline}
            title="Recargar directorio"
          >
            🔄 {loading ? "Cargando..." : "Actualizar"}
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setTransferTarget({ path: currentPath, isDirectory: true })}
            disabled={!isOnline}
            title="Transferir esta carpeta completa a otro servidor"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🚀</span> Transferir Carpeta Actual
          </button>
        </div>
      </div>

      {/* Quick shortcuts */}
      <div className="explorer-shortcuts">
        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Atajos Rápidos:</span>
        {[
          { label: "Raíz (/)", path: "/" },
          { label: "🌐 /var/www", path: "/var/www" },
          { label: "🏠 /home", path: "/home" },
          { label: "👑 /root", path: "/root" },
          { label: "⚙️ /etc", path: "/etc" },
          { label: "📦 /opt", path: "/opt" },
          { label: "🧹 /tmp", path: "/tmp" },
          { label: "📋 /var/log", path: "/var/log" },
        ].map((s) => (
          <button
            key={s.path}
            type="button"
            className={`shortcut-pill ${currentPath === s.path ? "active" : ""}`}
            onClick={() => handleNavigate(s.path)}
            disabled={loading}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Breadcrumb & Path bar */}
      <div className="explorer-path-bar">
        <button
          type="button"
          className="btn-nav-up"
          onClick={() => parentPath && handleNavigate(parentPath)}
          disabled={!parentPath || loading}
          title="Subir al directorio superior"
        >
          ⬆️ Subir
        </button>

        <div className="breadcrumbs-wrapper">
          <span
            className="breadcrumb-item breadcrumb-root"
            onClick={() => handleNavigate("/")}
          >
            /
          </span>
          {pathParts.map((part, idx) => {
            const fullSubPath = "/" + pathParts.slice(0, idx + 1).join("/");
            const isLast = idx === pathParts.length - 1;
            return (
              <React.Fragment key={fullSubPath}>
                <span className="breadcrumb-separator">/</span>
                <span
                  className={`breadcrumb-item ${isLast ? "breadcrumb-current" : ""}`}
                  onClick={() => !isLast && handleNavigate(fullSubPath)}
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
            placeholder="Ir a ruta directa..."
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={loading}>
            Ir
          </button>
        </form>
      </div>

      {/* Search Filter */}
      <div className="explorer-filter-bar">
        <input
          type="text"
          className="form-input search-input"
          placeholder="🔍 Filtrar archivos o carpetas en este directorio..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
        {searchFilter && (
          <button
            type="button"
            className="btn-clear-search"
            onClick={() => setSearchFilter("")}
          >
            ✕ Limpiar filtro
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="alert-error" style={{ margin: "16px 0" }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Directory Table */}
      <div className="explorer-table-wrapper">
        {loading ? (
          <div className="explorer-loading-state">
            <div className="spinner"></div>
            <p>Leyendo archivos del servidor {hostname}...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="explorer-empty-state">
            <span style={{ fontSize: "36px" }}>📂</span>
            <p>No se encontraron archivos en este directorio o con el filtro aplicado.</p>
          </div>
        ) : (
          <table className="explorer-table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Nombre</th>
                <th style={{ width: "15%" }}>Tamaño</th>
                <th style={{ width: "15%" }}>Permisos</th>
                <th style={{ width: "18%" }}>Modificado</th>
                <th style={{ width: "12%", textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {/* Opción para subir de directorio */}
              {parentPath && (
                <tr
                  className="table-row-folder"
                  onClick={() => handleNavigate(parentPath)}
                >
                  <td colSpan={5} style={{ color: "#38bdf8", cursor: "pointer", padding: "10px 14px" }}>
                    <span style={{ marginRight: 8 }}>📁</span> <strong>.. (Directorio superior)</strong>
                  </td>
                </tr>
              )}

              {filteredItems.map((item) => (
                <tr
                  key={item.path}
                  className={`explorer-row ${item.isDirectory ? "table-row-folder" : "table-row-file"}`}
                  onDoubleClick={() => item.isDirectory && handleNavigate(item.path)}
                >
                  <td
                    className="cell-name"
                    onClick={() => item.isDirectory && handleNavigate(item.path)}
                  >
                    <span className="file-icon">{getFileIcon(item)}</span>
                    <span className="file-name-text" title={item.path}>
                      {item.name}
                    </span>
                    {item.isDirectory && <span className="dir-tag">DIR</span>}
                  </td>
                  <td className="cell-size font-mono">{item.sizeFormatted}</td>
                  <td className="cell-permissions font-mono">{item.permissions || "-"}</td>
                  <td className="cell-date">
                    {item.modifiedAt
                      ? new Date(item.modifiedAt).toLocaleString("es-ES", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "-"}
                  </td>
                  <td className="cell-actions" style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn-transfer-row"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTransferTarget({
                          path: item.path,
                          isDirectory: item.isDirectory,
                        });
                      }}
                      title={`Transferir '${item.name}' a otro servidor`}
                    >
                      🚀 Transferir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Transferencia */}
      {transferTarget && (
        <TransferModal
          isOpen={!!transferTarget}
          onClose={() => setTransferTarget(null)}
          sourceMachineId={machineId}
          sourceHostname={hostname}
          sourcePath={transferTarget.path}
          isDirectory={transferTarget.isDirectory}
        />
      )}
    </div>
  );
};
