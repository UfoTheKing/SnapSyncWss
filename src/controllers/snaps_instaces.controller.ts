import {
  CreateSnapInstaceUserData,
  CreateSnapInstanceData,
  DeleteSnapInstanceData,
  GetSnapInstanceClientsData,
  GetSnapInstanceData,
  JoinSnapInstanceData,
  LeaveSnapInstanceData,
} from "@/datas/snaps_instances.data";
import { Device } from "@/interfaces/devices.interface";
import { User } from "@/interfaces/users.interface";
import { SnapsInstances } from "@/models/snaps_instances.model";
import { SnapsInstancesShapes } from "@/models/snaps_instances_shapes.model";
import { SnapsInstancesUsers } from "@/models/snaps_instances_users.model";
import { ExtWebSocket, SystemMessage } from "@/server";
import sha256 from "crypto-js/sha256";
import * as yup from "yup";
import { v4 as uuidv4 } from "uuid";
import { SnapsInstancesShapesPositions } from "@/models/snaps_instances_shapes_positions.model";
import { Users } from "@/models/users.model";
import { BlockedUsers } from "@/models/blocked_users.model";
import { Friends } from "@/models/friends.model";
import { FriendshipStatuses } from "@/models/friendship_statuses.model";
import { HttpException } from "@/exceptions/HttpException";
import { boolean } from "boolean";
import SnapInstanceService from "@/services/snaps_instances.service";
import { CreateSnapInstaceDto } from "@/dtos/snaps_instances.dto";
import { SnapInstance } from "@/interfaces/snaps_instances.interface";
import {
  JoinUserToSnapInstanceDto,
  LeaveUserToSnapInstanceDto,
} from "@/dtos/snaps_instances_users.dto";

class ClassSnapInstance {
  public key: string;
  public clients: Map<number, ExtWebSocket> = new Map(); // UserId, Client
  public model: SnapInstance;
  public startTime: Date | null = null;

  constructor(key: string, model: SnapInstance) {
    this.key = key;
    this.model = model;
  }

  public async addClient(userId: number, client: ExtWebSocket): Promise<void> {
    // Controllo se esiste già un'istanza con la stessa chiave
    const instance = this.clients.get(userId);
    if (instance) throw new Error("Client already exists.");

    // La creo
    this.clients.set(userId, client);
  }

  public async findClient(userId: number): Promise<ExtWebSocket | undefined> {
    return this.clients.get(userId);
  }

  public async deleteClient(userId: number): Promise<void> {
    // Controllo se esiste già un'istanza con la stessa chiave
    const instance = this.clients.get(userId);
    if (!instance) throw new Error("Client not found.");

    // La elimino
    this.clients.delete(userId);
  }

  public async startTimer(): Promise<void> {
    this.startTime = new Date();
  }
}

class ClassSnapsInstances {
  public instances: Map<string, ClassSnapInstance> = new Map(); // Key, Instance

  public async findAllInstances(): Promise<ClassSnapInstance[]> {
    return Array.from(this.instances.values());
  }

  public async findInstanceByKey(
    key: string
  ): Promise<ClassSnapInstance | undefined> {
    return this.instances.get(key);
  }

  public async createInstance(
    key: string,
    model: SnapInstance
  ): Promise<ClassSnapInstance> {
    // Controllo se esiste già un'istanza con la stessa chiave
    const instance = this.instances.get(key);
    if (instance) throw new Error("Snap instance already exists.");

    // Creo l'istanza
    const newInstance = new ClassSnapInstance(key, model);
    this.instances.set(key, newInstance);
    return newInstance;
  }

  public async deleteInstance(key: string): Promise<void> {
    // Controllo se esiste già un'istanza con la stessa chiave
    const instance = this.instances.get(key);
    if (!instance) throw new Error("Snap instance not found.");

    // La elimino
    this.instances.delete(key);
  }

  public async addClientToInstance(
    key: string,
    userId: number,
    client: ExtWebSocket
  ): Promise<void> {
    // Controllo se esiste già un'istanza con la stessa chiave
    const instance = this.instances.get(key);
    if (!instance) throw new Error("Snap instance not found.");

    // La aggiungo
    instance.addClient(userId, client);
  }

