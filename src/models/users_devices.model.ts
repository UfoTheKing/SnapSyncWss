import { Model, ModelObject, Pojo } from "objection";
import objectionSoftDelete from "objection-js-soft-delete";
import { UserDevice } from "@/interfaces/users_devices.interface";

const softDelete = objectionSoftDelete({
  columnName: "deletedAt",
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class UsersDevices extends softDelete(Model) implements UserDevice {
  id!: number;
  userId!: number;
  deviceId!: number;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;

  unarchived!: boolean;

  static tableName = "users_devices"; // database table name
  static idColumn = "id"; // id column name
}

export type UsersDevicesShape = ModelObject<UsersDevices>;
