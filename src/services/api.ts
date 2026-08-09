import axios from "axios";
import type { Machine, Command, CreateCommandDto } from "../types";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

export async function getMachines(): Promise<Machine[]> {
  const { data } = await api.get<Machine[]>("/machines");
  return data;
}

export async function getMachine(id: string): Promise<Machine> {
  const { data } = await api.get<Machine>(`/machines/${id}`);
  return data;
}

export async function deleteMachine(id: string): Promise<void> {
  await api.delete(`/machines/${id}`);
}

export async function getCommands(machineId?: string): Promise<Command[]> {
  const params = machineId ? { machineId } : {};
  const { data } = await api.get<Command[]>("/commands", { params });
  return data;
}

export async function createCommand(dto: CreateCommandDto): Promise<Command> {
  const { data } = await api.post<Command>("/commands", dto);
  return data;
}
