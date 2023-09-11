import { Model, ModelObject, Pojo } from 'objection';
import { ExpoPushToken } from '@/interfaces/expo_push_tokens.interface';

export class ExpoPushTokens extends Model implements ExpoPushToken {
  id!: number;
    userId!: number;
    deviceId!: number;

    token!: string;

  createdAt!: Date;
  updatedAt!: Date;

  static tableName = 'expo_push_tokens'; // database table name
  static idColumn = 'id'; // id column name

  $formatJson(json: Pojo): Pojo {
    json = super.$formatJson(json);

    delete json.createdAt;
    delete json.updatedAt;

    return json;
  }
}

export type ExpoPushTokensShape = ModelObject<ExpoPushTokens>;
