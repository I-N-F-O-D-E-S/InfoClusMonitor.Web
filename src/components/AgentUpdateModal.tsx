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
  const [copied, setCopied] = useState(false);
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
        })
        .catch((e) => console.error("Error loading install command:", e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!installCommand) return;
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      setInstallCommand(res.installCommand);
      setSuccessMsg("¡Archivos cargados exitosamente a MinIO! Comando actualizado generado abajo.");
      setAgentFile(null);
      setInstallFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al subir archivos a MinIO.");
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
        setSuccessMsg(`¡Comando enviado por RabbitMQ a ${targetMachine.hostname}!`);
      } else {
        const res = await deployToAll();
        setSuccessMsg(`¡Comando enviado por RabbitMQ a ${res.updatedCount} servidores en línea!`);
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
      <div className="modal-content transfer-modal" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo_simple.png" alt="BuhoControl Logo" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#f8fafc" }}>
                BuhoControl — Instalador y Actualizador de Agente
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                Carga de archivos a MinIO y generación de comando bash 1-click para Linux
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: "80vh", overflowY: "auto" }}>
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

          {/* 1. SECCIÓN DE CARGA DE ARCHIVOS */}
          <div style={{ background: "#0c0d14", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: "16px" }}>📤</span>
              <strong style={{ color: "#38bdf8", fontSize: "14px" }}>
                1. Cargar Archivos del Agente (agent.py + install.sh)
              </strong>
            </div>
            
            <form onSubmit={handleUpload}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#e2e8f0", display: "block", marginBottom: 4, fontWeight: 600 }}>
                    📄 1. Script del Agente (agent.py):
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
                  <label style={{ fontSize: "12px", color: "#e2e8f0", display: "block", marginBottom: 4, fontWeight: 600 }}>
                    ⚡ 2. Instalador Bash (install.sh):
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
                      Subiendo a MinIO...
                    </>
                  ) : (
                    <>
                      <span>☁️</span> Subir a MinIO y Generar Comando
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* 2. SECCIÓN DEL COMANDO GENERADO */}
          <div style={{ background: "#09090d", border: "1px solid #2d2d3f", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "16px" }}>💻</span>
                <strong style={{ color: "#34d399", fontSize: "14px" }}>
                  2. Comando de Instalación / Actualización en Linux
                </strong>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleCopy}
                disabled={!installCommand}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>{copied ? "✓" : "📋"}</span>
                {copied ? "¡Copiado al Portapapeles!" : "Copiar Comando"}
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: 10, lineHeight: 1.4 }}>
              Pega este comando como <code className="font-mono">root</code> en tu servidor. Descarga ambos archivos de MinIO, instala el entorno virtual Python y arranca el servicio <code className="font-mono">systemd</code> automáticamente:
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
              {installCommand || "Cargando comando firmado..."}
            </div>
          </div>

          {/* 3. LANZAMIENTO REMOTO OPCIONAL */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 6 }}>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              ¿Ya tienes servidores en línea? Puedes enviarles este comando directamente por RabbitMQ.
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
                    Enviando por RabbitMQ...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    {targetMachine ? "Enviar a este Servidor" : "Enviar a Todo el Cluster"}
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
