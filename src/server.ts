import * as WebSocket from "ws";
import express from "express";
import * as http from "http";
import { NODE_ENV, PORT } from "@config";
import { Model } from "objection";
import knex from "@databases";
import SnapsInstancesController from "./controllers/snaps_instaces.controller";
import AuthController from "./controllers/auth.controller";
import * as yup from "yup";
import { HttpException } from "./exceptions/HttpException";
import {
  ExtWebSocket,
  SystemErrorMessage,
  SystemMessage,
  UserMessage,
} from "./interfaces/wss.interface";
import { LoginDto, LoginSystemDto } from "./dtos/auth.dto";
import { WssActions } from "./utils/enum";

const app = express();
const server = http.createServer(app);

Model.knex(knex);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

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
    var action = WssActions.GENERIC;
    try {
      const message = JSON.parse(msg) as UserMessage;
      if (!message.action) throw new Error("No action provided");
      // if (!message.token) throw new Error("No token provided");

      switch (message.action) {
        case WssActions.LOGIN: {
          action = WssActions.LOGIN;
          if (!message.deviceUuid) throw new HttpException(401, "Unauthorized");
          if (!message.token) throw new HttpException(401, "Unauthorized");

          // Controllo se è già loggato
          const isLogged = await authController.isLogged(
            message.token,
            message.deviceUuid
          );
          if (isLogged) throw new Error("User already logged");

          const data: LoginDto = {
            token: message.token,
            deviceUuid: message.deviceUuid,
            extWs: extWs,
          };

          const { user, device, sessionId } = await authController.login(data);

          console.log(`Client connected - ${user.username} connected now`);

          extWs.user = user;
          extWs.device = device;
          extWs.sessionId = sessionId;
          extWs.token = message.token;

          ws.send(createMessage(true, "User logged", "LOGIN", { sessionId }));

          break;
        }
        case WssActions.LOGIN_SYSTEM: {
          action = WssActions.LOGIN_SYSTEM;
          if (!message.token) throw new HttpException(401, "Unauthorized");

          let data: LoginSystemDto = {
            token: message.token,
            extWs: extWs,
          };
          await authController.loginSystem(data);

          console.log(`Client connected - System connected now`);

          extWs.system = true;
          extWs.token = message.token;

          ws.send(createMessage(true, "System logged", "LOGIN_SYSTEM"));

          break;
        }
        case WssActions.GET_CONNECTED_USERS: {
          action = WssActions.GET_CONNECTED_USERS;
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
        case WssActions.LOGOUT: {
          action = WssActions.LOGOUT;
          if (!extWs.device) throw new HttpException(401, "Unauthorized");
          if (!extWs.token) throw new HttpException(401, "Unauthorized");

          const isLogged = await authController.isLogged(
            extWs.token,
            extWs.device.uuid
          );
          if (!isLogged) throw new HttpException(401, "Unauthorized");

          if (extWs.system) console.log("System disconnected");
          else {
            if (extWs.user) console.log(`${extWs.user.username} disconnected`);

            const r = await controller.ConnectionClosed(extWs);

            if (r) {
              let clientsArray = Array.from(r.clients);
              clientsArray.forEach((client) => {
                let clientWs = client[1];
                clientWs.snapsInstanceKey = undefined; // Rimuovo la chiave dai clients, in modo che possano entrare in altre snap
                clientWs.send(JSON.stringify(r.message));
              });
            }

            // Lo rimuovo dalla mappa
            await authController.logout(extWs);
          }

          extWs.user = undefined;
          extWs.device = undefined;
          extWs.sessionId = undefined;
          extWs.snapsInstanceKey = undefined;
          extWs.system = undefined;
          extWs.token = undefined;

          ws.send(createMessage(true, "User logged out", action));
          break;
        }

        case WssActions.CREATE_SNAP_INSTANCE: {
          action = WssActions.CREATE_SNAP_INSTANCE;
          if (!extWs.device) throw new HttpException(401, "Unauthorized");
          if (!extWs.token) throw new HttpException(401, "Unauthorized");
          const isLogged = await authController.isLogged(
            extWs.token,
            extWs.device.uuid
          );
          if (!isLogged) throw new HttpException(401, "Unauthorized");
          if (!extWs.user) throw new HttpException(401, "Unauthorized");

          const key = await controller.CreateSnapInstance(message.data, extWs);
          extWs.snapsInstanceKey = key;

          const clients = await controller.GetSnapInstanceClients(key);
          const data = await controller.GetSnapInstance(key);

          const clientsArray = Array.from(clients);

          await Promise.all(
            clientsArray.map(async (client) => {
              let clientWs = client[1];
              let title = "";
              if (clientWs.user && clientWs.snapsInstanceKey) {
                title = await controller.GetSnapInstanceTitle(
                  clientWs.snapsInstanceKey,
                  clientWs.user
                );
              }

              clientWs.send(
                createMessage(true, `User Joined`, action, {
                  ...data,
                  title,
                })
              );
            })
          );

          // ws.send(createMessage(true, "Snap instance created"));
          break;
        }
        case WssActions.JOIN_SNAP_INSTANCE: {
          action = WssActions.JOIN_SNAP_INSTANCE;
          if (!extWs.device) throw new HttpException(401, "Unauthorized");
          if (!extWs.token) throw new HttpException(401, "Unauthorized");

          const isLogged = await authController.isLogged(
            extWs.token,
            extWs.device.uuid
          );
          if (!isLogged) throw new HttpException(401, "Unauthorized");
          if (!extWs.user) throw new HttpException(401, "Unauthorized");

          await controller.JoinSnapInstance(message.data, extWs);

          extWs.snapsInstanceKey = message.data.key;

          const clients = await controller.GetSnapInstanceClients(
            message.data.key
          );
          const data = await controller.GetSnapInstance(message.data.key);

          const clientsArray = Array.from(clients);

          await Promise.all(
            clientsArray.map(async (client) => {
              let clientWs = client[1];
              let title = "";
              if (clientWs.user && clientWs.snapsInstanceKey) {
                title = await controller.GetSnapInstanceTitle(
                  clientWs.snapsInstanceKey,
                  clientWs.user
                );
              }

              clientWs.send(
                createMessage(true, `User Joined`, "JOIN_SNAP_INSTANCE", {
                  ...data,
                  title,
                })
              );
            })
          );

          break;
        }
        case WssActions.LEAVE_SNAP_INSTANCE: {
          action = WssActions.LEAVE_SNAP_INSTANCE;
          if (!extWs.device) throw new HttpException(401, "Unauthorized");
          if (!extWs.token) throw new HttpException(401, "Unauthorized");

          const isLogged = await authController.isLogged(
            extWs.token,
            extWs.device.uuid
          );
          if (!isLogged) throw new HttpException(401, "Unauthorized");

          if (!extWs.snapsInstanceKey)
            throw new HttpException(403, "Forbidden");

          const clients = await controller.GetSnapInstanceClients(
            extWs.snapsInstanceKey
          );

          await controller.LeaveSnapInstance(extWs);

          const clientsArray = Array.from(clients);
          let copyOfTheKey = extWs.snapsInstanceKey;
          extWs.snapsInstanceKey = undefined; // Rimuovo la chiave dai clients, in modo che possano entrare in altre snap

          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.snapsInstanceKey = undefined; // Rimuovo la chiave dai clients, in modo che possano entrare in altre snap
            clientWs.send(
              createMessage(true, `User Left`, "LEAVE_SNAP_INSTANCE", {
                key: copyOfTheKey,
                exit: true,
              })
            );
          });

          break;
        }
        case WssActions.SEND_SNAP: {
          action = WssActions.SEND_SNAP;
          if (!extWs.token) throw new HttpException(401, "Unauthorized");
          if (!extWs.system) throw new HttpException(401, "Unauthorized");
          if (!message.data) throw new HttpException(400, "Bad request");

          if (!message.data.key) throw new HttpException(400, "Bad request");

          // Controllare se il system è loggato
          let isLogged = await authController.isLoggedSystem(extWs.token);
          if (!isLogged) throw new HttpException(401, "Unauthorized");

          // Recupero i client connessi
          const clients = await controller.GetSnapInstanceClients(
            message.data.key
          );
          const clientsArray = Array.from(clients);

          const data = await controller.GetSnapInstance(message.data.key, true);

          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.send(createMessage(true, `Snap received`, action, data));
          });

          ws.send(createMessage(true, `Snap sent`, action));

          break;
        }
        case WssActions.ERROR_SNAP: {
          action = WssActions.ERROR_SNAP;
          if (!extWs.token) throw new HttpException(401, "Unauthorized");
          if (!extWs.system) throw new HttpException(401, "Unauthorized");
          if (!message.data) throw new HttpException(400, "Bad request");

          if (!message.data.key) throw new HttpException(400, "Bad request");

          // Controllare se il system è loggato
          let isLogged = await authController.isLoggedSystem(extWs.token);
          if (!isLogged) throw new HttpException(401, "Unauthorized");

          // Recupero i client connessi
          const clients = await controller.GetSnapInstanceClients(
            message.data.key
          );
          const clientsArray = Array.from(clients);

          // Elimino la SnapInstance
          await controller.DeleteSnapInstanceSystem(message.data.key);

          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.snapsInstanceKey = undefined; // Rimuovo la chiave dai clients, in modo che possano entrare in altre snap
            clientWs.send(
              createMessage(true, `SnapSync deleted`, action, {
                key: message.data.key,
                exit: true,
              })
            );
          });
        }
        case WssActions.PUBLISH_SNAP: {
          action = WssActions.PUBLISH_SNAP;
          if (!extWs.token) throw new HttpException(401, "Unauthorized");
          if (!extWs.system) throw new HttpException(401, "Unauthorized");
          if (!message.data) throw new HttpException(400, "Bad request");

          if (!message.data.key) throw new HttpException(400, "Bad request");

          // Controllare se il system è loggato
          let isLogged = await authController.isLoggedSystem(extWs.token);
          if (!isLogged) throw new HttpException(401, "Unauthorized");

          // Recupero i client connessi
          const clients = await controller.GetSnapInstanceClients(
            message.data.key
          );
          const clientsArray = Array.from(clients);

          await controller.DeleteSnapInstanceSystem(message.data.key);

          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.snapsInstanceKey = undefined; // Rimuovo la chiave dai clients, in modo che possano entrare in altre snap
            clientWs.send(
              createMessage(true, `SnapSync published`, action, {
                key: message.data.key,
                exit: true,
              })
            );
          });
        }
        default: {
          ws.send(createMessage(false, "Action not found", message.action));
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
      "Hi there, I am a WebSocket server. Use the next structure to communicate through the websocket channel.",
      "WSS_INFO"
    )
  );

  ws.on("error", (err) => {
    // Fare come con il LogOut
    console.warn(`Client disconnected - reason: ${err}`);
  });

  ws.on("close", async (e) => {
    try {
      if (extWs.system) {
        console.log("System disconnected - reason: " + e);
      } else {
        if (extWs.user) {
          console.log(`${extWs.user.username} disconnected - reason: ` + e);
        }

        const r = await controller.ConnectionClosed(extWs);

        if (r) {
          let clientsArray = Array.from(r.clients);
          clientsArray.forEach((client) => {
            let clientWs = client[1];
            clientWs.snapsInstanceKey = undefined; // Rimuovo la chiave dai clients, in modo che possano entrare in altre snap
            clientWs.send(JSON.stringify(r.message));
          });
        }

        // Lo rimuovo dalla mappa
        await authController.logout(extWs);
      }

      extWs.user = undefined;
      extWs.device = undefined;
      extWs.sessionId = undefined;
      extWs.snapsInstanceKey = undefined;
      extWs.system = undefined;
      extWs.token = undefined;
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
