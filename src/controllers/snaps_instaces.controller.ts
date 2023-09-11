import * as yup from "yup";
import { HttpException } from "@/exceptions/HttpException";
import { boolean } from "boolean";
import SnapInstanceService from "@/services/snaps_instances.service";
import { CreateSnapInstaceDto } from "@/dtos/snaps_instances.dto";
import { SnapInstance } from "@/interfaces/snaps_instances.interface";
import {
  JoinUserToSnapInstanceDto,
  LeaveUserToSnapInstanceDto,
} from "@/dtos/snaps_instances_users.dto";
import SnapShapeService from "@/services/snaps_shapes.service";
import SnapInstanceUserService from "@/services/snaps_instances_users.service";
import SnapShapePositionService from "@/services/snaps_shapes_positions.service";
import ExpoService from "@/services/expo.service";
import { ExtWebSocket, SystemMessage } from "@/interfaces/wss.interface";

class ClassSnapInstance {
  public key: string;
  public clients: Map<number, ExtWebSocket> = new Map(); // UserId, Client
  public model: SnapInstance;

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
}

class SnapsInstancesController {
  public snapsInstances: ClassSnapsInstances = new ClassSnapsInstances();
  public snapInstanceService = new SnapInstanceService();
  public snapShapeService = new SnapShapeService();
  public snapInstanceUserService = new SnapInstanceUserService();
  public snapShapePositionService = new SnapShapePositionService();
  public expoService = new ExpoService();

