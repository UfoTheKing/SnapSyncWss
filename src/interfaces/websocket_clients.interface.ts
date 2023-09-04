export interface WebsocketClient {
  id: number;
  userId: number;
  deviceId: number;
  uuid: string;
  startedAt: Date;
  endedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
