import { Device } from "./devices.interface";
import { User } from "./users.interface";
import * as WebSocket from "ws";

export interface ExtWebSocket extends WebSocket {
  isAlive: boolean;

  system?: boolean;
  token?: string;

  snapsInstanceKey?: string;
  user?: User;
  device?: Device;
  sessionId?: string;
}

export class SystemMessage {
  constructor(
    public success: boolean,
    public message: string,
    public action: string | null = null,
    public data: any = null,

    public isBroadcast = false,
    public sender = "NS"
  ) {}
}

export class SystemErrorMessage {
  constructor(
    public success: boolean,
    public message: string,
    public action: string | null = null,
    public data: any = null,
    public code: number = 500,
    public isBroadcast = false,
    public sender = "NS"
  ) {}
}

export class UserMessage {
  constructor(
    public action: string,
    public token?: string,
    public deviceUuid?: string,
    public data?: any
  ) {}
}
