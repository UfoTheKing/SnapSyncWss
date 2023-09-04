import { Model, ModelObject, Pojo } from "objection";
import objectionSoftDelete from "objection-js-soft-delete";
import { BlockedUser } from "@/interfaces/blocked_users.interface";

// Specify the options for this plugin. This are the defaults.
const softDelete = objectionSoftDelete({
  columnName: "deletedAt",
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class BlockedUsers extends softDelete(Model) implements BlockedUser {
  id!: number;
  userId!: number;
  blockedUserId!: number;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  unarchived!: boolean;

  static tableName = "blocked_users";
  static idColumn = "id";

  $formatJson(json: Pojo): Pojo {
    json = super.$formatJson(json);
    delete json.createdAt;
    delete json.updatedAt;
    delete json.deletedAt;
    delete json.unarchived;
    return json;
  }
}

export type BlockedUsersShape = ModelObject<BlockedUsers>;
