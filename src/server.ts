import * as WebSocket from "ws";
import express from "express";
import * as http from "http";
import { NODE_ENV, PORT } from "@config";
import { Model } from "objection";
import knex from "@databases";
import { User } from "@/interfaces/users.interface";
import SnapsInstancesController from "./controllers/snaps_instaces.controller";
import { LoginData } from "./datas/auth.data";
import { Device } from "./interfaces/devices.interface";
import AuthController from "./controllers/auth.controller";
import * as yup from "yup";
import { HttpException } from "./exceptions/HttpException";

const app = express();
const server = http.createServer(app);

Model.knex(knex);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

export interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  snapsInstanceKey?: string;
  user?: User;
  device?: Device;
  sessionId?: string;
}

function createMessage(
  success: boolean,
  message: string,
  action: string | null = null,
  data: any = null,
  isBroadcast = false,
  sender = "NS"
): string {
  return JSON.stringify(
    new SystemMessage(success, message, action, data, isBroadcast, sender)
  );
}

function createErrorMessage(
  message: string,
  action: string | null = null,
  data: any = null,
  code: number = 500,
  isBroadcast = false,
  sender = "NS"
): string {
  return JSON.stringify(
    new SystemErrorMessage(
      false,
      message,
      action,
      data,
      code,
      isBroadcast,
      sender
    )
  );
}

export interface DataStoredInToken {
  id: number;
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
    public token: string,
    public deviceUuid: string | null,
    public action: string,
    public data: any
  ) {}
}

const controller = new SnapsInstancesController();
const authController = new AuthController();

