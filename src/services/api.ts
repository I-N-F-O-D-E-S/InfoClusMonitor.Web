import axios from "axios";
import type {
  Machine,
  Command,
  CreateCommandDto,
  AuthResponse,
  LoginDto,
  User,
  DirectoryContent,
  FileTransfer,
  StartTransferDto,
  RequestDownloadDto,
  DownloadResultDto,
  BackupRecord,
  CreateBackupDto
} from "../types";

const runtimeApiUrl = (typeof window !== "undefined" && (window as any)._env_?.VITE_API_URL) 
  ? (window as any)._env_.VITE_API_URL 
  : (import.meta.env.VITE_API_URL || "http://localhost:5000/api");

export const api = axios.create({
  baseURL: runtimeApiUrl,
});

// Interceptor para inyectar token JWT automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("infodes_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar expiración de sesión (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes("/login")) {
      localStorage.removeItem("infodes_token");
      localStorage.removeItem("infodes_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export async function loginUser(dto: LoginDto): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", dto);
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

// Machines API
export async function getMachines(): Promise<Machine[]> {
  const { data } = await api.get<Machine[]>("/machines");
  return data;
}

export async function getMachine(id: string): Promise<Machine> {
  const { data } = await api.get<Machine>(`/machines/${id}`);
  return data;
}

export async function refreshMachineTelemetry(id: string): Promise<Machine> {
  const { data } = await api.post<Machine>(`/machines/${id}/refresh`);
  return data;
}

export async function updateMachineName(id: string, name: string): Promise<Machine> {
  const { data } = await api.put<Machine>(`/machines/${id}/name`, { name });
  return data;
}

export async function deleteMachine(id: string): Promise<void> {
  await api.delete(`/machines/${id}`);
}

// Commands API
export async function getCommands(machineId?: string): Promise<Command[]> {
  const params = machineId ? { machineId } : {};
  const { data } = await api.get<Command[]>("/commands", { params });
  return data;
}

export async function createCommand(dto: CreateCommandDto): Promise<Command> {
  const { data } = await api.post<Command>("/commands", dto);
  return data;
}

// Files & Transfers API
export async function browseFiles(machineId: string, path: string = "/"): Promise<DirectoryContent> {
  const { data } = await api.get<DirectoryContent>("/files/browse", {
    params: { machineId, path },
  });
  return data;
}

export async function getTransfers(machineId?: string): Promise<FileTransfer[]> {
  const params = machineId ? { machineId } : {};
  const { data } = await api.get<FileTransfer[]>("/transfers", { params });
  return data;
}

export async function getTransfer(transferId: string): Promise<FileTransfer> {
  const { data } = await api.get<FileTransfer>(`/transfers/${transferId}`);
  return data;
}

export async function startTransfer(dto: StartTransferDto): Promise<FileTransfer> {
  const { data } = await api.post<FileTransfer>("/transfers", dto);
  return data;
}

export async function cancelTransfer(transferId: string): Promise<void> {
  await api.delete(`/transfers/${transferId}`);
}

export async function requestFileDownload(dto: RequestDownloadDto): Promise<DownloadResultDto> {
  const { data } = await api.post<DownloadResultDto>("/files/download", dto);
  return data;
}

// Agent Releases & Auto-Update API
export async function getInstallCommand(): Promise<{ packageAvailable: boolean; installCommand: string; downloadUrl: string; targetVersion: string }> {
  const { data } = await api.get("/agentreleases/install-command");
  return data;
}

export async function uploadAgentReleaseBundle(agentFile: File, installFile: File): Promise<{ message: string; installCommand: string; downloadUrl: string; agentSize: number; installSize: number }> {
  const formData = new FormData();
  formData.append("agentFile", agentFile);
  formData.append("installFile", installFile);
  const { data } = await api.post("/agentreleases/upload-bundle", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deployToAll(): Promise<{ updatedCount: number; message: string }> {
  const { data } = await api.post("/agentreleases/deploy-all");
  return data;
}

export async function deployToMachine(machineId: string): Promise<Command> {
  const { data } = await api.post<Command>(`/agentreleases/deploy/${machineId}`);
  return data;
}

// Backups API (MinIO Bucket: copias-de-seguridad)
export async function getBackups(machineId?: string): Promise<BackupRecord[]> {
  const params = machineId ? { machineId } : {};
  const { data } = await api.get<BackupRecord[]>("/backups", { params });
  return data;
}

export async function getBackup(id: string): Promise<BackupRecord> {
  const { data } = await api.get<BackupRecord>(`/backups/${id}`);
  return data;
}

export async function createBackup(dto: CreateBackupDto): Promise<BackupRecord> {
  const { data } = await api.post<BackupRecord>("/backups", dto);
  return data;
}

export async function restoreBackup(
  backupId: string,
  dto: { targetMachineId?: string; targetPath?: string }
): Promise<{ backupId: string; machineId: string; targetPath: string; status: string; message: string }> {
  const { data } = await api.post(`/backups/${backupId}/restore`, dto);
  return data;
}

export async function deleteBackup(id: string | number): Promise<void> {
  await api.delete(`/backups/${id}`);
}

// Scheduled Tasks & Automations API (Horario Paraguayo)
export async function getScheduledTasks(machineId?: string): Promise<import("../types").ScheduledTask[]> {
  const params = machineId ? { machineId } : {};
  const { data } = await api.get<import("../types").ScheduledTask[]>("/scheduledtasks", { params });
  return data;
}

export async function getScheduledTask(id: string): Promise<import("../types").ScheduledTask> {
  const { data } = await api.get<import("../types").ScheduledTask>(`/scheduledtasks/${id}`);
  return data;
}

export async function getScheduledTaskExecutions(id: string, limit: number = 50): Promise<import("../types").ScheduledTaskExecution[]> {
  const { data } = await api.get<import("../types").ScheduledTaskExecution[]>(`/scheduledtasks/${id}/executions`, {
    params: { limit },
  });
  return data;
}

export async function createScheduledTask(dto: import("../types").CreateScheduledTaskDto): Promise<import("../types").ScheduledTask> {
  const { data } = await api.post<import("../types").ScheduledTask>("/scheduledtasks", dto);
  return data;
}

export async function updateScheduledTask(id: string, dto: import("../types").UpdateScheduledTaskDto): Promise<import("../types").ScheduledTask> {
  const { data } = await api.put<import("../types").ScheduledTask>(`/scheduledtasks/${id}`, dto);
  return data;
}

export async function toggleScheduledTask(id: string): Promise<import("../types").ScheduledTask> {
  const { data } = await api.patch<import("../types").ScheduledTask>(`/scheduledtasks/${id}/toggle`);
  return data;
}

export async function runScheduledTaskNow(id: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(`/scheduledtasks/${id}/run`);
  return data;
}

export async function deleteScheduledTask(id: string): Promise<void> {
  await api.delete(`/scheduledtasks/${id}`);
}
