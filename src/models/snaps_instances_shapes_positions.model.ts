import { Model, ModelObject, Pojo } from "objection";
import objectionSoftDelete from "objection-js-soft-delete";
import { SnapInstanceShapePosition } from "@/interfaces/snaps_instances_shapes_positions.interface";

// Specify the options for this plugin. This are the defaults.
const softDelete = objectionSoftDelete({
  columnName: "deletedAt",
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class SnapsInstancesShapesPositions
  extends softDelete(Model)
  implements SnapInstanceShapePosition
{
  id!: number;
  snapInstanceShapeId!: number;
  name!: string;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  unarchived!: boolean;

  ownerPosition!: boolean;

  static tableName = "snaps_instances_shapes_positions";
  static idColumn = "id";
}

export type SnapsInstancesShapesPositionsShape =
  ModelObject<SnapsInstancesShapesPositions>;
