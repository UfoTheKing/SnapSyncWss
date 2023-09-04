export interface CreateSnapInstaceDto {
  userId: number;
  snapInstanceShapeId: number;

  hashedKey: string;

  users: Array<{
    id: number;
    position: string;
  }>;
}
