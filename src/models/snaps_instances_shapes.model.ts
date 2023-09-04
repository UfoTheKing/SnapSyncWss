import { Model, ModelObject, Pojo } from 'objection';
import objectionSoftDelete from 'objection-js-soft-delete';
import { SnapInstanceShape } from '@/interfaces/snaps_instances_shapes.interface';

// Specify the options for this plugin. This are the defaults.
const softDelete = objectionSoftDelete({
  columnName: 'deletedAt',
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class SnapsInstancesShapes extends softDelete(Model) implements SnapInstanceShape {
  id!: number;
  name!: string;
  numberOfUsers!: number;

  iconKey!: string;
  focusedIconKey!: string;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  unarchived!: boolean;

  static tableName = 'snaps_instances_shapes';
  static idColumn = 'id';

  $formatJson(json: Pojo): Pojo {
    const formattedJson = super.$formatJson(json);

    delete formattedJson.createdAt;
    delete formattedJson.updatedAt;
    delete formattedJson.deletedAt;
    delete formattedJson.unarchived;

    return formattedJson;
  }
}

export type SnapsInstancesShapesShape = ModelObject<SnapsInstancesShapes>;
