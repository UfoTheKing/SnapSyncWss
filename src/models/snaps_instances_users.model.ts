import { Model, ModelObject } from "objection";
import objectionSoftDelete from "objection-js-soft-delete";
import { SnapInstanceUser } from "@/interfaces/snaps_instances_users.interface";

// Specify the options for this plugin. This are the defaults.
const softDelete = objectionSoftDelete({
  columnName: "deletedAt",
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class SnapsInstancesUsers
  extends softDelete(Model)
  implements SnapInstanceUser
{
  id!: number;
  userId!: number;
  snapInstanceId!: number;
  snapShapePositionId!: number;
  locationId!: number | null;

  isOwner!: boolean;
  isJoined!: boolean;
  joinedAt!: Date | null;

  s3Key!: string | null;
  cdlPublicId!: string | null;
  snappedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  unarchived!: boolean;

  static tableName = "snaps_instances_users";
  static idColumn = "id";
}

export type SnapsInstancesUsersShape = ModelObject<SnapsInstancesUsers>;
