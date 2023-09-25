import { HttpException } from "@/exceptions/HttpException";
import { boolean } from "boolean";
import SnapInstanceService from "@/services/snaps_instances.service";
import { SnapInstance } from "@/interfaces/snaps_instances.interface";
import {
  CreateSnapInstanceUserDto,
  JoinUserToSnapInstanceDto,
} from "@/dtos/snaps_instances_users.dto";
import SnapInstanceUserService from "@/services/snaps_instances_users.service";
import ExpoService from "@/services/expo.service";
import { ExtWebSocket, SystemMessage } from "@/interfaces/wss.interface";
import UserService from "@/services/users.service";
import { User } from "@/interfaces/users.interface";
import { WssActions } from "@/utils/enum";
import { CreateSnapInstanceDto } from "@/dtos/snaps_instances.dto";
import * as yup from "yup";
import FriendService from "@/services/friends.service";

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

// TODO: Gestire gli errori all'interno di questa classe
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
    if (instance) {
      // La elimino
      this.instances.delete(key);
    }
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
  public snapInstanceUserService = new SnapInstanceUserService();
  public expoService = new ExpoService();
  public userService = new UserService();
  public friendService = new FriendService();

  public async CreateSnapInstance(data: any): Promise<void> {
    if (!data) throw new HttpException(400, "Data is missing.");

    const typedData = data as CreateSnapInstanceDto;

    const validationSchema = yup.object().shape({
      key: yup.string().required(),
    });

    await validationSchema.validate(typedData, { abortEarly: false });

    const key = typedData.key;
    const model = await this.snapInstanceService.findSnapInstanceByKey(key);

    // Creo l'istanza
    await this.snapsInstances.createInstance(key, model);
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
  ): Promise<boolean> {
    if (!data) throw new HttpException(400, "Data is missing.");
    if (!client.user || !client.device)
      throw new HttpException(401, "Unauthorized");
    if (client.snapsInstanceKey)
      throw new HttpException(400, "Bad request", null);

    const typedData = data as JoinUserToSnapInstanceDto;
    if (!typedData.key) throw new HttpException(400, "Bad request");

    const key = typedData.key;
    typedData.userId = client.user.id;

    // Controllo se esiste un'istanza con la stessa chiave nelle SnapInstances
    const instance = await this.snapsInstances.findInstanceByKey(key);
    if (!instance) throw new HttpException(404, "Snap instance not found.");

    const clientAlreadyExists = await this.snapsInstances.findClientInInstance(
      key,
      typedData.userId
    );
    if (!clientAlreadyExists) {
      let { isJoinedOwner, joinedUsername } =
        await this.snapInstanceService.joinUserToSnapInstance(typedData);
      // Lo aggiungo alla lista
      await this.snapsInstances.addClientToInstance(
        typedData.key,
        typedData.userId,
        client
      );

      if (!isJoinedOwner) {
        // Mando una notifica all'utente che ha creato la snap instance per notificarlo che l'altro utente ha joinato
        await this.expoService.sendSnapSyncAcceptedNotification(
          typedData.key,
          [instance.model.userId],
          joinedUsername
        );

        return false;
      } else {
        // Se l'utente owner joina significa che l'altro utente ha già joinato, e posso iniziare la sincronizzazione
        return true;
      }
    } else {
      throw new HttpException(409, "You are already in this snap instance.");
    }
  }

  // public async LeaveSnapInstance(client: ExtWebSocket): Promise<void> {
  //   if (!client.user || !client.device)
  //     throw new HttpException(401, "Unauthorized");
  //   if (!client.snapsInstanceKey) throw new HttpException(400, "Bad request");

  //   const key = client.snapsInstanceKey;

  //   // Controllo se esiste già un'istanza con la stessa chiave nelle SnapInstances
  //   const instance = await this.snapsInstances.findInstanceByKey(key);
  //   if (!instance) throw new HttpException(404, "Snap instance not found.");

  //   const clientAlreadyExists = await this.snapsInstances.findClientInInstance(
  //     key,
  //     client.user.id
  //   );
  //   if (!clientAlreadyExists)
  //     throw new HttpException(403, "You are not part of this snap instance.");

  //   const data: LeaveUserToSnapInstanceDto = {
  //     key: key,
  //     userId: client.user.id,
  //   };

  //   await this.snapInstanceService.leaveUserFromSnapInstance(data);

  //   // Se un utente lascio lo snap allora posso eliminare l'istanza, poichè lo snap non può essere più sincronizzato
  //   this.snapsInstances.deleteInstance(key);
  // }

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

  public async GetSnapInstance(
    key: string,
    snappedAll: boolean = false
  ): Promise<{
    id: number;
    key: string;
    users: Array<{
      id: number;
      username: string;
      profilePictureUrl: string;
      isJoined: boolean;
    }>;
    timer: {
      start: boolean;
      seconds: number;
    };
  }> {
    const instance = await this.snapInstanceService.findSnapInstanceByKey(key);

    // Recupero tutti gli utenti che fanno parte della snap instance
    const snapInstanceUsers =
      await this.snapInstanceUserService.findSnapsInstancesUsersBySnapInstanceId(
        instance.id
      );

    let users: Array<{
      id: number;
      username: string;
      profilePictureUrl: string;
      isJoined: boolean;

      imageUrl?: string;
    }> = [];

    await Promise.all(
      snapInstanceUsers.map(async (snapInstanceUser) => {
        let isJoined = await this.snapsInstances.findClientInInstance(
          key,
          snapInstanceUser.userId
        );

        let user = await this.userService.findUserById(snapInstanceUser.userId);
        let profilePictureUrl =
          await this.userService.findUserProfilePictureUrlById(user.id);

        let imageUrl: string | undefined = undefined;
        if (snappedAll) {
          // Recupero le immagine che poi verranno mostrate in grid
          try {
            imageUrl = await this.snapInstanceUserService.imageUrlById(
              snapInstanceUser.id
            );
          } catch (error) {
            // Non faccio nulla
          }
        }

        users.push({
          id: snapInstanceUser.userId,
          username: user.username,
          profilePictureUrl: profilePictureUrl,
          isJoined: isJoined ? true : false,
          imageUrl: imageUrl,
        });
      })
    );

    return {
      id: instance.id,
      key: key,
      users: users,
      timer: {
        start: boolean(instance.timerStarted),
        seconds: instance.timerSeconds,
      },
    };
  }

  public async GetSnapInstanceTitle(key: string, user: User): Promise<string> {
    const instance = await this.snapInstanceService.findSnapInstanceByKey(key);

    // Recupero tutti gli utenti che fanno parte della snap instance
    const snapInstanceUsers =
      await this.snapInstanceUserService.findSnapsInstancesUsersBySnapInstanceId(
        instance.id
      );

    // Recupero tutti gli utenti che non sono me
    let notMeUsers = snapInstanceUsers.filter(
      (item) => item.userId !== user.id
    );

    let start = boolean(instance.timerStarted);
    let title = "";
    if (start) {
      if (notMeUsers.length === 1) {
        let nUser = await this.userService.findUserById(notMeUsers[0].userId);
        // console.log(user.username, nUser.username);

        // Significa che sono il creatore della snap instance ed un suo amico
        title = `You and ${nUser.username} sync in {{timer}}`;
      } else {
        let nUsers: string[] = [];
        await Promise.all(
          notMeUsers.map(async (item) => {
            let nUser = await this.userService.findUserById(item.userId);
            nUsers.push(nUser.username);
          })
        );
        title = `You and ${nUsers.join(", ")} sync in {{timer}}`;
      }
    } else {
      // Recupero gli utenti che non hanno ancora ancora joinato
      let notJoinedUsers = snapInstanceUsers.filter((item) => !item.isJoined);
      title = "Wait for";
      if (notJoinedUsers.length === 1) {
        let nUser = await this.userService.findUserById(
          notJoinedUsers[0].userId
        );
        title = `Wait for ${nUser.username} to join...`;
      } else {
        let nUsers: string[] = [];
        await Promise.all(
          notJoinedUsers.map(async (item) => {
            let nUser = await this.userService.findUserById(item.userId);
            nUsers.push(nUser.username);
          })
        );

        title = `Wait for ${nUsers.join(", ")} to join...`;
      }
    }

    return title;
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
            message: `The instance has been deleted because ${client.user.username} has left.`,
            action: WssActions.DELETE_SNAP_INSTANCE,
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

  // public async DeleteSnapInstanceSystem(key: string): Promise<void> {
  //   const instance = await this.snapInstanceService.findSnapInstanceByKey(key);

  //   await this.snapInstanceService.deleteSnapInstanceFromKey(
  //     instance.userId,
  //     key
  //   );

  //   // La elimino
  //   await this.snapsInstances.deleteInstance(key);
  // }
}

export default SnapsInstancesController;
