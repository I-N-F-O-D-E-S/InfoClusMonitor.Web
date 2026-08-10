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
