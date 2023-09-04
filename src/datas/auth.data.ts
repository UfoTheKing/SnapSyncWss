import { ExtWebSocket } from "@/server";

export interface LoginData {
  token: string;
  deviceUuid: string;
  extWs: ExtWebSocket;
}