  public async CreateSnapInstance(
    data: any,
    client: ExtWebSocket
  ): Promise<string> {
    if (!data) throw new HttpException(400, "Data is missing.");
    if (!client.user || !client.device)
      throw new HttpException(401, "Unauthorized");

    // Se l'utente ha già una snap instance, non può crearne un'altra
    if (client.snapsInstanceKey)
      throw new HttpException(409, "You are already in a snap instance.");

    const typedData = data as CreateSnapInstaceDto;

    const validationSchema = yup.object().shape({
      snapShapeId: yup.number().required(),
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

    // String 64 chars
    const key = await this.snapInstanceService.generateKey();
    typedData.userId = client.user.id;
    typedData.key = key;

    const snapInstance = await this.snapInstanceService.createSnapInstance(
      typedData
    );

    // Creo l'istanza
    await this.snapsInstances.createInstance(key, snapInstance);

    // Lo aggiungo alla lista
    await this.snapsInstances.addClientToInstance(
      key,
      typedData.userId,
      client
    );

    // Invio la notifica a tutti gli utenti, tranne a me stesso
    let usersIds = typedData.users.map((item) => item.id);
    await this.expoService.sendSnapSyncNotification(key, usersIds, client.user);

    return key;
  }

  // public async DeleteSnapInstance(client: ExtWebSocket): Promise<void> {
  //   if (!client.user || !client.device)
  //     throw new HttpException(401, "Unauthorized");
  //   if (!client.snapsInstanceKey) throw new HttpException(400, "Bad request");

  //   const key = client.snapsInstanceKey;

  //   await this.snapInstanceService.deleteSnapInstanceFromKey(
  //     client.user.id,
  //     key
  //   );

  //   // La elimino
  //   await this.snapsInstances.deleteInstance(key);
  // }

  public async JoinSnapInstance(
    data: any,
    client: ExtWebSocket
  ): Promise<void> {
    if (!data) throw new HttpException(400, "Data is missing.");
    if (!client.user || !client.device)
      throw new HttpException(401, "Unauthorized");
    if (client.snapsInstanceKey)
      throw new HttpException(400, "Bad request", null);

    const typedData = data as JoinUserToSnapInstanceDto;
    if (!typedData.key) throw new HttpException(400, "Bad request");

    const key = typedData.key;
    typedData.userId = client.user.id;

    // Controllo se esiste già un'istanza con la stessa chiave nelle SnapInstances
    const instance = await this.snapsInstances.findInstanceByKey(key);
    if (!instance) throw new HttpException(404, "Snap instance not found.");

    const clientAlreadyExists = await this.snapsInstances.findClientInInstance(
      key,
      typedData.userId
    );
    if (!clientAlreadyExists) {
      await this.snapInstanceService.joinUserToSnapInstance(typedData);
      // Lo aggiungo alla lista
      await this.snapsInstances.addClientToInstance(
        typedData.key,
        typedData.userId,
        client
      );
    } else {
      throw new HttpException(409, "You are already in this snap instance.");
    }
  }

  public async LeaveSnapInstance(client: ExtWebSocket): Promise<void> {
    if (!client.user || !client.device)
      throw new HttpException(401, "Unauthorized");
    if (!client.snapsInstanceKey) throw new HttpException(400, "Bad request");

    const key = client.snapsInstanceKey;

    // Controllo se esiste già un'istanza con la stessa chiave nelle SnapInstances
    const instance = await this.snapsInstances.findInstanceByKey(key);
    if (!instance) throw new HttpException(404, "Snap instance not found.");

    const clientAlreadyExists = await this.snapsInstances.findClientInInstance(
      key,
      client.user.id
    );
    if (!clientAlreadyExists)
      throw new HttpException(403, "You are not part of this snap instance.");

    const data: LeaveUserToSnapInstanceDto = {
      key: key,
      userId: client.user.id,
    };

    await this.snapInstanceService.leaveUserFromSnapInstance(data);

    // Se un utente lascio lo snap allora posso eliminare l'istanza, poichè lo snap non può essere più sincronizzato
    this.snapsInstances.deleteInstance(key);
  }

  public async GetSnapInstanceClients(
    key: string
  ): Promise<Map<number, ExtWebSocket>> {
    const snapInstance = await this.snapInstanceService.findSnapInstanceByKey(
      key
    );

    // Recupero i client connessi
    const clients = await this.snapsInstances.findClientsInInstance(
      snapInstance.instanceKey
    );

    return clients;
  }

  public async GetSnapInstance(key: string): Promise<{
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
    const instance = await this.snapInstanceService.findSnapInstanceByKey(key);
    const shape = await this.snapShapeService.findShapShapeById(
      instance.snapShapeId
    );

    // Recupero tutti gli utenti che fanno parte della snap instance
    const snapInstanceUsers =
      await this.snapInstanceUserService.findSnapsInstancesUsersBySnapInstanceId(
        instance.id
      );

    let users: Array<{
      id: number;
      position: string;
      isJoined: boolean;
    }> = [];

    await Promise.all(
      snapInstanceUsers.map(async (snapInstanceUser) => {
        let position =
          await this.snapShapePositionService.findSnapShapePositionById(
            snapInstanceUser.snapShapePositionId
          );

        let isJoined = await this.snapsInstances.findClientInInstance(
          key,
          snapInstanceUser.userId
        );
        users.push({
          id: snapInstanceUser.userId,
          position: position.name,
          isJoined: isJoined ? true : false,
        });
      })
    );

    let start = boolean(instance.timerStarted);
    let title = "";
    if (start) {
      if (snapInstanceUsers.length - 1 === 1) {
        // Significa che sono il creatore della snap instance ed un suo amico
        title = `You and {{username}} sync in {{timer}}`;
      } else {
        title = `You and ${
          snapInstanceUsers.length - 1
        } friends sync in {{timer}}`;
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

  public async ConnectionClosed(client: ExtWebSocket): Promise<{
    key: string;
    clients: Map<number, ExtWebSocket>;
    message: SystemMessage;
  } | null> {
    let response: {
      key: string;
      clients: Map<number, ExtWebSocket>;
      message: SystemMessage;
    } | null = null;

    if (client.snapsInstanceKey && client.user) {
      // Controllo se esiste già un'istanza con la stessa chiave
      const instance = await this.snapsInstances.findInstanceByKey(
        client.snapsInstanceKey
      );
      if (instance) {
        await this.snapInstanceService.deleteSnapInstanceFromKey(
          instance.model.userId,
          instance.model.instanceKey
        );

        // Recupero i client connessi prima di eliminare l'istanza
        const clients = await this.snapsInstances.findClientsInInstance(
          client.snapsInstanceKey
        );

        // La elimino
        await this.snapsInstances.deleteInstance(client.snapsInstanceKey);

        response = {
          key: client.snapsInstanceKey,
          clients: clients,
          message: {
            message: `The instance has been deleted because the ${client.user.username} has disconnected.`,
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
      }
    }

    return response;
  }

  public async DeleteSnapInstanceSystem(key: string): Promise<void> {
    const instance = await this.snapInstanceService.findSnapInstanceByKey(key);

    await this.snapInstanceService.deleteSnapInstanceFromKey(
      instance.userId,
      key
    );

    // La elimino
    await this.snapsInstances.deleteInstance(key);
  }
}

export default SnapsInstancesController;
