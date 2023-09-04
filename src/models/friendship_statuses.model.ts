import { Model, ModelObject } from 'objection';
import objectionSoftDelete from 'objection-js-soft-delete';
import { FriendshipStatus } from '@/interfaces/friendship_statuses.interface';

// Specify the options for this plugin. This are the defaults.
const softDelete = objectionSoftDelete({
    columnName: 'deletedAt',
    deletedValue: new Date(),
    notDeletedValue: null,
});

export class FriendshipStatuses extends softDelete(Model) implements FriendshipStatus {
    id!: number;
    name!: string;
    description!: string | null;
    
    createdAt!: Date;
    updatedAt!: Date;
    deletedAt!: Date | null;

    static tableName = 'friendship_statuses';
    static idColumn = 'id';
}

export type FriendshipStatusesShape = ModelObject<FriendshipStatuses>;