  public async removeClientFromInstance(
    key: string,
    userId: number
  ): Promise<void> {
    // Controllo se esiste già un'istanza con la stessa chiave
    const instance = this.instances.get(key);
    if (!instance) throw new Error("Snap instance not found.");

    // La elimino
    instance.deleteClient(userId);
  }

  public async findClientInInstance(
    key: string,
    userId: number
  ): Promise<ExtWebSocket | undefined> {
    // Controllo se esiste già un'istanza con la stessa chiave
    const instance = this.instances.get(key);
    if (!instance) throw new Error("Snap instance not found.");

    // Provo a trovare il client
    return instance.findClient(userId);
  }

  public async findClientsInInstance(
    key: string
  ): Promise<Map<number, ExtWebSocket>> {
    // Controllo se esiste già un'istanza con la stessa chiave
    const instance = this.instances.get(key);
    if (!instance) throw new Error("Snap instance not found.");

    // Provo a trovare il client
    return instance.clients;
  }

  public async startTimer(key: string): Promise<void> {
    // Controllo se esiste già un'istanza con la stessa chiave
    const instance = this.instances.get(key);
    if (!instance) throw new Error("Snap instance not found.");

    // Provo a trovare il client
    instance.startTimer();
  }
}

class SnapsInstancesController {
  public snapsInstances: ClassSnapsInstances = new ClassSnapsInstances();
  public snapInstanceService = new SnapInstanceService();

  public async CreateSnapInstance(
    data: any,
    client: ExtWebSocket,
    user: User | undefined,
    device: Device | undefined
  ): Promise<string> {
    if (!data) throw new HttpException(400, "Data is missing.");
    if (!user || !device) throw new HttpException(401, "Unauthorized");

    // Se l'utente ha già una snap instance, non può crearne un'altra
    if (client.snapsInstanceKey)
      throw new HttpException(400, "You are already in a snap instance.");

    const typedData = data as CreateSnapInstaceDto;

    const validationSchema = yup.object().shape({
      snapInstanceShapeId: yup.number().required(),
      users: yup
        .array()
        .of(
          yup.object().shape({
            id: yup.number().required(),
            position: yup.string().required(),
          })
        )
        .required(),
    });

    await validationSchema.validate(typedData, { abortEarly: false });

    const plainTextKey = uuidv4();
    const hashedKey =
      this.snapInstanceService.hashSnapInstanceKey(plainTextKey);
    typedData.userId = user.id;
    typedData.hashedKey = hashedKey;

    const snapInstance = await this.snapInstanceService.createSnapInstance(
      typedData
    );

    // Creo l'istanza
    await this.snapsInstances.createInstance(plainTextKey, snapInstance);

    // Lo aggiungo alla lista
    await this.snapsInstances.addClientToInstance(
      plainTextKey,
      user.id,
      client
    );

    return plainTextKey;
  }

  public async DeleteSnapInstance(
    user: User | undefined,
    device: Device | undefined,
    client: ExtWebSocket
  ): Promise<Map<number, ExtWebSocket>> {
    if (!user || !device) throw new HttpException(401, "Unauthorized");
    if (!client.snapsInstanceKey) throw new HttpException(400, "Bad request");

    const key = client.snapsInstanceKey;

    await this.snapInstanceService.deleteSnapInstanceFromKey(user.id, key);

    // Recupero i client connessi prima di eliminare l'istanza
    const clients = await this.snapsInstances.findClientsInInstance(key);

    // La elimino
    await this.snapsInstances.deleteInstance(key);

    return clients;
  }

