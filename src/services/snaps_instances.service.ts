import { CreateSnapInstanceDto } from "@/dtos/snaps_instances.dto";
import {
  CreateSnapInstanceUserDto,
  JoinUserToSnapInstanceDto,
} from "@/dtos/snaps_instances_users.dto";
import { HttpException } from "@/exceptions/HttpException";
import { SnapInstance } from "@/interfaces/snaps_instances.interface";
import { Users } from "@/models/users.model";
import { SnapsInstances } from "@/models/snaps_instances.model";
import { SnapsInstancesUsers } from "@/models/snaps_instances_users.model";
import sha256 from "crypto-js/sha256";
import { boolean } from "boolean";
import FriendService from "./friends.service";

class SnapInstanceService {
  public async findSnapInstanceByKey(key: string): Promise<SnapInstance> {
    const findSnapInstance = await SnapsInstances.query()
      .whereNotDeleted()
      .andWhere({ instanceKey: key })
      .first();
    if (!findSnapInstance)
      throw new HttpException(404, "Snap instance not found.");

    return findSnapInstance;
  }

  public async createSnapInstance(
    data: CreateSnapInstanceDto,
    snapSyncUsersData: CreateSnapInstanceUserDto[]
  ): Promise<SnapInstance> {
    const key = sha256(new Date().getTime().toString()).toString();

    const findUser = await Users.query()
      .whereNotDeleted()
      .findById(data.userId);
    if (!findUser) throw new HttpException(404, "User doesn't exist");

    const ownerSnapSyncUser = snapSyncUsersData.find(
      (snapSyncUser) => snapSyncUser.isOwner
    );
    if (!ownerSnapSyncUser) throw new HttpException(400, "Ops! Data is empty");
    if (ownerSnapSyncUser.userId !== data.userId)
      throw new HttpException(400, "Ops! Owner must be the same of userId");

    // Controllo se snapSyncUsersData ha 2 elementi
    if (snapSyncUsersData.length < 2)
      throw new HttpException(400, "Ops! You must provide at least 2 users");

    // Controllo che i due utenti non siano uguali
    const userIds = snapSyncUsersData.map(
      (snapSyncUser) => snapSyncUser.userId
    );
    const uniqueUserIds = [...new Set(userIds)];
    if (userIds.length !== uniqueUserIds.length)
      throw new HttpException(
        400,
        "Ops! You must provide at least 2 different users"
      );

    // Controllo che i due utenti esistano
    const findUsers = await Users.query().whereNotDeleted().findByIds(userIds);
    if (findUsers.length !== userIds.length)
      throw new HttpException(404, "One or more users don't exist");

    // Controllo che i due utenti siano amici
    const areFriends = await new FriendService().areFriends(
      userIds[0],
      userIds[1]
    );
    if (!areFriends)
      throw new HttpException(400, "Ops! You must provide 2 friends");

    // TODO: Controllo che i due utenti non abbiano già uno SnapInstance in corso

    const trx = await SnapsInstances.startTransaction();

    try {
      const snapInstance = await SnapsInstances.query(trx).insertAndFetch({
        userId: data.userId,
        instanceKey: key,
      });

      // Sistemo i dati di snapSyncUsersData
      snapSyncUsersData.forEach((snapSyncUser) => {
        snapSyncUser.snapInstanceId = snapInstance.id;
      });

      // Creo gli SnapInstanceUsers
      await SnapsInstancesUsers.query(trx).insertGraph(snapSyncUsersData);

      await trx.commit();

      return snapInstance;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  public async joinUserToSnapInstance(
    data: JoinUserToSnapInstanceDto
  ): Promise<{
    joinedUsername: string;
    isJoinedOwner: boolean;
  }> {
    const findUser = await Users.query()
      .whereNotDeleted()
      .findById(data.userId);
    if (!findUser) throw new HttpException(404, "User not found.");

    const findSnapInstance = await this.findSnapInstanceByKey(data.key);

    // Controllo se l'utente può entrare nella snap instance
    const snapInstanceUser = await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .findOne({ userId: findUser.id, snapInstanceId: findSnapInstance.id });
    if (!snapInstanceUser)
      throw new HttpException(403, "You can't join this snap instance.");

    // Controllo se l'utente è già entrato
    const isAlreadyJoined = await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .findOne({
        userId: findUser.id,
        snapInstanceId: findSnapInstance.id,
        isJoined: true,
      });
    if (isAlreadyJoined) {
      throw new HttpException(
        409,
        "You are already joined to this snap instance."
      );
    }

    // Se l'utente che sta provando ad entrare è il proprietario, allora devo controllare che l'altro utente sia entrato
    let isJoinedOwner = false;
    if (boolean(snapInstanceUser.isOwner)) {
      const otherUser = await SnapsInstancesUsers.query()
        .whereNotDeleted()
        .findOne({
          snapInstanceId: findSnapInstance.id,
          isOwner: false,
          isJoined: true,
        });
      if (!otherUser) {
        throw new HttpException(
          400,
          "Wait for the other user to join the snap instance."
        );
      }
      isJoinedOwner = true;
    }

    const trx = await SnapsInstances.startTransaction();
    try {
      // Aggiorno il record con isJoined = true, ed joinedAt = now
      await SnapsInstancesUsers.query()
        .whereNotDeleted()
        .andWhere({ userId: findUser.id, snapInstanceId: findSnapInstance.id })
        .update({
          isJoined: true,
          joinedAt: new Date(),
        });

      if (isJoinedOwner) {
        // Faccio partire il timer
        await SnapsInstances.query(trx)
          .whereNotDeleted()
          .findById(findSnapInstance.id)
          .patch({
            timerStarted: true,
            timerStartAt: new Date(),
          });
      }

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }

    return {
      joinedUsername: findUser.username,
      isJoinedOwner: isJoinedOwner,
    };
  }

  // public async leaveUserFromSnapInstance(
  //   data: LeaveUserToSnapInstanceDto
  // ): Promise<void> {
  //   const findUser = await Users.query()
  //     .whereNotDeleted()
  //     .findById(data.userId);
  //   if (!findUser) throw new HttpException(404, "User not found.");
  //   const findSnapInstance = await this.findSnapInstanceByKey(data.key);

  //   // Controllo se effettivamente l'utente è entrato
  //   const snapInstanceUser = await SnapsInstancesUsers.query()
  //     .whereNotDeleted()
  //     .findOne({ userId: findUser.id, snapInstanceId: findSnapInstance.id });
  //   if (!snapInstanceUser) {
  //     throw new HttpException(403, "You can't leave this snap instance.");
  //   }
  //   if (!boolean(snapInstanceUser.isJoined)) {
  //     throw new HttpException(
  //       400,
  //       "Ops! You are not joined to this snap instance."
  //     );
  //   }

  //   const trx = await SnapsInstances.startTransaction();
  //   try {
  //     // Elimino gli snaps_instances_users
  //     await SnapsInstancesUsers.query(trx)
  //       .whereNotDeleted()
  //       .andWhere({ snapInstanceId: findSnapInstance.id })
  //       .delete();

  //     // Elimino la snap_instance
  //     await SnapsInstances.query(trx)
  //       .whereNotDeleted()
  //       .findById(findSnapInstance.id)
  //       .delete();

  //     await trx.commit();
  //   } catch (error) {
  //     await trx.rollback();
  //     throw error;
  //   }
  // }

  // public async deleteSnapInstanceFromKey(
  //   userId: number,
  //   plainTextKey: string
  // ): Promise<void> {
  //   // Recupero l'istanza nel db
  //   const findSnapInstance = await this.findSnapInstanceByKey(plainTextKey);

  //   const findUser = await Users.query().whereNotDeleted().findById(userId);
  //   if (!findUser) throw new HttpException(404, "User not found.");

  //   // Controllo se l'utente è il proprietario
  //   if (findSnapInstance.userId !== findUser.id) {
  //     throw new HttpException(
  //       403,
  //       "You can't delete this snap instance because you are not the owner."
  //     );
  //   }

  //   const trx = await SnapsInstances.startTransaction();

  //   try {
  //     // Elimino i SnapInstanceUsers
  //     await SnapsInstancesUsers.query(trx)
  //       .where({ snapInstanceId: findSnapInstance.id })
  //       .delete();

  //     // Elimino l'istanza
  //     await SnapsInstances.query(trx).deleteById(findSnapInstance.id);

  //     await trx.commit();
  //   } catch (error) {
  //     await trx.rollback();
  //     throw error;
  //   }
  // }

  public async deleteSnapInstanceFromKey(
    userId: number,
    key: string
  ): Promise<void> {
    const findUser = await Users.query().whereNotDeleted().findById(userId);
    if (!findUser) throw new HttpException(404, "User not found.");

    const findSnapInstance = await this.findSnapInstanceByKey(key);

    // Controllo se l'utente è il proprietario
    if (findSnapInstance.userId !== findUser.id) {
      throw new HttpException(
        401,
        "You can't delete this snap instance because you are not the owner."
      );
    }

    const trx = await SnapsInstances.startTransaction();

    try {
      // Elimino i SnapInstanceUsers
      await SnapsInstancesUsers.query(trx)
        .where({ snapInstanceId: findSnapInstance.id })
        .delete();

      // Elimino l'istanza
      await SnapsInstances.query(trx).deleteById(findSnapInstance.id);

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}

export default SnapInstanceService;
