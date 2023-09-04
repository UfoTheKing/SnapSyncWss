import { Model, ModelObject } from "objection";
import objectionSoftDelete from "objection-js-soft-delete";
import { Friend } from "@/interfaces/friends.interface";

// Specify the options for this plugin. This are the defaults.
const softDelete = objectionSoftDelete({
  columnName: "deletedAt",
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class Friends extends softDelete(Model) implements Friend {
  id!: number;
  userId!: number;
  friendId!: number;
  friendshipStatusId!: number;
  acceptedAt!: Date | null;
  rejectedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  unarchived!: boolean;
  friendshipHash!: string;

  static tableName = "friends";
  static idColumn = "id";
}

export type FriendsShape = ModelObject<Friends>;