  public async JoinSnapInstance(
    data: any,
    user: User | undefined,
    device: Device | undefined,
    client: ExtWebSocket
  ): Promise<void> {
    if (!data) throw new HttpException(400, "Data is missing.");
    if (!user || !device) throw new HttpException(401, "Unauthorized");
    if (client.snapsInstanceKey)
      throw new HttpException(400, "Bad request", null);

    const typedData = data as JoinUserToSnapInstanceDto;
    if (!typedData.key) throw new HttpException(400, "Bad request");

    const key = typedData.key;
    typedData.userId = user.id;

    // Controllo se esiste già un'istanza con la stessa chiave nelle SnapInstances
    const instance = await this.snapsInstances.findInstanceByKey(key);
    if (!instance) throw new HttpException(404, "Snap instance not found.");

    // Recupero la shape
    const snapInstanceShape = await SnapsInstancesShapes.query()
      .whereNotDeleted()
      .findById(instance.model.snapInstanceShapeId);
    if (!snapInstanceShape) throw new HttpException(404, "Shape not found.");

    const clientAlreadyExists = await this.snapsInstances.findClientInInstance(
      key,
      user.id
    );
    if (clientAlreadyExists)
      throw new HttpException(
        409,
        "You are already part of this snap instance."
      );

    const timerStart = await this.snapInstanceService.joinUserToSnapInstance(
      typedData
    );

    // Lo aggiungo alla lista
    await this.snapsInstances.addClientToInstance(
      typedData.key,
      user.id,
      client
    );

    if (timerStart) {
      await this.snapsInstances.startTimer(typedData.key);
    }
  }

  public async LeaveSnapInstance(
    data: any,
    user: User | undefined,
    device: Device | undefined,
    client: ExtWebSocket
  ): Promise<Map<number, ExtWebSocket>> {
    if (!data) throw new HttpException(400, "Data is missing.");
    if (!user || !device) throw new HttpException(401, "Unauthorized");
    if (!client.snapsInstanceKey) throw new HttpException(400, "Bad request");

    const typedData = data as LeaveUserToSnapInstanceDto;
    if (!typedData.key) throw new HttpException(400, "Bad request");

    const key = typedData.key;
    typedData.userId = user.id;

    // Controllo se esiste già un'istanza con la stessa chiave nelle SnapInstances
    const instance = await this.snapsInstances.findInstanceByKey(key);
    if (!instance) throw new HttpException(404, "Snap instance not found.");

    // Recupero la shape
    const snapInstanceShape = await SnapsInstancesShapes.query()
      .whereNotDeleted()
      .findById(instance.model.snapInstanceShapeId);
    if (!snapInstanceShape) throw new HttpException(404, "Shape not found.");

    const clientAlreadyExists = await this.snapsInstances.findClientInInstance(
      key,
      user.id
    );
    if (!clientAlreadyExists)
      throw new HttpException(409, "You are not part of this snap instance.");

    await this.snapInstanceService.leaveUserFromSnapInstance(typedData);

    // Recupero i client connessi prima di eliminare l'istanza
    const clients = await this.snapsInstances.findClientsInInstance(key);

    // Se un utente lascio lo snap allora posso eliminare l'istanza, poichè l'utente non potrà più rientrare
    this.snapsInstances.deleteInstance(key);

    return clients;
  }

  public async GetSnapInstanceClients(
    user: User | undefined,
    device: Device | undefined,
    client: ExtWebSocket
  ): Promise<Map<number, ExtWebSocket>> {
    if (!user || !device) throw new HttpException(401, "Unauthorized", null);
    if (!client.snapsInstanceKey)
      throw new HttpException(400, "Bad request", null);

    const key = client.snapsInstanceKey;

    const snapInstance = await this.findSnapInstanceByKey(key);
    if (!snapInstance)
      throw new HttpException(404, "Snap instance not found.", null);

    // Controllo se l'utente fa parte della snap instance
    const clientAlreadyExists = await this.snapsInstances.findClientInInstance(
      key,
      user.id
    );
    if (!clientAlreadyExists) {
      throw new HttpException(401, "Unauthorized", null);
    }

    // Recupero i client connessi
    const clients = await this.snapsInstances.findClientsInInstance(key);

    return clients;
  }

