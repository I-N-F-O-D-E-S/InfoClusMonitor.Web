import * as signalR from "@microsoft/signalr";
import type { Machine, Command, FileTransfer, DirectoryContent, BackupRecord } from "../types";

type MachineCallback = (machine: Machine) => void;
type MachineDeletedCallback = (id: string) => void;
type ConnectionStateCallback = (connected: boolean) => void;

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private connectionStateListeners: ConnectionStateCallback[] = [];

  async connect() {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const baseUrl = (typeof window !== "undefined" && (window as any)._env_?.VITE_SIGNALR_URL)
      ? (window as any)._env_.VITE_SIGNALR_URL
      : (import.meta.env.VITE_SIGNALR_URL || "http://localhost:5000/hubs/machines");

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(baseUrl, {
        accessTokenFactory: () => localStorage.getItem("infodes_token") || "",
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    this.connection.onreconnecting(() => {
      this.notifyConnectionState(false);
    });
    this.connection.onreconnected(() => {
      this.notifyConnectionState(true);
    });
    this.connection.onclose(() => {
      this.notifyConnectionState(false);
    });

    try {
      await this.connection.start();
      this.notifyConnectionState(true);
    } catch (err) {
      console.warn("SignalR connection initial attempt failed:", err);
      this.notifyConnectionState(false);
    }
  }

  onConnectionState(cb: ConnectionStateCallback): () => void {
    this.connectionStateListeners.push(cb);
    if (this.connection) {
      cb(this.connection.state === signalR.HubConnectionState.Connected);
    } else {
      cb(false);
    }
    return () => {
      this.connectionStateListeners = this.connectionStateListeners.filter(l => l !== cb);
    };
  }

  private notifyConnectionState(connected: boolean) {
    this.connectionStateListeners.forEach(cb => cb(connected));
  }

  onMachineCreated(cb: MachineCallback) {
    this.connection?.on("MachineCreated", cb);
  }

  onMachineUpdated(cb: MachineCallback) {
    this.connection?.on("MachineUpdated", cb);
  }

  onMachineDeleted(cb: MachineDeletedCallback) {
    this.connection?.on("MachineDeleted", cb);
  }

  onCommandCreated(cb: (cmd: Command) => void) {
    this.connection?.on("CommandCreated", cb);
  }

  onCommandUpdated(cb: (cmd: Command) => void) {
    this.connection?.on("CommandUpdated", cb);
  }

  onTransferCreated(cb: (transfer: FileTransfer) => void) {
    this.connection?.on("TransferCreated", cb);
  }

  onTransferUpdated(cb: (transfer: FileTransfer) => void) {
    this.connection?.on("TransferUpdated", cb);
  }

  onDirectoryLoaded(cb: (content: DirectoryContent) => void) {
    this.connection?.on("DirectoryLoaded", cb);
  }

  onBackupCreated(cb: (backup: BackupRecord) => void) {
    this.connection?.on("BackupCreated", cb);
  }

  onBackupUpdated(cb: (backup: BackupRecord) => void) {
    this.connection?.on("BackupUpdated", cb);
  }

  onBackupDeleted(cb: (backupId: string) => void) {
    this.connection?.on("BackupDeleted", cb);
  }

  async subscribeToMachine(machineId: string) {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke("SubscribeToMachine", machineId);
      } catch (err) {
        console.warn("Error subscribing to machine group:", err);
      }
    }
  }

  async unsubscribeFromMachine(machineId: string) {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke("UnsubscribeFromMachine", machineId);
      } catch (err) {
        console.warn("Error unsubscribing from machine group:", err);
      }
    }
  }

  disconnect() {
    this.connection?.stop();
    this.notifyConnectionState(false);
  }
}

export const signalRService = new SignalRService();
