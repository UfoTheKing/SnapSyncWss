import { WebsocketToken } from '@/interfaces/websocket_tokens.interface';
import { Model, ModelObject } from 'objection';

export class WebsocketTokens extends Model implements WebsocketToken {
  id!: number;
  token!: string;

  createdAt!: Date;
  updatedAt!: Date;

  static tableName = 'websocket_tokens';
  static idColumn = 'id';
}

export type WebsocketTokensShape = ModelObject<WebsocketTokens>;
