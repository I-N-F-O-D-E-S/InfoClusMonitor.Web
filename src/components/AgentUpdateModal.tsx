import React, { useState, useEffect } from "react";
import {
  getInstallCommand,
  uploadAgentReleaseBundle,
  deployToAll,
  deployToMachine,
} from "../services/api";
import type { Machine } from "../types";

interface AgentUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMachine?: Machine | null;
  onUpdated?: () => void;
}

export const AgentUpdateModal: React.FC<AgentUpdateModalProps> = ({
  isOpen,
  onClose,
  targetMachine,
  onUpdated,
}) => {
  const [installCommand, setInstallCommand] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("https://storageapi.mrapy.com/infoclus-releases/agent-package.tar.gz");
  const [targetVersion, setTargetVersion] = useState<string>("1.2.0");
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload state
  const [agentFile, setAgentFile] = useState<File | null>(null);
  const [installFile, setInstallFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      getInstallCommand()
        .then((res) => {
          if (res.installCommand) {
            setInstallCommand(res.installCommand);
          }
          if (res.downloadUrl) {
            setDownloadUrl(res.downloadUrl);
          }
          if (res.targetVersion) {
            setTargetVersion(res.targetVersion);
          }
        })
        .catch((e) => console.error("Error loading install command:", e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCmd = () => {
    if (!installCommand) return;
    navigator.clipboard.writeText(installCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCopyUrl = () => {
    if (!downloadUrl) return;
    navigator.clipboard.writeText(downloadUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentFile || !installFile) {
      setError("Por favor selecciona ambos archivos: agent.py e install.sh");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await uploadAgentReleaseBundle(agentFile, installFile);
      if (res.installCommand) setInstallCommand(res.installCommand);
      if (res.downloadUrl) setDownloadUrl(res.downloadUrl);
      setSuccessMsg("¡Archivos empaquetados y publicados exitosamente! Enlace y comando actualizados.");
      setAgentFile(null);
      setInstallFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al subir archivos.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoteDeploy = async () => {
    setIsDeploying(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (targetMachine) {
        await deployToMachine(targetMachine.externalMachineId);
        setSuccessMsg(`¡Orden de actualización enviada a ${targetMachine.hostname}!`);
      } else {
        const res = await deployToAll();
        setSuccessMsg(`¡Orden de actualización enviada a ${res.updatedCount} servidores en línea!`);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al enviar comando remoto.");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content transfer-modal" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo_simple.png" alt="BuhoControl Logo" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#f8fafc" }}>
                Instalación y Actualización de Agente Linux
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                Versión oficial v{targetVersion} y comando de aprovisionamiento 1-clic
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: "82vh", overflowY: "auto" }}>
          {error && (
            <div className="alert-error" style={{ marginBottom: 16 }}>
              <span>⚠️ {error}</span>
            </div>
          )}

          {successMsg && (
            <div className="alert-success" style={{ marginBottom: 16 }}>
              <span>✅ {successMsg}</span>
            </div>
          )}

          {/* 1. SECCIÓN: URL DIRECTA DEL PAQUETE */}
          <div style={{ background: "#0c0d14", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "16px" }}>🌐</span>
                <strong style={{ color: "#38bdf8", fontSize: "13px" }}>
                  Enlace Directo del Paquete de Instalación
                </strong>
                <span className="badge badge-mono" style={{ fontSize: "10px", padding: "2px 6px" }}>
                  v{targetVersion}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyUrl}
                disabled={!downloadUrl}
                style={{ padding: "3px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: 5 }}
              >
                <span>{copiedUrl ? "✓" : "📋"}</span>
                {copiedUrl ? "¡Copiada!" : "Copiar Enlace"}
              </button>
            </div>

            <div style={{
              background: "#040406",
              border: "1px solid #1e293b",
              borderRadius: "6px",
              padding: "8px 12px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "#93c5fd",
              wordBreak: "break-all",
              lineHeight: 1.4,
              userSelect: "all",
            }}>
              {downloadUrl || "https://storageapi.mrapy.com/infoclus-releases/agent-package.tar.gz"}
            </div>
          </div>

          {/* 2. SECCIÓN: COMANDO BASH 1-CLIC */}
          <div style={{ background: "#09090d", border: "1px solid #2d2d3f", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "16px" }}>💻</span>
                <strong style={{ color: "#34d399", fontSize: "14px" }}>
                  Comando de Instalación / Actualización en Linux
                </strong>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleCopyCmd}
                disabled={!installCommand}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>{copiedCmd ? "✓" : "📋"}</span>
                {copiedCmd ? "¡Comando Copiado!" : "Copiar Comando"}
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: 10, lineHeight: 1.4 }}>
              Pega este comando en la terminal SSH de tu servidor como <code className="font-mono">root</code> o con <code className="font-mono">sudo</code>. Descarga el paquete, configura el entorno virtual y arranca el servicio de sistema automáticamente:
            </p>

            <div style={{
              background: "#040406",
              border: "1px solid #1e293b",
              borderRadius: "6px",
              padding: "12px 14px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "#38bdf8",
              wordBreak: "break-all",
              lineHeight: 1.5,
              userSelect: "all",
            }}>
              {installCommand || "Cargando comando..."}
            </div>
          </div>

          {/* 3. SECCIÓN DE CARGA DE NUEVA VERSIÓN */}
          <div style={{ background: "#0c0d14", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: "16px" }}>📤</span>
              <strong style={{ color: "#e2e8f0", fontSize: "13px" }}>
                Publicar Nueva Versión del Agente (agent.py + install.sh)
              </strong>
            </div>
            
            <form onSubmit={handleUpload}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: 4, fontWeight: 600 }}>
                    📄 Script del Agente (agent.py):
                  </label>
                  <input
                    type="file"
                    accept=".py"
                    onChange={(e) => setAgentFile(e.target.files?.[0] || null)}
                    className="form-input"
                    disabled={isUploading}
                    style={{ padding: "6px", fontSize: "12px" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: 4, fontWeight: 600 }}>
                    ⚡ Instalador Bash (install.sh):
                  </label>
                  <input
                    type="file"
                    accept=".sh"
                    onChange={(e) => setInstallFile(e.target.files?.[0] || null)}
                    className="form-input"
                    disabled={isUploading}
                    style={{ padding: "6px", fontSize: "12px" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  disabled={isUploading || !agentFile || !installFile}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner-small"></span>
                      Publicando paquete...
                    </>
                  ) : (
                    <>
                      <span>☁️</span> Subir y Actualizar Paquete
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* 4. ACTUALIZACIÓN REMOTA */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 4 }}>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              ¿Servidores en línea? Puedes despachar la actualización a los nodos directamente desde el panel.
            </div>
            
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRemoteDeploy}
                disabled={isDeploying || !installCommand}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {isDeploying ? (
                  <>
                    <span className="spinner-small"></span>
                    Enviando orden...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    {targetMachine ? `Actualizar ${targetMachine.hostname}` : "Actualizar Todo el Cluster"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
