import { CreateSnapInstaceDto } from "@/dtos/snaps_instances.dto";
import {
  CreateSnapInstanceUserDto,
  JoinUserToSnapInstanceDto,
  LeaveUserToSnapInstanceDto,
} from "@/dtos/snaps_instances_users.dto";
import { HttpException } from "@/exceptions/HttpException";
import { SnapInstance } from "@/interfaces/snaps_instances.interface";
import { Users } from "@/models/users.model";
import FriendService from "./friends.service";
import { SnapsInstances } from "@/models/snaps_instances.model";
import { SnapsInstancesUsers } from "@/models/snaps_instances_users.model";
import sha256 from "crypto-js/sha256";
import { boolean } from "boolean";
import { SnapsShapes } from "@/models/snaps_shapes.model";
import { SnapsShapesPositions } from "@/models/snaps_shapes_positions.model";

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
    data: CreateSnapInstaceDto
  ): Promise<SnapInstance> {
    const findUser = await Users.query()
      .whereNotDeleted()
      .findById(data.userId);
    if (!findUser) throw new HttpException(404, `User not found.`);

    const shape = await SnapsShapes.query()
      .whereNotDeleted()
      .findById(data.snapShapeId);
    if (!shape) throw new HttpException(404, "Shape not found.");

    // Recupero la posizione che andrà assegnata all'owner
    const ownerPosition = await SnapsShapesPositions.query()
      .whereNotDeleted()
      .findOne({ snapShapeId: shape.id, ownerPosition: true });
    if (!ownerPosition)
      throw new HttpException(500, "Ops! Something went wrong.");

    // Recupero le altre posizioni
    const otherPositions = await SnapsShapesPositions.query()
      .whereNotDeleted()
      .where({ snapShapeId: shape.id, ownerPosition: false });
    if (shape.numberOfUsers !== otherPositions.length + 1)
      throw new HttpException(500, "Ops! Something went wrong.");

    // Controllo se ci sono dei duplicati all'interno dell'array
    let usersIds = data.users.map((user) => user.id);
    let uniqueUsersIds = [...new Set(usersIds)];
    if (usersIds.length !== uniqueUsersIds.length)
      throw new HttpException(
        400,
        "You can't select the same user more than once"
      );

    // Controllo se in usersIds c'è l'id dell'utente che crea la richiesta
    if (usersIds.includes(findUser.id))
      throw new HttpException(400, "You can't select yourself");

    // Controllo se effettivamente il numero di utenti univoci è uguale a quello richiesto
    if (shape.numberOfUsers !== uniqueUsersIds.length + 1)
      throw new HttpException(
        400,
        `You must select ${shape.numberOfUsers - 1} users`
      );

    const usersDto: CreateSnapInstanceUserDto[] = [];

    // Aggiungo l'owner
    usersDto.push({
      userId: findUser.id,
      snapInstanceId: -1, // Lo sistemiamo dopo
      snapShapePositionId: ownerPosition.id,
      isOwner: true,
      isJoined: true,
      joinedAt: new Date(),
    });

    // Per ogni utente controllo se esiste se sono amici
    for (let i = 0; i < data.users.length; i++) {
      let userId = data.users[i].id;
      let position = data.users[i].position;

      const findSnapUser = await Users.query()
        .whereNotDeleted()
        .findById(userId);
      if (!findSnapUser) throw new HttpException(404, "User not found.");

      // Controllo se sono amici
      const friendship = await new FriendService().areFriends(
        findUser.id,
        findSnapUser.id
      );
      if (!friendship)
        throw new HttpException(
          400,
          "You can't invite this user because you are not friends."
        );

      // Controllo se la position è disponibile
      let findSnapsInstancesShapesPositionsFilteredIndex =
        otherPositions.findIndex(
          (snapInstanceShapePosition) =>
            snapInstanceShapePosition.name === position.toUpperCase()
        );
      if (findSnapsInstancesShapesPositionsFilteredIndex === -1)
        throw new HttpException(400, "Position not found.");

      const SnapInstanceShapePosition =
        otherPositions[findSnapsInstancesShapesPositionsFilteredIndex];

      // Rimuovo la position dall'array
      otherPositions.splice(findSnapsInstancesShapesPositionsFilteredIndex, 1);

      // Aggiungo l'utente
      usersDto.push({
        userId: userId,
        snapInstanceId: -1, // Lo sistemiamo dopo
        snapShapePositionId: SnapInstanceShapePosition.id,
        isOwner: false,
      });
    }

    const trx = await SnapsInstances.startTransaction();

    try {
      const createdSnapInstance = await SnapsInstances.query(trx).insert({
        userId: findUser.id,
        snapShapeId: shape.id,
        instanceKey: data.key,
      });

      // Sistemo i dtos
      usersDto.forEach((userDto) => {
        userDto.snapInstanceId = createdSnapInstance.id;
      });

      await SnapsInstancesUsers.query(trx).insertGraph(usersDto);

      // Creo le notifiche

      await trx.commit();

      return createdSnapInstance;
    } catch (error) {
      await trx.rollback();
      throw new HttpException(500, "Ops! Something went wrong.");
    }
  }

  public async joinUserToSnapInstance(
    data: JoinUserToSnapInstanceDto
  ): Promise<void> {
    const findUser = await Users.query()
      .whereNotDeleted()
      .findById(data.userId);
    if (!findUser) throw new HttpException(404, "User not found.");

    const findSnapInstance = await this.findSnapInstanceByKey(data.key);

    // Recupero la shape
    const shape = await SnapsShapes.query()
      .whereNotDeleted()
      .findById(findSnapInstance.snapShapeId);
    if (!shape) throw new HttpException(404, "Shape not found.");

    // Controllo se l'utente può entrare nella snap instance
    const snapInstanceUser = await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .findOne({ userId: findUser.id, snapInstanceId: findSnapInstance.id });
    if (!snapInstanceUser) {
      throw new HttpException(403, "You can't join this snap instance.");
    }

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

    // Aggiorno il record con isJoined = true, ed joinedAt = now
    await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .andWhere({ userId: findUser.id, snapInstanceId: findSnapInstance.id })
      .update({
        isJoined: true,
        joinedAt: new Date(),
      });

    // Controllo se tutti gli utenti sono entrati
    const countJoinedUsers = await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .andWhere({ snapInstanceId: findSnapInstance.id, isJoined: true })
      .resultSize();

    if (countJoinedUsers === shape.numberOfUsers) {
      // Devo aggiornare il record nella tabella snaps_instances
      await SnapsInstances.query()
        .whereNotDeleted()
        .findById(findSnapInstance.id)
        .update({
          timerStarted: true,

          timerStartAt: new Date(),
        });
    }
  }

  public async leaveUserFromSnapInstance(
    data: LeaveUserToSnapInstanceDto
  ): Promise<void> {
    const findUser = await Users.query()
      .whereNotDeleted()
      .findById(data.userId);
    if (!findUser) throw new HttpException(404, "User not found.");
    const findSnapInstance = await this.findSnapInstanceByKey(data.key);

    // Controllo se effettivamente l'utente è entrato
    const snapInstanceUser = await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .findOne({ userId: findUser.id, snapInstanceId: findSnapInstance.id });
    if (!snapInstanceUser) {
      throw new HttpException(403, "You can't leave this snap instance.");
    }
    if (!boolean(snapInstanceUser.isJoined)) {
      throw new HttpException(
        400,
        "Ops! You are not joined to this snap instance."
      );
    }

    const trx = await SnapsInstances.startTransaction();
    try {
      // Elimino gli snaps_instances_users
      await SnapsInstancesUsers.query(trx)
        .whereNotDeleted()
        .andWhere({ snapInstanceId: findSnapInstance.id })
        .delete();

      // Elimino la snap_instance
      await SnapsInstances.query(trx)
        .whereNotDeleted()
        .findById(findSnapInstance.id)
        .delete();

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  public async deleteSnapInstanceFromKey(
    userId: number,
    plainTextKey: string
  ): Promise<void> {
    // Recupero l'istanza nel db
    const findSnapInstance = await this.findSnapInstanceByKey(plainTextKey);

    const findUser = await Users.query().whereNotDeleted().findById(userId);
    if (!findUser) throw new HttpException(404, "User not found.");

    // Controllo se l'utente è il proprietario
    if (findSnapInstance.userId !== findUser.id) {
      throw new HttpException(
        403,
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

  public generateKey(): string {
    let key = sha256(new Date().getTime().toString()).toString();

    return key;
  }
}

export default SnapInstanceService;
