import { Model, ModelObject, Pojo } from "objection";
import objectionSoftDelete from "objection-js-soft-delete";
import { SnapShapePosition } from "@/interfaces/snaps_shapes_positions.interface";

// Specify the options for this plugin. This are the defaults.
const softDelete = objectionSoftDelete({
  columnName: "deletedAt",
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class SnapsShapesPositions
  extends softDelete(Model)
  implements SnapShapePosition
{
  id!: number;
  snapShapeId!: number;
  name!: string;

  width!: number;
  height!: number;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  unarchived!: boolean;

  ownerPosition!: boolean;

  static tableName = "snaps_shapes_positions";
  static idColumn = "id";
}

export type SnapsShapesPositionsShape = ModelObject<SnapsShapesPositions>;
