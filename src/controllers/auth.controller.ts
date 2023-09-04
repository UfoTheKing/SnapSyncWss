import { SECRET_KEY } from "@/config";
import { LoginData } from "@/datas/auth.data";
import { HttpException } from "@/exceptions/HttpException";
import { Device } from "@/interfaces/devices.interface";
import { User } from "@/interfaces/users.interface";
import { Devices } from "@/models/devices.model";
import { Users } from "@/models/users.model";
import { UsersDevices } from "@/models/users_devices.model";
import { WebsocketClients } from "@/models/websocket_clients.model";
import { DataStoredInToken, ExtWebSocket } from "@/server";
import { verify } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const SEPARATOR = "_";

class AuthController {
  public connectedUsers: Map<
    string,
    {
      client: ExtWebSocket;
      sessionId: string;
    }
  > = new Map<
    string,
    {
      client: ExtWebSocket;
      sessionId: string;
    }
  >();

  public async login(data: LoginData): Promise<{
    user: User;
    device: Device;
    sessionId: string;
  }> {
    const tokenUser = await this.getUserFromToken(data.token);
    if (!tokenUser) throw new HttpException(401, "Invalid token");

    // Controllo il DeviceUuid
    const device = await Devices.query().whereNotDeleted().findOne({
      uuid: data.deviceUuid,
    });
    if (!device) throw new HttpException(404, "Device not found");

    const userDevice = await UsersDevices.query().whereNotDeleted().findOne({
      userId: tokenUser.id,
      deviceId: device.id,
    });
    if (!userDevice) throw new HttpException(404, "UserDevice not found");

    const mapKey = this.generateMapKey(tokenUser.id, device.uuid);

    // Controllo se l'utente è già connesso
    if (this.connectedUsers.has(mapKey))
      throw new HttpException(400, "User already connected");

    if (!data.extWs.sessionId) {
      // Significa che magari è successo un crash del server e il client si è riconnesso, ma nel DB nella tabella websocket_clients non c'è il record con endedAt = null
      await WebsocketClients.query()
        .whereNotDeleted()
        .andWhere({
          userId: tokenUser.id,
          deviceId: device.id,
        })
        .update({
          endedAt: new Date(),
        });

      // Elimino il record dalla tabella dei client connessi
      await WebsocketClients.query().whereNotDeleted().delete().where({
        userId: tokenUser.id,
        deviceId: device.id,
      });
    }

    // Creo il record nella tabella dei client connessi
    const uuid = uuidv4();
    await WebsocketClients.query().insert({
      userId: tokenUser.id,
      deviceId: device.id,
      uuid,
      startedAt: new Date(),
    });

    // Aggiungo l'utente alla lista degli utenti connessi
    this.connectedUsers.set(mapKey, {
      client: data.extWs,
      sessionId: uuid,
    });

    return { user: tokenUser, device, sessionId: uuid };
  }

  public async logout(
    userId: number,
    deviceUuid: string,
    sessionId: string
  ): Promise<void> {
    const actionName = "LOGOUT";
    // Recupero il device
    const device = await Devices.query().whereNotDeleted().findOne({
      uuid: deviceUuid,
    });
    if (!device) throw new HttpException(404, "Device not found", actionName);

    // Aggiorno il record nella tabella dei client connessi con endedAt = now
    await WebsocketClients.query()
      .whereNotDeleted()
      .update({
        endedAt: new Date(),
      })
      .where({
        userId,
        deviceId: device.id,
        uuid: sessionId,
      });

    // Elimino il record dalla tabella dei client connessi
    await WebsocketClients.query().whereNotDeleted().delete().where({
      userId,
      deviceId: device.id,
      uuid: sessionId,
    });

    // Elimino l'utente dalla lista degli utenti connessi
    const mapKey = this.generateMapKey(userId, deviceUuid);
    this.connectedUsers.delete(mapKey);
  }

  public async getConnectedUsersIds(): Promise<{
    [key: string]: {
      userId: number;
      deviceUuid: string;
      sessionId: string;
    };
  }> {
    let result: {
      [key: string]: {
        userId: number;
        deviceUuid: string;
        sessionId: string;
      };
    } = {};

    this.connectedUsers.forEach((value, key) => {
      const [userId, deviceUuid] = key.split(SEPARATOR);

      result[key] = {
        userId: parseInt(userId),
        deviceUuid: deviceUuid,
        sessionId: value.sessionId,
      };
    });

    return result;
  }

  public async isLogged(token: string, deviceUuid: string): Promise<boolean> {
    const tokenUser = await this.getUserFromToken(token);
    if (!tokenUser) return false;

    // Recupero il device
    const device = await Devices.query().whereNotDeleted().findOne({
      uuid: deviceUuid,
    });
    if (!device) return false;

    // Controllo se l'utente è già connesso
    const mapKey = this.generateMapKey(tokenUser.id, device.uuid);

    let exists = this.connectedUsers.has(mapKey);
    return exists;
  }

  private async getUserFromToken(token: string): Promise<User | undefined> {
    const Authorization = token.split("Bearer ")[1];
    const secretKey: string = SECRET_KEY || "";

    const verificationResponse = (await verify(
      Authorization,
      secretKey
    )) as DataStoredInToken;
    const userId = verificationResponse.id;
    const findUser: User | undefined = await Users.query()
      .whereNotDeleted()
      .findById(userId);
    return findUser;
  }

  private generateMapKey(userId: number, deviceUuid: string): string {
    return `${userId}${SEPARATOR}${deviceUuid}`;
  }
}

export default AuthController;
