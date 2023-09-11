import { SnapShape } from "@/interfaces/snaps_shapes.interface";
import { Model, ModelObject, Pojo } from "objection";
import objectionSoftDelete from "objection-js-soft-delete";

// Specify the options for this plugin. This are the defaults.
const softDelete = objectionSoftDelete({
  columnName: "deletedAt",
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class SnapsShapes extends softDelete(Model) implements SnapShape {
  id!: number;
  name!: string;
  numberOfUsers!: number;

  iconKey!: string;
  focusedIconKey!: string;
  columns!: number;
  rows!: number;
  spacing!: number;
  width!: number;
  height!: number;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  unarchived!: boolean;

  static tableName = "snaps_shapes";
  static idColumn = "id";

  $formatJson(json: Pojo): Pojo {
    const formattedJson = super.$formatJson(json);

    delete formattedJson.createdAt;
    delete formattedJson.updatedAt;
    delete formattedJson.deletedAt;
    delete formattedJson.unarchived;

    return formattedJson;
  }
}

export type SnapsShapesShape = ModelObject<SnapsShapes>;
