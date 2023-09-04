import { Model, ModelObject } from "objection";
import { WebsocketClient } from "@/interfaces/websocket_clients.interface";
import objectionSoftDelete from "objection-js-soft-delete";

// Specify the options for this plugin. This are the defaults.
const softDelete = objectionSoftDelete({
  columnName: "deletedAt",
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class WebsocketClients
  extends softDelete(Model)
  implements WebsocketClient
{
  id!: number;
  userId!: number;
  deviceId!: number;
  uuid!: string;
  startedAt!: Date;
  endedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;

  unarchived!: boolean;

  static tableName = "websocket_clients";
  static idColumn = "id";
}

export type WebsocketClientsShape = ModelObject<WebsocketClients>;
