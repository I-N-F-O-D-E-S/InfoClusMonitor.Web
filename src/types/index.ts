export const MachineStatus = {
  Online: "Online",
  Offline: "Offline",
  Maintenance: "Maintenance",
  Error: "Error",
} as const;
export type MachineStatus = (typeof MachineStatus)[keyof typeof MachineStatus] | 0 | 1 | 2 | 3;

export const CommandStatus = {
  Pending: "Pending",
  Sent: "Sent",
  Running: "Running",
  Completed: "Completed",
  Failed: "Failed",
} as const;
export type CommandStatus = (typeof CommandStatus)[keyof typeof CommandStatus] | 0 | 1 | 2 | 3 | 4;

export interface Machine {
  id: number;
  externalMachineId: string;
  name: string;
  hostname: string;
  ipAddress: string;
  privateIpAddress?: string;
  publicIpAddress?: string;
  os: string;
  status: MachineStatus;
  agentVersion: string;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  uptime: number;
  isDeleted?: boolean;
  lastHeartbeat: string;
  createdAt: string;
  updatedAt: string;
  commands?: Command[];
}

export interface Command {
  id: number;
  externalMachineId: string;
  type: string;
  parameters: string;
  status: CommandStatus;
  result: string;
  createdAt: string;
  executedAt?: string;
  completedAt?: string;
  isDeleted?: boolean;
}

export interface CreateCommandDto {
  machineId: string;
  parameters: string;
}

export interface User {
  id: number;
  userId: string;
  username: string;
  email: string;
  role: string;
  isDeleted?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  token: string;
  expiration: string;
  user: User;
}

export interface LoginDto {
  usernameOrEmail: string;
  password: string;
}

export const TransferStatus = {
  Pending: "Pending",
  Uploading: "Uploading",
  Uploaded: "Uploaded",
  Downloading: "Downloading",
  Completed: "Completed",
  Failed: "Failed",
  Cancelled: "Cancelled",
} as const;
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus] | 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  sizeFormatted: string;
  modifiedAt?: string;
  permissions?: string;
  extension?: string;
}

export interface DirectoryContent {
  currentPath: string;
  parentPath?: string | null;
  items: FileItem[];
  error?: string | null;
}

export interface StartTransferDto {
  sourceMachineId: string;
  sourcePath: string;
  isDirectory: boolean;
  targetMachineId: string;
  targetPath: string;
}

export interface FileTransfer {
  id: number;
  transferId: string;
  sourceMachineId: string;
  sourceHostname: string;
  sourcePath: string;
  isDirectory: boolean;
  targetMachineId: string;
  targetHostname: string;
  targetPath: string;
  status: TransferStatus;
  sizeBytes: number;
  sizeFormatted: string;
  progressPercent: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface RequestDownloadDto {
  machineId: string;
  path: string;
  isDirectory: boolean;
  selectedPaths?: string[];
}

export interface DownloadResultDto {
  downloadId: string;
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
  error?: string | null;
}


