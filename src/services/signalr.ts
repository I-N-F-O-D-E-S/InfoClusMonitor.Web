import * as signalR from "@microsoft/signalr";
import type { Machine, Command } from "../types";

type MachineCallback = (machine: Machine) => void;
type MachineDeletedCallback = (id: string) => void;

class SignalRService {
  private connection: signalR.HubConnection | null = null;

  async connect() {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5000/hubs/machines")
      .withAutomaticReconnect()
      .build();

    this.connection.onreconnecting(() => console.log("SignalR reconnecting..."));
    this.connection.onreconnected(() => console.log("SignalR reconnected"));
    this.connection.onclose(() => console.log("SignalR disconnected"));

    await this.connection.start();
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

  async subscribeToMachine(machineId: string) {
    await this.connection?.invoke("SubscribeToMachine", machineId);
  }

  async unsubscribeFromMachine(machineId: string) {
    await this.connection?.invoke("UnsubscribeFromMachine", machineId);
  }

  disconnect() {
    this.connection?.stop();
  }
}

export const signalRService = new SignalRService();