wss.on("connection", (ws: WebSocket) => {
  const extWs = ws as ExtWebSocket;

  extWs.isAlive = true;

  ws.on("pong", () => {
    extWs.isAlive = true;
  });

  //connection is up, let's add a simple simple event
  ws.on("message", async (msg: string) => {
    var action = "GENERIC";
    try {
      const message = JSON.parse(msg) as UserMessage;
      if (!message.token) throw new Error("No token provided");

      if (!message.action) throw new Error("No action provided");

      switch (message.action) {
        case "LOGIN": {
          if (!message.deviceUuid) throw new Error("No deviceUuid provided");

          action = "LOGIN";
          // Controllo se è già loggato
          const isLogged = await authController.isLogged(
            message.token,
            message.deviceUuid
          );
          if (isLogged) throw new Error("User already logged");

          const data: LoginData = {
            token: message.token,
            deviceUuid: message.deviceUuid,
            extWs: extWs,
          };

          const { user, device, sessionId } = await authController.login(data);

          extWs.user = user;
          extWs.device = device;
          extWs.sessionId = sessionId;

          ws.send(createMessage(true, "User logged", "LOGIN", { sessionId }));

          break;
        }
        case "GET_CONNECTED_USERS": {
          action = "GET_CONNECTED_USERS";
          // const isLogged = await authController.isLogged(
          //   message.token,
          //   message.deviceUuid
          // );

          // if (!isLogged) throw new Error("User not logged");

          const results = await authController.getConnectedUsersIds();
          ws.send(
            createMessage(
              true,
              "Connected users found",
              "GET_CONNECTED_USERS",
              results
            )
          );

          break;
        }
        case "CREATE_SNAP_INSTANCE": {
          action = "CREATE_SNAP_INSTANCE";
          if (!extWs.device) throw new HttpException(401, "Unauthorized", null);
          const isLogged = await authController.isLogged(
            message.token,
            extWs.device.uuid
          );
          if (!isLogged) throw new Error("User not logged");

          const key = await controller.CreateSnapInstance(
            message.data,
            extWs,
            extWs.user,
            extWs.device
          );
          extWs.snapsInstanceKey = key;

          const clients = await controller.GetSnapInstanceClients(
            extWs.user,
            extWs.device,
            extWs
          );
          const data = await controller.GetSnapInstance(key, extWs.user);

          const clientsArray = Array.from(clients);

          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.send(
              createMessage(
                true,
                `SnapSync created`,
                "CREATE_SNAP_INSTANCE",
                data
              )
            );
          });

          // ws.send(createMessage(true, "Snap instance created"));
          break;
        }
        case "DELETE_SNAP_INSTANCE": {
          action = "DELETE_SNAP_INSTANCE";
          if (!extWs.device) throw new HttpException(401, "Unauthorized", null);
          const isLogged = await authController.isLogged(
            message.token,
            extWs.device.uuid
          );
          if (!isLogged) throw new Error("User not logged");

          const clients = await controller.DeleteSnapInstance(
            extWs.user,
            extWs.device,
            extWs
          );

          const clientsArray = Array.from(clients);

          extWs.snapsInstanceKey = undefined;

          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.send(
              createMessage(true, `SnapSync deleted`, "DELETE_SNAP_INSTANCE", {
                key: message.data.key,
                exit: true,
              })
            );
          });

          break;
        }
        case "JOIN_SNAP_INSTANCE": {
          action = "JOIN_SNAP_INSTANCE";
          if (!extWs.device) throw new HttpException(401, "Unauthorized");

          const isLogged = await authController.isLogged(
            message.token,
            extWs.device.uuid
          );
          if (!isLogged) throw new Error("User not logged");

          await controller.JoinSnapInstance(
            message.data,

            extWs.user,
            extWs.device,
            extWs
          );

          extWs.snapsInstanceKey = message.data.key;

          const clients = await controller.GetSnapInstanceClients(
            extWs.user,
            extWs.device,
            extWs
          );
          const data = await controller.GetSnapInstance(
            message.data.key,
            extWs.user
          );

          const clientsArray = Array.from(clients);

          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.send(
              createMessage(true, `User Joined`, "JOIN_SNAP_INSTANCE", data)
            );
          });

          break;
        }
        case "LEAVE_SNAP_INSTANCE": {
          action = "LEAVE_SNAP_INSTANCE";
          if (!extWs.device) throw new HttpException(401, "Unauthorized");

          const isLogged = await authController.isLogged(
            message.token,
            extWs.device.uuid
          );
          if (!isLogged) throw new Error("User not logged");

          const clients = await controller.LeaveSnapInstance(
            message.data,

            extWs.user,
            extWs.device,
            extWs
          );
          const clientsArray = Array.from(clients);

          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.send(
              createMessage(true, `User Left`, "LEAVE_SNAP_INSTANCE", {
                key: message.data.key,
                exit: true,
              })
            );
          });

          break;
        }
        case "TAKE_SNAP": {
          action = "TAKE_PHOTO";
          console.log("TAKE_PHOTO");

          break;
        }
        default: {
          ws.send(createMessage(false, "Action not found"));
          return;
        }
      }
    } catch (error) {
      var status = 500;
      var message = "Something went wrong";
      var data = null;
      if (error instanceof yup.ValidationError) {
        status = 422;
        if (error.errors) {
          message = error.errors[0] ? error.errors[0] : "";
          message +=
            error.errors.length > 1
              ? ` and ${error.errors.length - 1} more`
              : "";
        } else {
          message = error.message;
        }
      } else if (error instanceof HttpException) {
        status = error.status || 500;
        message = error.message || "Something went wrong";
        data = error.data || null;
      } else {
        status = 500;
        message =
          error instanceof Error ? error.message : "Something went wrong";
      }

      ws.send(createErrorMessage(message, action, data, status));
    }
  });

  //send immediatly a feedback to the incoming connection
  ws.send(
    createMessage(
      true,
      "Hi there, I am a WebSocket server. Use the next structure to communicate through the websocket channel."
    )
  );

  ws.on("error", (err) => {
    // Fare come con il LogOut
    console.warn(`Client disconnected - reason: ${err}`);
  });

  ws.on("close", async (e) => {
    try {
      if (extWs.user && extWs.device && extWs.sessionId) {
        const r = await controller.ConnectionClosed(extWs, extWs.user);

        // Lo rimuovo dalla mappa
        await authController.logout(
          extWs.user.id,
          extWs.device.uuid,
          extWs.sessionId
        );

        extWs.user = undefined;
        extWs.device = undefined;
        extWs.sessionId = undefined;
        extWs.snapsInstanceKey = undefined;

        if (r) {
          let clientsArray = Array.from(r.clients);
          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.send(JSON.stringify(r.message));
          });
        }
      }
    } catch (error) {
      console.log(error);
    }
  });
});

wss.on("close", () => {
  console.log("disconnected now");
});

wss.on("error", (err) => {
  console.log(err);
});

server.on("upgrade", (request, socket, head) => {
  console.log("Parsing session from request...");
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    const extWs = ws as ExtWebSocket;

    if (!extWs.isAlive) return ws.terminate();

    extWs.isAlive = false;
    ws.ping(null, undefined);
  });
}, 10000);

//start our server
server.listen(PORT || 8999, () => {
  let addr = server.address();
  let bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr?.port}`;
  console.log(`Server started on ${bind}: ${NODE_ENV || "development"}`);
});
