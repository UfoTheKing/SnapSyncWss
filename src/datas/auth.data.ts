import { ExtWebSocket } from "@/server";

export interface LoginData {
  token: string;
  deviceUuid: string;
  extWs: ExtWebSocket;
}
export interface LoginSystemData {
  token: string;
  extWs: ExtWebSocket;
}
