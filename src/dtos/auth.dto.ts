import { ExtWebSocket } from "@/interfaces/wss.interface";

export interface LoginDto {
  token: string;
  deviceUuid: string;
  extWs: ExtWebSocket;
}

export interface LoginSystemDto {
  token: string;
  extWs: ExtWebSocket;
}
