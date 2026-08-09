export enum MachineStatus {
  Online = "Online",
  Offline = "Offline",
  Maintenance = "Maintenance",
  Error = "Error",
}

export enum CommandStatus {
  Pending = "Pending",
  Sent = "Sent",
  Running = "Running",
  Completed = "Completed",
  Failed = "Failed",
}

export interface Machine {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  os: string;
  status: MachineStatus;
  agentVersion: string;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  uptime: number;
  lastHeartbeat: string;
  createdAt: string;
  updatedAt: string;
  commands?: Command[];
}

export interface Command {
  id: string;
  machineId: string;
  type: string;
  parameters: string;
  status: CommandStatus;
  result: string;
  createdAt: string;
  executedAt?: string;
  completedAt?: string;
}

export interface CreateCommandDto {
  machineId: string;
  parameters: string;
}
