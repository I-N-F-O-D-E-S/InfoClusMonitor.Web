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

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export const AgentUpdateModal: React.FC<AgentUpdateModalProps> = ({
  isOpen,
  onClose,
  targetMachine,
  onUpdated,
}) => {
  const [installCommand, setInstallCommand] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("https://s3-api.apps.mrapy.com/infoclus-releases/agent-package.tar.gz");
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
          if (res.installCommand) setInstallCommand(res.installCommand);
          if (res.downloadUrl) setDownloadUrl(res.downloadUrl);
          if (res.targetVersion) setTargetVersion(res.targetVersion);
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
      setError("Selecciona ambos archivos: agent.py e install.sh.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await uploadAgentReleaseBundle(agentFile, installFile);
      if (res.installCommand) setInstallCommand(res.installCommand);
      if (res.downloadUrl) setDownloadUrl(res.downloadUrl);
      setSuccessMsg("Archivos empaquetados y publicados. Enlace y comando actualizados.");
      setAgentFile(null);
      setInstallFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al subir los archivos.");
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
        setSuccessMsg(`Orden de actualización enviada a ${targetMachine.hostname}.`);
      } else {
        const res = await deployToAll();
        setSuccessMsg(`Orden de actualización enviada a ${res.updatedCount} servidores en línea.`);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al enviar el comando remoto.");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content transfer-modal" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo_simple.png" alt="" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc" }}>
                Agente Linux
              </h3>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>
                Versión objetivo <span className="mono" style={{ color: "#7dd3fc" }}>v{targetVersion}</span>
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: "82vh", overflowY: "auto" }}>
          {error && (
            <div className="alert-error" style={{ marginBottom: 16 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="alert-success" style={{ marginBottom: 16 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Enlace directo */}
          <div className="modal-section">
            <div className="modal-section-head">
              <span className="modal-section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                Paquete de instalación
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyUrl}
                disabled={!downloadUrl}
              >
                {copiedUrl ? <CheckIcon /> : <CopyIcon />}
                {copiedUrl ? "Copiado" : "Copiar enlace"}
              </button>
            </div>

            <div className="code-block">
              {downloadUrl || "https://s3-api.apps.mrapy.com/infoclus-releases/agent-package.tar.gz"}
            </div>
          </div>

          {/* 2. Comando */}
          <div className="modal-section">
            <div className="modal-section-head">
              <span className="modal-section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
                Instalación / actualización
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleCopyCmd}
                disabled={!installCommand}
              >
                {copiedCmd ? <CheckIcon /> : <CopyIcon />}
                {copiedCmd ? "Copiado" : "Copiar comando"}
              </button>
            </div>

            <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: 10, lineHeight: 1.5 }}>
              Ejecútalo en la terminal SSH del servidor como <code className="mono">root</code> o con{" "}
              <code className="mono">sudo</code>. Descarga el paquete, prepara el entorno y arranca el servicio.
            </p>

            <div className="code-block is-command">
              {installCommand || "Cargando comando…"}
            </div>
          </div>

          {/* 3. Publicar nueva versión */}
          <div className="modal-section">
            <div className="modal-section-head" style={{ marginBottom: 14 }}>
              <span className="modal-section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Publicar nueva versión
              </span>
            </div>

            <form onSubmit={handleUpload}>
              <div className="field-grid" style={{ marginBottom: 14 }}>
                <div>
                  <label className="form-label" htmlFor="agent-py">
                    agent.py
                  </label>
                  <input
                    id="agent-py"
                    type="file"
                    accept=".py"
                    onChange={(e) => setAgentFile(e.target.files?.[0] || null)}
                    className="form-input"
                    disabled={isUploading}
                    style={{ padding: "7px", fontSize: "0.78rem" }}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="install-sh">
                    install.sh
                  </label>
                  <input
                    id="install-sh"
                    type="file"
                    accept=".sh"
                    onChange={(e) => setInstallFile(e.target.files?.[0] || null)}
                    className="form-input"
                    disabled={isUploading}
                    style={{ padding: "7px", fontSize: "0.78rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  disabled={isUploading || !agentFile || !installFile}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner-small"></span>
                      Publicando…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <path d="M5 21h14"></path>
                      </svg>
                      Subir y publicar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* 4. Despliegue remoto */}
          <div
            className="modal-footer"
            style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}
          >
            <span style={{ fontSize: "0.78rem", color: "#64748b", flex: 1, minWidth: 200 }}>
              {targetMachine
                ? "Despacha la actualización directamente a este nodo."
                : "Despacha la actualización a todos los nodos en línea."}
            </span>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRemoteDeploy}
                disabled={isDeploying || !installCommand}
              >
                {isDeploying ? (
                  <>
                    <span className="spinner-small"></span>
                    Enviando…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
                      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
                      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
                      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
                    </svg>
                    {targetMachine ? `Actualizar ${targetMachine.hostname}` : "Actualizar todo el clúster"}
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