  public async GetSnapInstance(
    key: string,
    user: User | undefined
  ): Promise<{
    id: number;
    key: string;
    title: string;
    shape: {
      id: number;
      name: string;
    };
    users: Array<{
      id: number;
      position: string;
      isJoined: boolean;
    }>;
    timer: {
      start: boolean;
      seconds: number;
      minutes: number;
    };
  }> {
    if (!user) throw new HttpException(401, "Unauthorized");
    const instance = await this.findSnapInstanceByKey(key);
    if (!instance)
      throw new HttpException(404, "Snap instance not found.", null);

    const shape = await SnapsInstancesShapes.query()
      .whereNotDeleted()
      .findById(instance.snapInstanceShapeId);
    if (!shape) throw new HttpException(404, "Shape not found.", null);

    // Recupero tutti gli utenti che fanno parte della snap instance
    const snapInstanceUsers = await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .where({ snapInstanceId: instance.id });
    const filteredSnapInstanceUsers = snapInstanceUsers.filter(
      (snapInstanceUser) => {
        return snapInstanceUser.userId !== user.id;
      }
    );

    let users: Array<{
      id: number;
      position: string;
      isJoined: boolean;
    }> = [];

    await Promise.all(
      snapInstanceUsers.map(async (snapInstanceUser) => {
        let position = await SnapsInstancesShapesPositions.query()
          .whereNotDeleted()
          .findById(snapInstanceUser.snapInstanceShapePositionId);
        if (position) {
          let isJoined = await this.snapsInstances.findClientInInstance(
            key,
            snapInstanceUser.userId
          );
          users.push({
            id: snapInstanceUser.userId,
            position: position.name,
            isJoined: isJoined ? true : false,
          });
        }
      })
    );

    let start = boolean(instance.timerStarted);
    let title = "";
    if (start) {
      if (filteredSnapInstanceUsers.length === 1) {
        // Significa che sono il creatore della snap instance ed un suo amico
        let findUser = await Users.query()
          .whereNotDeleted()
          .findById(filteredSnapInstanceUsers[0].userId);
        if (findUser) {
          title = `You and ${findUser.username} sync in {countdown}`;
        }
      } else {
        title = `You and ${filteredSnapInstanceUsers.length} friends sync in {countdown}`;
      }
    } else {
      title = "Wait your friends...";
    }

    return {
      id: instance.id,
      key: key,
      title: title,
      users: users,
      timer: {
        start: boolean(instance.timerStarted),
        minutes: instance.timerDurationMinutes,
        seconds: instance.timerDurationSeconds,
      },
      shape: {
        id: shape.id,
        name: shape.name,
      },
    };
  }

  public async ConnectionClosed(
    client: ExtWebSocket,
    user: User
  ): Promise<{
    key: string;
    clients: Map<number, ExtWebSocket>;
    message: SystemMessage;
  } | null> {
    let response: {
      key: string;
      clients: Map<number, ExtWebSocket>;
      message: SystemMessage;
    } | null = null;

    if (client.snapsInstanceKey) {
      // Controllo se esiste già un'istanza con la stessa chiave
      const instance = await this.snapsInstances.findInstanceByKey(
        client.snapsInstanceKey
      );
      if (instance) {
        // Elimino l'istanza e mando il messaggio a tutti i client connessi

        // Elimino i SnapInstanceUsers
        await SnapsInstancesUsers.query()
          .where({ snapInstanceId: instance.model.id })
          .delete();

        // Elimino l'istanza dal DB
        await SnapsInstances.query().deleteById(instance.model.id);

        // Recupero i client connessi prima di eliminare l'istanza
        const clients = await this.snapsInstances.findClientsInInstance(
          client.snapsInstanceKey
        );

        // La elimino
        await this.snapsInstances.deleteInstance(client.snapsInstanceKey);

        if (instance.model.userId === user.id) {
          response = {
            key: client.snapsInstanceKey,
            clients: clients,
            message: {
              message: `The instance has been deleted because the owner left`,
              action: "DELETE_SNAP_INSTANCE",
              data: {
                key: client.snapsInstanceKey,

                exit: true,
              },
              success: true,
              isBroadcast: false,
              sender: "NS",
            },
          };
        } else {
          response = {
            key: client.snapsInstanceKey,
            clients: clients,
            message: {
              message: `${user.username} left the instance`,
              action: "LEAVE_SNAP_INSTANCE",
              data: {
                key: client.snapsInstanceKey,
                exit: true, // Servirà perchè poi dal front-end forzo l'uscita dalla schermata
              },
              success: true,
              isBroadcast: false,
              sender: "NS",
            },
          };
        }
      }
    }

    return response;
  }

  private async findSnapInstanceByKey(
    key: string
  ): Promise<SnapsInstances | undefined> {
    let hashedKey = this.snapInstanceService.hashSnapInstanceKey(key);
    const findOne = await SnapsInstances.query()
      .whereNotDeleted()
      .findOne({ hashedKey: hashedKey });
    return findOne;
  }
}

export default SnapsInstancesController;
